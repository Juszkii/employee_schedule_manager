import json
import re

from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity
from models import db, User, AuditLog

_PASSWORD_RE = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$")
PASSWORD_RULES = "minimum 8 characters, at least one uppercase letter, one lowercase letter and one digit"


def validate_password(password: str):
    """Returns an error message string if invalid, or None if OK."""
    if not password:
        return "Password is required"
    if not _PASSWORD_RE.match(password):
        return f"Password too weak — {PASSWORD_RULES}"
    return None


def log_action(action, resource_id=None, details=None, user_id=None):
    """Add an audit log entry to the current session. Caller must commit."""
    if user_id is None:
        try:
            uid = get_jwt_identity()
            user_id = int(uid) if uid else None
        except Exception:
            pass
    db.session.add(AuditLog(
        user_id=user_id,
        action=action,
        resource_id=resource_id,
        details=json.dumps(details, default=str) if details else None,
        ip=request.remote_addr,
    ))


def get_current_user():
    user_id = get_jwt_identity()
    return db.session.get(User, int(user_id))


def manager_required():
    user = get_current_user()
    if not user or user.role != "manager":
        return None, jsonify({"error": "Permission denied"}), 403
    return user, None, None
