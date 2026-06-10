from flask import jsonify


def success_response(data=None, message=None, status=200):
    body = {'success': True}
    if data is not None:
        body['data'] = data
    if message:
        body['message'] = message
    return jsonify(body), status


def error_response(message, status=400, errors=None):
    body = {'success': False, 'message': message}
    if errors:
        body['errors'] = errors
    return jsonify(body), status
