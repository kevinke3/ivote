"""SQLAlchemy models for ElectroVote."""
from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

db = SQLAlchemy()


def _utcnow():
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    # For students this is their matric/student number; for admins their staff id.
    identifier = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(160), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="student")  # student | admin
    department = db.Column(db.String(120))
    created_at = db.Column(db.DateTime, default=_utcnow)

    votes = db.relationship("Vote", backref="user", cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @property
    def is_admin(self):
        return self.role == "admin"

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "identifier": self.identifier,
            "email": self.email,
            "role": self.role,
            "department": self.department,
        }


class Election(db.Model):
    __tablename__ = "elections"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text, default="")
    # draft | active | closed
    status = db.Column(db.String(20), nullable=False, default="draft")
    created_at = db.Column(db.DateTime, default=_utcnow)

    candidates = db.relationship(
        "Candidate", backref="election", cascade="all, delete-orphan"
    )
    votes = db.relationship(
        "Vote", backref="election", cascade="all, delete-orphan"
    )

    def to_dict(self, include_candidates=False):
        data = {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "candidate_count": len(self.candidates),
            "vote_count": len(self.votes),
        }
        if include_candidates:
            data["candidates"] = [c.to_dict() for c in self.candidates]
        return data


class Candidate(db.Model):
    __tablename__ = "candidates"

    id = db.Column(db.Integer, primary_key=True)
    election_id = db.Column(
        db.Integer, db.ForeignKey("elections.id"), nullable=False, index=True
    )
    name = db.Column(db.String(120), nullable=False)
    position = db.Column(db.String(120), default="")  # e.g. President, Secretary
    manifesto = db.Column(db.Text, default="")
    photo_url = db.Column(db.String(400), default="")
    created_at = db.Column(db.DateTime, default=_utcnow)

    candidate_votes = db.relationship(
        "Vote", backref="candidate", cascade="all, delete-orphan"
    )

    def to_dict(self, vote_count=None):
        return {
            "id": self.id,
            "election_id": self.election_id,
            "name": self.name,
            "position": self.position,
            "manifesto": self.manifesto,
            "photo_url": self.photo_url,
            "vote_count": vote_count if vote_count is not None else len(self.candidate_votes),
        }


class Vote(db.Model):
    __tablename__ = "votes"
    __table_args__ = (
        # One person, one vote per election.
        db.UniqueConstraint("election_id", "user_id", name="uq_vote_per_election"),
    )

    id = db.Column(db.Integer, primary_key=True)
    election_id = db.Column(
        db.Integer, db.ForeignKey("elections.id"), nullable=False, index=True
    )
    candidate_id = db.Column(
        db.Integer, db.ForeignKey("candidates.id"), nullable=False, index=True
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    created_at = db.Column(db.DateTime, default=_utcnow)
