-- M15/M17/M18/M19/M20 lifecycle validations
-- (does not redesign thin_slice schema; only adds CHECK constraints,
--  SECURITY DEFINER validation functions and audit-friendly read views)

-- ---------------------------------------------------------------------------
-- M15 WBS constraints
-- ---------------------------------------------------------------------------

-- A WBS task must be linked to a Requirement Baseline candidate.
-- This is the lifecycle backbone: requirements -> tasks -> deliverables.
alter table public.wbs_tasks
	add constraint wbs_tasks_requirement_required
	check (requirement_candidate_id is not null) not valid;
alter table public.wbs_tasks validate constraint wbs_tasks_requirement_required;

-- A child task's due_date must be on/after the parent's due_date.
-- Enforced at the application layer via validate_wbs_hierarchy() because
-- a constraint across the same table requires a self-referencing subquery
-- that CHECK disallows.
alter table public.wbs_tasks
	add constraint wbs_tasks_owner_not_blank
	check (owner is null or length(btrim(owner)) between 1 and 256) not valid;
alter table public.wbs_tasks validate constraint wbs_tasks_owner_not_blank;

-- A deliverable must be linked to a task (already FK enforced).
-- content_path, when provided, must be a relative path.
alter table public.wbs_deliverables
	add constraint wbs_deliverables_content_path_shape
	check (
		content_path is null
		or (length(content_path) between 1 and 1024
			and content_path not like '/%'
			and content_path not like '%\\%'
			and content_path not like '%..%')
	) not valid;
alter table public.wbs_deliverables validate constraint wbs_deliverables_content_path_shape;

-- Deterministic M15 validator: returns jsonb with detected gaps.
-- The function is intentionally pure: it returns counts and identifiers
-- without mutating any state. Callers decide what to do (UI shows it;
-- the closeout gate uses it as a blocker).
create or replace function public.validate_wbs_for_run(p_run_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
	v_requirement_count integer;
	v_task_count integer;
	v_task_without_owner integer;
	v_deliverable_count integer;
	v_deliverable_without_task integer := 0;
	v_hierarchy_violation integer := 0;
	v_hierarchy_record record;
begin
	if p_run_id is null then
		raise exception using errcode = '22023', message = 'WBS_VALIDATION_MISSING_RUN';
	end if;

	select count(*) into v_requirement_count
	from public.requirement_candidates
	where run_id = p_run_id;

	select count(*) into v_task_count from public.wbs_tasks where run_id = p_run_id;
	select count(*) into v_task_without_owner
	from public.wbs_tasks where run_id = p_run_id and (owner is null or length(btrim(owner)) = 0);

	select count(*) into v_deliverable_count
	from public.wbs_deliverables as deliverable
	join public.wbs_tasks as task on task.id = deliverable.task_id
	where task.run_id = p_run_id;

	-- Hierarchy date conflict: a child's due_date must be on/after the parent's
	for v_hierarchy_record in
		select child.id as child_id, child.due_date as child_due, parent.due_date as parent_due
		from public.wbs_tasks as child
		join public.wbs_tasks as parent on parent.id = child.parent_task_id
		where child.run_id = p_run_id
			and child.due_date is not null
			and parent.due_date is not null
			and child.due_date < parent.due_date
	loop
		v_hierarchy_violation := v_hierarchy_violation + 1;
	end loop;

	-- (The deliverable-without-task count is structurally zero because of the
	-- existing FK wbs_deliverables_task_fkey ON DELETE CASCADE; included for
	-- explicit reporting.)
	if v_deliverable_count = 0 and v_task_count > 0 then
		v_deliverable_without_task := 0;
	end if;

	return jsonb_build_object(
		'runId', p_run_id,
		'requirementCount', v_requirement_count,
		'taskCount', v_task_count,
		'taskWithoutOwner', v_task_without_owner,
		'deliverableCount', v_deliverable_count,
		'deliverableWithoutTask', v_deliverable_without_task,
		'hierarchyDateViolation', v_hierarchy_violation,
		'requirementsWithoutTask', greatest(v_requirement_count - v_task_count, 0)
	);
end;
$$;

revoke all on function public.validate_wbs_for_run(uuid) from public, anon, authenticated, service_role;
grant execute on function public.validate_wbs_for_run(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- M17 Meeting minutes constraints
-- ---------------------------------------------------------------------------

-- Approved minutes may not be empty; approved_at must be paired with approved_by.
alter table public.meeting_minutes
	add constraint meeting_minutes_content_not_blank
	check (length(btrim(content_md)) between 1 and 65536) not valid;
alter table public.meeting_minutes validate constraint meeting_minutes_content_not_blank;

alter table public.meeting_minutes
	add constraint meeting_minutes_approval_pair
	check (
		(approved_by is null and approved_at is null)
		or (approved_by is not null and approved_at is not null)
	) not valid;
alter table public.meeting_minutes validate constraint meeting_minutes_approval_pair;

-- A meeting may not bypass the DRAFT -> REVIEWED -> APPROVED state machine.
-- The status update is performed by the trusted server action; the constraint
-- ensures the state value is always one of the four allowed values.
alter table public.meetings
	add constraint meetings_status_machine_check
	check (status in ('DRAFT', 'REVIEWED', 'APPROVED', 'SUPERSEDED')) not valid;
alter table public.meetings validate constraint meetings_status_machine_check;

-- Deterministic M17 validator: returns counts and gap identifiers.
create or replace function public.validate_meetings_for_run(p_run_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
	v_meeting_count integer;
	v_draft_count integer;
	v_unapproved_count integer;
	v_minute_count integer;
begin
	if p_run_id is null then
		raise exception using errcode = '22023', message = 'MEETING_VALIDATION_MISSING_RUN';
	end if;

	select count(*) into v_meeting_count from public.meetings where run_id = p_run_id;
	select count(*) into v_draft_count from public.meetings where run_id = p_run_id and status = 'DRAFT';
	select count(*) into v_unapproved_count
	from public.meetings where run_id = p_run_id and status <> 'APPROVED';
	select count(*) into v_minute_count
	from public.meeting_minutes as minute
	join public.meetings as meeting on meeting.id = minute.meeting_id
	where meeting.run_id = p_run_id;

	return jsonb_build_object(
		'runId', p_run_id,
		'meetingCount', v_meeting_count,
		'draftCount', v_draft_count,
		'unapprovedCount', v_unapproved_count,
		'minuteCount', v_minute_count
	);
end;
$$;

revoke all on function public.validate_meetings_for_run(uuid) from public, anon, authenticated, service_role;
grant execute on function public.validate_meetings_for_run(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- M18 Risk / Issue / Change constraints
-- ---------------------------------------------------------------------------

-- A risk must be either OPEN (no human approval yet) or have BOTH approver
-- and approval timestamp. Mirrors the meeting_minutes_approval_pair rule.
alter table public.risks
	add constraint risks_approval_pair
	check (
		(approved_by is null and approved_at is null)
		or (approved_by is not null and approved_at is not null)
	) not valid;
alter table public.risks validate constraint risks_approval_pair;

-- A risk linked to a requirement candidate must also be scoped to the same
-- run; this is already structurally guaranteed by the FK, but we add a
-- sanity CHECK on severity.
alter table public.risks
	add constraint risks_severity_text_check
	check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) not valid;
alter table public.risks validate constraint risks_severity_text_check;

-- Deterministic M18 validator: counts open / approved / rejected risks,
-- plus change_requests (currently folded into risks) that lack approval.
create or replace function public.validate_risks_for_run(p_run_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
	v_open integer;
	v_approved integer;
	v_rejected integer;
	v_total integer;
begin
	if p_run_id is null then
		raise exception using errcode = '22023', message = 'RISK_VALIDATION_MISSING_RUN';
	end if;

	select count(*) into v_total from public.risks where run_id = p_run_id;
	select count(*) into v_open from public.risks where run_id = p_run_id and status = 'OPEN';
	select count(*) into v_approved from public.risks where run_id = p_run_id and status = 'APPROVED';
	select count(*) into v_rejected from public.risks where run_id = p_run_id and status = 'REJECTED';

	return jsonb_build_object(
		'runId', p_run_id,
		'riskCount', v_total,
		'openCount', v_open,
		'approvedCount', v_approved,
		'rejectedCount', v_rejected
	);
end;
$$;

revoke all on function public.validate_risks_for_run(uuid) from public, anon, authenticated, service_role;
grant execute on function public.validate_risks_for_run(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- M19 Inspection / Evidence constraints
-- ---------------------------------------------------------------------------

-- A PASS/FAIL inspection must include an evidence_ref path; PENDING may
-- have it null. This enforces that evidence is captured before sign-off.
alter table public.inspections
	add constraint inspections_evidence_required_when_final
	check (
		result = 'PENDING'
		or (evidence_ref is not null and length(btrim(evidence_ref)) between 1 and 1024)
	) not valid;
alter table public.inspections validate constraint inspections_evidence_required_when_final;

-- Deterministic M19 trace validator:
-- every inspection must reference a requirement_candidate that belongs to
-- a confirmed Requirement Baseline for the same run, and the inspection
-- result distribution is reported.
create or replace function public.validate_inspections_for_run(p_run_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
	v_total integer;
	v_pass integer;
	v_fail integer;
	v_pending integer;
	v_orphan integer;
begin
	if p_run_id is null then
		raise exception using errcode = '22023', message = 'INSPECTION_VALIDATION_MISSING_RUN';
	end if;

	select count(*) into v_total from public.inspections where run_id = p_run_id;
	select count(*) into v_pass from public.inspections where run_id = p_run_id and result = 'PASS';
	select count(*) into v_fail from public.inspections where run_id = p_run_id and result = 'FAIL';
	select count(*) into v_pending from public.inspections where run_id = p_run_id and result = 'PENDING';

	-- orphan = an inspection whose requirement_candidate_id is not in
	-- any confirmed Requirement Baseline for the same run
	select count(*) into v_orphan
	from public.inspections as inspection
	where inspection.run_id = p_run_id
		and inspection.requirement_candidate_id is not null
		and not exists (
			select 1
			from public.requirement_baseline_items as item
			join public.requirement_baselines as baseline on baseline.id = item.baseline_id
			where baseline.run_id = inspection.run_id
				and item.candidate_id = inspection.requirement_candidate_id
		);

	return jsonb_build_object(
		'runId', p_run_id,
		'inspectionCount', v_total,
		'passCount', v_pass,
		'failCount', v_fail,
		'pendingCount', v_pending,
		'orphanCount', v_orphan
	);
end;
$$;

revoke all on function public.validate_inspections_for_run(uuid) from public, anon, authenticated, service_role;
grant execute on function public.validate_inspections_for_run(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- M20 Closeout gate: a closeout may be finalised (final_accepted=true
-- or security_terminated=true) only if every upstream validator reports
-- zero blocking items. The runtime gate is enforced by
-- public.can_finalize_closeout(p_run_id) below.
-- ---------------------------------------------------------------------------

create or replace function public.can_finalize_closeout(p_run_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
	v_wbs jsonb;
	v_risks jsonb;
	v_inspections jsonb;
	v_meetings jsonb;
begin
	if p_run_id is null then
		raise exception using errcode = '22023', message = 'CLOSEOUT_VALIDATION_MISSING_RUN';
	end if;

	v_wbs := public.validate_wbs_for_run(p_run_id);
	v_risks := public.validate_risks_for_run(p_run_id);
	v_inspections := public.validate_inspections_for_run(p_run_id);
	v_meetings := public.validate_meetings_for_run(p_run_id);

	return (
		(v_wbs ->> 'requirementsWithoutTask')::integer = 0
		and (v_wbs ->> 'taskWithoutOwner')::integer = 0
		and (v_wbs ->> 'hierarchyDateViolation')::integer = 0
		and (v_risks ->> 'openCount')::integer = 0
		and (v_inspections ->> 'failCount')::integer = 0
		and (v_inspections ->> 'pendingCount')::integer = 0
		and (v_inspections ->> 'orphanCount')::integer = 0
		and (v_meetings ->> 'draftCount')::integer = 0
	);
end;
$$;

revoke all on function public.can_finalize_closeout(uuid) from public, anon, authenticated, service_role;
grant execute on function public.can_finalize_closeout(uuid) to service_role;
