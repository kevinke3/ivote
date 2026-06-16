"""Seed ElectroVote with demo students, elections and candidates.

Run with:  python -m backend.seed
"""
from .app import create_app
from .models import Candidate, Election, User, Vote, db


STUDENTS = [
    ("Amara Okafor", "STU1001", "amara@uni.edu", "Computer Science"),
    ("Liam Chen", "STU1002", "liam@uni.edu", "Electrical Engineering"),
    ("Sofia Martins", "STU1003", "sofia@uni.edu", "Business Administration"),
    ("Noah Williams", "STU1004", "noah@uni.edu", "Law"),
    ("Aisha Bello", "STU1005", "aisha@uni.edu", "Medicine"),
]

ELECTIONS = [
    {
        "title": "Students' Union President 2025",
        "description": "Choose the next president to lead the Students' Union for the 2025/2026 academic session.",
        "status": "active",
        "candidates": [
            ("Grace Adeyemi", "President", "Transparency, better hostels, and 24/7 study spaces."),
            ("David Mensah", "President", "Affordable transport, mental-health support, and tech hubs."),
            ("Fatima Yusuf", "President", "Inclusive campus, sports funding, and career fairs."),
        ],
    },
    {
        "title": "Faculty of Science Representative",
        "description": "Elect the representative who will champion science students at the senate.",
        "status": "active",
        "candidates": [
            ("Kwame Asante", "Representative", "Modern labs, research grants, and peer tutoring."),
            ("Lola Ibrahim", "Representative", "More electives, flexible exams, and study materials."),
        ],
    },
    {
        "title": "Sports Director 2024 (Concluded)",
        "description": "Past election for the campus sports directorate.",
        "status": "closed",
        "candidates": [
            ("Tunde Balogun", "Sports Director", "Inter-faculty leagues and new gym equipment."),
            ("Mary Johnson", "Sports Director", "Women in sports and scholarship athletes."),
        ],
    },
]


def run():
    app = create_app()
    with app.app_context():
        # Reset domain tables (keep it idempotent for demos).
        Vote.query.delete()
        Candidate.query.delete()
        Election.query.delete()
        User.query.filter_by(role="student").delete()
        db.session.commit()

        students = []
        for name, identifier, email, dept in STUDENTS:
            s = User(name=name, identifier=identifier, email=email,
                     role="student", department=dept)
            s.set_password("password123")
            db.session.add(s)
            students.append(s)
        db.session.commit()

        created_candidates = []
        for spec in ELECTIONS:
            election = Election(
                title=spec["title"],
                description=spec["description"],
                status=spec["status"],
            )
            db.session.add(election)
            db.session.flush()
            for cname, position, manifesto in spec["candidates"]:
                c = Candidate(
                    election_id=election.id,
                    name=cname,
                    position=position,
                    manifesto=manifesto,
                )
                db.session.add(c)
                created_candidates.append((election, c))
        db.session.commit()

        # Add some sample votes to the concluded election for nice results.
        closed = Election.query.filter_by(status="closed").first()
        if closed and closed.candidates:
            winner = closed.candidates[0]
            for i, student in enumerate(students):
                target = winner if i % 3 != 0 else closed.candidates[-1]
                db.session.add(
                    Vote(election_id=closed.id, candidate_id=target.id, user_id=student.id)
                )
            db.session.commit()

        print("Seed complete.")
        print("  Admin login -> identifier: admin / password: admin123")
        print("  Student login -> identifier: STU1001 / password: password123")


if __name__ == "__main__":
    run()
