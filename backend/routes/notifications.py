from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Notification

notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.route("/", methods=["GET"])
@jwt_required()
def get_notifications():
    """Get notifications for logged in user"""
    user_id = get_jwt_identity()
    notifications = Notification.query.filter_by(
        user_id=int(user_id)
    ).order_by(Notification.created_at.desc()).all()

    return jsonify([n.to_dict() for n in notifications]), 200


@notifications_bp.route("/<int:notif_id>/read", methods=["PUT"])
@jwt_required()
def mark_read(notif_id):
    """Mark notification as read"""
    user_id = get_jwt_identity()
    notif = db.session.get(Notification, notif_id)

    if not notif or notif.user_id != int(user_id):
        return jsonify({"error": "Notification not found"}), 404

    notif.is_read = True
    db.session.commit()
    return jsonify(notif.to_dict()), 200


@notifications_bp.route("/read-all", methods=["PUT"])
@jwt_required()
def mark_all_read():
    """Mark all notifications as read for current user"""
    user_id = get_jwt_identity()
    notifications = Notification.query.filter_by(
        user_id=int(user_id),
        is_read=False
    ).all()

    for notif in notifications:
        notif.is_read = True
    
    db.session.commit()
    return jsonify({"message": f"Marked {len(notifications)} notification(s) as read"}), 200