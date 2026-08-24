create type public.membership_role as enum (
	'VIEWER',
	'EDITOR',
	'REVIEWER',
	'PROJECT_ADMIN',
	'TENANT_ADMIN'
);

create table public.tenants (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	created_by uuid not null,
	created_at timestamptz not null default now(),
	constraint tenants_name_not_blank check (length(btrim(name)) > 0),
	constraint tenants_created_by_fkey
		foreign key (created_by) references auth.users(id) on delete restrict
);

create table public.tenant_memberships (
	tenant_id uuid not null,
	user_id uuid not null,
	role public.membership_role not null,
	created_at timestamptz not null default now(),
	constraint tenant_memberships_pkey primary key (tenant_id, user_id),
	constraint tenant_memberships_tenant_id_fkey
		foreign key (tenant_id) references public.tenants(id) on delete cascade,
	constraint tenant_memberships_user_id_fkey
		foreign key (user_id) references auth.users(id) on delete cascade,
	constraint tenant_memberships_role_check
		check (role = 'TENANT_ADMIN'::public.membership_role)
);

create table public.projects (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	name text not null,
	created_by uuid not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint projects_name_not_blank check (length(btrim(name)) > 0),
	constraint projects_tenant_id_id_key unique (tenant_id, id),
	constraint projects_tenant_id_fkey
		foreign key (tenant_id) references public.tenants(id) on delete cascade,
	constraint projects_created_by_fkey
		foreign key (created_by) references auth.users(id) on delete restrict
);

create table public.project_memberships (
	tenant_id uuid not null,
	project_id uuid not null,
	user_id uuid not null,
	role public.membership_role not null,
	created_at timestamptz not null default now(),
	constraint project_memberships_pkey primary key (project_id, user_id),
	constraint project_memberships_tenant_project_fkey
		foreign key (tenant_id, project_id)
		references public.projects(tenant_id, id)
		on delete cascade,
	constraint project_memberships_user_id_fkey
		foreign key (user_id) references auth.users(id) on delete cascade,
	constraint project_memberships_role_check
		check (role <> 'TENANT_ADMIN'::public.membership_role)
);

create index tenants_created_by_idx
	on public.tenants (created_by);

create index tenant_memberships_user_id_idx
	on public.tenant_memberships (user_id, tenant_id);

create index projects_created_by_idx
	on public.projects (created_by);

create index project_memberships_tenant_project_idx
	on public.project_memberships (tenant_id, project_id);

create index project_memberships_user_id_idx
	on public.project_memberships (user_id, project_id);

alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.projects enable row level security;
alter table public.project_memberships enable row level security;

revoke all privileges on table public.tenants from anon, authenticated, service_role;
revoke all privileges on table public.tenant_memberships from anon, authenticated, service_role;
revoke all privileges on table public.projects from anon, authenticated, service_role;
revoke all privileges on table public.project_memberships from anon, authenticated, service_role;

grant select on table public.tenants to authenticated;
grant select on table public.tenant_memberships to authenticated;
grant select on table public.projects to authenticated;
grant update (name, updated_at) on table public.projects to authenticated;
grant select on table public.project_memberships to authenticated;

grant select, insert, update, delete on table public.tenants to service_role;
grant select, insert, update, delete on table public.tenant_memberships to service_role;
grant select, insert, update, delete on table public.projects to service_role;
grant select, insert, update, delete on table public.project_memberships to service_role;

alter default privileges for role postgres in schema public
	revoke select, insert, update, delete on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
	revoke usage, select on sequences from anon, authenticated, service_role;
create policy "tenant memberships visible to member"
on public.tenant_memberships
for select
to authenticated
using (
	(select auth.uid()) is not null
	and user_id = (select auth.uid())
);

create policy "project memberships visible to member or tenant admin"
on public.project_memberships
for select
to authenticated
using (
	(select auth.uid()) is not null
	and (
		user_id = (select auth.uid())
		or exists (
			select 1
			from public.tenant_memberships as tenant_membership
			where tenant_membership.tenant_id = project_memberships.tenant_id
				and tenant_membership.user_id = (select auth.uid())
				and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
		)
	)
);

create policy "tenants visible to project member or tenant admin"
on public.tenants
for select
to authenticated
using (
	(select auth.uid()) is not null
	and (
		exists (
			select 1
			from public.tenant_memberships as tenant_membership
			where tenant_membership.tenant_id = tenants.id
				and tenant_membership.user_id = (select auth.uid())
				and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
		)
		or exists (
			select 1
			from public.project_memberships as project_membership
			where project_membership.tenant_id = tenants.id
				and project_membership.user_id = (select auth.uid())
		)
	)
);

create policy "projects visible to project member or tenant admin"
on public.projects
for select
to authenticated
using (
	(select auth.uid()) is not null
	and (
		exists (
			select 1
			from public.project_memberships as project_membership
			where project_membership.tenant_id = projects.tenant_id
				and project_membership.project_id = projects.id
				and project_membership.user_id = (select auth.uid())
		)
		or exists (
			select 1
			from public.tenant_memberships as tenant_membership
			where tenant_membership.tenant_id = projects.tenant_id
				and tenant_membership.user_id = (select auth.uid())
				and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
		)
	)
);

create policy "projects mutable by project writer or tenant admin"
on public.projects
for update
to authenticated
using (
	(select auth.uid()) is not null
	and (
		exists (
			select 1
			from public.project_memberships as project_membership
			where project_membership.tenant_id = projects.tenant_id
				and project_membership.project_id = projects.id
				and project_membership.user_id = (select auth.uid())
				and project_membership.role in (
					'EDITOR'::public.membership_role,
					'PROJECT_ADMIN'::public.membership_role
				)
		)
		or exists (
			select 1
			from public.tenant_memberships as tenant_membership
			where tenant_membership.tenant_id = projects.tenant_id
				and tenant_membership.user_id = (select auth.uid())
				and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
		)
	)
)
with check (
	(select auth.uid()) is not null
	and (
		exists (
			select 1
			from public.project_memberships as project_membership
			where project_membership.tenant_id = projects.tenant_id
				and project_membership.project_id = projects.id
				and project_membership.user_id = (select auth.uid())
				and project_membership.role in (
					'EDITOR'::public.membership_role,
					'PROJECT_ADMIN'::public.membership_role
				)
		)
		or exists (
			select 1
			from public.tenant_memberships as tenant_membership
			where tenant_membership.tenant_id = projects.tenant_id
				and tenant_membership.user_id = (select auth.uid())
				and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
		)
	)
);
