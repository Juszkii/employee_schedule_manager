from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Label

users_bp = Blueprint("users", __name__)


def manager_required():
    """Check if logged in user is a manager"""
    user_id = get_jwt_identity()
    user = db.session.get(User, int(user_id))
    if not user or user.role != "manager":
        return None, jsonify({"error": "Permission denied"}), 403
    return user, None, None


@users_bp.route("/", methods=["GET"])
@jwt_required()
def get_users():
    """Get list of all users - manager only"""
    current_user, error, code = manager_required()
    if error:
        return error, code

    users = User.query.all()
    return jsonify([u.to_dict() for u in users]), 200


@users_bp.route("/", methods=["POST"])
@jwt_required()
def create_user():
    """Create new employee - manager only"""
    current_user, error, code = manager_required()
    if error:
        return error, code

    data = request.get_json()
    from werkzeug.security import generate_password_hash

    # Check if email already exists
    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "Email already exists"}), 400

    user = User(
        name=data["name"],
        email=data["email"].lower().strip(),
        password_hash=generate_password_hash(data["password"]),
        role=data.get("role", "employee"),
        label_id=data.get("label_id"),
    )
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201


@users_bp.route("/<int:user_id>", methods=["PUT"])
@jwt_required()
def update_user(user_id):
    """Update employee data - manager only"""
    current_user, error, code = manager_required()
    if error:
        return error, code

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    user.name = data.get("name", user.name)
    user.role = data.get("role", user.role)
    user.label_id = data.get("label_id", user.label_id)

    db.session.commit()
    return jsonify(user.to_dict()), 200


@users_bp.route("/<int:user_id>", methods=["DELETE"])
@jwt_required()
def delete_user(user_id):
    """Delete employee - manager only"""
    current_user, error, code = manager_required()
    if error:
        return error, code

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "User deleted"}), 200


# --- Etykiety ---

@users_bp.route("/labels", methods=["GET"])
@jwt_required()
def get_labels():
    """Get all labels"""
    labels = Label.query.all()
    return jsonify([l.to_dict() for l in labels]), 200


@users_bp.route("/labels", methods=["POST"])
@jwt_required()
def create_label():
    """Create new label - manager only"""
    current_user, error, code = manager_required()
    if error:
        return error, code

    data = request.get_json()
    label = Label(
        name=data["name"],
        color=data.get("color", "#3B82F6")
    )
    db.session.add(label)
    db.session.commit()
    return jsonify(label.to_dict()), 201