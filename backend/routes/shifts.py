import re
from datetime import date, datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from models import db, User, Shift, Request, Notification
from auth_utils import get_current_user, manager_required, log_action

shifts_bp = Blueprint("shifts", __name__)

_MONTH_RE = re.compile(r"^\d{4}-(?:0[1-9]|1[0-2])$")


def _has_approved_leave(user_id, shift_date):
    return Request.query.filter(
        Request.user_id == user_id,
        Request.type == "urlop",
        Request.status == "approved",
        Request.date_from <= shift_date,
        Request.date_to >= shift_date,
    ).first() is not None


@shifts_bp.route("/", methods=["GET"])
@jwt_required()
def get_shifts():
    current_user = get_current_user()
    month = request.args.get("month")

    if month and not _MONTH_RE.match(month):
        return jsonify({"error": "Invalid month format. Use YYYY-MM"}), 400

    query = Shift.query

    if month:
        year, mon = month.split("-")
        query = query.filter(
            db.extract("year", Shift.date) == int(year),
            db.extract("month", Shift.date) == int(mon)
        )

    if current_user.role != "manager":
        query = query.filter_by(user_id=current_user.id)

    return jsonify([s.to_dict() for s in query.all()]), 200


@shifts_bp.route("/", methods=["POST"])
@jwt_required()
def create_shift():
    current_user, error, code = manager_required()
    if error:
        return error, code

    data = request.get_json() or {}

    missing = [f for f in ("date", "user_id", "start_time", "end_time") if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    shift_date = date.fromisoformat(data["date"])
    start_time = datetime.strptime(data["start_time"], "%H:%M").time()
    end_time = datetime.strptime(data["end_time"], "%H:%M").time()

    if start_time >= end_time:
        return jsonify({"error": "Start time must be before end time"}), 400

    conflicting = Shift.query.filter(
        Shift.user_id == data["user_id"],
        Shift.date == shift_date,
        Shift.start_time < end_time,
        Shift.end_time > start_time,
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
    db.session.add(Notification(
        user_id=data["user_id"],
        message=f"New shift added for {data['date']} ({data['start_time']} - {data['end_time']})"
    ))
    db.session.flush()
    log_action("shift.create", resource_id=shift.id, details={"date": data["date"], "employee_id": data["user_id"]})
    db.session.commit()

    return jsonify(shift.to_dict()), 201


@shifts_bp.route("/colleagues", methods=["GET"])
@jwt_required()
def get_colleague_shifts():
    current_user = get_current_user()
    date_str = request.args.get("date")
    if not date_str:
        return jsonify({"error": "date parameter required"}), 400
    try:
        shift_date = date.fromisoformat(date_str)
    except ValueError:
        return jsonify({"error": "Invalid date format"}), 400

    if not current_user.department_id:
        return jsonify([]), 200

    dept_user_ids = [
        u.id for u in User.query.filter_by(department_id=current_user.department_id).all()
        if u.id != current_user.id
    ]
    if not dept_user_ids:
        return jsonify([]), 200

    shifts = Shift.query.filter(
        Shift.date == shift_date,
        Shift.user_id.in_(dept_user_ids)
    ).all()
    return jsonify([s.to_dict() for s in shifts]), 200


@shifts_bp.route("/bulk", methods=["POST"])
@jwt_required()
def create_shifts_bulk():
    current_user, error, code = manager_required()
    if error:
        return error, code

    data = request.get_json() or {}
    missing = [f for f in ("dates", "user_id", "start_time", "end_time") if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    if not isinstance(data["dates"], list) or len(data["dates"]) == 0:
        return jsonify({"error": "dates must be a non-empty list"}), 400

    try:
        start_time = datetime.strptime(data["start_time"], "%H:%M").time()
        end_time = datetime.strptime(data["end_time"], "%H:%M").time()
    except ValueError:
        return jsonify({"error": "Invalid time format. Use HH:MM"}), 400

    if start_time >= end_time:
        return jsonify({"error": "Start time must be before end time"}), 400

    user_id = data["user_id"]
    position_id = data.get("position_id")
    note = data.get("note")
    created = []
    skipped = []

    for date_str in data["dates"]:
        try:
            shift_date = date.fromisoformat(date_str)
        except ValueError:
            skipped.append({"date": date_str, "reason": "invalid date"})
            continue

        conflict = Shift.query.filter(
            Shift.user_id == user_id,
            Shift.date == shift_date,
            Shift.start_time < end_time,
            Shift.end_time > start_time,
        ).first()
        if conflict:
            skipped.append({"date": date_str, "reason": "conflict"})
            continue

        if _has_approved_leave(user_id, shift_date):
            skipped.append({"date": date_str, "reason": "approved leave"})
            continue

        shift = Shift(
            user_id=user_id,
            position_id=position_id,
            date=shift_date,
            start_time=start_time,
            end_time=end_time,
            note=note,
        )
        db.session.add(shift)
        db.session.flush()
        log_action("shift.create", resource_id=shift.id, details={"date": date_str, "employee_id": user_id})
        created.append(shift.to_dict())

    if created:
        db.session.add(Notification(
            user_id=user_id,
            message=f"{len(created)} recurring shift(s) added ({data['start_time']} - {data['end_time']})"
        ))

    db.session.commit()
    return jsonify({"created": created, "skipped": skipped}), 201


@shifts_bp.route("/<int:shift_id>", methods=["PUT"])
@jwt_required()
def update_shift(shift_id):
    current_user, error, code = manager_required()
    if error:
        return error, code

    shift = db.session.get(Shift, shift_id)
    if not shift:
        return jsonify({"error": "Shift not found"}), 404

    data = request.get_json() or {}

    new_date = date.fromisoformat(data["date"]) if "date" in data else shift.date
    new_start = datetime.strptime(data["start_time"], "%H:%M").time() if "start_time" in data else shift.start_time
    new_end = datetime.strptime(data["end_time"], "%H:%M").time() if "end_time" in data else shift.end_time

    if new_start >= new_end:
        return jsonify({"error": "Start time must be before end time"}), 400

    conflicting = Shift.query.filter(
        Shift.id != shift_id,
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

    shift.date = new_date
    shift.start_time = new_start
    shift.end_time = new_end
    if "note" in data:
        shift.note = data["note"]
    if "position_id" in data:
        shift.position_id = data["position_id"]

    db.session.add(Notification(
        user_id=shift.user_id,
        message=f"Your shift on {shift.date} has been updated"
    ))
    log_action("shift.update", resource_id=shift_id, details={"date": str(shift.date)})
    db.session.commit()

    return jsonify(shift.to_dict()), 200


@shifts_bp.route("/<int:shift_id>", methods=["DELETE"])
@jwt_required()
def delete_shift(shift_id):
    current_user, error, code = manager_required()
    if error:
        return error, code

    shift = db.session.get(Shift, shift_id)
    if not shift:
        return jsonify({"error": "Shift not found"}), 404

    log_action("shift.delete", resource_id=shift_id, details={"date": str(shift.date), "employee_id": shift.user_id})
    db.session.delete(shift)
    db.session.commit()
    return jsonify({"message": "Shift deleted"}), 200
