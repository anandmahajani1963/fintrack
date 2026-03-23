"""Add subcategory column to transactions and categories

Revision ID: 001_add_subcategory
Revises: 
Create Date: 2026-03-21
"""
from alembic import op
import sqlalchemy as sa

revision = '001_add_subcategory'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add subcategory to transactions
    op.add_column('transactions',
        sa.Column('subcategory', sa.String(), nullable=True)
    )

    # Add subcategory to categories table
    op.add_column('categories',
        sa.Column('subcategory', sa.String(), nullable=True)
    )
    op.add_column('categories',
        sa.Column('parent_category', sa.String(), nullable=True)
    )

    # Add subcategory to default_categories
    op.add_column('default_categories',
        sa.Column('subcategory', sa.String(), nullable=True)
    )
    op.add_column('default_categories',
        sa.Column('parent_category', sa.String(), nullable=True)
    )

    # Index for subcategory queries
    op.create_index('idx_txn_subcategory',
        'transactions', ['user_id', 'subcategory'])


def downgrade():
    op.drop_index('idx_txn_subcategory', 'transactions')
    op.drop_column('transactions', 'subcategory')
    op.drop_column('categories', 'subcategory')
    op.drop_column('categories', 'parent_category')
    op.drop_column('default_categories', 'subcategory')
    op.drop_column('default_categories', 'parent_category')
