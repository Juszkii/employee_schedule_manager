from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Department

departments_bp = Blueprint("departments", __name__)


@departments_bp.route("/", methods=["GET"])
@jwt_required()
def get_departments():
    depts = Department.query.order_by(Department.name).all()
    return jsonify([d.to_dict() for d in depts]), 200


@departments_bp.route("/", methods=["POST"])
@jwt_required()
def create_department():
    user_id = get_jwt_identity()
    user = db.session.get(User, int(user_id))
    if user.role != "manager":
        return jsonify({"error": "Permission denied"}), 403

    data = request.get_json()
    if not data.get("name"):
        return jsonify({"error": "Name is required"}), 400
    if Department.query.filter_by(name=data["name"]).first():
        return jsonify({"error": "Department already exists"}), 400

    dept = Department(name=data["name"])
    db.session.add(dept)
    db.session.commit()
    return jsonify(dept.to_dict()), 201


@departments_bp.route("/<int:dept_id>", methods=["DELETE"])
@jwt_required()
def delete_department(dept_id):
    user_id = get_jwt_identity()
    user = db.session.get(User, int(user_id))
    if user.role != "manager":
        return jsonify({"error": "Permission denied"}), 403

    dept = db.session.get(Department, dept_id)
    if not dept:
        return jsonify({"error": "Department not found"}), 404

    User.query.filter_by(department_id=dept_id).update({"department_id": None})
    db.session.delete(dept)
    db.session.commit()
    return jsonify({"message": "Department deleted"}), 200
