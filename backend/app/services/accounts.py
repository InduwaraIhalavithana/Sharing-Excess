from sqlalchemy.orm import Session

from app.models import (
    CommunityEvent,
    EventSubscriber,
    Feedback,
    FoodListing,
    FoodRequest,
    Rating,
    Report,
    User,
)
from app.services.notifications import notify
from app.utils.uploads import delete_upload


def purge_user(db: Session, user: User) -> None:
    """Delete an account and everything it owns, then its image files. Used by self-service deletion and by the admin.

    Requests other people made on this user's listings go with the listings (a request cannot exist without one).
    """
    photos: list = [user.org_logo, user.avatar]
    listings = db.query(FoodListing).filter(FoodListing.donor_id == user.id).all()
    listing_ids = [x.id for x in listings]
    for x in listings:
        photos += list(x.images or [])
    for e in db.query(CommunityEvent).filter(CommunityEvent.owner_id == user.id).all():
        photos += list(e.images or [])
        db.delete(e)  # sign-ups cascade

    # whoever was still waiting on this donor's food is told, not silently dropped
    for r in db.query(FoodRequest).filter(FoodRequest.listing_id.in_(listing_ids or [0]),
                                          FoodRequest.status.in_(("pending", "accepted", "collected"))).all():
        notify(db, r.recipient, "request_cancelled", "A donor closed their account",
               f"Your request for {r.listing.food_name} can no longer go ahead.", "/listings")

    request_ids = [r.id for r in db.query(FoodRequest.id).filter(
        (FoodRequest.recipient_id == user.id) | (FoodRequest.listing_id.in_(listing_ids or [0]))).all()]
    if request_ids:
        # platform feedback written by someone else about these requests stays, just unlinked
        db.query(Feedback).filter(Feedback.request_id.in_(request_ids), Feedback.recipient_id != user.id) \
            .update({Feedback.request_id: None}, synchronize_session=False)
    mine = db.query(Feedback).filter(Feedback.recipient_id == user.id)
    photos += [f.image_path for f in mine]
    mine.delete(synchronize_session=False)
    if request_ids:
        db.query(Rating).filter(Rating.request_id.in_(request_ids)).delete(synchronize_session=False)
        db.query(FoodRequest).filter(FoodRequest.id.in_(request_ids)).delete(synchronize_session=False)
    db.query(Report).filter(Report.target_type == "listing", Report.target_id.in_(listing_ids or [0])) \
        .delete(synchronize_session=False)
    db.query(FoodListing).filter(FoodListing.donor_id == user.id).delete(synchronize_session=False)
    db.query(EventSubscriber).filter(EventSubscriber.email == user.email.lower()).delete(synchronize_session=False)
    db.delete(user)  # ratings, notifications and event sign-ups go with it (ON DELETE CASCADE)
    db.commit()
    for url in photos:
        delete_upload(url)
