import uuid
from datetime import datetime, timezone
from sqlalchemy.dialects.postgresql import UUID
from ..extensions import db


class RuleTreeCategory(db.Model):
    __tablename__ = 'rule_tree_categories'

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    prefix = db.Column(db.String(10), nullable=True)
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    nodes = db.relationship(
        'RuleTreeNode', backref='category', lazy='selectin',
        order_by='RuleTreeNode.sort_order',
        cascade='all, delete-orphan',
    )

    def to_dict(self):
        return {
            'id': str(self.id),
            'name': self.name,
            'description': self.description,
            'prefix': self.prefix,
            'sort_order': self.sort_order,
            'nodes': [n.to_dict() for n in self.nodes if n.parent_id is None],
        }


class RuleTreeNode(db.Model):
    __tablename__ = 'rule_tree_nodes'

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category_id = db.Column(UUID(as_uuid=True), db.ForeignKey('rule_tree_categories.id'), nullable=False)
    parent_id = db.Column(UUID(as_uuid=True), db.ForeignKey('rule_tree_nodes.id'), nullable=True)
    label = db.Column(db.String(100), nullable=False)
    code_segment = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, nullable=True)
    field_type = db.Column(db.String(20), nullable=False, default='option')
    fixed_value = db.Column(db.String(50), nullable=True)
    validation_rules = db.Column(db.JSON, nullable=True)
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    children = db.relationship(
        'RuleTreeNode', backref=db.backref('parent', remote_side='RuleTreeNode.id'),
        lazy='selectin', order_by='RuleTreeNode.sort_order',
        cascade='all, delete-orphan',
    )

    def to_dict(self):
        return {
            'id': str(self.id),
            'category_id': str(self.category_id),
            'parent_id': str(self.parent_id) if self.parent_id else None,
            'label': self.label,
            'code_segment': self.code_segment,
            'description': self.description,
            'field_type': self.field_type,
            'fixed_value': self.fixed_value,
            'validation_rules': self.validation_rules,
            'sort_order': self.sort_order,
            'children': [c.to_dict() for c in self.children],
        }
