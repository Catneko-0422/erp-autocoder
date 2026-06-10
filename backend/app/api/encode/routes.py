from flask import Blueprint, request, g
from marshmallow import Schema, fields, validate, ValidationError

from ...decorators import jwt_required
from ...models.part_number import PartNumber
from ...extensions import db
from ...utils.helpers import success_response, error_response

encode_bp = Blueprint('encode', __name__)


class EncodeSchema(Schema):
    part_no = fields.String(required=True, validate=validate.Length(min=1, max=100))
    design_no = fields.String(allow_none=True)
    qpa = fields.Float(allow_none=True)
    part_type = fields.String(allow_none=True)
    description = fields.String(allow_none=True)
    mfg_part = fields.String(allow_none=True)
    vendor_pn = fields.String(allow_none=True)
    item_text = fields.String(allow_none=True)


@encode_bp.route('', methods=['POST'])
@jwt_required
def encode():
    schema = EncodeSchema()
    try:
        data = schema.load(request.get_json() or {})
    except ValidationError as err:
        return error_response('Validation error', 422, err.messages)

    part_no = data['part_no']
    existing = PartNumber.query.filter_by(part_no=part_no).first()
    if existing:
        return error_response(f'Part number {part_no} already exists', 409)

    pn = PartNumber(
        part_no=part_no,
        design_no=data.get('design_no'),
        qpa=data.get('qpa'),
        part_type=data.get('part_type'),
        description=data.get('description'),
        mfg_part=data.get('mfg_part'),
        vendor_pn=data.get('vendor_pn'),
        item_text=data.get('item_text'),
        created_by=g.current_user.id,
    )
    db.session.add(pn)
    db.session.commit()
    return success_response(pn.to_dict(), 'Part number generated', 201)


@encode_bp.route('/check', methods=['POST'])
@jwt_required
def check():
    data = request.get_json() or {}
    part_no = data.get('part_no', '')
    existing = PartNumber.query.filter_by(part_no=part_no).first()
    return success_response({
        'part_no': part_no,
        'exists': existing is not None,
    })


@encode_bp.route('/list', methods=['GET'])
@jwt_required
def list_part_numbers():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    query = PartNumber.query.order_by(PartNumber.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return success_response({
        'part_numbers': [pn.to_dict() for pn in items],
        'total': total,
        'page': page,
        'per_page': per_page,
    })
