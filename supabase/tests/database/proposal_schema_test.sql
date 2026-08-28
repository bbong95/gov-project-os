begin;

select plan(10);

select has_table('public', 'proposals', 'proposals exist');
select has_table('public', 'proposal_sections', 'proposal sections exist');

select columns_are(
	'public',
	'proposals',
	array[
		'id', 'tenant_id', 'project_id', 'run_id', 'baseline_id', 'version',
		'document_id', 'document_parse_id',
		'status', 'created_by', 'created_at', 'updated_at'
	],
	'proposals columns'
);

select columns_are(
	'public',
	'proposal_sections',
	array[
		'id', 'tenant_id', 'project_id', 'run_id', 'proposal_id', 'section_key',
		'content_md', 'evidence_candidate_ids', 'generated_by', 'generated_at'
	],
	'proposal sections columns'
);

select col_type_is('public', 'proposal_sections', 'content_md', 'text', 'proposal section content is text');
select col_type_is('public', 'proposal_sections', 'evidence_candidate_ids', 'jsonb', 'evidence ids are jsonb');

select is(
	(
		select count(*)::integer
		from information_schema.role_table_grants
		where grantee in ('anon', 'authenticated')
			and table_schema = 'public'
			and table_name in ('proposals', 'proposal_sections')
			and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
	),
	0,
	'no application role can mutate proposals directly'
);

select is(
	(
		select count(*)::integer
		from pg_proc
		where oid = 'public.generate_proposal(uuid, uuid)'::regprocedure
	),
	1,
	'proposal generation function exists with the exact signature'
);

select is(
	(select prosecdef from pg_proc where oid = 'public.generate_proposal(uuid, uuid)'::regprocedure),
	false,
	'generate_proposal is security invoker'
);

select is(
	has_function_privilege('service_role', 'public.generate_proposal(uuid, uuid)', 'execute'),
	true,
	'service role executes the generation function'
);

select * from finish();
rollback;
