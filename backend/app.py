from flask import Flask
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from config import Config
from models import db

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    JWTManager(app)
    CORS(app)

    # Register all endpoints
    from routes.auth import auth_bp
    from routes.users import users_bp
    from routes.shifts import shifts_bp
    from routes.requests import requests_bp
    from routes.notifications import notifications_bp
    from routes.stats import stats_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(shifts_bp, url_prefix="/api/shifts")
    app.register_blueprint(requests_bp, url_prefix="/api/requests")
    app.register_blueprint(notifications_bp, url_prefix="/api/notifications")
    app.register_blueprint(stats_bp, url_prefix="/api/stats")

    with app.app_context():
        db.create_all()
        seed_data(app)

    return app


def seed_data(app):
    from models import User
    from werkzeug.security import generate_password_hash

    if User.query.count() == 0:
        manager = User(
            name="Admin Manager",
            email="manager@test.com",
            password_hash=generate_password_hash("admin123"),
            role="manager",
        )
        db.session.add(manager)
        db.session.commit()
        print("✅ Manager account created: manager@test.com / admin123")


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True)