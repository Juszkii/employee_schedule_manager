from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from models import db, AuditLog
from auth_utils import manager_required

audit_bp = Blueprint("audit", __name__)

_PAGE_SIZE = 50


@audit_bp.route("/", methods=["GET"])
@jwt_required()
def get_audit_logs():
    current_user, error, code = manager_required()
    if error:
        return error, code

    page = max(1, int(request.args.get("page", 1)))
    action_filter = request.args.get("action")

    query = AuditLog.query

    if action_filter:
        query = query.filter(AuditLog.action.like(f"{action_filter}%"))

    total = query.count()
    logs = (
        query
        .order_by(AuditLog.created_at.desc())
        .offset((page - 1) * _PAGE_SIZE)
        .limit(_PAGE_SIZE)
        .all()
    )

    return jsonify({
        "logs": [log.to_dict() for log in logs],
        "total": total,
        "page": page,
        "pages": (total + _PAGE_SIZE - 1) // _PAGE_SIZE,
    }), 200
