begin;

select plan(25);

select has_column(
	'public',
	'requirement_candidates',
	'reviewed_by',
	'requirement_candidates records the reviewing user'
);
select has_column(
	'public',
	'requirement_candidates',
	'reviewed_at',
	'requirement_candidates records the review time'
);

select col_type_is(
	'public',
	'requirement_candidates',
	'reviewed_by',
	'uuid',
	'reviewed_by is a user uuid'
);
select col_type_is(
	'public',
	'requirement_candidates',
	'reviewed_at',
	'timestamptz',
	'reviewed_at is a timestamp'
);

select has_column(
	'public',
	'requirement_candidates',
	'content_sha256',
	'existing content hash survives the review migration'
);

select columns_are(
	'public',
	'requirement_candidates',
	array[
		'id', 'tenant_id', 'project_id', 'document_id', 'document_parse_id',
		'run_id', 'candidate_order', 'official_id', 'source_text',
		'interpretation', 'requirement_type', 'atomicity', 'provenance_state',
		'content_sha256', 'created_at', 'reviewed_by', 'reviewed_at'
	],
	'requirement_candidates columns after the review migration'
);

select is(
	(
		select count(*)::integer
		from pg_proc
		where oid = 'public.review_requirement_candidate(uuid, uuid, uuid, text, text)'::regprocedure
	),
	1,
	'review action function exists with the exact signature'
);
select is(
	(
		select count(*)::integer
		from pg_proc
		where oid = 'public.merge_requirement_candidates(uuid, uuid, jsonb, text)'::regprocedure
	),
	1,
	'merge function exists with the exact signature'
);
select is(
	(
		select count(*)::integer
		from pg_proc
		where oid = 'public.split_requirement_candidate(uuid, uuid, uuid, jsonb)'::regprocedure
	),
	1,
	'split function exists with the exact signature'
);

select is(
	(select provolatile from pg_proc where oid = 'public.review_requirement_candidate(uuid, uuid, uuid, text, text)'::regprocedure),
	'v',
	'review function is volatile'
);
select is(
	(select prosecdef from pg_proc where oid = 'public.review_requirement_candidate(uuid, uuid, uuid, text, text)'::regprocedure),
	false,
	'review function is security invoker'
);
select is(
	(select array_to_string(proconfig, ',') from pg_proc where oid = 'public.review_requirement_candidate(uuid, uuid, uuid, text, text)'::regprocedure),
	'search_path=""',
	'review function pins an empty search_path'
);
select is(
	(select prosecdef from pg_proc where oid = 'public.merge_requirement_candidates(uuid, uuid, jsonb, text)'::regprocedure),
	false,
	'merge function is security invoker'
);
select is(
	(select array_to_string(proconfig, ',') from pg_proc where oid = 'public.merge_requirement_candidates(uuid, uuid, jsonb, text)'::regprocedure),
	'search_path=""',
	'merge function pins an empty search_path'
);
select is(
	(select prosecdef from pg_proc where oid = 'public.split_requirement_candidate(uuid, uuid, uuid, jsonb)'::regprocedure),
	false,
	'split function is security invoker'
);
select is(
	(select array_to_string(proconfig, ',') from pg_proc where oid = 'public.split_requirement_candidate(uuid, uuid, uuid, jsonb)'::regprocedure),
	'search_path=""',
	'split function pins an empty search_path'
);

select is(
	has_function_privilege(
		'anon',
		'public.review_requirement_candidate(uuid, uuid, uuid, text, text)',
		'execute'
	),
	false,
	'anon must not execute the review function'
);
select is(
	has_function_privilege(
		'authenticated',
		'public.review_requirement_candidate(uuid, uuid, uuid, text, text)',
		'execute'
	),
	false,
	'authenticated must not execute the review function'
);
select is(
	has_function_privilege(
		'service_role',
		'public.review_requirement_candidate(uuid, uuid, uuid, text, text)',
		'execute'
	),
	true,
	'service role executes the review function'
);
select is(
	has_function_privilege(
		'anon',
		'public.merge_requirement_candidates(uuid, uuid, jsonb, text)',
		'execute'
	),
	false,
	'anon must not execute the merge function'
);
select is(
	has_function_privilege(
		'service_role',
		'public.merge_requirement_candidates(uuid, uuid, jsonb, text)',
		'execute'
	),
	true,
	'service role executes the merge function'
);
select is(
	has_function_privilege(
		'anon',
		'public.split_requirement_candidate(uuid, uuid, uuid, jsonb)',
		'execute'
	),
	false,
	'anon must not execute the split function'
);
select is(
	has_function_privilege(
		'service_role',
		'public.split_requirement_candidate(uuid, uuid, uuid, jsonb)',
		'execute'
	),
	true,
	'service role executes the split function'
);

select is(
	(
		select count(*)::integer
		from pg_constraint
		where conrelid = 'public.requirement_candidates'::regclass
			and contype = 'c'
			and pg_get_constraintdef(oid) like '%provenance_state%'
			and pg_get_constraintdef(oid) like '%HUMAN_VERIFIED%'
	),
	1,
	'provenance check constraint accepts the review states'
);

select is(
	(
		select count(*)::integer
		from pg_constraint
		where conrelid = 'public.requirement_candidates'::regclass
			and contype = 'f'
			and pg_get_constraintdef(oid) like '%reviewed_by%'
	),
	1,
	'reviewed_by references auth users'
);

select * from finish();
rollback;
