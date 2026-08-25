begin;

select plan(69);

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


insert into public.documents (
	id, tenant_id, project_id, privacy_classification, original_filename,
	media_type, byte_size, storage_path, sha256, created_by
)
values (
	'53000000-0000-4000-8000-000000000102',
	'52000000-0000-4000-8000-000000000001',
	'52000000-0000-4000-8000-000000000101',
	'PERSONAL', 'm08-personal.synthetic.txt', 'text/plain', 64,
	'52000000-0000-4000-8000-000000000101/53000000-0000-4000-8000-000000000102/original',
	repeat('e', 64), '51000000-0000-4000-8000-000000000001'
);

insert into public.document_parses (
	id, tenant_id, project_id, document_id, source_sha256, parser_key, parser_version,
	normalization_version, detected_format, warnings, span_count, result_sha256, created_by
)
values (
	'54000000-0000-4000-8000-000000000102',
	'52000000-0000-4000-8000-000000000001',
	'52000000-0000-4000-8000-000000000101',
	'53000000-0000-4000-8000-000000000102', repeat('e', 64),
	'plain-text', '1.0.0', 'nfc-lines-v1', 'txt', '[]', 1, repeat('3', 64),
	'51000000-0000-4000-8000-000000000001'
);

insert into public.source_spans (
	id, tenant_id, project_id, document_id, document_parse_id, ordinal, location,
	original_text, normalized_text, original_text_sha256
)
values (
	'55000000-0000-4000-8000-000000000102',
	'52000000-0000-4000-8000-000000000001',
	'52000000-0000-4000-8000-000000000101',
	'53000000-0000-4000-8000-000000000102',
	'54000000-0000-4000-8000-000000000102', 1,
	'{"kind":"TEXT_LINES","lineStart":1,"lineEnd":1}',
	'M08 PERSONAL SYNTHETIC SOURCE',
	'M08 PERSONAL SYNTHETIC SOURCE',
	private.source_text_sha256('M08 PERSONAL SYNTHETIC SOURCE')
);

select set_config(
	'test.m08.valid_candidates',
	jsonb_build_array(jsonb_build_object(
		'candidateOrder', 1,
		'officialId', 'M08',
		'interpretation', 'Synthetic interpretation A',
		'type', 'FUNCTIONAL',
		'atomicity', 'ATOMIC',
		'provenanceState', 'AI_DRAFT',
		'contentSha256', repeat('c', 64),
		'sources', jsonb_build_array(jsonb_build_object(
			'sourceSpanId', '55000000-0000-4000-8000-000000000101',
			'sourceSpanOrdinal', 1,
			'sourceOrder', 1
		))
	))::text,
	true
);
select set_config('test.m08.persist_result', '{}'::jsonb::text, true);
select set_config('test.m08.reuse_result', '{}'::jsonb::text, true);

set local check_function_bodies = off;

create function pg_temp.call_m08_persist(
	target_actor uuid,
	target_parse uuid,
	target_privacy public.privacy_classification,
	target_fingerprint text,
	target_candidates jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $test$
	select public.persist_requirement_extraction(
		target_actor,
		target_parse,
		target_privacy,
		'OPENAI',
		'synthetic-model',
		'document-privacy-v1',
		'requirement-extraction-v1',
		'requirement-candidates-v1',
		repeat('1', 64),
		repeat('a', 64),
		target_fingerprint,
		repeat('f', 64),
		'resp_synthetic',
		10,
		5,
		target_candidates
	);
$test$;

create function pg_temp.call_m08_outcome(
	target_actor uuid,
	target_parse uuid,
	target_decision text,
	target_outcome text,
	target_fingerprint text,
	target_duration integer
)
returns void
language sql
security invoker
set search_path = ''
as $test$
	select public.record_requirement_extraction_outcome(
		target_actor,
		target_parse,
		target_decision,
		target_outcome,
		target_fingerprint,
		'OPENAI',
		'synthetic-model',
		'document-privacy-v1',
		'requirement-extraction-v1',
		'requirement-candidates-v1',
		target_duration
	);
$test$;

set local check_function_bodies = on;

select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select throws_ok(
	$$select pg_temp.call_m08_persist(
		'51000000-0000-4000-8000-000000000001',
		'54000000-0000-4000-8000-000000000101',
		'INTERNAL', repeat('b', 64),
		current_setting('test.m08.valid_candidates')::jsonb
	)$$,
	'42501', 'permission denied for function persist_requirement_extraction',
	'authenticated editors cannot execute trusted requirement persistence directly'
);
select throws_ok(
	$$select pg_temp.call_m08_outcome(
		'51000000-0000-4000-8000-000000000001',
		'54000000-0000-4000-8000-000000000102',
		'REVIEW_REQUIRED', 'POLICY_REVIEW_REQUIRED', null, 12
	)$$,
	'42501', 'permission denied for function record_requirement_extraction_outcome',
	'authenticated editors cannot execute safe outcome recording directly'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;

select lives_ok(
	$$select set_config(
		'test.m08.persist_result',
		pg_temp.call_m08_persist(
			'51000000-0000-4000-8000-000000000001',
			'54000000-0000-4000-8000-000000000101',
			'INTERNAL', repeat('b', 64),
			current_setting('test.m08.valid_candidates')::jsonb
		)::text,
		true
	)$$,
	'assigned editor can persist one atomic requirement snapshot'
);
select is(
	current_setting('test.m08.persist_result')::jsonb ->> 'reused',
	'false',
	'first successful writer receives reused false'
);
select ok(
	(current_setting('test.m08.persist_result')::jsonb ->> 'runId')
		~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
	and exists (
		select 1
		from public.requirement_extraction_runs
		where id::text = current_setting('test.m08.persist_result')::jsonb ->> 'runId'
	),
	'safe persistence result identifies the committed run'
);
select is(
	(
		select provider || '|' || model || '|' || input_tokens || '|' || output_tokens || '|' || created_by
		from public.requirement_extraction_runs
		where id::text = current_setting('test.m08.persist_result')::jsonb ->> 'runId'
	),
	'OPENAI|synthetic-model|10|5|51000000-0000-4000-8000-000000000001',
	'run stores only bounded provider metadata, aggregate usage, and initiating actor'
);
select is(
	(
		select candidate.source_text || '|' || candidate.interpretation
		from public.requirement_candidates as candidate
		where candidate.run_id::text = current_setting('test.m08.persist_result')::jsonb ->> 'runId'
	),
	(
		select span.original_text || '|Synthetic interpretation A'
		from public.source_spans as span
		where span.id = '55000000-0000-4000-8000-000000000101'
	),
	'candidate source text is derived from immutable database evidence and remains separate from AI interpretation'
);
select is(
	(
		select official_id || '|' || requirement_type || '|' || atomicity || '|' || provenance_state
		from public.requirement_candidates
		where run_id::text = current_setting('test.m08.persist_result')::jsonb ->> 'runId'
	),
	'M08|FUNCTIONAL|ATOMIC|AI_DRAFT',
	'candidate preserves evidence-backed official ID, closed vocabularies, and AI_DRAFT provenance'
);
select is(
	(
		select link.source_span_id::text || '|' || link.source_order || '|' || span.ordinal
		from public.requirement_candidate_source_spans as link
		join public.source_spans as span on span.id = link.source_span_id
		where link.run_id::text = current_setting('test.m08.persist_result')::jsonb ->> 'runId'
	),
	'55000000-0000-4000-8000-000000000101|1|1',
	'candidate evidence resolves to the same immutable parse and ordinal'
);
select is(
	(
		select count(*)::integer
		from public.audit_events
		where event_type = 'REQUIREMENT_EXTRACTION_SUCCEEDED'
			and entity_id::text = current_setting('test.m08.persist_result')::jsonb ->> 'runId'
	),
	1,
	'one success audit event commits with the snapshot'
);
select ok(
	exists (
		select 1
		from public.audit_events
		where event_type = 'REQUIREMENT_EXTRACTION_SUCCEEDED'
			and entity_id::text = current_setting('test.m08.persist_result')::jsonb ->> 'runId'
			and event_data ?& array[
				'document_parse_id', 'privacy_classification', 'policy_decision',
				'provider', 'model', 'policy_version', 'prompt_version', 'schema_version',
				'parse_result_sha256', 'canonical_input_sha256', 'fingerprint_sha256',
				'accepted_output_sha256', 'provider_response_id',
				'input_tokens', 'output_tokens', 'candidate_count'
			]
			and event_data - array[
				'document_parse_id', 'privacy_classification', 'policy_decision',
				'provider', 'model', 'policy_version', 'prompt_version', 'schema_version',
				'parse_result_sha256', 'canonical_input_sha256', 'fingerprint_sha256',
				'accepted_output_sha256', 'provider_response_id',
				'input_tokens', 'output_tokens', 'candidate_count'
			] = '{}'::jsonb
			and event_data ->> 'input_tokens' = '10'
			and event_data ->> 'output_tokens' = '5'
			and event_data ->> 'candidate_count' = '1'
	),
	'success audit contains only fixed versions, hashes, aggregate usage, and count'
);
select ok(
	not exists (
		select 1
		from public.audit_events as event
		join public.source_spans as span
			on span.id = '55000000-0000-4000-8000-000000000101'
		where event.event_type = 'REQUIREMENT_EXTRACTION_SUCCEEDED'
			and (
				event.event_data::text like '%' || span.original_text || '%'
				or event.event_data::text like '%Synthetic interpretation A%'
				or event.event_data::text like '%raw provider body%'
			)
	),
	'success audit stores no source, interpretation, prompt, or provider body'
);

select lives_ok(
	$$select set_config(
		'test.m08.reuse_result',
		pg_temp.call_m08_persist(
			'51000000-0000-4000-8000-000000000001',
			'54000000-0000-4000-8000-000000000101',
			'INTERNAL', repeat('b', 64),
			current_setting('test.m08.valid_candidates')::jsonb
		)::text,
		true
	)$$,
	'identical fingerprint retry safely reuses the first committed snapshot'
);
select ok(
	current_setting('test.m08.reuse_result')::jsonb ->> 'reused' = 'true'
	and current_setting('test.m08.reuse_result')::jsonb ->> 'runId'
		= current_setting('test.m08.persist_result')::jsonb ->> 'runId',
	'idempotent retry returns the same run with reused true'
);
select is(
	(
		select
			(select count(*) from public.requirement_extraction_runs)::text || '|'
			|| (select count(*) from public.requirement_candidates)::text || '|'
			|| (select count(*) from public.requirement_candidate_source_spans)::text || '|'
			|| (select count(*) from public.audit_events where event_type = 'REQUIREMENT_EXTRACTION_SUCCEEDED')::text
	),
	'3|3|3|1',
	'idempotent retry creates no duplicate run, candidate, link, or audit'
);

select throws_ok(
	$$select pg_temp.call_m08_persist(
		'51000000-0000-4000-8000-000000009999',
		'54000000-0000-4000-8000-000000000101',
		'INTERNAL', repeat('0', 64),
		current_setting('test.m08.valid_candidates')::jsonb
	)$$,
	'42501', 'REQUIREMENT_EXTRACTION_UNAVAILABLE',
	'unknown initiating actor is denied without resource disclosure'
);
select throws_ok(
	$$select pg_temp.call_m08_persist(
		'51000000-0000-4000-8000-000000000002',
		'54000000-0000-4000-8000-000000000101',
		'INTERNAL', repeat('0', 64),
		current_setting('test.m08.valid_candidates')::jsonb
	)$$,
	'42501', 'REQUIREMENT_EXTRACTION_UNAVAILABLE',
	'viewer cannot persist requirement snapshots'
);
select throws_ok(
	$$select pg_temp.call_m08_persist(
		'51000000-0000-4000-8000-000000000003',
		'54000000-0000-4000-8000-000000000101',
		'INTERNAL', repeat('0', 64),
		current_setting('test.m08.valid_candidates')::jsonb
	)$$,
	'42501', 'REQUIREMENT_EXTRACTION_UNAVAILABLE',
	'reviewer cannot persist requirement snapshots'
);
select throws_ok(
	$$select pg_temp.call_m08_persist(
		'51000000-0000-4000-8000-000000000001',
		'54000000-0000-4000-8000-000000000201',
		'PUBLIC', repeat('0', 64),
		current_setting('test.m08.valid_candidates')::jsonb
	)$$,
	'42501', 'REQUIREMENT_EXTRACTION_UNAVAILABLE',
	'editor cannot persist another project parse'
);

delete from public.project_memberships
where project_id = '52000000-0000-4000-8000-000000000101'
	and user_id = '51000000-0000-4000-8000-000000000001';
select throws_ok(
	$$select pg_temp.call_m08_persist(
		'51000000-0000-4000-8000-000000000001',
		'54000000-0000-4000-8000-000000000101',
		'INTERNAL', repeat('0', 64),
		current_setting('test.m08.valid_candidates')::jsonb
	)$$,
	'42501', 'REQUIREMENT_EXTRACTION_UNAVAILABLE',
	'actor without a current membership row cannot persist'
);
insert into public.project_memberships (tenant_id, project_id, user_id, role)
values (
	'52000000-0000-4000-8000-000000000001',
	'52000000-0000-4000-8000-000000000101',
	'51000000-0000-4000-8000-000000000001',
	'EDITOR'
);

select throws_ok(
	$$select pg_temp.call_m08_persist(
		'51000000-0000-4000-8000-000000000001',
		'54000000-0000-4000-8000-000000000101',
		'PERSONAL', repeat('0', 64),
		current_setting('test.m08.valid_candidates')::jsonb
	)$$,
	'42501', 'REQUIREMENT_EXTRACTION_POLICY_DENIED',
	'caller privacy value cannot disagree with the immutable document'
);
select throws_ok(
	$$select pg_temp.call_m08_persist(
		'51000000-0000-4000-8000-000000000001',
		'54000000-0000-4000-8000-000000000102',
		'PERSONAL', repeat('0', 64),
		current_setting('test.m08.valid_candidates')::jsonb
	)$$,
	'42501', 'REQUIREMENT_EXTRACTION_POLICY_DENIED',
	'PERSONAL source cannot create a successful extraction snapshot'
);
select throws_ok(
	$$select pg_temp.call_m08_persist(
		'51000000-0000-4000-8000-000000000001',
		'54000000-0000-4000-8000-000000000101',
		'INTERNAL', repeat('0', 64),
		jsonb_set(current_setting('test.m08.valid_candidates')::jsonb, '{0,unexpected}', 'true'::jsonb)
	)$$,
	'22023', 'REQUIREMENT_PAYLOAD_INVALID',
	'candidate objects reject extra keys'
);
select throws_ok(
	$$select pg_temp.call_m08_persist(
		'51000000-0000-4000-8000-000000000001',
		'54000000-0000-4000-8000-000000000101',
		'INTERNAL', repeat('0', 64), '[]'::jsonb
	)$$,
	'22023', 'REQUIREMENT_PAYLOAD_INVALID',
	'empty candidate arrays are rejected'
);
select throws_ok(
	$$select pg_temp.call_m08_persist(
		'51000000-0000-4000-8000-000000000001',
		'54000000-0000-4000-8000-000000000101',
		'INTERNAL', repeat('0', 64),
		(
			select jsonb_agg(
				jsonb_set(
					current_setting('test.m08.valid_candidates')::jsonb -> 0,
					'{candidateOrder}', to_jsonb(position)
				)
				order by position
			)
			from generate_series(1, 501) as position
		)
	)$$,
	'22023', 'REQUIREMENT_PAYLOAD_LIMIT_EXCEEDED',
	'more than 500 candidates are rejected before persistence'
);
select throws_ok(
	$$select pg_temp.call_m08_persist(
		'51000000-0000-4000-8000-000000000001',
		'54000000-0000-4000-8000-000000000101',
		'INTERNAL', repeat('0', 64),
		jsonb_set(
			current_setting('test.m08.valid_candidates')::jsonb,
			'{0,candidateOrder}', to_jsonb('1'::text)
		)
	)$$,
	'22023', 'REQUIREMENT_PAYLOAD_INVALID',
	'candidate field types are validated exactly'
);
select throws_ok(
	$$select pg_temp.call_m08_persist(
		'51000000-0000-4000-8000-000000000001',
		'54000000-0000-4000-8000-000000000101',
		'INTERNAL', repeat('0', 64),
		jsonb_set(
			current_setting('test.m08.valid_candidates')::jsonb,
			'{0,officialId}', to_jsonb('REQ-NOT-IN-SOURCE'::text)
		)
	)$$,
	'22023', 'REQUIREMENT_EVIDENCE_INVALID',
	'official identifiers must occur exactly in cited immutable originals'
);
select throws_ok(
	$$select pg_temp.call_m08_persist(
		'51000000-0000-4000-8000-000000000001',
		'54000000-0000-4000-8000-000000000101',
		'INTERNAL', repeat('0', 64),
		jsonb_set(
			current_setting('test.m08.valid_candidates')::jsonb,
			'{0,sources,0,sourceSpanId}',
			to_jsonb('55000000-0000-4000-8000-000000000201'::text)
		)
	)$$,
	'22023', 'REQUIREMENT_EVIDENCE_INVALID',
	'candidate evidence cannot cross parse or project scope'
);
select throws_ok(
	$$select pg_temp.call_m08_persist(
		'51000000-0000-4000-8000-000000000001',
		'54000000-0000-4000-8000-000000000101',
		'INTERNAL', repeat('0', 64),
		jsonb_set(
			current_setting('test.m08.valid_candidates')::jsonb,
			'{0,sources,0,sourceSpanOrdinal}', '2'::jsonb
		)
	)$$,
	'22023', 'REQUIREMENT_EVIDENCE_INVALID',
	'source span identifier and ordinal must resolve to the same row'
);
select throws_ok(
	$$select pg_temp.call_m08_persist(
		'51000000-0000-4000-8000-000000000001',
		'54000000-0000-4000-8000-000000000101',
		'INTERNAL', repeat('0', 64),
		jsonb_set(
			current_setting('test.m08.valid_candidates')::jsonb,
			'{0,sources}',
			jsonb_build_array(
				current_setting('test.m08.valid_candidates')::jsonb #> '{0,sources,0}',
				jsonb_set(
					current_setting('test.m08.valid_candidates')::jsonb #> '{0,sources,0}',
					'{sourceOrder}', '2'::jsonb
				)
			)
		)
	)$$,
	'22023', 'REQUIREMENT_EVIDENCE_INVALID',
	'one candidate cannot cite the same SourceSpan twice'
);
select throws_ok(
	$$select pg_temp.call_m08_persist(
		'51000000-0000-4000-8000-000000000001',
		'54000000-0000-4000-8000-000000000101',
		'INTERNAL', repeat('d', 64),
		current_setting('test.m08.valid_candidates')::jsonb
		|| jsonb_build_array(
			jsonb_set(
				jsonb_set(
					current_setting('test.m08.valid_candidates')::jsonb -> 0,
					'{candidateOrder}', '2'::jsonb
				),
				'{unexpected}', 'true'::jsonb
			)
		)
	)$$,
	'22023', 'REQUIREMENT_PAYLOAD_INVALID',
	'a malformed second candidate rejects the complete transaction'
);
select is(
	(
		select
			(select count(*) from public.requirement_extraction_runs where fingerprint_sha256 = repeat('d', 64))::text || '|'
			|| (select count(*) from public.requirement_candidates)::text || '|'
			|| (select count(*) from public.audit_events where event_type = 'REQUIREMENT_EXTRACTION_SUCCEEDED')::text
	),
	'0|3|1',
	'malformed later candidate rolls back run, candidates, links, and success audit'
);

select lives_ok(
	$$select pg_temp.call_m08_outcome(
		'51000000-0000-4000-8000-000000000001',
		'54000000-0000-4000-8000-000000000102',
		'REVIEW_REQUIRED', 'POLICY_REVIEW_REQUIRED', null, 12
	)$$,
	'authorized PERSONAL policy stop records one safe outcome without a run'
);
select is(
	(
		select count(*)::integer
		from public.audit_events
		where event_type = 'REQUIREMENT_EXTRACTION_OUTCOME'
			and entity_id = '54000000-0000-4000-8000-000000000102'
	),
	1,
	'policy stop creates exactly one outcome audit event'
);
select ok(
	exists (
		select 1
		from public.audit_events
		where event_type = 'REQUIREMENT_EXTRACTION_OUTCOME'
			and entity_id = '54000000-0000-4000-8000-000000000102'
			and event_data ?& array[
				'policy_decision', 'outcome_code', 'fingerprint_sha256',
				'provider', 'model', 'policy_version', 'prompt_version',
				'schema_version', 'duration_ms'
			]
			and event_data - array[
				'policy_decision', 'outcome_code', 'fingerprint_sha256',
				'provider', 'model', 'policy_version', 'prompt_version',
				'schema_version', 'duration_ms'
			] = '{}'::jsonb
			and event_data ->> 'policy_decision' = 'REVIEW_REQUIRED'
			and event_data ->> 'outcome_code' = 'POLICY_REVIEW_REQUIRED'
			and event_data ->> 'fingerprint_sha256' is null
			and event_data ->> 'duration_ms' = '12'
	),
	'outcome audit contains only fixed policy, code, versions, optional hash, and duration'
);
select ok(
	not exists (
		select 1
		from public.audit_events as event
		join public.source_spans as span
			on span.id = '55000000-0000-4000-8000-000000000102'
		where event.event_type = 'REQUIREMENT_EXTRACTION_OUTCOME'
			and (
				event.event_data::text like '%' || span.original_text || '%'
				or event.event_data::text like '%raw provider body%'
				or event.event_data::text like '%system prompt%'
			)
	),
	'outcome audit stores no source, prompt, provider body, or secret'
);
select throws_ok(
	$$select pg_temp.call_m08_outcome(
		'51000000-0000-4000-8000-000000000002',
		'54000000-0000-4000-8000-000000000102',
		'REVIEW_REQUIRED', 'POLICY_REVIEW_REQUIRED', null, 12
	)$$,
	'42501', 'REQUIREMENT_OUTCOME_UNAVAILABLE',
	'viewer cannot record requirement extraction outcomes'
);
select throws_ok(
	$$select pg_temp.call_m08_outcome(
		'51000000-0000-4000-8000-000000000001',
		'54000000-0000-4000-8000-000000000101',
		'BLOCK', 'POLICY_BLOCKED', null, 12
	)$$,
	'22023', 'REQUIREMENT_OUTCOME_INVALID',
	'outcome decision must match the immutable document privacy policy'
);
select throws_ok(
	$$select pg_temp.call_m08_outcome(
		'51000000-0000-4000-8000-000000000001',
		'54000000-0000-4000-8000-000000000102',
		'REVIEW_REQUIRED', 'POLICY_REVIEW_REQUIRED', null, -1
	)$$,
	'22023', 'REQUIREMENT_OUTCOME_INVALID',
	'outcome duration must be nonnegative and bounded'
);


reset role;

insert into auth.users (id, email)
values ('51000000-0000-4000-8000-000000000007', 'm08-project-admin-a@example.test');

insert into public.project_memberships (tenant_id, project_id, user_id, role)
values (
	'52000000-0000-4000-8000-000000000001',
	'52000000-0000-4000-8000-000000000101',
	'51000000-0000-4000-8000-000000000007',
	'PROJECT_ADMIN'
);

set local role service_role;

select lives_ok(
	$$select pg_temp.call_m08_persist(
		'51000000-0000-4000-8000-000000000007',
		'54000000-0000-4000-8000-000000000101',
		'INTERNAL', repeat('6', 64),
		current_setting('test.m08.valid_candidates')::jsonb
	)$$,
	'project admin can persist inside its assigned project'
);
select lives_ok(
	$$select pg_temp.call_m08_persist(
		'51000000-0000-4000-8000-000000000004',
		'54000000-0000-4000-8000-000000000101',
		'INTERNAL', repeat('7', 64),
		current_setting('test.m08.valid_candidates')::jsonb
	)$$,
	'tenant admin can persist inside its tenant'
);
select lives_ok(
	$$select pg_temp.call_m08_outcome(
		'51000000-0000-4000-8000-000000000004',
		'54000000-0000-4000-8000-000000000102',
		'REVIEW_REQUIRED', 'POLICY_REVIEW_REQUIRED', null, 13
	)$$,
	'tenant admin can record a safe policy outcome inside its tenant'
);

select * from finish();
rollback;
