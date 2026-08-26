begin;

select plan(27);

insert into auth.users (id, email)
values
	('51000000-0000-4000-8000-000000000001', 'm10-editor-a@example.test'),
	('51000000-0000-4000-8000-000000000002', 'm10-viewer-a@example.test'),
	('51000000-0000-4000-8000-000000000004', 'm10-tenant-admin-a@example.test'),
	('51000000-0000-4000-8000-000000000005', 'm10-editor-b@example.test');

insert into public.tenants (id, name, created_by)
values
	('52000000-0000-4000-8000-000000000001', 'M10 synthetic tenant A', '51000000-0000-4000-8000-000000000004'),
	('52000000-0000-4000-8000-000000000002', 'M10 synthetic tenant B', '51000000-0000-4000-8000-000000000005');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
	('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000004', 'TENANT_ADMIN');

insert into public.projects (id, tenant_id, name, created_by)
values
	('52000000-0000-4000-8000-000000000101', '52000000-0000-4000-8000-000000000001', 'M10 synthetic project A', '51000000-0000-4000-8000-000000000001'),
	('52000000-0000-4000-8000-000000000201', '52000000-0000-4000-8000-000000000002', 'M10 synthetic project B', '51000000-0000-4000-8000-000000000005');

insert into public.project_memberships (tenant_id, project_id, user_id, role)
values
	('52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101', '51000000-0000-4000-8000-000000000001', 'EDITOR'),
	('52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101', '51000000-0000-4000-8000-000000000002', 'VIEWER'),
	('52000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000201', '51000000-0000-4000-8000-000000000005', 'EDITOR');

insert into public.documents (
	id, tenant_id, project_id, privacy_classification, original_filename,
	media_type, byte_size, storage_path, sha256, created_by
)
values
	(
		'53000000-0000-4000-8000-000000000101',
		'52000000-0000-4000-8000-000000000001',
		'52000000-0000-4000-8000-000000000101',
		'INTERNAL', 'm10-a.synthetic.txt', 'text/plain', 64,
		'52000000-0000-4000-8000-000000000101/53000000-0000-4000-8000-000000000101/original',
		repeat('a', 64), '51000000-0000-4000-8000-000000000001'
	);

insert into public.document_parses (
	id, tenant_id, project_id, document_id, source_sha256, parser_key, parser_version,
	normalization_version, detected_format, warnings, span_count, result_sha256, created_by
)
values
	(
		'54000000-0000-4000-8000-000000000101',
		'52000000-0000-4000-8000-000000000001',
		'52000000-0000-4000-8000-000000000101',
		'53000000-0000-4000-8000-000000000101', repeat('a', 64),
		'plain-text', '1.0.0', 'nfc-lines-v1', 'txt', '[]', 3, repeat('1', 64),
		'51000000-0000-4000-8000-000000000001'
	);

insert into public.source_spans (
	id, tenant_id, project_id, document_id, document_parse_id, ordinal, location,
	original_text, normalized_text, original_text_sha256
)
values
	(
		'55000000-0000-4000-8000-000000000101',
		'52000000-0000-4000-8000-000000000001',
		'52000000-0000-4000-8000-000000000101',
		'53000000-0000-4000-8000-000000000101',
		'54000000-0000-4000-8000-000000000101', 1,
		'{"kind":"TEXT_LINES","lineStart":1,"lineEnd":1}',
		'○ SER-001 최소권한 요구', 'SER-001 최소권한 요구', private.source_text_sha256('○ SER-001 최소권한 요구')
	),
	(
		'55000000-0000-4000-8000-000000000102',
		'52000000-0000-4000-8000-000000000001',
		'52000000-0000-4000-8000-000000000101',
		'53000000-0000-4000-8000-000000000101',
		'54000000-0000-4000-8000-000000000101', 2,
		'{"kind":"TEXT_LINES","lineStart":2,"lineEnd":2}',
		'○ PMR-001 주간 보고 요구', 'PMR-001 주간 보고 요구', private.source_text_sha256('○ PMR-001 주간 보고 요구')
	),
	(
		'55000000-0000-4000-8000-000000000103',
		'52000000-0000-4000-8000-000000000001',
		'52000000-0000-4000-8000-000000000101',
		'53000000-0000-4000-8000-000000000101',
		'54000000-0000-4000-8000-000000000101', 3,
		'{"kind":"TEXT_LINES","lineStart":3,"lineEnd":3}',
		'○ PSR-001 교육 요구', 'PSR-001 교육 요구', private.source_text_sha256('○ PSR-001 교육 요구')
	);

insert into public.requirement_extraction_runs (
	id, tenant_id, project_id, document_id, document_parse_id, privacy_classification,
	provider, model, policy_version, prompt_version, schema_version, parse_result_sha256,
	canonical_input_sha256, fingerprint_sha256, accepted_output_sha256, created_by
)
values
	(
		'56000000-0000-4000-8000-000000000101',
		'52000000-0000-4000-8000-000000000001',
		'52000000-0000-4000-8000-000000000101',
		'53000000-0000-4000-8000-000000000101',
		'54000000-0000-4000-8000-000000000101', 'INTERNAL',
		'OPENAI', 'synthetic-model', 'document-privacy-v1', 'requirement-extraction-v1',
		'requirement-candidates-v1', repeat('1', 64), repeat('3', 64), repeat('4', 64),
		repeat('5', 64), '51000000-0000-4000-8000-000000000001'
	);

insert into public.requirement_candidates (
	id, tenant_id, project_id, document_id, document_parse_id, run_id, candidate_order,
	official_id, source_text, interpretation, requirement_type, atomicity, content_sha256
)
values
	(
		'57000000-0000-4000-8000-000000000101',
		'52000000-0000-4000-8000-000000000001',
		'52000000-0000-4000-8000-000000000101',
		'53000000-0000-4000-8000-000000000101',
		'54000000-0000-4000-8000-000000000101',
		'56000000-0000-4000-8000-000000000101', 1, 'SER-001',
		'○ SER-001 최소권한 요구', '최소권한으로 관리', 'SECURITY', 'ATOMIC', repeat('1', 64)
	),
	(
		'57000000-0000-4000-8000-000000000102',
		'52000000-0000-4000-8000-000000000001',
		'52000000-0000-4000-8000-000000000101',
		'53000000-0000-4000-8000-000000000101',
		'54000000-0000-4000-8000-000000000101',
		'56000000-0000-4000-8000-000000000101', 2, 'PMR-001',
		'○ PMR-001 주간 보고 요구', '주간 보고 수행', 'PROJECT_MANAGEMENT', 'ATOMIC', repeat('2', 64)
	),
	(
		'57000000-0000-4000-8000-000000000103',
		'52000000-0000-4000-8000-000000000001',
		'52000000-0000-4000-8000-000000000101',
		'53000000-0000-4000-8000-000000000101',
		'54000000-0000-4000-8000-000000000101',
		'56000000-0000-4000-8000-000000000101', 3, 'PSR-001',
		'○ PSR-001 교육 요구', '교육 제공', 'PROJECT_SUPPORT', 'ATOMIC', repeat('3', 64)
	);

insert into public.requirement_candidate_source_spans (
	tenant_id, project_id, document_id, document_parse_id, run_id,
	candidate_id, source_span_id, source_order
)
values
	('52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101', '53000000-0000-4000-8000-000000000101', '54000000-0000-4000-8000-000000000101', '56000000-0000-4000-8000-000000000101', '57000000-0000-4000-8000-000000000101', '55000000-0000-4000-8000-000000000101', 1),
	('52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101', '53000000-0000-4000-8000-000000000101', '54000000-0000-4000-8000-000000000101', '56000000-0000-4000-8000-000000000101', '57000000-0000-4000-8000-000000000102', '55000000-0000-4000-8000-000000000102', 1),
	('52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000101', '53000000-0000-4000-8000-000000000101', '54000000-0000-4000-8000-000000000101', '56000000-0000-4000-8000-000000000101', '57000000-0000-4000-8000-000000000103', '55000000-0000-4000-8000-000000000103', 1);

-- 1. authenticated users cannot call the trusted review functions.
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select throws_ok(
	format(
		'SELECT public.review_requirement_candidate(%L, %L, %L, %L)',
		'51000000-0000-4000-8000-000000000001',
		'56000000-0000-4000-8000-000000000101',
		'57000000-0000-4000-8000-000000000101',
		'APPROVE'
	),
	'42501',
	NULL,
	'authenticated direct review RPC execution is denied'
);

reset role;

-- 2. service-role execution with an explicit actor.
set local role service_role;

-- 2a. editor approves candidate 1.
select is(
	public.review_requirement_candidate(
		'51000000-0000-4000-8000-000000000001',
		'56000000-0000-4000-8000-000000000101',
		'57000000-0000-4000-8000-000000000101',
		'APPROVE',
		NULL
	),
	jsonb_build_object(
		'candidateId', '57000000-0000-4000-8000-000000000101',
		'provenanceState', 'HUMAN_VERIFIED'
	),
	'editor approval promotes the candidate to HUMAN_VERIFIED'
);

select is(
	(
		select provenance_state || '|' || coalesce(reviewed_by::text, 'none')
		from public.requirement_candidates
		where id = '57000000-0000-4000-8000-000000000101'
	),
	'HUMAN_VERIFIED|51000000-0000-4000-8000-000000000001',
	'approval records the reviewing editor'
);

-- 2b. viewer actor is denied.
select throws_ok(
	format(
		'SELECT public.review_requirement_candidate(%L, %L, %L, %L)',
		'51000000-0000-4000-8000-000000000002',
		'56000000-0000-4000-8000-000000000101',
		'57000000-0000-4000-8000-000000000102',
		'APPROVE'
	),
	'42501',
	NULL,
	'viewer actor cannot approve candidates'
);

-- 2c. cross-project editor actor is denied.
select throws_ok(
	format(
		'SELECT public.review_requirement_candidate(%L, %L, %L, %L)',
		'51000000-0000-4000-8000-000000000005',
		'56000000-0000-4000-8000-000000000101',
		'57000000-0000-4000-8000-000000000102',
		'APPROVE'
	),
	'42501',
	NULL,
	'cross-project editor actor cannot review candidates'
);

-- 2d. unknown actor is denied.
select throws_ok(
	format(
		'SELECT public.review_requirement_candidate(%L, %L, %L, %L)',
		'ffffffff-ffff-4fff-8fff-ffffffffffff',
		'56000000-0000-4000-8000-000000000101',
		'57000000-0000-4000-8000-000000000102',
		'APPROVE'
	),
	'42501',
	NULL,
	'unknown actor cannot review candidates'
);

-- 2e. rejected candidates are final.
select is(
	public.review_requirement_candidate(
		'51000000-0000-4000-8000-000000000001',
		'56000000-0000-4000-8000-000000000101',
		'57000000-0000-4000-8000-000000000102',
		'REJECT',
		NULL
	),
	jsonb_build_object(
		'candidateId', '57000000-0000-4000-8000-000000000102',
		'provenanceState', 'REJECTED'
	),
	'editor rejects candidate 2'
);
select throws_ok(
	format(
		'SELECT public.review_requirement_candidate(%L, %L, %L, %L)',
		'51000000-0000-4000-8000-000000000001',
		'56000000-0000-4000-8000-000000000101',
		'57000000-0000-4000-8000-000000000102',
		'APPROVE'
	),
	'42501',
	NULL,
	'rejected candidates cannot be re-reviewed'
);

-- 2f. needs-review transition works from AI_DRAFT.
select is(
	public.review_requirement_candidate(
		'51000000-0000-4000-8000-000000000001',
		'56000000-0000-4000-8000-000000000101',
		'57000000-0000-4000-8000-000000000103',
		'NEEDS_REVIEW',
		NULL
	),
	jsonb_build_object(
		'candidateId', '57000000-0000-4000-8000-000000000103',
		'provenanceState', 'REVIEW_REQUIRED'
	),
	'editor flags candidate 3 for review'
);

-- 2g. invalid action and blank edit text fail closed.
select throws_ok(
	format(
		'SELECT public.review_requirement_candidate(%L, %L, %L, %L)',
		'51000000-0000-4000-8000-000000000001',
		'56000000-0000-4000-8000-000000000101',
		'57000000-0000-4000-8000-000000000101',
		'DESTROY'
	),
	'22023',
	NULL,
	'unknown review actions are rejected'
);
select throws_ok(
	format(
		'SELECT public.review_requirement_candidate(%L, %L, %L, %L, %L)',
		'51000000-0000-4000-8000-000000000001',
		'56000000-0000-4000-8000-000000000101',
		'57000000-0000-4000-8000-000000000101',
		'EDIT',
		'   '
	),
	'22023',
	NULL,
	'blank edit interpretation is rejected'
);

-- 2h. edit rewrites the interpretation and records the reviewer.
select is(
	public.review_requirement_candidate(
		'51000000-0000-4000-8000-000000000001',
		'56000000-0000-4000-8000-000000000101',
		'57000000-0000-4000-8000-000000000101',
		'EDIT',
		'수정된 해석입니다'
	),
	jsonb_build_object(
		'candidateId', '57000000-0000-4000-8000-000000000101',
		'provenanceState', 'HUMAN_VERIFIED'
	),
	'edit promotes the candidate to HUMAN_VERIFIED'
);
select is(
	(
		select interpretation
		from public.requirement_candidates
		where id = '57000000-0000-4000-8000-000000000101'
	),
	'수정된 해석입니다',
	'edit persists the new interpretation'
);

reset role;

-- 3. merge candidates 1 (HUMAN_VERIFIED) and 3 (REVIEW_REQUIRED) into one.
set local role service_role;

select is(
	jsonb_array_length(
		public.merge_requirement_candidates(
			'51000000-0000-4000-8000-000000000001',
			'56000000-0000-4000-8000-000000000101',
			'["57000000-0000-4000-8000-000000000101","57000000-0000-4000-8000-000000000103"]',
			'병합된 요구사항 해석'
		) -> 'candidateIds'
	),
	1,
	'merge returns one new candidate id'
);

select is(
	(
		select provenance_state
		from public.requirement_candidates
		where run_id = '56000000-0000-4000-8000-000000000101'
			and interpretation = '병합된 요구사항 해석'
	),
	'HUMAN_VERIFIED',
	'merged candidate is human verified with evidence'
);

select is(
	(
		select count(*)::integer
		from public.requirement_candidate_source_spans
		where candidate_id = (
			select id from public.requirement_candidates
			where interpretation = '병합된 요구사항 해석'
		)
	),
	2,
	'merged candidate cites the union of source evidence'
);

select is(
	(
		select count(*)::integer
		from public.requirement_candidates
		where id in (
			'57000000-0000-4000-8000-000000000101',
			'57000000-0000-4000-8000-000000000103'
		)
		and provenance_state = 'REJECTED'
	),
	2,
	'merged source candidates are rejected'
);

select is(
	(
		select candidate_order
		from public.requirement_candidates
		where interpretation = '병합된 요구사항 해석'
	),
	4,
	'merged candidate order exceeds every existing order including rejected ones'
);

select throws_ok(
	format(
		'SELECT public.merge_requirement_candidates(%L, %L, %L, %L)',
		'51000000-0000-4000-8000-000000000001',
		'56000000-0000-4000-8000-000000000101',
		'["57000000-0000-4000-8000-000000000102"]',
		'단일 병합'
	),
	'22023',
	NULL,
	'merge requires at least two candidates'
);

reset role;

-- 4. split the merged candidate into two evidence-disjoint parts.
set local role service_role;

select is(
	jsonb_array_length(
		public.split_requirement_candidate(
			'51000000-0000-4000-8000-000000000001',
			'56000000-0000-4000-8000-000000000101',
			(
				select id from public.requirement_candidates
				where interpretation = '병합된 요구사항 해석'
			),
			'[{"interpretation": "분할 파트 하나", "sourceSpanOrdinals": [1]},{"interpretation": "분할 파트 둘", "sourceSpanOrdinals": [3]}]'
		) -> 'candidateIds'
	),
	2,
	'split returns two new candidate ids'
);

select is(
	(
		select count(*)::integer
		from public.requirement_candidates
		where run_id = '56000000-0000-4000-8000-000000000101'
			and provenance_state = 'HUMAN_VERIFIED'
			and interpretation in ('분할 파트 하나', '분할 파트 둘')
	),
	2,
	'split created two human-verified parts'
);

select is(
	(
		select provenance_state
		from public.requirement_candidates
		where interpretation = '병합된 요구사항 해석'
	),
	'REJECTED',
	'split source candidate is rejected'
);

select throws_ok(
	format(
		'SELECT public.split_requirement_candidate(%L, %L, (SELECT id FROM public.requirement_candidates WHERE interpretation = %L), %L)',
		'51000000-0000-4000-8000-000000000001',
		'56000000-0000-4000-8000-000000000101',
		'분할 파트 하나',
		'[{"interpretation": "빈 증거 파트", "sourceSpanOrdinals": []},{"interpretation": "나머지", "sourceSpanOrdinals": [1]}]'
	),
	'22023',
	NULL,
	'split parts must each cite evidence'
);

select throws_ok(
	format(
		'SELECT public.split_requirement_candidate(%L, %L, (SELECT id FROM public.requirement_candidates WHERE interpretation = %L), %L)',
		'51000000-0000-4000-8000-000000000001',
		'56000000-0000-4000-8000-000000000101',
		'분할 파트 하나',
		'[{"interpretation": "하나만", "sourceSpanOrdinals": [1]}]'
	),
	'22023',
	NULL,
	'split requires at least two parts'
);

reset role;

-- 5. audit trail records human review transitions.
select is(
	(
		select count(*)::integer
		from public.audit_events
		where event_type = 'REQUIREMENT_CANDIDATE_REVIEWED'
			and actor_user_id = '51000000-0000-4000-8000-000000000001'
	),
	4,
	'human review transitions are audited'
);

select is(
	(
		select count(*)::integer
		from public.audit_events
		where event_type in ('REQUIREMENT_CANDIDATES_MERGED', 'REQUIREMENT_CANDIDATE_SPLIT')
	),
	2,
	'merge and split transitions are audited'
);

select is(
	(
		select count(*)::integer
		from public.audit_events
		where event_type like 'REQUIREMENT_CANDIDATE%'
			and event_data::text like '%최소권한 요구%'
	),
	0,
	'review audit never stores source text'
);

select * from finish();
rollback;
