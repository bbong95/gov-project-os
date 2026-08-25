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
create function public.persist_requirement_extraction(
	p_actor_id uuid,
	p_document_parse_id uuid,
	p_privacy_classification public.privacy_classification,
	p_provider text,
	p_model text,
	p_policy_version text,
	p_prompt_version text,
	p_schema_version text,
	p_parse_result_sha256 text,
	p_canonical_input_sha256 text,
	p_fingerprint_sha256 text,
	p_accepted_output_sha256 text,
	p_provider_response_id text,
	p_input_tokens integer,
	p_output_tokens integer,
	p_candidates jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_tenant_id uuid;
	v_project_id uuid;
	v_document_id uuid;
	v_current_privacy public.privacy_classification;
	v_current_parse_sha256 text;
	v_run_id uuid;
	v_candidate_id uuid;
	v_candidate jsonb;
	v_source jsonb;
	v_candidate_position bigint := 0;
	v_source_position bigint;
	v_source_span_id uuid;
	v_source_span_ordinal integer;
	v_source_original text;
	v_source_text text;
	v_official_id text;
	v_official_supported boolean;
	v_seen_span_ids uuid[];
begin
	select
		parse.tenant_id,
		parse.project_id,
		parse.document_id,
		document.privacy_classification,
		parse.result_sha256
	into
		v_tenant_id,
		v_project_id,
		v_document_id,
		v_current_privacy,
		v_current_parse_sha256
	from public.document_parses as parse
	join public.documents as document
		on document.tenant_id = parse.tenant_id
		and document.project_id = parse.project_id
		and document.id = parse.document_id
	where parse.id = p_document_parse_id
		and (
			exists (
				select 1
				from public.project_memberships as project_membership
				where project_membership.tenant_id = parse.tenant_id
					and project_membership.project_id = parse.project_id
					and project_membership.user_id = p_actor_id
					and project_membership.role in (
						'EDITOR'::public.membership_role,
						'PROJECT_ADMIN'::public.membership_role
					)
			)
			or exists (
				select 1
				from public.tenant_memberships as tenant_membership
				where tenant_membership.tenant_id = parse.tenant_id
					and tenant_membership.user_id = p_actor_id
					and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
			)
		)
	for key share of parse, document;

	if p_actor_id is null or v_tenant_id is null then
		raise exception using
			errcode = '42501',
			message = 'REQUIREMENT_EXTRACTION_UNAVAILABLE';
	end if;

	if p_privacy_classification is distinct from v_current_privacy
		or v_current_privacy not in (
			'PUBLIC'::public.privacy_classification,
			'INTERNAL'::public.privacy_classification
		)
	then
		raise exception using
			errcode = '42501',
			message = 'REQUIREMENT_EXTRACTION_POLICY_DENIED';
	end if;

	if p_provider is distinct from 'OPENAI'
		or p_model is null
		or length(p_model) not between 1 and 128
		or p_model <> btrim(p_model)
		or p_policy_version is null
		or length(p_policy_version) not between 1 and 128
		or p_policy_version <> btrim(p_policy_version)
		or p_prompt_version is null
		or length(p_prompt_version) not between 1 and 128
		or p_prompt_version <> btrim(p_prompt_version)
		or p_schema_version is null
		or length(p_schema_version) not between 1 and 128
		or p_schema_version <> btrim(p_schema_version)
		or p_parse_result_sha256 is null
		or p_parse_result_sha256 !~ '^[0-9a-f]{64}$'
		or p_parse_result_sha256 is distinct from v_current_parse_sha256
		or p_canonical_input_sha256 is null
		or p_canonical_input_sha256 !~ '^[0-9a-f]{64}$'
		or p_fingerprint_sha256 is null
		or p_fingerprint_sha256 !~ '^[0-9a-f]{64}$'
		or p_accepted_output_sha256 is null
		or p_accepted_output_sha256 !~ '^[0-9a-f]{64}$'
		or (
			p_provider_response_id is not null
			and (
				length(p_provider_response_id) not between 1 and 255
				or p_provider_response_id <> btrim(p_provider_response_id)
			)
		)
		or p_input_tokens < 0
		or p_output_tokens < 0
	then
		raise exception using
			errcode = '22023',
			message = 'REQUIREMENT_PAYLOAD_INVALID';
	end if;

	if jsonb_typeof(p_candidates) is distinct from 'array'
		or jsonb_array_length(p_candidates) = 0
	then
		raise exception using
			errcode = '22023',
			message = 'REQUIREMENT_PAYLOAD_INVALID';
	end if;

	if jsonb_array_length(p_candidates) > 500
		or octet_length(p_candidates::text) > 4194304
	then
		raise exception using
			errcode = '22023',
			message = 'REQUIREMENT_PAYLOAD_LIMIT_EXCEEDED';
	end if;

	for v_candidate in
		select value
		from jsonb_array_elements(p_candidates)
	loop
		v_candidate_position := v_candidate_position + 1;

		if jsonb_typeof(v_candidate) <> 'object'
			or not (
				v_candidate ?& array[
					'candidateOrder', 'officialId', 'interpretation', 'type',
					'atomicity', 'provenanceState', 'contentSha256', 'sources'
				]
			)
			or v_candidate - array[
				'candidateOrder', 'officialId', 'interpretation', 'type',
				'atomicity', 'provenanceState', 'contentSha256', 'sources'
			] <> '{}'::jsonb
			or jsonb_typeof(v_candidate -> 'candidateOrder') <> 'number'
			or (v_candidate ->> 'candidateOrder') !~ '^[1-9][0-9]*$'
			or length(v_candidate ->> 'candidateOrder') > 3
			or jsonb_typeof(v_candidate -> 'officialId') not in ('string', 'null')
			or jsonb_typeof(v_candidate -> 'interpretation') <> 'string'
			or jsonb_typeof(v_candidate -> 'type') <> 'string'
			or jsonb_typeof(v_candidate -> 'atomicity') <> 'string'
			or jsonb_typeof(v_candidate -> 'provenanceState') <> 'string'
			or jsonb_typeof(v_candidate -> 'contentSha256') <> 'string'
			or jsonb_typeof(v_candidate -> 'sources') <> 'array'
		then
			raise exception using
				errcode = '22023',
				message = 'REQUIREMENT_PAYLOAD_INVALID';
		end if;

		if (v_candidate ->> 'candidateOrder')::integer <> v_candidate_position
			or (
				jsonb_typeof(v_candidate -> 'officialId') = 'string'
				and (
					length(v_candidate ->> 'officialId') not between 1 and 128
					or v_candidate ->> 'officialId' <> btrim(v_candidate ->> 'officialId')
				)
			)
			or not ((v_candidate ->> 'interpretation') ~ '[^[:space:]]')
			or v_candidate ->> 'type' not in (
				'FUNCTIONAL', 'SYSTEM_CONFIGURATION', 'PERFORMANCE', 'INTERFACE',
				'DATA', 'TEST', 'SECURITY', 'QUALITY', 'CONSTRAINT',
				'PROJECT_MANAGEMENT', 'PROJECT_SUPPORT', 'OTHER'
			)
			or v_candidate ->> 'atomicity' not in (
				'ATOMIC', 'COMPOSITE', 'REVIEW_REQUIRED'
			)
			or v_candidate ->> 'provenanceState' <> 'AI_DRAFT'
			or (v_candidate ->> 'contentSha256') !~ '^[0-9a-f]{64}$'
			or jsonb_array_length(v_candidate -> 'sources') = 0
		then
			raise exception using
				errcode = '22023',
				message = 'REQUIREMENT_PAYLOAD_INVALID';
		end if;

		if octet_length(v_candidate ->> 'interpretation') > 8192
			or jsonb_array_length(v_candidate -> 'sources') > 64
		then
			raise exception using
				errcode = '22023',
				message = 'REQUIREMENT_PAYLOAD_LIMIT_EXCEEDED';
		end if;

		v_source_position := 0;
		v_source_text := null;
		v_seen_span_ids := array[]::uuid[];
		v_official_supported := false;
		v_official_id := case
			when jsonb_typeof(v_candidate -> 'officialId') = 'null' then null
			else v_candidate ->> 'officialId'
		end;

		for v_source in
			select value
			from jsonb_array_elements(v_candidate -> 'sources')
		loop
			v_source_position := v_source_position + 1;

			if jsonb_typeof(v_source) <> 'object'
				or not (
					v_source ?& array[
						'sourceSpanId', 'sourceSpanOrdinal', 'sourceOrder'
					]
				)
				or v_source - array[
					'sourceSpanId', 'sourceSpanOrdinal', 'sourceOrder'
				] <> '{}'::jsonb
				or jsonb_typeof(v_source -> 'sourceSpanId') <> 'string'
				or (v_source ->> 'sourceSpanId') !~
					'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
				or jsonb_typeof(v_source -> 'sourceSpanOrdinal') <> 'number'
				or (v_source ->> 'sourceSpanOrdinal') !~ '^[1-9][0-9]*$'
				or length(v_source ->> 'sourceSpanOrdinal') > 5
				or jsonb_typeof(v_source -> 'sourceOrder') <> 'number'
				or (v_source ->> 'sourceOrder') !~ '^[1-9][0-9]*$'
				or length(v_source ->> 'sourceOrder') > 2
			then
				raise exception using
					errcode = '22023',
					message = 'REQUIREMENT_EVIDENCE_INVALID';
			end if;

			if (v_source ->> 'sourceOrder')::integer <> v_source_position then
				raise exception using
					errcode = '22023',
					message = 'REQUIREMENT_EVIDENCE_INVALID';
			end if;

			v_source_span_id := (v_source ->> 'sourceSpanId')::uuid;
			v_source_span_ordinal := (v_source ->> 'sourceSpanOrdinal')::integer;

			if v_source_span_id = any(v_seen_span_ids) then
				raise exception using
					errcode = '22023',
					message = 'REQUIREMENT_EVIDENCE_INVALID';
			end if;
			v_seen_span_ids := array_append(v_seen_span_ids, v_source_span_id);

			select source_span.original_text
			into v_source_original
			from public.source_spans as source_span
			where source_span.tenant_id = v_tenant_id
				and source_span.project_id = v_project_id
				and source_span.document_id = v_document_id
				and source_span.document_parse_id = p_document_parse_id
				and source_span.id = v_source_span_id
				and source_span.ordinal = v_source_span_ordinal;

			if not found then
				raise exception using
					errcode = '22023',
					message = 'REQUIREMENT_EVIDENCE_INVALID';
			end if;

			v_source_text := case
				when v_source_text is null then v_source_original
				else v_source_text || E'\n' || v_source_original
			end;

			if v_official_id is not null
				and position(v_official_id in v_source_original) > 0
			then
				v_official_supported := true;
			end if;
		end loop;

		if (v_official_id is not null and not v_official_supported) then
			raise exception using
				errcode = '22023',
				message = 'REQUIREMENT_EVIDENCE_INVALID';
		end if;

		if octet_length(v_source_text) > 16777216 then
			raise exception using
				errcode = '22023',
				message = 'REQUIREMENT_PAYLOAD_LIMIT_EXCEEDED';
		end if;
	end loop;

	insert into public.requirement_extraction_runs (
		tenant_id,
		project_id,
		document_id,
		document_parse_id,
		privacy_classification,
		provider,
		model,
		policy_version,
		prompt_version,
		schema_version,
		parse_result_sha256,
		canonical_input_sha256,
		fingerprint_sha256,
		accepted_output_sha256,
		provider_response_id,
		input_tokens,
		output_tokens,
		created_by
	)
	values (
		v_tenant_id,
		v_project_id,
		v_document_id,
		p_document_parse_id,
		v_current_privacy,
		p_provider,
		p_model,
		p_policy_version,
		p_prompt_version,
		p_schema_version,
		p_parse_result_sha256,
		p_canonical_input_sha256,
		p_fingerprint_sha256,
		p_accepted_output_sha256,
		p_provider_response_id,
		p_input_tokens,
		p_output_tokens,
		p_actor_id
	)
	on conflict on constraint requirement_extraction_runs_parse_fingerprint_key
	do nothing
	returning id into v_run_id;

	if v_run_id is null then
		select run.id
		into v_run_id
		from public.requirement_extraction_runs as run
		where run.document_parse_id = p_document_parse_id
			and run.fingerprint_sha256 = p_fingerprint_sha256;

		if v_run_id is null then
			raise exception using
				errcode = '40001',
				message = 'PERSIST_FAILED';
		end if;

		return jsonb_build_object('runId', v_run_id, 'reused', true);
	end if;

	for v_candidate in
		select value
		from jsonb_array_elements(p_candidates)
		order by (value ->> 'candidateOrder')::integer
	loop
		v_official_id := case
			when jsonb_typeof(v_candidate -> 'officialId') = 'null' then null
			else v_candidate ->> 'officialId'
		end;

		select string_agg(
			source_span.original_text,
			E'\n' order by (source_value ->> 'sourceOrder')::integer
		)
		into v_source_text
		from jsonb_array_elements(v_candidate -> 'sources') as source_item(source_value)
		join public.source_spans as source_span
			on source_span.id = (source_value ->> 'sourceSpanId')::uuid
			and source_span.tenant_id = v_tenant_id
			and source_span.project_id = v_project_id
			and source_span.document_id = v_document_id
			and source_span.document_parse_id = p_document_parse_id;

		insert into public.requirement_candidates (
			tenant_id,
			project_id,
			document_id,
			document_parse_id,
			run_id,
			candidate_order,
			official_id,
			source_text,
			interpretation,
			requirement_type,
			atomicity,
			provenance_state,
			content_sha256
		)
		values (
			v_tenant_id,
			v_project_id,
			v_document_id,
			p_document_parse_id,
			v_run_id,
			(v_candidate ->> 'candidateOrder')::integer,
			v_official_id,
			v_source_text,
			v_candidate ->> 'interpretation',
			(v_candidate ->> 'type')::public.requirement_type,
			(v_candidate ->> 'atomicity')::public.requirement_atomicity,
			'AI_DRAFT',
			v_candidate ->> 'contentSha256'
		)
		returning id into v_candidate_id;

		insert into public.requirement_candidate_source_spans (
			tenant_id,
			project_id,
			document_id,
			document_parse_id,
			run_id,
			candidate_id,
			source_span_id,
			source_order
		)
		select
			v_tenant_id,
			v_project_id,
			v_document_id,
			p_document_parse_id,
			v_run_id,
			v_candidate_id,
			(source_value ->> 'sourceSpanId')::uuid,
			(source_value ->> 'sourceOrder')::integer
		from jsonb_array_elements(v_candidate -> 'sources') as source_item(source_value)
		order by (source_value ->> 'sourceOrder')::integer;
	end loop;

	insert into public.audit_events (
		tenant_id,
		project_id,
		actor_user_id,
		event_type,
		entity_type,
		entity_id,
		event_data
	)
	values (
		v_tenant_id,
		v_project_id,
		p_actor_id,
		'REQUIREMENT_EXTRACTION_SUCCEEDED',
		'REQUIREMENT_EXTRACTION_RUN',
		v_run_id,
		jsonb_build_object(
			'document_parse_id', p_document_parse_id,
			'privacy_classification', v_current_privacy::text,
			'policy_decision', 'ALLOW',
			'provider', p_provider,
			'model', p_model,
			'policy_version', p_policy_version,
			'prompt_version', p_prompt_version,
			'schema_version', p_schema_version,
			'parse_result_sha256', p_parse_result_sha256,
			'canonical_input_sha256', p_canonical_input_sha256,
			'fingerprint_sha256', p_fingerprint_sha256,
			'accepted_output_sha256', p_accepted_output_sha256,
			'provider_response_id', p_provider_response_id,
			'input_tokens', p_input_tokens,
			'output_tokens', p_output_tokens,
			'candidate_count', jsonb_array_length(p_candidates)
		)
	);

	return jsonb_build_object('runId', v_run_id, 'reused', false);
end;
$$;

revoke all on function public.persist_requirement_extraction(
	uuid, uuid, public.privacy_classification, text, text, text, text, text,
	text, text, text, text, text, integer, integer, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.persist_requirement_extraction(
	uuid, uuid, public.privacy_classification, text, text, text, text, text,
	text, text, text, text, text, integer, integer, jsonb
) to service_role;

create function public.record_requirement_extraction_outcome(
	p_actor_id uuid,
	p_document_parse_id uuid,
	p_policy_decision text,
	p_outcome_code text,
	p_fingerprint_sha256 text,
	p_provider text,
	p_model text,
	p_policy_version text,
	p_prompt_version text,
	p_schema_version text,
	p_duration_ms integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_tenant_id uuid;
	v_project_id uuid;
	v_current_privacy public.privacy_classification;
	v_expected_decision text;
begin
	select
		parse.tenant_id,
		parse.project_id,
		document.privacy_classification
	into
		v_tenant_id,
		v_project_id,
		v_current_privacy
	from public.document_parses as parse
	join public.documents as document
		on document.tenant_id = parse.tenant_id
		and document.project_id = parse.project_id
		and document.id = parse.document_id
	where parse.id = p_document_parse_id
		and (
			exists (
				select 1
				from public.project_memberships as project_membership
				where project_membership.tenant_id = parse.tenant_id
					and project_membership.project_id = parse.project_id
					and project_membership.user_id = p_actor_id
					and project_membership.role in (
						'EDITOR'::public.membership_role,
						'PROJECT_ADMIN'::public.membership_role
					)
			)
			or exists (
				select 1
				from public.tenant_memberships as tenant_membership
				where tenant_membership.tenant_id = parse.tenant_id
					and tenant_membership.user_id = p_actor_id
					and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
			)
		)
	for key share of parse, document;

	if p_actor_id is null or v_tenant_id is null then
		raise exception using
			errcode = '42501',
			message = 'REQUIREMENT_OUTCOME_UNAVAILABLE';
	end if;

	v_expected_decision := case v_current_privacy
		when 'PUBLIC'::public.privacy_classification then 'ALLOW'
		when 'INTERNAL'::public.privacy_classification then 'ALLOW'
		when 'PERSONAL'::public.privacy_classification then 'REVIEW_REQUIRED'
		else 'BLOCK'
	end;

	if p_provider is distinct from 'OPENAI'
		or p_model is null
		or length(p_model) not between 1 and 128
		or p_model <> btrim(p_model)
		or p_policy_version is null
		or length(p_policy_version) not between 1 and 128
		or p_policy_version <> btrim(p_policy_version)
		or p_prompt_version is null
		or length(p_prompt_version) not between 1 and 128
		or p_prompt_version <> btrim(p_prompt_version)
		or p_schema_version is null
		or length(p_schema_version) not between 1 and 128
		or p_schema_version <> btrim(p_schema_version)
		or p_duration_ms is null
		or p_duration_ms not between 0 and 3600000
		or p_policy_decision is distinct from v_expected_decision
		or (
			p_fingerprint_sha256 is not null
			and p_fingerprint_sha256 !~ '^[0-9a-f]{64}$'
		)
	then
		raise exception using
			errcode = '22023',
			message = 'REQUIREMENT_OUTCOME_INVALID';
	end if;

	if (
		v_expected_decision = 'REVIEW_REQUIRED'
		and (
			p_outcome_code is distinct from 'POLICY_REVIEW_REQUIRED'
			or p_fingerprint_sha256 is not null
		)
	) or (
		v_expected_decision = 'BLOCK'
		and (
			p_outcome_code is distinct from 'POLICY_BLOCKED'
			or p_fingerprint_sha256 is not null
		)
	) or (
		v_expected_decision = 'ALLOW'
		and (
			p_outcome_code not in (
				'AI_INPUT_LIMIT_EXCEEDED',
				'AI_INPUT_INVALID',
				'AI_CONFIG_MISSING',
				'AI_PROVIDER_UNAVAILABLE',
				'AI_PROVIDER_REFUSED',
				'AI_PROVIDER_INCOMPLETE',
				'AI_OUTPUT_INVALID',
				'AI_OUTPUT_LIMIT_EXCEEDED',
				'PERSIST_FAILED'
			)
			or p_fingerprint_sha256 is null
		)
	) then
		raise exception using
			errcode = '22023',
			message = 'REQUIREMENT_OUTCOME_INVALID';
	end if;

	insert into public.audit_events (
		tenant_id,
		project_id,
		actor_user_id,
		event_type,
		entity_type,
		entity_id,
		event_data
	)
	values (
		v_tenant_id,
		v_project_id,
		p_actor_id,
		'REQUIREMENT_EXTRACTION_OUTCOME',
		'DOCUMENT_PARSE',
		p_document_parse_id,
		jsonb_build_object(
			'policy_decision', p_policy_decision,
			'outcome_code', p_outcome_code,
			'fingerprint_sha256', p_fingerprint_sha256,
			'provider', p_provider,
			'model', p_model,
			'policy_version', p_policy_version,
			'prompt_version', p_prompt_version,
			'schema_version', p_schema_version,
			'duration_ms', p_duration_ms
		)
	);
end;
$$;

revoke all on function public.record_requirement_extraction_outcome(
	uuid, uuid, text, text, text, text, text, text, text, text, integer
) from public, anon, authenticated, service_role;
grant execute on function public.record_requirement_extraction_outcome(
	uuid, uuid, text, text, text, text, text, text, text, text, integer
) to service_role;
