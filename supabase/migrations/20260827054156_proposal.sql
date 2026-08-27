create table public.proposals (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	run_id uuid not null,
	baseline_id uuid not null,
	version integer not null default 1,
	status text not null default 'DRAFT',
	created_by uuid not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint proposals_run_fkey
		foreign key (tenant_id, project_id, run_id, baseline_id)
		references public.requirement_baselines(tenant_id, project_id, run_id, id)
		on delete restrict,
	constraint proposals_created_by_fkey
		foreign key (created_by) references auth.users (id) on delete restrict,
	constraint proposals_status_check
		check (status in ('DRAFT', 'READY', 'FINALIZED', 'SUPERSEDED')),
	constraint proposals_run_version_key
		unique (run_id, version),
	constraint proposals_scope_key
		unique (tenant_id, project_id, run_id, id)
);

create table public.proposal_sections (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	run_id uuid not null,
	proposal_id uuid not null,
	section_key text not null,
	content_md text not null,
	evidence_candidate_ids jsonb not null default '[]'::jsonb,
	generated_by text not null,
	generated_at timestamptz not null default now(),
	constraint proposal_sections_proposal_fkey
		foreign key (tenant_id, project_id, run_id, proposal_id)
		references public.proposals(tenant_id, project_id, run_id, id)
		on delete cascade,
	constraint proposal_sections_proposal_key_key
		unique (proposal_id, section_key)
);

create index proposal_sections_proposal_idx
	on public.proposal_sections (proposal_id, section_key);

alter table public.proposals enable row level security;
alter table public.proposal_sections enable row level security;
alter table public.proposals force row level security;
alter table public.proposal_sections force row level security;

revoke all privileges on table public.proposals
	from anon, authenticated, service_role;
revoke all privileges on table public.proposal_sections
	from anon, authenticated, service_role;
grant select on table public.proposals to authenticated;
grant select on table public.proposal_sections to authenticated;
grant insert, select, delete on table public.proposals to service_role;
grant insert, select, delete on table public.proposal_sections to service_role;

create policy "proposals visible to project member or tenant admin"
on public.proposals
for select
to authenticated
using (
	(select auth.uid()) is not null
	and (
		exists (
			select 1
			from public.project_memberships as project_membership
			where project_membership.tenant_id = proposals.tenant_id
				and project_membership.project_id = proposals.project_id
				and project_membership.user_id = (select auth.uid())
		)
		or exists (
			select 1
			from public.tenant_memberships as tenant_membership
			where tenant_membership.tenant_id = proposals.tenant_id
				and tenant_membership.user_id = (select auth.uid())
				and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
		)
	)
);

create policy "proposal sections visible to project member or tenant admin"
on public.proposal_sections
for select
to authenticated
using (
	(select auth.uid()) is not null
	and (
		exists (
			select 1
			from public.project_memberships as project_membership
			where project_membership.tenant_id = proposal_sections.tenant_id
				and project_membership.project_id = proposal_sections.project_id
				and project_membership.user_id = (select auth.uid())
		)
		or exists (
			select 1
			from public.tenant_memberships as tenant_membership
			where tenant_membership.tenant_id = proposal_sections.tenant_id
				and tenant_membership.user_id = (select auth.uid())
				and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
		)
	)
);

create function public.generate_proposal(
	p_actor_id uuid,
	p_run_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_baseline record;
	v_proposal_id uuid;
	v_item record;
	v_requirement_list text := '';
	v_officially_identified_count integer := 0;
	v_section text;
begin
	if p_actor_id is null then
		raise exception using
			errcode = '42501',
			message = 'PROPOSAL_UNAVAILABLE';
	end if;

	select baseline.id,
		baseline.tenant_id,
		baseline.project_id,
		baseline.run_id,
		baseline.version,
		baseline.candidate_count
	into v_baseline
	from public.requirement_baselines as baseline
	where baseline.run_id = p_run_id
		and (
			exists (
				select 1
				from public.project_memberships as project_membership
				where project_membership.tenant_id = baseline.tenant_id
					and project_membership.project_id = baseline.project_id
					and project_membership.user_id = p_actor_id
					and project_membership.role in (
						'EDITOR'::public.membership_role,
						'PROJECT_ADMIN'::public.membership_role
					)
			)
			or exists (
				select 1
				from public.tenant_memberships as tenant_membership
				where tenant_membership.tenant_id = baseline.tenant_id
					and tenant_membership.user_id = p_actor_id
					and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
			)
		);

	if v_baseline.id is null then
		raise exception using
			errcode = '22023',
			message = 'REQUIREMENT_BASELINE_MISSING';
	end if;

	for v_item in
		select item.candidate_order,
			item.official_id,
			item.interpretation,
			item.requirement_type
		from public.requirement_baseline_items as item
		where item.baseline_id = v_baseline.id
		order by item.candidate_order
	loop
		if v_requirement_list <> '' then
			v_requirement_list := v_requirement_list || E'\n';
		end if;
		v_requirement_list := v_requirement_list
			|| '- ' || coalesce(v_item.official_id, '식별자 미상') || ': ' || v_item.interpretation;
		if v_item.official_id is not null then
			v_officially_identified_count := v_officially_identified_count + 1;
		end if;
	end loop;

	if v_requirement_list = '' then
		raise exception using
			errcode = '22023',
			message = 'PROPOSAL_REQUIREMENTS_MISSING';
	end if;

	insert into public.proposals (
		tenant_id, project_id, run_id, baseline_id, created_by
	)
	values (
		v_baseline.tenant_id,
		v_baseline.project_id,
		v_baseline.run_id,
		v_baseline.id,
		p_actor_id
	)
	returning id into v_proposal_id;

	-- Compliance matrix (verified requirements, no fabrication).
	insert into public.proposal_sections (
		tenant_id, project_id, run_id, proposal_id, section_key, content_md,
		evidence_candidate_ids, generated_by
	)
	select
		v_baseline.tenant_id,
		v_baseline.project_id,
		v_baseline.run_id,
		v_proposal_id,
		'compliance-matrix',
		'# RFP 요구사항 매트릭스' || E'\n\n' || v_requirement_list || E'\n\n' ||
			'## 근거' || E'\n' ||
			'총 ' || v_baseline.candidate_count || '개 요구사항 중 공식 식별자 보유 ' ||
			v_officially_identified_count || '개, 식별자 미상 ' ||
			(v_baseline.candidate_count - v_officially_identified_count) || '개. ' ||
			'모든 항목은 Requirement Baseline에서 직접 도출되었으며 합성·추정 데이터는 포함되지 않습니다.',
		coalesce(
			(SELECT jsonb_agg(item.candidate_id ORDER BY item.candidate_order)
				FROM public.requirement_baseline_items as item
				WHERE item.baseline_id = v_baseline.id),
			'[]'::jsonb
		),
		'deterministic-synth'
	;

	-- Proposal outline (structure, scope, coverage).
	insert into public.proposal_sections (
		tenant_id, project_id, run_id, proposal_id, section_key, content_md,
		evidence_candidate_ids, generated_by
	)
	values (
		v_baseline.tenant_id,
		v_baseline.project_id,
		v_baseline.run_id,
		v_proposal_id,
		'proposal-outline',
		'# 제안서 목차' || E'\n\n' ||
			'1. RFP 요구사항 이해 — 확정 요구사항 ' || v_baseline.candidate_count || '개' || E'\n' ||
			'2. 추진 전략 — 식별된 요구사항 중심' || E'\n' ||
			'3. 일정 및 산출물 — 요구사항별 작성 예정' || E'\n' ||
			'4. 형상 및 산출물' || E'\n' ||
			'5. 운영 및 인수' || E'\n\n' ||
			'## 범위' || E'\n' ||
			'본 목차는 확정 요구사항에서 직접 도출되며, 정량적 실적·자격·재무 데이터는 포함되지 않습니다.',
		'[]'::jsonb,
		'deterministic-synth'
	);

	-- Evaluation mapping (RFP 항목 추적).
	v_section := '# 평가 항목 대응' || E'\n\n' || '| 요구사항 식별자 | 해석 | 평가 매핑 |' || E'\n|---|---|---|';
	for v_item in
		select item.candidate_order, item.official_id, item.interpretation
		from public.requirement_baseline_items as item
		where item.baseline_id = v_baseline.id
		order by item.candidate_order
	loop
		v_section := v_section
			|| E'\n| ' || coalesce(v_item.official_id, '식별자 미상')
			|| ' | ' || v_item.interpretation
			|| ' | 표준 RFP 평가 항목(추정 실적·가격은 제안 단계에서 검증 필요) |';
	end loop;

	insert into public.proposal_sections (
		tenant_id, project_id, run_id, proposal_id, section_key, content_md,
		evidence_candidate_ids, generated_by
)
	values (
		v_baseline.tenant_id,
		v_baseline.project_id,
		v_baseline.run_id,
		v_proposal_id,
		'evaluation-mapping',
		v_section || E'\n\n## 근거' || E'\n' || '모든 평가 대응은 Requirement Baseline의 식별자·해석에서 도출되었습니다.',
		coalesce(
			(SELECT jsonb_agg(item.candidate_id ORDER BY item.candidate_order)
				FROM public.requirement_baseline_items as item
				WHERE item.baseline_id = v_baseline.id),
			'[]'::jsonb
		),
		'deterministic-synth'
	);

	-- Response strategy (human source requirement only).
	insert into public.proposal_sections (
		tenant_id, project_id, run_id, proposal_id, section_key, content_md,
		evidence_candidate_ids, generated_by
)
	values (
		v_baseline.tenant_id,
		v_baseline.project_id,
		v_baseline.run_id,
		v_proposal_id,
		'response-strategy',
		'# 응답 전략' || E'\n\n' ||
			'각 요구사항은 Requirement Baseline의 사람 확인 해석을 그대로 반영하여 응답합니다. ' ||
			'정량적 경쟁력·실적·가격은 제안 단계에서 회사의 진실·최신 정보로 검증되어야 합니다.',
		coalesce(
			(SELECT jsonb_agg(item.candidate_id ORDER BY item.candidate_order)
				FROM public.requirement_baseline_items as item
				WHERE item.baseline_id = v_baseline.id),
			'[]'::jsonb
		),
		'deterministic-synth'
	);

	-- Evidence and gap.
	insert into public.proposal_sections (
		tenant_id, project_id, run_id, proposal_id, section_key, content_md,
		evidence_candidate_ids, generated_by
)
	values (
		v_baseline.tenant_id,
		v_baseline.project_id,
		v_baseline.run_id,
		v_proposal_id,
		'evidence-and-gap',
		'# 근거 및 보완 항목' || E'\n\n' ||
			'## 존재하는 근거' || E'\n' ||
			'본 제안서는 Requirement Baseline ' || v_baseline.version || ' 버전에 등록된 '
			|| v_baseline.candidate_count || '개 요구사항에서 도출되었습니다. ' ||
			'요구사항별 SourceSpan과 해석은 본 제안서의 근거로 활용됩니다.' || E'\n\n' ||
			'## 보완 필요 (합성·추정 금지)' || E'\n' ||
			'- 회사 실적·인증·재무 정보: Baseline에 포함되지 않으므로 사람 검증·입력 필요' || E'\n' ||
			'- 투입 인력·경력: 동일 사유' || E'\n' ||
			'- 제품·서비스 도입 실적: 동일 사유' || E'\n\n' ||
			'## 가시화 요약' || E'\n' ||
			'커버리지 = ' || v_officially_identified_count || ' / ' || v_baseline.candidate_count
			|| ' (공식 식별자 / 전체 요구사항)',
		coalesce(
			(SELECT jsonb_agg(item.candidate_id ORDER BY item.candidate_order)
				FROM public.requirement_baseline_items as item
				WHERE item.baseline_id = v_baseline.id),
			'[]'::jsonb
		),
		'deterministic-synth'
	);

	insert into public.audit_events (
		tenant_id, project_id, actor_user_id, event_type, entity_type, entity_id, event_data
	)
	values (
		v_baseline.tenant_id,
		v_baseline.project_id,
		p_actor_id,
		'PROPOSAL_GENERATED',
		'PROPOSAL',
		v_proposal_id,
		jsonb_build_object(
			'runId', p_run_id,
			'baselineId', v_baseline.id,
			'baselineVersion', v_baseline.version,
			'sectionCount', 5
		)
	);

	return jsonb_build_object(
		'proposalId', v_proposal_id,
		'version', 1,
		'sectionCount', 5
	);
end;
$$;

revoke all on function public.generate_proposal(uuid, uuid)
	from public, anon, authenticated, service_role;
grant execute on function public.generate_proposal(uuid, uuid) to service_role;
