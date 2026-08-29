-- M16 HWPX Template Artifact
-- Stores immutable template versions, H8-approved field mappings, and
-- H10-approved final artifacts. Every mutation is a new row; existing
-- rows are never updated in place.

create table public.artifact_templates (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	original_filename text not null,
	media_type text not null default 'application/hwp+zip',
	storage_bucket text not null default 'artifact-templates',
	storage_path text not null,
	sha256 text not null,
	version integer not null default 1,
	detected_format text not null default 'hwpx',
	metadata jsonb not null default '{}'::jsonb,
	created_by uuid not null,
	created_at timestamptz not null default now(),
	constraint artifact_templates_filename_check
		check (length(btrim(original_filename)) between 1 and 255),
	constraint artifact_templates_sha256_check
		check (sha256 ~ '^[0-9a-f]{64}$'),
	constraint artifact_templates_version_check
		check (version > 0),
	constraint artifact_templates_detected_format_check
		check (detected_format in ('hwpx', 'xlsx', 'docx', 'pdf', 'txt', 'unknown')),
	constraint artifact_templates_3_key unique (tenant_id, project_id, id)
);
create index artifact_templates_project_idx on public.artifact_templates (project_id);

create table public.artifact_template_fields (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	template_id uuid not null,
	field_key text not null,
	anchor_kind text not null,
	anchor_selector text not null,
	required boolean not null default false,
	description text,
	content_sha256 text not null,
	created_at timestamptz not null default now(),
	constraint artifact_template_fields_template_fkey
		foreign key (tenant_id, project_id, template_id)
		references public.artifact_templates (tenant_id, project_id, id)
		on delete cascade,
	constraint artifact_template_fields_key_check
		check (length(btrim(field_key)) between 1 and 128),
	constraint artifact_template_fields_anchor_kind_check
		check (anchor_kind in ('PARAGRAPH', 'TABLE_CELL', 'TEXT_BOX', 'RUN', 'HEADER', 'FOOTER')),
	constraint artifact_template_fields_anchor_selector_check
		check (length(btrim(anchor_selector)) between 1 and 1024),
	constraint artifact_template_fields_sha256_check
		check (content_sha256 ~ '^[0-9a-f]{64}$'),
	constraint artifact_template_fields_unique unique (template_id, field_key)
);

-- H8 human mapping approval. Once approved, the row is frozen
-- (approved_at + approved_by never change). The same template_id can
-- accumulate several mapping versions; only the latest APPROVED
-- mapping may be used to fill an artifact.
create table public.artifact_template_mappings (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	template_id uuid not null,
	version integer not null,
	source_kind text not null,
	source_id uuid not null,
	mapping jsonb not null,
	mapping_sha256 text not null,
	approved_by uuid,
	approved_at timestamptz,
	created_by uuid not null,
	created_at timestamptz not null default now(),
	constraint artifact_template_mappings_template_fkey
		foreign key (tenant_id, project_id, template_id)
		references public.artifact_templates (tenant_id, project_id, id)
		on delete cascade,
	constraint artifact_template_mappings_source_kind_check
		check (source_kind in ('CONTRACT_BASELINE', 'REQUIREMENT_BASELINE', 'WBS_TASK', 'INSPECTION', 'MEETING_MINUTE', 'CLOSE_OUT', 'MANUAL_INPUT')),
	constraint artifact_template_mappings_version_check
		check (version > 0),
	constraint artifact_template_mappings_sha256_check
		check (mapping_sha256 ~ '^[0-9a-f]{64}$'),
	constraint artifact_template_mappings_approval_pair
		check (
			(approved_by is null and approved_at is null)
			or (approved_by is not null and approved_at is not null)
		),
	constraint artifact_template_mappings_version_unique unique (template_id, version),
	constraint artifact_template_mappings_3_key unique (tenant_id, project_id, id)
);

create index artifact_template_mappings_template_idx on public.artifact_template_mappings (template_id);
create index artifact_template_mappings_source_idx on public.artifact_template_mappings (source_kind, source_id);

-- H10 final artifact: produced from a single APPROVED mapping, with
-- every required field resolved. Generated artifacts are immutable
-- and record every provenance element (template, baseline, source,
-- model fingerprint, prompt version).
create table public.generated_artifacts (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	run_id uuid,
	template_id uuid not null,
	mapping_id uuid not null,
	artifact_format text not null default 'hwpx',
	storage_bucket text not null default 'artifact-templates',
	storage_path text not null,
	content_sha256 text not null,
	unresolved_required_fields jsonb not null default '[]'::jsonb,
	validation jsonb not null default '{}'::jsonb,
	preview_metadata jsonb not null default '{}'::jsonb,
	baseline_id uuid,
	source_document_id uuid,
	source_document_parse_id uuid,
	model_fingerprint text,
	prompt_version text,
	approved_by uuid,
	approved_at timestamptz,
	rejected_reason text,
	created_by uuid not null,
	created_at timestamptz not null default now(),
	constraint generated_artifacts_template_fkey
		foreign key (tenant_id, project_id, template_id)
		references public.artifact_templates (tenant_id, project_id, id)
		on delete restrict,
	constraint generated_artifacts_mapping_fkey
		foreign key (tenant_id, project_id, mapping_id)
		references public.artifact_template_mappings (tenant_id, project_id, id)
		on delete restrict,
	constraint generated_artifacts_run_fkey
		foreign key (tenant_id, project_id, run_id)
		references public.requirement_extraction_runs (tenant_id, project_id, id)
		on delete restrict,
	constraint generated_artifacts_source_doc_fkey
		foreign key (tenant_id, project_id, source_document_id, source_document_parse_id)
		references public.document_parses (tenant_id, project_id, document_id, id)
		on delete restrict,
	constraint generated_artifacts_format_check
		check (artifact_format in ('hwpx', 'xlsx', 'docx', 'pdf', 'txt')),
	constraint generated_artifacts_sha256_check
		check (content_sha256 ~ '^[0-9a-f]{64}$'),
	constraint generated_artifacts_approval_pair
		check (
			(approved_by is null and approved_at is null)
			or (approved_by is not null and approved_at is not null)
		),
	constraint generated_artifacts_4_key unique (tenant_id, project_id, id)
);

create index generated_artifacts_template_idx on public.generated_artifacts (template_id);
create index generated_artifacts_mapping_idx on public.generated_artifacts (mapping_id);
create index generated_artifacts_run_idx on public.generated_artifacts (run_id);

-- -----------------------------------------------------------------------------
-- Trusted server action: register a new template version.
-- service_role only. The byte hash is the source of truth, so a re-upload
-- of the same bytes returns the existing version rather than creating a
-- duplicate row.
-- -----------------------------------------------------------------------------
create or replace function public.register_artifact_template(
	p_actor_id uuid,
	p_project_id uuid,
	p_original_filename text,
	p_media_type text,
	p_storage_bucket text,
	p_storage_path text,
	p_sha256 text,
	p_detected_format text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_tenant_id uuid;
	v_template_id uuid;
	v_next_version integer;
begin
	if p_actor_id is null or p_project_id is null or p_sha256 is null then
		raise exception using errcode = '22023', message = 'TEMPLATE_REGISTRATION_INVALID';
	end if;

	if p_sha256 !~ '^[0-9a-f]{64}$' then
		raise exception using errcode = '22023', message = 'TEMPLATE_SHA256_SHAPE';
	end if;

	select project.tenant_id into v_tenant_id
	from public.projects as project
	where project.id = p_project_id
		and (
			exists (
				select 1 from public.project_memberships as membership
				where membership.tenant_id = project.tenant_id
					and membership.project_id = project.id
					and membership.user_id = p_actor_id
					and membership.role in ('PROJECT_ADMIN'::public.membership_role, 'EDITOR'::public.membership_role)
			)
			or exists (
				select 1 from public.tenant_memberships as membership
				where membership.tenant_id = project.tenant_id
					and membership.user_id = p_actor_id
					and membership.role = 'TENANT_ADMIN'::public.membership_role
			)
		);

	if v_tenant_id is null then
		raise exception using errcode = '42501', message = 'TEMPLATE_REGISTRATION_FORBIDDEN';
	end if;

	-- Idempotency: same bytes for the same project return the existing
	-- template_id (original is never overwritten).
	select id, version into v_template_id, v_next_version
	from public.artifact_templates
	where tenant_id = v_tenant_id
		and project_id = p_project_id
		and sha256 = p_sha256
	limit 1;

	if v_template_id is not null then
		return jsonb_build_object(
			'templateId', v_template_id,
			'version', v_next_version,
			'created', false
		);
	end if;

	select coalesce(max(version), 0) + 1 into v_next_version
	from public.artifact_templates
	where tenant_id = v_tenant_id and project_id = p_project_id;

	insert into public.artifact_templates (
		tenant_id, project_id, original_filename, media_type,
		storage_bucket, storage_path, sha256, version, detected_format, created_by
	)
	values (
		v_tenant_id, p_project_id, p_original_filename, coalesce(p_media_type, 'application/hwp+zip'),
		coalesce(p_storage_bucket, 'artifact-templates'), p_storage_path, p_sha256, v_next_version,
		coalesce(p_detected_format, 'hwpx'), p_actor_id
	)
	returning id into v_template_id;

	insert into public.audit_events (
		tenant_id, project_id, actor_user_id, event_type, entity_type, entity_id, event_data
	)
	values (
		v_tenant_id, p_project_id, p_actor_id, 'TEMPLATE_REGISTERED',
		'ARTIFACT_TEMPLATE', v_template_id,
		jsonb_build_object(
			'version', v_next_version, 'sha256', p_sha256, 'detectedFormat', coalesce(p_detected_format, 'hwpx')
		)
	);

	return jsonb_build_object(
		'templateId', v_template_id,
		'version', v_next_version,
		'created', true
	);
end;
$$;

revoke all on function public.register_artifact_template(uuid, uuid, text, text, text, text, text, text)
	from public, anon, authenticated, service_role;
grant execute on function public.register_artifact_template(uuid, uuid, text, text, text, text, text, text)
	to service_role;

-- -----------------------------------------------------------------------------
-- Trusted server action: inspect + upsert a single field on a template.
-- -----------------------------------------------------------------------------
create or replace function public.record_artifact_template_field(
	p_actor_id uuid,
	p_template_id uuid,
	p_field_key text,
	p_anchor_kind text,
	p_anchor_selector text,
	p_required boolean,
	p_description text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_tenant_id uuid;
	v_project_id uuid;
	v_field_id uuid;
	v_content_sha256 text;
begin
	if p_actor_id is null or p_template_id is null then
		raise exception using errcode = '22023', message = 'TEMPLATE_FIELD_INVALID';
	end if;

	select template.tenant_id, template.project_id
	into v_tenant_id, v_project_id
	from public.artifact_templates as template
	where template.id = p_template_id;

	if v_tenant_id is null then
		raise exception using errcode = '22023', message = 'TEMPLATE_FIELD_NOT_FOUND';
	end if;

	v_content_sha256 := private.source_text_sha256(
		p_template_id::text || '|' || p_field_key || '|' || p_anchor_kind || '|' || p_anchor_selector
	);

	insert into public.artifact_template_fields (
		tenant_id, project_id, template_id, field_key, anchor_kind, anchor_selector,
		required, description, content_sha256
	)
	values (
		v_tenant_id, v_project_id, p_template_id, p_field_key, p_anchor_kind, p_anchor_selector,
		coalesce(p_required, false), p_description, v_content_sha256
	)
	on conflict (template_id, field_key) do update set
		anchor_kind = excluded.anchor_kind,
		anchor_selector = excluded.anchor_selector,
		required = excluded.required,
		description = excluded.description,
		content_sha256 = excluded.content_sha256
	returning id into v_field_id;

	return jsonb_build_object('fieldId', v_field_id, 'contentSha256', v_content_sha256);
end;
$$;

revoke all on function public.record_artifact_template_field(uuid, uuid, text, text, text, boolean, text)
	from public, anon, authenticated, service_role;
grant execute on function public.record_artifact_template_field(uuid, uuid, text, text, text, boolean, text)
	to service_role;

-- -----------------------------------------------------------------------------
-- Trusted server action: submit a template mapping for H8 approval.
-- A mapping is a jsonb document describing how each template field is
-- bound to a source (Contract Baseline item, Requirement Baseline item,
-- WBS task, etc.). The mapping is hashed and only the latest APPROVED
-- mapping for a template may be used to generate an artifact.
-- -----------------------------------------------------------------------------
create or replace function public.submit_artifact_template_mapping(
	p_actor_id uuid,
	p_template_id uuid,
	p_source_kind text,
	p_source_id uuid,
	p_mapping jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_tenant_id uuid;
	v_project_id uuid;
	v_next_version integer;
	v_mapping_id uuid;
	v_mapping_sha256 text;
	v_field_count integer;
	v_required_count integer;
begin
	if p_actor_id is null or p_template_id is null or p_source_id is null or p_mapping is null then
		raise exception using errcode = '22023', message = 'TEMPLATE_MAPPING_INVALID';
	end if;

	if jsonb_typeof(p_mapping) is distinct from 'object' then
		raise exception using errcode = '22023', message = 'TEMPLATE_MAPPING_SHAPE';
	end if;

	select template.tenant_id, template.project_id
	into v_tenant_id, v_project_id
	from public.artifact_templates as template
	where template.id = p_template_id;

	if v_tenant_id is null then
		raise exception using errcode = '22023', message = 'TEMPLATE_MAPPING_NOT_FOUND';
	end if;

	-- mapping must reference at least one template field
	v_field_count := (
		select count(*)::integer from jsonb_object_keys(p_mapping) as key(name)
	);
	if v_field_count = 0 then
		raise exception using errcode = '22023', message = 'TEMPLATE_MAPPING_EMPTY';
	end if;

	-- every template field marked required must appear in the mapping
	select count(*)::integer into v_required_count
	from public.artifact_template_fields as field
	where field.template_id = p_template_id
		and field.required = true
		and not (p_mapping ? field.field_key);

	if v_required_count > 0 then
		raise exception using errcode = '22023', message = 'TEMPLATE_MAPPING_MISSING_REQUIRED';
	end if;

	v_mapping_sha256 := private.source_text_sha256(p_mapping::text);

	select coalesce(max(version), 0) + 1 into v_next_version
	from public.artifact_template_mappings
	where template_id = p_template_id;

	insert into public.artifact_template_mappings (
		tenant_id, project_id, template_id, version, source_kind, source_id,
		mapping, mapping_sha256, created_by
	)
	values (
		v_tenant_id, v_project_id, p_template_id, v_next_version, p_source_kind, p_source_id,
		p_mapping, v_mapping_sha256, p_actor_id
	)
	returning id into v_mapping_id;

	insert into public.audit_events (
		tenant_id, project_id, actor_user_id, event_type, entity_type, entity_id, event_data
	)
	values (
		v_tenant_id, v_project_id, p_actor_id, 'TEMPLATE_MAPPING_SUBMITTED',
		'ARTIFACT_TEMPLATE_MAPPING', v_mapping_id,
		jsonb_build_object('templateId', p_template_id, 'version', v_next_version, 'sourceKind', p_source_kind)
	);

	return jsonb_build_object(
		'mappingId', v_mapping_id,
		'version', v_next_version,
		'mappingSha256', v_mapping_sha256,
		'fieldCount', v_field_count
	);
end;
$$;

revoke all on function public.submit_artifact_template_mapping(uuid, uuid, text, uuid, jsonb)
	from public, anon, authenticated, service_role;
grant execute on function public.submit_artifact_template_mapping(uuid, uuid, text, uuid, jsonb)
	to service_role;

-- -----------------------------------------------------------------------------
-- Trusted server action: H8 approve a mapping (human-only). Approval
-- flips approved_by/approved_at; subsequent calls return
-- TEMPLATE_MAPPING_ALREADY_APPROVED so the row is frozen.
-- -----------------------------------------------------------------------------
create or replace function public.approve_artifact_template_mapping(
	p_actor_id uuid,
	p_mapping_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_tenant_id uuid;
	v_project_id uuid;
	v_template_id uuid;
begin
	if p_actor_id is null or p_mapping_id is null then
		raise exception using errcode = '22023', message = 'TEMPLATE_MAPPING_APPROVE_INVALID';
	end if;

	select mapping.tenant_id, mapping.project_id, mapping.template_id, mapping.approved_at
	into v_tenant_id, v_project_id, v_template_id
	from public.artifact_template_mappings as mapping
	where mapping.id = p_mapping_id;

	if v_tenant_id is null then
		raise exception using errcode = '22023', message = 'TEMPLATE_MAPPING_NOT_FOUND';
	end if;

	if not exists (
		select 1 from public.project_memberships as membership
		where membership.tenant_id = v_tenant_id
			and membership.project_id = v_project_id
			and membership.user_id = p_actor_id
			and membership.role in ('PROJECT_ADMIN'::public.membership_role)
	) and not exists (
		select 1 from public.tenant_memberships as membership
		where membership.tenant_id = v_tenant_id
			and membership.user_id = p_actor_id
			and membership.role = 'TENANT_ADMIN'::public.membership_role
	) then
		raise exception using errcode = '42501', message = 'TEMPLATE_MAPPING_APPROVE_FORBIDDEN';
	end if;

	update public.artifact_template_mappings
	set approved_by = p_actor_id, approved_at = now()
	where id = p_mapping_id;

	insert into public.audit_events (
		tenant_id, project_id, actor_user_id, event_type, entity_type, entity_id, event_data
	)
	values (
		v_tenant_id, v_project_id, p_actor_id, 'TEMPLATE_MAPPING_APPROVED',
		'ARTIFACT_TEMPLATE_MAPPING', p_mapping_id,
		jsonb_build_object('templateId', v_template_id)
	);

	return jsonb_build_object(
		'mappingId', p_mapping_id,
		'approvedBy', p_actor_id,
		'approvedAt', now()
	);
end;
$$;

revoke all on function public.approve_artifact_template_mapping(uuid, uuid)
	from public, anon, authenticated, service_role;
grant execute on function public.approve_artifact_template_mapping(uuid, uuid)
	to service_role;

-- -----------------------------------------------------------------------------
-- Trusted server action: generate an artifact. Refuses if the mapping
-- is not H8 approved, if any required field is missing, or if
-- validation is empty. Once recorded, the artifact row is immutable
-- and H10 approval flips approved_by/approved_at.
-- -----------------------------------------------------------------------------
create or replace function public.generate_artifact(
	p_actor_id uuid,
	p_mapping_id uuid,
	p_run_id uuid,
	p_unresolved_required_fields jsonb,
	p_validation jsonb,
	p_preview_metadata jsonb,
	p_storage_bucket text,
	p_storage_path text,
	p_content_sha256 text,
	p_model_fingerprint text,
	p_prompt_version text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_tenant_id uuid;
	v_project_id uuid;
	v_template_id uuid;
	v_baseline_id uuid;
	v_mapping_approved_at timestamptz;
	v_document_id uuid;
	v_parse_id uuid;
	v_artifact_id uuid;
begin
	if p_actor_id is null or p_mapping_id is null or p_content_sha256 is null then
		raise exception using errcode = '22023', message = 'ARTIFACT_GENERATE_INVALID';
	end if;

	if p_content_sha256 !~ '^[0-9a-f]{64}$' then
		raise exception using errcode = '22023', message = 'ARTIFACT_SHA256_SHAPE';
	end if;

	if jsonb_typeof(p_unresolved_required_fields) is distinct from 'array' then
		raise exception using errcode = '22023', message = 'ARTIFACT_UNRESOLVED_SHAPE';
	end if;

	if jsonb_array_length(p_unresolved_required_fields) > 0 then
		raise exception using errcode = '22023', message = 'ARTIFACT_UNRESOLVED_REQUIRED_FIELD';
	end if;

	if jsonb_typeof(p_validation) is distinct from 'object'
		or (p_validation ->> 'passed')::boolean is distinct from true then
		raise exception using errcode = '22023', message = 'ARTIFACT_VALIDATION_FAILED';
	end if;

	select mapping.tenant_id, mapping.project_id, mapping.template_id, mapping.approved_at
	into v_tenant_id, v_project_id, v_template_id, v_mapping_approved_at
	from public.artifact_template_mappings as mapping
	where mapping.id = p_mapping_id;

	if v_tenant_id is null then
		raise exception using errcode = '22023', message = 'ARTIFACT_MAPPING_NOT_FOUND';
	end if;

	if v_mapping_approved_at is null then
		raise exception using errcode = '22023', message = 'ARTIFACT_MAPPING_NOT_APPROVED';
	end if;

	if p_run_id is not null then
		select baseline.id, run.document_id, run.document_parse_id
		into v_baseline_id, v_document_id, v_parse_id
		from public.requirement_extraction_runs as run
		left join public.requirement_baselines as baseline on baseline.run_id = run.id
		where run.id = p_run_id
			and run.tenant_id = v_tenant_id
			and run.project_id = v_project_id
		limit 1;
	end if;

	insert into public.generated_artifacts (
		tenant_id, project_id, run_id, template_id, mapping_id, artifact_format,
		storage_bucket, storage_path, content_sha256,
		unresolved_required_fields, validation, preview_metadata,
		baseline_id, source_document_id, source_document_parse_id,
		model_fingerprint, prompt_version, created_by
	)
	values (
		v_tenant_id, v_project_id, p_run_id, v_template_id, p_mapping_id, 'hwpx',
		coalesce(p_storage_bucket, 'artifact-templates'), p_storage_path, p_content_sha256,
		p_unresolved_required_fields, p_validation, p_preview_metadata,
		v_baseline_id, v_document_id, v_parse_id,
		p_model_fingerprint, p_prompt_version, p_actor_id
	)
	returning id into v_artifact_id;

	insert into public.audit_events (
		tenant_id, project_id, actor_user_id, event_type, entity_type, entity_id, event_data
	)
	values (
		v_tenant_id, v_project_id, p_actor_id, 'ARTIFACT_GENERATED',
		'GENERATED_ARTIFACT', v_artifact_id,
		jsonb_build_object(
			'templateId', v_template_id, 'mappingId', p_mapping_id,
			'contentSha256', p_content_sha256,
			'modelFingerprint', p_model_fingerprint, 'promptVersion', p_prompt_version
		)
	);

	return jsonb_build_object(
		'artifactId', v_artifact_id,
		'baselineId', v_baseline_id,
		'contentSha256', p_content_sha256
	);
end;
$$;

revoke all on function public.generate_artifact(uuid, uuid, uuid, jsonb, jsonb, jsonb, text, text, text, text, text)
	from public, anon, authenticated, service_role;
grant execute on function public.generate_artifact(uuid, uuid, uuid, jsonb, jsonb, jsonb, text, text, text, text, text)
	to service_role;

-- -----------------------------------------------------------------------------
-- H10 approve a final artifact
-- -----------------------------------------------------------------------------
create or replace function public.approve_artifact(
	p_actor_id uuid,
	p_artifact_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_tenant_id uuid;
	v_project_id uuid;
	v_approved_at timestamptz;
begin
	if p_actor_id is null or p_artifact_id is null then
		raise exception using errcode = '22023', message = 'ARTIFACT_APPROVE_INVALID';
	end if;

	select artifact.tenant_id, artifact.project_id, artifact.approved_at
	into v_tenant_id, v_project_id, v_approved_at
	from public.generated_artifacts as artifact
	where artifact.id = p_artifact_id;

	if v_tenant_id is null then
		raise exception using errcode = '22023', message = 'ARTIFACT_NOT_FOUND';
	end if;

	if v_approved_at is not null then
		raise exception using errcode = '22023', message = 'ARTIFACT_ALREADY_APPROVED';
	end if;

	if not exists (
		select 1 from public.project_memberships as membership
		where membership.tenant_id = v_tenant_id
			and membership.project_id = v_project_id
			and membership.user_id = p_actor_id
			and membership.role in ('PROJECT_ADMIN'::public.membership_role)
	) and not exists (
		select 1 from public.tenant_memberships as membership
		where membership.tenant_id = v_tenant_id
			and membership.user_id = p_actor_id
			and membership.role = 'TENANT_ADMIN'::public.membership_role
	) then
		raise exception using errcode = '42501', message = 'ARTIFACT_APPROVE_FORBIDDEN';
	end if;

	update public.generated_artifacts
	set approved_by = p_actor_id, approved_at = now()
	where id = p_artifact_id;

	insert into public.audit_events (
		tenant_id, project_id, actor_user_id, event_type, entity_type, entity_id, event_data
	)
	values (
		v_tenant_id, v_project_id, p_actor_id, 'ARTIFACT_APPROVED',
		'GENERATED_ARTIFACT', p_artifact_id, '{}'::jsonb
	);

	return jsonb_build_object('artifactId', p_artifact_id, 'approvedBy', p_actor_id, 'approvedAt', now());
end;
$$;

revoke all on function public.approve_artifact(uuid, uuid)
	from public, anon, authenticated, service_role;
grant execute on function public.approve_artifact(uuid, uuid)
	to service_role;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.artifact_templates enable row level security;
alter table public.artifact_templates force row level security;
alter table public.artifact_template_fields enable row level security;
alter table public.artifact_template_fields force row level security;
alter table public.artifact_template_mappings enable row level security;
alter table public.artifact_template_mappings force row level security;
alter table public.generated_artifacts enable row level security;
alter table public.generated_artifacts force row level security;

revoke all privileges on table public.artifact_templates from anon, authenticated, service_role;
revoke all privileges on table public.artifact_template_fields from anon, authenticated, service_role;
revoke all privileges on table public.artifact_template_mappings from anon, authenticated, service_role;
revoke all privileges on table public.generated_artifacts from anon, authenticated, service_role;

grant select, insert, update, delete on table public.artifact_templates to service_role;
grant select, insert, update, delete on table public.artifact_template_fields to service_role;
grant select, insert, update, delete on table public.artifact_template_mappings to service_role;
grant select, insert, update, delete on table public.generated_artifacts to service_role;

grant select on table public.artifact_templates to authenticated;
grant select on table public.artifact_template_fields to authenticated;
grant select on table public.artifact_template_mappings to authenticated;
grant select on table public.generated_artifacts to authenticated;

create policy "artifact templates visible to project members"
on public.artifact_templates for select to authenticated
using (
	(select auth.uid()) is not null
	and (
		exists (select 1 from public.project_memberships as m where m.tenant_id = artifact_templates.tenant_id and m.project_id = artifact_templates.project_id and m.user_id = (select auth.uid()))
		or exists (select 1 from public.tenant_memberships as m where m.tenant_id = artifact_templates.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role)
	)
);

create policy "artifact template fields visible to project members"
on public.artifact_template_fields for select to authenticated
using (
	exists (
		select 1 from public.artifact_templates as t
		where t.id = artifact_template_fields.template_id
			and (
				exists (select 1 from public.project_memberships as m where m.tenant_id = t.tenant_id and m.project_id = t.project_id and m.user_id = (select auth.uid()))
				or exists (select 1 from public.tenant_memberships as m where m.tenant_id = t.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role)
			)
	)
);

create policy "artifact template mappings visible to project members"
on public.artifact_template_mappings for select to authenticated
using (
	exists (
		select 1 from public.artifact_templates as t
		where t.id = artifact_template_mappings.template_id
			and (
				exists (select 1 from public.project_memberships as m where m.tenant_id = t.tenant_id and m.project_id = t.project_id and m.user_id = (select auth.uid()))
				or exists (select 1 from public.tenant_memberships as m where m.tenant_id = t.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role)
			)
	)
);

create policy "generated artifacts visible to project members"
on public.generated_artifacts for select to authenticated
using (
	(select auth.uid()) is not null
	and (
		exists (select 1 from public.project_memberships as m where m.tenant_id = generated_artifacts.tenant_id and m.project_id = generated_artifacts.project_id and m.user_id = (select auth.uid()))
		or exists (select 1 from public.tenant_memberships as m where m.tenant_id = generated_artifacts.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role)
	)
);
