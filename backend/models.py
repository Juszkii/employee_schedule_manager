from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy


def _utcnow():
    return datetime.now(timezone.utc)

db = SQLAlchemy()

class Department(db.Model):
    __tablename__ = "departments"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), nullable=False, unique=True)
    color = db.Column(db.String(7), nullable=False, default="#3B82F6")

    users = db.relationship("User", back_populates="department")

    def to_dict(self):
        return {"id": self.id, "name": self.name, "color": self.color}


class Label(db.Model):
    __tablename__ = "labels"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), nullable=False, unique=True)
    color = db.Column(db.String(7), nullable=False, default="#3B82F6")

    users = db.relationship("User", back_populates="label")

    def to_dict(self):
        return {"id": self.id, "name": self.name, "color": self.color}


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    email = db.Column(db.String(128), nullable=False, unique=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(16), nullable=False, default="employee")
    phone = db.Column(db.String(32), nullable=True)
    label_id = db.Column(db.Integer, db.ForeignKey("labels.id"), nullable=True)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=_utcnow)

    label = db.relationship("Label", back_populates="users")
    department = db.relationship("Department", back_populates="users")
    shifts = db.relationship("Shift", back_populates="user", cascade="all, delete-orphan")
    requests = db.relationship("Request", back_populates="user", cascade="all, delete-orphan")
    notifications = db.relationship("Notification", back_populates="user", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "phone": self.phone,
            "label": self.label.to_dict() if self.label else None,
            "department_id": self.department_id,
            "department": self.department.to_dict() if self.department else None,
            "created_at": self.created_at.isoformat(),
        }


class Position(db.Model):
    __tablename__ = "positions"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), nullable=False, unique=True)
    color = db.Column(db.String(7), nullable=False, default="#6C63FF")

    def to_dict(self):
        return {"id": self.id, "name": self.name, "color": self.color}


class Shift(db.Model):
    __tablename__ = "shifts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    position_id = db.Column(db.Integer, db.ForeignKey("positions.id"), nullable=True)
    date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    note = db.Column(db.String(256), nullable=True)

    user = db.relationship("User", back_populates="shifts")
    position = db.relationship("Position")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_name": self.user.name,
            "position_id": self.position_id,
            "position": self.position.to_dict() if self.position else None,
            "date": self.date.isoformat(),
            "start_time": self.start_time.strftime("%H:%M"),
            "end_time": self.end_time.strftime("%H:%M"),
            "note": self.note,
        }


class Announcement(db.Model):
    __tablename__ = "announcements"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(128), nullable=False)
    content = db.Column(db.Text, nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=_utcnow)

    department = db.relationship("Department")
    author = db.relationship("User", foreign_keys=[created_by])

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "department_id": self.department_id,
            "department": self.department.to_dict() if self.department else None,
            "author_name": self.author.name if self.author else "Unknown",
            "created_at": self.created_at.isoformat(),
        }


class AnnouncementRead(db.Model):
    __tablename__ = "announcement_reads"

    id = db.Column(db.Integer, primary_key=True)
    announcement_id = db.Column(db.Integer, db.ForeignKey("announcements.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    read_at = db.Column(db.DateTime, default=_utcnow)

    __table_args__ = (db.UniqueConstraint("announcement_id", "user_id"),)

    reader = db.relationship("User", foreign_keys=[user_id])


class Request(db.Model):
    __tablename__ = "requests"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    type = db.Column(db.String(32), nullable=False)
    date_from = db.Column(db.Date, nullable=False)
    date_to = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(16), default="pending")
    message = db.Column(db.String(512), nullable=True)
    time_from = db.Column(db.String(5), nullable=True)
    time_to = db.Column(db.String(5), nullable=True)
    created_at = db.Column(db.DateTime, default=_utcnow)

    user = db.relationship("User", back_populates="requests")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_name": self.user.name,
            "type": self.type,
            "date_from": self.date_from.isoformat(),
            "date_to": self.date_to.isoformat(),
            "status": self.status,
            "message": self.message,
            "time_from": self.time_from,
            "time_to": self.time_to,
            "created_at": self.created_at.isoformat(),
        }


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    action = db.Column(db.String(64), nullable=False)
    resource_id = db.Column(db.Integer, nullable=True)
    details = db.Column(db.Text, nullable=True)
    ip = db.Column(db.String(45), nullable=True)
    created_at = db.Column(db.DateTime, default=_utcnow, nullable=False)

    actor = db.relationship("User", foreign_keys=[user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "actor": self.actor.name if self.actor else "system",
            "action": self.action,
            "resource_id": self.resource_id,
            "details": self.details,
            "ip": self.ip,
            "created_at": self.created_at.isoformat(),
        }


class LoginAttempt(db.Model):
    __tablename__ = "login_attempts"

    id = db.Column(db.Integer, primary_key=True)
    ip = db.Column(db.String(45), nullable=False, index=True)
    attempted_at = db.Column(db.DateTime, default=_utcnow, nullable=False)


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    message = db.Column(db.String(512), nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=_utcnow)

    user = db.relationship("User", back_populates="notifications")

    def to_dict(self):
        return {
            "id": self.id,
            "message": self.message,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat(),
        }