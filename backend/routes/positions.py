from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from models import db, Position, Shift
from auth_utils import manager_required, log_action

positions_bp = Blueprint("positions", __name__)


@positions_bp.route("/", methods=["GET"])
@jwt_required()
def get_positions():
    positions = Position.query.order_by(Position.name).all()
    return jsonify([p.to_dict() for p in positions]), 200


@positions_bp.route("/", methods=["POST"])
@jwt_required()
def create_position():
    current_user, error, code = manager_required()
    if error:
        return error, code

    data = request.get_json() or {}
    if not data.get("name"):
        return jsonify({"error": "Name is required"}), 400

    if Position.query.filter_by(name=data["name"]).first():
        return jsonify({"error": "Position with this name already exists"}), 400

    pos = Position(name=data["name"], color=data.get("color", "#6C63FF"))
    db.session.add(pos)
    db.session.flush()
    log_action("position.create", resource_id=pos.id, details={"name": pos.name})
    db.session.commit()
    return jsonify(pos.to_dict()), 201


@positions_bp.route("/<int:pos_id>", methods=["PUT"])
@jwt_required()
def update_position(pos_id):
    current_user, error, code = manager_required()
    if error:
        return error, code

    pos = db.session.get(Position, pos_id)
    if not pos:
        return jsonify({"error": "Position not found"}), 404

    data = request.get_json() or {}
    if "name" in data:
        pos.name = data["name"]
    if "color" in data:
        pos.color = data["color"]

    log_action("position.update", resource_id=pos_id, details={"name": pos.name})
    db.session.commit()
    return jsonify(pos.to_dict()), 200


@positions_bp.route("/<int:pos_id>", methods=["DELETE"])
@jwt_required()
def delete_position(pos_id):
    current_user, error, code = manager_required()
    if error:
        return error, code

    pos = db.session.get(Position, pos_id)
    if not pos:
        return jsonify({"error": "Position not found"}), 404

    log_action("position.delete", resource_id=pos_id, details={"name": pos.name})
    Shift.query.filter_by(position_id=pos_id).update({"position_id": None})
    db.session.delete(pos)
    db.session.commit()
    return jsonify({"message": "Position deleted"}), 200
