alter table public.requirement_candidates
	add column reviewed_by uuid references auth.users (id) on delete restrict;
alter table public.requirement_candidates
	add column reviewed_at timestamptz;

alter table public.requirement_candidates
	drop constraint requirement_candidates_provenance_state_check;
alter table public.requirement_candidates
	add constraint requirement_candidates_provenance_state_check
	check (
		provenance_state in (
			'AI_DRAFT',
			'SOURCE_VERIFIED',
			'HUMAN_VERIFIED',
			'REVIEW_REQUIRED',
			'REJECTED'
		)
	);

grant update on table public.requirement_candidates to service_role;
grant usage on schema private to service_role;
grant execute on function private.source_text_sha256(text) to service_role;

create function public.review_requirement_candidate(	p_actor_id uuid,
	p_run_id uuid,
	p_candidate_id uuid,
	p_action text,
	p_new_interpretation text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_tenant_id uuid;
	v_project_id uuid;
	v_state public.requirement_candidates.provenance_state%type;
	v_new_state text;
	v_interpretation text;
begin
	if p_actor_id is null then
		raise exception using
			errcode = '42501',
			message = 'REQUIREMENT_REVIEW_UNAVAILABLE';
	end if;

	if p_action not in ('SOURCE_VERIFIED', 'APPROVE', 'NEEDS_REVIEW', 'REJECT', 'EDIT') then
		raise exception using
			errcode = '22023',
			message = 'REQUIREMENT_REVIEW_ACTION_INVALID';
	end if;

	if p_action = 'EDIT' then
		if p_new_interpretation is null
			or not (p_new_interpretation ~ '[^[:space:]]')
			or length(p_new_interpretation) <> length(btrim(p_new_interpretation))
			or octet_length(p_new_interpretation) > 8192
		then
			raise exception using
				errcode = '22023',
				message = 'REQUIREMENT_REVIEW_EDIT_INVALID';
		end if;
	elsif p_new_interpretation is not null then
		raise exception using
			errcode = '22023',
			message = 'REQUIREMENT_REVIEW_ACTION_INVALID';
	end if;

	select
		candidate.tenant_id,
		candidate.project_id,
		candidate.provenance_state
	into
		v_tenant_id,
		v_project_id,
		v_state
	from public.requirement_candidates as candidate
	join public.requirement_extraction_runs as run
		on run.tenant_id = candidate.tenant_id
		and run.project_id = candidate.project_id
		and run.id = p_run_id
		and run.document_parse_id = candidate.document_parse_id
	where candidate.id = p_candidate_id
		and (
			exists (
				select 1
				from public.project_memberships as project_membership
				where project_membership.tenant_id = candidate.tenant_id
					and project_membership.project_id = candidate.project_id
					and project_membership.user_id = p_actor_id
					and project_membership.role in (
						'EDITOR'::public.membership_role,
						'PROJECT_ADMIN'::public.membership_role
					)
			)
			or exists (
				select 1
				from public.tenant_memberships as tenant_membership
				where tenant_membership.tenant_id = candidate.tenant_id
					and tenant_membership.user_id = p_actor_id
					and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
			)
		)
	for update of candidate;

	if v_tenant_id is null then
		raise exception using
			errcode = '42501',
			message = 'REQUIREMENT_REVIEW_UNAVAILABLE';
	end if;

	if v_state = 'REJECTED' then
		raise exception using
			errcode = '42501',
			message = 'REQUIREMENT_REVIEW_FINAL';
	end if;

	v_new_state := case p_action
		when 'SOURCE_VERIFIED' then 'SOURCE_VERIFIED'
		when 'APPROVE' then 'HUMAN_VERIFIED'
		when 'EDIT' then 'HUMAN_VERIFIED'
		when 'NEEDS_REVIEW' then 'REVIEW_REQUIRED'
		when 'REJECT' then 'REJECTED'
	end;

	v_interpretation := coalesce(p_new_interpretation, (
		select candidate.interpretation
		from public.requirement_candidates as candidate
		where candidate.id = p_candidate_id
	));

	update public.requirement_candidates as candidate
	set
		provenance_state = v_new_state,
		interpretation = v_interpretation,
		reviewed_by = p_actor_id,
		reviewed_at = now()
	where candidate.id = p_candidate_id;

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
		v_tenant_id,
		v_project_id,
		p_actor_id,
		'REQUIREMENT_CANDIDATE_REVIEWED',
		'REQUIREMENT_CANDIDATE',
		p_candidate_id,
		jsonb_build_object(
			'action', p_action,
			'fromState', v_state,
			'toState', v_new_state,
			'runId', p_run_id
		)
	);

	return jsonb_build_object(
		'candidateId', p_candidate_id,
		'provenanceState', v_new_state
	);
end;
$$;

create function public.merge_requirement_candidates(
	p_actor_id uuid,
	p_run_id uuid,
	p_candidate_ids jsonb,
	p_interpretation text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_ids uuid[];
	v_lock_id uuid;
	v_count integer;
	v_tenant_id uuid;
	v_project_id uuid;
	v_document_id uuid;
	v_parse_id uuid;
	v_types public.requirement_type[];
	v_atomicities public.requirement_atomicity[];
	v_officials text[];
	v_max_order integer;
	v_new_type public.requirement_type;
	v_new_atomicity public.requirement_atomicity;
	v_new_official text;
	v_new_id uuid;
	v_span_count integer;
begin
	if p_actor_id is null then
		raise exception using
			errcode = '42501',
			message = 'REQUIREMENT_MERGE_UNAVAILABLE';
	end if;

	if jsonb_typeof(p_candidate_ids) is distinct from 'array'
		or jsonb_array_length(p_candidate_ids) not between 2 and 8
		or exists (
			select 1
			from jsonb_array_elements_text(p_candidate_ids) as item(id)
			where id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
		)
		or (
			select count(distinct id)
			from jsonb_array_elements_text(p_candidate_ids) as item(id)
		) is distinct from jsonb_array_length(p_candidate_ids)
	then
		raise exception using
			errcode = '22023',
			message = 'REQUIREMENT_MERGE_PAYLOAD_INVALID';
	end if;

	if p_interpretation is null
		or not (p_interpretation ~ '[^[:space:]]')
		or length(p_interpretation) <> length(btrim(p_interpretation))
		or octet_length(p_interpretation) > 8192
	then
		raise exception using
			errcode = '22023',
			message = 'REQUIREMENT_MERGE_PAYLOAD_INVALID';
	end if;

	v_ids := array_agg(id::uuid order by id)
	from jsonb_array_elements_text(p_candidate_ids) as item(id);

	declare
		lock_only_id uuid;
	begin
	end;

	select
		run.tenant_id,
		run.project_id
	into
		v_tenant_id,
		v_project_id
	from public.requirement_extraction_runs as run
	where run.id = p_run_id
		and (
			exists (
				select 1
				from public.project_memberships as project_membership
				where project_membership.tenant_id = run.tenant_id
					and project_membership.project_id = run.project_id
					and project_membership.user_id = p_actor_id
					and project_membership.role in (
						'EDITOR'::public.membership_role,
						'PROJECT_ADMIN'::public.membership_role
					)
			)
			or exists (
				select 1
				from public.tenant_memberships as tenant_membership
				where tenant_membership.tenant_id = run.tenant_id
					and tenant_membership.user_id = p_actor_id
					and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
			)
		);

	if v_tenant_id is null then
		raise exception using
			errcode = '42501',
			message = 'REQUIREMENT_MERGE_UNAVAILABLE';
	end if;

	select candidate.id
	into v_lock_id
	from public.requirement_candidates as candidate
	where candidate.run_id = p_run_id
		and candidate.id = any(v_ids)
		and candidate.provenance_state is distinct from 'REJECTED'
		and (
			exists (
				select 1
				from public.project_memberships as project_membership
				where project_membership.tenant_id = candidate.tenant_id
					and project_membership.project_id = candidate.project_id
					and project_membership.user_id = p_actor_id
					and project_membership.role in (
						'EDITOR'::public.membership_role,
						'PROJECT_ADMIN'::public.membership_role
					)
			)
			or exists (
				select 1
				from public.tenant_memberships as tenant_membership
				where tenant_membership.tenant_id = candidate.tenant_id
					and tenant_membership.user_id = p_actor_id
					and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
			)
		)
	order by candidate.candidate_order
	limit 1
	for update of candidate;

	select
		count(*),
		min(candidate.tenant_id::text)::uuid,
		min(candidate.project_id::text)::uuid,
		min(candidate.document_id::text)::uuid,
		min(candidate.document_parse_id::text)::uuid,
		array_agg(distinct candidate.requirement_type),
		array_agg(distinct candidate.atomicity),
		array_agg(candidate.official_id order by candidate.candidate_order)
	into
		v_count,
		v_tenant_id,
		v_project_id,
		v_document_id,
		v_parse_id,
		v_types,
		v_atomicities,
		v_officials
	from public.requirement_candidates as candidate
	where candidate.run_id = p_run_id
		and candidate.id = any(v_ids)
		and candidate.provenance_state is distinct from 'REJECTED';

	if v_count is distinct from array_length(v_ids, 1) then
		raise exception using
			errcode = '42501',
			message = 'REQUIREMENT_MERGE_UNAVAILABLE';
	end if;

	-- The new order must not collide with any existing candidate in the run,
	-- including already-rejected ones.
	select coalesce(max(candidate.candidate_order), 0)
	into v_max_order
	from public.requirement_candidates as candidate
	where candidate.run_id = p_run_id;

	v_new_type := case when array_length(v_types, 1) = 1 then v_types[1] else 'OTHER'::public.requirement_type end;
	v_new_atomicity := case
		when array_length(v_atomicities, 1) = 1 then v_atomicities[1]
		else 'REVIEW_REQUIRED'::public.requirement_atomicity
	end;
	v_new_official := case
		when (select count(distinct value) from unnest(v_officials) as item(value) where value is not null) = 1
		then (select min(value) from unnest(v_officials) as item(value) where value is not null)
		else null
	end;

	select count(*)::integer
	into v_span_count
	from public.requirement_candidate_source_spans as link
	join public.source_spans as span
		on span.id = link.source_span_id
	where link.run_id = p_run_id
		and link.candidate_id = any(v_ids);

	if v_span_count = 0 then
		raise exception using
			errcode = '22023',
			message = 'REQUIREMENT_MERGE_EVIDENCE_INVALID';
	end if;

	insert into public.requirement_candidates (
		tenant_id, project_id, document_id, document_parse_id, run_id,
		candidate_order, official_id, source_text, interpretation,
		requirement_type, atomicity, provenance_state, content_sha256,
		reviewed_by, reviewed_at
	)
	select
		merged.tenant_id,
		merged.project_id,
		merged.document_id,
		merged.document_parse_id,
		merged.run_id,
		v_max_order + 1,
		v_new_official,
		merged.source_text,
		p_interpretation,
		v_new_type,
		v_new_atomicity,
		'HUMAN_VERIFIED',
		private.source_text_sha256(p_interpretation || E'\n' || merged.source_text),
		p_actor_id,
		now()
	from (
		select
			candidate.tenant_id,
			candidate.project_id,
			candidate.document_id,
			candidate.document_parse_id,
			candidate.run_id,
			string_agg(
				distinct span.original_text,
				E'\n\n' order by span.original_text
			) as source_text
		from public.requirement_candidates as candidate
		join public.requirement_candidate_source_spans as link
			on link.run_id = candidate.run_id
			and link.candidate_id = candidate.id
		join public.source_spans as span
			on span.id = link.source_span_id
		where candidate.run_id = p_run_id
			and candidate.id = any(v_ids)
		group by
			candidate.tenant_id, candidate.project_id, candidate.document_id,
			candidate.document_parse_id, candidate.run_id
	) as merged
	returning id into v_new_id;

	insert into public.requirement_candidate_source_spans (
		tenant_id, project_id, document_id, document_parse_id, run_id,
		candidate_id, source_span_id, source_order
	)
	select distinct on (span.ordinal)
		v_tenant_id,
		v_project_id,
		v_document_id,
		v_parse_id,
		p_run_id,
		v_new_id,
		span.id,
		row_number() over (order by span.ordinal)
	from public.requirement_candidate_source_spans as link
	join public.source_spans as span
		on span.id = link.source_span_id
	where link.run_id = p_run_id
		and link.candidate_id = any(v_ids)
	order by span.ordinal, link.source_order;

	update public.requirement_candidates as candidate
	set
		provenance_state = 'REJECTED',
		reviewed_by = p_actor_id,
		reviewed_at = now()
	where candidate.run_id = p_run_id
		and candidate.id = any(v_ids);

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
		v_tenant_id,
		v_project_id,
		p_actor_id,
		'REQUIREMENT_CANDIDATES_MERGED',
		'REQUIREMENT_CANDIDATE',
		v_new_id,
		jsonb_build_object(
			'sourceCandidateIds', to_jsonb(v_ids),
			'runId', p_run_id
		)
	);

	return jsonb_build_object(
		'candidateId', v_new_id,
		'candidateIds', jsonb_build_array(v_new_id)
	);
end;
$$;

create function public.split_requirement_candidate(
	p_actor_id uuid,
	p_run_id uuid,
	p_candidate_id uuid,
	p_parts jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_tenant_id uuid;
	v_project_id uuid;
	v_document_id uuid;
	v_parse_id uuid;
	v_official text;
	v_type public.requirement_type;
	v_atomicity public.requirement_atomicity;
	v_max_order integer;
	v_part jsonb;
	v_part_interpretation text;
	v_part_ordinals integer[];
	v_new_id uuid;
	v_new_ids uuid[] := array[]::uuid[];
	v_part_position integer := 0;
	v_cited_ordinals integer[];
	v_union_ordinals integer[];
	v_part_count integer;
begin
	if p_actor_id is null then
		raise exception using
			errcode = '42501',
			message = 'REQUIREMENT_SPLIT_UNAVAILABLE';
	end if;

	if jsonb_typeof(p_parts) is distinct from 'array'
		or jsonb_array_length(p_parts) not between 2 and 8
	then
		raise exception using
			errcode = '22023',
			message = 'REQUIREMENT_SPLIT_PAYLOAD_INVALID';
	end if;

	select
		candidate.tenant_id,
		candidate.project_id,
		candidate.document_id,
		candidate.document_parse_id,
		candidate.official_id,
		candidate.requirement_type,
		candidate.atomicity
	into
		v_tenant_id,
		v_project_id,
		v_document_id,
		v_parse_id,
		v_official,
		v_type,
		v_atomicity
	from public.requirement_candidates as candidate
	where candidate.id = p_candidate_id
		and candidate.run_id = p_run_id
		and candidate.provenance_state is distinct from 'REJECTED'
		and (
			exists (
				select 1
				from public.project_memberships as project_membership
				where project_membership.tenant_id = candidate.tenant_id
					and project_membership.project_id = candidate.project_id
					and project_membership.user_id = p_actor_id
					and project_membership.role in (
						'EDITOR'::public.membership_role,
						'PROJECT_ADMIN'::public.membership_role
					)
			)
			or exists (
				select 1
				from public.tenant_memberships as tenant_membership
				where tenant_membership.tenant_id = candidate.tenant_id
					and tenant_membership.user_id = p_actor_id
					and tenant_membership.role = 'TENANT_ADMIN'::public.membership_role
			)
		)
	for update of candidate;

	if v_tenant_id is null then
		raise exception using
			errcode = '42501',
			message = 'REQUIREMENT_SPLIT_UNAVAILABLE';
	end if;

	-- New parts must not collide with any existing order in the run,
	-- including already-rejected candidates.
	select coalesce(max(candidate.candidate_order), 0)
	into v_max_order
	from public.requirement_candidates as candidate
	where candidate.run_id = p_run_id;

	select coalesce(array_agg(span.ordinal order by span.ordinal), array[]::integer[])
	into v_cited_ordinals
	from public.requirement_candidate_source_spans as link
	join public.source_spans as span
		on span.id = link.source_span_id
	where link.run_id = p_run_id
		and link.candidate_id = p_candidate_id;

	v_union_ordinals := array[]::integer[];
	v_part_count := jsonb_array_length(p_parts);

	for v_part in
		select value
		from jsonb_array_elements(p_parts)
	loop
		v_part_position := v_part_position + 1;

		if jsonb_typeof(v_part) is distinct from 'object'
			or not (v_part ?& array['interpretation', 'sourceSpanOrdinals'])
			or v_part - array['interpretation', 'sourceSpanOrdinals'] <> '{}'::jsonb
			or jsonb_typeof(v_part -> 'interpretation') is distinct from 'string'
			or jsonb_typeof(v_part -> 'sourceSpanOrdinals') is distinct from 'array'
		then
			raise exception using
				errcode = '22023',
				message = 'REQUIREMENT_SPLIT_PAYLOAD_INVALID';
		end if;

		v_part_interpretation := v_part ->> 'interpretation';
		if not (v_part_interpretation ~ '[^[:space:]]')
			or length(v_part_interpretation) <> length(btrim(v_part_interpretation))
			or octet_length(v_part_interpretation) > 8192
		then
			raise exception using
				errcode = '22023',
				message = 'REQUIREMENT_SPLIT_PAYLOAD_INVALID';
		end if;

		if (
			select count(*)::integer
			from jsonb_array_elements_text(v_part -> 'sourceSpanOrdinals') as item(ordinal)
			where ordinal !~ '^[1-9][0-9]*$'
		) > 0
		then
			raise exception using
				errcode = '22023',
				message = 'REQUIREMENT_SPLIT_PAYLOAD_INVALID';
		end if;

		select array_agg(distinct ordinal::integer)
		into v_part_ordinals
		from jsonb_array_elements_text(v_part -> 'sourceSpanOrdinals') as item(ordinal);

		if cardinality(coalesce(v_part_ordinals, array[]::integer[])) = 0 then
			raise exception using
				errcode = '22023',
				message = 'REQUIREMENT_SPLIT_EVIDENCE_INVALID part=' || coalesce(v_part::text, 'null')
					|| ' cited=' || coalesce(array_to_string(v_cited_ordinals, ','), 'none');
		end if;

		if exists (
			select 1
			from unnest(v_part_ordinals) as item(ordinal)
			where not (ordinal = any(v_cited_ordinals))
		) then
			raise exception using
				errcode = '22023',
				message = 'REQUIREMENT_SPLIT_EVIDENCE_INVALID';
		end if;

		if exists (
			select 1
			from unnest(v_part_ordinals) as item(ordinal)
			where ordinal = any(v_union_ordinals)
		) then
			raise exception using
				errcode = '22023',
				message = 'REQUIREMENT_SPLIT_EVIDENCE_INVALID';
		end if;

		v_union_ordinals := v_union_ordinals || v_part_ordinals;

		insert into public.requirement_candidates (
			tenant_id, project_id, document_id, document_parse_id, run_id,
			candidate_order, official_id, source_text, interpretation,
			requirement_type, atomicity, provenance_state, content_sha256,
			reviewed_by, reviewed_at
		)
		select
			split.tenant_id,
			split.project_id,
			split.document_id,
			split.document_parse_id,
			p_run_id,
			v_max_order + v_part_position,
			case
				when split.official_id is not null
					and position(
						split.official_id in
						(
							select coalesce(string_agg(span.original_text, E'\n\n' order by span.ordinal), '')
							from public.source_spans as span
							where span.ordinal = any(v_part_ordinals)
								and span.document_parse_id = split.document_parse_id
						)
					) > 0
				then split.official_id
				else null
			end,
			(
				select string_agg(span.original_text, E'\n\n' order by span.ordinal)
				from public.source_spans as span
				where span.ordinal = any(v_part_ordinals)
					and span.document_parse_id = split.document_parse_id
					and span.id in (
						select link.source_span_id
						from public.requirement_candidate_source_spans as link
						where link.run_id = p_run_id
							and link.candidate_id = p_candidate_id
					)
			),
			v_part_interpretation,
			split.requirement_type,
			split.atomicity,
			'HUMAN_VERIFIED',
			private.source_text_sha256(
				v_part_interpretation || E'\n' || (
					select coalesce(string_agg(span.original_text, E'\n\n' order by span.ordinal), '')
					from public.source_spans as span
					where span.ordinal = any(v_part_ordinals)
						and span.document_parse_id = split.document_parse_id
						and span.id in (
							select link.source_span_id
							from public.requirement_candidate_source_spans as link
							where link.run_id = p_run_id
								and link.candidate_id = p_candidate_id
						)
				)
			),
			p_actor_id,
			now()
		from public.requirement_candidates as split
		where split.id = p_candidate_id
		returning id into v_new_id;

		insert into public.requirement_candidate_source_spans (
			tenant_id, project_id, document_id, document_parse_id, run_id,
			candidate_id, source_span_id, source_order
		)
		select
			v_tenant_id,
			v_project_id,
			v_document_id,
			v_parse_id,
			p_run_id,
			v_new_id,
			span.id,
			row_number() over (order by span.ordinal)
		from public.source_spans as span
		where span.ordinal = any(v_part_ordinals)
			and span.document_parse_id = v_parse_id
			and span.id in (
				select link.source_span_id
				from public.requirement_candidate_source_spans as link
				where link.run_id = p_run_id
					and link.candidate_id = p_candidate_id
			)
		order by span.ordinal;

		v_new_ids := array_append(v_new_ids, v_new_id);
	end loop;

	if (
		select count(*)::integer
		from unnest(v_union_ordinals) as item(ordinal)
		where not (ordinal = any(v_cited_ordinals))
	) > 0
		or cardinality(v_union_ordinals) is distinct from cardinality(v_cited_ordinals)
	then
		raise exception using
			errcode = '22023',
			message = 'REQUIREMENT_SPLIT_EVIDENCE_INVALID';
	end if;

	update public.requirement_candidates as candidate
	set
		provenance_state = 'REJECTED',
		reviewed_by = p_actor_id,
		reviewed_at = now()
	where candidate.id = p_candidate_id;

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
		v_tenant_id,
		v_project_id,
		p_actor_id,
		'REQUIREMENT_CANDIDATE_SPLIT',
		'REQUIREMENT_CANDIDATE',
		p_candidate_id,
		jsonb_build_object(
			'newCandidateIds', to_jsonb(v_new_ids),
			'runId', p_run_id
		)
	);

	return jsonb_build_object('candidateIds', to_jsonb(v_new_ids));
end;
$$;

revoke all on function public.review_requirement_candidate(
	uuid, uuid, uuid, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.merge_requirement_candidates(
	uuid, uuid, jsonb, text
) from public, anon, authenticated, service_role;
revoke all on function public.split_requirement_candidate(
	uuid, uuid, uuid, jsonb
) from public, anon, authenticated, service_role;

grant execute on function public.review_requirement_candidate(
	uuid, uuid, uuid, text, text
) to service_role;
grant execute on function public.merge_requirement_candidates(
	uuid, uuid, jsonb, text
) to service_role;
grant execute on function public.split_requirement_candidate(
	uuid, uuid, uuid, jsonb
) to service_role;
