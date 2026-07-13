"""
AI service for Meditrax — GPT (gpt-5.4) via the Emergent universal key.

  * stream_chat()        -> streaming RAG-augmented assistant replies (SSE)
  * autofill_medication()-> strict-JSON structured drug data for unknown meds
"""
import json
import logging
import os
import re
from typing import AsyncGenerator, List, Optional

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
MODEL = "gpt-5.4"

DISCLAIMER = (
    "Meditrax provides general educational information, not medical advice. "
    "Always confirm decisions with a licensed clinician or pharmacist, and never "
    "stop or change a medication abruptly without professional guidance."
)

AUTOFILL_KEYS = [
    "generic_name", "brand_names", "drug_class", "category", "default_unit",
    "common_dosages", "typical_dosing", "max_daily_dose", "common_side_effects",
    "serious_side_effects", "interactions", "warnings", "risk_level",
    "dependency_risk_category", "mechanism", "half_life", "content",
]


def _extract_json(text: str) -> dict:
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    m = re.search(r"\{.*\}", text, re.DOTALL)
    raw = m.group(0) if m else text
    return json.loads(raw)


def build_chat_system(rag_context: str = "", meds_context: str = "",
                      history: Optional[List[dict]] = None) -> str:
    parts = [
        "You are Meditrax, a warm, careful and knowledgeable medication assistant.",
        "You help users understand their medications, adherence, tapering, side effects and interactions.",
        "Be concise, supportive and plain-spoken. Use short paragraphs and bullet points when helpful.",
        "NEVER invent specific doses for a person; explain general ranges and defer dosing decisions to clinicians.",
        "If a question involves stopping a dependency-forming medication (benzodiazepines, opioids, antidepressants, gabapentinoids), "
        "recommend a gradual, clinician-supervised taper and mention the in-app Taper Planner.",
        "If asked about an emergency (overdose, severe reaction, suicidal thoughts), advise contacting emergency services or a crisis line immediately.",
        f"Always keep this boundary in mind: {DISCLAIMER}",
    ]
    if meds_context:
        parts.append("\nThe user is currently tracking these medications:\n" + meds_context)
    if rag_context:
        parts.append(
            "\nUse the following reference information from the Meditrax knowledge base when relevant. "
            "If it doesn't cover the question, rely on general medical knowledge and say so:\n" + rag_context
        )
    if history:
        transcript = "\n".join(
            f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
            for m in history[-8:]
        )
        parts.append("\nRecent conversation so far:\n" + transcript)
    return "\n".join(parts)


async def stream_chat(message: str, system_message: str, session_id: str) -> AsyncGenerator[str, None]:
    """Yield text chunks from the model."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model("openai", MODEL)
    try:
        async for event in chat.stream_message(UserMessage(text=message)):
            if isinstance(event, TextDelta):
                if event.content:
                    yield event.content
            elif isinstance(event, StreamDone):
                break
    except Exception as e:  # noqa
        logger.exception("stream_chat failed")
        yield f"\n\n_Sorry — I hit an error generating a response ({type(e).__name__}). Please try again._"


async def complete_chat(message: str, system_message: str, session_id: str) -> str:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model("openai", MODEL)
    reply = await chat.send_message(UserMessage(text=message))
    return reply if isinstance(reply, str) else str(reply)


async def autofill_medication(name: str) -> Optional[dict]:
    """Generate structured medication data for an unknown medication."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    system = (
        "You are a clinical pharmacology data generator for a medication tracker. "
        "Return ONLY valid minified JSON (no prose, no markdown fences) with EXACTLY these keys: "
        + ", ".join(AUTOFILL_KEYS) + ". "
        "Types: brand_names, common_dosages (numbers), common_side_effects, serious_side_effects, "
        "interactions, warnings are arrays. typical_dosing, drug_class, category, default_unit, "
        "mechanism, half_life, content, generic_name are strings. max_daily_dose is a number or null. "
        "category one of: antidepressant, benzodiazepine, opioid, stimulant, nsaid, antibiotic, sleep-aid, "
        "antihypertensive, diabetes, statin, ppi, antihistamine, thyroid, anticonvulsant, supplement, "
        "antipsychotic, muscle-relaxant, other. "
        "default_unit one of: mg, mcg, g, ml, units, iu, tablets, capsules, puffs, drops, patches. "
        "risk_level one of: minimal, low, moderate, high. "
        "dependency_risk_category one of: none, low, moderate, high, extreme. "
        "content is a 2-3 sentence neutral educational summary. "
        "Base everything on established medical knowledge; if the name is not a real medication, "
        "set generic_name to 'unknown' and content explaining it was not recognized."
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"autofill-{name.lower()}",
        system_message=system,
    ).with_model("openai", MODEL)
    try:
        reply = await chat.send_message(
            UserMessage(text=f"Generate the medication data JSON for: {name}")
        )
        text = reply if isinstance(reply, str) else str(reply)
        data = _extract_json(text)
        if data.get("generic_name", "").lower() == "unknown":
            return None
        # normalize
        for k in ["brand_names", "common_dosages", "common_side_effects",
                  "serious_side_effects", "interactions", "warnings"]:
            if not isinstance(data.get(k), list):
                data[k] = [data[k]] if data.get(k) else []
        data["name"] = name.strip().title()
        return data
    except Exception as e:  # noqa
        logger.exception("autofill_medication failed for %s", name)
        return None
