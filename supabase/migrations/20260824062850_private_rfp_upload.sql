create type public.privacy_classification as enum (
	'PUBLIC',
	'INTERNAL',
	'PERSONAL',
	'SENSITIVE',
	'RESTRICTED'
);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.documents (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	document_kind text not null default 'RFP',
	privacy_classification public.privacy_classification not null,
	original_filename text not null,
	media_type text not null,
	byte_size bigint not null,
	storage_bucket text not null default 'rfp-originals',
	storage_path text not null,
	sha256 text not null,
	created_by uuid not null,
	created_at timestamptz not null default now(),
	constraint documents_tenant_project_fkey
		foreign key (tenant_id, project_id)
		references public.projects(tenant_id, id)
		on delete restrict,
	constraint documents_created_by_fkey
		foreign key (created_by) references auth.users(id) on delete restrict,
	constraint documents_document_kind_check check (document_kind = 'RFP'),
	constraint documents_original_filename_not_blank
		check (length(btrim(original_filename)) between 1 and 255),
	constraint documents_media_type_not_blank
		check (length(btrim(media_type)) between 1 and 255),
	constraint documents_byte_size_check check (byte_size between 1 and 6291456),
	constraint documents_storage_bucket_check check (storage_bucket = 'rfp-originals'),
	constraint documents_storage_path_check
		check (storage_path = project_id::text || '/' || id::text || '/original'),
	constraint documents_sha256_check check (sha256 ~ '^[0-9a-f]{64}$'),
	constraint documents_storage_object_key unique (storage_bucket, storage_path)
);

create table public.audit_events (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	actor_user_id uuid not null,
	event_type text not null,
	entity_type text not null,
	entity_id uuid not null,
	event_data jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default now(),
	constraint audit_events_tenant_project_fkey
		foreign key (tenant_id, project_id)
		references public.projects(tenant_id, id)
		on delete restrict,
	constraint audit_events_actor_user_id_fkey
		foreign key (actor_user_id) references auth.users(id) on delete restrict,
	constraint audit_events_event_type_not_blank check (length(btrim(event_type)) > 0),
	constraint audit_events_entity_type_not_blank check (length(btrim(entity_type)) > 0),
	constraint audit_events_event_data_object_check check (jsonb_typeof(event_data) = 'object')
);

create index documents_project_created_at_idx
	on public.documents (project_id, created_at desc, id);

create index audit_events_project_created_at_idx
	on public.audit_events (project_id, created_at desc, id);

alter table public.documents enable row level security;
alter table public.audit_events enable row level security;

revoke all privileges on table public.documents from anon, authenticated, service_role;
revoke all privileges on table public.audit_events from anon, authenticated, service_role;

grant select, insert on table public.documents to authenticated;

grant select, insert, update, delete on table public.documents to service_role;
grant select, insert, update, delete on table public.audit_events to service_role;

create function private.log_rfp_original_upload()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	insert into public.audit_events (
		tenant_id,
		project_id,
		actor_user_id,
		event_type,
		entity_type,
		entity_id,
		event_data
	)
	values (
		new.tenant_id,
		new.project_id,
		new.created_by,
		'RFP_ORIGINAL_UPLOADED',
		'DOCUMENT',
		new.id,
		jsonb_build_object(
			'document_kind', new.document_kind,
			'privacy_classification', new.privacy_classification::text,
			'sha256', new.sha256
		)
	);

	return new;
end;
$$;

revoke all on function private.log_rfp_original_upload() from public, anon, authenticated;

create trigger documents_log_rfp_original_upload
after insert on public.documents
for each row execute function private.log_rfp_original_upload();

insert into storage.buckets (
	id,
	name,
	public,
	file_size_limit,
	allowed_mime_types
)
values (
	'rfp-originals',
	'rfp-originals',
	false,
	6291456,
	null
)
on conflict (id) do update
set name = excluded.name,
	public = excluded.public,
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;
