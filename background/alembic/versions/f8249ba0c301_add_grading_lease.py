"""Claim interview grading in short transactions with an expiring lease."""
from alembic import op
import sqlalchemy as sa

revision = 'f8249ba0c301'
down_revision = 'd185f460b521'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('interview_turns', sa.Column('grading_token', sa.String(36), nullable=True))
    op.add_column('interview_turns', sa.Column('grading_expires_at', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('interview_turns', 'grading_expires_at')
    op.drop_column('interview_turns', 'grading_token')
