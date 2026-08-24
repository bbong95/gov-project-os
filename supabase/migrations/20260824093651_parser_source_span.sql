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

create function private.canonical_source_location(value jsonb)
returns text
language sql
immutable
strict
parallel safe
security invoker
set search_path = ''
as $$
	select case
		when not private.is_valid_source_location(value) then null
		when value ->> 'kind' = 'TEXT_LINES' then
			'{"kind":' || to_jsonb(value ->> 'kind')::text
			|| ',"lineStart":' || (value ->> 'lineStart')
			|| ',"lineEnd":' || (value ->> 'lineEnd') || '}'
		when value ->> 'kind' = 'PAGE' then
			'{"kind":' || to_jsonb(value ->> 'kind')::text
			|| ',"pageNumber":' || (value ->> 'pageNumber')
			|| case when value ? 'blockIndex'
				then ',"blockIndex":' || (value ->> 'blockIndex') else '' end
			|| ',"pageMode":' || to_jsonb(value ->> 'pageMode')::text || '}'
		when value ->> 'kind' = 'SHEET' then
			'{"kind":' || to_jsonb(value ->> 'kind')::text
			|| ',"sheetIndex":' || (value ->> 'sheetIndex')
			|| case when value ? 'sheetName'
				then ',"sheetName":' || to_jsonb(value ->> 'sheetName')::text else '' end
			|| case when value ? 'cellRange'
				then ',"cellRange":' || to_jsonb(value ->> 'cellRange')::text else '' end
			|| '}'
		when value ->> 'kind' = 'SECTION' then
			'{"kind":' || to_jsonb(value ->> 'kind')::text
			|| ',"sectionIndex":' || (value ->> 'sectionIndex')
			|| case when value ? 'label'
				then ',"label":' || to_jsonb(value ->> 'label')::text else '' end
			|| case when value ? 'blockIndex'
				then ',"blockIndex":' || (value ->> 'blockIndex') else '' end
			|| '}'
		else null
	end;
$$;

create function private.document_parse_result_sha256(value jsonb)
returns text
language plpgsql
immutable
strict
parallel safe
security invoker
set search_path = ''
as $$
declare
	canonical_value text;
begin
	if jsonb_typeof(value) <> 'array' then
		return null;
	end if;

	if exists (
		select 1
		from jsonb_array_elements(value) with ordinality as item(element, position)
		where jsonb_typeof(element) <> 'object'
			or not (element ?& array['ordinal', 'location', 'originalText', 'normalizedText'])
			or element - array['ordinal', 'location', 'originalText', 'normalizedText'] <> '{}'::jsonb
			or jsonb_typeof(element -> 'ordinal') <> 'number'
			or element -> 'ordinal' <> to_jsonb(position)
			or not private.is_valid_source_location(element -> 'location')
			or jsonb_typeof(element -> 'originalText') <> 'string'
			or jsonb_typeof(element -> 'normalizedText') <> 'string'
	) then
		return null;
	end if;

	select '[' || coalesce(
		string_agg(
			'{"ordinal":' || (element ->> 'ordinal')
			|| ',"location":' || private.canonical_source_location(element -> 'location')
			|| ',"originalTextSha256":'
			|| to_jsonb(private.source_text_sha256(element ->> 'originalText'))::text
			|| ',"normalizedText":' || to_jsonb(element ->> 'normalizedText')::text
			|| '}',
			',' order by position
		),
		''
	) || ']'
	into canonical_value
	from jsonb_array_elements(value) with ordinality as item(element, position);

	return encode(
		extensions.digest(convert_to(canonical_value, 'UTF8'), 'sha256'),
		'hex'
	);
end;
$$;

revoke all on function private.canonical_source_location(jsonb)
	from public, anon, authenticated, service_role;
revoke all on function private.document_parse_result_sha256(jsonb)
	from public, anon, authenticated, service_role;

create policy "document parses visible to project member or tenant admin"
on public.document_parses
for select
to authenticated
using (
	(select auth.uid()) is not null
	and (
		exists (
			select 1
			from public.project_memberships as project_membership
			where project_membership.tenant_id = document_parses.tenant_id
				and project_membership.project_id = document_parses.project_id
				and project_membership.user_id = (select auth.uid())
		)
		or exists (
			select 1
			from public.tenant_memberships as tenant_membership
			where tenant_membership.tenant_id = document_parses.tenant_id
				and tenant_membership.user_id = (select auth.uid())
				and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
		)
	)
);

create policy "source spans visible to project member or tenant admin"
on public.source_spans
for select
to authenticated
using (
	(select auth.uid()) is not null
	and (
		exists (
			select 1
			from public.project_memberships as project_membership
			where project_membership.tenant_id = source_spans.tenant_id
				and project_membership.project_id = source_spans.project_id
				and project_membership.user_id = (select auth.uid())
		)
		or exists (
			select 1
			from public.tenant_memberships as tenant_membership
			where tenant_membership.tenant_id = source_spans.tenant_id
				and tenant_membership.user_id = (select auth.uid())
				and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
		)
	)
);

create function public.persist_document_parse(
	target_actor_user_id uuid,
	target_document_id uuid,
	target_source_sha256 text,
	target_parser_key text,
	target_parser_version text,
	target_normalization_version text,
	target_detected_format text,
	target_warnings jsonb,
	target_result_sha256 text,
	target_spans jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	actor_id uuid := target_actor_user_id;
	document_tenant_id uuid;
	document_project_id uuid;
	parse_id uuid;
	existing_parse record;
	span_value jsonb;
	warning_value jsonb;
	span_position bigint := 0;
	total_original_bytes bigint := 0;
	total_normalized_bytes bigint := 0;
	original_bytes integer;
	normalized_bytes integer;
	computed_result_sha256 text;
begin
	select document.tenant_id, document.project_id
	into document_tenant_id, document_project_id
	from public.documents as document
	where document.id = target_document_id
		and document.sha256 = target_source_sha256
		and (
			exists (
				select 1
				from public.project_memberships as project_membership
				where project_membership.tenant_id = document.tenant_id
					and project_membership.project_id = document.project_id
					and project_membership.user_id = actor_id
					and project_membership.role in (
						'EDITOR'::public.membership_role,
						'PROJECT_ADMIN'::public.membership_role
					)
			)
			or exists (
				select 1
				from public.tenant_memberships as tenant_membership
				where tenant_membership.tenant_id = document.tenant_id
					and tenant_membership.user_id = actor_id
					and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
			)
		)
	for key share of document;

	if actor_id is null or document_tenant_id is null then
		raise exception using errcode = '42501', message = 'DOCUMENT_PARSE_UNAVAILABLE';
	end if;

	if jsonb_typeof(target_warnings) is distinct from 'array'
		or jsonb_typeof(target_spans) is distinct from 'array'
	then
		raise exception using errcode = '22023', message = 'PARSE_PAYLOAD_INVALID';
	end if;

	if jsonb_array_length(target_warnings) > 20000
		or jsonb_array_length(target_spans) > 20000
	then
		raise exception using errcode = '22023', message = 'PARSE_PAYLOAD_LIMIT_EXCEEDED';
	end if;

	if target_parser_key is null
		or length(target_parser_key) not between 1 and 128
		or target_parser_key <> btrim(target_parser_key)
		or target_parser_version is null
		or length(target_parser_version) not between 1 and 128
		or target_parser_version <> btrim(target_parser_version)
		or target_normalization_version is null
		or length(target_normalization_version) not between 1 and 128
		or target_normalization_version <> btrim(target_normalization_version)
		or target_detected_format is null
		or target_detected_format not in ('txt', 'hwp', 'hwpx', 'pdf', 'xlsx', 'docx')
		or jsonb_array_length(target_spans) = 0
	then
		raise exception using errcode = '22023', message = 'PARSE_PAYLOAD_INVALID';
	end if;

	for warning_value in
		select value from jsonb_array_elements(target_warnings)
	loop
		if jsonb_typeof(warning_value) <> 'object'
			or not (warning_value ? 'code')
			or warning_value - array['code', 'location'] <> '{}'::jsonb
			or jsonb_typeof(warning_value -> 'code') <> 'string'
			or length(btrim(warning_value ->> 'code')) not between 1 and 128
			or (
				warning_value ? 'location'
				and not private.is_valid_source_location(warning_value -> 'location')
			)
		then
			raise exception using errcode = '22023', message = 'PARSE_PAYLOAD_INVALID';
		end if;
	end loop;

	for span_value in
		select value from jsonb_array_elements(target_spans)
	loop
		span_position := span_position + 1;
		if jsonb_typeof(span_value) <> 'object'
			or not (span_value ?& array['ordinal', 'location', 'originalText', 'normalizedText'])
			or span_value - array['ordinal', 'location', 'originalText', 'normalizedText'] <> '{}'::jsonb
			or jsonb_typeof(span_value -> 'ordinal') <> 'number'
			or span_value -> 'ordinal' <> to_jsonb(span_position)
			or not private.is_valid_source_location(span_value -> 'location')
			or jsonb_typeof(span_value -> 'originalText') <> 'string'
			or jsonb_typeof(span_value -> 'normalizedText') <> 'string'
			or not ((span_value ->> 'originalText') ~ '[^[:space:]]')
			or not ((span_value ->> 'normalizedText') ~ '[^[:space:]]')
		then
			raise exception using errcode = '22023', message = 'PARSE_PAYLOAD_INVALID';
		end if;

		original_bytes := octet_length(span_value ->> 'originalText');
		normalized_bytes := octet_length(span_value ->> 'normalizedText');
		if original_bytes > 262144 or normalized_bytes > 262144 then
			raise exception using errcode = '22023', message = 'PARSE_PAYLOAD_LIMIT_EXCEEDED';
		end if;

		total_original_bytes := total_original_bytes + original_bytes;
		total_normalized_bytes := total_normalized_bytes + normalized_bytes;
		if total_original_bytes > 16777216 or total_normalized_bytes > 16777216 then
			raise exception using errcode = '22023', message = 'PARSE_PAYLOAD_LIMIT_EXCEEDED';
		end if;
	end loop;

	computed_result_sha256 := private.document_parse_result_sha256(target_spans);
	if target_result_sha256 !~ '^[0-9a-f]{64}$'
		or target_result_sha256 is distinct from computed_result_sha256
	then
		raise exception using errcode = '22023', message = 'PARSE_RESULT_HASH_MISMATCH';
	end if;

	insert into public.document_parses (
		tenant_id, project_id, document_id, source_sha256, parser_key, parser_version,
		normalization_version, detected_format, warnings, span_count, result_sha256, created_by
	)
	values (
		document_tenant_id, document_project_id, target_document_id, target_source_sha256,
		target_parser_key, target_parser_version, target_normalization_version,
		target_detected_format, target_warnings, span_position::integer,
		target_result_sha256, actor_id
	)
	on conflict on constraint document_parses_immutable_identity_key do nothing
	returning id into parse_id;

	if parse_id is null then
		select parse.id, parse.detected_format, parse.warnings, parse.span_count, parse.result_sha256
		into existing_parse
		from public.document_parses as parse
		where parse.document_id = target_document_id
			and parse.source_sha256 = target_source_sha256
			and parse.parser_key = target_parser_key
			and parse.parser_version = target_parser_version
			and parse.normalization_version = target_normalization_version;

		if found
			and existing_parse.detected_format = target_detected_format
			and existing_parse.warnings = target_warnings
			and existing_parse.span_count = span_position
			and existing_parse.result_sha256 = target_result_sha256
		then
			return existing_parse.id;
		end if;

		raise exception using errcode = '23505', message = 'PARSE_IDEMPOTENCY_CONFLICT';
	end if;

	for span_value in
		select value
		from jsonb_array_elements(target_spans)
		order by (value ->> 'ordinal')::integer
	loop
		insert into public.source_spans (
			tenant_id, project_id, document_id, document_parse_id, ordinal,
			location, original_text, normalized_text, original_text_sha256
		)
		values (
			document_tenant_id, document_project_id, target_document_id, parse_id,
			(span_value ->> 'ordinal')::integer,
			span_value -> 'location',
			span_value ->> 'originalText',
			span_value ->> 'normalizedText',
			private.source_text_sha256(span_value ->> 'originalText')
		);
	end loop;

	insert into public.audit_events (
		tenant_id, project_id, actor_user_id, event_type, entity_type, entity_id, event_data
	)
	values (
		document_tenant_id,
		document_project_id,
		actor_id,
		'DOCUMENT_PARSED',
		'DOCUMENT_PARSE',
		parse_id,
		jsonb_build_object(
			'document_id', target_document_id,
			'source_sha256', target_source_sha256,
			'parser_key', target_parser_key,
			'parser_version', target_parser_version,
			'normalization_version', target_normalization_version,
			'detected_format', target_detected_format,
			'warning_count', jsonb_array_length(target_warnings),
			'span_count', span_position,
			'result_sha256', target_result_sha256
		)
	);

	return parse_id;
end;
$$;

revoke all on function public.persist_document_parse(
	uuid, uuid, text, text, text, text, text, jsonb, text, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.persist_document_parse(
	uuid, uuid, text, text, text, text, text, jsonb, text, jsonb
) to service_role;
