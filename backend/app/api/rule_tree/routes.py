from flask import Blueprint, request, g as flask_g
from marshmallow import Schema, fields, validate, ValidationError

from ...decorators import jwt_required, rule_maker_required
from ...models.rule_tree import RuleTreeCategory, RuleTreeNode
from ...extensions import db
from ...utils.helpers import success_response, error_response

rule_tree_bp = Blueprint('rule_tree', __name__)


class CategorySchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    description = fields.String(allow_none=True)
    prefix = fields.String(allow_none=True, validate=validate.Length(max=10))
    sort_order = fields.Integer(load_default=0)


class NodeSchema(Schema):
    category_id = fields.String(required=True)
    parent_id = fields.String(allow_none=True)
    label = fields.String(required=True, validate=validate.Length(min=1, max=100))
    code_segment = fields.String(required=True, validate=validate.Length(min=0, max=50))
    description = fields.String(allow_none=True)
    field_type = fields.String(load_default='option', validate=validate.OneOf(['option', 'options', 'input', 'fixed']))
    fixed_value = fields.String(allow_none=True, validate=validate.Length(max=50))
    sort_order = fields.Integer(load_default=0)


@rule_tree_bp.route('', methods=['GET'])
@jwt_required
def get_tree():
    categories = RuleTreeCategory.query.order_by(RuleTreeCategory.sort_order).all()
    return success_response({'categories': [c.to_dict() for c in categories]})


@rule_tree_bp.route('/categories', methods=['POST'])
@rule_maker_required
def create_category():
    schema = CategorySchema()
    try:
        data = schema.load(request.get_json() or {})
    except ValidationError as err:
        return error_response('Validation error', 422, err.messages)
    cat = RuleTreeCategory(name=data['name'], description=data.get('description'), prefix=data.get('prefix'), sort_order=data['sort_order'])
    db.session.add(cat)
    db.session.commit()
    return success_response(cat.to_dict(), 'Category created', 201)


@rule_tree_bp.route('/categories/<cat_id>', methods=['PUT'])
@rule_maker_required
def update_category(cat_id):
    cat = db.session.get(RuleTreeCategory, cat_id)
    if not cat:
        return error_response('Not found', 404)
    data = request.get_json() or {}
    for field in ('name', 'description', 'prefix', 'sort_order'):
        if field in data:
            setattr(cat, field, data[field])
    db.session.commit()
    return success_response(cat.to_dict(), 'Category updated')


@rule_tree_bp.route('/categories/<cat_id>', methods=['DELETE'])
@rule_maker_required
def delete_category(cat_id):
    cat = db.session.get(RuleTreeCategory, cat_id)
    if not cat:
        return error_response('Not found', 404)
    db.session.delete(cat)
    db.session.commit()
    return success_response(message='Category deleted')


@rule_tree_bp.route('/nodes', methods=['POST'])
@rule_maker_required
def create_node():
    schema = NodeSchema()
    try:
        data = schema.load(request.get_json() or {})
    except ValidationError as err:
        return error_response('Validation error', 422, err.messages)
    node = RuleTreeNode(
        category_id=data['category_id'],
        parent_id=data.get('parent_id'),
        label=data['label'],
        code_segment=data['code_segment'],
        description=data.get('description'),
        field_type=data.get('field_type', 'option'),
        fixed_value=data.get('fixed_value'),
        sort_order=data['sort_order'],
    )
    db.session.add(node)
    db.session.commit()
    return success_response(node.to_dict(), 'Node created', 201)


@rule_tree_bp.route('/nodes/<node_id>', methods=['PUT'])
@rule_maker_required
def update_node(node_id):
    node = db.session.get(RuleTreeNode, node_id)
    if not node:
        return error_response('Not found', 404)
    data = request.get_json() or {}
    for field in ('label', 'code_segment', 'description', 'sort_order', 'parent_id', 'field_type', 'fixed_value'):
        if field in data:
            setattr(node, field, data[field])
    db.session.commit()
    return success_response(node.to_dict(), 'Node updated')


@rule_tree_bp.route('/nodes/<node_id>', methods=['DELETE'])
@rule_maker_required
def delete_node(node_id):
    node = db.session.get(RuleTreeNode, node_id)
    if not node:
        return error_response('Not found', 404)
    db.session.delete(node)
    db.session.commit()
    return success_response(message='Node deleted')
