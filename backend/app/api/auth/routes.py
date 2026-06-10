from flask import Blueprint, request, g
from marshmallow import Schema, fields, validate, ValidationError

from ...services.auth_service import AuthError, register, login, refresh, change_password, forgot_password
from ...decorators import jwt_required
from ...extensions import limiter
from ...utils.helpers import success_response, error_response

auth_bp = Blueprint('auth', __name__)


class RegisterSchema(Schema):
    username = fields.String(required=True, validate=validate.Length(min=2, max=50))
    email = fields.Email(required=True)
    password = fields.String(required=True, validate=validate.Length(min=8))


class LoginSchema(Schema):
    identifier = fields.String(required=True)
    password = fields.String(required=True)


class RefreshSchema(Schema):
    refresh_token = fields.String(required=True)


class ChangePasswordSchema(Schema):
    old_password = fields.String(required=True)
    new_password = fields.String(required=True, validate=validate.Length(min=8))


@auth_bp.route('/register', methods=['POST'])
@limiter.limit("3 per hour")
def register_route():
    schema = RegisterSchema()
    try:
        data = schema.load(request.get_json() or {})
    except ValidationError as err:
        return error_response('Validation error', 422, err.messages)

    try:
        user = register(data['username'], data['email'], data['password'], ip=request.remote_addr)
    except AuthError as e:
        return error_response(e.message, e.status_code)

    return success_response(
        {'id': str(user.id), 'username': user.username, 'email': user.email, 'status': user.status},
        'Registration submitted. Awaiting admin approval.',
        201,
    )


@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute; 100 per hour")
def login_route():
    schema = LoginSchema()
    try:
        data = schema.load(request.get_json() or {})
    except ValidationError as err:
        return error_response('Validation error', 422, err.messages)

    try:
        result = login(data['identifier'], data['password'], ip=request.remote_addr)
    except AuthError as e:
        return error_response(e.message, e.status_code)

    return success_response(result, 'Login successful')


@auth_bp.route('/refresh', methods=['POST'])
def refresh_route():
    schema = RefreshSchema()
    try:
        data = schema.load(request.get_json() or {})
    except ValidationError as err:
        return error_response('Validation error', 422, err.messages)

    try:
        result = refresh(data['refresh_token'], ip=request.remote_addr)
    except AuthError as e:
        return error_response(e.message, e.status_code)

    return success_response(result, 'Token refreshed')


@auth_bp.route('/change-password', methods=['POST'])
@jwt_required
def change_password_route():
    schema = ChangePasswordSchema()
    try:
        data = schema.load(request.get_json() or {})
    except ValidationError as err:
        return error_response('Validation error', 422, err.messages)

    try:
        change_password(g.current_user.id, data['old_password'], data['new_password'])
    except AuthError as e:
        return error_response(e.message, e.status_code)

    return success_response(message='Password changed successfully')


@auth_bp.route('/forgot-password', methods=['POST'])
@limiter.limit("3 per hour")
def forgot_password_route():
    data = request.get_json() or {}
    identifier = data.get('identifier', '').strip()
    if not identifier:
        return error_response('請輸入帳號或 Email', 422)
    forgot_password(identifier, ip=request.remote_addr)
    return success_response(message='若該帳號存在，管理員將收到通知。請稍後再試或聯絡管理員。')


@auth_bp.route('/me', methods=['GET'])
@jwt_required
def me():
    user = g.current_user
    role_names = [r.name for r in user.roles]
    return success_response({
        'id': str(user.id),
        'username': user.username,
        'email': user.email,
        'role': role_names[0] if role_names else 'User',
        'roles': role_names,
        'must_change_password': user.must_change_password,
        'status': user.status,
        'created_at': user.created_at.isoformat(),
    })
