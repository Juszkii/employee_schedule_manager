import os

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-to-something-secure")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "jwt-change-me")
    SQLALCHEMY_DATABASE_URI = "sqlite:///schedule.db"
    SQLALCHEMY_TRACK_MODIFICATIONS = False