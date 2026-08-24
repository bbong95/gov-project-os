begin;

select plan(20);

insert into auth.users (id, email)
values
	('00000000-0000-0000-0000-000000000001', 'editor-a@example.test'),
	('00000000-0000-0000-0000-000000000002', 'viewer-a@example.test'),
	('00000000-0000-0000-0000-000000000003', 'reviewer-a@example.test'),
	('00000000-0000-0000-0000-000000000004', 'project-admin-a@example.test'),
	('00000000-0000-0000-0000-000000000005', 'tenant-admin-a@example.test'),
	('00000000-0000-0000-0000-000000000006', 'tenant-admin-b@example.test'),
	('00000000-0000-0000-0000-000000000007', 'editor-b@example.test');

insert into public.tenants (id, name, created_by)
values
	('10000000-0000-0000-0000-000000000001', '합성 기관 A', '00000000-0000-0000-0000-000000000005'),
	('20000000-0000-0000-0000-000000000001', '합성 기관 B', '00000000-0000-0000-0000-000000000006');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
	('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'TENANT_ADMIN'),
	('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006', 'TENANT_ADMIN');

insert into public.projects (id, tenant_id, name, created_by)
values
	(
		'10000000-0000-0000-0000-000000000101',
		'10000000-0000-0000-0000-000000000001',
		'합성 프로젝트 A',
		'00000000-0000-0000-0000-000000000005'
	),
	(
		'20000000-0000-0000-0000-000000000101',
		'20000000-0000-0000-0000-000000000001',
		'합성 프로젝트 B',
		'00000000-0000-0000-0000-000000000006'
	);

insert into public.project_memberships (tenant_id, project_id, user_id, role)
values
	(
		'10000000-0000-0000-0000-000000000001',
		'10000000-0000-0000-0000-000000000101',
		'00000000-0000-0000-0000-000000000001',
		'EDITOR'
	),
	(
		'10000000-0000-0000-0000-000000000001',
		'10000000-0000-0000-0000-000000000101',
		'00000000-0000-0000-0000-000000000002',
		'VIEWER'
	),
	(
		'10000000-0000-0000-0000-000000000001',
		'10000000-0000-0000-0000-000000000101',
		'00000000-0000-0000-0000-000000000003',
		'REVIEWER'
	),
	(
		'10000000-0000-0000-0000-000000000001',
		'10000000-0000-0000-0000-000000000101',
		'00000000-0000-0000-0000-000000000004',
		'PROJECT_ADMIN'
	),
	(
		'20000000-0000-0000-0000-000000000001',
		'20000000-0000-0000-0000-000000000101',
		'00000000-0000-0000-0000-000000000007',
		'EDITOR'
	);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
set local role authenticated;

select is(
	(select count(*)::integer from public.projects where id = '10000000-0000-0000-0000-000000000101'),
	1,
	'Project A editor can read assigned Project A'
);
select is(
	(select count(*)::integer from public.projects where id = '20000000-0000-0000-0000-000000000101'),
	0,
	'Project A editor cannot read Project B'
);
update public.projects
	set name = '합성 프로젝트 A - 편집됨'
	where id = '10000000-0000-0000-0000-000000000101';
select is(
	(select name from public.projects where id = '10000000-0000-0000-0000-000000000101'),
	'합성 프로젝트 A - 편집됨',
	'Project A editor can update assigned Project A'
);
update public.projects
	set name = '허용되지 않은 변경'
	where id = '20000000-0000-0000-0000-000000000101';

reset role;
select is(
	(select name from public.projects where id = '20000000-0000-0000-0000-000000000101'),
	'합성 프로젝트 B',
	'Project A editor cannot update Project B'
);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is(
	(select count(*)::integer from public.project_memberships),
	1,
	'project member can read only their own membership row'
);
select is(
	(select count(*)::integer from public.tenants where id = '10000000-0000-0000-0000-000000000001'),
	1,
	'project member can read the tenant of their assigned project'
);
select is(
	(select count(*)::integer from public.tenants where id = '20000000-0000-0000-0000-000000000001'),
	0,
	'project member cannot read another tenant'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
set local role authenticated;

select is(
	(select count(*)::integer from public.projects where id = '10000000-0000-0000-0000-000000000101'),
	1,
	'viewer can read their assigned project'
);
update public.projects
	set name = 'VIEWER 변경'
	where id = '10000000-0000-0000-0000-000000000101';
select is(
	(select name from public.projects where id = '10000000-0000-0000-0000-000000000101'),
	'합성 프로젝트 A - 편집됨',
	'viewer cannot update their assigned project'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
set local role authenticated;

select is(
	(select count(*)::integer from public.projects where id = '10000000-0000-0000-0000-000000000101'),
	1,
	'reviewer can read their assigned project'
);
update public.projects
	set name = 'REVIEWER 변경'
	where id = '10000000-0000-0000-0000-000000000101';
select is(
	(select name from public.projects where id = '10000000-0000-0000-0000-000000000101'),
	'합성 프로젝트 A - 편집됨',
	'reviewer cannot update their assigned project'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
set local role authenticated;

select is(
	(select count(*)::integer from public.projects where id = '10000000-0000-0000-0000-000000000101'),
	1,
	'project admin can read their assigned project'
);
update public.projects
	set name = 'PROJECT_ADMIN 변경'
	where id = '10000000-0000-0000-0000-000000000101';
select is(
	(select name from public.projects where id = '10000000-0000-0000-0000-000000000101'),
	'PROJECT_ADMIN 변경',
	'project admin can update their assigned project'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);
set local role authenticated;

select is(
	(select count(*)::integer from public.projects where id = '10000000-0000-0000-0000-000000000101'),
	1,
	'tenant admin can read a project in their tenant'
);
select is(
	(select count(*)::integer from public.projects where id = '20000000-0000-0000-0000-000000000101'),
	0,
	'tenant admin cannot read a project in another tenant'
);
update public.projects
	set name = 'TENANT_ADMIN 변경'
	where id = '10000000-0000-0000-0000-000000000101';
select is(
	(select name from public.projects where id = '10000000-0000-0000-0000-000000000101'),
	'TENANT_ADMIN 변경',
	'tenant admin can update a project in their tenant'
);
update public.projects
	set name = '허용되지 않은 TENANT_ADMIN 변경'
	where id = '20000000-0000-0000-0000-000000000101';

reset role;
select is(
	(select name from public.projects where id = '20000000-0000-0000-0000-000000000101'),
	'합성 프로젝트 B',
	'tenant admin cannot update a project in another tenant'
);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);
set local role authenticated;
select is(
	(select count(*)::integer from public.project_memberships),
	4,
	'tenant admin can read project memberships only in their tenant'
);
select is(
	(select count(*)::integer from public.tenant_memberships),
	1,
	'tenant admin can read only their own tenant membership'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select throws_ok(
	'select id from public.projects',
	'42501',
	'permission denied for table projects',
	'anonymous user cannot read private projects'
);

reset role;
select * from finish();
rollback;
