"""ElectroVote — Flask application factory, JSON API and static frontend server."""
import os
from functools import wraps

from flask import (
    Flask,
    jsonify,
    request,
    send_from_directory,
    session,
)
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from .models import Candidate, Election, User, Vote, db

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")
INSTANCE_DIR = os.path.join(PROJECT_ROOT, "instance")


def create_app(test_config=None):
    app = Flask(__name__, static_folder=None, instance_path=INSTANCE_DIR)
    os.makedirs(app.instance_path, exist_ok=True)

    db_path = os.path.join(app.instance_path, "electrovote.db")
    app.config.update(
        SECRET_KEY=os.environ.get("ELECTROVOTE_SECRET", "dev-electrovote-secret"),
        SQLALCHEMY_DATABASE_URI=f"sqlite:///{db_path}",
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
    )
    if test_config:
        app.config.update(test_config)

    db.init_app(app)

    with app.app_context():
        db.create_all()
        _ensure_default_admin()

    register_routes(app)
    return app


def _ensure_default_admin():
    """Create a default admin so the dashboard is reachable out of the box."""
    if User.query.filter_by(role="admin").first():
        return
    admin = User(
        name="System Administrator",
        identifier="admin",
        email="admin@electrovote.edu",
        role="admin",
        department="Electoral Commission",
    )
    admin.set_password("admin123")
    db.session.add(admin)
    db.session.commit()


# --------------------------------------------------------------------------- #
# Auth helpers
# --------------------------------------------------------------------------- #
def current_user():
    uid = session.get("user_id")
    if not uid:
        return None
    return db.session.get(User, uid)


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not current_user():
            return jsonify({"error": "Authentication required"}), 401
        return fn(*args, **kwargs)

    return wrapper


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        if not user.is_admin:
            return jsonify({"error": "Administrator access required"}), 403
        return fn(*args, **kwargs)

    return wrapper


def register_routes(app):  # noqa: C901 - cohesive route registration
    # ----------------------------------------------------------------- #
    # Auth
    # ----------------------------------------------------------------- #
    @app.post("/api/register")
    def register():
        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        identifier = (data.get("identifier") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        department = (data.get("department") or "").strip()

        if not all([name, identifier, email, password]):
            return jsonify({"error": "All fields are required"}), 400
        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters"}), 400

        if User.query.filter(
            (User.identifier == identifier) | (User.email == email)
        ).first():
            return jsonify({"error": "Student ID or email already registered"}), 409

        user = User(
            name=name,
            identifier=identifier,
            email=email,
            role="student",
            department=department,
        )
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        session["user_id"] = user.id
        return jsonify(user.to_dict()), 201

    @app.post("/api/login")
    def login():
        data = request.get_json(silent=True) or {}
        identifier = (data.get("identifier") or "").strip()
        password = data.get("password") or ""

        user = User.query.filter(
            (User.identifier == identifier) | (User.email == identifier.lower())
        ).first()
        if not user or not user.check_password(password):
            return jsonify({"error": "Invalid credentials"}), 401

        session["user_id"] = user.id
        return jsonify(user.to_dict())

    @app.post("/api/logout")
    def logout():
        session.clear()
        return jsonify({"ok": True})

    @app.get("/api/me")
    def me():
        user = current_user()
        if not user:
            return jsonify({"user": None})
        return jsonify({"user": user.to_dict()})

    # ----------------------------------------------------------------- #
    # Elections (read)
    # ----------------------------------------------------------------- #
    @app.get("/api/elections")
    def list_elections():
        query = Election.query.order_by(Election.created_at.desc())
        status = request.args.get("status")
        if status:
            query = query.filter_by(status=status)
        return jsonify([e.to_dict() for e in query.all()])

    @app.get("/api/elections/<int:election_id>")
    def get_election(election_id):
        election = db.session.get(Election, election_id)
        if not election:
            return jsonify({"error": "Election not found"}), 404
        data = election.to_dict(include_candidates=True)
        user = current_user()
        data["has_voted"] = _has_voted(user, election) if user else False
        return jsonify(data)

    # ----------------------------------------------------------------- #
    # Elections (admin write)
    # ----------------------------------------------------------------- #
    @app.post("/api/elections")
    @admin_required
    def create_election():
        data = request.get_json(silent=True) or {}
        title = (data.get("title") or "").strip()
        if not title:
            return jsonify({"error": "Title is required"}), 400
        election = Election(
            title=title,
            description=(data.get("description") or "").strip(),
            status=data.get("status") if data.get("status") in {"draft", "active", "closed"} else "draft",
        )
        db.session.add(election)
        db.session.commit()
        return jsonify(election.to_dict(include_candidates=True)), 201

    @app.put("/api/elections/<int:election_id>")
    @admin_required
    def update_election(election_id):
        election = db.session.get(Election, election_id)
        if not election:
            return jsonify({"error": "Election not found"}), 404
        data = request.get_json(silent=True) or {}
        if "title" in data and data["title"].strip():
            election.title = data["title"].strip()
        if "description" in data:
            election.description = (data["description"] or "").strip()
        if "status" in data and data["status"] in {"draft", "active", "closed"}:
            election.status = data["status"]
        db.session.commit()
        return jsonify(election.to_dict(include_candidates=True))

    @app.delete("/api/elections/<int:election_id>")
    @admin_required
    def delete_election(election_id):
        election = db.session.get(Election, election_id)
        if not election:
            return jsonify({"error": "Election not found"}), 404
        db.session.delete(election)
        db.session.commit()
        return jsonify({"ok": True})

    # ----------------------------------------------------------------- #
    # Candidates (admin write)
    # ----------------------------------------------------------------- #
    @app.post("/api/elections/<int:election_id>/candidates")
    @admin_required
    def add_candidate(election_id):
        election = db.session.get(Election, election_id)
        if not election:
            return jsonify({"error": "Election not found"}), 404
        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Candidate name is required"}), 400
        candidate = Candidate(
            election_id=election.id,
            name=name,
            position=(data.get("position") or "").strip(),
            manifesto=(data.get("manifesto") or "").strip(),
            photo_url=(data.get("photo_url") or "").strip(),
        )
        db.session.add(candidate)
        db.session.commit()
        return jsonify(candidate.to_dict()), 201

    @app.put("/api/candidates/<int:candidate_id>")
    @admin_required
    def update_candidate(candidate_id):
        candidate = db.session.get(Candidate, candidate_id)
        if not candidate:
            return jsonify({"error": "Candidate not found"}), 404
        data = request.get_json(silent=True) or {}
        if "name" in data and data["name"].strip():
            candidate.name = data["name"].strip()
        if "position" in data:
            candidate.position = (data["position"] or "").strip()
        if "manifesto" in data:
            candidate.manifesto = (data["manifesto"] or "").strip()
        if "photo_url" in data:
            candidate.photo_url = (data["photo_url"] or "").strip()
        db.session.commit()
        return jsonify(candidate.to_dict())

    @app.delete("/api/candidates/<int:candidate_id>")
    @admin_required
    def delete_candidate(candidate_id):
        candidate = db.session.get(Candidate, candidate_id)
        if not candidate:
            return jsonify({"error": "Candidate not found"}), 404
        db.session.delete(candidate)
        db.session.commit()
        return jsonify({"ok": True})

    # ----------------------------------------------------------------- #
    # Voting
    # ----------------------------------------------------------------- #
    @app.post("/api/elections/<int:election_id>/vote")
    @login_required
    def cast_vote(election_id):
        user = current_user()
        if user.is_admin:
            return jsonify({"error": "Administrators cannot cast votes"}), 403

        election = db.session.get(Election, election_id)
        if not election:
            return jsonify({"error": "Election not found"}), 404
        if election.status != "active":
            return jsonify({"error": "This election is not open for voting"}), 400

        data = request.get_json(silent=True) or {}
        candidate_id = data.get("candidate_id")
        candidate = db.session.get(Candidate, candidate_id) if candidate_id else None
        if not candidate or candidate.election_id != election.id:
            return jsonify({"error": "Invalid candidate selection"}), 400

        if _has_voted(user, election):
            return jsonify({"error": "You have already voted in this election"}), 409

        vote = Vote(
            election_id=election.id,
            candidate_id=candidate.id,
            user_id=user.id,
        )
        db.session.add(vote)
        try:
            db.session.commit()
        except IntegrityError:
            # Race-condition guard: the unique constraint enforces one-person-one-vote.
            db.session.rollback()
            return jsonify({"error": "You have already voted in this election"}), 409

        return jsonify({"ok": True, "message": "Your vote has been recorded"}), 201

    @app.get("/api/elections/<int:election_id>/results")
    def election_results(election_id):
        election = db.session.get(Election, election_id)
        if not election:
            return jsonify({"error": "Election not found"}), 404

        counts = dict(
            db.session.query(Vote.candidate_id, func.count(Vote.id))
            .filter(Vote.election_id == election.id)
            .group_by(Vote.candidate_id)
            .all()
        )
        total = sum(counts.values())
        candidates = []
        for c in election.candidates:
            votes = counts.get(c.id, 0)
            candidates.append(
                {
                    **c.to_dict(vote_count=votes),
                    "percentage": round((votes / total) * 100, 1) if total else 0,
                }
            )
        candidates.sort(key=lambda c: c["vote_count"], reverse=True)
        return jsonify(
            {
                "election": election.to_dict(),
                "total_votes": total,
                "candidates": candidates,
            }
        )

    # ----------------------------------------------------------------- #
    # Admin dashboard stats
    # ----------------------------------------------------------------- #
    @app.get("/api/admin/stats")
    @admin_required
    def admin_stats():
        return jsonify(
            {
                "students": User.query.filter_by(role="student").count(),
                "elections": Election.query.count(),
                "active_elections": Election.query.filter_by(status="active").count(),
                "total_votes": Vote.query.count(),
            }
        )

    # ----------------------------------------------------------------- #
    # Static frontend
    # ----------------------------------------------------------------- #
    @app.get("/")
    def index():
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.get("/<path:path>")
    def static_files(path):
        full = os.path.join(FRONTEND_DIR, path)
        if os.path.isfile(full):
            return send_from_directory(FRONTEND_DIR, path)
        # SPA-style fallback for clean page routes (e.g. /dashboard).
        candidate = os.path.join(FRONTEND_DIR, path + ".html")
        if os.path.isfile(candidate):
            return send_from_directory(FRONTEND_DIR, path + ".html")
        return send_from_directory(FRONTEND_DIR, "index.html")


def _has_voted(user, election):
    if not user:
        return False
    return (
        Vote.query.filter_by(election_id=election.id, user_id=user.id).first()
        is not None
    )


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
