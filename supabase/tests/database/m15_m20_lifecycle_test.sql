begin;

select plan(22);

-- Synthetic tenant/project/users
insert into auth.users (id, email)
values
	('70000000-0000-4000-8000-000000000001', 'm15m20-admin@example.test'),
	('70000000-0000-4000-8000-000000000002', 'm15m20-editor@example.test'),
	('70000000-0000-4000-8000-000000000003', 'm15m20-viewer@example.test');

insert into public.tenants (id, name, created_by)
values ('71000000-0000-4000-8000-000000000001', 'M15-M20 synthetic tenant A', '70000000-0000-4000-8000-000000000001');

insert into public.projects (id, tenant_id, name, created_by)
values ('71000000-0000-4000-8000-000000000101', '71000000-0000-4000-8000-000000000001', 'M15-M20 synthetic project A', '70000000-0000-4000-8000-000000000001');

insert into public.project_memberships (tenant_id, project_id, user_id, role)
values
	('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '70000000-0000-4000-8000-000000000001', 'PROJECT_ADMIN'),
	('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '70000000-0000-4000-8000-000000000002', 'EDITOR'),
	('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '70000000-0000-4000-8000-000000000003', 'VIEWER');

insert into public.documents (id, tenant_id, project_id, document_kind, privacy_classification, original_filename, media_type, byte_size, storage_path, sha256, created_by)
values ('72000000-0000-4000-8000-000000000101', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', 'RFP', 'INTERNAL', 'm15m20-a.synthetic.txt', 'text/plain', 64, '71000000-0000-4000-8000-000000000101/72000000-0000-4000-8000-000000000101/original', repeat('a', 64), '70000000-0000-4000-8000-000000000001');
update public.documents set storage_bucket = 'rfp-originals' where id = '72000000-0000-4000-8000-000000000101';

insert into public.document_parses (id, tenant_id, project_id, document_id, source_sha256, parser_key, parser_version, normalization_version, detected_format, warnings, span_count, result_sha256, created_by)
values ('73000000-0000-4000-8000-000000000101', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '72000000-0000-4000-8000-000000000101', repeat('a', 64), 'plain-text', '1.0.0', 'nfc-lines-v1', 'txt', '[]', 2, repeat('1', 64), '70000000-0000-4000-8000-000000000001');

insert into public.source_spans (id, tenant_id, project_id, document_id, document_parse_id, ordinal, location, original_text, normalized_text, original_text_sha256)
values
	('74000000-0000-4000-8000-000000000101', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '72000000-0000-4000-8000-000000000101', '73000000-0000-4000-8000-000000000101', 1, '{"kind":"TEXT_LINES","lineStart":1,"lineEnd":1}', '○ SER-001 최소권한', 'SER-001 최소권한', private.source_text_sha256('○ SER-001 최소권한')),
	('74000000-0000-4000-8000-000000000102', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '72000000-0000-4000-8000-000000000101', '73000000-0000-4000-8000-000000000101', 2, '{"kind":"TEXT_LINES","lineStart":2,"lineEnd":2}', '○ PMR-001 주간보고', 'PMR-001 주간보고', private.source_text_sha256('○ PMR-001 주간보고'));

insert into public.requirement_extraction_runs (id, tenant_id, project_id, document_id, document_parse_id, privacy_classification, provider, model, policy_version, prompt_version, schema_version, parse_result_sha256, canonical_input_sha256, fingerprint_sha256, accepted_output_sha256, created_by)
values ('75000000-0000-4000-8000-000000000101', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '72000000-0000-4000-8000-000000000101', '73000000-0000-4000-8000-000000000101', 'INTERNAL', 'OPENAI', 'synthetic-model', 'document-privacy-v1', 'requirement-extraction-v1', 'requirement-candidates-v1', repeat('1', 64), repeat('2', 64), repeat('3', 64), repeat('4', 64), '70000000-0000-4000-8000-000000000001');

insert into public.requirement_candidates (id, tenant_id, project_id, document_id, document_parse_id, run_id, candidate_order, official_id, source_text, interpretation, requirement_type, atomicity, provenance_state, content_sha256)
values
	('76000000-0000-4000-8000-000000000101', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '72000000-0000-4000-8000-000000000101', '73000000-0000-4000-8000-000000000101', '75000000-0000-4000-8000-000000000101', 1, 'SER-001', '○ SER-001 최소권한', '최소권한으로 관리', 'SECURITY', 'ATOMIC', 'HUMAN_VERIFIED', repeat('1', 64)),
	('76000000-0000-4000-8000-000000000102', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '72000000-0000-4000-8000-000000000101', '73000000-0000-4000-8000-000000000101', '75000000-0000-4000-8000-000000000101', 2, 'PMR-001', '○ PMR-001 주간보고', '주간 업무보고', 'PROJECT_MANAGEMENT', 'ATOMIC', 'HUMAN_VERIFIED', repeat('2', 64));

insert into public.requirement_candidate_source_spans (tenant_id, project_id, document_id, document_parse_id, run_id, candidate_id, source_span_id, source_order)
values
	('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '72000000-0000-4000-8000-000000000101', '73000000-0000-4000-8000-000000000101', '75000000-0000-4000-8000-000000000101', '76000000-0000-4000-8000-000000000101', '74000000-0000-4000-8000-000000000101', 1),
	('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '72000000-0000-4000-8000-000000000101', '73000000-0000-4000-8000-000000000101', '75000000-0000-4000-8000-000000000101', '76000000-0000-4000-8000-000000000102', '74000000-0000-4000-8000-000000000102', 1);

insert into public.requirement_baselines (id, tenant_id, project_id, document_id, document_parse_id, run_id, version, content_sha256, candidate_count, created_by)
values ('77000000-0000-4000-8000-000000000101', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '72000000-0000-4000-8000-000000000101', '73000000-0000-4000-8000-000000000101', '75000000-0000-4000-8000-000000000101', 1, repeat('a', 64), 2, '70000000-0000-4000-8000-000000000001');

insert into public.requirement_baseline_items (id, tenant_id, project_id, run_id, baseline_id, candidate_id, candidate_order, official_id, source_text, interpretation, requirement_type, atomicity, content_sha256)
values
	('78000000-0000-4000-8000-000000000101', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '75000000-0000-4000-8000-000000000101', '77000000-0000-4000-8000-000000000101', '76000000-0000-4000-8000-000000000101', 1, 'SER-001', '○ SER-001 최소권한', '최소권한으로 관리', 'SECURITY', 'ATOMIC', repeat('1', 64)),
	('78000000-0000-4000-8000-000000000102', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '75000000-0000-4000-8000-000000000101', '77000000-0000-4000-8000-000000000101', '76000000-0000-4000-8000-000000000102', 2, 'PMR-001', '○ PMR-001 주간보고', '주간 업무보고', 'PROJECT_MANAGEMENT', 'ATOMIC', repeat('2', 64));

-- -----------------------------------------------------------------------------
-- M15: WBS / Deliverable validations
-- -----------------------------------------------------------------------------

-- 1. requirement_candidate_id is NOT NULL (Requirement -> Task backbone)
select throws_ok(
	$$insert into public.wbs_tasks (tenant_id, project_id, run_id, title, owner, due_date, created_by)
	  values ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '75000000-0000-4000-8000-000000000101', 'orphan task', 'owner-a', '2026-12-31', '70000000-0000-4000-8000-000000000001')$$,
	'23514',
	NULL,
	'wbs_tasks require a requirement_candidate_id'
);

-- 2. validator reports requirementCount and zero tasks for empty run
select is(
	(public.validate_wbs_for_run('75000000-0000-4000-8000-000000000101') ->> 'requirementCount')::integer,
	2,
	'validate_wbs_for_run reports the baseline requirement count'
);
select is(
	(public.validate_wbs_for_run('75000000-0000-4000-8000-000000000101') ->> 'taskCount')::integer,
	0,
	'validate_wbs_for_run reports zero tasks for an empty run'
);
select is(
	(public.validate_wbs_for_run('75000000-0000-4000-8000-000000000101') ->> 'requirementsWithoutTask')::integer,
	2,
	'validate_wbs_for_run flags every requirement as uncovered when no tasks exist'
);

-- 3. deliverable without task is structurally impossible (FK CASCADE)
insert into public.wbs_tasks (tenant_id, project_id, run_id, requirement_candidate_id, title, owner, due_date, created_by)
values ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '75000000-0000-4000-8000-000000000101', '76000000-0000-4000-8000-000000000101', 'RBAC 설정', 'owner-a', '2026-12-31', '70000000-0000-4000-8000-000000000001');
select is(
	(public.validate_wbs_for_run('75000000-0000-4000-8000-000000000101') ->> 'taskCount')::integer,
	1,
	'one wbs task was added'
);

-- 4. content_path with absolute prefix is rejected
select throws_ok(
	$$insert into public.wbs_deliverables (tenant_id, project_id, task_id, title, content_path)
	  values ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101',
	    (select id from public.wbs_tasks where title = 'RBAC 설정' limit 1),
	    'RBAC 매트릭스', '/etc/passwd')$$,
	'23514',
	NULL,
	'deliverable content_path must be relative'
);

-- 5. hierarchy date conflict: child before parent
update public.wbs_tasks set due_date = '2027-01-31' where title = 'RBAC 설정';
insert into public.wbs_tasks (tenant_id, project_id, run_id, requirement_candidate_id, title, owner, due_date, parent_task_id, created_by)
values ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '75000000-0000-4000-8000-000000000101', '76000000-0000-4000-8000-000000000102', 'RBAC 자식 작업', 'owner-b', '2026-06-01',
	(select id from public.wbs_tasks where title = 'RBAC 설정' limit 1),
	'70000000-0000-4000-8000-000000000001');
select is(
	(public.validate_wbs_for_run('75000000-0000-4000-8000-000000000101') ->> 'hierarchyDateViolation')::integer,
	1,
	'child due_date before parent is reported as a hierarchy violation'
);
select is(
	(public.validate_wbs_for_run('75000000-0000-4000-8000-000000000101') ->> 'taskWithoutOwner')::integer,
	0,
	'both tasks have owners'
);

-- 6. owner can be NULL but blank owner is rejected
select throws_ok(
	$$update public.wbs_tasks set owner = '   ' where title = 'RBAC 자식 작업'$$,
	'23514',
	NULL,
	'blank owner is rejected by wbs_tasks_owner_not_blank'
);
update public.wbs_tasks set owner = 'owner-b' where title = 'RBAC 자식 작업';

-- 7. requirement coverage after adding a task for PMR-001
insert into public.wbs_tasks (tenant_id, project_id, run_id, requirement_candidate_id, title, owner, due_date, created_by)
values ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '75000000-0000-4000-8000-000000000101', '76000000-0000-4000-8000-000000000102', '주간보고서 양식', 'owner-c', '2026-12-31', '70000000-0000-4000-8000-000000000001');
select is(
	(public.validate_wbs_for_run('75000000-0000-4000-8000-000000000101') ->> 'requirementsWithoutTask')::integer,
	0,
	'every requirement now has a WBS task'
);

-- -----------------------------------------------------------------------------
-- M17: Meeting / Minute validations
-- -----------------------------------------------------------------------------

-- 8. minute content cannot be blank
select throws_ok(
	$$insert into public.meeting_minutes (meeting_id, content_md)
	  values ('00000000-0000-4000-8000-000000000999', '   ')$$,
	'23514',
	NULL,
	'blank meeting_minutes content is rejected'
);

-- 9. meeting status must be one of four
select throws_ok(
	$$insert into public.meetings (tenant_id, project_id, run_id, title, held_at, status, created_by)
	  values ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '75000000-0000-4000-8000-000000000101', '잘못된 상태 회의', '2026-09-01 10:00:00+09', 'WAITING', '70000000-0000-4000-8000-000000000001')$$,
	'23514',
	NULL,
	'meeting status must be DRAFT/REVIEWED/APPROVED/SUPERSEDED'
);

insert into public.meetings (tenant_id, project_id, run_id, title, held_at, status, created_by)
values ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '75000000-0000-4000-8000-000000000101', '킥오프 회의', '2026-09-01 10:00:00+09', 'DRAFT', '70000000-0000-4000-8000-000000000001');
select is(
	(public.validate_meetings_for_run('75000000-0000-4000-8000-000000000101') ->> 'draftCount')::integer,
	1,
	'one draft meeting exists'
);

-- 10. approval pair: approved_by without approved_at is rejected
select throws_ok(
	$$insert into public.meeting_minutes (meeting_id, content_md, approved_by)
	  values (
	    (select id from public.meetings where title = '킥오프 회의' limit 1),
	    '본문',
	    '70000000-0000-4000-8000-000000000001'
	  )$$,
	'23514',
	NULL,
	'approval_pair requires both approved_by and approved_at'
);

-- -----------------------------------------------------------------------------
-- M18: Risk validations
-- -----------------------------------------------------------------------------

insert into public.risks (tenant_id, project_id, run_id, title, severity, status, created_by)
values ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '75000000-0000-4000-8000-000000000101', '초기 인프라 지연', 'HIGH', 'OPEN', '70000000-0000-4000-8000-000000000001');
select is(
	(public.validate_risks_for_run('75000000-0000-4000-8000-000000000101') ->> 'openCount')::integer,
	1,
	'one open risk reported'
);

-- approval_pair: approved_by without approved_at is rejected
select throws_ok(
	$$update public.risks set approved_by = '70000000-0000-4000-8000-000000000001' where title = '초기 인프라 지연'$$,
	'23514',
	NULL,
	'risks approval_pair requires both approved_by and approved_at'
);

-- -----------------------------------------------------------------------------
-- M19: Inspection validations
-- -----------------------------------------------------------------------------

-- evidence required when result != PENDING
select throws_ok(
	$$insert into public.inspections (tenant_id, project_id, run_id, requirement_candidate_id, criterion, method, result, created_by)
	  values ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '75000000-0000-4000-8000-000000000101', '76000000-0000-4000-8000-000000000101', 'RBAC 정책 검토', '문서 점검', 'PASS', '70000000-0000-4000-8000-000000000001')$$,
	'23514',
	NULL,
	'final inspection result without evidence_ref is rejected'
);

insert into public.inspections (tenant_id, project_id, run_id, requirement_candidate_id, criterion, method, result, evidence_ref, created_by)
values ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '75000000-0000-4000-8000-000000000101', '76000000-0000-4000-8000-000000000101', 'RBAC 정책 검토', '문서 점검', 'PASS', 'evidence/rbac-v1.pdf', '70000000-0000-4000-8000-000000000001');
select is(
	(public.validate_inspections_for_run('75000000-0000-4000-8000-000000000101') ->> 'orphanCount')::integer,
	0,
	'inspection referencing a baseline candidate has zero orphans'
);

-- create a third candidate that is NOT in the baseline so the inspection
-- can be inserted but still detected as orphan by the M19 validator
insert into public.requirement_candidates (id, tenant_id, project_id, document_id, document_parse_id, run_id, candidate_order, official_id, source_text, interpretation, requirement_type, atomicity, provenance_state, content_sha256)
values ('76000000-0000-4000-8000-000000000103', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '72000000-0000-4000-8000-000000000101', '73000000-0000-4000-8000-000000000101', '75000000-0000-4000-8000-000000000101', 3, 'PSR-001', '○ PSR-001 보안감사', '보안 감사', 'SECURITY', 'ATOMIC', 'HUMAN_VERIFIED', repeat('3', 64));

-- orphan inspection: references a candidate that is not in the baseline
insert into public.inspections (tenant_id, project_id, run_id, requirement_candidate_id, criterion, method, result, evidence_ref, created_by)
values ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000101', '75000000-0000-4000-8000-000000000101', '76000000-0000-4000-8000-000000000103', '고아 검사', '문서 점검', 'PASS', 'evidence/orphan.pdf', '70000000-0000-4000-8000-000000000001');
select is(
	(public.validate_inspections_for_run('75000000-0000-4000-8000-000000000101') ->> 'orphanCount')::integer,
	1,
	'inspection referencing a non-baseline candidate is reported as orphan'
);

-- -----------------------------------------------------------------------------
-- M20: Closeout gate
-- -----------------------------------------------------------------------------

-- with one open risk and one draft meeting and one orphan, the gate is FALSE
select is(
	public.can_finalize_closeout('75000000-0000-4000-8000-000000000101'),
	false,
	'closeout is blocked while open risk, draft meeting, and orphan inspection exist'
);

-- close the open risk, approve the meeting, remove the orphan inspection
update public.risks set status = 'APPROVED', approved_by = '70000000-0000-4000-8000-000000000001', approved_at = now() where title = '초기 인프라 지연';
update public.meetings set status = 'APPROVED' where title = '킥오프 회의';
insert into public.meeting_minutes (meeting_id, content_md, approved_by, approved_at)
values (
	(select id from public.meetings where title = '킥오프 회의' limit 1),
	'킥오프 합의 사항',
	'70000000-0000-4000-8000-000000000001',
	now()
);
delete from public.inspections where criterion = '고아 검사';

-- hierarchy violation is still present: child due_date (2026-06-01) < parent (2027-01-31)
select is(
	public.can_finalize_closeout('75000000-0000-4000-8000-000000000101'),
	false,
	'closeout is still blocked by the hierarchy date violation'
);

-- fix hierarchy
update public.wbs_tasks set due_date = '2027-06-01' where title = 'RBAC 자식 작업';
select is(
	public.can_finalize_closeout('75000000-0000-4000-8000-000000000101'),
	true,
	'closeout gate opens once every validator is clean'
);

select * from finish();
rollback;
