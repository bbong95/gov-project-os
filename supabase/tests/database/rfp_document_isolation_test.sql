begin;

select plan(21);

insert into auth.users (id, email)
values
	('30000000-0000-0000-0000-000000000001', 'm06-editor-a@example.test'),
	('30000000-0000-0000-0000-000000000002', 'm06-viewer-a@example.test'),
	('30000000-0000-0000-0000-000000000003', 'm06-reviewer-a@example.test'),
	('30000000-0000-0000-0000-000000000004', 'm06-tenant-admin-a@example.test'),
	('30000000-0000-0000-0000-000000000005', 'm06-editor-b@example.test'),
	('30000000-0000-0000-0000-000000000006', 'm06-tenant-admin-b@example.test');

insert into public.tenants (id, name, created_by)
values
	('31000000-0000-0000-0000-000000000001', 'M06 합성 기관 A', '30000000-0000-0000-0000-000000000004'),
	('32000000-0000-0000-0000-000000000001', 'M06 합성 기관 B', '30000000-0000-0000-0000-000000000006');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
	('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 'TENANT_ADMIN'),
	('32000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000006', 'TENANT_ADMIN');

insert into public.projects (id, tenant_id, name, created_by)
values
	(
		'31000000-0000-0000-0000-000000000101',
		'31000000-0000-0000-0000-000000000001',
		'M06 합성 프로젝트 A',
		'30000000-0000-0000-0000-000000000004'
	),
	(
		'32000000-0000-0000-0000-000000000101',
		'32000000-0000-0000-0000-000000000001',
		'M06 합성 프로젝트 B',
		'30000000-0000-0000-0000-000000000006'
	);

insert into public.project_memberships (tenant_id, project_id, user_id, role)
values
	(
		'31000000-0000-0000-0000-000000000001',
		'31000000-0000-0000-0000-000000000101',
		'30000000-0000-0000-0000-000000000001',
		'EDITOR'
	),
	(
		'31000000-0000-0000-0000-000000000001',
		'31000000-0000-0000-0000-000000000101',
		'30000000-0000-0000-0000-000000000002',
		'VIEWER'
	),
	(
		'31000000-0000-0000-0000-000000000001',
		'31000000-0000-0000-0000-000000000101',
		'30000000-0000-0000-0000-000000000003',
		'REVIEWER'
	),
	(
		'32000000-0000-0000-0000-000000000001',
		'32000000-0000-0000-0000-000000000101',
		'30000000-0000-0000-0000-000000000005',
		'EDITOR'
	);

select throws_ok(
	$$
		insert into public.documents (
			id, tenant_id, project_id, privacy_classification, original_filename,
			media_type, byte_size, storage_path, sha256, created_by
		)
		values (
			'33000000-0000-0000-0000-000000000001',
			'31000000-0000-0000-0000-000000000001',
			null,
			'INTERNAL',
			'missing-project.synthetic.txt',
			'text/plain',
			10,
			'missing-project',
			repeat('1', 64),
			'30000000-0000-0000-0000-000000000001'
		)
	$$,
	'23502',
	'null value in column "project_id" of relation "documents" violates not-null constraint',
	'document project_id is required at write time'
);

select throws_ok(
	$$
		insert into public.documents (
			id, tenant_id, project_id, privacy_classification, original_filename,
			media_type, byte_size, storage_path, sha256, created_by
		)
		values (
			'33000000-0000-0000-0000-000000000002',
			'31000000-0000-0000-0000-000000000001',
			'31000000-0000-0000-0000-000000000101',
			'INTERNAL',
			'missing-sha.synthetic.txt',
			'text/plain',
			10,
			'31000000-0000-0000-0000-000000000101/33000000-0000-0000-0000-000000000002/original',
			null,
			'30000000-0000-0000-0000-000000000001'
		)
	$$,
	'23502',
	'null value in column "sha256" of relation "documents" violates not-null constraint',
	'document sha256 is required at write time'
);

select throws_ok(
	$$
		insert into public.documents (
			id, tenant_id, project_id, privacy_classification, original_filename,
			media_type, byte_size, storage_path, sha256, created_by
		)
		values (
			'33000000-0000-0000-0000-000000000003',
			'31000000-0000-0000-0000-000000000001',
			'31000000-0000-0000-0000-000000000101',
			'INTERNAL',
			'invalid-sha.synthetic.txt',
			'text/plain',
			10,
			'31000000-0000-0000-0000-000000000101/33000000-0000-0000-0000-000000000003/original',
			'not-a-sha256',
			'30000000-0000-0000-0000-000000000001'
		)
	$$,
	'23514',
	'new row for relation "documents" violates check constraint "documents_sha256_check"',
	'document sha256 must be lowercase 64-hex'
);

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
set local role authenticated;

select lives_ok(
	$$
		insert into public.documents (
			id, tenant_id, project_id, privacy_classification, original_filename,
			media_type, byte_size, storage_path, sha256, created_by
		)
		values (
			'33000000-0000-0000-0000-000000000101',
			'31000000-0000-0000-0000-000000000001',
			'31000000-0000-0000-0000-000000000101',
			'INTERNAL',
			'editor-a.synthetic.txt',
			'text/plain',
			20,
			'31000000-0000-0000-0000-000000000101/33000000-0000-0000-0000-000000000101/original',
			repeat('a', 64),
			'30000000-0000-0000-0000-000000000001'
		)
	$$,
	'assigned project editor can register RFP metadata'
);

select is(
	(select count(*)::integer from public.documents),
	1,
	'editor reads the registered document in the assigned project'
);
select is(
	(select count(*)::integer from public.documents where project_id = '32000000-0000-0000-0000-000000000101'),
	0,
	'editor reads zero documents from another project'
);

select throws_ok(
	$$
		insert into public.documents (
			id, tenant_id, project_id, privacy_classification, original_filename,
			media_type, byte_size, storage_path, sha256, created_by
		)
		values (
			'33000000-0000-0000-0000-000000000102',
			'32000000-0000-0000-0000-000000000001',
			'32000000-0000-0000-0000-000000000101',
			'INTERNAL',
			'cross-project.synthetic.txt',
			'text/plain',
			20,
			'32000000-0000-0000-0000-000000000101/33000000-0000-0000-0000-000000000102/original',
			repeat('b', 64),
			'30000000-0000-0000-0000-000000000001'
		)
	$$,
	'42501',
	'new row violates row-level security policy for table "documents"',
	'editor cannot register metadata in another project'
);

select throws_ok(
	$$
		insert into public.documents (
			id, tenant_id, project_id, privacy_classification, original_filename,
			media_type, byte_size, storage_path, sha256, created_by
		)
		values (
			'33000000-0000-0000-0000-000000000103',
			'31000000-0000-0000-0000-000000000001',
			'31000000-0000-0000-0000-000000000101',
			'INTERNAL',
			'spoofed-actor.synthetic.txt',
			'text/plain',
			20,
			'31000000-0000-0000-0000-000000000101/33000000-0000-0000-0000-000000000103/original',
			repeat('c', 64),
			'30000000-0000-0000-0000-000000000002'
		)
	$$,
	'42501',
	'new row violates row-level security policy for table "documents"',
	'editor cannot spoof the document creator'
);

reset role;
select is(
	(
		select count(*)::integer
		from public.audit_events
		where event_type = 'RFP_ORIGINAL_UPLOADED'
			and entity_id = '33000000-0000-0000-0000-000000000101'
	),
	1,
	'one immutable upload audit event is derived from the document row'
);

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select is((select count(*)::integer from public.documents), 1, 'viewer can read assigned project documents');
select throws_ok(
	$$
		insert into public.documents (
			id, tenant_id, project_id, privacy_classification, original_filename,
			media_type, byte_size, storage_path, sha256, created_by
		)
		values (
			'33000000-0000-0000-0000-000000000201',
			'31000000-0000-0000-0000-000000000001',
			'31000000-0000-0000-0000-000000000101',
			'INTERNAL', 'viewer.synthetic.txt', 'text/plain', 20,
			'31000000-0000-0000-0000-000000000101/33000000-0000-0000-0000-000000000201/original',
			repeat('d', 64), '30000000-0000-0000-0000-000000000002'
		)
	$$,
	'42501',
	'new row violates row-level security policy for table "documents"',
	'viewer cannot register document metadata'
);

reset role;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select is((select count(*)::integer from public.documents), 1, 'reviewer can read assigned project documents');
select throws_ok(
	$$
		insert into public.documents (
			id, tenant_id, project_id, privacy_classification, original_filename,
			media_type, byte_size, storage_path, sha256, created_by
		)
		values (
			'33000000-0000-0000-0000-000000000301',
			'31000000-0000-0000-0000-000000000001',
			'31000000-0000-0000-0000-000000000101',
			'INTERNAL', 'reviewer.synthetic.txt', 'text/plain', 20,
			'31000000-0000-0000-0000-000000000101/33000000-0000-0000-0000-000000000301/original',
			repeat('e', 64), '30000000-0000-0000-0000-000000000003'
		)
	$$,
	'42501',
	'new row violates row-level security policy for table "documents"',
	'reviewer cannot register document metadata'
);

reset role;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select is((select count(*)::integer from public.documents), 1, 'tenant admin reads documents in their tenant');
select lives_ok(
	$$
		insert into public.documents (
			id, tenant_id, project_id, privacy_classification, original_filename,
			media_type, byte_size, storage_path, sha256, created_by
		)
		values (
			'33000000-0000-0000-0000-000000000401',
			'31000000-0000-0000-0000-000000000001',
			'31000000-0000-0000-0000-000000000101',
			'RESTRICTED', 'tenant-admin.synthetic.txt', 'text/plain', 20,
			'31000000-0000-0000-0000-000000000101/33000000-0000-0000-0000-000000000401/original',
			repeat('f', 64), '30000000-0000-0000-0000-000000000004'
		)
	$$,
	'tenant admin can register metadata inside their tenant'
);
select throws_ok(
	$$
		insert into public.documents (
			id, tenant_id, project_id, privacy_classification, original_filename,
			media_type, byte_size, storage_path, sha256, created_by
		)
		values (
			'33000000-0000-0000-0000-000000000402',
			'32000000-0000-0000-0000-000000000001',
			'32000000-0000-0000-0000-000000000101',
			'RESTRICTED', 'tenant-admin-cross.synthetic.txt', 'text/plain', 20,
			'32000000-0000-0000-0000-000000000101/33000000-0000-0000-0000-000000000402/original',
			repeat('0', 64), '30000000-0000-0000-0000-000000000004'
		)
	$$,
	'42501',
	'new row violates row-level security policy for table "documents"',
	'tenant admin cannot register metadata in another tenant'
);

reset role;
select is(
	(select count(*)::integer from public.audit_events where event_type = 'RFP_ORIGINAL_UPLOADED'),
	2,
	'each successful document registration creates exactly one audit event'
);

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select throws_ok(
	$$update public.documents set sha256 = repeat('9', 64) where id = '33000000-0000-0000-0000-000000000101'$$,
	'42501',
	'permission denied for table documents',
	'authenticated user cannot overwrite original metadata'
);
select throws_ok(
	$$delete from public.documents where id = '33000000-0000-0000-0000-000000000101'$$,
	'42501',
	'permission denied for table documents',
	'authenticated user cannot delete original metadata'
);

reset role;
select is(
	(select sha256 from public.documents where id = '33000000-0000-0000-0000-000000000101'),
	repeat('a', 64),
	'original SHA-256 remains unchanged after mutation attempts'
);

select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select throws_ok(
	'select id from public.documents',
	'42501',
	'permission denied for table documents',
	'anonymous user cannot read document metadata'
);

reset role;
select * from finish();
rollback;
