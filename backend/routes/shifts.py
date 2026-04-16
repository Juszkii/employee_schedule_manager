from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Shift
from datetime import date

shifts_bp = Blueprint("shifts", __name__)


@shifts_bp.route("/", methods=["GET"])
@jwt_required()
def get_shifts():
    """
    Get shifts for given month.
    Manager sees all, employee sees only theirs.
    Parameter: ?month=2025-04
    """
    user_id = get_jwt_identity()
    current_user = db.session.get(User, int(user_id))

    month = request.args.get("month")  # e.g. "2025-04"

    query = Shift.query

    # Filter by month
    if month:
        year, mon = month.split("-")
        query = query.filter(
            db.extract("year", Shift.date) == int(year),
            db.extract("month", Shift.date) == int(mon)
        )

    # Employee sees only their shifts
    if current_user.role != "manager":
        query = query.filter_by(user_id=current_user.id)

    shifts = query.all()
    return jsonify([s.to_dict() for s in shifts]), 200


@shifts_bp.route("/", methods=["POST"])
@jwt_required()
def create_shift():
    """Create new shift - manager only"""
    user_id = get_jwt_identity()
    current_user = db.session.get(User, int(user_id))

    if current_user.role != "manager":
        return jsonify({"error": "Permission denied"}), 403

    data = request.get_json()
    from datetime import datetime, time

    shift = Shift(
        user_id=data["user_id"],
        date=date.fromisoformat(data["date"]),
        start_time=datetime.strptime(data["start_time"], "%H:%M").time(),
        end_time=datetime.strptime(data["end_time"], "%H:%M").time(),
        note=data.get("note"),
    )
    db.session.add(shift)

    # Notification for employee
    from models import Notification
    notification = Notification(
        user_id=data["user_id"],
        message=f"New shift added for {data['date']} ({data['start_time']} - {data['end_time']})"
    )
    db.session.add(notification)
    db.session.commit()

    return jsonify(shift.to_dict()), 201


@shifts_bp.route("/<int:shift_id>", methods=["PUT"])
@jwt_required()
def update_shift(shift_id):
    """Update shift - manager only"""
    user_id = get_jwt_identity()
    current_user = db.session.get(User, int(user_id))

    if current_user.role != "manager":
        return jsonify({"error": "Permission denied"}), 403

    shift = db.session.get(Shift, shift_id)
    if not shift:
        return jsonify({"error": "Shift not found"}), 404

    data = request.get_json()
    from datetime import datetime

    if "date" in data:
        shift.date = date.fromisoformat(data["date"])
    if "start_time" in data:
        shift.start_time = datetime.strptime(data["start_time"], "%H:%M").time()
    if "end_time" in data:
        shift.end_time = datetime.strptime(data["end_time"], "%H:%M").time()
    if "note" in data:
        shift.note = data["note"]

    # Notification about shift change
    from models import Notification
    notification = Notification(
        user_id=shift.user_id,
        message=f"Your shift on {shift.date} has been updated"
    )
    db.session.add(notification)
    db.session.commit()

    return jsonify(shift.to_dict()), 200


@shifts_bp.route("/<int:shift_id>", methods=["DELETE"])
@jwt_required()
def delete_shift(shift_id):
    """Delete shift - manager only"""
    user_id = get_jwt_identity()
    current_user = db.session.get(User, int(user_id))

    if current_user.role != "manager":
        return jsonify({"error": "Permission denied"}), 403

    shift = db.session.get(Shift, shift_id)
    if not shift:
        return jsonify({"error": "Shift not found"}), 404

    db.session.delete(shift)
    db.session.commit()
    return jsonify({"message": "Shift deleted"}), 200