from fastapi import APIRouter

from app.constants import CATEGORIES, DISTRICTS, EVENT_TYPES, FULFILMENT, NEIGHBOURS, UNITS

router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.get("")
def meta():
    """The fixed lists the forms and filters are built from."""
    return {"success": True, "districts": DISTRICTS, "categories": CATEGORIES, "units": UNITS,
            "fulfilment": FULFILMENT, "event_types": EVENT_TYPES,
            "neighbours": {d: sorted(n) for d, n in NEIGHBOURS.items()}}
