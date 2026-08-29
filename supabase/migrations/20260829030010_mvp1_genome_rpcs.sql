-- MVP1 / MVP2 / MVP3 / MVP5 server-side functions for Project Genome.
-- All SECURITY DEFINER so the trusted-service-role-only pattern holds.

create or replace function public.upsert_project_genome(
	p_actor_id uuid,
	p_tenant_id uuid,
	p_project_id uuid,
	p_rfp_document_id uuid,
	p_rfp_document_parse_id uuid,
	p_draft jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_genome_id uuid;
	v_summary text;
	v_stage text;
	v_parser_key text;
	v_parser_version text;
	v_normalization_version text;
	v_result_sha256 text;
	v_span_count integer;
	v_prompt_version text;
	v_model_fingerprint text;
	v_requirements jsonb;
	v_deliverables jsonb;
	v_evaluation_items jsonb;
	v_contract_terms jsonb;
	v_risks jsonb;
	v_requirement record;
	v_deliverable record;
	v_eval_item record;
	v_contract_term record;
	v_risk record;
begin
	if p_actor_id is null or p_tenant_id is null or p_project_id is null then
		raise exception using errcode = '22023', message = 'GENOME_INPUT_INVALID';
	end if;

	if jsonb_typeof(p_draft) <> 'object' then
		raise exception using errcode = '22023', message = 'GENOME_DRAFT_SHAPE';
	end if;

	v_summary := p_draft ->> 'summary';
	v_parser_key := coalesce(p_draft ->> 'parserKey', 'unknown');
	v_parser_version := coalesce(p_draft ->> 'parserVersion', '0.0.0');
	v_normalization_version := coalesce(p_draft ->> 'normalizationVersion', 'unknown');
	v_result_sha256 := coalesce(p_draft ->> 'resultSha256', repeat('0', 64));
	v_span_count := coalesce((p_draft ->> 'spanCount')::integer, 0);
	v_prompt_version := coalesce(p_draft ->> 'promptVersion', 'unknown');
	v_model_fingerprint := coalesce(p_draft ->> 'modelFingerprint', 'unknown');
	v_requirements := coalesce(p_draft -> 'requirements', '[]'::jsonb);
	v_deliverables := coalesce(p_draft -> 'deliverables', '[]'::jsonb);
	v_evaluation_items := coalesce(p_draft -> 'evaluationItems', '[]'::jsonb);
	v_contract_terms := coalesce(p_draft -> 'contractTerms', '[]'::jsonb);
	v_risks := coalesce(p_draft -> 'risks', '[]'::jsonb);

	if jsonb_typeof(v_requirements) <> 'array' or jsonb_typeof(v_deliverables) <> 'array'
		or jsonb_typeof(v_evaluation_items) <> 'array' or jsonb_typeof(v_contract_terms) <> 'array'
		or jsonb_typeof(v_risks) <> 'array' then
		raise exception using errcode = '22023', message = 'GENOME_DRAFT_ARRAYS';
	end if;

	if v_result_sha256 !~ '^[0-9a-f]{64}$' then
		v_result_sha256 := repeat('0', 64);
	end if;

	-- Verify the actor is allowed to write to this project.
	if not exists (
		select 1 from public.project_memberships as m
		where m.tenant_id = p_tenant_id
			and m.project_id = p_project_id
			and m.user_id = p_actor_id
			and m.role in ('EDITOR'::public.membership_role, 'PROJECT_ADMIN'::public.membership_role)
	) and not exists (
		select 1 from public.tenant_memberships as m
		where m.tenant_id = p_tenant_id
			and m.user_id = p_actor_id
			and m.role = 'TENANT_ADMIN'::public.membership_role
	) then
		raise exception using errcode = '42501', message = 'GENOME_UPSERT_FORBIDDEN';
	end if;

	-- Derive stage from summary keyword (heuristic; refined by caller later).
	v_stage := case
		when v_summary ilike '%proposal%' or v_summary ilike '%제안%' then 'PROPOSAL'
		when v_summary ilike '%contract%' or v_summary ilike '%계약%' then 'CONTRACT'
		when v_summary ilike '%execution%' or v_summary ilike '%수행%' then 'EXECUTION'
		when v_summary ilike '%close%' or v_summary ilike '%종료%' then 'CLOSEOUT'
		else 'DRAFT'
	end;

	insert into public.project_genome (
		tenant_id, project_id, stage, summary,
		rfp_document_id, rfp_document_parse_id,
		created_by
	)
	values (
		p_tenant_id, p_project_id, v_stage, v_summary,
		p_rfp_document_id, p_rfp_document_parse_id,
		p_actor_id
	)
	returning id into v_genome_id;

	-- Insert requirements (idempotent on (genome_id, version, external_id)).
	for v_requirement in
		select * from jsonb_array_elements(v_requirements) as r
	loop
		insert into public.genome_requirements (
			tenant_id, project_id, genome_id, genome_version,
			external_id, title, original_text, normalized_text,
			requirement_type, atomicity, priority, mandatory,
			rfp_page, rfp_paragraph
		)
		values (
			p_tenant_id, p_project_id, v_genome_id, 1,
			v_requirement.value ->> 'externalId',
			v_requirement.value ->> 'title',
			v_requirement.value ->> 'originalText',
			v_requirement.value ->> 'normalizedText',
			v_requirement.value ->> 'requirementType',
			v_requirement.value ->> 'atomicity',
			coalesce(v_requirement.value ->> 'priority', 'NORMAL'),
			coalesce((v_requirement.value ->> 'mandatory')::boolean, true),
			v_requirement.value ->> 'rfpPage',
			v_requirement.value ->> 'rfpParagraph'
		)
		on conflict (tenant_id, project_id, genome_id, genome_version, external_id) do update set
			title = excluded.title,
			original_text = excluded.original_text,
			normalized_text = excluded.normalized_text,
			requirement_type = excluded.requirement_type,
			atomicity = excluded.atomicity,
			priority = excluded.priority,
			mandatory = excluded.mandatory,
			rfp_page = excluded.rfp_page,
			rfp_paragraph = excluded.rfp_paragraph;
	end loop;

	for v_deliverable in
		select * from jsonb_array_elements(v_deliverables) as d
	loop
		insert into public.genome_deliverables (
			tenant_id, project_id, genome_id, genome_version,
			external_id, title, description, submission_phase, mandatory, rfp_page
		)
		values (
			p_tenant_id, p_project_id, v_genome_id, 1,
			v_deliverable.value ->> 'externalId',
			v_deliverable.value ->> 'title',
			v_deliverable.value ->> 'description',
			v_deliverable.value ->> 'submissionPhase',
			coalesce((v_deliverable.value ->> 'mandatory')::boolean, true),
			v_deliverable.value ->> 'rfpPage'
		)
		on conflict (tenant_id, project_id, genome_id, genome_version, external_id) do update set
			title = excluded.title,
			description = excluded.description,
			submission_phase = excluded.submission_phase,
			mandatory = excluded.mandatory,
			rfp_page = excluded.rfp_page;
	end loop;

	for v_eval_item in
		select * from jsonb_array_elements(v_evaluation_items) as e
	loop
		insert into public.genome_evaluation_items (
			tenant_id, project_id, genome_id, genome_version,
			external_id, category, title, max_score, method, rfp_page
		)
		values (
			p_tenant_id, p_project_id, v_genome_id, 1,
			v_eval_item.value ->> 'externalId',
			v_eval_item.value ->> 'category',
			v_eval_item.value ->> 'title',
			(v_eval_item.value ->> 'maxScore')::numeric,
			v_eval_item.value ->> 'method',
			v_eval_item.value ->> 'rfpPage'
		)
		on conflict (tenant_id, project_id, genome_id, genome_version, external_id) do update set
			category = excluded.category,
			title = excluded.title,
			max_score = excluded.max_score,
			method = excluded.method,
			rfp_page = excluded.rfp_page;
	end loop;

	for v_contract_term in
		select * from jsonb_array_elements(v_contract_terms) as c
	loop
		insert into public.genome_contract_terms (
			tenant_id, project_id, genome_id, genome_version,
			external_id, term_type, title, original_text, rfp_page
		)
		values (
			p_tenant_id, p_project_id, v_genome_id, 1,
			v_contract_term.value ->> 'externalId',
			v_contract_term.value ->> 'termType',
			v_contract_term.value ->> 'title',
			v_contract_term.value ->> 'originalText',
			v_contract_term.value ->> 'rfpPage'
		)
		on conflict (tenant_id, project_id, genome_id, genome_version, external_id) do update set
			term_type = excluded.term_type,
			title = excluded.title,
			original_text = excluded.original_text,
			rfp_page = excluded.rfp_page;
	end loop;

	for v_risk in
		select * from jsonb_array_elements(v_risks) as rk
	loop
		insert into public.genome_risks (
			tenant_id, project_id, genome_id, genome_version,
			external_id, severity, title, description, mitigation, rfp_page
		)
		values (
			p_tenant_id, p_project_id, v_genome_id, 1,
			v_risk.value ->> 'externalId',
			v_risk.value ->> 'severity',
			v_risk.value ->> 'title',
			v_risk.value ->> 'description',
			v_risk.value ->> 'mitigation',
			v_risk.value ->> 'rfpPage'
		)
		on conflict (tenant_id, project_id, genome_id, genome_version, external_id) do update set
			severity = excluded.severity,
			title = excluded.title,
			description = excluded.description,
			mitigation = excluded.mitigation,
			rfp_page = excluded.rfp_page;
	end loop;

	insert into public.genome_audit_events (
		tenant_id, project_id, genome_id, actor_user_id,
		event_type, entity_type, entity_id, event_data
	)
	values (
		p_tenant_id, p_project_id, v_genome_id, p_actor_id,
		'GENOME_BUILT', 'PROJECT_GENOME', v_genome_id,
		jsonb_build_object(
			'parserKey', v_parser_key,
			'parserVersion', v_parser_version,
			'normalizationVersion', v_normalization_version,
			'resultSha256', v_result_sha256,
			'spanCount', v_span_count,
			'promptVersion', v_prompt_version,
			'modelFingerprint', v_model_fingerprint,
			'requirementCount', jsonb_array_length(v_requirements),
			'deliverableCount', jsonb_array_length(v_deliverables),
			'evaluationItemCount', jsonb_array_length(v_evaluation_items),
			'contractTermCount', jsonb_array_length(v_contract_terms),
			'riskCount', jsonb_array_length(v_risks)
		)
	);

	return v_genome_id;
end;
$$;

revoke all on function public.upsert_project_genome(uuid, uuid, uuid, uuid, uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.upsert_project_genome(uuid, uuid, uuid, uuid, uuid, jsonb) to service_role;

create or replace function public.load_project_genome(
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
	v_genome record;
	v_requirements jsonb;
	v_deliverables jsonb;
	v_evaluation_items jsonb;
	v_contract_terms jsonb;
	v_risks jsonb;
	v_audit jsonb;
begin
	select * into v_genome
	from public.project_genome
	where id = p_genome_id
		and tenant_id = p_tenant_id
		and project_id = p_project_id;

	if v_genome.id is null then
		raise exception using errcode = '22023', message = 'GENOME_NOT_FOUND';
	end if;

	select coalesce(jsonb_agg(to_jsonb(r) order by r.external_id), '[]'::jsonb) into v_requirements
	from (
		select external_id, title, original_text, requirement_type, priority, mandatory, human_verified, rfp_page
		from public.genome_requirements
		where genome_id = v_genome.id
		order by external_id
	) r;

	select coalesce(jsonb_agg(to_jsonb(d) order by d.external_id), '[]'::jsonb) into v_deliverables
	from (
		select external_id, title, description, submission_phase, mandatory
		from public.genome_deliverables
		where genome_id = v_genome.id
		order by external_id
	) d;

	select coalesce(jsonb_agg(to_jsonb(e) order by e.external_id), '[]'::jsonb) into v_evaluation_items
	from (
		select external_id, category, title, max_score
		from public.genome_evaluation_items
		where genome_id = v_genome.id
		order by external_id
	) e;

	select coalesce(jsonb_agg(to_jsonb(c) order by c.external_id), '[]'::jsonb) into v_contract_terms
	from (
		select external_id, term_type, title, original_text
		from public.genome_contract_terms
		where genome_id = v_genome.id
		order by external_id
	) c;

	select coalesce(jsonb_agg(to_jsonb(r) order by r.external_id), '[]'::jsonb) into v_risks
	from (
		select external_id, severity, title, description, mitigation
		from public.genome_risks
		where genome_id = v_genome.id
		order by external_id
	) r;

	select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb) into v_audit
	from (
		select event_type, actor_user_id, created_at
		from public.genome_audit_events
		where genome_id = v_genome.id
		order by created_at desc
		limit 50
	) a;

	return jsonb_build_object(
		'genome', jsonb_build_object(
			'id', v_genome.id,
			'stage', v_genome.stage,
			'summary', v_genome.summary,
			'rfp_document_id', v_genome.rfp_document_id,
			'rfp_document_parse_id', v_genome.rfp_document_parse_id,
			'created_at', v_genome.created_at,
			'updated_at', v_genome.updated_at
		),
		'requirements', v_requirements,
		'deliverables', v_deliverables,
		'evaluationItems', v_evaluation_items,
		'contractTerms', v_contract_terms,
		'risks', v_risks,
		'auditEvents', v_audit
	);
end;
$$;

revoke all on function public.load_project_genome(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.load_project_genome(uuid, uuid, uuid) to service_role;

create or replace function public.list_project_genomes(
	p_tenant_id uuid,
	p_project_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
	v_out jsonb;
begin
	select coalesce(jsonb_agg(to_jsonb(g) order by g.updated_at desc), '[]'::jsonb) into v_out
	from (
		select id, stage, summary, created_at, updated_at
		from public.project_genome
		where tenant_id = p_tenant_id
			and project_id = p_project_id
		order by updated_at desc
	) g;
	return v_out;
end;
$$;

revoke all on function public.list_project_genomes(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.list_project_genomes(uuid, uuid) to service_role;
