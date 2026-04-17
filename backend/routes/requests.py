from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Request, Notification
from datetime import date

requests_bp = Blueprint("requests", __name__)


@requests_bp.route("/", methods=["GET"])
@jwt_required()
def get_requests():
    """Manager sees all requests, employees see only theirs"""
    user_id = get_jwt_identity()
    current_user = db.session.get(User, int(user_id))

    if current_user.role == "manager":
        reqs = Request.query.all()
    else:
        reqs = Request.query.filter_by(user_id=current_user.id).all()

    return jsonify([r.to_dict() for r in reqs]), 200


@requests_bp.route("/", methods=["POST"])
@jwt_required()
def create_request():
    """Employee submits time off or shift swap request"""
    user_id = get_jwt_identity()
    data = request.get_json()

    if not data.get("date_from") or not data.get("date_to"):
        return jsonify({"error": "Both From and To dates are required"}), 400

    date_from = date.fromisoformat(data["date_from"])
    date_to   = date.fromisoformat(data["date_to"])

    if date_to < date_from:
        return jsonify({"error": "End date cannot be before start date"}), 400

    req = Request(
        user_id=int(user_id),
        type=data["type"],
        date_from=date_from,
        date_to=date_to,
        message=data.get("message"),
    )
    db.session.add(req)
    db.session.commit()
    return jsonify(req.to_dict()), 201


@requests_bp.route("/<int:req_id>", methods=["PUT"])
@jwt_required()
def update_request(req_id):
    """Manager approves or rejects request"""
    user_id = get_jwt_identity()
    current_user = db.session.get(User, int(user_id))

    if current_user.role != "manager":
        return jsonify({"error": "Permission denied"}), 403

    req = db.session.get(Request, req_id)
    if not req:
        return jsonify({"error": "Request not found"}), 404

    data = request.get_json()
    req.status = data["status"]  # "approved" or "rejected"

    # Notification for employee about decision
    status_text = "approved" if req.status == "approved" else "rejected"
    notification = Notification(
        user_id=req.user_id,
        message=f"Your {req.type} request has been {status_text}"
    )
    db.session.add(notification)
    db.session.commit()

    return jsonify(req.to_dict()), 200