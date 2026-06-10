from argon2 import PasswordHasher
from app.models.user import Role, User, UserRole
from flask import current_app

ph = PasswordHasher()


def seed_database(db):
    if Role.query.first():
        return  # already seeded

    admin_role = Role(name='Admin', description='System administrator')
    rule_maker_role = Role(name='RuleMaker', description='Can manage rule trees for part numbering')
    user_role = Role(name='User', description='Regular user')
    db.session.add_all([admin_role, rule_maker_role, user_role])
    db.session.flush()

    admin = User(
        username=current_app.config['ADMIN_USERNAME'],
        email=current_app.config['ADMIN_EMAIL'],
        password_hash=ph.hash(current_app.config['ADMIN_PASSWORD']),
        status='active',
    )
    db.session.add(admin)
    db.session.flush()

    db.session.add(UserRole(user_id=admin.id, role_id=admin_role.id))
    db.session.commit()
