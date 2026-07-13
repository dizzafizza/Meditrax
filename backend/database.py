"""MongoDB client, serialization helpers and idempotent seeding."""
import os
import logging
import uuid
from datetime import datetime, date, timezone
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger(__name__)

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

DEFAULT_PROFILE_ID = "default"


def new_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def serialize_doc(doc):
    """Recursively convert Mongo/py types to JSON-safe values and drop _id."""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        out = {}
        for k, v in doc.items():
            if k == "_id":
                continue
            out[k] = serialize_doc(v)
        return out
    if isinstance(doc, (datetime, date)):
        return doc.isoformat()
    return doc


async def ensure_indexes():
    text_spec = [("name", "text"), ("generic_name", "text"), ("brand_names", "text"),
                 ("drug_class", "text"), ("category", "text"), ("content", "text")]
    try:
        await db.medications_catalog.create_index(
            text_spec, name="catalog_text", default_language="english",
            weights={"name": 10, "generic_name": 8, "brand_names": 8,
                     "drug_class": 4, "category": 3, "content": 1},
        )
    except Exception:
        # spec changed -> drop and recreate
        try:
            await db.medications_catalog.drop_index("catalog_text")
        except Exception:
            pass
        await db.medications_catalog.create_index(
            text_spec, name="catalog_text", default_language="english",
            weights={"name": 10, "generic_name": 8, "brand_names": 8,
                     "drug_class": 4, "category": 3, "content": 1},
        )
    await db.medications_catalog.create_index("name_lower", unique=True)
    await db.medications.create_index("id", unique=True)
    await db.logs.create_index([("medication_id", 1), ("timestamp", -1)])
    await db.reminders.create_index("medication_id")
    await db.tapers.create_index("medication_id")
    await db.chat_messages.create_index([("session_id", 1), ("created_at", 1)])


async def seed_catalog():
    """Idempotently seed the curated medication catalog."""
    from seed_meds import MEDICATION_CATALOG
    count = await db.medications_catalog.count_documents({})
    inserted = 0
    for med in MEDICATION_CATALOG:
        name_lower = med["name"].strip().lower()
        existing = await db.medications_catalog.find_one({"name_lower": name_lower})
        doc = {
            **med,
            "name_lower": name_lower,
            "source": "curated",
            "updated_at": now_iso(),
        }
        if existing:
            doc["id"] = existing.get("id", new_id())
            await db.medications_catalog.update_one(
                {"name_lower": name_lower}, {"$set": doc}
            )
        else:
            doc["id"] = new_id()
            doc["created_at"] = now_iso()
            await db.medications_catalog.insert_one(doc)
            inserted += 1
    logger.info("Catalog seed complete. existing=%s inserted=%s", count, inserted)


async def ensure_profile_and_settings():
    prof = await db.profiles.find_one({"id": DEFAULT_PROFILE_ID})
    if not prof:
        await db.profiles.insert_one({
            "id": DEFAULT_PROFILE_ID,
            "name": "",
            "date_of_birth": None,
            "allergies": [],
            "conditions": [],
            "emergency_contact": None,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })
    settings = await db.settings.find_one({"id": DEFAULT_PROFILE_ID})
    if not settings:
        await db.settings.insert_one({
            "id": DEFAULT_PROFILE_ID,
            "theme": "system",
            "time_format": "12h",
            "notifications": {"push": True, "sound": True, "reminder_advance": 0},
            "quiet_hours": {"enabled": False, "start": "22:00", "end": "07:00"},
            "refill_threshold_days": 7,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })
