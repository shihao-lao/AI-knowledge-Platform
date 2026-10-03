"""Preserve question references for interview progress and practice history."""
from alembic import op
import sqlalchemy as sa

revision = 'd185f460b521'
down_revision = 'c472af031c10'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('questions', sa.Column('deleted_at', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('questions', 'deleted_at')
