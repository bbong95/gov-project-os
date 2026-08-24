begin;

select plan(49);

insert into auth.users (id, email)
values
	('41000000-0000-4000-8000-000000000001', 'm07-editor-a@example.test'),
	('41000000-0000-4000-8000-000000000002', 'm07-viewer-a@example.test'),
	('41000000-0000-4000-8000-000000000003', 'm07-reviewer-a@example.test'),
	('41000000-0000-4000-8000-000000000004', 'm07-project-admin-a@example.test'),
	('41000000-0000-4000-8000-000000000005', 'm07-tenant-admin-a@example.test'),
	('41000000-0000-4000-8000-000000000006', 'm07-editor-b@example.test'),
	('41000000-0000-4000-8000-000000000007', 'm07-tenant-admin-b@example.test');

insert into public.tenants (id, name, created_by)
values
	('42000000-0000-4000-8000-000000000001', 'M07 합성 기관 A', '41000000-0000-4000-8000-000000000005'),
	('42000000-0000-4000-8000-000000000002', 'M07 합성 기관 B', '41000000-0000-4000-8000-000000000007');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
	('42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000005', 'TENANT_ADMIN'),
	('42000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000007', 'TENANT_ADMIN');

insert into public.projects (id, tenant_id, name, created_by)
values
	(
		'42000000-0000-4000-8000-000000000101',
		'42000000-0000-4000-8000-000000000001',
		'M07 합성 프로젝트 A',
		'41000000-0000-4000-8000-000000000005'
	),
	(
		'42000000-0000-4000-8000-000000000201',
		'42000000-0000-4000-8000-000000000002',
		'M07 합성 프로젝트 B',
		'41000000-0000-4000-8000-000000000007'
	);

insert into public.project_memberships (tenant_id, project_id, user_id, role)
values
	('42000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000101', '41000000-0000-4000-8000-000000000001', 'EDITOR'),
	('42000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000101', '41000000-0000-4000-8000-000000000002', 'VIEWER'),
	('42000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000101', '41000000-0000-4000-8000-000000000003', 'REVIEWER'),
	('42000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000101', '41000000-0000-4000-8000-000000000004', 'PROJECT_ADMIN'),
	('42000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000201', '41000000-0000-4000-8000-000000000006', 'EDITOR');

insert into public.documents (
	id, tenant_id, project_id, privacy_classification, original_filename,
	media_type, byte_size, storage_path, sha256, created_by
)
values
	(
		'43000000-0000-4000-8000-000000000101',
		'42000000-0000-4000-8000-000000000001',
		'42000000-0000-4000-8000-000000000101',
		'INTERNAL', 'm07-a.synthetic.txt', 'text/plain', 32,
		'42000000-0000-4000-8000-000000000101/43000000-0000-4000-8000-000000000101/original',
		repeat('a', 64), '41000000-0000-4000-8000-000000000001'
	),
	(
		'43000000-0000-4000-8000-000000000201',
		'42000000-0000-4000-8000-000000000002',
		'42000000-0000-4000-8000-000000000201',
		'INTERNAL', 'm07-b.synthetic.txt', 'text/plain', 32,
		'42000000-0000-4000-8000-000000000201/43000000-0000-4000-8000-000000000201/original',
		repeat('b', 64), '41000000-0000-4000-8000-000000000006'
	);

select results_eq(
	$$select private.document_parse_result_sha256(
		jsonb_build_array(jsonb_build_object(
			'ordinal', 1,
			'location', jsonb_build_object('kind', 'TEXT_LINES', 'lineStart', 1, 'lineEnd', 1),
			'originalText', 'M07 합성 요구 원문',
			'normalizedText', 'M07 합성 요구 원문'
		))
	)$$,
	array['a06ac700d38e416deecaed314cd12a98025bbcc6b753da01794322b342076935'],
	'database canonical serializer reproduces the TypeScript Korean fixture hash'
);

select results_eq(
	$$select private.document_parse_result_sha256(
		'[{
			"ordinal": 1,
			"location": {"kind": "TEXT_LINES", "lineStart": 1, "lineEnd": 1},
			"originalText": "abc",
			"normalizedText": "abc"
		}]'::jsonb
	)$$,
	array['d9e503694a06c8d651f5974d3b78d3da9d7ee0c6aa78be39852c7d7d65739284'],
	'database canonical serializer reproduces the TypeScript ASCII fixture hash'
);

select is(
	private.document_parse_result_sha256(
		jsonb_build_array(jsonb_build_object(
			'ordinal', 1,
			'location', 'null'::jsonb,
			'originalText', 'M07 합성 요구 원문',
			'normalizedText', 'M07 합성 요구 원문'
		))
	),
	null::text,
	'canonical serializer rejects a null source location'
);

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select throws_ok(
	$$
		select public.persist_document_parse(
			'41000000-0000-4000-8000-000000000001'::uuid,
			'43000000-0000-4000-8000-000000000101'::uuid,
			repeat('a', 64), 'plain-text', '1.0.0', 'nfc-lines-v1', 'txt', '[]'::jsonb,
			'd9e503694a06c8d651f5974d3b78d3da9d7ee0c6aa78be39852c7d7d65739284',
			jsonb_build_array(jsonb_build_object(
				'ordinal', 1,
				'location', jsonb_build_object('kind', 'TEXT_LINES', 'lineStart', 1, 'lineEnd', 1),
				'originalText', 'abc',
				'normalizedText', 'abc'
			))
		)
	$$,
	'42501', 'permission denied for function persist_document_parse',
	'authenticated editor cannot call the trusted persistence RPC directly'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;

select lives_ok(
	$$
		select public.persist_document_parse(
			'41000000-0000-4000-8000-000000000001'::uuid,
			'43000000-0000-4000-8000-000000000101'::uuid,
			repeat('a', 64), 'plain-text', '1.0.0', 'nfc-lines-v1', 'txt', '[]'::jsonb,
			'a06ac700d38e416deecaed314cd12a98025bbcc6b753da01794322b342076935',
			jsonb_build_array(jsonb_build_object(
				'ordinal', 1,
				'location', jsonb_build_object('kind', 'TEXT_LINES', 'lineStart', 1, 'lineEnd', 1),
				'originalText', 'M07 합성 요구 원문',
				'normalizedText', 'M07 합성 요구 원문'
			))
		)
	$$,
	'assigned editor can persist one validated parse snapshot'
);

reset role;
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select is((select count(*)::integer from public.document_parses), 1, 'editor reads the assigned parse snapshot');
select is((select count(*)::integer from public.source_spans), 1, 'editor reads its ordered source evidence');
select is(
	(select original_text_sha256 from public.source_spans limit 1),
	'4840fdebc6552efa7c7fa207d71016a696ab3fc0337578e747cf1d84e1272c3f',
	'database recomputes the exact UTF-8 original-text hash'
);
select is(
	(select original_text || '|' || normalized_text from public.source_spans limit 1),
	'M07 합성 요구 원문|M07 합성 요구 원문',
	'original source and normalized interpretation remain separate'
);
select is(
	(select created_by from public.document_parses limit 1),
	'41000000-0000-4000-8000-000000000001'::uuid,
	'trusted persistence attributes the snapshot to the initiating editor'
);

reset role;
set local role service_role;

select lives_ok(
	$$
		select public.persist_document_parse(
			'41000000-0000-4000-8000-000000000001'::uuid,
			'43000000-0000-4000-8000-000000000101'::uuid,
			repeat('a', 64), 'plain-text', '1.0.0', 'nfc-lines-v1', 'txt', '[]'::jsonb,
			'a06ac700d38e416deecaed314cd12a98025bbcc6b753da01794322b342076935',
			jsonb_build_array(jsonb_build_object(
				'ordinal', 1,
				'location', jsonb_build_object('kind', 'TEXT_LINES', 'lineStart', 1, 'lineEnd', 1),
				'originalText', 'M07 합성 요구 원문',
				'normalizedText', 'M07 합성 요구 원문'
			))
		)
	$$,
	'identical editor retry is idempotent'
);
select is((select count(*)::integer from public.document_parses), 1, 'idempotent retry creates no duplicate snapshot');

reset role;
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select throws_ok(
	$$insert into public.document_parses (
		id, tenant_id, project_id, document_id, source_sha256, parser_key, parser_version,
		normalization_version, detected_format, span_count, result_sha256, created_by
	) values (
		gen_random_uuid(), '42000000-0000-4000-8000-000000000001',
		'42000000-0000-4000-8000-000000000101', '43000000-0000-4000-8000-000000000101',
		repeat('a', 64), 'plain-text', 'direct', 'nfc-lines-v1', 'txt', 1,
		repeat('0', 64), '41000000-0000-4000-8000-000000000001'
	)$$,
	'42501', 'permission denied for table document_parses',
	'authenticated callers cannot bypass the guarded RPC with direct insert'
);
select throws_ok(
	$$update public.document_parses set parser_version = 'mutated'$$,
	'42501', 'permission denied for table document_parses',
	'authenticated callers cannot mutate an immutable parse snapshot'
);
select throws_ok(
	$$delete from public.source_spans$$,
	'42501', 'permission denied for table source_spans',
	'authenticated callers cannot delete immutable source evidence'
);

reset role;
set local role service_role;

select throws_ok(
	$$select public.persist_document_parse(
		'41000000-0000-4000-8000-000000000001'::uuid,
		'43000000-0000-4000-8000-000000000101', repeat('9', 64),
		'plain-text', 'mismatch', 'nfc-lines-v1', 'txt', '[]', repeat('0', 64),
		jsonb_build_array(jsonb_build_object(
			'ordinal', 1, 'location', jsonb_build_object('kind', 'TEXT_LINES', 'lineStart', 1, 'lineEnd', 1),
			'originalText', 'M07 합성 요구 원문', 'normalizedText', 'M07 합성 요구 원문'
		))
	)$$,
	'42501', 'DOCUMENT_PARSE_UNAVAILABLE',
	'source SHA mismatch is denied without leaking document details'
);
select throws_ok(
	$$select public.persist_document_parse(
		'41000000-0000-4000-8000-000000000001'::uuid,
		'43000000-0000-4000-8000-000000000201', repeat('b', 64),
		'plain-text', 'cross', 'nfc-lines-v1', 'txt', '[]', repeat('0', 64),
		jsonb_build_array(jsonb_build_object(
			'ordinal', 1, 'location', jsonb_build_object('kind', 'TEXT_LINES', 'lineStart', 1, 'lineEnd', 1),
			'originalText', 'M07 합성 요구 원문', 'normalizedText', 'M07 합성 요구 원문'
		))
	)$$,
	'42501', 'DOCUMENT_PARSE_UNAVAILABLE',
	'editor cannot persist a parse for another project'
);
select throws_ok(
	$$select public.persist_document_parse(
		'41000000-0000-4000-8000-000000000001'::uuid,
		'43000000-0000-4000-8000-000000000101', repeat('a', 64),
		'plain-text', 'empty', 'nfc-lines-v1', 'txt', '[]', repeat('0', 64), '[]'
	)$$,
	'22023', 'PARSE_PAYLOAD_INVALID',
	'empty source spans are rejected'
);
select throws_ok(
	$$select public.persist_document_parse(
		'41000000-0000-4000-8000-000000000001'::uuid,
		'43000000-0000-4000-8000-000000000101', repeat('a', 64),
		'plain-text', 'gap', 'nfc-lines-v1', 'txt', '[]', repeat('0', 64),
		jsonb_build_array(jsonb_build_object(
			'ordinal', 2, 'location', jsonb_build_object('kind', 'TEXT_LINES', 'lineStart', 1, 'lineEnd', 1),
			'originalText', 'M07 합성 요구 원문', 'normalizedText', 'M07 합성 요구 원문'
		))
	)$$,
	'22023', 'PARSE_PAYLOAD_INVALID',
	'source span ordinals must be sequential and one-based'
);
select throws_ok(
	$$select public.persist_document_parse(
		'41000000-0000-4000-8000-000000000001'::uuid,
		'43000000-0000-4000-8000-000000000101', repeat('a', 64),
		'plain-text', 'blank', 'nfc-lines-v1', 'txt', '[]', repeat('0', 64),
		jsonb_build_array(jsonb_build_object(
			'ordinal', 1, 'location', jsonb_build_object('kind', 'TEXT_LINES', 'lineStart', 1, 'lineEnd', 1),
			'originalText', '   ', 'normalizedText', 'M07 합성 요구 원문'
		))
	)$$,
	'22023', 'PARSE_PAYLOAD_INVALID',
	'blank source evidence is rejected'
);
select throws_ok(
	$$select public.persist_document_parse(
		'41000000-0000-4000-8000-000000000001'::uuid,
		'43000000-0000-4000-8000-000000000101', repeat('a', 64),
		'plain-text', 'oversized', 'nfc-lines-v1', 'txt', '[]', repeat('0', 64),
		jsonb_build_array(jsonb_build_object(
			'ordinal', 1, 'location', jsonb_build_object('kind', 'TEXT_LINES', 'lineStart', 1, 'lineEnd', 1),
			'originalText', repeat('x', 262145), 'normalizedText', 'M07 합성 요구 원문'
		))
	)$$,
	'22023', 'PARSE_PAYLOAD_LIMIT_EXCEEDED',
	'per-span source evidence limit is enforced before persistence'
);
select throws_ok(
	$$select public.persist_document_parse(
		'41000000-0000-4000-8000-000000000001'::uuid,
		'43000000-0000-4000-8000-000000000101', repeat('a', 64),
		'plain-text', 'null-format', 'nfc-lines-v1', null, '[]',
		'a06ac700d38e416deecaed314cd12a98025bbcc6b753da01794322b342076935',
		jsonb_build_array(jsonb_build_object(
			'ordinal', 1, 'location', jsonb_build_object('kind', 'TEXT_LINES', 'lineStart', 1, 'lineEnd', 1),
			'originalText', 'M07 합성 요구 원문', 'normalizedText', 'M07 합성 요구 원문'
		))
	)$$,
	'22023', 'PARSE_PAYLOAD_INVALID',
	'null detected format is rejected with a fixed validation error'
);
select throws_ok(
	$$select public.persist_document_parse(
		'41000000-0000-4000-8000-000000000001'::uuid,
		'43000000-0000-4000-8000-000000000101', repeat('a', 64),
		'plain-text', 'null-warning-location', 'nfc-lines-v1', 'txt',
		'[{"code":"SYNTHETIC_WARNING","location":null}]',
		'a06ac700d38e416deecaed314cd12a98025bbcc6b753da01794322b342076935',
		jsonb_build_array(jsonb_build_object(
			'ordinal', 1, 'location', jsonb_build_object('kind', 'TEXT_LINES', 'lineStart', 1, 'lineEnd', 1),
			'originalText', 'M07 합성 요구 원문', 'normalizedText', 'M07 합성 요구 원문'
		))
	)$$,
	'22023', 'PARSE_PAYLOAD_INVALID',
	'warning location must be a valid discriminated source location'
);
select throws_ok(
	$$select public.persist_document_parse(
		'41000000-0000-4000-8000-000000000001'::uuid,
		'43000000-0000-4000-8000-000000000101', repeat('a', 64),
		'plain-text', 'too-many', 'nfc-lines-v1', 'txt', '[]', repeat('0', 64),
		(
			select jsonb_agg(jsonb_build_object(
				'ordinal', position,
				'location', jsonb_build_object('kind', 'TEXT_LINES', 'lineStart', position, 'lineEnd', position),
				'originalText', 'x',
				'normalizedText', 'x'
			) order by position)
			from generate_series(1, 20001) as position
		)
	)$$,
	'22023', 'PARSE_PAYLOAD_LIMIT_EXCEEDED',
	'more than 20000 spans are rejected as a fixed payload limit'
);
select throws_ok(
	$$select public.persist_document_parse(
		'41000000-0000-4000-8000-000000000001'::uuid,
		'43000000-0000-4000-8000-000000000101', repeat('a', 64),
		'plain-text', 'total-limit', 'nfc-lines-v1', 'txt', '[]', repeat('0', 64),
		(
			select jsonb_agg(jsonb_build_object(
				'ordinal', position,
				'location', jsonb_build_object('kind', 'TEXT_LINES', 'lineStart', position, 'lineEnd', position),
				'originalText', repeat('x', 262144),
				'normalizedText', repeat('x', 262144)
			) order by position)
			from generate_series(1, 65) as position
		)
	)$$,
	'22023', 'PARSE_PAYLOAD_LIMIT_EXCEEDED',
	'aggregate original and normalized text are each capped at 16 MiB'
);
select throws_ok(
	$$select public.persist_document_parse(
		'41000000-0000-4000-8000-000000000001'::uuid,
		'43000000-0000-4000-8000-000000000101', repeat('a', 64),
		'plain-text', 'bad-hash', 'nfc-lines-v1', 'txt', '[]', repeat('0', 64),
		jsonb_build_array(jsonb_build_object(
			'ordinal', 1, 'location', jsonb_build_object('kind', 'TEXT_LINES', 'lineStart', 1, 'lineEnd', 1),
			'originalText', 'M07 합성 요구 원문', 'normalizedText', 'M07 합성 요구 원문'
		))
	)$$,
	'22023', 'PARSE_RESULT_HASH_MISMATCH',
	'caller-supplied result hash must match the database canonical result'
);
select throws_ok(
	$$select public.persist_document_parse(
		'41000000-0000-4000-8000-000000000001'::uuid,
		'43000000-0000-4000-8000-000000000101', repeat('a', 64),
		'plain-text', '1.0.0', 'nfc-lines-v1', 'docx', '[]',
		'a06ac700d38e416deecaed314cd12a98025bbcc6b753da01794322b342076935',
		jsonb_build_array(jsonb_build_object(
			'ordinal', 1, 'location', jsonb_build_object('kind', 'TEXT_LINES', 'lineStart', 1, 'lineEnd', 1),
			'originalText', 'M07 합성 요구 원문', 'normalizedText', 'M07 합성 요구 원문'
		))
	)$$,
	'23505', 'PARSE_IDEMPOTENCY_CONFLICT',
	'same immutable identity cannot return a materially different snapshot'
);
select throws_ok(
	$$select public.persist_document_parse(
		'41000000-0000-4000-8000-000000000001'::uuid,
		'43000000-0000-4000-8000-000000000101', repeat('a', 64),
		'plain-text', 'warnings', 'nfc-lines-v1', 'txt', '[{"message":"raw provider detail"}]',
		'a06ac700d38e416deecaed314cd12a98025bbcc6b753da01794322b342076935',
		jsonb_build_array(jsonb_build_object(
			'ordinal', 1, 'location', jsonb_build_object('kind', 'TEXT_LINES', 'lineStart', 1, 'lineEnd', 1),
			'originalText', 'M07 합성 요구 원문', 'normalizedText', 'M07 합성 요구 원문'
		))
	)$$,
	'22023', 'PARSE_PAYLOAD_INVALID',
	'warning objects accept only a structured nonblank code and optional location'
);

reset role;
select is(
	(select count(*)::integer from public.audit_events where event_type = 'DOCUMENT_PARSED'),
	1,
	'exactly one parse audit event exists after an idempotent retry'
);
select is(
	(select actor_user_id from public.audit_events where event_type = 'DOCUMENT_PARSED' limit 1),
	'41000000-0000-4000-8000-000000000001'::uuid,
	'trusted persistence attributes the audit event to the initiating editor'
);
select ok(
	not exists (
		select 1 from public.audit_events
		where event_type = 'DOCUMENT_PARSED'
			and event_data::text like '%M07 합성 요구 원문%'
	),
	'parse audit metadata never copies original source text'
);

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select is((select count(*)::integer from public.document_parses), 1, 'assigned viewer can read parse snapshots');
select is((select count(*)::integer from public.source_spans), 1, 'assigned viewer can read source evidence');
reset role;
set local role service_role;
select throws_ok(
	$$select public.persist_document_parse(
		'41000000-0000-4000-8000-000000000002'::uuid,
		'43000000-0000-4000-8000-000000000101', repeat('a', 64),
		'plain-text', 'viewer', 'nfc-lines-v1', 'txt', '[]', repeat('0', 64),
		jsonb_build_array(jsonb_build_object(
			'ordinal', 1, 'location', jsonb_build_object('kind', 'TEXT_LINES', 'lineStart', 1, 'lineEnd', 1),
			'originalText', 'M07 합성 요구 원문', 'normalizedText', 'M07 합성 요구 원문'
		))
	)$$,
	'42501', 'DOCUMENT_PARSE_UNAVAILABLE',
	'viewer cannot create a parse snapshot'
);

reset role;
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000003', true);
set local role service_role;
select throws_ok(
	$$select public.persist_document_parse(
		'41000000-0000-4000-8000-000000000003'::uuid,
		'43000000-0000-4000-8000-000000000101', repeat('a', 64),
		'plain-text', 'reviewer', 'nfc-lines-v1', 'txt', '[]', repeat('0', 64),
		jsonb_build_array(jsonb_build_object(
			'ordinal', 1, 'location', jsonb_build_object('kind', 'TEXT_LINES', 'lineStart', 1, 'lineEnd', 1),
			'originalText', 'M07 합성 요구 원문', 'normalizedText', 'M07 합성 요구 원문'
		))
	)$$,
	'42501', 'DOCUMENT_PARSE_UNAVAILABLE',
	'reviewer cannot create a parse snapshot'
);

reset role;
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000004', true);
set local role service_role;
select lives_ok(
	$$select public.persist_document_parse(
		'41000000-0000-4000-8000-000000000004'::uuid,
		'43000000-0000-4000-8000-000000000101', repeat('a', 64),
		'plain-text', '1.0.1', 'nfc-lines-v1', 'txt', '[]',
		'a06ac700d38e416deecaed314cd12a98025bbcc6b753da01794322b342076935',
		jsonb_build_array(jsonb_build_object(
			'ordinal', 1, 'location', jsonb_build_object('kind', 'TEXT_LINES', 'lineStart', 1, 'lineEnd', 1),
			'originalText', 'M07 합성 요구 원문', 'normalizedText', 'M07 합성 요구 원문'
		))
	)$$,
	'project admin can create a new parser-version snapshot'
);

reset role;
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000005', true);
set local role service_role;
select lives_ok(
	$$select public.persist_document_parse(
		'41000000-0000-4000-8000-000000000005'::uuid,
		'43000000-0000-4000-8000-000000000101', repeat('a', 64),
		'plain-text', '1.0.2', 'nfc-lines-v1', 'txt', '[]',
		'a06ac700d38e416deecaed314cd12a98025bbcc6b753da01794322b342076935',
		jsonb_build_array(jsonb_build_object(
			'ordinal', 1, 'location', jsonb_build_object('kind', 'TEXT_LINES', 'lineStart', 1, 'lineEnd', 1),
			'originalText', 'M07 합성 요구 원문', 'normalizedText', 'M07 합성 요구 원문'
		))
	)$$,
	'tenant admin can create a parse snapshot inside its tenant'
);
reset role;
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000005', true);
set local role authenticated;
select is((select count(*)::integer from public.document_parses), 3, 'new parser versions create separate immutable snapshots');

reset role;
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000006', true);
set local role service_role;
select lives_ok(
	$$select public.persist_document_parse(
		'41000000-0000-4000-8000-000000000006'::uuid,
		'43000000-0000-4000-8000-000000000201', repeat('b', 64),
		'plain-text', '1.0.0', 'nfc-lines-v1', 'txt', '[]',
		'a06ac700d38e416deecaed314cd12a98025bbcc6b753da01794322b342076935',
		jsonb_build_array(jsonb_build_object(
			'ordinal', 1, 'location', jsonb_build_object('kind', 'TEXT_LINES', 'lineStart', 1, 'lineEnd', 1),
			'originalText', 'M07 합성 요구 원문', 'normalizedText', 'M07 합성 요구 원문'
		))
	)$$,
	'other-project editor can create only its assigned project snapshot'
);
reset role;
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000006', true);
set local role authenticated;
select is((select count(*)::integer from public.document_parses), 1, 'other-project editor reads only its project snapshot');

reset role;
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select is((select count(*)::integer from public.document_parses), 3, 'editor reads all versions in the assigned project only');
select is(
	(select count(*)::integer from public.document_parses where project_id = '42000000-0000-4000-8000-000000000201'),
	0,
	'editor reads zero snapshots from another project'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select throws_ok(
	'select id from public.document_parses',
	'42501', 'permission denied for table document_parses',
	'anonymous callers cannot read parse snapshots'
);
select throws_ok(
	'select id from public.source_spans',
	'42501', 'permission denied for table source_spans',
	'anonymous callers cannot read source evidence'
);
select throws_ok(
	$$select public.persist_document_parse(
		'41000000-0000-4000-8000-000000000001'::uuid,
		'43000000-0000-4000-8000-000000000101', repeat('a', 64),
		'plain-text', 'anon', 'nfc-lines-v1', 'txt', '[]', repeat('0', 64), '[]'
	)$$,
	'42501', 'permission denied for function persist_document_parse',
	'anonymous callers cannot execute the guarded persistence RPC'
);

reset role;
select is((select count(*)::integer from public.document_parses), 4, 'only four authorized immutable snapshots exist globally');
select is((select count(*)::integer from public.source_spans), 4, 'each authorized snapshot owns exactly one source span');
select is(
	(select count(*)::integer from public.audit_events where event_type = 'DOCUMENT_PARSED'),
	4,
	'exactly one audit event exists per newly created snapshot'
);
select ok(
	not exists (
		select 1
		from public.source_spans
		where original_text_sha256 <> private.source_text_sha256(original_text)
	),
	'all persisted original-text hashes are database-derived'
);

select * from finish();
rollback;
