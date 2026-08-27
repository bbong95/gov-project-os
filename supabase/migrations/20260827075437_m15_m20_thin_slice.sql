-- WBS (M15): tasks and deliverables trace Requirement Baseline candidates
create table public.wbs_tasks (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	run_id uuid not null,
	requirement_candidate_id uuid,
	parent_task_id uuid references public.wbs_tasks (id) on delete cascade,
	title text not null,
	owner text,
	due_date date,
	created_by uuid not null,
	created_at timestamptz not null default now(),
	constraint wbs_tasks_requirement_fkey
		foreign key (requirement_candidate_id)
		references public.requirement_candidates (id)
		on delete set null,
	constraint wbs_tasks_title_check
		check (length(title) between 1 and 8192),
	constraint wbs_tasks_3_key unique (tenant_id, project_id, id)
);
create index wbs_tasks_run_idx on public.wbs_tasks (run_id);

create table public.wbs_deliverables (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	task_id uuid not null,
	title text not null,
	content_path text,
	created_at timestamptz not null default now(),
	constraint wbs_deliverables_task_fkey
		foreign key (tenant_id, project_id, task_id)
		references public.wbs_tasks (tenant_id, project_id, id)
		on delete cascade
);

-- Meeting minutes (M17): ManualTranscriptProvider MVP
create table public.meetings (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	run_id uuid not null,
	title text not null,
	held_at timestamptz not null,
	status text not null default 'DRAFT',
	created_by uuid not null,
	created_at timestamptz not null default now(),
	constraint meetings_status_check
		check (status in ('DRAFT', 'REVIEWED', 'APPROVED', 'SUPERSEDED')),
	constraint meetings_title_check
		check (length(title) between 1 and 512)
);

create table public.meeting_minutes (
	id uuid primary key default gen_random_uuid(),
	meeting_id uuid not null,
	content_md text not null,
	approved_by uuid,
	approved_at timestamptz,
	constraint meeting_minutes_meeting_fkey
		foreign key (meeting_id) references public.meetings (id) on delete cascade
);

-- Risk/Issue/Change (M18): risks require human approval
create table public.risks (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	run_id uuid not null,
	requirement_candidate_id uuid,
	change_request_id uuid,
	title text not null,
	severity text not null,
	status text not null default 'OPEN',
	approved_by uuid,
	approved_at timestamptz,
	created_by uuid not null,
	created_at timestamptz not null default now(),
	constraint risks_severity_check
		check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
	constraint risks_status_check
		check (status in ('OPEN', 'APPROVED', 'REJECTED', 'CLOSED')),
	constraint risks_requirement_fkey
		foreign key (requirement_candidate_id)
		references public.requirement_candidates (id)
		on delete set null
);

-- Inspection / Evidence (M19)
create table public.inspections (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	run_id uuid not null,
	requirement_candidate_id uuid,
	criterion text not null,
	method text not null,
	result text not null,
	evidence_ref text,
	inspected_at timestamptz not null default now(),
	created_by uuid not null,
	created_at timestamptz not null default now(),
	constraint inspections_requirement_fkey
		foreign key (requirement_candidate_id)
		references public.requirement_candidates (id)
		on delete set null,
	constraint inspections_result_check
		check (result in ('PASS', 'FAIL', 'PENDING'))
);

-- Closeout (M20)
create table public.closeouts (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	run_id uuid not null,
	final_accepted boolean not null default false,
	security_terminated boolean not null default false,
	unresolved_transfer text,
	lessons_learned text,
	approved_by uuid,
	approved_at timestamptz,
	created_by uuid not null,
	created_at timestamptz not null default now(),
	constraint closeouts_run3_key unique (tenant_id, project_id, run_id),
	constraint closeouts_run_fkey
		foreign key (tenant_id, project_id, run_id)
		references public.requirement_extraction_runs(tenant_id, project_id, id)
		on delete restrict not valid
);

-- RLS + grants
alter table public.wbs_tasks enable row level security;
alter table public.wbs_tasks force row level security;
alter table public.wbs_deliverables enable row level security;
alter table public.wbs_deliverables force row level security;
alter table public.meetings enable row level security;
alter table public.meetings force row level security;
alter table public.meeting_minutes enable row level security;
alter table public.meeting_minutes force row level security;
alter table public.risks enable row level security;
alter table public.risks force row level security;
alter table public.inspections enable row level security;
alter table public.inspections force row level security;
alter table public.closeouts enable row level security;
alter table public.closeouts force row level security;

revoke all privileges on table public.wbs_tasks from anon, authenticated, service_role;
revoke all privileges on table public.wbs_deliverables from anon, authenticated, service_role;
revoke all privileges on table public.meetings from anon, authenticated, service_role;
revoke all privileges on table public.meeting_minutes from anon, authenticated, service_role;
revoke all privileges on table public.risks from anon, authenticated, service_role;
revoke all privileges on table public.inspections from anon, authenticated, service_role;
revoke all privileges on table public.closeouts from anon, authenticated, service_role;

grant select, insert, update, delete on table public.wbs_tasks to service_role;
grant select, insert, update, delete on table public.wbs_deliverables to service_role;
grant select, insert, update, delete on table public.meetings to service_role;
grant select, insert, update, delete on table public.meeting_minutes to service_role;
grant select, insert, update, delete on table public.risks to service_role;
grant select, insert, update, delete on table public.inspections to service_role;
grant select, insert, update, delete on table public.closeouts to service_role;

grant select on table public.wbs_tasks to authenticated;
grant select on table public.wbs_deliverables to authenticated;
grant select on table public.meetings to authenticated;
grant select on table public.meeting_minutes to authenticated;
grant select on table public.risks to authenticated;
grant select on table public.inspections to authenticated;
grant select on table public.closeouts to authenticated;

-- RLS policies: project member or tenant admin
create policy "wbs visible to project members" on public.wbs_tasks for select to authenticated
using (
	(select auth.uid()) is not null
	and (exists (select 1 from public.project_memberships as m where m.tenant_id = wbs_tasks.tenant_id and m.project_id = wbs_tasks.project_id and m.user_id = (select auth.uid()))
		or exists (select 1 from public.tenant_memberships as m where m.tenant_id = wbs_tasks.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role))
);
create policy "deliverables visible to project members" on public.wbs_deliverables for select to authenticated
using (
	(select auth.uid()) is not null
	and (exists (select 1 from public.project_memberships as m where m.tenant_id = wbs_deliverables.tenant_id and m.project_id = wbs_deliverables.project_id and m.user_id = (select auth.uid()))
		or exists (select 1 from public.tenant_memberships as m where m.tenant_id = wbs_deliverables.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role))
);
create policy "meetings visible to project members" on public.meetings for select to authenticated
using (
	(select auth.uid()) is not null
	and (exists (select 1 from public.project_memberships as m where m.tenant_id = meetings.tenant_id and m.project_id = meetings.project_id and m.user_id = (select auth.uid()))
		or exists (select 1 from public.tenant_memberships as m where m.tenant_id = meetings.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role))
);
create policy "minutes visible to project members" on public.meeting_minutes for select to authenticated
using (
	exists (select 1 from public.meetings as meeting where meeting.id = meeting_minutes.meeting_id)
);
create policy "risks visible to project members" on public.risks for select to authenticated
using (
	(select auth.uid()) is not null
	and (exists (select 1 from public.project_memberships as m where m.tenant_id = risks.tenant_id and m.project_id = risks.project_id and m.user_id = (select auth.uid()))
		or exists (select 1 from public.tenant_memberships as m where m.tenant_id = risks.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role))
);
create policy "inspections visible to project members" on public.inspections for select to authenticated
using (
	(select auth.uid()) is not null
	and (exists (select 1 from public.project_memberships as m where m.tenant_id = inspections.tenant_id and m.project_id = inspections.project_id and m.user_id = (select auth.uid()))
		or exists (select 1 from public.tenant_memberships as m where m.tenant_id = inspections.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role))
);
create policy "closeouts visible to project members" on public.closeouts for select to authenticated
using (
	(select auth.uid()) is not null
	and (exists (select 1 from public.project_memberships as m where m.tenant_id = closeouts.tenant_id and m.project_id = closeouts.project_id and m.user_id = (select auth.uid()))
		or exists (select 1 from public.tenant_memberships as m where m.tenant_id = closeouts.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role))
);
