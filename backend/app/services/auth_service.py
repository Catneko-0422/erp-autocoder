import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from flask import current_app

from ..extensions import db
from ..models.user import User, Role, UserRole, AuditLog, PasswordResetRequest

ph = PasswordHasher()


class AuthError(Exception):
    def __init__(self, message, status_code=400):
        self.message = message
        self.status_code = status_code


def _now():
    return datetime.now(timezone.utc)


def _encode_token(user_id, role_name, expires_delta):
    payload = {
        'sub': str(user_id),
        'role': role_name,
        'iat': _now(),
        'exp': _now() + timedelta(seconds=expires_delta),
    }
    return jwt.encode(payload, current_app.config['JWT_SECRET'], algorithm='HS256')


def decode_token(token):
    try:
        payload = jwt.decode(
            token, current_app.config['JWT_SECRET'], algorithms=['HS256'],
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthError('Token expired', 401)
    except jwt.InvalidTokenError:
        raise AuthError('Invalid token', 401)


def register(username, email, password, ip=None):
    if User.query.filter_by(username=username).first():
        raise AuthError('Username already exists')
    if User.query.filter_by(email=email).first():
        raise AuthError('Email already exists')

    if len(password) < 8:
        raise AuthError('Password must be at least 8 characters')

    user = User(
        username=username,
        email=email,
        password_hash=ph.hash(password),
        status='pending',
    )
    db.session.add(user)
    db.session.flush()

    user_role = Role.query.filter_by(name='User').first()
    if user_role:
        db.session.add(UserRole(user_id=user.id, role_id=user_role.id))

    db.session.add(AuditLog(
        actor_id=user.id,
        target_user_id=user.id,
        action='register',
        ip_address=ip,
        details={'username': username, 'email': email},
    ))
    db.session.commit()
    return user


_INVALID_CREDENTIALS = '帳號或密碼錯誤'


def login(identifier, password, ip=None):
    user = User.query.filter(
        (User.username == identifier) | (User.email == identifier),
    ).first()

    if not user:
        raise AuthError(_INVALID_CREDENTIALS, 401)

    action_detail = None
    if user.status == 'rejected':
        action_detail = 'rejected'
    elif user.status == 'pending':
        action_detail = 'pending'
    elif user.locked_until and _now() < user.locked_until:
        action_detail = 'locked'

    if action_detail:
        db.session.add(AuditLog(
            target_user_id=user.id,
            action=f'login_blocked_{action_detail}',
            ip_address=ip,
        ))
        db.session.commit()
        raise AuthError(_INVALID_CREDENTIALS, 401)

    try:
        ph.verify(user.password_hash, password)
        if ph.check_needs_rehash(user.password_hash):
            user.password_hash = ph.hash(password)
    except Exception:
        user.failed_attempts += 1
        if user.failed_attempts >= current_app.config['MAX_LOGIN_ATTEMPTS']:
            user.locked_until = _now() + timedelta(
                minutes=current_app.config['LOCKOUT_MINUTES'],
            )
        db.session.commit()

        db.session.add(AuditLog(
            target_user_id=user.id,
            action='login_failed',
            ip_address=ip,
            details={'attempt': user.failed_attempts},
        ))
        db.session.commit()
        raise AuthError(_INVALID_CREDENTIALS, 401)

    user.failed_attempts = 0
    user.locked_until = None
    role_name = user.roles[0].name if user.roles else 'User'

    access_token = _encode_token(user.id, role_name, current_app.config['JWT_ACCESS_EXPIRES'])
    refresh_token = _encode_token(user.id, role_name, current_app.config['JWT_REFRESH_EXPIRES'])

    db.session.add(AuditLog(
        actor_id=user.id,
        target_user_id=user.id,
        action='login',
        ip_address=ip,
    ))
    db.session.commit()

    role_names = [r.name for r in user.roles]
    return {
        'user': {
            'id': str(user.id),
            'username': user.username,
            'email': user.email,
            'role': role_name,
            'roles': role_names,
            'must_change_password': user.must_change_password,
            'status': user.status,
        },
        'access_token': access_token,
        'refresh_token': refresh_token,
    }


def refresh(refresh_token, ip=None):
    payload = decode_token(refresh_token)
    try:
        user = db.session.get(User, uuid.UUID(payload['sub']))
    except (ValueError, AttributeError):
        raise AuthError('Invalid token', 401)
    if not user or user.status != 'active':
        raise AuthError('Invalid token', 401)

    role_name = user.roles[0].name if user.roles else 'User'
    new_access = _encode_token(user.id, role_name, current_app.config['JWT_ACCESS_EXPIRES'])
    return {'access_token': new_access}


def change_password(user_id, old_password, new_password):
    user = db.session.get(User, user_id)
    if not user:
        raise AuthError('User not found', 404)

    try:
        ph.verify(user.password_hash, old_password)
    except Exception:
        raise AuthError('Current password is incorrect', 401)

    if len(new_password) < 8:
        raise AuthError('New password must be at least 8 characters')

    user.password_hash = ph.hash(new_password)
    user.must_change_password = False
    db.session.add(AuditLog(
        actor_id=user.id,
        target_user_id=user.id,
        action='change_password',
    ))
    db.session.commit()


def issue_temp_password(admin_id, target_user_id, ip=None):
    user = db.session.get(User, target_user_id)
    if not user:
        raise AuthError('User not found', 404)

    import secrets
    import string
    temp_pw = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))

    user.password_hash = ph.hash(temp_pw)
    user.must_change_password = True
    user.failed_attempts = 0
    user.locked_until = None
    user.status = 'active'

    db.session.add(AuditLog(
        actor_id=admin_id,
        target_user_id=user.id,
        action='issue_temp_password',
        ip_address=ip,
    ))
    db.session.commit()

    return temp_pw


def get_pending_users():
    return User.query.filter_by(status='pending').all()


def approve_user(admin_id, target_user_id, ip=None):
    user = db.session.get(User, target_user_id)
    if not user:
        raise AuthError('User not found', 404)
    if user.status != 'pending':
        raise AuthError('User is not in pending status', 400)

    user.status = 'active'
    db.session.add(AuditLog(
        actor_id=admin_id,
        target_user_id=user.id,
        action='approve_user',
        ip_address=ip,
    ))
    db.session.commit()


def reject_user(admin_id, target_user_id, ip=None):
    user = db.session.get(User, target_user_id)
    if not user:
        raise AuthError('User not found', 404)
    if user.status != 'pending':
        raise AuthError('User is not in pending status', 400)

    user.status = 'rejected'
    db.session.add(AuditLog(
        actor_id=admin_id,
        target_user_id=user.id,
        action='reject_user',
        ip_address=ip,
    ))
    db.session.commit()


def list_users(page=1, per_page=20):
    pagination = User.query.order_by(User.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False,
    )
    return {
        'users': pagination.items,
        'total': pagination.total,
        'page': pagination.page,
        'per_page': pagination.per_page,
        'pages': pagination.pages,
    }


def update_user(admin_id, target_user_id, data, ip=None):
    user = db.session.get(User, target_user_id)
    if not user:
        raise AuthError('User not found', 404)

    is_self = str(user.id) == str(admin_id)

    username = data.get('username')
    email = data.get('email')
    role_name = data.get('role')

    if username and username != user.username:
        if User.query.filter_by(username=username).first():
            raise AuthError('Username already exists')
        user.username = username

    if email and email != user.email:
        if User.query.filter_by(email=email).first():
            raise AuthError('Email already exists')
        user.email = email

    if role_name:
        if is_self:
            raise AuthError('無法變更自己的角色', 400)
        role = Role.query.filter_by(name=role_name).first()
        if not role:
            raise AuthError('Role not found', 400)
        user_role = UserRole.query.filter_by(user_id=user.id).first()
        if user_role:
            user_role.role_id = role.id
        else:
            db.session.add(UserRole(user_id=user.id, role_id=role.id))

    if is_self:
        action = 'update_self'
    else:
        action = 'update_user'

    db.session.add(AuditLog(
        actor_id=admin_id,
        target_user_id=user.id,
        action=action,
        ip_address=ip,
        details=data,
    ))
    db.session.commit()
    return user


def delete_user(admin_id, target_user_id, ip=None):
    user = db.session.get(User, target_user_id)
    if not user:
        raise AuthError('User not found', 404)
    if str(user.id) == str(admin_id):
        raise AuthError('Cannot delete yourself', 400)

    db.session.add(AuditLog(
        actor_id=admin_id,
        target_user_id=user.id,
        action='delete_user',
        ip_address=ip,
    ))
    UserRole.query.filter_by(user_id=user.id).delete()
    AuditLog.query.filter(
        (AuditLog.actor_id == user.id) | (AuditLog.target_user_id == user.id),
    ).update(
        {AuditLog.actor_id: None, AuditLog.target_user_id: None},
        synchronize_session=False,
    )
    db.session.delete(user)
    db.session.commit()


def forgot_password(identifier, ip=None):
    user = User.query.filter(
        (User.username == identifier) | (User.email == identifier),
    ).first()
    if user:
        db.session.add(PasswordResetRequest(
            user_id=user.id,
            identifier=identifier,
        ))
        db.session.add(AuditLog(
            target_user_id=user.id,
            action='forgot_password_request',
            ip_address=ip,
            details={'identifier': identifier},
        ))
        db.session.commit()


def get_password_resets():
    return PasswordResetRequest.query.order_by(
        PasswordResetRequest.created_at.desc(),
    ).all()


def approve_password_reset(admin_id, request_id, ip=None):
    req = db.session.get(PasswordResetRequest, request_id)
    if not req or req.status != 'pending':
        raise AuthError('Request not found or already handled', 400)
    user = db.session.get(User, req.user_id)
    if not user:
        raise AuthError('User not found', 404)

    temp_pw = secrets.token_urlsafe(12)
    user.password_hash = ph.hash(temp_pw)
    user.must_change_password = True
    user.failed_attempts = 0
    user.locked_until = None

    req.status = 'approved'
    req.handled_by = admin_id
    req.handled_at = _now()
    req.temp_password = ph.hash(temp_pw)

    db.session.add(AuditLog(
        actor_id=admin_id,
        target_user_id=user.id,
        action='forgot_password_approved',
        ip_address=ip,
        details={'request_id': str(req.id)},
    ))
    db.session.commit()
    return temp_pw


def reject_password_reset(admin_id, request_id, ip=None):
    req = db.session.get(PasswordResetRequest, request_id)
    if not req or req.status != 'pending':
        raise AuthError('Request not found or already handled', 400)

    req.status = 'rejected'
    req.handled_by = admin_id
    req.handled_at = _now()

    db.session.add(AuditLog(
        actor_id=admin_id,
        target_user_id=req.user_id,
        action='forgot_password_rejected',
        ip_address=ip,
        details={'request_id': str(req.id)},
    ))
    db.session.commit()


def get_audit_logs():
    return AuditLog.query.order_by(AuditLog.created_at.desc()).limit(100).all()
