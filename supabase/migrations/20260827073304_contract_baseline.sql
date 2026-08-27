alter table public.proposals
	add column if not exists document_id uuid,
	add column if not exists document_parse_id uuid;

update public.proposals as proposal
set
	document_id = run.document_id,
	document_parse_id = run.document_parse_id
from public.requirement_extraction_runs as run
where proposal.run_id = run.id
	and (proposal.document_id is null or proposal.document_parse_id is null);

alter table public.proposals
	add constraint proposals_doc_fkey
		foreign key (tenant_id, project_id, document_id, document_parse_id, run_id)
		references public.requirement_extraction_runs(tenant_id, project_id, document_id, document_parse_id, id)
		not valid,
	add constraint proposals_scope5_key
		unique (tenant_id, project_id, document_id, document_parse_id, run_id, id);

create table public.contract_baselines (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	document_id uuid not null,
	document_parse_id uuid not null,
	run_id uuid not null,
	proposal_id uuid not null,
	version integer not null default 1,
	content_sha256 text not null,
	change_summary text not null,
	approved_by uuid not null,
	approved_at timestamptz not null default now(),
	created_at timestamptz not null default now(),
	constraint contract_baselines_run_fkey
		foreign key (tenant_id, project_id, document_id, document_parse_id, run_id)
		references public.requirement_extraction_runs(tenant_id, project_id, document_id, document_parse_id, id)
		on delete restrict,
	constraint contract_baselines_proposal_fkey
		foreign key (tenant_id, project_id, document_id, document_parse_id, run_id, proposal_id)
		references public.proposals(tenant_id, project_id, document_id, document_parse_id, run_id, id)
		on delete restrict,
	constraint contract_baselines_approved_by_fkey
		foreign key (approved_by) references auth.users (id) on delete restrict,
	constraint contract_baselines_version_check check (version > 0),
	constraint contract_baselines_content_sha256_check
		check (content_sha256 ~ '^[0-9a-f]{64}$'),
	constraint contract_baselines_change_summary_check
		check (length(change_summary) between 1 and 8192),
	constraint contract_baselines_run_version_key unique (run_id, version),
	constraint contract_baselines_4_key unique (tenant_id, project_id, run_id, id)
);

create table public.contract_baseline_items (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	run_id uuid not null,
	baseline_id uuid not null,
	change_type text not null,
	obligation_text text not null,
	source_requirement_candidate_id uuid,
	created_at timestamptz not null default now(),
	constraint contract_baseline_items_baseline_fkey
		foreign key (tenant_id, project_id, run_id, baseline_id)
		references public.contract_baselines(tenant_id, project_id, run_id, id)
		on delete cascade,
	constraint contract_baseline_items_requirement_fkey
		foreign key (source_requirement_candidate_id)
		references public.requirement_candidates (id)
		on delete set null,
	constraint contract_baseline_items_change_type_check
		check (change_type in ('ADDED', 'MODIFIED', 'DELETED', 'CONFLICT')),
	constraint contract_baseline_items_obligation_text_check
		check (length(obligation_text) between 1 and 8192)
);

create index contract_baseline_items_baseline_idx
	on public.contract_baseline_items (baseline_id);

alter table public.contract_baselines enable row level security;
alter table public.contract_baseline_items enable row level security;
alter table public.contract_baselines force row level security;
alter table public.contract_baseline_items force row level security;

revoke all privileges on table public.contract_baselines
	from anon, authenticated, service_role;
revoke all privileges on table public.contract_baseline_items
	from anon, authenticated, service_role;
grant select on table public.contract_baselines to authenticated;
grant select on table public.contract_baseline_items to authenticated;
grant insert, select, delete on table public.contract_baselines to service_role;
grant insert, select, delete on table public.contract_baseline_items to service_role;

alter table public.requirement_extraction_runs
	add constraint requirement_extraction_runs_run3_key
		unique (tenant_id, project_id, id);

create function public.create_contract_baseline(
	p_actor_id uuid,
	p_run_id uuid,
	p_proposal_id uuid,
	p_change_summary text,
	p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_tenant_id uuid;
	v_project_id uuid;
	v_doc_id uuid;
	v_parse_id uuid;
	v_next_version integer;
	v_baseline_id uuid;
	v_item jsonb;
	v_item_count integer := 0;
	v_material text := '';
	v_source_check integer;
begin
	if p_actor_id is null then
		raise exception using errcode = '42501', message = 'CONTRACT_BASELINE_UNAVAILABLE';
	end if;

	if not exists (
		select 1
		from public.proposals as proposal
		where proposal.id = p_proposal_id
			and proposal.run_id = p_run_id
	) then
		raise exception using errcode = '22023', message = 'CONTRACT_BASELINE_PROPOSAL_MISSING';
	end if;

	select run.tenant_id, run.project_id, run.document_id, run.document_parse_id
	into v_tenant_id, v_project_id, v_doc_id, v_parse_id
	from public.requirement_extraction_runs as run
	where run.id = p_run_id
		and (
			exists (
				select 1 from public.project_memberships as project_membership
				where project_membership.tenant_id = run.tenant_id
					and project_membership.project_id = run.project_id
					and project_membership.user_id = p_actor_id
					and project_membership.role in ('PROJECT_ADMIN'::public.membership_role, 'TENANT_ADMIN'::public.membership_role)
			)
		);

	if v_tenant_id is null then
		raise exception using errcode = '42501', message = 'CONTRACT_BASELINE_UNAVAILABLE';
	end if;

	if p_items is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) < 1 then
		raise exception using errcode = '22023', message = 'CONTRACT_BASELINE_ITEMS_INVALID';
	end if;

	select count(*) into v_source_check
	from jsonb_array_elements(p_items) as item
	where jsonb_typeof(item) is distinct from 'object'
		or not (item ?& array['changeType', 'obligationText'])
		or item ->> 'changeType' not in ('ADDED', 'MODIFIED', 'DELETED', 'CONFLICT')
		or length(item ->> 'obligationText') not between 1 and 8192;

	if v_source_check > 0 then
		raise exception using errcode = '22023', message = 'CONTRACT_BASELINE_ITEMS_INVALID';
	end if;

	select coalesce(max(version), 0) + 1
	into v_next_version
	from public.contract_baselines
	where run_id = p_run_id;

	insert into public.contract_baselines (
		tenant_id, project_id, run_id, proposal_id, version,
		content_sha256, change_summary, approved_by
	)
	values (
		v_tenant_id, v_project_id, p_run_id, p_proposal_id, v_next_version,
		repeat('0', 64), p_change_summary, p_actor_id
	)
	returning id into v_baseline_id;

	for v_item in select value from jsonb_array_elements(p_items)
	loop
		insert into public.contract_baseline_items (
			tenant_id, project_id, run_id, baseline_id, change_type,
			obligation_text, source_requirement_candidate_id
		)
		values (
			v_tenant_id, v_project_id, p_run_id, v_baseline_id,
			v_item ->> 'changeType',
			v_item ->> 'obligationText',
			nullif(v_item ->> 'sourceRequirementCandidateId', '')::uuid
		);
		v_material := v_material
			|| (v_item ->> 'changeType') || '|'
			|| coalesce(v_item ->> 'sourceRequirementCandidateId', '') || '|'
			|| (v_item ->> 'obligationText') || E'\n';
		v_item_count := v_item_count + 1;
	end loop;

	update public.contract_baselines
	set content_sha256 = private.source_text_sha256(v_material)
	where id = v_baseline_id;

	insert into public.audit_events (
		tenant_id, project_id, actor_user_id, event_type, entity_type, entity_id, event_data
	)
	values (
		v_tenant_id, v_project_id, p_actor_id, 'CONTRACT_BASELINE_CONFIRMED',
		'CONTRACT_BASELINE', v_baseline_id,
		jsonb_build_object(
			'runId', p_run_id, 'proposalId', p_proposal_id,
			'version', v_next_version, 'itemCount', v_item_count
		)
	);

	return jsonb_build_object(
		'baselineId', v_baseline_id,
		'version', v_next_version,
		'itemCount', v_item_count,
		'contentSha256', private.source_text_sha256(v_material)
	);
end;
$$;

revoke all on function public.create_contract_baseline(uuid, uuid, uuid, text, jsonb)
	from public, anon, authenticated, service_role;
grant execute on function public.create_contract_baseline(uuid, uuid, uuid, text, jsonb)
	to service_role;

create policy "contract baselines visible to project member or tenant admin"
on public.contract_baselines for select to authenticated
using (
	(select auth.uid()) is not null
	and (
		exists (select 1 from public.project_memberships as m where m.tenant_id = contract_baselines.tenant_id and m.project_id = contract_baselines.project_id and m.user_id = (select auth.uid()))
		or exists (select 1 from public.tenant_memberships as m where m.tenant_id = contract_baselines.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role)
	)
);

create policy "contract baseline items visible to project member or tenant admin"
on public.contract_baseline_items for select to authenticated
using (
	(select auth.uid()) is not null
	and (
		exists (select 1 from public.project_memberships as m where m.tenant_id = contract_baseline_items.tenant_id and m.project_id = contract_baseline_items.project_id and m.user_id = (select auth.uid()))
		or exists (select 1 from public.tenant_memberships as m where m.tenant_id = contract_baseline_items.tenant_id and m.user_id = (select auth.uid()) and m.role = 'TENANT_ADMIN'::public.membership_role)
	)
);
