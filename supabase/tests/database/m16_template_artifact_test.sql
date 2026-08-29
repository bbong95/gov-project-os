begin;

select plan(19);

-- Synthetic tenant/project/users
insert into auth.users (id, email)
values
	('80000000-0000-4000-8000-000000000001', 'm16-admin@example.test'),
	('80000000-0000-4000-8000-000000000002', 'm16-viewer@example.test');

insert into public.tenants (id, name, created_by)
values ('81000000-0000-4000-8000-000000000001', 'M16 synthetic tenant A', '80000000-0000-4000-8000-000000000001');

insert into public.projects (id, tenant_id, name, created_by)
values ('81000000-0000-4000-8000-000000000101', '81000000-0000-4000-8000-000000000001', 'M16 synthetic project A', '80000000-0000-4000-8000-000000000001');

insert into public.project_memberships (tenant_id, project_id, user_id, role)
values
	('81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000101', '80000000-0000-4000-8000-000000000001', 'PROJECT_ADMIN'),
	('81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000101', '80000000-0000-4000-8000-000000000002', 'VIEWER');

-- Reuse the M16 support setup: an RFP document + requirement run + baseline
insert into public.documents (id, tenant_id, project_id, document_kind, privacy_classification, original_filename, media_type, byte_size, storage_path, sha256, created_by)
values ('82000000-0000-4000-8000-000000000101', '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000101', 'RFP', 'INTERNAL', 'm16-a.synthetic.txt', 'text/plain', 64, '81000000-0000-4000-8000-000000000101/82000000-0000-4000-8000-000000000101/original', repeat('a', 64), '80000000-0000-4000-8000-000000000001');
update public.documents set storage_bucket = 'rfp-originals' where id = '82000000-0000-4000-8000-000000000101';

insert into public.document_parses (id, tenant_id, project_id, document_id, source_sha256, parser_key, parser_version, normalization_version, detected_format, warnings, span_count, result_sha256, created_by)
values ('83000000-0000-4000-8000-000000000101', '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000101', '82000000-0000-4000-8000-000000000101', repeat('a', 64), 'plain-text', '1.0.0', 'nfc-lines-v1', 'txt', '[]', 1, repeat('1', 64), '80000000-0000-4000-8000-000000000001');

insert into public.requirement_extraction_runs (id, tenant_id, project_id, document_id, document_parse_id, privacy_classification, provider, model, policy_version, prompt_version, schema_version, parse_result_sha256, canonical_input_sha256, fingerprint_sha256, accepted_output_sha256, created_by)
values ('84000000-0000-4000-8000-000000000101', '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000101', '82000000-0000-4000-8000-000000000101', '83000000-0000-4000-8000-000000000101', 'INTERNAL', 'OPENAI', 'synthetic-model', 'document-privacy-v1', 'requirement-extraction-v1', 'requirement-candidates-v1', repeat('1', 64), repeat('2', 64), repeat('3', 64), repeat('4', 64), '80000000-0000-4000-8000-000000000001');

insert into public.requirement_baselines (id, tenant_id, project_id, document_id, document_parse_id, run_id, version, content_sha256, candidate_count, created_by)
values ('85000000-0000-4000-8000-000000000101', '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000101', '82000000-0000-4000-8000-000000000101', '83000000-0000-4000-8000-000000000101', '84000000-0000-4000-8000-000000000101', 1, repeat('a', 64), 1, '80000000-0000-4000-8000-000000000001');

-- 1. Register a new template via the trusted server action. Idempotent on bytes.
set local role service_role;
select is(
	(public.register_artifact_template(
		'80000000-0000-4000-8000-000000000001',
		'81000000-0000-4000-8000-000000000101',
		'company-template-v1.hwpx',
		'application/hwp+zip',
		'artifact-templates',
		'81000000-0000-4000-8000-000000000101/templates/company-template-v1.hwpx',
		repeat('b', 64),
		'hwpx'
	) ->> 'version')::text,
	'1',
	'first template registration returns version 1'
);
reset role;

select is(
	(public.register_artifact_template(
		'80000000-0000-4000-8000-000000000001',
		'81000000-0000-4000-8000-000000000101',
		'company-template-v1.hwpx',
		'application/hwp+zip',
		'artifact-templates',
		'81000000-0000-4000-8000-000000000101/templates/company-template-v1.hwpx',
		repeat('b', 64),
		'hwpx'
	) ->> 'created')::text,
	'false',
	'same-byte re-registration is idempotent and does not create a new version'
);

-- 2. distinct bytes -> new version
select is(
	(public.register_artifact_template(
		'80000000-0000-4000-8000-000000000001',
		'81000000-0000-4000-8000-000000000101',
		'company-template-v1.hwpx',
		'application/hwp+zip',
		'artifact-templates',
		'81000000-0000-4000-8000-000000000101/templates/company-template-v1.hwpx',
		repeat('c', 64),
		'hwpx'
	) ->> 'version')::text,
	'2',
	'new bytes produce version 2'
);

-- 3. viewer cannot register
set local role service_role;
select throws_ok(
	$$select public.register_artifact_template(
		'80000000-0000-4000-8000-000000000002',
		'81000000-0000-4000-8000-000000000101',
		'company-template-v1.hwpx',
		'application/hwp+zip',
		'artifact-templates',
		'81000000-0000-4000-8000-000000000101/templates/company-template-v1.hwpx',
		repeat('d', 64),
		'hwpx'
	)$$,
	'42501',
	NULL,
	'viewer is forbidden from registering templates'
);
reset role;

-- 4. record fields, one required, one optional
set local role service_role;
do $$
declare
	v_template_id uuid;
begin
	select id into v_template_id from public.artifact_templates where sha256 = repeat('b', 64) limit 1;
	perform public.record_artifact_template_field(
		'80000000-0000-4000-8000-000000000001',
		v_template_id,
		'contract_title',
		'PARAGRAPH',
		'/section[1]/p[1]',
		true,
		'계약서 제목'
	);
	perform public.record_artifact_template_field(
		'80000000-0000-4000-8000-000000000001',
		v_template_id,
		'note',
		'PARAGRAPH',
		'/section[1]/p[2]',
		false,
		'비고'
	);
end $$;
reset role;

-- 5. submit mapping with a required field missing is rejected
set local role service_role;
select throws_ok(
	format(
		$sql$select public.submit_artifact_template_mapping(
			'80000000-0000-4000-8000-000000000001',
			(select id from public.artifact_templates where sha256 = %L limit 1),
			'REQUIREMENT_BASELINE',
			'85000000-0000-4000-8000-000000000101',
			'{"note": "manual value"}'::jsonb
		)$sql$,
		repeat('b', 64)
	),
	'22023',
	NULL,
	'mapping without a required field is rejected'
);
reset role;

-- 6. submit a complete mapping
set local role service_role;
select public.submit_artifact_template_mapping(
	'80000000-0000-4000-8000-000000000001',
	(select id from public.artifact_templates where sha256 = repeat('b', 64) limit 1),
	'REQUIREMENT_BASELINE',
	'85000000-0000-4000-8000-000000000101',
	jsonb_build_object(
		'contract_title', jsonb_build_object('type', 'manual', 'value', '공공 AI 플랫폼 구축 계약서'),
		'note', jsonb_build_object('type', 'manual', 'value', '최종본')
	)
);
reset role;

-- 7. mapping row exists and is unapproved
select is(
	(
		select count(*)::integer
		from public.artifact_template_mappings
		where template_id = (select id from public.artifact_templates where sha256 = repeat('b', 64) limit 1)
	),
	1,
	'one mapping was persisted'
);
select is(
	(
		select approved_at from public.artifact_template_mappings
		where template_id = (select id from public.artifact_templates where sha256 = repeat('b', 64) limit 1)
		order by version desc limit 1
	),
	null,
	'newly submitted mapping is not yet H8-approved'
);

-- 8. cannot generate an artifact from an unapproved mapping
set local role service_role;
select throws_ok(
	format(
		$sql$select public.generate_artifact(
			'80000000-0000-4000-8000-000000000001',
			(select id from public.artifact_template_mappings
				where template_id = (select id from public.artifact_templates where sha256 = %L limit 1)
				order by version desc limit 1),
			'84000000-0000-4000-8000-000000000101',
			'[]'::jsonb,
			'{"passed": true, "checks": []}'::jsonb,
			'{"renderedBytes": 0}'::jsonb,
			'artifact-templates',
			'81000000-0000-4000-8000-000000000101/artifacts/preview.hwpx',
			repeat('e', 64),
			'fixture-model',
			'fixture-prompt'
		)$sql$,
		repeat('b', 64)
	),
	'22023',
	NULL,
	'generating an artifact from an unapproved mapping is rejected'
);
reset role;

-- 9. approve mapping (H8)
set local role service_role;
select is(
	(public.approve_artifact_template_mapping(
		'80000000-0000-4000-8000-000000000001',
		(
			select id from public.artifact_template_mappings
			where template_id = (select id from public.artifact_templates where sha256 = repeat('b', 64) limit 1)
			order by version desc limit 1
		)
	) ->> 'approvedBy')::text,
	'80000000-0000-4000-8000-000000000001',
	'H8 approval records the human actor as the approver'
);
reset role;

-- 10. cannot generate with unresolved required field
set local role service_role;
select throws_ok(
	format(
		$sql$select public.generate_artifact(
			'80000000-0000-4000-8000-000000000001',
			(select id from public.artifact_template_mappings
				where template_id = (select id from public.artifact_templates where sha256 = %L limit 1)
				order by version desc limit 1),
			'84000000-0000-4000-8000-000000000101',
			'["contract_title"]'::jsonb,
			'{"passed": true, "checks": []}'::jsonb,
			'{}'::jsonb,
			'artifact-templates',
			'81000000-0000-4000-8000-000000000101/artifacts/preview.hwpx',
			repeat('e', 64),
			'fixture-model',
			'fixture-prompt'
		)$sql$,
		repeat('b', 64)
	),
	'22023',
	NULL,
	'ARTIFACT_UNRESOLVED_REQUIRED_FIELD blocks finalization'
);
reset role;

-- 11. cannot generate with failed validation
set local role service_role;
select throws_ok(
	format(
		$sql$select public.generate_artifact(
			'80000000-0000-4000-8000-000000000001',
			(select id from public.artifact_template_mappings
				where template_id = (select id from public.artifact_templates where sha256 = %L limit 1)
				order by version desc limit 1),
			'84000000-0000-4000-8000-000000000101',
			'[]'::jsonb,
			'{"passed": false, "checks": ["missing_signature_block"]}'::jsonb,
			'{}'::jsonb,
			'artifact-templates',
			'81000000-0000-4000-8000-000000000101/artifacts/preview.hwpx',
			repeat('e', 64),
			'fixture-model',
			'fixture-prompt'
		)$sql$,
		repeat('b', 64)
	),
	'22023',
	NULL,
	'validation failure blocks finalization'
);
reset role;

-- 12. happy path: generate an artifact
set local role service_role;
select is(
	(public.generate_artifact(
		'80000000-0000-4000-8000-000000000001',
		(
			select id from public.artifact_template_mappings
			where template_id = (select id from public.artifact_templates where sha256 = repeat('b', 64) limit 1)
			order by version desc limit 1
		),
		'84000000-0000-4000-8000-000000000101',
		'[]'::jsonb,
		'{"passed": true, "checks": ["structure_valid", "required_resolved"]}'::jsonb,
		'{"renderedBytes": 4096, "previewPages": 1}'::jsonb,
		'artifact-templates',
		'81000000-0000-4000-8000-000000000101/artifacts/final-v1.hwpx',
		repeat('e', 64),
		'fixture-model',
		'fixture-prompt'
	) ->> 'contentSha256')::text,
	repeat('e', 64),
	'happy-path artifact is recorded with the supplied content hash'
);
reset role;

-- 13. artifact row carries the source run and template provenance
select is(
	(
		select run_id::text from public.generated_artifacts
		where content_sha256 = repeat('e', 64)
		limit 1
	),
	'84000000-0000-4000-8000-000000000101',
	'generated artifact records the source run id'
);
select is(
	(
		select model_fingerprint from public.generated_artifacts
		where content_sha256 = repeat('e', 64)
		limit 1
	),
	'fixture-model',
	'generated artifact records the model fingerprint'
);

-- 14. H10 approval flips approved_at and a second call is rejected
set local role service_role;
select is(
	(public.approve_artifact(
		'80000000-0000-4000-8000-000000000001',
		(
			select id from public.generated_artifacts where content_sha256 = repeat('e', 64) limit 1
		)
	) ->> 'approvedBy')::text,
	'80000000-0000-4000-8000-000000000001',
	'H10 approval records the human actor'
);
reset role;

set local role service_role;
select throws_ok(
	$$select public.approve_artifact(
		'80000000-0000-4000-8000-000000000001',
		(
			select id from public.generated_artifacts where content_sha256 = repeat('e', 64) limit 1
		)
	)$$,
	'22023',
	NULL,
	'second H10 approval on the same artifact is rejected'
);
reset role;

-- 15. audit events for the lifecycle
select is(
	(
		select count(*)::integer from public.audit_events
		where event_type = 'TEMPLATE_REGISTERED'
			and entity_id in (select id from public.artifact_templates)
	),
	2,
	'TEMPLATE_REGISTERED is recorded once per unique sha256 (idempotent re-registration is not double-counted)'
);
select is(
	(
		select count(*)::integer from public.audit_events where event_type = 'TEMPLATE_MAPPING_APPROVED'
	),
	1,
	'TEMPLATE_MAPPING_APPROVED audit event is recorded once'
);
select is(
	(
		select count(*)::integer from public.audit_events where event_type = 'ARTIFACT_APPROVED'
	),
	1,
	'ARTIFACT_APPROVED audit event is recorded once'
);

select * from finish();
rollback;
