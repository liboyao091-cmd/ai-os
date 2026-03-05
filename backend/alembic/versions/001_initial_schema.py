"""Initial schema — all tables

Revision ID: 001
Revises:
Create Date: 2026-03-05
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Extensions
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("bytedance_uid", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(128)),
        sa.Column("team", sa.String(128)),
        sa.Column("avatar_url", sa.Text),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )

    # tools
    op.create_table(
        "tools",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("tags", postgresql.ARRAY(sa.Text), server_default="{}"),
        sa.Column("visibility", sa.String(16), server_default="private"),
        sa.Column("fork_policy", sa.String(16), server_default="forkable"),
        sa.Column("forked_from", postgresql.UUID(as_uuid=True), sa.ForeignKey("tools.id"), nullable=True),
        sa.Column("invoke_type", sa.String(32), nullable=False),
        sa.Column("invoke_config", postgresql.JSONB, nullable=False),
        sa.Column("input_schema", postgresql.JSONB, nullable=False, server_default='{"type":"object","properties":{}}'),
        sa.Column("output_schema", postgresql.JSONB, nullable=False, server_default='{"type":"object","properties":{}}'),
        sa.Column("version", sa.Integer, server_default="1"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("visibility IN ('private','team','public')", name="tools_visibility_check"),
        sa.CheckConstraint("fork_policy IN ('forkable','readonly')", name="tools_fork_policy_check"),
        sa.CheckConstraint("invoke_type IN ('python_func','http_api','mcp','lark_api')", name="tools_invoke_type_check"),
    )

    # model_policies
    op.create_table(
        "model_policies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("visibility", sa.String(16), server_default="private"),
        sa.Column("default_model", sa.String(64), server_default="doubao-pro"),
        sa.Column("routing_rules", postgresql.JSONB, server_default="[]"),
        sa.Column("fallback_chain", postgresql.ARRAY(sa.String), server_default="{}"),
        sa.Column("monthly_token_budget", sa.Integer, server_default="1000000"),
        sa.Column("params_override", postgresql.JSONB, server_default="{}"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("visibility IN ('private','team','public')", name="model_policies_visibility_check"),
    )

    # guardrail_rulesets
    op.create_table(
        "guardrail_rulesets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("visibility", sa.String(16), server_default="private"),
        sa.Column("rules", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("visibility IN ('private','team','public')", name="guardrail_rulesets_visibility_check"),
    )

    # executors
    op.create_table(
        "executors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("tags", postgresql.ARRAY(sa.Text), server_default="{}"),
        sa.Column("visibility", sa.String(16), server_default="private"),
        sa.Column("fork_policy", sa.String(16), server_default="forkable"),
        sa.Column("forked_from", postgresql.UUID(as_uuid=True), sa.ForeignKey("executors.id"), nullable=True),
        sa.Column("executor_type", sa.String(32), nullable=False),
        sa.Column("definition", postgresql.JSONB, nullable=False),
        sa.Column("tool_ids", postgresql.ARRAY(postgresql.UUID(as_uuid=True)), server_default="{}"),
        sa.Column("knowledge_ids", postgresql.ARRAY(postgresql.UUID(as_uuid=True)), server_default="{}"),
        sa.Column("model_policy_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("model_policies.id"), nullable=True),
        sa.Column("guardrail_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("guardrail_rulesets.id"), nullable=True),
        sa.Column("input_schema", postgresql.JSONB, server_default='{"type":"object","properties":{}}'),
        sa.Column("version", sa.Integer, server_default="1"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("visibility IN ('private','team','public')", name="executors_visibility_check"),
        sa.CheckConstraint("fork_policy IN ('forkable','readonly')", name="executors_fork_policy_check"),
        sa.CheckConstraint(
            "executor_type IN ('workflow','ai_workflow','agent','multi_agent','copilot')",
            name="executors_type_check",
        ),
    )

    # orchestrators
    op.create_table(
        "orchestrators",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("tags", postgresql.ARRAY(sa.Text), server_default="{}"),
        sa.Column("visibility", sa.String(16), server_default="private"),
        sa.Column("fork_policy", sa.String(16), server_default="forkable"),
        sa.Column("forked_from", postgresql.UUID(as_uuid=True), sa.ForeignKey("orchestrators.id"), nullable=True),
        sa.Column("routing_type", sa.String(32), nullable=False),
        sa.Column("definition", postgresql.JSONB, nullable=False),
        sa.Column("executor_refs", postgresql.ARRAY(postgresql.UUID(as_uuid=True)), server_default="{}"),
        sa.Column("model_policy_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("model_policies.id"), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("visibility IN ('private','team','public')", name="orchestrators_visibility_check"),
        sa.CheckConstraint("fork_policy IN ('forkable','readonly')", name="orchestrators_fork_policy_check"),
        sa.CheckConstraint(
            "routing_type IN ('rule_based','intent_based','canvas','auto')",
            name="orchestrators_routing_type_check",
        ),
    )

    # knowledge_spaces
    op.create_table(
        "knowledge_spaces",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("visibility", sa.String(16), server_default="private"),
        sa.Column("retrieval_config", postgresql.JSONB, server_default='{"top_k":5,"similarity_threshold":0.7,"mode":"hybrid"}'),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("visibility IN ('private','team','public')", name="knowledge_spaces_visibility_check"),
    )

    # knowledge_documents
    op.create_table(
        "knowledge_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("space_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("knowledge_spaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(256)),
        sa.Column("source_type", sa.String(32)),
        sa.Column("source_ref", sa.Text),
        sa.Column("content", sa.Text),
        sa.Column("chunk_count", sa.Integer, server_default="0"),
        sa.Column("status", sa.String(32), server_default="pending"),
        sa.Column("error_message", sa.Text),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("source_type IN ('upload','lark_doc','lark_wiki','manual')", name="knowledge_documents_source_type_check"),
        sa.CheckConstraint("status IN ('pending','indexing','ready','failed')", name="knowledge_documents_status_check"),
    )

    # knowledge_chunks (with pgvector)
    op.create_table(
        "knowledge_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("knowledge_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("space_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("knowledge_spaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("chunk_index", sa.Integer),
        sa.Column("metadata", postgresql.JSONB, server_default="{}"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )
    # Add vector column separately (requires pgvector extension to be loaded first)
    op.execute("ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS embedding vector(2048)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_chunks_space_id ON knowledge_chunks (space_id)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON knowledge_chunks "
        "USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )

    # execution_runs
    op.create_table(
        "execution_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("executor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("executors.id"), nullable=True),
        sa.Column("orchestrator_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orchestrators.id"), nullable=True),
        sa.Column("triggered_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("is_sandbox", sa.Boolean, server_default="false"),
        sa.Column("input", postgresql.JSONB, server_default="{}"),
        sa.Column("output", postgresql.JSONB),
        sa.Column("status", sa.String(32), server_default="running"),
        sa.Column("steps_log", postgresql.JSONB, server_default="[]"),
        sa.Column("paused_state", postgresql.JSONB),
        sa.Column("paused_step_id", sa.String(128)),
        sa.Column("total_tokens", sa.Integer, server_default="0"),
        sa.Column("duration_ms", sa.Integer),
        sa.Column("error_message", sa.Text),
        sa.Column("human_scores", postgresql.JSONB, server_default="{}"),
        sa.Column("started_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column("finished_at", sa.TIMESTAMP(timezone=True)),
        sa.CheckConstraint(
            "status IN ('running','waiting_confirm','success','failed','cancelled')",
            name="execution_runs_status_check",
        ),
    )


def downgrade() -> None:
    op.drop_table("execution_runs")
    op.drop_table("knowledge_chunks")
    op.drop_table("knowledge_documents")
    op.drop_table("knowledge_spaces")
    op.drop_table("orchestrators")
    op.drop_table("executors")
    op.drop_table("guardrail_rulesets")
    op.drop_table("model_policies")
    op.drop_table("tools")
    op.drop_table("users")
