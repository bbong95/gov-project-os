-- MVP3 Project Baseline Generator server-side functions.
-- SECURITY DEFINER so the existing trusted-mutation contract holds.

create or replace function public.upsert_wbs_task(
	p_actor_id uuid,
	p_genome_id uuid,
	p_requirement_external_id text,
	p_task_title text,
	p_start_day integer,
	p_end_day integer,
	p_owner text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_requirement_id uuid;
	v_tenant_id uuid;
	v_project_id uuid;
	v_id uuid;
begin
	if p_actor_id is null or p_genome_id is null or p_requirement_external_id is null then
		raise exception using errcode = '22023', message = 'WBS_TASK_INPUT_INVALID';
	end if;
	if p_end_day < p_start_day then
		raise exception using errcode = '22023', message = 'WBS_TASK_DATES_INVALID';
	end if;

	select g.tenant_id, g.project_id into v_tenant_id, v_project_id
	from public.project_genome as g
	where g.id = p_genome_id;
	if v_tenant_id is null then
		raise exception using errcode = '22023', message = 'WBS_TASK_GENOME_NOT_FOUND';
	end if;

	select r.id into v_requirement_id
	from public.genome_requirements as r
	where r.genome_id = p_genome_id and r.external_id = p_requirement_external_id
	limit 1;
	if v_requirement_id is null then
		raise exception using errcode = '22023', message = 'WBS_TASK_REQUIREMENT_NOT_FOUND';
	end if;

	insert into public.genome_wbs_tasks (
		tenant_id, project_id, genome_id, genome_version,
		external_id, title, parent_external_id,
		deliverable_external_id, owner,
		start_offset_days, end_offset_days, effort_hours
	)
	values (
		v_tenant_id, v_project_id, p_genome_id, 1,
		p_requirement_external_id, p_task_title, null,
		null, p_owner,
		greatest(p_start_day, 0), greatest(p_end_day, 0), null
	)
	on conflict (tenant_id, project_id, genome_id, genome_version, external_id) do update set
		title = excluded.title,
		owner = excluded.owner,
		start_offset_days = excluded.start_offset_days,
		end_offset_days = excluded.end_offset_days
	returning id into v_id;

	insert into public.genome_audit_events (
		tenant_id, project_id, genome_id, actor_user_id,
		event_type, entity_type, entity_id, event_data
	)
	values (
		v_tenant_id, v_project_id, p_genome_id, p_actor_id,
		'WBS_TASK_UPSERTED', 'GENOME_WBS_TASK', v_id,
		jsonb_build_object(
			'requirementExternalId', p_requirement_external_id,
			'startDay', greatest(p_start_day, 0),
			'endDay', greatest(p_end_day, 0),
			'owner', p_owner
		)
	);

	return v_id;
end;
$$;

revoke all on function public.upsert_wbs_task(uuid, uuid, text, text, integer, integer, text) from public, anon, authenticated, service_role;
grant execute on function public.upsert_wbs_task(uuid, uuid, text, text, integer, integer, text) to service_role;

create or replace function public.upsert_inspection_criterion(
	p_actor_id uuid,
	p_genome_id uuid,
	p_requirement_external_id text,
	p_deliverable_external_id text,
	p_criterion text,
	p_method text,
	p_acceptance text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_requirement_id uuid;
	v_tenant_id uuid;
	v_project_id uuid;
	v_id uuid;
begin
	if p_actor_id is null or p_genome_id is null or p_requirement_external_id is null then
		raise exception using errcode = '22023', message = 'INSPECTION_INPUT_INVALID';
	end if;

	select g.tenant_id, g.project_id into v_tenant_id, v_project_id
	from public.project_genome as g
	where g.id = p_genome_id;
	if v_tenant_id is null then
		raise exception using errcode = '22023', message = 'INSPECTION_GENOME_NOT_FOUND';
	end if;

	select r.id into v_requirement_id
	from public.genome_requirements as r
	where r.genome_id = p_genome_id and r.external_id = p_requirement_external_id
	limit 1;
	if v_requirement_id is null then
		raise exception using errcode = '22023', message = 'INSPECTION_REQUIREMENT_NOT_FOUND';
	end if;

	insert into public.genome_inspection_criteria (
		tenant_id, project_id, genome_id, genome_version,
		external_id, requirement_id, criterion, method, acceptance
	)
	values (
		v_tenant_id, v_project_id, p_genome_id, 1,
		concat(p_requirement_external_id, '|', coalesce(p_deliverable_external_id, 'NONE')),
		v_requirement_id, p_criterion, p_method, p_acceptance
	)
	on conflict (tenant_id, project_id, genome_id, genome_version, external_id) do update set
		criterion = excluded.criterion,
		method = excluded.method,
		acceptance = excluded.acceptance
	returning id into v_id;

	insert into public.genome_audit_events (
		tenant_id, project_id, genome_id, actor_user_id,
		event_type, entity_type, entity_id, event_data
	)
	values (
		v_tenant_id, v_project_id, p_genome_id, p_actor_id,
		'INSPECTION_CRITERION_UPSERTED', 'GENOME_INSPECTION_CRITERION', v_id,
		jsonb_build_object(
			'requirementExternalId', p_requirement_external_id,
			'deliverableExternalId', p_deliverable_external_id
		)
	);

	return v_id;
end;
$$;

revoke all on function public.upsert_inspection_criterion(uuid, uuid, text, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.upsert_inspection_criterion(uuid, uuid, text, text, text, text, text) to service_role;
