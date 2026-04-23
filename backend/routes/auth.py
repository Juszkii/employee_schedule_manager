from datetime import datetime, timezone, timedelta

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, jwt_required,
    set_access_cookies, unset_jwt_cookies,
)
from werkzeug.security import check_password_hash
from models import db, User, LoginAttempt
from auth_utils import log_action, get_current_user

auth_bp = Blueprint("auth", __name__)

_RATE_LIMIT_MAX = 10
_RATE_LIMIT_WINDOW = timedelta(minutes=5)


def _is_rate_limited(ip: str) -> bool:
    cutoff = datetime.now(timezone.utc) - _RATE_LIMIT_WINDOW

    LoginAttempt.query.filter(
        LoginAttempt.ip == ip,
        LoginAttempt.attempted_at < cutoff,
    ).delete()

    count = LoginAttempt.query.filter(
        LoginAttempt.ip == ip,
        LoginAttempt.attempted_at >= cutoff,
    ).count()

    if count >= _RATE_LIMIT_MAX:
        db.session.commit()
        return True

    db.session.add(LoginAttempt(ip=ip))
    db.session.commit()
    return False


@auth_bp.route("/login", methods=["POST"])
def login():
    ip = request.remote_addr or "unknown"
    if _is_rate_limited(ip):
        return jsonify({"error": "Too many login attempts. Try again in 5 minutes."}), 429

    data = request.get_json() or {}
    email = data.get("email", "").lower().strip()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = User.query.filter_by(email=email).first()

    if not user or not check_password_hash(user.password_hash, password):
        log_action("auth.login_failed", details={"email": email})
        db.session.commit()
        return jsonify({"error": "Invalid email or password"}), 401

    log_action("auth.login", user_id=user.id, details={"email": email})
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    response = jsonify({"user": user.to_dict()})
    set_access_cookies(response, token)
    return response, 200


@auth_bp.route("/logout", methods=["POST"])
def logout():
    response = jsonify({"message": "Logged out"})
    unset_jwt_cookies(response)
    return response, 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user = get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": user.to_dict()}), 200
