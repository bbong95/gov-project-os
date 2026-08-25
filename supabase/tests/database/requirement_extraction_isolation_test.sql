begin;

select plan(27);

insert into auth.users (id, email)
values
	('51000000-0000-4000-8000-000000000001', 'm08-editor-a@example.test'),
	('51000000-0000-4000-8000-000000000002', 'm08-viewer-a@example.test'),
	('51000000-0000-4000-8000-000000000003', 'm08-reviewer-a@example.test'),
	('51000000-0000-4000-8000-000000000004', 'm08-tenant-admin-a@example.test'),
	('51000000-0000-4000-8000-000000000005', 'm08-editor-b@example.test'),
	('51000000-0000-4000-8000-000000000006', 'm08-tenant-admin-b@example.test');

insert into public.tenants (id, name, created_by)
values
	('52000000-0000-4000-8000-000000000001', 'M08 합성 기관 A', '51000000-0000-4000-8000-000000000004'),
	('52000000-0000-4000-8000-000000000002', 'M08 합성 기관 B', '51000000-0000-4000-8000-000000000006');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
	('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000004', 'TENANT_ADMIN'),
	('52000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000006', 'TENANT_ADMIN');

insert into public.projects (id, tenant_id, name, created_by)
values
	('52000000-0000-4000-8000-000000000101', '52000000-0000-4000-8000-000000000001', 'M08 합성 프로젝트 A', '51000000-0000-4000-8000-000000000004'),
	('52000000-0000-4000-8000-000000000201', '52000000-0000-4000-8000-000000000002', 'M08 합성 프로젝트 B', '51000000-0000-4000-8000-000000000006');

insert into public.project_memberships (tenant_id, project_id, user_id, role)
values
	('52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101', '51000000-0000-4000-8000-000000000001', 'EDITOR'),
	('52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101', '51000000-0000-4000-8000-000000000002', 'VIEWER'),
	('52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101', '51000000-0000-4000-8000-000000000003', 'REVIEWER'),
	('52000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000201', '51000000-0000-4000-8000-000000000005', 'EDITOR');

insert into public.documents (
	id, tenant_id, project_id, privacy_classification, original_filename,
	media_type, byte_size, storage_path, sha256, created_by
)
values
	(
		'53000000-0000-4000-8000-000000000101',
		'52000000-0000-4000-8000-000000000001',
		'52000000-0000-4000-8000-000000000101',
		'INTERNAL', 'm08-a.synthetic.txt', 'text/plain', 64,
		'52000000-0000-4000-8000-000000000101/53000000-0000-4000-8000-000000000101/original',
		repeat('a', 64), '51000000-0000-4000-8000-000000000001'
	),
	(
		'53000000-0000-4000-8000-000000000201',
		'52000000-0000-4000-8000-000000000002',
		'52000000-0000-4000-8000-000000000201',
		'PUBLIC', 'm08-b.synthetic.txt', 'text/plain', 64,
		'52000000-0000-4000-8000-000000000201/53000000-0000-4000-8000-000000000201/original',
		repeat('b', 64), '51000000-0000-4000-8000-000000000005'
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
	),
	(
		'54000000-0000-4000-8000-000000000201',
		'52000000-0000-4000-8000-000000000002',
		'52000000-0000-4000-8000-000000000201',
		'53000000-0000-4000-8000-000000000201', repeat('b', 64),
		'plain-text', '1.0.0', 'nfc-lines-v1', 'txt', '[]', 1, repeat('2', 64),
		'51000000-0000-4000-8000-000000000005'
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
		'M08 합성 원문 A', 'M08 합성 정규화 A', private.source_text_sha256('M08 합성 원문 A')
	),
	(
		'55000000-0000-4000-8000-000000000201',
		'52000000-0000-4000-8000-000000000002',
		'52000000-0000-4000-8000-000000000201',
		'53000000-0000-4000-8000-000000000201',
		'54000000-0000-4000-8000-000000000201', 1,
		'{"kind":"TEXT_LINES","lineStart":1,"lineEnd":1}',
		'M08 합성 원문 B', 'M08 합성 정규화 B', private.source_text_sha256('M08 합성 원문 B')
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
	),
	(
		'56000000-0000-4000-8000-000000000201',
		'52000000-0000-4000-8000-000000000002',
		'52000000-0000-4000-8000-000000000201',
		'53000000-0000-4000-8000-000000000201',
		'54000000-0000-4000-8000-000000000201', 'PUBLIC',
		'OPENAI', 'synthetic-model', 'document-privacy-v1', 'requirement-extraction-v1',
		'requirement-candidates-v1', repeat('2', 64), repeat('6', 64), repeat('7', 64),
		repeat('8', 64), '51000000-0000-4000-8000-000000000005'
	);

insert into public.requirement_candidates (
	id, tenant_id, project_id, document_id, document_parse_id, run_id, candidate_order,
	official_id, source_text, interpretation, requirement_type, atomicity, content_sha256
)
values
	(
		'57000000-0000-4000-8000-000000000101',
		'52000000-0000-4000-8000-000000000001',
		'52000000-0000-4000-8000-000000000101',
		'53000000-0000-4000-8000-000000000101',
		'54000000-0000-4000-8000-000000000101',
		'56000000-0000-4000-8000-000000000101', 1, 'REQ-A-001',
		'M08 합성 원문 A', 'M08 합성 해석 A', 'FUNCTIONAL', 'ATOMIC', repeat('9', 64)
	),
	(
		'57000000-0000-4000-8000-000000000201',
		'52000000-0000-4000-8000-000000000002',
		'52000000-0000-4000-8000-000000000201',
		'53000000-0000-4000-8000-000000000201',
		'54000000-0000-4000-8000-000000000201',
		'56000000-0000-4000-8000-000000000201', 1, null,
		'M08 합성 원문 B', 'M08 합성 해석 B', 'OTHER', 'REVIEW_REQUIRED', repeat('0', 64)
	);

insert into public.requirement_candidate_source_spans (
	tenant_id, project_id, document_id, document_parse_id, run_id,
	candidate_id, source_span_id, source_order
)
values
	(
		'52000000-0000-4000-8000-000000000001',
		'52000000-0000-4000-8000-000000000101',
		'53000000-0000-4000-8000-000000000101',
		'54000000-0000-4000-8000-000000000101',
		'56000000-0000-4000-8000-000000000101',
		'57000000-0000-4000-8000-000000000101',
		'55000000-0000-4000-8000-000000000101', 1
	),
	(
		'52000000-0000-4000-8000-000000000002',
		'52000000-0000-4000-8000-000000000201',
		'53000000-0000-4000-8000-000000000201',
		'54000000-0000-4000-8000-000000000201',
		'56000000-0000-4000-8000-000000000201',
		'57000000-0000-4000-8000-000000000201',
		'55000000-0000-4000-8000-000000000201', 1
	);

select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select is((select count(*)::integer from public.requirement_extraction_runs), 1, 'editor reads only its project extraction run');
select is((select count(*)::integer from public.requirement_candidates), 1, 'editor reads only its project candidate');
select is((select count(*)::integer from public.requirement_candidate_source_spans), 1, 'editor reads only its project evidence link');
select is((select count(*)::integer from public.requirement_extraction_runs where project_id = '52000000-0000-4000-8000-000000000201'), 0, 'editor reads zero runs from another project');
select is((select source_text || '|' || interpretation from public.requirement_candidates), 'M08 합성 원문 A|M08 합성 해석 A', 'server-derived source text remains separate from AI interpretation');

reset role;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select is((select count(*)::integer from public.requirement_extraction_runs), 1, 'viewer can read immutable project extraction results');

reset role;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select is((select count(*)::integer from public.requirement_candidates), 1, 'reviewer can read immutable project candidates');

reset role;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000004', true);
set local role authenticated;
select is((select count(*)::integer from public.requirement_candidate_source_spans), 1, 'tenant admin reads evidence only inside its tenant');

reset role;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000005', true);
set local role authenticated;
select is((select count(*)::integer from public.requirement_extraction_runs), 1, 'other-project editor reads only its assigned project run');
select is((select count(*)::integer from public.requirement_candidates where project_id = '52000000-0000-4000-8000-000000000101'), 0, 'other-project editor reads zero candidates from Project A');

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select throws_ok('select id from public.requirement_extraction_runs', '42501', 'permission denied for table requirement_extraction_runs', 'anonymous callers cannot read extraction runs');
select throws_ok('select id from public.requirement_candidates', '42501', 'permission denied for table requirement_candidates', 'anonymous callers cannot read candidates');
select throws_ok('select candidate_id from public.requirement_candidate_source_spans', '42501', 'permission denied for table requirement_candidate_source_spans', 'anonymous callers cannot read evidence links');

reset role;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select throws_ok(
	$$insert into public.requirement_extraction_runs (
		tenant_id, project_id, document_id, document_parse_id, privacy_classification,
		provider, model, policy_version, prompt_version, schema_version, parse_result_sha256,
		canonical_input_sha256, fingerprint_sha256, accepted_output_sha256, created_by
	) values (
		'52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101',
		'53000000-0000-4000-8000-000000000101', '54000000-0000-4000-8000-000000000101',
		'INTERNAL', 'OPENAI', 'forged', 'v1', 'v1', 'v1', repeat('1', 64), repeat('2', 64),
		repeat('3', 64), repeat('4', 64), '51000000-0000-4000-8000-000000000001'
	)$$,
	'42501', 'permission denied for table requirement_extraction_runs',
	'authenticated callers cannot insert extraction runs directly'
);
select throws_ok('update public.requirement_extraction_runs set model = ''forged''', '42501', 'permission denied for table requirement_extraction_runs', 'authenticated callers cannot update extraction runs');
select throws_ok('delete from public.requirement_extraction_runs', '42501', 'permission denied for table requirement_extraction_runs', 'authenticated callers cannot delete extraction runs');
select throws_ok(
	$$insert into public.requirement_candidates (
		tenant_id, project_id, document_id, document_parse_id, run_id, candidate_order,
		source_text, interpretation, requirement_type, atomicity, content_sha256
	) values (
		'52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101',
		'53000000-0000-4000-8000-000000000101', '54000000-0000-4000-8000-000000000101',
		'56000000-0000-4000-8000-000000000101', 2, 'forged', 'forged', 'OTHER', 'ATOMIC', repeat('1', 64)
	)$$,
	'42501', 'permission denied for table requirement_candidates',
	'authenticated callers cannot insert candidates directly'
);
select throws_ok('update public.requirement_candidates set interpretation = ''forged''', '42501', 'permission denied for table requirement_candidates', 'authenticated callers cannot update candidates');
select throws_ok('delete from public.requirement_candidates', '42501', 'permission denied for table requirement_candidates', 'authenticated callers cannot delete candidates');
select throws_ok(
	$$insert into public.requirement_candidate_source_spans (
		tenant_id, project_id, document_id, document_parse_id, run_id,
		candidate_id, source_span_id, source_order
	) values (
		'52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101',
		'53000000-0000-4000-8000-000000000101', '54000000-0000-4000-8000-000000000101',
		'56000000-0000-4000-8000-000000000101', '57000000-0000-4000-8000-000000000101',
		'55000000-0000-4000-8000-000000000101', 2
	)$$,
	'42501', 'permission denied for table requirement_candidate_source_spans',
	'authenticated callers cannot insert candidate evidence directly'
);
select throws_ok('update public.requirement_candidate_source_spans set source_order = 2', '42501', 'permission denied for table requirement_candidate_source_spans', 'authenticated callers cannot update candidate evidence');
select throws_ok('delete from public.requirement_candidate_source_spans', '42501', 'permission denied for table requirement_candidate_source_spans', 'authenticated callers cannot delete candidate evidence');
select throws_ok('update public.documents set original_filename = ''mutated.txt''', '42501', 'permission denied for table documents', 'requirement extraction does not make original documents mutable');
select throws_ok('update public.document_parses set parser_version = ''mutated''', '42501', 'permission denied for table document_parses', 'requirement extraction does not make parse snapshots mutable');
select throws_ok('delete from public.source_spans', '42501', 'permission denied for table source_spans', 'requirement extraction does not make SourceSpan evidence deletable');

reset role;
select is((select count(*)::integer from public.requirement_extraction_runs), 2, 'only two trusted synthetic run snapshots exist globally');
select is((select count(*)::integer from public.requirement_candidates), 2, 'only two trusted synthetic candidates exist globally');

select * from finish();
rollback;
