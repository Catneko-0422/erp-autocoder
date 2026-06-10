import uuid
from functools import wraps
from flask import request, g
from ..services.auth_service import decode_token, AuthError
from ..models.user import User
from ..utils.helpers import error_response


def jwt_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return error_response('Missing or invalid Authorization header', 401)

        token = auth.split(' ', 1)[1]
        try:
            payload = decode_token(token)
            try:
                user = User.query.get(uuid.UUID(payload['sub']))
            except (ValueError, AttributeError):
                return error_response('Invalid token payload', 401)
            if not user or user.status != 'active':
                return error_response('User not found or inactive', 401)
            g.current_user = user
            g.current_role = payload.get('role', 'User')
        except AuthError as e:
            return error_response(e.message, e.status_code)

        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    @wraps(f)
    @jwt_required
    def decorated(*args, **kwargs):
        if g.current_role != 'Admin':
            return error_response('Not found', 404)
        return f(*args, **kwargs)
    return decorated


def rule_maker_required(f):
    @wraps(f)
    @jwt_required
    def decorated(*args, **kwargs):
        if g.current_role not in ('Admin', 'RuleMaker'):
            return error_response('Not found', 404)
        return f(*args, **kwargs)
    return decorated


def optional_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        if auth.startswith('Bearer '):
            token = auth.split(' ', 1)[1]
            try:
                payload = decode_token(token)
                user = User.query.get(uuid.UUID(payload['sub']))
                if user and user.status == 'active':
                    g.current_user = user
                    g.current_role = payload.get('role', 'User')
            except AuthError:
                pass
        return f(*args, **kwargs)
    return decorated
