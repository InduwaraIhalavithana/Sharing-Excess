from fastapi import HTTPException

from app.schemas import validate_district


def one_district(value: str) -> str:
    try:
        return validate_district(value)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None


def district_list(csv: str) -> list[str]:
    """?district=Colombo,Gampaha -> validated names (400 on an unknown one, never a 500)."""
    return [one_district(d) for d in csv.split(",") if d.strip()]
