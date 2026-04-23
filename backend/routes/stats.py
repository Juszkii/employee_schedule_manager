import re
from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from models import db, Shift
from auth_utils import manager_required

stats_bp = Blueprint("stats", __name__)

_MONTH_RE = re.compile(r"^\d{4}-(?:0[1-9]|1[0-2])$")


@stats_bp.route("/", methods=["GET"])
@jwt_required()
def get_stats():
    current_user, error, code = manager_required()
    if error:
        return error, code

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

    shifts = query.all()

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

        start = datetime.combine(shift.date, shift.start_time)
        end = datetime.combine(shift.date, shift.end_time)
        hours = (end - start).seconds / 3600

        stats[uid]["total_hours"] += round(hours, 2)
        stats[uid]["shifts_count"] += 1

    return jsonify(list(stats.values())), 200
