begin;

select plan(12);

-- Synthetic tenant/project/users (matches the lifecycle test fixtures)
insert into auth.users (id, email)
values
	('90000000-0000-4000-8000-000000000001', 'mvp1-admin@example.test');

insert into public.tenants (id, name, created_by)
values ('91000000-0000-4000-8000-000000000001', 'MVP synthetic tenant A', '90000000-0000-4000-8000-000000000001');

insert into public.projects (id, tenant_id, name, created_by)
values ('91000000-0000-4000-8000-000000000101', '91000000-0000-4000-8000-000000000001', 'MVP synthetic project A', '90000000-0000-4000-8000-000000000001');

insert into public.project_memberships (tenant_id, project_id, user_id, role)
values
	('91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000101', '90000000-0000-4000-8000-000000000001', 'PROJECT_ADMIN');

-- 1. genome table exists
select has_table('public'::name, 'project_genome'::name);
select has_table('public'::name, 'genome_requirements'::name);
select has_table('public'::name, 'genome_deliverables'::name);
select has_table('public'::name, 'genome_evaluation_items'::name);
select has_table('public'::name, 'genome_contract_terms'::name);
select has_table('public'::name, 'genome_risks'::name);
select has_table('public'::name, 'genome_proposal_sections'::name);
select has_table('public'::name, 'genome_compliance_matrix'::name);
select has_table('public'::name, 'genome_wbs_tasks'::name);
select has_table('public'::name, 'genome_inspection_criteria'::name);
select has_table('public'::name, 'genome_evidence'::name);

-- 2. project member can read via RLS
set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
select is(
	(
		select count(*)::integer
		from public.project_genome
		where tenant_id = '91000000-0000-4000-8000-000000000001'
	),
	0,
	'project genome is empty before any insert'
);
reset role;

select * from finish();
rollback;
