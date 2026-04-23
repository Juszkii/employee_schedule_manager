from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash
from models import db, User, Label
from auth_utils import manager_required, validate_password, log_action

users_bp = Blueprint("users", __name__)


@users_bp.route("/", methods=["GET"])
@jwt_required()
def get_users():
    current_user, error, code = manager_required()
    if error:
        return error, code

    users = User.query.all()
    return jsonify([u.to_dict() for u in users]), 200


@users_bp.route("/", methods=["POST"])
@jwt_required()
def create_user():
    current_user, error, code = manager_required()
    if error:
        return error, code

    data = request.get_json() or {}

    missing = [f for f in ("name", "email", "password") if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    pw_error = validate_password(data["password"])
    if pw_error:
        return jsonify({"error": pw_error}), 400

    if User.query.filter_by(email=data["email"].lower().strip()).first():
        return jsonify({"error": "Email already exists"}), 400

    user = User(
        name=data["name"].strip(),
        email=data["email"].lower().strip(),
        password_hash=generate_password_hash(data["password"]),
        role=data.get("role", "employee"),
        phone=data.get("phone") or None,
        label_id=data.get("label_id"),
    )
    db.session.add(user)
    db.session.flush()
    log_action("user.create", resource_id=user.id, details={"name": user.name, "email": user.email, "role": user.role})
    db.session.commit()
    return jsonify(user.to_dict()), 201


@users_bp.route("/<int:user_id>", methods=["PUT"])
@jwt_required()
def update_user(user_id):
    current_user, error, code = manager_required()
    if error:
        return error, code

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}

    new_role = data.get("role", user.role)
    if user.role == "manager" and new_role != "manager":
        if user_id == int(get_jwt_identity()):
            return jsonify({"error": "Nie możesz odebrać sobie roli managera"}), 400
        managers_count = User.query.filter_by(role="manager").count()
        if managers_count <= 1:
            return jsonify({"error": "Nie można odebrać roli — to jedyny manager w systemie"}), 400

    new_email = data.get("email", user.email).lower().strip()
    if new_email != user.email:
        if User.query.filter(User.email == new_email, User.id != user_id).first():
            return jsonify({"error": "Ten adres email jest już zajęty"}), 400

    user.name = data.get("name", user.name)
    user.email = new_email
    user.role = new_role
    user.phone = data.get("phone", user.phone) or None
    user.label_id = data.get("label_id", user.label_id)
    if "department_id" in data:
        user.department_id = data["department_id"]

    if data.get("password"):
        pw_error = validate_password(data["password"])
        if pw_error:
            return jsonify({"error": pw_error}), 400
        user.password_hash = generate_password_hash(data["password"])

    log_action("user.update", resource_id=user_id, details={"name": user.name, "email": user.email, "role": user.role})
    db.session.commit()
    return jsonify(user.to_dict()), 200


@users_bp.route("/<int:user_id>", methods=["DELETE"])
@jwt_required()
def delete_user(user_id):
    current_user, error, code = manager_required()
    if error:
        return error, code

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    if user_id == int(get_jwt_identity()):
        return jsonify({"error": "Nie możesz usunąć własnego konta"}), 400

    if user.role == "manager":
        managers_count = User.query.filter_by(role="manager").count()
        if managers_count <= 1:
            return jsonify({"error": "Nie można usunąć — to jedyny manager w systemie"}), 400

    log_action("user.delete", resource_id=user_id, details={"name": user.name, "email": user.email})
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "User deleted"}), 200


@users_bp.route("/me", methods=["PUT"])
@jwt_required()
def update_me():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}

    new_email = data.get("email", user.email).lower().strip()
    if new_email != user.email:
        if User.query.filter(User.email == new_email, User.id != user_id).first():
            return jsonify({"error": "Ten adres email jest już zajęty"}), 400

    user.name = data.get("name", user.name).strip()
    user.email = new_email

    if data.get("password"):
        pw_error = validate_password(data["password"])
        if pw_error:
            return jsonify({"error": pw_error}), 400
        user.password_hash = generate_password_hash(data["password"])

    log_action("user.update_self", resource_id=user_id, details={"name": user.name, "email": user.email})
    db.session.commit()
    return jsonify(user.to_dict()), 200


@users_bp.route("/labels", methods=["GET"])
@jwt_required()
def get_labels():
    labels = Label.query.all()
    return jsonify([l.to_dict() for l in labels]), 200


@users_bp.route("/labels", methods=["POST"])
@jwt_required()
def create_label():
    current_user, error, code = manager_required()
    if error:
        return error, code

    data = request.get_json() or {}
    if not data.get("name"):
        return jsonify({"error": "Name is required"}), 400
    if Label.query.filter_by(name=data["name"]).first():
        return jsonify({"error": "Role with this name already exists"}), 400

    label = Label(
        name=data["name"],
        color=data.get("color", "#3B82F6")
    )
    db.session.add(label)
    db.session.commit()
    return jsonify(label.to_dict()), 201


@users_bp.route("/labels/<int:label_id>", methods=["DELETE"])
@jwt_required()
def delete_label(label_id):
    current_user, error, code = manager_required()
    if error:
        return error, code

    label = db.session.get(Label, label_id)
    if not label:
        return jsonify({"error": "Label not found"}), 404

    User.query.filter_by(label_id=label_id).update({"label_id": None})
    db.session.delete(label)
    db.session.commit()
    return jsonify({"message": "Label deleted"}), 200
