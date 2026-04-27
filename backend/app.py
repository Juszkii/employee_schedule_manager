import logging
import os
import secrets

from flask import Flask, Response, request as flask_request, jsonify, send_from_directory
from flask_jwt_extended import JWTManager
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix
from config import Config
from models import db

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

_IS_PRODUCTION = os.environ.get("COOKIE_SECURE", "false").lower() == "true"


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Trust one layer of proxy headers (nginx sets X-Forwarded-For, X-Forwarded-Proto)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    if not os.environ.get("SECRET_KEY"):
        logger.warning("SECRET_KEY not set in .env — random key used; all sessions reset on restart")
    if not os.environ.get("JWT_SECRET_KEY"):
        logger.warning("JWT_SECRET_KEY not set in .env — random key used; all tokens invalidated on restart")

    db.init_app(app)
    JWTManager(app)

    allowed_origin = app.config["CORS_ALLOWED_ORIGIN"]

    def _apply_cors(response):
        response.headers["Access-Control-Allow-Origin"] = allowed_origin
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-CSRF-TOKEN"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        if allowed_origin != "*":
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

    def _apply_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if _IS_PRODUCTION:
            # Tell browsers to only connect via HTTPS for 1 year
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    @app.after_request
    def apply_headers(response):
        _apply_cors(response)
        _apply_security_headers(response)
        return response

    @app.errorhandler(Exception)
    def handle_exception(e):
        if isinstance(e, HTTPException):
            return e
        logger.exception("Unhandled exception: %s", e)
        response = jsonify({"error": "An internal server error occurred"})
        response.status_code = 500
        return apply_headers(response)

    @app.route("/favicon.ico")
    def favicon():
        return send_from_directory(
            os.path.join(FRONTEND_DIR, "assets", "images"),
            "favicon.ico",
            mimetype="image/vnd.microsoft.icon"
        ) if os.path.exists(os.path.join(FRONTEND_DIR, "assets", "images", "favicon.ico")) \
          else ("", 204)

    @app.before_request
    def handle_options():
        if flask_request.method == "OPTIONS":
            response = Response()
            _apply_cors(response)
            _apply_security_headers(response)
            return response, 200

    @app.route("/")
    @app.route("/index.html")
    def serve_login():
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.route("/dashboard.html")
    def serve_dashboard():
        return send_from_directory(FRONTEND_DIR, "dashboard.html")

    @app.route("/assets/<path:filename>")
    def serve_assets(filename):
        return send_from_directory(os.path.join(FRONTEND_DIR, "assets"), filename)

    from routes.audit import audit_bp
    from routes.auth import auth_bp
    from routes.users import users_bp
    from routes.shifts import shifts_bp
    from routes.requests import requests_bp
    from routes.notifications import notifications_bp
    from routes.stats import stats_bp
    from routes.positions import positions_bp
    from routes.departments import departments_bp
    from routes.announcements import announcements_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(shifts_bp, url_prefix="/api/shifts")
    app.register_blueprint(requests_bp, url_prefix="/api/requests")
    app.register_blueprint(notifications_bp, url_prefix="/api/notifications")
    app.register_blueprint(stats_bp, url_prefix="/api/stats")
    app.register_blueprint(positions_bp, url_prefix="/api/positions")
    app.register_blueprint(departments_bp, url_prefix="/api/departments")
    app.register_blueprint(announcements_bp, url_prefix="/api/announcements")
    app.register_blueprint(audit_bp, url_prefix="/api/audit-logs")

    with app.app_context():
        db.create_all()
        _migrate_db()
        _seed_data()

    return app


def _migrate_db():
    """Add columns introduced after initial schema creation."""
    from sqlalchemy import text
    with db.engine.connect() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(requests)"))}
        for col, definition in [("time_from", "TEXT"), ("time_to", "TEXT")]:
            if col not in existing:
                conn.execute(text(f"ALTER TABLE requests ADD COLUMN {col} {definition}"))
        conn.commit()


def _seed_data():
    from models import User
    from werkzeug.security import generate_password_hash

    if User.query.count() == 0:
        email = Config.SEED_MANAGER_EMAIL
        password = Config.SEED_MANAGER_PASSWORD

        if not password:
            password = secrets.token_urlsafe(16)
            logger.warning("SEED_MANAGER_PASSWORD not set — generated a one-time password for the initial manager account.")
            logger.warning("Initial manager login: %s / %s — change this immediately!", email, password)
        else:
            logger.info("Initial manager account created: %s", email)

        db.session.add(User(
            name="Manager",
            email=email,
            password_hash=generate_password_hash(password),
            role="manager",
        ))
        db.session.commit()


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True)
