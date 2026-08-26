begin;

select plan(14);

insert into auth.users (id, email)
values
	('51000000-0000-4000-8000-000000000001', 'm11-editor-a@example.test'),
	('51000000-0000-4000-8000-000000000002', 'm11-viewer-a@example.test'),
	('51000000-0000-4000-8000-000000000005', 'm11-editor-b@example.test');

insert into public.tenants (id, name, created_by)
values
	('52000000-0000-4000-8000-000000000001', 'M11 synthetic tenant A', '51000000-0000-4000-8000-000000000001'),
	('52000000-0000-4000-8000-000000000002', 'M11 synthetic tenant B', '51000000-0000-4000-8000-000000000005');

insert into public.projects (id, tenant_id, name, created_by)
values
	('52000000-0000-4000-8000-000000000101', '52000000-0000-4000-8000-000000000001', 'M11 synthetic project A', '51000000-0000-4000-8000-000000000001'),
	('52000000-0000-4000-8000-000000000201', '52000000-0000-4000-8000-000000000002', 'M11 synthetic project B', '51000000-0000-4000-8000-000000000005');

insert into public.project_memberships (tenant_id, project_id, user_id, role)
values
	('52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101', '51000000-0000-4000-8000-000000000001', 'EDITOR'),
	('52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101', '51000000-0000-4000-8000-000000000002', 'VIEWER'),
	('52000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000201', '51000000-0000-4000-8000-000000000005', 'EDITOR');

insert into public.documents (
	id, tenant_id, project_id, document_kind, privacy_classification,
	original_filename, media_type, byte_size, storage_path, sha256, created_by
)
values
	(
		'53000000-0000-4000-8000-000000000101',
		'52000000-0000-4000-8000-000000000001',
		'52000000-0000-4000-8000-000000000101',
		'RFP', 'INTERNAL', 'm11-a.synthetic.txt', 'text/plain', 64,
		'52000000-0000-4000-8000-000000000101/53000000-0000-4000-8000-000000000101/original',
		repeat('a', 64), '51000000-0000-4000-8000-000000000001'
	);

insert into public.document_parses (
	id, tenant_id, project_id, document_id, source_sha256, parser_key, parser_version,
	normalization_version, detected_format, warnings, span_count, result_sha256, created_by
)
values
	(
		'54000000-0000-4000-8000-000000000101',
		'52000000-0000-4000-8000-000000000001',
		'52000000-0000-4000-8000-000000000101',
		'53000000-0000-4000-8000-000000000101', repeat('a', 64),
		'plain-text', '1.0.0', 'nfc-lines-v1', 'txt', '[]', 1, repeat('1', 64),
		'51000000-0000-4000-8000-000000000001'
	);

insert into public.source_spans (
	id, tenant_id, project_id, document_id, document_parse_id, ordinal, location,
	original_text, normalized_text, original_text_sha256
)
values
	(
		'55000000-0000-4000-8000-000000000101',
		'52000000-0000-4000-8000-000000000001',
		'52000000-0000-4000-8000-000000000101',
		'53000000-0000-4000-8000-000000000101',
		'54000000-0000-4000-8000-000000000101', 1,
		'{"kind":"TEXT_LINES","lineStart":1,"lineEnd":1}',
		'○ SER-001 최소권한 요구', 'SER-001 최소권한 요구', private.source_text_sha256('○ SER-001 최소권한 요구')
	);

insert into public.requirement_extraction_runs (
	id, tenant_id, project_id, document_id, document_parse_id, privacy_classification,
	provider, model, policy_version, prompt_version, schema_version, parse_result_sha256,
	canonical_input_sha256, fingerprint_sha256, accepted_output_sha256, created_by
)
values
	(
		'56000000-0000-4000-8000-000000000101',
		'52000000-0000-4000-8000-000000000001',
		'52000000-0000-4000-8000-000000000101',
		'53000000-0000-4000-8000-000000000101',
		'54000000-0000-4000-8000-000000000101', 'INTERNAL',
		'OPENAI', 'synthetic-model', 'document-privacy-v1', 'requirement-extraction-v1',
		'requirement-candidates-v1', repeat('1', 64), repeat('3', 64), repeat('4', 64),
		repeat('5', 64), '51000000-0000-4000-8000-000000000001'
	);

insert into public.requirement_candidates (
	id, tenant_id, project_id, document_id, document_parse_id, run_id, candidate_order,
	official_id, source_text, interpretation, requirement_type, atomicity,
	provenance_state, content_sha256
)
values
	(
		'57000000-0000-4000-8000-000000000101',
		'52000000-0000-4000-8000-000000000001',
		'52000000-0000-4000-8000-000000000101',
		'53000000-0000-4000-8000-000000000101',
		'54000000-0000-4000-8000-000000000101',
		'56000000-0000-4000-8000-000000000101', 1, 'SER-001',
		'○ SER-001 최소권한 요구', '최소권한으로 관리', 'SECURITY', 'ATOMIC',
		'HUMAN_VERIFIED', repeat('1', 64)
	),
	(
		'57000000-0000-4000-8000-000000000102',
		'52000000-0000-4000-8000-000000000001',
		'52000000-0000-4000-8000-000000000101',
		'53000000-0000-4000-8000-000000000101',
		'54000000-0000-4000-8000-000000000101',
		'56000000-0000-4000-8000-000000000101', 2, 'PMR-001',
		'○ PMR-001 주간 보고 요구', '주간 보고 수행', 'PROJECT_MANAGEMENT', 'ATOMIC',
		'AI_DRAFT', repeat('2', 64)
	),
	(
		'57000000-0000-4000-8000-000000000103',
		'52000000-0000-4000-8000-000000000001',
		'52000000-0000-4000-8000-000000000101',
		'53000000-0000-4000-8000-000000000101',
		'54000000-0000-4000-8000-000000000101',
		'56000000-0000-4000-8000-000000000101', 3, 'PSR-001',
		'○ PSR-001 교육 요구', '교육 제공', 'PROJECT_SUPPORT', 'ATOMIC',
		'HUMAN_VERIFIED', repeat('3', 64)
	);

insert into public.requirement_candidate_source_spans (
	tenant_id, project_id, document_id, document_parse_id, run_id,
	candidate_id, source_span_id, source_order
)
values
	('52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101', '53000000-0000-4000-8000-000000000101', '54000000-0000-4000-8000-000000000101', '56000000-0000-4000-8000-000000000101', '57000000-0000-4000-8000-000000000101', '55000000-0000-4000-8000-000000000101', 1),
	('52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101', '53000000-0000-4000-8000-000000000101', '54000000-0000-4000-8000-000000000101', '56000000-0000-4000-8000-000000000101', '57000000-0000-4000-8000-000000000102', '55000000-0000-4000-8000-000000000101', 1);

-- A verified candidate without evidence exists from seeding and blocks the
-- baseline after the draft is finalized (asserted below).

-- 1. finalize fails while an AI_DRAFT candidate remains.
set local role service_role;
select throws_ok(
	format(
		'SELECT public.create_requirement_baseline(%L, %L)',
		'51000000-0000-4000-8000-000000000001',
		'56000000-0000-4000-8000-000000000101'
	),
	'42501',
	NULL,
	'unfinalized AI_DRAFT candidates block the baseline'
);

-- 2. verified candidates without SourceSpan evidence also block the baseline.
select throws_ok(
	format(
		'SELECT public.create_requirement_baseline(%L, %L)',
		'51000000-0000-4000-8000-000000000001',
		'56000000-0000-4000-8000-000000000101'
	),
	'42501',
	NULL,
	'finalize fails while any verified candidate lacks SourceSpan evidence');
reset role;

-- 3. finalize the remaining draft.
set local role service_role;
select public.review_requirement_candidate(
	'51000000-0000-4000-8000-000000000001',
	'56000000-0000-4000-8000-000000000101',
	'57000000-0000-4000-8000-000000000102',
	'APPROVE',
	NULL
);
reset role;

set local role service_role;
select throws_ok(
	format(
		'SELECT public.create_requirement_baseline(%L, %L)',
		'51000000-0000-4000-8000-000000000001',
		'56000000-0000-4000-8000-000000000101'
	),
	'42501',
	NULL,
	'verified candidates without SourceSpan evidence block the baseline'
);
-- Rejecting the evidence-less candidate is the only human path forward.
select public.review_requirement_candidate(
	'51000000-0000-4000-8000-000000000001',
	'56000000-0000-4000-8000-000000000101',
	'57000000-0000-4000-8000-000000000103',
	'REJECT',
	NULL
);
reset role;

set local role service_role;
select is(
	public.create_requirement_baseline(
		'51000000-0000-4000-8000-000000000001',
		'56000000-0000-4000-8000-000000000101'
	) ->> 'version',
	'1',
	'baseline version one is created'
);
reset role;

-- 3. snapshot content is frozen and complete.
select is(
	(
		select count(*)::integer
		from public.requirement_baseline_items
		where run_id = '56000000-0000-4000-8000-000000000101'
	),
	2,
	'baseline snapshot contains every verified candidate'
);
select is(
	(
		select item.interpretation
		from public.requirement_baseline_items as item
		where item.official_id = 'SER-001'
	),
	'최소권한으로 관리',
	'baseline items freeze candidate content'
);
select is(
	(
		select count(*)::integer
		from public.requirement_baselines
		where run_id = '56000000-0000-4000-8000-000000000101'
			and length(content_sha256) = 64
	),
	1,
	'baseline stores a content hash'
);

-- 4. a second finalize creates version two, never mutates version one.
set local role service_role;
select is(
	public.create_requirement_baseline(
		'51000000-0000-4000-8000-000000000001',
		'56000000-0000-4000-8000-000000000101'
	) ->> 'version',
	'2',
	'changes create a new baseline version'
);
reset role;

select is(
	(
		select count(*)::integer
		from public.requirement_baselines
		where run_id = '56000000-0000-4000-8000-000000000101'
	),
	2,
	'both baseline versions remain immutable snapshots'
);

-- 5. cross-project editor and viewer cannot finalize.
set local role service_role;
select throws_ok(
	format(
		'SELECT public.create_requirement_baseline(%L, %L)',
		'51000000-0000-4000-8000-000000000005',
		'56000000-0000-4000-8000-000000000101'
	),
	'42501',
	NULL,
	'cross-project editor cannot create a baseline'
);
reset role;

-- 6. audit records the baseline creation.
select is(
	(
		select count(*)::integer
		from public.audit_events
		where event_type = 'REQUIREMENT_BASELINE_CREATED'
			and actor_user_id = '51000000-0000-4000-8000-000000000001'
	),
	2,
	'baseline creations are audited'
);

-- 7. authenticated users can read but never write baselines.
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select is(
	(
		select count(*)::integer
		from public.requirement_baselines
		where run_id = '56000000-0000-4000-8000-000000000101'
	),
	2,
	'project editor reads baseline versions'
);
select throws_ok(
	'INSERT INTO public.requirement_baselines (tenant_id, project_id, run_id, version, content_sha256, candidate_count, created_by) VALUES (NULL, NULL, NULL, 1, repeat(''3'', 64), 1, NULL)',
	'42501',
	NULL,
	'authenticated direct baseline insert is denied'
);
reset role;

select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000005', true);
set local role authenticated;
select is(
	(
		select count(*)::integer
		from public.requirement_baselines
		where run_id = '56000000-0000-4000-8000-000000000101'
	),
	0,
	'cross-project editor reads zero baselines'
);
reset role;

select * from finish();
rollback;
