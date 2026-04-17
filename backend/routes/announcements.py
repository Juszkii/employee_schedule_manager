from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Announcement, AnnouncementRead

announcements_bp = Blueprint("announcements", __name__)


def _with_count(ann):
    d = ann.to_dict()
    d["readers_count"] = AnnouncementRead.query.filter_by(announcement_id=ann.id).count()
    return d


@announcements_bp.route("/", methods=["GET"])
@jwt_required()
def get_announcements():
    user_id = get_jwt_identity()
    current_user = db.session.get(User, int(user_id))

    if current_user.role == "manager":
        items = Announcement.query.order_by(Announcement.created_at.desc()).all()
    else:
        items = Announcement.query.filter(
            db.or_(
                Announcement.department_id == None,
                Announcement.department_id == current_user.department_id
            )
        ).order_by(Announcement.created_at.desc()).all()

    return jsonify([_with_count(a) for a in items]), 200


@announcements_bp.route("/", methods=["POST"])
@jwt_required()
def create_announcement():
    user_id = get_jwt_identity()
    current_user = db.session.get(User, int(user_id))

    if current_user.role != "manager":
        return jsonify({"error": "Permission denied"}), 403

    data = request.get_json()
    if not data.get("title") or not data.get("content"):
        return jsonify({"error": "Title and content are required"}), 400

    ann = Announcement(
        title=data["title"],
        content=data["content"],
        department_id=data.get("department_id"),
        created_by=int(user_id),
    )
    db.session.add(ann)
    db.session.commit()
    return jsonify(_with_count(ann)), 201


@announcements_bp.route("/mark-seen", methods=["POST"])
@jwt_required()
def mark_seen():
    user_id = int(get_jwt_identity())
    current_user = db.session.get(User, user_id)

    if current_user.role == "manager":
        items = Announcement.query.all()
    else:
        items = Announcement.query.filter(
            db.or_(
                Announcement.department_id == None,
                Announcement.department_id == current_user.department_id
            )
        ).all()

    for ann in items:
        exists = AnnouncementRead.query.filter_by(
            announcement_id=ann.id, user_id=user_id
        ).first()
        if not exists:
            db.session.add(AnnouncementRead(announcement_id=ann.id, user_id=user_id))

    db.session.commit()
    return jsonify({"message": "Marked"}), 200


@announcements_bp.route("/<int:ann_id>/readers", methods=["GET"])
@jwt_required()
def get_readers(ann_id):
    user_id = get_jwt_identity()
    current_user = db.session.get(User, int(user_id))

    if current_user.role != "manager":
        return jsonify({"error": "Permission denied"}), 403

    reads = AnnouncementRead.query.filter_by(announcement_id=ann_id)\
        .order_by(AnnouncementRead.read_at).all()

    result = []
    for r in reads:
        user = db.session.get(User, r.user_id)
        if user:
            result.append({
                "user_name": user.name,
                "read_at": r.read_at.isoformat(),
            })

    return jsonify(result), 200


@announcements_bp.route("/<int:ann_id>", methods=["DELETE"])
@jwt_required()
def delete_announcement(ann_id):
    user_id = get_jwt_identity()
    current_user = db.session.get(User, int(user_id))

    if current_user.role != "manager":
        return jsonify({"error": "Permission denied"}), 403

    ann = db.session.get(Announcement, ann_id)
    if not ann:
        return jsonify({"error": "Announcement not found"}), 404

    AnnouncementRead.query.filter_by(announcement_id=ann_id).delete()
    db.session.delete(ann)
    db.session.commit()
    return jsonify({"message": "Deleted"}), 200
