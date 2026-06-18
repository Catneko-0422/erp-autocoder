"""add encoding_fields and material_node_id

Revision ID: 74fbc0b06564
Revises: 
Create Date: 2026-06-17 23:01:09.741487

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '74fbc0b06564'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('part_numbers', sa.Column('material_node_id', sa.String(length=100), nullable=True))
    op.add_column('part_numbers', sa.Column('encoding_fields', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.create_index(op.f('ix_part_numbers_material_node_id'), 'part_numbers', ['material_node_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_part_numbers_material_node_id'), table_name='part_numbers')
    op.drop_column('part_numbers', 'encoding_fields')
    op.drop_column('part_numbers', 'material_node_id')
