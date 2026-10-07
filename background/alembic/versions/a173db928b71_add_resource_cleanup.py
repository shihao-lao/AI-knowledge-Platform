"""Track model collections and persist external resource cleanup retries."""
from alembic import op
import sqlalchemy as sa

revision = 'a173db928b71'
down_revision = 'f8249ba0c301'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('knowledge_vector_indexes',
        sa.Column('collection_name', sa.String(64), primary_key=True),
        sa.Column('knowledge_id', sa.String(50), sa.ForeignKey('knowledge_bases.id', ondelete='CASCADE'), nullable=False),
    )
    op.create_index('ix_knowledge_vector_indexes_knowledge_id', 'knowledge_vector_indexes', ['knowledge_id'])
    op.create_table('resource_cleanup_tasks',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('knowledge_id', sa.String(50), nullable=False),
        sa.Column('files', sa.JSON(), nullable=False),
        sa.Column('collections', sa.JSON(), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('next_attempt_at', sa.DateTime(), nullable=False),
        sa.Column('last_error', sa.Text(), nullable=False),
    )
    op.create_index('ix_resource_cleanup_tasks_next_attempt_at', 'resource_cleanup_tasks', ['next_attempt_at'])


def downgrade():
    op.drop_table('resource_cleanup_tasks')
    op.drop_table('knowledge_vector_indexes')
