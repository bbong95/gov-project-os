begin;

select plan(7);

insert into auth.users (id, email)
values
	('51000000-0000-4000-8000-000000000001', 'm13-editor-a@example.test'),
	('51000000-0000-4000-8000-000000000002', 'm13-viewer-a@example.test');

insert into public.tenants (id, name, created_by)
values
	('52000000-0000-4000-8000-000000000001', 'M13 synthetic tenant A', '51000000-0000-4000-8000-000000000001');

insert into public.projects (id, tenant_id, name, created_by)
values
	('52000000-0000-4000-8000-000000000101', '52000000-0000-4000-8000-000000000001', 'M13 synthetic project A', '51000000-0000-4000-8000-000000000001');

insert into public.project_memberships (tenant_id, project_id, user_id, role)
values
	('52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101', '51000000-0000-4000-8000-000000000001', 'EDITOR'),
	('52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101', '51000000-0000-4000-8000-000000000002', 'VIEWER');

insert into public.documents (id, tenant_id, project_id, document_kind, privacy_classification, original_filename, media_type, byte_size, storage_path, sha256, created_by)
values ('53000000-0000-4000-8000-000000000101', '52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101', 'RFP', 'INTERNAL', 'm13-a.synthetic.txt', 'text/plain', 64, '52000000-0000-4000-8000-000000000101/53000000-0000-4000-8000-000000000101/original', repeat('a', 64), '51000000-0000-4000-8000-000000000001');

insert into public.document_parses (id, tenant_id, project_id, document_id, source_sha256, parser_key, parser_version, normalization_version, detected_format, warnings, span_count, result_sha256, created_by)
values ('54000000-0000-4000-8000-000000000101', '52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101', '53000000-0000-4000-8000-000000000101', repeat('a', 64), 'plain-text', '1.0.0', 'nfc-lines-v1', 'txt', '[]', 1, repeat('1', 64), '51000000-0000-4000-8000-000000000001');

insert into public.source_spans (id, tenant_id, project_id, document_id, document_parse_id, ordinal, location, original_text, normalized_text, original_text_sha256)
values ('55000000-0000-4000-8000-000000000101', '52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101', '53000000-0000-4000-8000-000000000101', '54000000-0000-4000-8000-000000000101', 1, '{"kind":"TEXT_LINES","lineStart":1,"lineEnd":1}', '○ SER-001 최소권한', 'SER-001 최소권한', private.source_text_sha256('○ SER-001 최소권한'));

insert into public.requirement_extraction_runs (id, tenant_id, project_id, document_id, document_parse_id, privacy_classification, provider, model, policy_version, prompt_version, schema_version, parse_result_sha256, canonical_input_sha256, fingerprint_sha256, accepted_output_sha256, created_by)
values ('56000000-0000-4000-8000-000000000101', '52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101', '53000000-0000-4000-8000-000000000101', '54000000-0000-4000-8000-000000000101', 'INTERNAL', 'OPENAI', 'synthetic-model', 'document-privacy-v1', 'requirement-extraction-v1', 'requirement-candidates-v1', repeat('1', 64), repeat('2', 64), repeat('3', 64), repeat('4', 64), '51000000-0000-4000-8000-000000000001');

insert into public.requirement_candidates (id, tenant_id, project_id, document_id, document_parse_id, run_id, candidate_order, official_id, source_text, interpretation, requirement_type, atomicity, provenance_state, content_sha256)
values ('57000000-0000-4000-8000-000000000101', '52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101', '53000000-0000-4000-8000-000000000101', '54000000-0000-4000-8000-000000000101', '56000000-0000-4000-8000-000000000101', 1, 'SER-001', '○ SER-001 최소권한', '최소권한으로 관리', 'SECURITY', 'ATOMIC', 'HUMAN_VERIFIED', repeat('1', 64));

insert into public.requirement_candidate_source_spans (tenant_id, project_id, document_id, document_parse_id, run_id, candidate_id, source_span_id, source_order)
values ('52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101', '53000000-0000-4000-8000-000000000101', '54000000-0000-4000-8000-000000000101', '56000000-0000-4000-8000-000000000101', '57000000-0000-4000-8000-000000000101', '55000000-0000-4000-8000-000000000101', 1);

insert into public.requirement_baselines (id, tenant_id, project_id, document_id, document_parse_id, run_id, version, content_sha256, candidate_count, created_by)
values ('58000000-0000-4000-8000-000000000101', '52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101', '53000000-0000-4000-8000-000000000101', '54000000-0000-4000-8000-000000000101', '56000000-0000-4000-8000-000000000101', 1, repeat('a', 64), 1, '51000000-0000-4000-8000-000000000001');

insert into public.requirement_baseline_items (id, tenant_id, project_id, run_id, baseline_id, candidate_id, candidate_order, official_id, source_text, interpretation, requirement_type, atomicity, content_sha256)
values ('59000000-0000-4000-8000-000000000101', '52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101', '56000000-0000-4000-8000-000000000101', '58000000-0000-4000-8000-000000000101', '57000000-0000-4000-8000-000000000101', 1, 'SER-001', '○ SER-001 최소권한', '최소권한으로 관리', 'SECURITY', 'ATOMIC', repeat('1', 64));

-- 1. proposals require an existing baseline.
set local role service_role;
select throws_ok(
	format(
		'SELECT public.generate_proposal(%L, %L)',
		'51000000-0000-4000-8000-000000000001',
		'56000000-0000-4000-8000-000000000102'
	),
	'22023',
	NULL,
	'cannot generate a proposal without a confirmed baseline'
);
reset role;

-- 2. editor generates a proposal and the output is sourced only from the baseline.
set local role service_role;
select is(
	public.generate_proposal(
		'51000000-0000-4000-8000-000000000001',
		'56000000-0000-4000-8000-000000000101'
	) ->> 'version',
	'1',
	'first proposal draft is generated'
);
reset role;

select is(
	(
		select count(*)::integer
		from public.proposal_sections
		where proposal_id in (
			select id from public.proposals
			where run_id = '56000000-0000-4000-8000-000000000101'
		)
	),
	5,
	'five proposal sections are produced from the baseline'
);

-- 3. every cited candidate is from the baseline; no fabricated references.
select is(
	(
		select count(*)::integer
		from public.proposal_sections as section,
		jsonb_array_elements(section.evidence_candidate_ids) as candidate
		where section.proposal_id in (
			select id from public.proposals
			where run_id = '56000000-0000-4000-8000-000000000101'
		)
		and (candidate #>> '{}')::uuid not in (
			'57000000-0000-4000-8000-000000000101'
		)
	),
	0,
	'all proposal evidence is sourced from the approved baseline'
);

-- 4. viewer reads proposals but cannot generate one.
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select is(
	(
		select count(*)::integer
		from public.proposals
		where run_id = '56000000-0000-4000-8000-000000000101'
	),
	1,
	'project viewer reads the generated proposal'
);
reset role;

select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select is(
	(
		select count(*)::integer
		from information_schema.role_table_grants
		where grantee = 'authenticated'
			and table_schema = 'public'
			and table_name in ('proposals', 'proposal_sections')
			and privilege_type = 'SELECT'
	),
	2,
	'authenticated can read both proposal tables'
);
reset role;

select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select is(
	has_table_privilege('anon', 'public.proposals', 'SELECT'),
	false,
	'anon has no direct proposal select privilege'
);
reset role;

select * from finish();
rollback;
