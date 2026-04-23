from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import joinedload
from models import db, Announcement, AnnouncementRead
from auth_utils import get_current_user, manager_required, log_action

announcements_bp = Blueprint("announcements", __name__)


def _with_count(ann):
    d = ann.to_dict()
    d["readers_count"] = AnnouncementRead.query.filter_by(announcement_id=ann.id).count()
    return d


@announcements_bp.route("/", methods=["GET"])
@jwt_required()
def get_announcements():
    current_user = get_current_user()

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
    current_user, error, code = manager_required()
    if error:
        return error, code

    data = request.get_json() or {}
    if not data.get("title") or not data.get("content"):
        return jsonify({"error": "Title and content are required"}), 400

    ann = Announcement(
        title=data["title"],
        content=data["content"],
        department_id=data.get("department_id"),
        created_by=current_user.id,
    )
    db.session.add(ann)
    db.session.flush()
    log_action("announcement.create", resource_id=ann.id, details={"title": ann.title, "department_id": ann.department_id})
    db.session.commit()
    return jsonify(_with_count(ann)), 201


@announcements_bp.route("/mark-seen", methods=["POST"])
@jwt_required()
def mark_seen():
    current_user = get_current_user()

    if current_user.role == "manager":
        items = Announcement.query.all()
    else:
        items = Announcement.query.filter(
            db.or_(
                Announcement.department_id == None,
                Announcement.department_id == current_user.department_id
            )
        ).all()

    already_read = {
        r.announcement_id for r in
        AnnouncementRead.query.filter_by(user_id=current_user.id).all()
    }
    for ann in items:
        if ann.id not in already_read:
            db.session.add(AnnouncementRead(announcement_id=ann.id, user_id=current_user.id))

    db.session.commit()
    return jsonify({"message": "Marked"}), 200


@announcements_bp.route("/<int:ann_id>/readers", methods=["GET"])
@jwt_required()
def get_readers(ann_id):
    current_user, error, code = manager_required()
    if error:
        return error, code

    reads = (
        AnnouncementRead.query
        .filter_by(announcement_id=ann_id)
        .options(joinedload(AnnouncementRead.reader))
        .order_by(AnnouncementRead.read_at)
        .all()
    )

    result = [
        {"user_name": r.reader.name, "read_at": r.read_at.isoformat()}
        for r in reads if r.reader
    ]
    return jsonify(result), 200


@announcements_bp.route("/<int:ann_id>", methods=["DELETE"])
@jwt_required()
def delete_announcement(ann_id):
    current_user, error, code = manager_required()
    if error:
        return error, code

    ann = db.session.get(Announcement, ann_id)
    if not ann:
        return jsonify({"error": "Announcement not found"}), 404

    log_action("announcement.delete", resource_id=ann_id, details={"title": ann.title})
    AnnouncementRead.query.filter_by(announcement_id=ann_id).delete()
    db.session.delete(ann)
    db.session.commit()
    return jsonify({"message": "Deleted"}), 200
