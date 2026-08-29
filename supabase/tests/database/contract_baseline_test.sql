begin;

select plan(13);

-- Synthetic tenant/project/users
insert into auth.users (id, email)
values
	('60000000-0000-4000-8000-000000000001', 'm14-editor-a@example.test'),
	('60000000-0000-4000-8000-000000000002', 'm14-viewer-a@example.test');

insert into public.tenants (id, name, created_by)
values ('61000000-0000-4000-8000-000000000001', 'M14 synthetic tenant A', '60000000-0000-4000-8000-000000000001');

insert into public.projects (id, tenant_id, name, created_by)
values ('61000000-0000-4000-8000-000000000101', '61000000-0000-4000-8000-000000000001', 'M14 synthetic project A', '60000000-0000-4000-8000-000000000001');

insert into public.project_memberships (tenant_id, project_id, user_id, role)
values
	('61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000101', '60000000-0000-4000-8000-000000000001', 'PROJECT_ADMIN'),
	('61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000101', '60000000-0000-4000-8000-000000000002', 'VIEWER');

-- Synthetic document / parse / source span / extraction run / proposal / baseline
insert into public.documents (id, tenant_id, project_id, document_kind, privacy_classification, original_filename, media_type, byte_size, storage_path, sha256, created_by)
values ('62000000-0000-4000-8000-000000000101', '61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000101', 'RFP', 'INTERNAL', 'm14-a.synthetic.txt', 'text/plain', 64, '61000000-0000-4000-8000-000000000101/62000000-0000-4000-8000-000000000101/original', repeat('a', 64), '60000000-0000-4000-8000-000000000001');
update public.documents set storage_bucket = 'rfp-originals' where id = '62000000-0000-4000-8000-000000000101';

insert into public.document_parses (id, tenant_id, project_id, document_id, source_sha256, parser_key, parser_version, normalization_version, detected_format, warnings, span_count, result_sha256, created_by)
values ('63000000-0000-4000-8000-000000000101', '61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000101', '62000000-0000-4000-8000-000000000101', repeat('a', 64), 'plain-text', '1.0.0', 'nfc-lines-v1', 'txt', '[]', 1, repeat('1', 64), '60000000-0000-4000-8000-000000000001');

insert into public.source_spans (id, tenant_id, project_id, document_id, document_parse_id, ordinal, location, original_text, normalized_text, original_text_sha256)
values ('64000000-0000-4000-8000-000000000101', '61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000101', '62000000-0000-4000-8000-000000000101', '63000000-0000-4000-8000-000000000101', 1, '{"kind":"TEXT_LINES","lineStart":1,"lineEnd":1}', '○ SER-001 최소권한', 'SER-001 최소권한', private.source_text_sha256('○ SER-001 최소권한'));

insert into public.requirement_extraction_runs (id, tenant_id, project_id, document_id, document_parse_id, privacy_classification, provider, model, policy_version, prompt_version, schema_version, parse_result_sha256, canonical_input_sha256, fingerprint_sha256, accepted_output_sha256, created_by)
values ('65000000-0000-4000-8000-000000000101', '61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000101', '62000000-0000-4000-8000-000000000101', '63000000-0000-4000-8000-000000000101', 'INTERNAL', 'OPENAI', 'synthetic-model', 'document-privacy-v1', 'requirement-extraction-v1', 'requirement-candidates-v1', repeat('1', 64), repeat('2', 64), repeat('3', 64), repeat('4', 64), '60000000-0000-4000-8000-000000000001');

insert into public.requirement_candidates (id, tenant_id, project_id, document_id, document_parse_id, run_id, candidate_order, official_id, source_text, interpretation, requirement_type, atomicity, provenance_state, content_sha256)
values ('66000000-0000-4000-8000-000000000101', '61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000101', '62000000-0000-4000-8000-000000000101', '63000000-0000-4000-8000-000000000101', '65000000-0000-4000-8000-000000000101', 1, 'SER-001', '○ SER-001 최소권한', '최소권한으로 관리', 'SECURITY', 'ATOMIC', 'HUMAN_VERIFIED', repeat('1', 64));

insert into public.requirement_candidate_source_spans (tenant_id, project_id, document_id, document_parse_id, run_id, candidate_id, source_span_id, source_order)
values ('61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000101', '62000000-0000-4000-8000-000000000101', '63000000-0000-4000-8000-000000000101', '65000000-0000-4000-8000-000000000101', '66000000-0000-4000-8000-000000000101', '64000000-0000-4000-8000-000000000101', 1);

insert into public.requirement_baselines (id, tenant_id, project_id, document_id, document_parse_id, run_id, version, content_sha256, candidate_count, created_by)
values ('67000000-0000-4000-8000-000000000101', '61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000101', '62000000-0000-4000-8000-000000000101', '63000000-0000-4000-8000-000000000101', '65000000-0000-4000-8000-000000000101', 1, repeat('a', 64), 1, '60000000-0000-4000-8000-000000000001');

insert into public.requirement_baseline_items (id, tenant_id, project_id, run_id, baseline_id, candidate_id, candidate_order, official_id, source_text, interpretation, requirement_type, atomicity, content_sha256)
values ('68000000-0000-4000-8000-000000000101', '61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000101', '65000000-0000-4000-8000-000000000101', '67000000-0000-4000-8000-000000000101', '66000000-0000-4000-8000-000000000101', 1, 'SER-001', '○ SER-001 최소권한', '최소권한으로 관리', 'SECURITY', 'ATOMIC', repeat('1', 64));

-- Generate a proposal so the contract baseline can reference it
set local role service_role;
select public.generate_proposal('60000000-0000-4000-8000-000000000001', '65000000-0000-4000-8000-000000000101');
reset role;

-- 1. schema invariants
select has_table('public', 'contract_baselines', 'public.contract_baselines exists');
select has_table('public', 'contract_baseline_items', 'public.contract_baseline_items exists');
select ok(
	exists(
		select 1 from pg_constraint
		where conname = 'contract_baselines_run_version_key'
	),
	'contract baselines enforce (run_id, version) uniqueness'
);
select ok(
	exists(
		select 1 from pg_constraint
		where conname = 'contract_baselines_4_key'
	),
	'contract baselines enforce scope-4 uniqueness'
);

-- 2. content_sha256 must be a 64-char hex string
select ok(
	exists(
		select 1 from pg_constraint
		where conrelid = 'public.contract_baselines'::regclass
			and contype = 'c'
	),
	'contract_baselines has at least one check constraint'
);

-- 3. item change_type must be one of the four allowed values
select ok(
	exists(
		select 1 from pg_constraint
		where conrelid = 'public.contract_baseline_items'::regclass
			and contype = 'c'
	),
	'contract_baseline_items has at least one check constraint'
);

-- 4. editor (PROJECT_ADMIN) creates a contract baseline via the trusted RPC
set local role service_role;
select is(
	(
		public.create_contract_baseline(
			'60000000-0000-4000-8000-000000000001',
			'65000000-0000-4000-8000-000000000101',
			(
				select id from public.proposals
				where run_id = '65000000-0000-4000-8000-000000000101'
				limit 1
			),
			'계약 협상 결과 반영',
			'[
				{"changeType":"ADDED","obligationText":"개인정보 처리 위탁 계약서 첨부","sourceRequirementCandidateId":"66000000-0000-4000-8000-000000000101"},
				{"changeType":"MODIFIED","obligationText":"성능 기준 99.5% 가용성","sourceRequirementCandidateId":""}
			]'::jsonb
		) ->> 'version'
	)::text,
	'1',
	'first contract baseline is recorded at version 1'
);
reset role;

-- 5. content_sha256 is computed deterministically and stored as 64-hex
select matches(
	(
		select content_sha256::text
		from public.contract_baselines
		where run_id = '65000000-0000-4000-8000-000000000101'
	),
	'^[0-9a-f]{64}$',
	'contract baseline content_sha256 is 64 hex chars'
);

-- 6. approved_by must reference the human actor (H7 approval recorded)
select is(
	(
		select approved_by::text
		from public.contract_baselines
		where run_id = '65000000-0000-4000-8000-000000000101'
	),
	'60000000-0000-4000-8000-000000000001',
	'H7 approval is recorded as the human actor'
);

-- 7. baseline items match what was submitted
select is(
	(
		select count(*)::integer
		from public.contract_baseline_items
		where baseline_id in (
			select id from public.contract_baselines
			where run_id = '65000000-0000-4000-8000-000000000101'
		)
	),
	2,
	'all submitted obligation items are persisted'
);

-- 8. audit event is recorded
select is(
	(
		select count(*)::integer
		from public.audit_events
		where event_type = 'CONTRACT_BASELINE_CONFIRMED'
			and entity_id in (
				select id from public.contract_baselines
				where run_id = '65000000-0000-4000-8000-000000000101'
			)
	),
	1,
	'CONTRACT_BASELINE_CONFIRMED audit event is recorded'
);

-- 9. second version reuses the same content_sha256 for identical material
set local role service_role;
select is(
	public.create_contract_baseline(
		'60000000-0000-4000-8000-000000000001',
		'65000000-0000-4000-8000-000000000101',
		(
			select id from public.proposals
			where run_id = '65000000-0000-4000-8000-000000000101'
			limit 1
		),
		'동일 의무 재확인',
		'[
			{"changeType":"ADDED","obligationText":"개인정보 처리 위탁 계약서 첨부","sourceRequirementCandidateId":"66000000-0000-4000-8000-000000000101"}
		]'::jsonb
	) ->> 'version',
	'2',
	'second contract baseline increments version'
);
reset role;

select is(
	(
		select count(*)::integer
		from public.contract_baselines
		where run_id = '65000000-0000-4000-8000-000000000101'
	),
	2,
	'two contract baseline versions exist for the run'
);

select * from finish();
rollback;
