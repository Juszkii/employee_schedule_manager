from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Shift
from datetime import datetime

stats_bp = Blueprint("stats", __name__)


@stats_bp.route("/", methods=["GET"])
@jwt_required()
def get_stats():
    """
    Returns work hour statistics per employee - manager only.
    Parameter: ?month=2025-04
    """
    user_id = get_jwt_identity()
    current_user = db.session.get(User, int(user_id))

    if current_user.role != "manager":
        return jsonify({"error": "Permission denied"}), 403

    month = request.args.get("month")
    query = Shift.query

    if month:
        year, mon = month.split("-")
        query = query.filter(
            db.extract("year", Shift.date) == int(year),
            db.extract("month", Shift.date) == int(mon)
        )

    shifts = query.all()

    # Calculate hours per employee
    stats = {}
    for shift in shifts:
        uid = shift.user_id
        if uid not in stats:
            stats[uid] = {
                "user_id": uid,
                "user_name": shift.user.name,
                "total_hours": 0,
                "shifts_count": 0,
            }

        # Obliczamy długość zmiany w godzinach
        start = datetime.combine(shift.date, shift.start_time)
        end = datetime.combine(shift.date, shift.end_time)
        hours = (end - start).seconds / 3600

        stats[uid]["total_hours"] += round(hours, 2)
        stats[uid]["shifts_count"] += 1

    return jsonify(list(stats.values())), 200