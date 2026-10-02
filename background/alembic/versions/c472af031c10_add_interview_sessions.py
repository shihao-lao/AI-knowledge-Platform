"""Persist interview sessions and ordered question snapshots.

Revision ID: c472af031c10
Revises: e661046b968d
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.mysql import LONGTEXT

revision = 'c472af031c10'
down_revision = 'e661046b968d'
branch_labels = None
depends_on = None


def upgrade():
    text = sa.Text().with_variant(LONGTEXT(), 'mysql')
    op.create_table(
        'interview_sessions',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('conversation_id', sa.String(50), sa.ForeignKey(
            'conversations.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('current_position', sa.Integer(), nullable=False),
        sa.Column('summary', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
    )
    op.create_table(
        'interview_turns',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('interview_id', sa.String(50), sa.ForeignKey(
            'interview_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('question_id', sa.String(50), sa.ForeignKey(
            'questions.id', ondelete='SET NULL'), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('question', text, nullable=False),
        sa.Column('reference_answer', text, nullable=False),
        sa.Column('keywords', sa.JSON(), nullable=False),
        sa.Column('category', sa.String(100), nullable=False),
        sa.Column('difficulty', sa.String(20), nullable=False),
        sa.Column('user_answer', text, nullable=True),
        sa.Column('evaluation', sa.JSON(), nullable=True),
        sa.UniqueConstraint('interview_id', 'position', name='uq_interview_position'),
    )
    op.create_index('ix_interview_turns_interview_id', 'interview_turns', ['interview_id'])


def downgrade():
    op.drop_table('interview_turns')
    op.drop_table('interview_sessions')
