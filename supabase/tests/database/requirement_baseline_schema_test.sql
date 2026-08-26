begin;

select plan(19);

select has_table('public', 'requirement_baselines', 'requirement baselines exist');
select has_table('public', 'requirement_baseline_items', 'requirement baseline items exist');

select columns_are(
	'public',
	'requirement_baselines',
	array[
		'id', 'tenant_id', 'project_id', 'document_id', 'document_parse_id',
		'run_id', 'version', 'content_sha256', 'candidate_count',
		'created_by', 'created_at'
	],
	'baseline columns'
);

select columns_are(
	'public',
	'requirement_baseline_items',
	array[
		'id', 'tenant_id', 'project_id', 'run_id', 'baseline_id',
		'candidate_id', 'candidate_order', 'official_id', 'source_text',
		'interpretation', 'requirement_type', 'atomicity',
		'content_sha256', 'created_at'
	],
	'baseline item columns'
);

select col_type_is('public', 'requirement_baselines', 'version', 'integer', 'baseline version is an integer');
select col_type_is('public', 'requirement_baselines', 'content_sha256', 'text', 'baseline content hash is text');

select is(
	(
		select count(*)::integer
		from pg_constraint
		where conrelid = 'public.requirement_baselines'::regclass
			and contype = 'u'
			and pg_get_constraintdef(oid) like '%version%'
	),
	1,
	'baseline version is unique per run'
);

select is(
	(
		select count(*)::integer
		from pg_constraint
		where conrelid = 'public.requirement_baseline_items'::regclass
			and contype = 'f'
			and pg_get_constraintdef(oid) like '%requirement_candidates%'
	),
	1,
	'baseline items reference immutable candidates'
);

select is(
	(
		select count(*)::integer
		from pg_tables
		where schemaname = 'public'
			and tablename in ('requirement_baselines', 'requirement_baseline_items')
			and rowsecurity
	),
	2,
	'baseline tables enforce row level security'
);

select is(
	(
		select count(*)::integer
		from information_schema.role_table_grants
		where grantee in ('anon', 'authenticated')
			and table_schema = 'public'
			and table_name in ('requirement_baselines', 'requirement_baseline_items')
			and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
	),
	0,
	'no application role can mutate baselines directly'
);

select is(
	(
		select count(*)::integer
		from information_schema.role_table_grants
		where grantee = 'service_role'
			and table_schema = 'public'
			and table_name in ('requirement_baselines', 'requirement_baseline_items')
			and privilege_type = 'UPDATE'
	),
	0,
	'baselines have no update path even for the trusted role (delete is test cleanup only)'
);

select is(
	(
		select count(*)::integer
		from pg_proc
		where oid = 'public.create_requirement_baseline(uuid, uuid)'::regprocedure
	),
	1,
	'baseline creation function exists with the exact signature'
);

select is(
	(select prosecdef from pg_proc where oid = 'public.create_requirement_baseline(uuid, uuid)'::regprocedure),
	false,
	'baseline function is security invoker'
);
select is(
	(select array_to_string(proconfig, ',') from pg_proc where oid = 'public.create_requirement_baseline(uuid, uuid)'::regprocedure),
	'search_path=""',
	'baseline function pins an empty search_path'
);
select is(
	has_function_privilege('anon', 'public.create_requirement_baseline(uuid, uuid)', 'execute'),
	false,
	'anon must not execute the baseline function'
);
select is(
	has_function_privilege('authenticated', 'public.create_requirement_baseline(uuid, uuid)', 'execute'),
	false,
	'authenticated must not execute the baseline function'
);
select is(
	has_function_privilege('service_role', 'public.create_requirement_baseline(uuid, uuid)', 'execute'),
	true,
	'service role executes the baseline function'
);

select is(
	(
		select count(*)::integer
		from pg_constraint
		where conrelid = 'public.requirement_baselines'::regclass
			and contype = 'c'
			and pg_get_constraintdef(oid) like '%version%'
			and pg_get_constraintdef(oid) like '%> 0%'
	),
	1,
	'baseline versions start at one'
);

select is(
	(
		select count(*)::integer
		from pg_constraint
		where conrelid = 'public.requirement_baseline_items'::regclass
			and contype = 'c'
			and pg_get_constraintdef(oid) like '%content_sha256%'
	),
	1,
	'baseline item content hashes are constrained'
);

select * from finish();
rollback;
