"""Fixed vocabularies shared by the API, the notification filters and (via /api/meta) the frontend."""

DISTRICTS = [
    "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo", "Galle", "Gampaha",
    "Hambantota", "Jaffna", "Kalutara", "Kandy", "Kegalle", "Kilinochchi", "Kurunegala",
    "Mannar", "Matale", "Matara", "Monaragala", "Mullaitivu", "Nuwara Eliya", "Polonnaruwa",
    "Puttalam", "Ratnapura", "Trincomalee", "Vavuniya",
]

# Districts that share a border. Declared one way and mirrored below, so a missing reverse
# entry can never make "near" asymmetric.
_BORDERS = {
    "Colombo": ["Gampaha", "Kalutara", "Kegalle", "Ratnapura"],
    "Gampaha": ["Kegalle", "Kurunegala", "Puttalam"],
    "Kalutara": ["Galle", "Ratnapura"],
    "Kandy": ["Matale", "Nuwara Eliya", "Kegalle", "Kurunegala"],
    "Matale": ["Kurunegala", "Anuradhapura", "Polonnaruwa", "Nuwara Eliya"],
    "Nuwara Eliya": ["Kegalle", "Ratnapura", "Badulla"],
    "Galle": ["Matara", "Ratnapura"],
    "Matara": ["Ratnapura", "Hambantota"],
    "Hambantota": ["Ratnapura", "Monaragala", "Badulla"],
    "Jaffna": ["Kilinochchi", "Mullaitivu"],
    "Kilinochchi": ["Mullaitivu", "Mannar"],
    "Mannar": ["Vavuniya", "Puttalam", "Anuradhapura"],
    "Vavuniya": ["Mullaitivu", "Anuradhapura", "Trincomalee"],
    "Mullaitivu": ["Trincomalee"],
    "Batticaloa": ["Polonnaruwa", "Ampara", "Trincomalee"],
    "Ampara": ["Monaragala", "Badulla", "Polonnaruwa"],
    "Trincomalee": ["Anuradhapura", "Polonnaruwa"],
    "Kurunegala": ["Puttalam", "Anuradhapura", "Kegalle"],
    "Puttalam": ["Anuradhapura"],
    "Anuradhapura": ["Polonnaruwa"],
    "Polonnaruwa": ["Badulla"],
    "Badulla": ["Ratnapura", "Monaragala"],
    "Monaragala": ["Ratnapura"],
    "Ratnapura": ["Kegalle"],
}
NEIGHBOURS: dict[str, set[str]] = {d: set() for d in DISTRICTS}
for _a, _bs in _BORDERS.items():
    for _b in _bs:
        NEIGHBOURS[_a].add(_b)
        NEIGHBOURS[_b].add(_a)

CATEGORIES = [
    "cooked_meals", "rice_grains", "vegetables_fruits", "bakery", "dairy_eggs",
    "packaged", "beverages", "other",
]
UNITS = ["kg", "g", "l", "ml", "packs", "packets", "portions", "pieces", "boxes", "loaves", "meals"]
FULFILMENT = ["pickup", "delivery", "both"]
EVENT_TYPES = ["food_drive", "volunteering", "distribution", "awareness", "workshop", "other"]


def proximity_tier(user_district: str | None, district: str | None) -> int:
    """0 = same district, 1 = neighbouring, 2 = anywhere else (or unknown)."""
    if not user_district or not district:
        return 2
    if user_district == district:
        return 0
    return 1 if district in NEIGHBOURS.get(user_district, ()) else 2
