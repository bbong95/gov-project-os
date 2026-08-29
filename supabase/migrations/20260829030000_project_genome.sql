-- Project Genome: pre-award + delivery + closeout metadata.
-- Every row carries SourceSpan evidence and human verification state.
-- The lifecycle M08 (atomic requirements) is the input; Project Genome is
-- the structured, queryable, traceable schema that all 5 MVPs read from.

create table public.project_genome (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	stage text not null check (stage in ('DRAFT', 'PROPOSAL', 'CONTRACT', 'EXECUTION', 'CLOSEOUT')),
	summary text,
	rfp_document_id uuid,
	rfp_document_parse_id uuid,
	approved_by uuid,
	approved_at timestamptz,
	created_by uuid not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint project_genome_3_key unique (tenant_id, project_id, id)
);
create index project_genome_project_idx on public.project_genome (project_id);

alter table public.project_genome enable row level security;
alter table public.project_genome force row level security;
revoke all privileges on table public.project_genome from anon, authenticated, service_role;
grant select, insert, update, delete on table public.project_genome to service_role;
grant select on table public.project_genome to authenticated;
create policy "project_genome visible to project members"
on public.project_genome for select to authenticated
using (
	(select auth.uid()) is not null
	and (
		exists (select 1 from public.project_memberships as m where m.tenant_id = project_genome.tenant_id and m.project_id = project_genome.project_id and m.user_id = (select auth.uid()))
		or exists (select 1 from public.tenant_memberships as m where m.tenant_id = project_genome.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role)
	)
);

-- Atomic requirement (Project Genome view of requirement).
-- Mirrors requirement_candidates + requirement_baseline_items for unified
-- reporting across proposal, delivery and audit.
create table public.genome_requirements (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	genome_id uuid not null,
	genome_version integer not null default 1,
	external_id text not null,
	title text not null,
	original_text text not null,
	normalized_text text not null,
	requirement_type text not null,
	atomicity text not null,
	priority text not null default 'NORMAL' check (priority in ('CRITICAL', 'HIGH', 'NORMAL', 'LOW')),
	rfp_page text,
	rfp_paragraph text,
	mandatory boolean not null default true,
	human_verified boolean not null default false,
	verified_by uuid,
	verified_at timestamptz,
	created_at timestamptz not null default now(),
	constraint genome_requirements_external_id_check check (length(btrim(external_id)) between 1 and 64),
	constraint genome_requirements_atomicity_check check (atomicity in ('ATOMIC', 'COMPOSITE', 'REVIEW_REQUIRED')),
	constraint genome_requirements_type_check check (requirement_type in ('FUNCTIONAL', 'NON_FUNCTIONAL', 'INTERFACE', 'DATA', 'SECURITY', 'PERFORMANCE', 'COMPLIANCE', 'OPERATIONAL', 'DELIVERY', 'OTHER')),
	constraint genome_requirements_4_key unique (tenant_id, project_id, genome_id, genome_version, external_id)
);
create index genome_requirements_genome_idx on public.genome_requirements (genome_id, genome_version);

alter table public.genome_requirements enable row level security;
alter table public.genome_requirements force row level security;
revoke all privileges on table public.genome_requirements from anon, authenticated, service_role;
grant select, insert, update, delete on table public.genome_requirements to service_role;
grant select on table public.genome_requirements to authenticated;
create policy "genome_requirements visible to project members"
on public.genome_requirements for select to authenticated
using (
	exists (
		select 1 from public.project_genome as g
		where g.id = genome_requirements.genome_id
			and (
				exists (select 1 from public.project_memberships as m where m.tenant_id = g.tenant_id and m.project_id = g.project_id and m.user_id = (select auth.uid()))
				or exists (select 1 from public.tenant_memberships as m where m.tenant_id = g.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role)
			)
	)
);

-- SourceSpan link table (an atomic requirement can cite multiple spans).
create table public.genome_requirement_sources (
	tenant_id uuid not null,
	project_id uuid not null,
	requirement_id uuid not null,
	source_span_id uuid not null,
	quote_order integer not null,
	constraint genome_requirement_sources_pk
		primary key (requirement_id, quote_order),
	constraint genome_requirement_sources_span_fkey
		foreign key (source_span_id) references public.source_spans (id) on delete cascade
);
create index genome_requirement_sources_span_idx on public.genome_requirement_sources (source_span_id);

alter table public.genome_requirement_sources enable row level security;
alter table public.genome_requirement_sources force row level security;
revoke all privileges on table public.genome_requirement_sources from anon, authenticated, service_role;
grant select, insert, update, delete on table public.genome_requirement_sources to service_role;
grant select on table public.genome_requirement_sources to authenticated;
create policy "genome_requirement_sources visible to project members"
on public.genome_requirement_sources for select to authenticated
using (
	exists (
		select 1 from public.genome_requirements as r
		where r.id = genome_requirement_sources.requirement_id
			and exists (
				select 1 from public.project_genome as g
				where g.id = r.genome_id
					and (
						exists (select 1 from public.project_memberships as m where m.tenant_id = g.tenant_id and m.project_id = g.project_id and m.user_id = (select auth.uid()))
						or exists (select 1 from public.tenant_memberships as m where m.tenant_id = g.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role)
					)
			)
	)
);

-- Deliverables extracted from RFP / proposal / contract.
create table public.genome_deliverables (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	genome_id uuid not null,
	genome_version integer not null default 1,
	external_id text not null,
	title text not null,
	description text,
	submission_phase text not null check (submission_phase in ('PROPOSAL', 'CONTRACT', 'KICKOFF', 'INTERIM', 'FINAL', 'CLOSEOUT')),
	mandatory boolean not null default true,
	rfp_page text,
	created_at timestamptz not null default now(),
	constraint genome_deliverables_external_id_check check (length(btrim(external_id)) between 1 and 64),
	constraint genome_deliverables_title_check check (length(btrim(title)) between 1 and 256),
	constraint genome_deliverables_4_key unique (tenant_id, project_id, genome_id, genome_version, external_id)
);
create index genome_deliverables_genome_idx on public.genome_deliverables (genome_id, genome_version);

alter table public.genome_deliverables enable row level security;
alter table public.genome_deliverables force row level security;
revoke all privileges on table public.genome_deliverables from anon, authenticated, service_role;
grant select, insert, update, delete on table public.genome_deliverables to service_role;
grant select on table public.genome_deliverables to authenticated;
create policy "genome_deliverables visible to project members"
on public.genome_deliverables for select to authenticated
using (
	exists (
		select 1 from public.project_genome as g
		where g.id = genome_deliverables.genome_id
			and (
				exists (select 1 from public.project_memberships as m where m.tenant_id = g.tenant_id and m.project_id = g.project_id and m.user_id = (select auth.uid()))
				or exists (select 1 from public.tenant_memberships as m where m.tenant_id = g.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role)
			)
	)
);

-- Evaluation items (RFP proposal grading) per category.
create table public.genome_evaluation_items (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	genome_id uuid not null,
	genome_version integer not null default 1,
	external_id text not null,
	category text not null,
	title text not null,
	max_score numeric(7,2) not null,
	method text,
	rfp_page text,
	created_at timestamptz not null default now(),
	constraint genome_evaluation_items_external_id_check check (length(btrim(external_id)) between 1 and 64),
	constraint genome_evaluation_items_title_check check (length(btrim(title)) between 1 and 256),
	constraint genome_evaluation_items_max_score_check check (max_score > 0 and max_score <= 1000),
	constraint genome_evaluation_items_4_key unique (tenant_id, project_id, genome_id, genome_version, external_id)
);
create index genome_evaluation_items_genome_idx on public.genome_evaluation_items (genome_id, genome_version);

alter table public.genome_evaluation_items enable row level security;
alter table public.genome_evaluation_items force row level security;
revoke all privileges on table public.genome_evaluation_items from anon, authenticated, service_role;
grant select, insert, update, delete on table public.genome_evaluation_items to service_role;
grant select on table public.genome_evaluation_items to authenticated;
create policy "genome_evaluation_items visible to project members"
on public.genome_evaluation_items for select to authenticated
using (
	exists (
		select 1 from public.project_genome as g
		where g.id = genome_evaluation_items.genome_id
			and (
				exists (select 1 from public.project_memberships as m where m.tenant_id = g.tenant_id and m.project_id = g.project_id and m.user_id = (select auth.uid()))
				or exists (select 1 from public.tenant_memberships as m where m.tenant_id = g.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role)
			)
	)
);

-- Contract / bid terms extracted from RFP.
create table public.genome_contract_terms (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	genome_id uuid not null,
	genome_version integer not null default 1,
	external_id text not null,
	term_type text not null check (term_type in ('QUALIFICATION', 'PERIOD', 'BUDGET', 'PENALTY', 'WARRANTY', 'IP', 'NDA', 'PERFORMANCE_BOND', 'OTHER')),
	title text not null,
	original_text text not null,
	rfp_page text,
	created_at timestamptz not null default now(),
	constraint genome_contract_terms_external_id_check check (length(btrim(external_id)) between 1 and 64),
	constraint genome_contract_terms_title_check check (length(btrim(title)) between 1 and 256),
	constraint genome_contract_terms_4_key unique (tenant_id, project_id, genome_id, genome_version, external_id)
);
create index genome_contract_terms_genome_idx on public.genome_contract_terms (genome_id, genome_version);

alter table public.genome_contract_terms enable row level security;
alter table public.genome_contract_terms force row level security;
revoke all privileges on table public.genome_contract_terms from anon, authenticated, service_role;
grant select, insert, update, delete on table public.genome_contract_terms to service_role;
grant select on table public.genome_contract_terms to authenticated;
create policy "genome_contract_terms visible to project members"
on public.genome_contract_terms for select to authenticated
using (
	exists (
		select 1 from public.project_genome as g
		where g.id = genome_contract_terms.genome_id
			and (
				exists (select 1 from public.project_memberships as m where m.tenant_id = g.tenant_id and m.project_id = g.project_id and m.user_id = (select auth.uid()))
				or exists (select 1 from public.tenant_memberships as m where m.tenant_id = g.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role)
			)
	)
);

-- Risks captured from RFP.
create table public.genome_risks (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	genome_id uuid not null,
	genome_version integer not null default 1,
	external_id text not null,
	severity text not null check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
	title text not null,
	description text not null,
	mitigation text,
	rfp_page text,
	created_at timestamptz not null default now(),
	constraint genome_risks_external_id_check check (length(btrim(external_id)) between 1 and 64),
	constraint genome_risks_title_check check (length(btrim(title)) between 1 and 256),
	constraint genome_risks_4_key unique (tenant_id, project_id, genome_id, genome_version, external_id)
);
create index genome_risks_genome_idx on public.genome_risks (genome_id, genome_version);

alter table public.genome_risks enable row level security;
alter table public.genome_risks force row level security;
revoke all privileges on table public.genome_risks from anon, authenticated, service_role;
grant select, insert, update, delete on table public.genome_risks to service_role;
grant select on table public.genome_risks to authenticated;
create policy "genome_risks visible to project members"
on public.genome_risks for select to authenticated
using (
	exists (
		select 1 from public.project_genome as g
		where g.id = genome_risks.genome_id
			and (
				exists (select 1 from public.project_memberships as m where m.tenant_id = g.tenant_id and m.project_id = g.project_id and m.user_id = (select auth.uid()))
				or exists (select 1 from public.tenant_memberships as m where m.tenant_id = g.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role)
			)
	)
);

-- Proposal compliance + winning-point analysis (MVP2).
create table public.genome_proposal_sections (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	genome_id uuid not null,
	section_key text not null,
	title text not null,
	body_md text not null,
	word_count integer not null default 0,
	prompt_version text not null,
	model_fingerprint text not null,
	ai_generated boolean not null default true,
	human_edited boolean not null default false,
	approved_by uuid,
	approved_at timestamptz,
	created_by uuid not null,
	created_at timestamptz not null default now(),
	constraint genome_proposal_sections_key_check check (length(btrim(section_key)) between 1 and 64),
	constraint genome_proposal_sections_title_check check (length(btrim(title)) between 1 and 256),
	constraint genome_proposal_sections_4_key unique (genome_id, section_key)
);

alter table public.genome_proposal_sections enable row level security;
alter table public.genome_proposal_sections force row level security;
revoke all privileges on table public.genome_proposal_sections from anon, authenticated, service_role;
grant select, insert, update, delete on table public.genome_proposal_sections to service_role;
grant select on table public.genome_proposal_sections to authenticated;
create policy "genome_proposal_sections visible to project members"
on public.genome_proposal_sections for select to authenticated
using (
	exists (
		select 1 from public.project_genome as g
		where g.id = genome_proposal_sections.genome_id
			and (
				exists (select 1 from public.project_memberships as m where m.tenant_id = g.tenant_id and m.project_id = g.project_id and m.user_id = (select auth.uid()))
				or exists (select 1 from public.tenant_memberships as m where m.tenant_id = g.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role)
			)
	)
);

create table public.genome_compliance_matrix (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	genome_id uuid not null,
	requirement_id uuid not null,
	evaluation_item_id uuid,
	proposal_section_id uuid,
	status text not null check (status in ('ADDRESSED', 'PARTIAL', 'PLANNED', 'GAP')),
	notes text,
	created_by uuid not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint genome_compliance_matrix_unique unique (genome_id, requirement_id, evaluation_item_id)
);
create index genome_compliance_matrix_genome_idx on public.genome_compliance_matrix (genome_id);

alter table public.genome_compliance_matrix enable row level security;
alter table public.genome_compliance_matrix force row level security;
revoke all privileges on table public.genome_compliance_matrix from anon, authenticated, service_role;
grant select, insert, update, delete on table public.genome_compliance_matrix to service_role;
grant select on table public.genome_compliance_matrix to authenticated;
create policy "genome_compliance_matrix visible to project members"
on public.genome_compliance_matrix for select to authenticated
using (
	exists (
		select 1 from public.project_genome as g
		where g.id = genome_compliance_matrix.genome_id
			and (
				exists (select 1 from public.project_memberships as m where m.tenant_id = g.tenant_id and m.project_id = g.project_id and m.user_id = (select auth.uid()))
				or exists (select 1 from public.tenant_memberships as m where m.tenant_id = g.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role)
			)
	)
);

-- MVP3: WBS / Inspection criteria.
create table public.genome_wbs_tasks (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	genome_id uuid not null,
	genome_version integer not null default 1,
	external_id text not null,
	title text not null,
	parent_external_id text,
	deliverable_external_id text,
	owner text,
	start_offset_days integer,
	end_offset_days integer,
	effort_hours numeric(7,2),
	created_at timestamptz not null default now(),
	constraint genome_wbs_tasks_external_id_check check (length(btrim(external_id)) between 1 and 64),
	constraint genome_wbs_tasks_title_check check (length(btrim(title)) between 1 and 256),
	constraint genome_wbs_tasks_4_key unique (tenant_id, project_id, genome_id, genome_version, external_id)
);
create index genome_wbs_tasks_genome_idx on public.genome_wbs_tasks (genome_id, genome_version);

alter table public.genome_wbs_tasks enable row level security;
alter table public.genome_wbs_tasks force row level security;
revoke all privileges on table public.genome_wbs_tasks from anon, authenticated, service_role;
grant select, insert, update, delete on table public.genome_wbs_tasks to service_role;
grant select on table public.genome_wbs_tasks to authenticated;
create policy "genome_wbs_tasks visible to project members"
on public.genome_wbs_tasks for select to authenticated
using (
	exists (
		select 1 from public.project_genome as g
		where g.id = genome_wbs_tasks.genome_id
			and (
				exists (select 1 from public.project_memberships as m where m.tenant_id = g.tenant_id and m.project_id = g.project_id and m.user_id = (select auth.uid()))
				or exists (select 1 from public.tenant_memberships as m where m.tenant_id = g.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role)
			)
	)
);

create table public.genome_inspection_criteria (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	genome_id uuid not null,
	genome_version integer not null default 1,
	external_id text not null,
	requirement_id uuid not null,
	criterion text not null,
	method text not null,
	acceptance text,
	objective boolean not null default true,
	created_at timestamptz not null default now(),
	constraint genome_inspection_criteria_external_id_check check (length(btrim(external_id)) between 1 and 64),
	constraint genome_inspection_criteria_4_key unique (tenant_id, project_id, genome_id, genome_version, external_id)
);
create index genome_inspection_criteria_genome_idx on public.genome_inspection_criteria (genome_id, genome_version);

alter table public.genome_inspection_criteria enable row level security;
alter table public.genome_inspection_criteria force row level security;
revoke all privileges on table public.genome_inspection_criteria from anon, authenticated, service_role;
grant select, insert, update, delete on table public.genome_inspection_criteria to service_role;
grant select on table public.genome_inspection_criteria to authenticated;
create policy "genome_inspection_criteria visible to project members"
on public.genome_inspection_criteria for select to authenticated
using (
	exists (
		select 1 from public.project_genome as g
		where g.id = genome_inspection_criteria.genome_id
			and (
				exists (select 1 from public.project_memberships as m where m.tenant_id = g.tenant_id and m.project_id = g.project_id and m.user_id = (select auth.uid()))
				or exists (select 1 from public.tenant_memberships as m where m.tenant_id = g.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role)
			)
	)
);

-- MVP5: Evidence.
create table public.genome_evidence (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	genome_id uuid not null,
	genome_version integer not null default 1,
	external_id text not null,
	requirement_id uuid,
	inspection_criterion_id uuid,
	kind text not null check (kind in ('DOCUMENT', 'SCREENSHOT', 'TEST_REPORT', 'MEETING', 'EMAIL', 'OTHER')),
	title text not null,
	storage_path text not null,
	storage_bucket text not null,
	sha256 text not null,
	collected_by uuid not null,
	collected_at timestamptz not null default now(),
	constraint genome_evidence_external_id_check check (length(btrim(external_id)) between 1 and 64),
	constraint genome_evidence_sha256_check check (sha256 ~ '^[0-9a-f]{64}$'),
	constraint genome_evidence_4_key unique (tenant_id, project_id, genome_id, genome_version, external_id)
);
create index genome_evidence_genome_idx on public.genome_evidence (genome_id, genome_version);
create index genome_evidence_requirement_idx on public.genome_evidence (requirement_id);
create index genome_evidence_inspection_idx on public.genome_evidence (inspection_criterion_id);

alter table public.genome_evidence enable row level security;
alter table public.genome_evidence force row level security;
revoke all privileges on table public.genome_evidence from anon, authenticated, service_role;
grant select, insert, update, delete on table public.genome_evidence to service_role;
grant select on table public.genome_evidence to authenticated;
create policy "genome_evidence visible to project members"
on public.genome_evidence for select to authenticated
using (
	exists (
		select 1 from public.project_genome as g
		where g.id = genome_evidence.genome_id
			and (
				exists (select 1 from public.project_memberships as m where m.tenant_id = g.tenant_id and m.project_id = g.project_id and m.user_id = (select auth.uid()))
				or exists (select 1 from public.tenant_memberships as m where m.tenant_id = g.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role)
			)
	)
);

-- Audit trail for Genome mutations.
create table public.genome_audit_events (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	genome_id uuid not null,
	actor_user_id uuid not null,
	event_type text not null,
	entity_type text not null,
	entity_id uuid not null,
	event_data jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default now()
);
create index genome_audit_events_genome_idx on public.genome_audit_events (genome_id, created_at desc);

alter table public.genome_audit_events enable row level security;
alter table public.genome_audit_events force row level security;
revoke all privileges on table public.genome_audit_events from anon, authenticated, service_role;
grant select, insert, update, delete on table public.genome_audit_events to service_role;
grant select on table public.genome_audit_events to authenticated;
create policy "genome_audit_events visible to project members"
on public.genome_audit_events for select to authenticated
using (
	exists (
		select 1 from public.project_genome as g
		where g.id = genome_audit_events.genome_id
			and (
				exists (select 1 from public.project_memberships as m where m.tenant_id = g.tenant_id and m.project_id = g.project_id and m.user_id = (select auth.uid()))
				or exists (select 1 from public.tenant_memberships as m where m.tenant_id = g.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role)
			)
	)
);
