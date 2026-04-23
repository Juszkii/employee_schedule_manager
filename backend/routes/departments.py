from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from models import db, User, Department
from auth_utils import manager_required, log_action

departments_bp = Blueprint("departments", __name__)


@departments_bp.route("/", methods=["GET"])
@jwt_required()
def get_departments():
    depts = Department.query.order_by(Department.name).all()
    return jsonify([d.to_dict() for d in depts]), 200


@departments_bp.route("/", methods=["POST"])
@jwt_required()
def create_department():
    current_user, error, code = manager_required()
    if error:
        return error, code

    data = request.get_json() or {}
    if not data.get("name"):
        return jsonify({"error": "Name is required"}), 400
    if Department.query.filter_by(name=data["name"]).first():
        return jsonify({"error": "Department already exists"}), 400

    dept = Department(name=data["name"], color=data.get("color", "#3B82F6"))
    db.session.add(dept)
    db.session.flush()
    log_action("department.create", resource_id=dept.id, details={"name": dept.name})
    db.session.commit()
    return jsonify(dept.to_dict()), 201


@departments_bp.route("/<int:dept_id>", methods=["PUT"])
@jwt_required()
def update_department(dept_id):
    current_user, error, code = manager_required()
    if error:
        return error, code

    dept = db.session.get(Department, dept_id)
    if not dept:
        return jsonify({"error": "Department not found"}), 404

    data = request.get_json() or {}
    if "name" in data:
        if not data["name"]:
            return jsonify({"error": "Name cannot be empty"}), 400
        existing = Department.query.filter_by(name=data["name"]).first()
        if existing and existing.id != dept_id:
            return jsonify({"error": "Department already exists"}), 400
        dept.name = data["name"]
    if "color" in data:
        dept.color = data["color"]

    log_action("department.update", resource_id=dept_id, details={"name": dept.name})
    db.session.commit()
    return jsonify(dept.to_dict()), 200


@departments_bp.route("/<int:dept_id>", methods=["DELETE"])
@jwt_required()
def delete_department(dept_id):
    current_user, error, code = manager_required()
    if error:
        return error, code

    dept = db.session.get(Department, dept_id)
    if not dept:
        return jsonify({"error": "Department not found"}), 404

    log_action("department.delete", resource_id=dept_id, details={"name": dept.name})
    User.query.filter_by(department_id=dept_id).update({"department_id": None})
    db.session.delete(dept)
    db.session.commit()
    return jsonify({"message": "Department deleted"}), 200
