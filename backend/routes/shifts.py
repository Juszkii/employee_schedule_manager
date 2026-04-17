from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Shift, Position, Request
from datetime import date


def _has_approved_leave(user_id, shift_date):
    return Request.query.filter(
        Request.user_id == user_id,
        Request.type == "urlop",
        Request.status == "approved",
        Request.date_from <= shift_date,
        Request.date_to >= shift_date,
    ).first() is not None

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
    from datetime import datetime, time as time_type

    # Parse input dates/times
    shift_date = date.fromisoformat(data["date"])
    start_time = datetime.strptime(data["start_time"], "%H:%M").time()
    end_time = datetime.strptime(data["end_time"], "%H:%M").time()

    # Validate times
    if start_time >= end_time:
        return jsonify({"error": "Start time must be before end time"}), 400

    # Check for overlapping shifts for the same employee on the same day
    conflicting = Shift.query.filter(
        Shift.user_id == data["user_id"],
        Shift.date == shift_date,
        Shift.start_time < end_time,  # Other shift starts before our shift ends
        Shift.end_time > start_time,  # Other shift ends after our shift starts
    ).first()

    if conflicting:
        return jsonify({
            "error": f"Scheduling conflict: employee already has a shift from {conflicting.start_time.strftime('%H:%M')} to {conflicting.end_time.strftime('%H:%M')} on this date"
        }), 409

    if _has_approved_leave(data["user_id"], shift_date):
        return jsonify({"error": "Cannot schedule a shift: employee has approved time off on this date"}), 409

    shift = Shift(
        user_id=data["user_id"],
        position_id=data.get("position_id"),
        date=shift_date,
        start_time=start_time,
        end_time=end_time,
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
    from datetime import datetime, time as time_type

    # Store old values for reference
    old_date = shift.date
    old_start = shift.start_time
    old_end = shift.end_time

    # Parse new values (or keep old ones if not provided)
    new_date = date.fromisoformat(data["date"]) if "date" in data else old_date
    new_start = datetime.strptime(data["start_time"], "%H:%M").time() if "start_time" in data else old_start
    new_end = datetime.strptime(data["end_time"], "%H:%M").time() if "end_time" in data else old_end

    # Validate times
    if new_start >= new_end:
        return jsonify({"error": "Start time must be before end time"}), 400

    # Check for overlapping shifts (excluding current shift)
    conflicting = Shift.query.filter(
        Shift.id != shift_id,  # Exclude current shift
        Shift.user_id == shift.user_id,
        Shift.date == new_date,
        Shift.start_time < new_end,
        Shift.end_time > new_start,
    ).first()

    if conflicting:
        return jsonify({
            "error": f"Scheduling conflict: employee already has a shift from {conflicting.start_time.strftime('%H:%M')} to {conflicting.end_time.strftime('%H:%M')} on this date"
        }), 409

    if _has_approved_leave(shift.user_id, new_date):
        return jsonify({"error": "Cannot schedule a shift: employee has approved time off on this date"}), 409

    # Apply changes
    shift.date = new_date
    shift.start_time = new_start
    shift.end_time = new_end
    if "note" in data:
        shift.note = data["note"]
    if "position_id" in data:
        shift.position_id = data["position_id"]

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