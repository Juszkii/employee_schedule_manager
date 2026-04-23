import re
from datetime import date

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Request, Notification
from auth_utils import get_current_user, manager_required, log_action

requests_bp = Blueprint("requests", __name__)

_VALID_TYPES = {
    "urlop",
    "urlop_chorobowy",
    "urlop_okolicznosciowy",
    "urlop_bezplatny",
    "praca_zdalna",
    "swap",
    "nadgodziny",
}

_TYPES_REQUIRE_TIMES = {"swap", "nadgodziny"}
_TIME_RE = re.compile(r"^\d{2}:\d{2}$")


@requests_bp.route("/", methods=["GET"])
@jwt_required()
def get_requests():
    current_user = get_current_user()

    if current_user.role == "manager":
        reqs = Request.query.all()
    else:
        reqs = Request.query.filter_by(user_id=current_user.id).all()

    return jsonify([r.to_dict() for r in reqs]), 200


@requests_bp.route("/", methods=["POST"])
@jwt_required()
def create_request():
    user_id = get_jwt_identity()
    data = request.get_json() or {}

    if data.get("type") not in _VALID_TYPES:
        return jsonify({"error": f"Invalid request type. Allowed: {', '.join(sorted(_VALID_TYPES))}"}), 400

    if not data.get("date_from") or not data.get("date_to"):
        return jsonify({"error": "Both From and To dates are required"}), 400

    date_from = date.fromisoformat(data["date_from"])
    date_to   = date.fromisoformat(data["date_to"])

    if date_to < date_from:
        return jsonify({"error": "End date cannot be before start date"}), 400

    time_from = data.get("time_from") or None
    time_to   = data.get("time_to")   or None

    if data["type"] in _TYPES_REQUIRE_TIMES:
        if not time_from or not time_to:
            return jsonify({"error": "time_from and time_to are required for this request type"}), 400
        if not _TIME_RE.match(time_from) or not _TIME_RE.match(time_to):
            return jsonify({"error": "Invalid time format. Use HH:MM"}), 400

    req = Request(
        user_id=int(user_id),
        type=data["type"],
        date_from=date_from,
        date_to=date_to,
        message=data.get("message"),
        time_from=time_from,
        time_to=time_to,
    )
    db.session.add(req)
    db.session.flush()
    log_action("request.create", resource_id=req.id, details={"type": req.type, "date_from": str(req.date_from), "date_to": str(req.date_to)})
    db.session.commit()
    return jsonify(req.to_dict()), 201


@requests_bp.route("/<int:req_id>", methods=["PUT"])
@jwt_required()
def update_request(req_id):
    current_user, error, code = manager_required()
    if error:
        return error, code

    req = db.session.get(Request, req_id)
    if not req:
        return jsonify({"error": "Request not found"}), 404

    data = request.get_json() or {}
    new_status = data.get("status")
    if new_status not in ("approved", "rejected"):
        return jsonify({"error": "Status must be 'approved' or 'rejected'"}), 400

    req.status = new_status

    status_text = "approved" if req.status == "approved" else "rejected"
    db.session.add(Notification(
        user_id=req.user_id,
        message=f"Your {req.type} request has been {status_text}"
    ))
    log_action(f"request.{new_status}", resource_id=req_id, details={"type": req.type, "employee_id": req.user_id})
    db.session.commit()

    return jsonify(req.to_dict()), 200
