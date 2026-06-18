import uuid
from datetime import datetime, timezone
from sqlalchemy.dialects.postgresql import UUID
from ..extensions import db


class PartNumber(db.Model):
    __tablename__ = 'part_numbers'

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    part_no = db.Column(db.String(100), unique=True, nullable=False, index=True)
    design_no = db.Column(db.String(100), nullable=True)
    qpa = db.Column(db.Float, nullable=True)
    part_type = db.Column(db.String(100), nullable=True)
    description = db.Column(db.Text, nullable=True)
    mfg_part = db.Column(db.String(100), nullable=True)
    vendor_pn = db.Column(db.String(100), nullable=True)
    item_text = db.Column(db.Text, nullable=True)
    material_node_id = db.Column(db.String(100), nullable=True, index=True)
    encoding_fields = db.Column(db.JSON, nullable=True)
    created_by = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    creator = db.relationship('User', foreign_keys=[created_by])

    def to_dict(self):
        return {
            'id': str(self.id),
            'part_no': self.part_no,
            'design_no': self.design_no,
            'qpa': self.qpa,
            'part_type': self.part_type,
            'description': self.description,
            'mfg_part': self.mfg_part,
            'vendor_pn': self.vendor_pn,
            'item_text': self.item_text,
            'material_node_id': self.material_node_id,
            'encoding_fields': self.encoding_fields,
            'created_by': str(self.created_by) if self.created_by else None,
            'created_at': self.created_at.isoformat(),
        }
