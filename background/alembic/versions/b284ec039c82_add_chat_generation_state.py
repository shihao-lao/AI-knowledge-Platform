"""Persist idempotent chat turns, partial answers and expiring generation claims."""
from alembic import op
import sqlalchemy as sa

revision = 'b284ec039c82'
down_revision = 'a173db928b71'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('messages', sa.Column('request_id', sa.String(36), nullable=True))
    op.add_column('messages', sa.Column('message_index', sa.Integer(), nullable=True))
    op.add_column('messages', sa.Column('generation_status', sa.String(16), nullable=False, server_default='completed'))
    op.add_column('messages', sa.Column('generation_error', sa.Text(), nullable=True))
    op.add_column('messages', sa.Column('generation_token', sa.String(36), nullable=True))
    op.add_column('messages', sa.Column('generation_expires_at', sa.DateTime(), nullable=True))
    op.add_column('messages', sa.Column('generation_options', sa.JSON(), nullable=True))
    op.create_unique_constraint('uq_message_request_role', 'messages', ['conversation_id', 'request_id', 'role'])


def downgrade():
    op.drop_constraint('uq_message_request_role', 'messages', type_='unique')
    for name in ('generation_options', 'generation_expires_at', 'generation_token', 'generation_error',
                 'generation_status', 'message_index', 'request_id'):
        op.drop_column('messages', name)
