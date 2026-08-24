begin;

select plan(49);

select has_table('public', 'document_parses', 'public.document_parses exists');
select has_table('public', 'source_spans', 'public.source_spans exists');

select ok(
	coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.document_parses')), false),
	'RLS is enabled on public.document_parses'
);
select ok(
	coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.source_spans')), false),
	'RLS is enabled on public.source_spans'
);

select ok(
	exists (
		select 1
		from pg_constraint
		where conname = 'documents_tenant_project_id_sha256_key'
			and conrelid = to_regclass('public.documents')
			and contype = 'u'
			and pg_get_constraintdef(oid) = 'UNIQUE (tenant_id, project_id, id, sha256)'
	),
	'documents expose one immutable composite source identity'
);

select ok(
	exists (
		select 1
		from pg_constraint
		where conname = 'document_parses_pkey'
			and conrelid = to_regclass('public.document_parses')
			and contype = 'p'
	),
	'document_parses have a primary key'
);

select is(
	(
		select count(*)::integer
		from information_schema.columns
		where table_schema = 'public'
			and table_name = 'document_parses'
			and is_nullable = 'NO'
			and column_name in (
				'id', 'tenant_id', 'project_id', 'document_id', 'source_sha256',
				'parser_key', 'parser_version', 'normalization_version', 'detected_format',
				'warnings', 'span_count', 'result_sha256', 'created_by', 'created_at'
			)
	),
	14,
	'document parse snapshots require every identity, version, result, actor, and time field'
);

select is(
	(
		select count(*)::integer
		from pg_constraint
		where conrelid = to_regclass('public.document_parses')
			and conname in (
				'document_parses_source_sha256_check',
				'document_parses_parser_key_not_blank',
				'document_parses_parser_version_not_blank',
				'document_parses_normalization_version_not_blank',
				'document_parses_detected_format_check',
				'document_parses_warnings_array_check',
				'document_parses_span_count_check',
				'document_parses_result_sha256_check'
			)
			and contype = 'c'
	),
	8,
	'document parses enforce versions, format, warning shape, counts, and lowercase hashes'
);

select ok(
	exists (
		select 1
		from pg_constraint
		where conname = 'document_parses_document_source_fkey'
			and conrelid = to_regclass('public.document_parses')
			and contype = 'f'
			and confdeltype = 'r'
			and pg_get_constraintdef(oid) like
				'FOREIGN KEY (tenant_id, project_id, document_id, source_sha256)%'
	),
	'document parses use a restrictive composite source-document foreign key'
);

select ok(
	exists (
		select 1
		from pg_constraint
		where conname = 'document_parses_created_by_fkey'
			and conrelid = to_regclass('public.document_parses')
			and contype = 'f'
			and confdeltype = 'r'
	),
	'document parse actors reference Auth users restrictively'
);

select ok(
	exists (
		select 1
		from pg_constraint
		where conname = 'document_parses_immutable_identity_key'
			and conrelid = to_regclass('public.document_parses')
			and contype = 'u'
			and pg_get_constraintdef(oid) =
				'UNIQUE (document_id, source_sha256, parser_key, parser_version, normalization_version)'
	),
	'parser and normalization versions form the immutable idempotency identity'
);

select ok(
	exists (
		select 1
		from pg_constraint
		where conname = 'document_parses_scope_key'
			and conrelid = to_regclass('public.document_parses')
			and contype = 'u'
			and pg_get_constraintdef(oid) = 'UNIQUE (tenant_id, project_id, document_id, id)'
	),
	'document parse scope can be referenced without losing document identity'
);

select ok(
	exists (
		select 1
		from pg_constraint
		where conname = 'source_spans_pkey'
			and conrelid = to_regclass('public.source_spans')
			and contype = 'p'
	),
	'source_spans have a primary key'
);

select is(
	(
		select count(*)::integer
		from information_schema.columns
		where table_schema = 'public'
			and table_name = 'source_spans'
			and is_nullable = 'NO'
			and column_name in (
				'id', 'tenant_id', 'project_id', 'document_id', 'document_parse_id',
				'ordinal', 'location', 'original_text', 'normalized_text',
				'original_text_sha256', 'created_at'
			)
	),
	11,
	'source spans require scope, order, location, separate text, hash, and time fields'
);

select is(
	(
		select count(*)::integer
		from pg_constraint
		where conrelid = to_regclass('public.source_spans')
			and conname in (
				'source_spans_ordinal_check',
				'source_spans_location_check',
				'source_spans_original_text_not_blank',
				'source_spans_normalized_text_not_blank',
				'source_spans_original_text_size_check',
				'source_spans_normalized_text_size_check',
				'source_spans_original_text_sha256_check',
				'source_spans_original_text_sha256_matches'
			)
			and contype = 'c'
	),
	8,
	'source spans enforce bounded evidence text, location, order, and recomputed hash'
);

select ok(
	exists (
		select 1
		from pg_constraint
		where conname = 'source_spans_document_parse_fkey'
			and conrelid = to_regclass('public.source_spans')
			and contype = 'f'
			and confdeltype = 'r'
			and pg_get_constraintdef(oid) like
				'FOREIGN KEY (tenant_id, project_id, document_id, document_parse_id)%'
	),
	'source spans use one restrictive composite parse and document foreign key'
);

select ok(
	exists (
		select 1
		from pg_constraint
		where conname = 'source_spans_parse_ordinal_key'
			and conrelid = to_regclass('public.source_spans')
			and contype = 'u'
			and pg_get_constraintdef(oid) = 'UNIQUE (document_parse_id, ordinal)'
	),
	'each immutable parse has one source span per ordinal'
);

select ok(
	to_regclass('public.document_parses_project_created_at_idx') is not null,
	'document parse project history is indexed'
);
select ok(
	to_regclass('public.source_spans_project_parse_ordinal_idx') is not null,
	'source span project and ordered parse review is indexed'
);

select is(
	(
		select count(*)::integer
		from information_schema.role_table_grants
		where grantee = 'anon'
			and table_schema = 'public'
			and table_name in ('document_parses', 'source_spans')
	),
	0,
	'anon has no privileges on parse or source evidence tables'
);

select is(
	(
		select string_agg(table_name || ':' || privilege_type, ',' order by table_name, privilege_type)
		from information_schema.role_table_grants
		where grantee = 'authenticated'
			and table_schema = 'public'
			and table_name in ('document_parses', 'source_spans')
	),
	'document_parses:SELECT,source_spans:SELECT',
	'authenticated receives immutable read-only table grants'
);

select is(
	(
		select count(*)::integer
		from information_schema.role_table_grants
		where grantee = 'service_role'
			and table_schema = 'public'
			and table_name in ('document_parses', 'source_spans')
			and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
	),
	8,
	'service_role has explicit trusted cleanup privileges on parse and evidence tables'
);

select ok(
	to_regprocedure('private.is_valid_source_location(jsonb)') is not null,
	'private source location validator exists'
);
select ok(
	to_regprocedure('private.source_text_sha256(text)') is not null,
	'private source text hash helper exists'
);

select ok(
	coalesce(
		(
			select provolatile = 'i'
				and proparallel = 's'
				and not prosecdef
				and proisstrict
				and proconfig @> array['search_path=""']::text[]
			from pg_proc
			where oid = to_regprocedure('private.is_valid_source_location(jsonb)')
		),
		false
	),
	'location validator is immutable, strict, parallel-safe, invoker, and fixes search_path'
);

select ok(
	coalesce(
		(
			select provolatile = 'i'
				and proparallel = 's'
				and not prosecdef
				and proisstrict
				and proconfig @> array['search_path=""']::text[]
			from pg_proc
			where oid = to_regprocedure('private.source_text_sha256(text)')
		),
		false
	),
	'source hash helper is immutable, strict, parallel-safe, invoker, and fixes search_path'
);

select is(
	(
		select count(*)::integer
		from information_schema.routine_privileges
		where specific_schema = 'private'
			and routine_name in ('is_valid_source_location', 'source_text_sha256')
			and grantee in ('PUBLIC', 'anon', 'authenticated')
			and privilege_type = 'EXECUTE'
	),
	0,
	'untrusted roles cannot call private validation and hash helpers directly'
);

select is(
	(
		select count(*)::integer
		from information_schema.columns
		where table_schema = 'public'
			and table_name in ('document_parses', 'source_spans')
			and column_name in ('id', 'created_at')
			and column_default is not null
	),
	4,
	'parse and span identities and timestamps are database generated'
);

select is(
	(
		select string_agg(table_name || ':' || column_name || ':' || udt_name, ',' order by table_name, column_name)
		from information_schema.columns
		where table_schema = 'public'
			and (
				(table_name = 'document_parses' and column_name = 'warnings')
				or (table_name = 'source_spans' and column_name = 'location')
			)
	),
	'document_parses:warnings:jsonb,source_spans:location:jsonb',
	'parse warnings and discriminated locations use structured JSONB'
);

select is(
	(
		select count(*)::integer
		from information_schema.columns
		where table_schema = 'public'
			and table_name = 'source_spans'
			and column_name in ('original_text', 'normalized_text', 'original_text_sha256')
			and udt_name = 'text'
	),
	3,
	'original, normalized, and hashed evidence are separate text columns'
);

select is(
	private.is_valid_source_location('{"kind":"TEXT_LINES","lineStart":1,"lineEnd":2}'::jsonb),
	true,
	'TEXT_LINES accepts one-based ordered line bounds'
);
select is(
	private.is_valid_source_location('{"kind":"TEXT_LINES","lineStart":2,"lineEnd":1}'::jsonb),
	false,
	'TEXT_LINES rejects reversed line bounds'
);
select is(
	private.is_valid_source_location('{"kind":"TEXT_LINES","lineStart":1,"lineEnd":1,"page":1}'::jsonb),
	false,
	'TEXT_LINES rejects extra keys'
);
select is(
	private.is_valid_source_location('{"kind":"TEXT_LINES","lineStart":0,"lineEnd":1}'::jsonb),
	false,
	'TEXT_LINES rejects zero positions'
);

select is(
	private.is_valid_source_location('{"kind":"PAGE","pageNumber":1,"pageMode":"LAYOUT"}'::jsonb),
	true,
	'PAGE accepts a proven layout page without an invented block'
);
select is(
	private.is_valid_source_location('{"kind":"PAGE","pageNumber":3,"blockIndex":2,"pageMode":"SECTION_APPROXIMATE"}'::jsonb),
	true,
	'PAGE accepts an explicitly approximate section page and one-based block'
);
select is(
	private.is_valid_source_location('{"kind":"PAGE","pageNumber":1,"pageMode":"LAYOUT","label":"x"}'::jsonb),
	false,
	'PAGE rejects extra keys'
);
select is(
	private.is_valid_source_location('{"kind":"PAGE","pageNumber":1,"pageMode":"EXACT"}'::jsonb),
	false,
	'PAGE rejects invented precision modes'
);

select is(
	private.is_valid_source_location('{"kind":"SHEET","sheetIndex":1}'::jsonb),
	true,
	'SHEET accepts a one-based sheet without invented names or cells'
);
select is(
	private.is_valid_source_location('{"kind":"SHEET","sheetIndex":2,"sheetName":"합성 시트","cellRange":"A1:BC200"}'::jsonb),
	true,
	'SHEET accepts a nonblank name and canonical cell range'
);
select is(
	private.is_valid_source_location('{"kind":"SHEET","sheetIndex":1,"sheetName":"   "}'::jsonb),
	false,
	'SHEET rejects blank optional names'
);
select is(
	private.is_valid_source_location('{"kind":"SHEET","sheetIndex":1,"cellRange":"A0:B2"}'::jsonb),
	false,
	'SHEET rejects malformed or zero-based cell ranges'
);

select is(
	private.is_valid_source_location('{"kind":"SECTION","sectionIndex":1}'::jsonb),
	true,
	'SECTION accepts a one-based section without invented detail'
);
select is(
	private.is_valid_source_location('{"kind":"SECTION","sectionIndex":2,"label":"제2절","blockIndex":4}'::jsonb),
	true,
	'SECTION accepts nonblank labels and one-based blocks'
);
select is(
	private.is_valid_source_location('{"kind":"SECTION","sectionIndex":1,"blockIndex":0}'::jsonb),
	false,
	'SECTION rejects zero block positions'
);
select is(
	private.is_valid_source_location('["TEXT_LINES",1,1]'::jsonb),
	false,
	'location validator rejects non-object JSON'
);
select is(
	private.is_valid_source_location('{"kind":"UNKNOWN","lineStart":1,"lineEnd":1}'::jsonb),
	false,
	'location validator rejects unknown discriminators'
);

select is(
	private.source_text_sha256('abc'),
	'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
	'source text helper hashes exact UTF-8 bytes as lowercase SHA-256'
);

select lives_ok(
	$$
		select private.is_valid_source_location(
			'{"kind":"TEXT_LINES","lineStart":1,"lineEnd":2147483648}'::jsonb
		)
	$$,
	'large untrusted positive locations are evaluated without integer overflow'
);


select * from finish();
rollback;
