begin;

select plan(22);

select ok(
	exists (
		select 1
		from pg_type as type
		join pg_namespace as namespace on namespace.oid = type.typnamespace
		where namespace.nspname = 'public'
			and type.typname = 'membership_role'
	),
	'public.membership_role exists'
);

select is(
	(
		select string_agg(enum.enumlabel, ',' order by enum.enumsortorder)
		from pg_enum as enum
		join pg_type as type on type.oid = enum.enumtypid
		join pg_namespace as namespace on namespace.oid = type.typnamespace
		where namespace.nspname = 'public'
			and type.typname = 'membership_role'
	),
	'VIEWER,EDITOR,REVIEWER,PROJECT_ADMIN,TENANT_ADMIN',
	'membership_role has the five required values in stable order'
);

select has_table('public', 'tenants', 'public.tenants exists');
select has_table('public', 'tenant_memberships', 'public.tenant_memberships exists');
select has_table('public', 'projects', 'public.projects exists');
select has_table('public', 'project_memberships', 'public.project_memberships exists');

select ok(
	coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.tenants')), false),
	'RLS is enabled on public.tenants'
);
select ok(
	coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.tenant_memberships')), false),
	'RLS is enabled on public.tenant_memberships'
);
select ok(
	coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.projects')), false),
	'RLS is enabled on public.projects'
);
select ok(
	coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.project_memberships')), false),
	'RLS is enabled on public.project_memberships'
);

select is(
	(
		select count(*)::integer
		from pg_constraint
		where conname in (
			'tenants_pkey',
			'tenant_memberships_pkey',
			'projects_pkey',
			'project_memberships_pkey'
		)
			and conrelid in (
				to_regclass('public.tenants'),
				to_regclass('public.tenant_memberships'),
				to_regclass('public.projects'),
				to_regclass('public.project_memberships')
			)
			and contype = 'p'
	),
	4,
	'all four M05 tables have primary keys'
);

select ok(
	exists (
		select 1 from pg_constraint
		where conname = 'tenant_memberships_role_check'
			and conrelid = to_regclass('public.tenant_memberships')
			and contype = 'c'
	),
	'tenant membership role constraint exists'
);

select ok(
	exists (
		select 1 from pg_constraint
		where conname = 'project_memberships_role_check'
			and conrelid = to_regclass('public.project_memberships')
			and contype = 'c'
	),
	'project membership role constraint exists'
);

select ok(
	exists (
		select 1 from pg_constraint
		where conname = 'project_memberships_tenant_project_fkey'
			and conrelid = to_regclass('public.project_memberships')
			and contype = 'f'
			and pg_get_constraintdef(oid) like 'FOREIGN KEY (tenant_id, project_id)%'
	),
	'project membership tenant and project use one composite foreign key'
);

select ok(to_regclass('public.tenant_memberships_user_id_idx') is not null, 'tenant membership user lookup is indexed');
select ok(to_regclass('public.projects_tenant_id_id_key') is not null, 'project tenant lookup is indexed');
select ok(to_regclass('public.project_memberships_user_id_idx') is not null, 'project membership user lookup is indexed');

select is(
	(
		select count(*)::integer
		from information_schema.role_table_grants
		where grantee = 'anon'
			and table_schema = 'public'
			and table_name in ('tenants', 'tenant_memberships', 'projects', 'project_memberships')
	),
	0,
	'anon has no privileges on private tenant and project tables'
);

select is(
	(
		select string_agg(table_name || ':' || privilege_type, ',' order by table_name, privilege_type)
		from information_schema.role_table_grants
		where grantee = 'authenticated'
			and table_schema = 'public'
			and table_name in ('tenants', 'tenant_memberships', 'projects', 'project_memberships')
	),
	'project_memberships:SELECT,projects:SELECT,tenant_memberships:SELECT,tenants:SELECT',
	'authenticated has only the M05 Data API privileges it needs'
);

select is(
	(
		select string_agg(table_name || ':' || column_name || ':' || privilege_type, ',' order by table_name, column_name, privilege_type)
		from information_schema.role_column_grants
		where grantee = 'authenticated'
			and table_schema = 'public'
			and table_name = 'projects'
			and privilege_type = 'UPDATE'
	),
	'projects:name:UPDATE,projects:updated_at:UPDATE',
	'authenticated can update only mutable project metadata columns'
);

select is(
	(
		select count(*)::integer
		from information_schema.role_table_grants
		where grantee = 'service_role'
			and table_schema = 'public'
			and table_name in ('tenants', 'tenant_memberships', 'projects', 'project_memberships')
			and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
	),
	16,
	'service_role has explicit administration privileges on all four M05 tables'
);

select is(
	(
		select count(*)::integer
		from pg_constraint
		where conname in (
			'tenants_created_by_fkey',
			'tenant_memberships_tenant_id_fkey',
			'tenant_memberships_user_id_fkey',
			'projects_tenant_id_fkey',
			'projects_created_by_fkey',
			'project_memberships_tenant_project_fkey',
			'project_memberships_user_id_fkey'
		)
			and conrelid in (
				to_regclass('public.tenants'),
				to_regclass('public.tenant_memberships'),
				to_regclass('public.projects'),
				to_regclass('public.project_memberships')
			)
			and contype = 'f'
	),
	7,
	'all required tenant, project, and Auth foreign keys exist'
);

select * from finish();
rollback;
