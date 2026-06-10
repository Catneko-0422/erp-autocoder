from flask import Blueprint, request, current_app, g as flask_g
from marshmallow import Schema, fields, validate, ValidationError

from ...services.auth_service import (
    AuthError, get_pending_users, approve_user, reject_user,
    issue_temp_password, list_users, update_user, delete_user,
    get_audit_logs, get_password_resets, approve_password_reset,
    reject_password_reset,
)
from ...decorators import admin_required
from ...extensions import limiter
from ...utils.helpers import success_response, error_response

admin_bp = Blueprint('admin', __name__)


class UpdateUserSchema(Schema):
    username = fields.String(validate=validate.Length(min=2, max=50))
    email = fields.Email()
    status = fields.String(validate=validate.OneOf(['pending', 'active', 'rejected']))
    roles = fields.List(fields.String())


@admin_bp.before_request
def check_admin_ip():
    remote = request.remote_addr or ''
    config_ips = current_app.config.get('ALLOWED_ADMIN_IPS', '')
    if config_ips:
        allowed_list = [ip.strip() for ip in config_ips.split(',')]
        if remote not in allowed_list:
            return error_response('Not found', 404)


def _serialize_user(u):
    return {
        'id': str(u.id),
        'username': u.username,
        'email': u.email,
        'status': u.status,
        'roles': [r.name for r in u.roles],
        'must_change_password': u.must_change_password,
        'failed_attempts': u.failed_attempts,
        'locked_until': u.locked_until.isoformat() if u.locked_until else None,
        'created_at': u.created_at.isoformat(),
    }


@admin_bp.route('/pending-users', methods=['GET'])
@admin_required
def pending_users():
    users = get_pending_users()
    return success_response({'users': [_serialize_user(u) for u in users]})


@admin_bp.route('/approve-user/<user_id>', methods=['POST'])
@admin_required
def approve_user_route(user_id):
    try:
        approve_user(flask_g.current_user.id, user_id, ip=request.remote_addr)
    except AuthError as e:
        return error_response(e.message, e.status_code)
    return success_response(message='User approved')


@admin_bp.route('/reject-user/<user_id>', methods=['POST'])
@admin_required
def reject_user_route(user_id):
    try:
        reject_user(flask_g.current_user.id, user_id, ip=request.remote_addr)
    except AuthError as e:
        return error_response(e.message, e.status_code)
    return success_response(message='User rejected')


@admin_bp.route('/issue-temp-password/<user_id>', methods=['POST'])
@admin_required
def issue_temp_password_route(user_id):
    try:
        temp_pw = issue_temp_password(
            flask_g.current_user.id, user_id, ip=request.remote_addr,
        )
    except AuthError as e:
        return error_response(e.message, e.status_code)
    return success_response({'temp_password': temp_pw}, 'Temporary password issued')


@admin_bp.route('/users', methods=['GET'])
@admin_required
def users_list():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    per_page = min(per_page, 100)
    result = list_users(page=page, per_page=per_page)
    return success_response({
        'users': [_serialize_user(u) for u in result['users']],
        'total': result['total'],
        'page': result['page'],
        'per_page': result['per_page'],
        'pages': result['pages'],
    })


@admin_bp.route('/users/<user_id>', methods=['PUT'])
@admin_required
def update_user_route(user_id):
    schema = UpdateUserSchema()
    try:
        data = schema.load(request.get_json() or {})
    except ValidationError as err:
        return error_response('Validation error', 422, err.messages)
    try:
        user = update_user(
            flask_g.current_user.id, user_id, data, ip=request.remote_addr,
        )
    except AuthError as e:
        return error_response(e.message, e.status_code)
    return success_response(_serialize_user(user), 'User updated')


@admin_bp.route('/users/<user_id>', methods=['DELETE'])
@admin_required
def delete_user_route(user_id):
    try:
        delete_user(flask_g.current_user.id, user_id, ip=request.remote_addr)
    except AuthError as e:
        return error_response(e.message, e.status_code)
    return success_response(message='User deleted')


@admin_bp.route('/password-resets', methods=['GET'])
@admin_required
def password_resets():
    reqs = get_password_resets()
    return success_response({
        'requests': [
            {
                'id': str(r.id),
                'user_id': str(r.user_id),
                'username': r.user.username if r.user else None,
                'identifier': r.identifier,
                'status': r.status,
                'created_at': r.created_at.isoformat(),
                'handled_at': r.handled_at.isoformat() if r.handled_at else None,
            }
            for r in reqs
        ],
    })


@admin_bp.route('/password-resets/<request_id>/approve', methods=['POST'])
@admin_required
def approve_password_reset_route(request_id):
    try:
        temp_pw = approve_password_reset(
            flask_g.current_user.id, request_id, ip=request.remote_addr,
        )
    except AuthError as e:
        return error_response(e.message, e.status_code)
    return success_response({'temp_password': temp_pw}, 'Password reset approved')


@admin_bp.route('/password-resets/<request_id>/reject', methods=['POST'])
@admin_required
def reject_password_reset_route(request_id):
    try:
        reject_password_reset(
            flask_g.current_user.id, request_id, ip=request.remote_addr,
        )
    except AuthError as e:
        return error_response(e.message, e.status_code)
    return success_response(message='Password reset rejected')


@admin_bp.route('/audit-logs', methods=['GET'])
@admin_required
def audit_logs():
    logs = get_audit_logs()
    return success_response({
        'logs': [
            {
                'id': str(log.id),
                'actor_id': str(log.actor_id) if log.actor_id else None,
                'target_user_id': str(log.target_user_id) if log.target_user_id else None,
                'action': log.action,
                'ip_address': log.ip_address,
                'details': log.details,
                'created_at': log.created_at.isoformat(),
            }
            for log in logs
        ],
    })
