begin;

select plan(55);

select ok(
	to_regtype('public.requirement_type') is not null,
	'closed requirement type enum exists'
);
select is(
	(
		select string_agg(enumlabel, ',' order by enumsortorder)
		from pg_enum
		where enumtypid = to_regtype('public.requirement_type')
	),
	'FUNCTIONAL,SYSTEM_CONFIGURATION,PERFORMANCE,INTERFACE,DATA,TEST,SECURITY,QUALITY,CONSTRAINT,PROJECT_MANAGEMENT,PROJECT_SUPPORT,OTHER',
	'requirement type vocabulary is closed and versioned by the extraction schema'
);
select ok(
	to_regtype('public.requirement_atomicity') is not null,
	'closed requirement atomicity enum exists'
);
select is(
	(
		select string_agg(enumlabel, ',' order by enumsortorder)
		from pg_enum
		where enumtypid = to_regtype('public.requirement_atomicity')
	),
	'ATOMIC,COMPOSITE,REVIEW_REQUIRED',
	'atomicity vocabulary preserves explicit review-required state'
);

select has_table('public', 'requirement_extraction_runs', 'requirement extraction run snapshots exist');
select has_table('public', 'requirement_candidates', 'requirement candidate snapshots exist');
select has_table('public', 'requirement_candidate_source_spans', 'candidate evidence links exist');

select ok(
	exists (
		select 1
		from pg_constraint
		where conname = 'source_spans_scope_id_key'
			and conrelid = to_regclass('public.source_spans')
			and contype = 'u'
			and pg_get_constraintdef(oid) =
				'UNIQUE (tenant_id, project_id, document_id, document_parse_id, id)'
	),
	'source spans expose an immutable same-parse composite identity'
);

select ok(
	coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.requirement_extraction_runs')), false),
	'RLS is enabled on requirement extraction runs'
);
select ok(
	coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.requirement_candidates')), false),
	'RLS is enabled on requirement candidates'
);
select ok(
	coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.requirement_candidate_source_spans')), false),
	'RLS is enabled on requirement evidence links'
);
select ok(
	coalesce((select relforcerowsecurity from pg_class where oid = to_regclass('public.requirement_extraction_runs')), false),
	'RLS is forced on requirement extraction runs'
);
select ok(
	coalesce((select relforcerowsecurity from pg_class where oid = to_regclass('public.requirement_candidates')), false),
	'RLS is forced on requirement candidates'
);
select ok(
	coalesce((select relforcerowsecurity from pg_class where oid = to_regclass('public.requirement_candidate_source_spans')), false),
	'RLS is forced on requirement evidence links'
);

select is(
	(
		select count(*)::integer
		from information_schema.columns
		where table_schema = 'public'
			and table_name = 'requirement_extraction_runs'
			and is_nullable = 'NO'
			and column_name in (
				'id', 'tenant_id', 'project_id', 'document_id', 'document_parse_id',
				'status', 'privacy_classification', 'policy_decision', 'provider', 'model',
				'policy_version', 'prompt_version', 'schema_version', 'parse_result_sha256',
				'canonical_input_sha256', 'fingerprint_sha256', 'accepted_output_sha256',
				'created_by', 'created_at'
			)
	),
	19,
	'run snapshots require scope, policy, versions, hashes, actor, and time'
);
select is(
	(
		select string_agg(column_name, ',' order by ordinal_position)
		from information_schema.columns
		where table_schema = 'public'
			and table_name = 'requirement_extraction_runs'
			and is_nullable = 'YES'
	),
	'provider_response_id,input_tokens,output_tokens',
	'only safe provider identity and aggregate usage metadata are nullable'
);
select is(
	(
		select string_agg(column_name || ':' || udt_name, ',' order by ordinal_position)
		from information_schema.columns
		where table_schema = 'public'
			and table_name = 'requirement_extraction_runs'
			and column_name in ('privacy_classification', 'input_tokens', 'output_tokens')
	),
	'privacy_classification:privacy_classification,input_tokens:int4,output_tokens:int4',
	'run privacy and usage fields use bounded database types'
);
select ok(
	exists (
		select 1 from pg_constraint
		where conname = 'requirement_extraction_runs_pkey'
			and conrelid = to_regclass('public.requirement_extraction_runs')
			and contype = 'p'
	),
	'run snapshots have a database-generated primary key'
);
select ok(
	exists (
		select 1 from pg_constraint
		where conname = 'requirement_extraction_runs_document_parse_fkey'
			and conrelid = to_regclass('public.requirement_extraction_runs')
			and contype = 'f'
			and confdeltype = 'r'
			and pg_get_constraintdef(oid) like
				'FOREIGN KEY (tenant_id, project_id, document_id, document_parse_id)%'
	),
	'runs reference one immutable parse with a restrictive composite foreign key'
);
select ok(
	exists (
		select 1 from pg_constraint
		where conname = 'requirement_extraction_runs_created_by_fkey'
			and conrelid = to_regclass('public.requirement_extraction_runs')
			and contype = 'f'
			and confdeltype = 'r'
	),
	'run creators reference Auth users restrictively'
);
select ok(
	exists (
		select 1 from pg_constraint
		where conname = 'requirement_extraction_runs_status_check'
			and conrelid = to_regclass('public.requirement_extraction_runs')
			and contype = 'c'
	),
	'only immutable succeeded snapshots can exist as extraction runs'
);
select ok(
	exists (
		select 1 from pg_constraint
		where conname = 'requirement_extraction_runs_policy_decision_check'
			and conrelid = to_regclass('public.requirement_extraction_runs')
			and contype = 'c'
	),
	'successful snapshots fix the policy decision to allow'
);
select is(
	(
		select count(*)::integer from pg_constraint
		where conrelid = to_regclass('public.requirement_extraction_runs')
			and conname in (
				'requirement_extraction_runs_parse_result_sha256_check',
				'requirement_extraction_runs_canonical_input_sha256_check',
				'requirement_extraction_runs_fingerprint_sha256_check',
				'requirement_extraction_runs_accepted_output_sha256_check'
			)
			and contype = 'c'
	),
	4,
	'all run identity hashes are constrained to lowercase SHA-256'
);
select is(
	(
		select count(*)::integer from pg_constraint
		where conrelid = to_regclass('public.requirement_extraction_runs')
			and conname in (
				'requirement_extraction_runs_provider_check',
				'requirement_extraction_runs_model_check',
				'requirement_extraction_runs_policy_version_check',
				'requirement_extraction_runs_prompt_version_check',
				'requirement_extraction_runs_schema_version_check',
				'requirement_extraction_runs_provider_response_id_check',
				'requirement_extraction_runs_input_tokens_check',
				'requirement_extraction_runs_output_tokens_check'
			)
			and contype = 'c'
	),
	8,
	'provider metadata, versions, identifiers, and usage are bounded'
);
select ok(
	exists (
		select 1 from pg_constraint
		where conname = 'requirement_extraction_runs_parse_fingerprint_key'
			and conrelid = to_regclass('public.requirement_extraction_runs')
			and contype = 'u'
			and pg_get_constraintdef(oid) = 'UNIQUE (document_parse_id, fingerprint_sha256)'
	),
	'one immutable parse and fingerprint has at most one successful snapshot'
);
select ok(
	exists (
		select 1 from pg_constraint
		where conname = 'requirement_extraction_runs_scope_key'
			and conrelid = to_regclass('public.requirement_extraction_runs')
			and contype = 'u'
			and pg_get_constraintdef(oid) =
				'UNIQUE (tenant_id, project_id, document_id, document_parse_id, id)'
	),
	'runs expose their complete immutable scope to child rows'
);

select is(
	(
		select count(*)::integer
		from information_schema.columns
		where table_schema = 'public'
			and table_name = 'requirement_candidates'
			and is_nullable = 'NO'
			and column_name in (
				'id', 'tenant_id', 'project_id', 'document_id', 'document_parse_id', 'run_id',
				'candidate_order', 'source_text', 'interpretation', 'requirement_type',
				'atomicity', 'provenance_state', 'content_sha256', 'created_at'
			)
	),
	14,
	'candidate snapshots require complete scope, order, interpretation, evidence text, and hash'
);
select is(
	(
		select string_agg(column_name || ':' || udt_name, ',' order by ordinal_position)
		from information_schema.columns
		where table_schema = 'public'
			and table_name = 'requirement_candidates'
			and column_name in ('requirement_type', 'atomicity')
	),
	'requirement_type:requirement_type,atomicity:requirement_atomicity',
	'candidate type and atomicity use closed PostgreSQL enums'
);
select ok(
	exists (
		select 1 from pg_constraint
		where conname = 'requirement_candidates_pkey'
			and conrelid = to_regclass('public.requirement_candidates')
			and contype = 'p'
	),
	'candidate snapshots have a database-generated primary key'
);
select ok(
	exists (
		select 1 from pg_constraint
		where conname = 'requirement_candidates_run_fkey'
			and conrelid = to_regclass('public.requirement_candidates')
			and contype = 'f'
			and confdeltype = 'r'
			and pg_get_constraintdef(oid) like
				'FOREIGN KEY (tenant_id, project_id, document_id, document_parse_id, run_id)%'
	),
	'candidates cannot escape their run scope'
);
select is(
	(
		select count(*)::integer from pg_constraint
		where conrelid = to_regclass('public.requirement_candidates')
			and conname in (
				'requirement_candidates_order_check',
				'requirement_candidates_official_id_check',
				'requirement_candidates_source_text_not_blank',
				'requirement_candidates_source_text_size_check',
				'requirement_candidates_interpretation_not_blank',
				'requirement_candidates_interpretation_size_check',
				'requirement_candidates_provenance_state_check',
				'requirement_candidates_content_sha256_check'
			)
			and contype = 'c'
	),
	8,
	'candidate order, optional identifier, text, provenance, and hash are bounded'
);
select ok(
	exists (
		select 1 from pg_constraint
		where conname = 'requirement_candidates_run_order_key'
			and conrelid = to_regclass('public.requirement_candidates')
			and contype = 'u'
			and pg_get_constraintdef(oid) = 'UNIQUE (run_id, candidate_order)'
	),
	'candidate order is unique inside one run'
);
select ok(
	exists (
		select 1 from pg_constraint
		where conname = 'requirement_candidates_scope_key'
			and conrelid = to_regclass('public.requirement_candidates')
			and contype = 'u'
			and pg_get_constraintdef(oid) =
				'UNIQUE (tenant_id, project_id, document_id, document_parse_id, run_id, id)'
	),
	'candidates expose full run and parse scope to evidence links'
);

select is(
	(
		select count(*)::integer
		from information_schema.columns
		where table_schema = 'public'
			and table_name = 'requirement_candidate_source_spans'
			and is_nullable = 'NO'
			and column_name in (
				'tenant_id', 'project_id', 'document_id', 'document_parse_id', 'run_id',
				'candidate_id', 'source_span_id', 'source_order', 'created_at'
			)
	),
	9,
	'evidence links retain complete run, candidate, parse, and source scope'
);
select ok(
	exists (
		select 1 from pg_constraint
		where conname = 'requirement_candidate_source_spans_pkey'
			and conrelid = to_regclass('public.requirement_candidate_source_spans')
			and contype = 'p'
			and pg_get_constraintdef(oid) = 'PRIMARY KEY (candidate_id, source_order)'
	),
	'evidence order is unique and forms the immutable link identity'
);
select ok(
	exists (
		select 1 from pg_constraint
		where conname = 'requirement_candidate_source_spans_candidate_fkey'
			and conrelid = to_regclass('public.requirement_candidate_source_spans')
			and contype = 'f'
			and confdeltype = 'r'
			and pg_get_constraintdef(oid) like
				'FOREIGN KEY (tenant_id, project_id, document_id, document_parse_id, run_id, candidate_id)%'
	),
	'evidence links reference a candidate in the same run and parse'
);
select ok(
	exists (
		select 1 from pg_constraint
		where conname = 'requirement_candidate_source_spans_source_span_fkey'
			and conrelid = to_regclass('public.requirement_candidate_source_spans')
			and contype = 'f'
			and confdeltype = 'r'
			and pg_get_constraintdef(oid) like
				'FOREIGN KEY (tenant_id, project_id, document_id, document_parse_id, source_span_id)%'
	),
	'evidence links reference an immutable SourceSpan from the same parse'
);
select is(
	(
		select count(*)::integer from pg_constraint
		where conrelid = to_regclass('public.requirement_candidate_source_spans')
			and conname in (
				'requirement_candidate_source_spans_source_order_check',
				'requirement_candidate_source_spans_candidate_span_key'
			)
	),
	2,
	'each candidate has bounded ordered and non-duplicated evidence links'
);

select is(
	(
		select count(*)::integer
		from pg_class
		where oid in (
			to_regclass('public.requirement_extraction_runs_project_created_at_idx'),
			to_regclass('public.requirement_candidates_run_order_idx'),
			to_regclass('public.requirement_candidate_source_spans_span_idx')
		)
	),
	3,
	'project history, candidate order, and reverse evidence lookup are indexed'
);
select is(
	(
		select count(*)::integer
		from information_schema.role_table_grants
		where grantee = 'anon'
			and table_schema = 'public'
			and table_name in (
				'requirement_extraction_runs', 'requirement_candidates',
				'requirement_candidate_source_spans'
			)
	),
	0,
	'anon has no extraction snapshot table privileges'
);
select is(
	(
		select string_agg(table_name || ':' || privilege_type, ',' order by table_name, privilege_type)
		from information_schema.role_table_grants
		where grantee = 'authenticated'
			and table_schema = 'public'
			and table_name in (
				'requirement_extraction_runs', 'requirement_candidates',
				'requirement_candidate_source_spans'
			)
	),
	'requirement_candidate_source_spans:SELECT,requirement_candidates:SELECT,requirement_extraction_runs:SELECT',
	'authenticated receives immutable read-only extraction grants'
);
select is(
	(
		select count(*)::integer
		from information_schema.role_table_grants
		where grantee = 'service_role'
			and table_schema = 'public'
			and table_name in (
				'requirement_extraction_runs', 'requirement_candidates',
				'requirement_candidate_source_spans'
			)
			and privilege_type in ('SELECT', 'INSERT', 'DELETE')
	),
	9,
	'service role has only trusted persistence and cleanup table privileges'
);
select is(
	(
		select count(*)::integer
		from information_schema.role_table_grants
		where grantee in ('authenticated', 'service_role')
			and table_schema = 'public'
			and table_name in (
				'requirement_extraction_runs', 'requirement_candidates',
				'requirement_candidate_source_spans'
			)
			and privilege_type = 'UPDATE'
	),
	0,
	'no application role can update immutable extraction snapshots'
);
select is(
	(
		select count(*)::integer
		from information_schema.role_table_grants
		where grantee = 'authenticated'
			and table_schema = 'public'
			and table_name in ('documents', 'document_parses', 'source_spans')
			and privilege_type in ('UPDATE', 'DELETE')
	),
	0,
	'existing documents, parses, and SourceSpans remain immutable to authenticated callers'
);
select is(
	(
		select count(*)::integer
		from pg_policies
		where schemaname = 'public'
			and tablename in (
				'requirement_extraction_runs', 'requirement_candidates',
				'requirement_candidate_source_spans'
			)
			and cmd = 'SELECT'
			and roles = array['authenticated']::name[]
	),
	3,
	'each extraction table has exactly one authenticated scoped read policy'
);
select is(
	(
		select count(*)::integer
		from pg_policies
		where schemaname = 'public'
			and tablename in (
				'requirement_extraction_runs', 'requirement_candidates',
				'requirement_candidate_source_spans'
			)
			and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
	),
	0,
	'no direct write policy exists for extraction snapshots'
);
select is(
	(
		select count(*)::integer
		from information_schema.columns
		where table_schema = 'public'
			and table_name in (
				'requirement_extraction_runs', 'requirement_candidates',
				'requirement_candidate_source_spans'
			)
			and column_name in (
				'embedding', 'vector', 'mutable_status', 'baseline_id', 'reviewer_id',
				'confidence', 'eval_score', 'precision', 'recall'
			)
	),
	0,
	'M08 adds no vector, baseline, review, mutable status, or M09 metric columns'
);

select ok(
	to_regprocedure('public.persist_requirement_extraction(uuid,uuid,public.privacy_classification,text,text,text,text,text,text,text,text,text,text,integer,integer,jsonb)') is not null,
	'trusted requirement persistence function exists'
);
select ok(
	to_regprocedure('public.record_requirement_extraction_outcome(uuid,uuid,text,text,text,text,text,text,text,text,integer)') is not null,
	'safe requirement outcome function exists'
);
select ok(
	coalesce((
		select not prosecdef and proconfig @> array['search_path=""']::text[]
		from pg_proc
		where oid = to_regprocedure('public.persist_requirement_extraction(uuid,uuid,public.privacy_classification,text,text,text,text,text,text,text,text,text,text,integer,integer,jsonb)')
	), false),
	'trusted requirement persistence is SECURITY INVOKER with an empty fixed search_path'
);
select ok(
	coalesce((
		select not prosecdef and proconfig @> array['search_path=""']::text[]
		from pg_proc
		where oid = to_regprocedure('public.record_requirement_extraction_outcome(uuid,uuid,text,text,text,text,text,text,text,text,integer)')
	), false),
	'safe requirement outcome recording is SECURITY INVOKER with an empty fixed search_path'
);
select is(
	(
		select count(*)::integer
		from information_schema.routine_privileges
		where specific_schema = 'public'
			and routine_name in ('persist_requirement_extraction', 'record_requirement_extraction_outcome')
			and grantee in ('PUBLIC', 'anon', 'authenticated')
			and privilege_type = 'EXECUTE'
	),
	0,
	'untrusted roles cannot execute requirement persistence functions'
);
select is(
	(
		select count(*)::integer
		from information_schema.routine_privileges
		where specific_schema = 'public'
			and routine_name in ('persist_requirement_extraction', 'record_requirement_extraction_outcome')
			and grantee = 'service_role'
			and privilege_type = 'EXECUTE'
	),
	2,
	'only the service role receives explicit trusted function execution'
);
select is(
	coalesce((
		select prorettype::regtype::text
		from pg_proc
		where oid = to_regprocedure('public.persist_requirement_extraction(uuid,uuid,public.privacy_classification,text,text,text,text,text,text,text,text,text,text,integer,integer,jsonb)')
	), ''),
	'jsonb',
	'atomic persistence returns a safe JSON result'
);
select is(
	coalesce((
		select prorettype::regtype::text
		from pg_proc
		where oid = to_regprocedure('public.record_requirement_extraction_outcome(uuid,uuid,text,text,text,text,text,text,text,text,integer)')
	), ''),
	'void',
	'outcome recording returns no raw data'
);

select * from finish();
rollback;
