begin;

select plan(34);

select ok(
	exists (
		select 1
		from pg_type as type
		join pg_namespace as namespace on namespace.oid = type.typnamespace
		where namespace.nspname = 'public'
			and type.typname = 'privacy_classification'
	),
	'public.privacy_classification exists'
);

select is(
	(
		select string_agg(enum.enumlabel, ',' order by enum.enumsortorder)
		from pg_enum as enum
		join pg_type as type on type.oid = enum.enumtypid
		join pg_namespace as namespace on namespace.oid = type.typnamespace
		where namespace.nspname = 'public'
			and type.typname = 'privacy_classification'
	),
	'PUBLIC,INTERNAL,PERSONAL,SENSITIVE,RESTRICTED',
	'privacy classification values match the master specification'
);

select has_table('public', 'documents', 'public.documents exists');
select has_table('public', 'audit_events', 'public.audit_events exists');

select ok(
	coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.documents')), false),
	'RLS is enabled on public.documents'
);
select ok(
	coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.audit_events')), false),
	'RLS is enabled on public.audit_events'
);

select col_not_null('public', 'documents', 'project_id', 'documents.project_id is required');
select col_not_null('public', 'documents', 'sha256', 'documents.sha256 is required');
select col_not_null(
	'public',
	'documents',
	'privacy_classification',
	'documents.privacy_classification is required'
);
select col_not_null('public', 'documents', 'storage_path', 'documents.storage_path is required');
select col_not_null('public', 'documents', 'created_by', 'documents.created_by is required');

select ok(
	exists (
		select 1
		from pg_constraint
		where conname = 'documents_tenant_project_fkey'
			and conrelid = to_regclass('public.documents')
			and contype = 'f'
			and confdeltype = 'r'
			and pg_get_constraintdef(oid) like 'FOREIGN KEY (tenant_id, project_id)%'
	),
	'documents use a restrictive composite tenant/project foreign key'
);

select ok(
	exists (
		select 1
		from pg_constraint
		where conname = 'documents_created_by_fkey'
			and conrelid = to_regclass('public.documents')
			and contype = 'f'
	),
	'documents.created_by references Auth users'
);

select is(
	(
		select count(*)::integer
		from pg_constraint
		where conrelid = to_regclass('public.documents')
			and conname in (
				'documents_document_kind_check',
				'documents_original_filename_not_blank',
				'documents_media_type_not_blank',
				'documents_byte_size_check',
				'documents_storage_bucket_check',
				'documents_storage_path_check',
				'documents_sha256_check'
			)
			and contype = 'c'
	),
	7,
	'documents enforce kind, untrusted metadata, size, fixed storage, path, and hash checks'
);

select ok(
	exists (
		select 1
		from pg_constraint
		where conname = 'documents_storage_object_key'
			and conrelid = to_regclass('public.documents')
			and contype = 'u'
	),
	'each registered Storage object path is unique'
);

select ok(
	to_regclass('public.documents_project_created_at_idx') is not null,
	'document project listing is indexed'
);
select ok(
	to_regclass('public.audit_events_project_created_at_idx') is not null,
	'audit project history is indexed'
);

select is(
	(
		select count(*)::integer
		from information_schema.role_table_grants
		where grantee = 'anon'
			and table_schema = 'public'
			and table_name in ('documents', 'audit_events')
	),
	0,
	'anon has no privileges on document or audit tables'
);

select is(
	(
		select string_agg(table_name || ':' || privilege_type, ',' order by table_name, privilege_type)
		from information_schema.role_table_grants
		where grantee = 'authenticated'
			and table_schema = 'public'
			and table_name in ('documents', 'audit_events')
	),
	'documents:INSERT,documents:SELECT',
	'authenticated can only insert and read document metadata'
);

select is(
	(
		select count(*)::integer
		from information_schema.role_table_grants
		where grantee = 'authenticated'
			and table_schema = 'public'
			and table_name = 'audit_events'
	),
	0,
	'authenticated cannot mutate or read audit rows directly in M06'
);

select is(
	(
		select count(*)::integer
		from information_schema.role_table_grants
		where grantee = 'service_role'
			and table_schema = 'public'
			and table_name in ('documents', 'audit_events')
			and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
	),
	8,
	'service_role has explicit trusted administration privileges on M06 tables'
);

select ok(
	exists (select 1 from storage.buckets where id = 'rfp-originals' and name = 'rfp-originals'),
	'rfp-originals bucket exists'
);

select is(
	(select public from storage.buckets where id = 'rfp-originals'),
	false,
	'rfp-originals bucket is private'
);

select is(
	(select file_size_limit from storage.buckets where id = 'rfp-originals'),
	6291456::bigint,
	'rfp-originals bucket enforces the 6 MiB M06 limit'
);

select is(
	(select allowed_mime_types from storage.buckets where id = 'rfp-originals'),
	null::text[],
	'bucket does not trust client media type as content authentication'
);

select ok(
	to_regnamespace('private') is not null,
	'private schema exists for the audit trigger function'
);

select ok(
	to_regprocedure('private.log_rfp_original_upload()') is not null,
	'private.log_rfp_original_upload trigger function exists'
);

select ok(
	coalesce(
		(
			select prosecdef
			from pg_proc
			where oid = to_regprocedure('private.log_rfp_original_upload()')
		),
		false
	),
	'audit trigger function is security definer'
);

select ok(
	coalesce(
		(
			select proconfig @> array['search_path=""']::text[]
			from pg_proc
			where oid = to_regprocedure('private.log_rfp_original_upload()')
		),
		false
	),
	'audit trigger function fixes an empty search_path'
);

select ok(
	exists (
		select 1
		from pg_trigger
		where tgrelid = to_regclass('public.documents')
			and tgname = 'documents_log_rfp_original_upload'
			and tgenabled = 'O'
			and not tgisinternal
	),
	'document insert audit trigger is enabled'
);

select is(
	(
		select count(*)::integer
		from pg_policies
		where schemaname = 'storage'
			and tablename = 'objects'
			and policyname like 'rfp originals %'
	),
	3,
	'Storage has only the three M06 RFP original policies'
);

select is(
	(
		select string_agg(command, ',' order by command)
		from (
			select distinct cmd as command
			from pg_policies
			where schemaname = 'storage'
				and tablename = 'objects'
				and policyname like 'rfp originals %'
		) as commands
	),
	'DELETE,INSERT,SELECT',
	'Storage permits insert, authenticated get, and orphan compensation but no update'
);

select ok(
	to_regprocedure('private.is_registered_rfp_original(text,text)') is not null,
	'private registered-original lookup exists'
);

select ok(
	coalesce(
		(
			select prosecdef
				and proconfig @> array['search_path=""']::text[]
			from pg_proc
			where oid = to_regprocedure('private.is_registered_rfp_original(text,text)')
		),
		false
	),
	'registered-original lookup is security definer with an empty search_path'
);

select * from finish();
rollback;
