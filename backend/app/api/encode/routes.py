import csv
import io
import uuid
import re
from datetime import datetime, timezone
from flask import Blueprint, request, g
from marshmallow import Schema, fields, validate, ValidationError
from sqlalchemy.dialects.postgresql import UUID

from ...decorators import jwt_required
from ...models.part_number import PartNumber
from ...models.rule_tree import RuleTreeNode
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
    material_node_id = fields.String(allow_none=True)
    encoding_fields = fields.Dict(allow_none=True)


def _validate_encoding_fields(encoding_fields: dict, material_node_id: str | None) -> list[str]:
    if not material_node_id or not encoding_fields:
        return []
    errors = []
    for field_id_str, value in encoding_fields.items():
        try:
            node_id = uuid.UUID(field_id_str)
        except ValueError:
            continue
        node = db.session.get(RuleTreeNode, node_id)
        if not node or not node.validation_rules:
            continue
        rules = node.validation_rules
        if rules.get('required') and not value:
            errors.append(f"{node.label}: is required")
        if value:
            if 'pattern' in rules and not re.match(rules['pattern'], str(value)):
                errors.append(f"{node.label}: does not match pattern {rules['pattern']}")
            if 'min_length' in rules and len(str(value)) < rules['min_length']:
                errors.append(f"{node.label}: minimum length is {rules['min_length']}")
            if 'max_length' in rules and len(str(value)) > rules['max_length']:
                errors.append(f"{node.label}: maximum length is {rules['max_length']}")
            if 'min' in rules:
                try:
                    if float(value) < rules['min']:
                        errors.append(f"{node.label}: minimum value is {rules['min']}")
                except (ValueError, TypeError):
                    pass
            if 'max' in rules:
                try:
                    if float(value) > rules['max']:
                        errors.append(f"{node.label}: maximum value is {rules['max']}")
                except (ValueError, TypeError):
                    pass
            if 'options' in rules and str(value) not in [str(o) for o in rules['options']]:
                errors.append(f"{node.label}: must be one of {rules['options']}")
    return errors


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

    validation_errors = _validate_encoding_fields(data.get('encoding_fields') or {}, data.get('material_node_id'))
    if validation_errors:
        return error_response('Validation failed', 422, {'encoding_fields': validation_errors})

    pn = PartNumber(
        part_no=part_no,
        design_no=data.get('design_no'),
        qpa=data.get('qpa'),
        part_type=data.get('part_type'),
        description=data.get('description'),
        mfg_part=data.get('mfg_part'),
        vendor_pn=data.get('vendor_pn'),
        item_text=data.get('item_text'),
        material_node_id=data.get('material_node_id'),
        encoding_fields=data.get('encoding_fields'),
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


@encode_bp.route('/field-stats', methods=['GET'])
@jwt_required
def field_stats():
    material_node_id = request.args.get('material_node_id')
    if not material_node_id:
        return error_response('material_node_id is required', 422)

    node = db.session.get(RuleTreeNode, material_node_id)
    if not node:
        return error_response('Node not found', 404)

    fields = []
    cur = node
    children = sorted(cur.children, key=lambda x: x.sort_order)
    while children and all(c.sort_order == 0 for c in children):
        cur = children[0]
        fields.append(cur)
        children = sorted(cur.children, key=lambda x: x.sort_order)
    target_fields = [c for c in children if c.sort_order > 0 or c.field_type != 'option']
    target_fields.sort(key=lambda x: x.sort_order)

    recent = PartNumber.query.filter_by(material_node_id=material_node_id).order_by(PartNumber.created_at.desc()).limit(200).all()

    stats: dict[str, dict] = {}
    for f in target_fields:
        freq: dict[str, int] = {}
        for pn in recent:
            ef = pn.encoding_fields or {}
            val = ef.get(str(f.id))
            if val:
                freq[val] = freq.get(val, 0) + 1
        sorted_freq = sorted(freq.items(), key=lambda x: -x[1])
        stats[str(f.id)] = {
            'label': f.label,
            'field_type': f.field_type,
            'total': len(recent),
            'frequencies': [{'value': k, 'count': v, 'percentage': round(v / len(recent) * 100, 1) if recent else 0} for k, v in sorted_freq[:20]],
        }

    return success_response({
        'material_node_id': material_node_id,
        'material_label': node.label,
        'stats': stats,
    })


@encode_bp.route('/bom-import', methods=['POST'])
@jwt_required
def bom_import():
    content_type = request.content_type or ''

    rows = []
    if 'multipart/form-data' in content_type:
        file = request.files.get('file')
        if not file:
            return error_response('file is required', 422)
        filename = file.filename.lower() if file.filename else ''
        raw = file.read()
        if filename.endswith('.csv'):
            decoded = raw.decode('utf-8-sig')
            reader = csv.DictReader(io.StringIO(decoded))
            rows = list(reader)
        else:
            return error_response('Unsupported file type, use CSV', 422)
    elif 'application/json' in content_type:
        rows = request.get_json() or []
        if not isinstance(rows, list):
            return error_response('Expected a JSON array', 422)
    else:
        return error_response('Content-Type must be multipart/form-data or application/json', 415)

    if not rows:
        return error_response('No data to import', 422)

    results: list[dict] = []
    imported = 0
    skipped = 0
    errors: list[str] = []

    for i, row in enumerate(rows):
        part_no = (row.get('part_no') or '').strip()
        if not part_no:
            errors.append(f"Row {i + 1}: missing part_no")
            skipped += 1
            continue

        existing = PartNumber.query.filter_by(part_no=part_no).first()
        if existing:
            skipped += 1
            results.append({'row': i + 1, 'part_no': part_no, 'status': 'skipped', 'reason': 'already exists'})
            continue

        material_node_id = (row.get('material_node_id') or '').strip() or None
        encoding_fields_raw = row.get('encoding_fields')
        encoding_fields = None
        if encoding_fields_raw:
            if isinstance(encoding_fields_raw, str):
                try:
                    import json
                    encoding_fields = json.loads(encoding_fields_raw)
                except json.JSONDecodeError:
                    encoding_fields = {}
            else:
                encoding_fields = encoding_fields_raw

        validation_errors = _validate_encoding_fields(encoding_fields or {}, material_node_id)
        if validation_errors:
            errors.append(f"Row {i + 1} ({part_no}): {'; '.join(validation_errors)}")
            skipped += 1
            continue

        try:
            pn = PartNumber(
                part_no=part_no,
                design_no=row.get('design_no') or None,
                qpa=float(row['qpa']) if row.get('qpa') else None,
                part_type=row.get('part_type') or None,
                description=row.get('description') or None,
                mfg_part=row.get('mfg_part') or None,
                vendor_pn=row.get('vendor_pn') or None,
                item_text=row.get('item_text') or None,
                material_node_id=material_node_id,
                encoding_fields=encoding_fields,
                created_by=g.current_user.id,
            )
            db.session.add(pn)
            imported += 1
            results.append({'row': i + 1, 'part_no': part_no, 'status': 'imported'})
        except Exception as e:
            db.session.rollback()
            errors.append(f"Row {i + 1} ({part_no}): {str(e)}")
            skipped += 1

    db.session.commit()

    return success_response({
        'imported': imported,
        'skipped': skipped,
        'errors': errors[:50],
        'results': results[:200],
    }, f'Imported {imported}, skipped {skipped}')


@encode_bp.route('/batch-delete', methods=['POST'])
@jwt_required
def batch_delete():
    body = request.get_json() or {}
    ids = body.get('ids', [])
    if not ids or not isinstance(ids, list):
        return error_response('ids must be a non-empty array', 422)

    deleted = 0
    errors = []
    for raw_id in ids:
        try:
            uid = uuid.UUID(raw_id)
            pn = db.session.get(PartNumber, uid)
            if pn:
                db.session.delete(pn)
                deleted += 1
            else:
                errors.append(f'{raw_id}: not found')
        except ValueError:
            errors.append(f'{raw_id}: invalid ID format')

    db.session.commit()
    return success_response({
        'deleted': deleted,
        'errors': errors[:20],
    }, f'Deleted {deleted} part number(s)')


@encode_bp.route('/<part_id>', methods=['DELETE'])
@jwt_required
def delete_part_number(part_id):
    try:
        uid = uuid.UUID(part_id)
    except ValueError:
        return error_response('Invalid ID format', 422)
    pn = db.session.get(PartNumber, uid)
    if not pn:
        return error_response('Not found', 404)
    db.session.delete(pn)
    db.session.commit()
    return success_response(message='Part number deleted')
