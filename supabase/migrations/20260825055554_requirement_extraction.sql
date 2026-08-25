create type public.requirement_type as enum (
	'FUNCTIONAL',
	'SYSTEM_CONFIGURATION',
	'PERFORMANCE',
	'INTERFACE',
	'DATA',
	'TEST',
	'SECURITY',
	'QUALITY',
	'CONSTRAINT',
	'PROJECT_MANAGEMENT',
	'PROJECT_SUPPORT',
	'OTHER'
);

create type public.requirement_atomicity as enum (
	'ATOMIC',
	'COMPOSITE',
	'REVIEW_REQUIRED'
);

alter table public.source_spans
	add constraint source_spans_scope_id_key
	unique (tenant_id, project_id, document_id, document_parse_id, id);

create table public.requirement_extraction_runs (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	document_id uuid not null,
	document_parse_id uuid not null,
	status text not null default 'SUCCEEDED',
	privacy_classification public.privacy_classification not null,
	policy_decision text not null default 'ALLOW',
	provider text not null,
	model text not null,
	policy_version text not null,
	prompt_version text not null,
	schema_version text not null,
	parse_result_sha256 text not null,
	canonical_input_sha256 text not null,
	fingerprint_sha256 text not null,
	accepted_output_sha256 text not null,
	provider_response_id text,
	input_tokens integer,
	output_tokens integer,
	created_by uuid not null,
	created_at timestamptz not null default now(),
	constraint requirement_extraction_runs_document_parse_fkey
		foreign key (tenant_id, project_id, document_id, document_parse_id)
		references public.document_parses(tenant_id, project_id, document_id, id)
		on delete restrict,
	constraint requirement_extraction_runs_created_by_fkey
		foreign key (created_by) references auth.users(id) on delete restrict,
	constraint requirement_extraction_runs_status_check check (status = 'SUCCEEDED'),
	constraint requirement_extraction_runs_policy_decision_check check (policy_decision = 'ALLOW'),
	constraint requirement_extraction_runs_provider_check check (provider = 'OPENAI'),
	constraint requirement_extraction_runs_model_check
		check (length(model) between 1 and 128 and model = btrim(model)),
	constraint requirement_extraction_runs_policy_version_check
		check (length(policy_version) between 1 and 128 and policy_version = btrim(policy_version)),
	constraint requirement_extraction_runs_prompt_version_check
		check (length(prompt_version) between 1 and 128 and prompt_version = btrim(prompt_version)),
	constraint requirement_extraction_runs_schema_version_check
		check (length(schema_version) between 1 and 128 and schema_version = btrim(schema_version)),
	constraint requirement_extraction_runs_parse_result_sha256_check
		check (parse_result_sha256 ~ '^[0-9a-f]{64}$'),
	constraint requirement_extraction_runs_canonical_input_sha256_check
		check (canonical_input_sha256 ~ '^[0-9a-f]{64}$'),
	constraint requirement_extraction_runs_fingerprint_sha256_check
		check (fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
	constraint requirement_extraction_runs_accepted_output_sha256_check
		check (accepted_output_sha256 ~ '^[0-9a-f]{64}$'),
	constraint requirement_extraction_runs_provider_response_id_check
		check (
			provider_response_id is null
			or (
				length(provider_response_id) between 1 and 255
				and provider_response_id = btrim(provider_response_id)
			)
		),
	constraint requirement_extraction_runs_input_tokens_check
		check (input_tokens is null or input_tokens >= 0),
	constraint requirement_extraction_runs_output_tokens_check
		check (output_tokens is null or output_tokens >= 0),
	constraint requirement_extraction_runs_parse_fingerprint_key
		unique (document_parse_id, fingerprint_sha256),
	constraint requirement_extraction_runs_scope_key
		unique (tenant_id, project_id, document_id, document_parse_id, id)
);

create table public.requirement_candidates (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	document_id uuid not null,
	document_parse_id uuid not null,
	run_id uuid not null,
	candidate_order integer not null,
	official_id text,
	source_text text not null,
	interpretation text not null,
	requirement_type public.requirement_type not null,
	atomicity public.requirement_atomicity not null,
	provenance_state text not null default 'AI_DRAFT',
	content_sha256 text not null,
	created_at timestamptz not null default now(),
	constraint requirement_candidates_run_fkey
		foreign key (tenant_id, project_id, document_id, document_parse_id, run_id)
		references public.requirement_extraction_runs(
			tenant_id, project_id, document_id, document_parse_id, id
		)
		on delete restrict,
	constraint requirement_candidates_order_check
		check (candidate_order between 1 and 500),
	constraint requirement_candidates_official_id_check
		check (
			official_id is null
			or (
				length(official_id) between 1 and 128
				and official_id = btrim(official_id)
			)
		),
	constraint requirement_candidates_source_text_not_blank
		check (source_text ~ '[^[:space:]]'),
	constraint requirement_candidates_source_text_size_check
		check (octet_length(source_text) between 1 and 16777216),
	constraint requirement_candidates_interpretation_not_blank
		check (interpretation ~ '[^[:space:]]'),
	constraint requirement_candidates_interpretation_size_check
		check (octet_length(interpretation) between 1 and 8192),
	constraint requirement_candidates_provenance_state_check
		check (provenance_state = 'AI_DRAFT'),
	constraint requirement_candidates_content_sha256_check
		check (content_sha256 ~ '^[0-9a-f]{64}$'),
	constraint requirement_candidates_run_order_key
		unique (run_id, candidate_order),
	constraint requirement_candidates_scope_key
		unique (tenant_id, project_id, document_id, document_parse_id, run_id, id)
);

create table public.requirement_candidate_source_spans (
	tenant_id uuid not null,
	project_id uuid not null,
	document_id uuid not null,
	document_parse_id uuid not null,
	run_id uuid not null,
	candidate_id uuid not null,
	source_span_id uuid not null,
	source_order integer not null,
	created_at timestamptz not null default now(),
	constraint requirement_candidate_source_spans_pkey
		primary key (candidate_id, source_order),
	constraint requirement_candidate_source_spans_candidate_fkey
		foreign key (
			tenant_id, project_id, document_id, document_parse_id, run_id, candidate_id
		)
		references public.requirement_candidates(
			tenant_id, project_id, document_id, document_parse_id, run_id, id
		)
		on delete restrict,
	constraint requirement_candidate_source_spans_source_span_fkey
		foreign key (
			tenant_id, project_id, document_id, document_parse_id, source_span_id
		)
		references public.source_spans(
			tenant_id, project_id, document_id, document_parse_id, id
		)
		on delete restrict,
	constraint requirement_candidate_source_spans_source_order_check
		check (source_order between 1 and 64),
	constraint requirement_candidate_source_spans_candidate_span_key
		unique (candidate_id, source_span_id)
);

create index requirement_extraction_runs_project_created_at_idx
	on public.requirement_extraction_runs (project_id, created_at desc, id);
create index requirement_candidates_run_order_idx
	on public.requirement_candidates (run_id, candidate_order, id);
create index requirement_candidate_source_spans_span_idx
	on public.requirement_candidate_source_spans (source_span_id, candidate_id);

alter table public.requirement_extraction_runs enable row level security;
alter table public.requirement_candidates enable row level security;
alter table public.requirement_candidate_source_spans enable row level security;
alter table public.requirement_extraction_runs force row level security;
alter table public.requirement_candidates force row level security;
alter table public.requirement_candidate_source_spans force row level security;

revoke all privileges on table public.requirement_extraction_runs
	from anon, authenticated, service_role;
revoke all privileges on table public.requirement_candidates
	from anon, authenticated, service_role;
revoke all privileges on table public.requirement_candidate_source_spans
	from anon, authenticated, service_role;
grant select on table public.requirement_extraction_runs to authenticated;
grant select on table public.requirement_candidates to authenticated;
grant select on table public.requirement_candidate_source_spans to authenticated;
grant select, insert, delete on table public.requirement_extraction_runs to service_role;
grant select, insert, delete on table public.requirement_candidates to service_role;
grant select, insert, delete on table public.requirement_candidate_source_spans to service_role;

create policy "requirement extraction runs visible to project member or tenant admin"
on public.requirement_extraction_runs
for select
to authenticated
using (
	(select auth.uid()) is not null
	and (
		exists (
			select 1
			from public.project_memberships as project_membership
			where project_membership.tenant_id = requirement_extraction_runs.tenant_id
				and project_membership.project_id = requirement_extraction_runs.project_id
				and project_membership.user_id = (select auth.uid())
		)
		or exists (
			select 1
			from public.tenant_memberships as tenant_membership
			where tenant_membership.tenant_id = requirement_extraction_runs.tenant_id
				and tenant_membership.user_id = (select auth.uid())
				and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
		)
	)
);

create policy "requirement candidates visible to project member or tenant admin"
on public.requirement_candidates
for select
to authenticated
using (
	(select auth.uid()) is not null
	and (
		exists (
			select 1
			from public.project_memberships as project_membership
			where project_membership.tenant_id = requirement_candidates.tenant_id
				and project_membership.project_id = requirement_candidates.project_id
				and project_membership.user_id = (select auth.uid())
		)
		or exists (
			select 1
			from public.tenant_memberships as tenant_membership
			where tenant_membership.tenant_id = requirement_candidates.tenant_id
				and tenant_membership.user_id = (select auth.uid())
				and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
		)
	)
);

create policy "requirement evidence visible to project member or tenant admin"
on public.requirement_candidate_source_spans
for select
to authenticated
using (
	(select auth.uid()) is not null
	and (
		exists (
			select 1
			from public.project_memberships as project_membership
			where project_membership.tenant_id = requirement_candidate_source_spans.tenant_id
				and project_membership.project_id = requirement_candidate_source_spans.project_id
				and project_membership.user_id = (select auth.uid())
		)
		or exists (
			select 1
			from public.tenant_memberships as tenant_membership
			where tenant_membership.tenant_id = requirement_candidate_source_spans.tenant_id
				and tenant_membership.user_id = (select auth.uid())
				and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
		)
	)
);
