create table public.requirement_baselines (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	document_id uuid not null,
	document_parse_id uuid not null,
	run_id uuid not null,
	version integer not null,
	content_sha256 text not null,
	candidate_count integer not null,
	created_by uuid not null,
	created_at timestamptz not null default now(),
	constraint requirement_baselines_run_fkey
		foreign key (tenant_id, project_id, document_id, document_parse_id, run_id)
		references public.requirement_extraction_runs(tenant_id, project_id, document_id, document_parse_id, id)
		on delete restrict,
	constraint requirement_baselines_created_by_fkey
		foreign key (created_by) references auth.users (id) on delete restrict,
	constraint requirement_baselines_version_check
		check (version > 0),
	constraint requirement_baselines_content_sha256_check
		check (content_sha256 ~ '^[0-9a-f]{64}$'),
	constraint requirement_baselines_candidate_count_check
		check (candidate_count between 1 and 500),
	constraint requirement_baselines_run_version_key
		unique (run_id, version),
	constraint requirement_baselines_scope_key
		unique (tenant_id, project_id, run_id, id)
);

create table public.requirement_baseline_items (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	run_id uuid not null,
	baseline_id uuid not null,
	candidate_id uuid not null,
	candidate_order integer not null,
	official_id text,
	source_text text not null,
	interpretation text not null,
	requirement_type public.requirement_type not null,
	atomicity public.requirement_atomicity not null,
	content_sha256 text not null,
	created_at timestamptz not null default now(),
	constraint requirement_baseline_items_baseline_fkey
		foreign key (tenant_id, project_id, run_id, baseline_id)
		references public.requirement_baselines(tenant_id, project_id, run_id, id)
		on delete restrict,
	constraint requirement_baseline_items_candidate_fkey
		foreign key (candidate_id)
		references public.requirement_candidates (id)
		on delete restrict,
	constraint requirement_baseline_items_order_check
		check (candidate_order between 1 and 500),
	constraint requirement_baseline_items_source_text_not_blank
		check (source_text ~ '[^[:space:]]'),
	constraint requirement_baseline_items_interpretation_not_blank
		check (interpretation ~ '[^[:space:]]'),
	constraint requirement_baseline_items_content_sha256_check
		check (content_sha256 ~ '^[0-9a-f]{64}$'),
	constraint requirement_baseline_items_baseline_candidate_key
		unique (baseline_id, candidate_id)
);

create index requirement_baselines_run_version_idx
	on public.requirement_baselines (run_id, version desc);
create index requirement_baseline_items_baseline_order_idx
	on public.requirement_baseline_items (baseline_id, candidate_order);

alter table public.requirement_baselines enable row level security;
alter table public.requirement_baseline_items enable row level security;
alter table public.requirement_baselines force row level security;
alter table public.requirement_baseline_items force row level security;

revoke all privileges on table public.requirement_baselines
	from anon, authenticated, service_role;
revoke all privileges on table public.requirement_baseline_items
	from anon, authenticated, service_role;
grant select on table public.requirement_baselines to authenticated;
grant select on table public.requirement_baseline_items to authenticated;
grant select, insert, delete on table public.requirement_baselines to service_role;
grant select, insert, delete on table public.requirement_baseline_items to service_role;

create policy "baselines visible to project member or tenant admin"
on public.requirement_baselines
for select
to authenticated
using (
	(select auth.uid()) is not null
	and (
		exists (
			select 1
			from public.project_memberships as project_membership
			where project_membership.tenant_id = requirement_baselines.tenant_id
				and project_membership.project_id = requirement_baselines.project_id
				and project_membership.user_id = (select auth.uid())
		)
		or exists (
			select 1
			from public.tenant_memberships as tenant_membership
			where tenant_membership.tenant_id = requirement_baselines.tenant_id
				and tenant_membership.user_id = (select auth.uid())
				and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
		)
	)
);

create policy "baseline items visible to project member or tenant admin"
on public.requirement_baseline_items
for select
to authenticated
using (
	(select auth.uid()) is not null
	and (
		exists (
			select 1
			from public.project_memberships as project_membership
			where project_membership.tenant_id = requirement_baseline_items.tenant_id
				and project_membership.project_id = requirement_baseline_items.project_id
				and project_membership.user_id = (select auth.uid())
		)
		or exists (
			select 1
			from public.tenant_memberships as tenant_membership
			where tenant_membership.tenant_id = requirement_baseline_items.tenant_id
				and tenant_membership.user_id = (select auth.uid())
				and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
		)
	)
);

create function public.create_requirement_baseline(
	p_actor_id uuid,
	p_run_id uuid
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
	v_parse_id uuid;
	v_unfinalized integer;
	v_verified_count integer;
	v_orphan_verified integer;
	v_next_version integer;
	v_baseline_id uuid;
	v_item record;
	v_content_material text;
	v_item_count integer := 0;
begin
	if p_actor_id is null then
		raise exception using
			errcode = '42501',
			message = 'REQUIREMENT_BASELINE_UNAVAILABLE';
	end if;

	select
		run.tenant_id,
		run.project_id,
		run.document_id,
		run.document_parse_id
	into
		v_tenant_id,
		v_project_id,
		v_document_id,
		v_parse_id
	from public.requirement_extraction_runs as run
	where run.id = p_run_id
		and (
			exists (
				select 1
				from public.project_memberships as project_membership
				where project_membership.tenant_id = run.tenant_id
					and project_membership.project_id = run.project_id
					and project_membership.user_id = p_actor_id
					and project_membership.role in (
						'EDITOR'::public.membership_role,
						'PROJECT_ADMIN'::public.membership_role
					)
			)
			or exists (
				select 1
				from public.tenant_memberships as tenant_membership
				where tenant_membership.tenant_id = run.tenant_id
					and tenant_membership.user_id = p_actor_id
					and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
			)
		);

	if v_tenant_id is null then
		raise exception using
			errcode = '42501',
			message = 'REQUIREMENT_BASELINE_UNAVAILABLE';
	end if;

	-- Finalization rule: only HUMAN_VERIFIED and REJECTED candidates may
	-- remain. Any AI_DRAFT, SOURCE_VERIFIED, or REVIEW_REQUIRED candidate
	-- blocks the baseline.
	select count(*)::integer
	into v_unfinalized
	from public.requirement_candidates as candidate
	where candidate.run_id = p_run_id
		and candidate.provenance_state in (
			'AI_DRAFT',
			'SOURCE_VERIFIED',
			'REVIEW_REQUIRED'
		);

	if v_unfinalized > 0 then
		raise exception using
			errcode = '42501',
			message = 'REQUIREMENT_BASELINE_UNFINALIZED';
	end if;

	select
		count(*)::integer,
		count(*) filter (
			where not exists (
				select 1
				from public.requirement_candidate_source_spans as link
				where link.candidate_id = candidate.id
			)
		)
	into
		v_verified_count,
		v_orphan_verified
	from public.requirement_candidates as candidate
	where candidate.run_id = p_run_id
		and candidate.provenance_state = 'HUMAN_VERIFIED';

	if v_verified_count = 0 then
		raise exception using
			errcode = '42501',
			message = 'REQUIREMENT_BASELINE_EMPTY';
	end if;

	if v_orphan_verified > 0 then
		raise exception using
			errcode = '42501',
			message = 'REQUIREMENT_BASELINE_EVIDENCE_MISSING';
	end if;

	select coalesce(max(baseline.version), 0) + 1
	into v_next_version
	from public.requirement_baselines as baseline
	where baseline.run_id = p_run_id;

	-- Compute the content hash material first so the baseline row is inserted
	-- once with its final immutable hash (no UPDATE path exists at all).
	for v_item in
		select candidate.*
		from public.requirement_candidates as candidate
		where candidate.run_id = p_run_id
			and candidate.provenance_state = 'HUMAN_VERIFIED'
		order by candidate.candidate_order
	loop
		v_content_material := coalesce(v_content_material, '')
			|| v_item.candidate_order || '|'
			|| coalesce(v_item.official_id, '') || '|'
			|| v_item.content_sha256 || E'\n';
		v_item_count := v_item_count + 1;
	end loop;

	insert into public.requirement_baselines (
		tenant_id,
		project_id,
		document_id,
		document_parse_id,
		run_id,
		version,
		content_sha256,
		candidate_count,
		created_by
	)
	values (
		v_tenant_id,
		v_project_id,
		v_document_id,
		v_parse_id,
		p_run_id,
		v_next_version,
		private.source_text_sha256(v_content_material),
		v_item_count,
		p_actor_id
	)
	returning id into v_baseline_id;

	for v_item in
		select candidate.*
		from public.requirement_candidates as candidate
		where candidate.run_id = p_run_id
			and candidate.provenance_state = 'HUMAN_VERIFIED'
		order by candidate.candidate_order
	loop
		insert into public.requirement_baseline_items (
			tenant_id,
			project_id,
			run_id,
			baseline_id,
			candidate_id,
			candidate_order,
			official_id,
			source_text,
			interpretation,
			requirement_type,
			atomicity,
			content_sha256
		)
		values (
			v_item.tenant_id,
			v_item.project_id,
			v_item.run_id,
			v_baseline_id,
			v_item.id,
			v_item.candidate_order,
			v_item.official_id,
			v_item.source_text,
			v_item.interpretation,
			v_item.requirement_type,
			v_item.atomicity,
			v_item.content_sha256
		);
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
		'REQUIREMENT_BASELINE_CREATED',
		'REQUIREMENT_BASELINE',
		v_baseline_id,
		jsonb_build_object(
			'runId', p_run_id,
			'version', v_next_version,
			'candidateCount', v_item_count,
			'contentSha256', private.source_text_sha256(v_content_material)
		)
	);

	return jsonb_build_object(
		'baselineId', v_baseline_id,
		'version', v_next_version,
		'contentSha256', private.source_text_sha256(v_content_material),
		'candidateCount', v_item_count
	);
end;
$$;

revoke all on function public.create_requirement_baseline(
	uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.create_requirement_baseline(
	uuid, uuid
) to service_role;
