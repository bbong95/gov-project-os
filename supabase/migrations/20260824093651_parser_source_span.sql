alter table public.documents
	add constraint documents_tenant_project_id_sha256_key
	unique (tenant_id, project_id, id, sha256);

create function private.is_valid_source_location(value jsonb)
returns boolean
language sql
immutable
strict
parallel safe
security invoker
set search_path = ''
as $$
	select case
		when jsonb_typeof(value) <> 'object' then false
		when value ->> 'kind' = 'TEXT_LINES' then
			value ?& array['kind', 'lineStart', 'lineEnd']
			and value - array['kind', 'lineStart', 'lineEnd'] = '{}'::jsonb
			and jsonb_typeof(value -> 'lineStart') = 'number'
			and (value ->> 'lineStart') ~ '^[1-9][0-9]*$'
			and jsonb_typeof(value -> 'lineEnd') = 'number'
			and (value ->> 'lineEnd') ~ '^[1-9][0-9]*$'
			and (value -> 'lineEnd') >= (value -> 'lineStart')
		when value ->> 'kind' = 'PAGE' then
			value ?& array['kind', 'pageNumber', 'pageMode']
			and value - array['kind', 'pageNumber', 'blockIndex', 'pageMode'] = '{}'::jsonb
			and jsonb_typeof(value -> 'pageNumber') = 'number'
			and (value ->> 'pageNumber') ~ '^[1-9][0-9]*$'
			and value ->> 'pageMode' in ('LAYOUT', 'SECTION_APPROXIMATE')
			and (
				not value ? 'blockIndex'
				or (
					jsonb_typeof(value -> 'blockIndex') = 'number'
					and (value ->> 'blockIndex') ~ '^[1-9][0-9]*$'
				)
			)
		when value ->> 'kind' = 'SHEET' then
			value ?& array['kind', 'sheetIndex']
			and value - array['kind', 'sheetIndex', 'sheetName', 'cellRange'] = '{}'::jsonb
			and jsonb_typeof(value -> 'sheetIndex') = 'number'
			and (value ->> 'sheetIndex') ~ '^[1-9][0-9]*$'
			and (
				not value ? 'sheetName'
				or (
					jsonb_typeof(value -> 'sheetName') = 'string'
					and length(btrim(value ->> 'sheetName')) > 0
				)
			)
			and (
				not value ? 'cellRange'
				or (
					jsonb_typeof(value -> 'cellRange') = 'string'
					and (value ->> 'cellRange')
						~ '^[A-Z]{1,3}[1-9][0-9]*(:[A-Z]{1,3}[1-9][0-9]*)?$'
				)
			)
		when value ->> 'kind' = 'SECTION' then
			value ?& array['kind', 'sectionIndex']
			and value - array['kind', 'sectionIndex', 'label', 'blockIndex'] = '{}'::jsonb
			and jsonb_typeof(value -> 'sectionIndex') = 'number'
			and (value ->> 'sectionIndex') ~ '^[1-9][0-9]*$'
			and (
				not value ? 'label'
				or (
					jsonb_typeof(value -> 'label') = 'string'
					and length(btrim(value ->> 'label')) > 0
				)
			)
			and (
				not value ? 'blockIndex'
				or (
					jsonb_typeof(value -> 'blockIndex') = 'number'
					and (value ->> 'blockIndex') ~ '^[1-9][0-9]*$'
				)
			)
		else false
	end;
$$;

create function private.source_text_sha256(value text)
returns text
language sql
immutable
strict
parallel safe
security invoker
set search_path = ''
as $$
	select encode(extensions.digest(convert_to(value, 'UTF8'), 'sha256'), 'hex');
$$;

revoke all on function private.is_valid_source_location(jsonb)
	from public, anon, authenticated, service_role;
revoke all on function private.source_text_sha256(text)
	from public, anon, authenticated, service_role;

create table public.document_parses (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	document_id uuid not null,
	source_sha256 text not null,
	parser_key text not null,
	parser_version text not null,
	normalization_version text not null,
	detected_format text not null,
	warnings jsonb not null default '[]'::jsonb,
	span_count integer not null,
	result_sha256 text not null,
	created_by uuid not null,
	created_at timestamptz not null default now(),
	constraint document_parses_document_source_fkey
		foreign key (tenant_id, project_id, document_id, source_sha256)
		references public.documents(tenant_id, project_id, id, sha256)
		on delete restrict,
	constraint document_parses_created_by_fkey
		foreign key (created_by) references auth.users(id) on delete restrict,
	constraint document_parses_source_sha256_check
		check (source_sha256 ~ '^[0-9a-f]{64}$'),
	constraint document_parses_parser_key_not_blank
		check (length(btrim(parser_key)) > 0),
	constraint document_parses_parser_version_not_blank
		check (length(btrim(parser_version)) > 0),
	constraint document_parses_normalization_version_not_blank
		check (length(btrim(normalization_version)) > 0),
	constraint document_parses_detected_format_check
		check (detected_format in ('txt', 'hwp', 'hwpx', 'pdf', 'xlsx', 'docx')),
	constraint document_parses_warnings_array_check
		check (jsonb_typeof(warnings) = 'array'),
	constraint document_parses_span_count_check
		check (span_count between 1 and 20000),
	constraint document_parses_result_sha256_check
		check (result_sha256 ~ '^[0-9a-f]{64}$'),
	constraint document_parses_immutable_identity_key
		unique (document_id, source_sha256, parser_key, parser_version, normalization_version),
	constraint document_parses_scope_key
		unique (tenant_id, project_id, document_id, id)
);

create table public.source_spans (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null,
	project_id uuid not null,
	document_id uuid not null,
	document_parse_id uuid not null,
	ordinal integer not null,
	location jsonb not null,
	original_text text not null,
	normalized_text text not null,
	original_text_sha256 text not null,
	created_at timestamptz not null default now(),
	constraint source_spans_document_parse_fkey
		foreign key (tenant_id, project_id, document_id, document_parse_id)
		references public.document_parses(tenant_id, project_id, document_id, id)
		on delete restrict,
	constraint source_spans_ordinal_check
		check (ordinal between 1 and 20000),
	constraint source_spans_location_check
		check (private.is_valid_source_location(location)),
	constraint source_spans_original_text_not_blank
		check (original_text ~ '[^[:space:]]'),
	constraint source_spans_normalized_text_not_blank
		check (normalized_text ~ '[^[:space:]]'),
	constraint source_spans_original_text_size_check
		check (octet_length(original_text) between 1 and 262144),
	constraint source_spans_normalized_text_size_check
		check (octet_length(normalized_text) between 1 and 262144),
	constraint source_spans_original_text_sha256_check
		check (original_text_sha256 ~ '^[0-9a-f]{64}$'),
	constraint source_spans_original_text_sha256_matches
		check (original_text_sha256 = private.source_text_sha256(original_text)),
	constraint source_spans_parse_ordinal_key
		unique (document_parse_id, ordinal)
);

create index document_parses_project_created_at_idx
	on public.document_parses (project_id, created_at desc, id);

create index source_spans_project_parse_ordinal_idx
	on public.source_spans (project_id, document_parse_id, ordinal);

alter table public.document_parses enable row level security;
alter table public.source_spans enable row level security;

revoke all privileges on table public.document_parses from anon, authenticated, service_role;
revoke all privileges on table public.source_spans from anon, authenticated, service_role;

grant select on table public.document_parses to authenticated;
grant select on table public.source_spans to authenticated;

grant select, insert, update, delete on table public.document_parses to service_role;
grant select, insert, update, delete on table public.source_spans to service_role;
