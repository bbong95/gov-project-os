-- MVP2 Proposal Planner server-side functions.
-- SECURITY DEFINER so service-role-only mutation holds, mirroring the
-- MVP1 contract.

create or replace function public.upsert_proposal_section(
	p_actor_id uuid,
	p_genome_id uuid,
	p_section_key text,
	p_title text,
	p_body_md text,
	p_word_count integer,
	p_prompt_version text,
	p_model_fingerprint text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_section_id uuid;
begin
	if p_actor_id is null or p_genome_id is null or p_section_key is null then
		raise exception using errcode = '22023', message = 'PROPOSAL_SECTION_INPUT_INVALID';
	end if;
	if length(btrim(p_section_key)) between 1 and 64 is false then
		raise exception using errcode = '22023', message = 'PROPOSAL_SECTION_KEY_SHAPE';
	end if;
	if not exists (
		select 1 from public.project_genome as g
		where g.id = p_genome_id
			and (
				exists (select 1 from public.project_memberships as m where m.tenant_id = g.tenant_id and m.project_id = g.project_id and m.user_id = p_actor_id and m.role in ('PROJECT_ADMIN'::public.membership_role, 'EDITOR'::public.membership_role, 'REVIEWER'::public.membership_role))
				or exists (select 1 from public.tenant_memberships as m where m.tenant_id = g.tenant_id and m.user_id = p_actor_id and m.role = 'TENANT_ADMIN'::public.membership_role)
			)
	) then
		raise exception using errcode = '42501', message = 'PROPOSAL_SECTION_FORBIDDEN';
	end if;

	insert into public.genome_proposal_sections (
		tenant_id, project_id, genome_id,
		section_key, title, body_md, word_count,
		prompt_version, model_fingerprint, created_by
	)
	select
		g.tenant_id, g.project_id, g.id,
		p_section_key, p_title, p_body_md, greatest(p_word_count, 0),
		p_prompt_version, p_model_fingerprint, p_actor_id
	from public.project_genome as g
	where g.id = p_genome_id
	on conflict (genome_id, section_key) do update set
		title = excluded.title,
		body_md = excluded.body_md,
		word_count = excluded.word_count,
		prompt_version = excluded.prompt_version,
		model_fingerprint = excluded.model_fingerprint,
		human_edited = public.genome_proposal_sections.human_edited
	returning id into v_section_id;

	insert into public.genome_audit_events (
		tenant_id, project_id, genome_id, actor_user_id,
		event_type, entity_type, entity_id, event_data
	)
	select
		g.tenant_id, g.project_id, g.id, p_actor_id,
		'PROPOSAL_SECTION_UPSERTED', 'GENOME_PROPOSAL_SECTION', v_section_id,
		jsonb_build_object('sectionKey', p_section_key, 'wordCount', greatest(p_word_count, 0))
	from public.project_genome as g
	where g.id = p_genome_id;

	return v_section_id;
end;
$$;

revoke all on function public.upsert_proposal_section(uuid, uuid, text, text, text, integer, text, text) from public, anon, authenticated, service_role;
grant execute on function public.upsert_proposal_section(uuid, uuid, text, text, text, integer, text, text) to service_role;

create or replace function public.upsert_compliance_row(
	p_actor_id uuid,
	p_genome_id uuid,
	p_requirement_external_id text,
	p_evaluation_item_external_id text,
	p_proposal_section_id uuid,
	p_status text,
	p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_requirement_id uuid;
	v_evaluation_id uuid;
	v_row_id uuid;
begin
	if p_actor_id is null or p_genome_id is null or p_requirement_external_id is null or p_status is null then
		raise exception using errcode = '22023', message = 'COMPLIANCE_ROW_INPUT_INVALID';
	end if;
	if p_status not in ('ADDRESSED', 'PARTIAL', 'PLANNED', 'GAP') then
		raise exception using errcode = '22023', message = 'COMPLIANCE_STATUS_INVALID';
	end if;

	select r.id into v_requirement_id
	from public.genome_requirements as r
	where r.genome_id = p_genome_id and r.external_id = p_requirement_external_id
	limit 1;
	if v_requirement_id is null then
		raise exception using errcode = '22023', message = 'COMPLIANCE_REQUIREMENT_NOT_FOUND';
	end if;

	if p_evaluation_item_external_id is not null then
		select e.id into v_evaluation_id
		from public.genome_evaluation_items as e
		where e.genome_id = p_genome_id and e.external_id = p_evaluation_item_external_id
		limit 1;
	end if;

	insert into public.genome_compliance_matrix (
		tenant_id, project_id, genome_id,
		requirement_id, evaluation_item_id, proposal_section_id,
		status, notes, created_by
	)
	select
		g.tenant_id, g.project_id, g.id,
		v_requirement_id, v_evaluation_id, p_proposal_section_id,
		p_status, coalesce(p_notes, ''), p_actor_id
	from public.project_genome as g
	where g.id = p_genome_id
	on conflict (genome_id, requirement_id, evaluation_item_id) do update set
		proposal_section_id = excluded.proposal_section_id,
		status = excluded.status,
		notes = excluded.notes,
		updated_at = now()
	returning id into v_row_id;

	insert into public.genome_audit_events (
		tenant_id, project_id, genome_id, actor_user_id,
		event_type, entity_type, entity_id, event_data
	)
	select
		g.tenant_id, g.project_id, g.id, p_actor_id,
		'COMPLIANCE_ROW_UPSERTED', 'GENOME_COMPLIANCE_MATRIX', v_row_id,
		jsonb_build_object(
			'requirementExternalId', p_requirement_external_id,
			'evaluationItemExternalId', p_evaluation_item_external_id,
			'status', p_status
		)
	from public.project_genome as g
	where g.id = p_genome_id;

	return v_row_id;
end;
$$;

revoke all on function public.upsert_compliance_row(uuid, uuid, text, text, uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.upsert_compliance_row(uuid, uuid, text, text, uuid, text, text) to service_role;

create or replace function public.upsert_winning_point(
	p_actor_id uuid,
	p_genome_id uuid,
	p_theme text,
	p_rationale text,
	p_target_evaluation_items text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_id uuid;
begin
	if p_actor_id is null or p_genome_id is null or p_theme is null then
		raise exception using errcode = '22023', message = 'WINNING_POINT_INPUT_INVALID';
	end if;

	insert into public.genome_compliance_matrix (
		tenant_id, project_id, genome_id,
		requirement_id, evaluation_item_id, proposal_section_id,
		status, notes, created_by
	)
	select
		g.tenant_id, g.project_id, g.id,
		null, null, null,
		'PLANNED',
		jsonb_build_object(
			'kind', 'WINNING_POINT',
			'theme', p_theme,
			'rationale', p_rationale,
			'targetEvaluationItems', to_jsonb(coalesce(p_target_evaluation_items, '{}'::text[]))
		)::text,
		p_actor_id
	from public.project_genome as g
	where g.id = p_genome_id
	returning id into v_id;

	insert into public.genome_audit_events (
		tenant_id, project_id, genome_id, actor_user_id,
		event_type, entity_type, entity_id, event_data
	)
	select
		g.tenant_id, g.project_id, g.id, p_actor_id,
		'WINNING_POINT_UPSERTED', 'GENOME_COMPLIANCE_MATRIX', v_id,
		jsonb_build_object('theme', p_theme, 'targetEvaluationItems', to_jsonb(coalesce(p_target_evaluation_items, '{}'::text[])))
	from public.project_genome as g
	where g.id = p_genome_id;

	return v_id;
end;
$$;

revoke all on function public.upsert_winning_point(uuid, uuid, text, text, text[]) from public, anon, authenticated, service_role;
grant execute on function public.upsert_winning_point(uuid, uuid, text, text, text[]) to service_role;

-- Compliance coverage report — a single jsonb that the UI uses to
-- render the headline coverage ring and the gap list.
create or replace function public.load_compliance_report(
	p_tenant_id uuid,
	p_project_id uuid,
	p_genome_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
	v_total integer;
	v_addressed integer;
	v_partial integer;
	v_gap integer;
	v_planned integer;
	v_coverage numeric(5,2);
begin
	select
		count(*)::integer,
		count(*) filter (where status = 'ADDRESSED')::integer,
		count(*) filter (where status = 'PARTIAL')::integer,
		count(*) filter (where status = 'GAP')::integer,
		count(*) filter (where status = 'PLANNED')::integer
	into v_total, v_addressed, v_partial, v_gap, v_planned
	from public.genome_compliance_matrix as cm
	where cm.genome_id = p_genome_id
		and cm.requirement_id is not null
		and not (cm.notes ? 'kind')
		and cm.requirement_id in (select r.id from public.genome_requirements as r where r.genome_id = p_genome_id);

	if v_total = 0 then
		v_coverage := 0;
	else
		v_coverage := round((v_addressed::numeric / v_total::numeric) * 100, 2);
	end if;

	return jsonb_build_object(
		'total', v_total,
		'addressed', v_addressed,
		'partial', v_partial,
		'gap', v_gap,
		'planned', v_planned,
		'coverage', v_coverage
	);
end;
$$;

revoke all on function public.load_compliance_report(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.load_compliance_report(uuid, uuid, uuid) to service_role;
