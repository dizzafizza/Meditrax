"""Meditrax backend — FastAPI + MongoDB. All routes under /api."""
import json
import logging
from datetime import datetime, timedelta, timezone, date
from typing import List, Optional, Any, Dict

from fastapi import FastAPI, APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict
import os

import database as dbm
from database import db, serialize_doc, new_id, now_iso, DEFAULT_PROFILE_ID
import taper as taper_engine
import ai_service
import push_service
from seed_meds import MEDICATION_CATALOG  # noqa

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("meditrax")

app = FastAPI(title="Meditrax API")
api = APIRouter(prefix="/api")

WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


# ----------------------------- Models -----------------------------
class PillConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    strength: float
    unit: str = "mg"
    shape: Optional[str] = None
    color: Optional[str] = None
    is_active: bool = True


class Inventory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    current_count: float = 0
    unit: str = "tablets"
    units_per_dose: float = 1
    refill_threshold: float = 10
    last_updated: Optional[str] = None


class MedicationIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    generic_name: Optional[str] = None
    brand_names: List[str] = []
    drug_class: Optional[str] = None
    category: str = "other"
    color: str = "#2A767B"
    strength: Optional[float] = None
    unit: str = "mg"
    form: str = "tablet"
    frequency: str = "once_daily"
    times: List[str] = []  # ["08:00", "20:00"]
    days_of_week: List[str] = WEEKDAYS
    is_prn: bool = False
    instructions: Optional[str] = None
    notes: Optional[str] = None
    side_effects: List[str] = []
    interactions: List[str] = []
    warnings: List[str] = []
    risk_level: str = "low"
    dependency_risk_category: str = "none"
    max_daily_dose: Optional[float] = None
    pill_configurations: List[PillConfig] = []
    inventory: Optional[Inventory] = None
    catalog_id: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_active: bool = True


class LogIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    medication_id: str
    timestamp: Optional[str] = None
    scheduled_time: Optional[str] = None
    status: str = "taken"  # taken | missed | skipped | partial
    dose_taken: Optional[float] = None
    unit: Optional[str] = None
    notes: Optional[str] = None
    mood: Optional[str] = None
    side_effects: List[str] = []
    effectiveness: Optional[int] = None
    decrement_inventory: bool = True


class ReminderIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    medication_id: str
    time: str
    days_of_week: List[str] = WEEKDAYS
    is_active: bool = True
    message: Optional[str] = None


class TaperIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    medication_id: str
    initial_dose: float
    final_dose: float = 0
    unit: str = "mg"
    method: str = "hyperbolic"
    start_date: Optional[str] = None
    total_days: int = 56
    step_interval_days: int = 7
    custom_steps: Optional[List[dict]] = None
    notes: Optional[str] = None


class TaperPreviewIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    initial_dose: float
    final_dose: float = 0
    unit: str = "mg"
    method: str = "hyperbolic"
    start_date: Optional[str] = None
    total_days: int = 56
    step_interval_days: int = 7
    custom_steps: Optional[List[dict]] = None


class CyclicIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    medication_id: str
    name: str
    type: str = "on-off-cycle"
    pattern: List[dict] = []  # [{phase, duration, dose_multiplier}]
    start_date: Optional[str] = None
    is_active: bool = True
    notes: Optional[str] = None


class ChatIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str
    message: str


class SubscriptionIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    subscription: dict


# ----------------------------- Helpers -----------------------------
def today_str() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def parse_date(s: Optional[str]) -> datetime:
    if not s:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return datetime.now(timezone.utc)


def weekday_key(d: date) -> str:
    return WEEKDAYS[d.weekday()]


async def get_med_or_404(med_id: str) -> dict:
    med = await db.medications.find_one({"id": med_id})
    if not med:
        raise HTTPException(404, "Medication not found")
    return med


# ----------------------------- Catalog / Knowledge base -----------------------------
@api.get("/catalog/search")
async def catalog_search(q: str = Query("", alias="q"), limit: int = 20):
    if not q.strip():
        docs = await db.medications_catalog.find({}, {"_id": 0}).sort("name", 1).limit(limit).to_list(limit)
        return serialize_doc(docs)
    docs = await db.medications_catalog.find(
        {"$text": {"$search": q}}, {"_id": 0, "score": {"$meta": "textScore"}}
    ).sort([("score", {"$meta": "textScore"})]).limit(limit).to_list(limit)
    if not docs:
        docs = await db.medications_catalog.find(
            {"name_lower": {"$regex": "^" + q.strip().lower()}}, {"_id": 0}
        ).limit(limit).to_list(limit)
    return serialize_doc(docs)


@api.get("/knowledge")
async def knowledge_list(q: str = Query("", alias="q"),
                         category: Optional[str] = None, limit: int = 100):
    query: Dict[str, Any] = {}
    if category and category != "all":
        query["category"] = category
    if q.strip():
        text_docs = await db.medications_catalog.find(
            {**query, "$text": {"$search": q}},
            {"_id": 0, "score": {"$meta": "textScore"}},
        ).sort([("score", {"$meta": "textScore"})]).limit(limit).to_list(limit)
        if text_docs:
            return serialize_doc(text_docs)
        query["name_lower"] = {"$regex": q.strip().lower()}
    docs = await db.medications_catalog.find(query, {"_id": 0}).sort("name", 1).limit(limit).to_list(limit)
    return serialize_doc(docs)


@api.get("/knowledge/categories")
async def knowledge_categories():
    cats = await db.medications_catalog.distinct("category")
    return sorted([c for c in cats if c])


@api.get("/knowledge/{item_id}")
async def knowledge_get(item_id: str):
    doc = await db.medications_catalog.find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Article not found")
    return serialize_doc(doc)


@api.post("/knowledge/autofill")
async def knowledge_autofill(payload: dict):
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "name required")
    existing = await db.medications_catalog.find_one({"name_lower": name.lower()}, {"_id": 0})
    if existing:
        return {"created": False, "medication": serialize_doc(existing)}
    data = await ai_service.autofill_medication(name)
    if not data:
        raise HTTPException(422, f"Could not find reliable information for '{name}'.")
    data["name_lower"] = name.lower()
    data["source"] = "ai"
    data["id"] = new_id()
    data["created_at"] = now_iso()
    data["updated_at"] = now_iso()
    await db.medications_catalog.insert_one(dict(data))
    return {"created": True, "medication": serialize_doc(data)}


# ----------------------------- Medications -----------------------------
@api.get("/medications")
async def list_medications(include_inactive: bool = True):
    query = {} if include_inactive else {"is_active": True}
    docs = await db.medications.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return serialize_doc(docs)


@api.post("/medications")
async def create_medication(payload: MedicationIn):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    if not doc.get("start_date"):
        doc["start_date"] = today_str()
    await db.medications.insert_one(dict(doc))
    return serialize_doc(doc)


@api.get("/medications/{med_id}")
async def get_medication(med_id: str):
    med = await get_med_or_404(med_id)
    out = serialize_doc(med)
    taper = await db.tapers.find_one({"medication_id": med_id, "is_active": True}, {"_id": 0})
    out["active_taper"] = serialize_doc(taper) if taper else None
    cyclic = await db.cyclic.find_one({"medication_id": med_id, "is_active": True}, {"_id": 0})
    out["active_cyclic"] = serialize_doc(cyclic) if cyclic else None
    return out


@api.put("/medications/{med_id}")
async def update_medication(med_id: str, payload: MedicationIn):
    await get_med_or_404(med_id)
    doc = payload.model_dump()
    doc["updated_at"] = now_iso()
    await db.medications.update_one({"id": med_id}, {"$set": doc})
    med = await db.medications.find_one({"id": med_id}, {"_id": 0})
    return serialize_doc(med)


@api.delete("/medications/{med_id}")
async def delete_medication(med_id: str):
    await get_med_or_404(med_id)
    await db.medications.delete_one({"id": med_id})
    await db.logs.delete_many({"medication_id": med_id})
    await db.reminders.delete_many({"medication_id": med_id})
    await db.tapers.delete_many({"medication_id": med_id})
    await db.cyclic.delete_many({"medication_id": med_id})
    return {"deleted": True}


@api.post("/medications/{med_id}/inventory")
async def adjust_inventory(med_id: str, payload: dict):
    med = await get_med_or_404(med_id)
    inv = med.get("inventory") or {"current_count": 0, "unit": "tablets",
                                    "units_per_dose": 1, "refill_threshold": 10}
    if "set" in payload:
        inv["current_count"] = float(payload["set"])
    elif "delta" in payload:
        inv["current_count"] = max(0, float(inv.get("current_count", 0)) + float(payload["delta"]))
    for k in ("unit", "units_per_dose", "refill_threshold"):
        if k in payload:
            inv[k] = payload[k]
    inv["last_updated"] = now_iso()
    await db.medications.update_one({"id": med_id}, {"$set": {"inventory": inv, "updated_at": now_iso()}})
    return serialize_doc(inv)


# ----------------------------- Logs -----------------------------
@api.get("/logs")
async def list_logs(medication_id: Optional[str] = None,
                    start: Optional[str] = None, end: Optional[str] = None, limit: int = 1000):
    query: Dict[str, Any] = {}
    if medication_id:
        query["medication_id"] = medication_id
    if start or end:
        ts: Dict[str, Any] = {}
        if start:
            ts["$gte"] = start
        if end:
            ts["$lte"] = end + "T23:59:59"
        query["timestamp"] = ts
    docs = await db.logs.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return serialize_doc(docs)


@api.post("/logs")
async def create_log(payload: LogIn):
    med = await get_med_or_404(payload.medication_id)
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["timestamp"] = doc.get("timestamp") or now_iso()
    doc["created_at"] = now_iso()
    if doc.get("unit") is None:
        doc["unit"] = med.get("unit", "mg")
    decrement = doc.pop("decrement_inventory", True)
    await db.logs.insert_one(dict(doc))
    if decrement and doc["status"] in ("taken", "partial") and med.get("inventory"):
        inv = med["inventory"]
        per = float(inv.get("units_per_dose", 1) or 1)
        if doc["status"] == "partial":
            per = per / 2
        inv["current_count"] = max(0, float(inv.get("current_count", 0)) - per)
        inv["last_updated"] = now_iso()
        await db.medications.update_one({"id": med["id"]}, {"$set": {"inventory": inv}})
    return serialize_doc(doc)


@api.delete("/logs/{log_id}")
async def delete_log(log_id: str):
    res = await db.logs.delete_one({"id": log_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Log not found")
    return {"deleted": True}


# ----------------------------- Reminders -----------------------------
@api.get("/reminders")
async def list_reminders(medication_id: Optional[str] = None):
    query = {"medication_id": medication_id} if medication_id else {}
    docs = await db.reminders.find(query, {"_id": 0}).to_list(1000)
    return serialize_doc(docs)


@api.post("/reminders")
async def create_reminder(payload: ReminderIn):
    await get_med_or_404(payload.medication_id)
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = now_iso()
    await db.reminders.insert_one(dict(doc))
    return serialize_doc(doc)


@api.put("/reminders/{rid}")
async def update_reminder(rid: str, payload: ReminderIn):
    doc = payload.model_dump()
    res = await db.reminders.update_one({"id": rid}, {"$set": doc})
    if res.matched_count == 0:
        raise HTTPException(404, "Reminder not found")
    r = await db.reminders.find_one({"id": rid}, {"_id": 0})
    return serialize_doc(r)


@api.delete("/reminders/{rid}")
async def delete_reminder(rid: str):
    await db.reminders.delete_one({"id": rid})
    return {"deleted": True}


# ----------------------------- Taper Planner -----------------------------
@api.get("/taper/suggest/{med_id}")
async def taper_suggest(med_id: str):
    med = await get_med_or_404(med_id)
    return taper_engine.suggest_taper_params(med)


@api.post("/taper/preview")
async def taper_preview(payload: TaperPreviewIn):
    try:
        sched = taper_engine.generate_taper_schedule(
            initial_dose=payload.initial_dose,
            final_dose=payload.final_dose,
            start_date=parse_date(payload.start_date),
            step_interval_days=payload.step_interval_days,
            total_days=payload.total_days,
            method=payload.method,
            unit=payload.unit,
            custom_steps=payload.custom_steps,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    return sched


@api.get("/tapers")
async def list_tapers():
    docs = await db.tapers.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for d in docs:
        med = await db.medications.find_one({"id": d.get("medication_id")}, {"_id": 0, "name": 1, "color": 1})
        d["medication_name"] = med.get("name") if med else "Unknown"
        d["medication_color"] = med.get("color") if med else "#2A767B"
    return serialize_doc(docs)


@api.post("/tapers")
async def create_taper(payload: TaperIn):
    await get_med_or_404(payload.medication_id)
    start = parse_date(payload.start_date)
    try:
        sched = taper_engine.generate_taper_schedule(
            initial_dose=payload.initial_dose,
            final_dose=payload.final_dose,
            start_date=start,
            step_interval_days=payload.step_interval_days,
            total_days=payload.total_days,
            method=payload.method,
            unit=payload.unit,
            custom_steps=payload.custom_steps,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    doc = {
        "id": new_id(),
        "medication_id": payload.medication_id,
        "initial_dose": payload.initial_dose,
        "final_dose": payload.final_dose,
        "unit": payload.unit,
        "method": payload.method,
        "start_date": start.date().isoformat(),
        "total_days": payload.total_days,
        "step_interval_days": payload.step_interval_days,
        "custom_steps": payload.custom_steps,
        "notes": payload.notes,
        "schedule": sched,
        "is_active": True,
        "is_paused": False,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.tapers.update_many(
        {"medication_id": payload.medication_id, "is_active": True},
        {"$set": {"is_active": False}},
    )
    await db.tapers.insert_one(dict(doc))
    await db.medications.update_one(
        {"id": payload.medication_id}, {"$set": {"is_tapering": True}}
    )
    return serialize_doc(doc)


@api.get("/tapers/{tid}")
async def get_taper(tid: str):
    doc = await db.tapers.find_one({"id": tid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Taper not found")
    med = await db.medications.find_one({"id": doc.get("medication_id")}, {"_id": 0})
    doc["medication"] = serialize_doc(med)
    start = parse_date(doc["start_date"])
    today = datetime.now(timezone.utc)
    doc["current_dose"] = taper_engine.dose_on_date(doc["schedule"], today, start)
    day = (today.date() - start.date()).days
    interval = doc.get("step_interval_days", 7)
    doc["current_step"] = max(0, min(len(doc["schedule"]["steps"]) - 1, day // interval)) if day >= 0 else 0
    return serialize_doc(doc)


@api.put("/tapers/{tid}")
async def update_taper(tid: str, payload: dict):
    doc = await db.tapers.find_one({"id": tid})
    if not doc:
        raise HTTPException(404, "Taper not found")
    updates = {}
    for k in ("is_active", "is_paused", "notes"):
        if k in payload:
            updates[k] = payload[k]
    updates["updated_at"] = now_iso()
    await db.tapers.update_one({"id": tid}, {"$set": updates})
    if updates.get("is_active") is False:
        await db.medications.update_one({"id": doc["medication_id"]}, {"$set": {"is_tapering": False}})
    out = await db.tapers.find_one({"id": tid}, {"_id": 0})
    return serialize_doc(out)


@api.delete("/tapers/{tid}")
async def delete_taper(tid: str):
    doc = await db.tapers.find_one({"id": tid})
    await db.tapers.delete_one({"id": tid})
    if doc:
        await db.medications.update_one({"id": doc["medication_id"]}, {"$set": {"is_tapering": False}})
    return {"deleted": True}


# ----------------------------- Cyclic dosing -----------------------------
@api.get("/cyclic")
async def list_cyclic():
    docs = await db.cyclic.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for d in docs:
        med = await db.medications.find_one({"id": d.get("medication_id")}, {"_id": 0, "name": 1, "color": 1})
        d["medication_name"] = med.get("name") if med else "Unknown"
        d["medication_color"] = med.get("color") if med else "#2A767B"
    return serialize_doc(docs)


@api.post("/cyclic")
async def create_cyclic(payload: CyclicIn):
    await get_med_or_404(payload.medication_id)
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["start_date"] = doc.get("start_date") or today_str()
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    await db.cyclic.insert_one(dict(doc))
    return serialize_doc(doc)


@api.put("/cyclic/{cid}")
async def update_cyclic(cid: str, payload: dict):
    res = await db.cyclic.update_one({"id": cid}, {"$set": {**payload, "updated_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Cyclic plan not found")
    out = await db.cyclic.find_one({"id": cid}, {"_id": 0})
    return serialize_doc(out)


@api.delete("/cyclic/{cid}")
async def delete_cyclic(cid: str):
    await db.cyclic.delete_one({"id": cid})
    return {"deleted": True}


# ----------------------------- Today / Schedule -----------------------------
def build_today_doses(meds: List[dict], logs_today: List[dict], for_date: date):
    wd = weekday_key(for_date)
    doses = []
    prn = []
    log_index = {}
    for lg in logs_today:
        key = (lg["medication_id"], lg.get("scheduled_time"))
        log_index[key] = lg
    for med in meds:
        if not med.get("is_active", True):
            continue
        if med.get("is_prn"):
            prn.append({
                "medication_id": med["id"], "name": med["name"], "color": med.get("color"),
                "strength": med.get("strength"), "unit": med.get("unit"),
                "category": med.get("category"), "risk_level": med.get("risk_level"),
                "dependency_risk_category": med.get("dependency_risk_category"),
            })
            continue
        days = med.get("days_of_week", WEEKDAYS)
        if wd not in days:
            continue
        times = med.get("times") or []
        if not times:
            times = ["09:00"]
        for t in times:
            lg = log_index.get((med["id"], t))
            status = lg["status"] if lg else "pending"
            doses.append({
                "id": f"{med['id']}_{t}",
                "medication_id": med["id"],
                "name": med["name"],
                "color": med.get("color"),
                "strength": med.get("strength"),
                "unit": med.get("unit"),
                "form": med.get("form"),
                "time": t,
                "scheduled_time": t,
                "status": status,
                "instructions": med.get("instructions"),
                "category": med.get("category"),
                "risk_level": med.get("risk_level"),
                "dependency_risk_category": med.get("dependency_risk_category"),
                "log_id": lg["id"] if lg else None,
                "is_tapering": med.get("is_tapering", False),
            })
    doses.sort(key=lambda d: d["time"])
    return doses, prn


@api.get("/today")
async def get_today(d: Optional[str] = None):
    the_date = parse_date(d).date() if d else datetime.now(timezone.utc).date()
    meds = await db.medications.find({}, {"_id": 0}).to_list(1000)
    logs = await db.logs.find(
        {"timestamp": {"$gte": the_date.isoformat(), "$lte": the_date.isoformat() + "T23:59:59"}},
        {"_id": 0},
    ).to_list(1000)
    doses, prn = build_today_doses(meds, logs, the_date)
    total = len(doses)
    taken = len([x for x in doses if x["status"] in ("taken", "partial")])
    pending = len([x for x in doses if x["status"] == "pending"])
    for dose in doses:
        if dose["is_tapering"]:
            tp = await db.tapers.find_one({"medication_id": dose["medication_id"], "is_active": True}, {"_id": 0})
            if tp:
                start = parse_date(tp["start_date"])
                dose["taper_dose"] = taper_engine.dose_on_date(tp["schedule"], parse_date(the_date.isoformat()), start)
                dose["taper_unit"] = tp.get("unit")
    alerts = []
    for med in meds:
        inv = med.get("inventory")
        if inv and inv.get("current_count") is not None:
            per_day = _daily_consumption(med)
            days_left = (inv["current_count"] / per_day) if per_day > 0 else None
            if inv["current_count"] <= 0:
                alerts.append({"medication_id": med["id"], "name": med["name"], "type": "out", "days_left": 0})
            elif days_left is not None and days_left <= 7:
                alerts.append({"medication_id": med["id"], "name": med["name"],
                               "type": "low", "days_left": round(days_left, 1)})
    return {
        "date": the_date.isoformat(),
        "doses": serialize_doc(doses),
        "prn": serialize_doc(prn),
        "summary": {"total": total, "taken": taken, "pending": pending,
                    "adherence": round(taken / total * 100) if total else 100},
        "refill_alerts": serialize_doc(alerts),
    }


def _daily_consumption(med: dict) -> float:
    if med.get("is_prn"):
        return 0.0
    times = med.get("times") or ["09:00"]
    days = med.get("days_of_week", WEEKDAYS)
    inv = med.get("inventory") or {}
    per_dose = float(inv.get("units_per_dose", 1) or 1)
    return len(times) * (len(days) / 7.0) * per_dose


# ----------------------------- Inventory list -----------------------------
@api.get("/inventory")
async def inventory_list():
    meds = await db.medications.find({"is_active": True}, {"_id": 0}).to_list(1000)
    out = []
    for med in meds:
        inv = med.get("inventory")
        if not inv:
            continue
        per_day = _daily_consumption(med)
        days_left = round(inv["current_count"] / per_day, 1) if per_day > 0 else None
        status = "ok"
        if inv["current_count"] <= 0:
            status = "out"
        elif days_left is not None and days_left <= 7:
            status = "low"
        out.append({
            "medication_id": med["id"], "name": med["name"], "color": med.get("color"),
            "current_count": inv["current_count"], "unit": inv.get("unit"),
            "units_per_dose": inv.get("units_per_dose", 1),
            "per_day": round(per_day, 2), "days_left": days_left,
            "refill_threshold": inv.get("refill_threshold", 10), "status": status,
        })
    out.sort(key=lambda x: (x["days_left"] is None, x["days_left"] if x["days_left"] is not None else 1e9))
    return serialize_doc(out)


# ----------------------------- Analytics -----------------------------
@api.get("/analytics")
async def analytics(days: int = 30):
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=days - 1)
    meds = await db.medications.find({}, {"_id": 0}).to_list(1000)
    logs = await db.logs.find({"timestamp": {"$gte": start.isoformat()}}, {"_id": 0}).to_list(5000)

    logs_by_date: Dict[str, List[dict]] = {}
    for lg in logs:
        dkey = lg["timestamp"][:10]
        logs_by_date.setdefault(dkey, []).append(lg)

    trend = []
    total_expected = 0
    total_taken = 0
    per_med_stats: Dict[str, dict] = {}
    streak_days = []
    for i in range(days):
        the_date = start + timedelta(days=i)
        dkey = the_date.isoformat()
        doses, _ = build_today_doses(meds, logs_by_date.get(dkey, []), the_date)
        exp = len(doses)
        tkn = len([x for x in doses if x["status"] in ("taken", "partial")])
        total_expected += exp
        total_taken += tkn
        adh = round(tkn / exp * 100) if exp else None
        trend.append({"date": dkey, "expected": exp, "taken": tkn, "adherence": adh})
        streak_days.append(adh == 100 if exp else None)
        for dose in doses:
            mid = dose["medication_id"]
            st = per_med_stats.setdefault(mid, {"medication_id": mid, "name": dose["name"],
                                                "color": dose.get("color"), "expected": 0, "taken": 0})
            st["expected"] += 1
            if dose["status"] in ("taken", "partial"):
                st["taken"] += 1

    streak = 0
    for v in reversed(streak_days):
        if v is True:
            streak += 1
        elif v is False:
            break
    per_med = []
    for st in per_med_stats.values():
        st["adherence"] = round(st["taken"] / st["expected"] * 100) if st["expected"] else 0
        per_med.append(st)
    per_med.sort(key=lambda x: x["adherence"])

    status_counts = {"taken": 0, "missed": 0, "skipped": 0, "partial": 0}
    for lg in logs:
        s = lg.get("status", "taken")
        status_counts[s] = status_counts.get(s, 0) + 1

    return {
        "range_days": days,
        "overall_adherence": round(total_taken / total_expected * 100) if total_expected else 100,
        "total_expected": total_expected,
        "total_taken": total_taken,
        "current_streak": streak,
        "trend": trend,
        "per_medication": per_med,
        "status_breakdown": status_counts,
        "active_medications": len([m for m in meds if m.get("is_active", True)]),
    }


# ----------------------------- Profile / Settings -----------------------------
@api.get("/profile")
async def get_profile():
    await dbm.ensure_profile_and_settings()
    p = await db.profiles.find_one({"id": DEFAULT_PROFILE_ID}, {"_id": 0})
    return serialize_doc(p)


@api.put("/profile")
async def update_profile(payload: dict):
    payload.pop("id", None)
    payload["updated_at"] = now_iso()
    await db.profiles.update_one({"id": DEFAULT_PROFILE_ID}, {"$set": payload}, upsert=True)
    p = await db.profiles.find_one({"id": DEFAULT_PROFILE_ID}, {"_id": 0})
    return serialize_doc(p)


@api.get("/settings")
async def get_settings():
    await dbm.ensure_profile_and_settings()
    s = await db.settings.find_one({"id": DEFAULT_PROFILE_ID}, {"_id": 0})
    return serialize_doc(s)


@api.put("/settings")
async def update_settings(payload: dict):
    payload.pop("id", None)
    payload["updated_at"] = now_iso()
    await db.settings.update_one({"id": DEFAULT_PROFILE_ID}, {"$set": payload}, upsert=True)
    s = await db.settings.find_one({"id": DEFAULT_PROFILE_ID}, {"_id": 0})
    return serialize_doc(s)


# ----------------------------- AI Assistant -----------------------------
async def _rag_context(message: str) -> str:
    try:
        docs = await db.medications_catalog.find(
            {"$text": {"$search": message}},
            {"_id": 0, "score": {"$meta": "textScore"},
             "name": 1, "drug_class": 1, "content": 1, "warnings": 1,
             "dependency_risk_category": 1, "typical_dosing": 1},
        ).sort([("score", {"$meta": "textScore"})]).limit(4).to_list(4)
    except Exception:
        docs = []
    lines = []
    for d in docs:
        warn = "; ".join(d.get("warnings", [])[:2])
        lines.append(
            f"- {d['name']} ({d.get('drug_class','')}): {d.get('content','')} "
            f"Typical dosing: {d.get('typical_dosing','n/a')}. "
            f"Dependency risk: {d.get('dependency_risk_category','n/a')}."
            + (f" Warnings: {warn}." if warn else "")
        )
    return "\n".join(lines)


async def _meds_context() -> str:
    meds = await db.medications.find({"is_active": True}, {"_id": 0}).to_list(100)
    lines = []
    for m in meds:
        sched = "as needed" if m.get("is_prn") else ", ".join(m.get("times", []) or [])
        lines.append(f"- {m['name']} {m.get('strength','')}{m.get('unit','')} "
                     f"({m.get('category','')}), schedule: {sched or 'n/a'}"
                     + (", tapering" if m.get("is_tapering") else ""))
    return "\n".join(lines) if lines else "(no medications tracked yet)"


@api.get("/ai/messages/{session_id}")
async def ai_messages(session_id: str):
    docs = await db.chat_messages.find({"session_id": session_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return serialize_doc(docs)


@api.get("/ai/suggestions")
async def ai_suggestions():
    return {
        "suggestions": [
            "How can I improve my medication adherence?",
            "What's the safest way to taper off a benzodiazepine?",
            "Explain the difference between linear and hyperbolic tapering.",
            "What should I do if I miss a dose?",
            "Which of my medications have interaction risks?",
        ]
    }


@api.delete("/ai/messages/{session_id}")
async def ai_clear(session_id: str):
    await db.chat_messages.delete_many({"session_id": session_id})
    return {"cleared": True}


@api.post("/ai/chat")
async def ai_chat(payload: ChatIn):
    session_id = payload.session_id
    message = payload.message.strip()
    if not message:
        raise HTTPException(400, "message required")

    await db.chat_messages.insert_one({
        "id": new_id(), "session_id": session_id, "role": "user",
        "content": message, "created_at": now_iso(),
    })
    history = await db.chat_messages.find({"session_id": session_id}, {"_id": 0}).sort("created_at", 1).to_list(50)
    rag = await _rag_context(message)
    meds = await _meds_context()
    system = ai_service.build_chat_system(rag, meds, history[:-1])

    async def event_gen():
        full = ""
        try:
            async for chunk in ai_service.stream_chat(message, system, session_id):
                full += chunk
                yield f"data: {json.dumps({'delta': chunk})}\n\n"
        finally:
            await db.chat_messages.insert_one({
                "id": new_id(), "session_id": session_id, "role": "assistant",
                "content": full, "created_at": now_iso(),
            })
            yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        event_gen(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


# ----------------------------- Push notifications -----------------------------
@api.get("/push/vapid-public-key")
async def vapid_key():
    return {"public_key": push_service.get_public_key()}


@api.post("/push/subscribe")
async def push_subscribe(payload: SubscriptionIn):
    sub = payload.subscription
    endpoint = sub.get("endpoint")
    if not endpoint:
        raise HTTPException(400, "invalid subscription")
    await db.push_subscriptions.update_one(
        {"endpoint": endpoint},
        {"$set": {"endpoint": endpoint, "subscription": sub, "updated_at": now_iso()}},
        upsert=True,
    )
    return {"subscribed": True}


@api.post("/push/unsubscribe")
async def push_unsubscribe(payload: dict):
    endpoint = (payload.get("subscription") or {}).get("endpoint") or payload.get("endpoint")
    if endpoint:
        await db.push_subscriptions.delete_one({"endpoint": endpoint})
    return {"unsubscribed": True}


@api.post("/push/test")
async def push_test(payload: dict):
    subs = await db.push_subscriptions.find({}, {"_id": 0}).to_list(100)
    if not subs:
        raise HTTPException(404, "No push subscriptions found. Enable notifications first.")
    title = payload.get("title", "Meditrax")
    body = payload.get("body", "This is a test reminder. Notifications are working!")
    results = []
    for s in subs:
        res = push_service.send_push(s["subscription"], {
            "title": title, "body": body, "tag": "meditrax-test",
            "url": "/", "icon": "/icon-192.png", "badge": "/badge-96.png",
        })
        results.append(res)
        if res.get("expired"):
            await db.push_subscriptions.delete_one({"endpoint": s["endpoint"]})
    sent = len([r for r in results if r.get("ok")])
    return {"sent": sent, "total": len(subs), "results": results}


# ----------------------------- Export / Import -----------------------------
@api.get("/export")
async def export_data():
    data = {}
    for coll in ["medications", "logs", "reminders", "tapers", "cyclic", "profiles", "settings"]:
        docs = await db[coll].find({}, {"_id": 0}).to_list(10000)
        data[coll] = serialize_doc(docs)
    data["exported_at"] = now_iso()
    data["version"] = 1
    return data


@api.post("/import")
async def import_data(payload: dict):
    counts = {}
    for coll in ["medications", "logs", "reminders", "tapers", "cyclic"]:
        items = payload.get(coll, [])
        if items:
            for it in items:
                it.pop("_id", None)
                await db[coll].update_one({"id": it.get("id")}, {"$set": it}, upsert=True)
            counts[coll] = len(items)
    for coll in ["profiles", "settings"]:
        items = payload.get(coll, [])
        for it in items:
            it.pop("_id", None)
            await db[coll].update_one({"id": it.get("id", DEFAULT_PROFILE_ID)}, {"$set": it}, upsert=True)
    return {"imported": counts}


@api.get("/")
async def root():
    return {"app": "Meditrax", "status": "ok"}


@api.get("/health")
async def health():
    cat = await db.medications_catalog.count_documents({})
    meds = await db.medications.count_documents({})
    return {"status": "healthy", "catalog_count": cat, "medications": meds}


# ----------------------------- App wiring -----------------------------
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        await dbm.ensure_indexes()
        await dbm.seed_catalog()
        await dbm.ensure_profile_and_settings()
        logger.info("Meditrax startup complete")
    except Exception:
        logger.exception("Startup error")


@app.on_event("shutdown")
async def shutdown():
    dbm.client.close()
