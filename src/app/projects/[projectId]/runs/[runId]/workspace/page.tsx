import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createTrustedSupabaseClient } from "@/lib/supabase/trusted-server";
import { logout } from "@/app/projects/actions";
import {
	approveArtifactAction,
	approveMeetingAction,
	approveRiskAction,
	approveTemplateMappingAction,
	createInspectionAction,
	createMeetingAction,
	createRiskAction,
	createWbsDeliverableAction,
	createWbsTaskAction,
	generateArtifactAction,
	recordCloseoutAction,
	recordTemplateFieldAction,
	registerTemplateAction,
	submitTemplateMappingAction,
} from "./actions";

type WorkspacePageProps = {
	params: Promise<{ projectId: string; runId: string }>;
	searchParams: Promise<{ status?: string | string[] }>;
};

const STATUS_LABELS: Record<string, string> = {
	wbs_created: "WBS 작업이 추가되었습니다.",
	wbs_failed: "WBS 작업 추가에 실패했습니다.",
	deliverable_created: "산출물이 추가되었습니다.",
	deliverable_failed: "산출물 추가에 실패했습니다.",
	meeting_created: "회의가 등록되었습니다.",
	meeting_failed: "회의 등록에 실패했습니다.",
	minute_approved: "H9 회의록 승인이 기록되었습니다.",
	minute_failed: "H9 회의록 승인이 실패했습니다.",
	risk_created: "리스크가 등록되었습니다.",
	risk_failed: "리스크 등록에 실패했습니다.",
	risk_approved: "H 리스크 승인이 기록되었습니다.",
	inspection_created: "검사가 추가되었습니다.",
	inspection_failed: "검사 추가에 실패했습니다.",
	template_registered: "회사/고객 템플릿이 등록되었습니다 (HWPX).",
	template_failed: "템플릿 등록에 실패했습니다.",
	template_field_recorded: "템플릿 필드가 기록되었습니다.",
	template_field_failed: "템플릿 필드 기록에 실패했습니다.",
	template_mapping_submitted: "H8 매핑 검토가 제출되었습니다.",
	template_mapping_approved: "H8 매핑이 승인되었습니다.",
	template_mapping_failed: "H8 매핑 처리에 실패했습니다.",
	artifact_generated: "산출물이 생성되었습니다 (검증 PASS).",
	artifact_approved: "H10 최종 산출물 승인이 기록되었습니다.",
	artifact_failed: "산출물 생성/승인에 실패했습니다.",
	closeout_recorded: "Closeout이 기록되었습니다 (H10).",
	closeout_blocked: "Closeout 게이트가 닫혀 있습니다. 모든 항목 검증 후 다시 시도하세요.",
	closeout_failed: "Closeout 기록에 실패했습니다.",
};

function firstStatus(value: string | string[] | undefined): string | null {
	if (Array.isArray(value)) return value[0] ?? null;
	return typeof value === "string" ? value : null;
}

export default async function WorkspacePage({ params, searchParams }: WorkspacePageProps) {
	const { projectId, runId } = await params;
	const { status: statusParam } = await searchParams;
	const status = firstStatus(statusParam);
	const statusMessage = status ? STATUS_LABELS[status] ?? null : null;

	const supabase = await createServerSupabaseClient();
	const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
	if (claimsError || typeof claimsData?.claims?.sub !== "string") {
		redirect("/login");
	}

	const [projectResult, tasksResult, meetingsResult, risksResult, inspectionsResult, closeoutResult, candidatesResult] =
		await Promise.all([
			supabase.from("projects").select("id, name, tenant_id").eq("id", projectId).maybeSingle(),
			supabase.from("wbs_tasks").select("id, title, owner, due_date, requirement_candidate_id").eq("run_id", runId).order("title"),
			supabase.from("meetings").select("id, title, held_at, status").eq("run_id", runId).order("held_at", { ascending: false }),
			supabase.from("risks").select("id, title, severity, status, approved_at").eq("run_id", runId).order("severity"),
			supabase.from("inspections").select("id, criterion, method, result, inspected_at").eq("run_id", runId).order("inspected_at", { ascending: false }),
			supabase.from("closeouts").select("id, final_accepted, security_terminated, approved_at").eq("run_id", runId).maybeSingle(),
			supabase.from("requirement_candidates").select("id, official_id, interpretation").eq("run_id", runId).order("candidate_order"),
		]);

	if (projectResult.error || !projectResult.data) {
		notFound();
	}
	const project = projectResult.data;

	const trusted = createTrustedSupabaseClient();
	const [wbsGate, risksGate, inspectionsGate, meetingsGate, templatesResult, mappingsResult, artifactsResult] = await Promise.all([
		trusted.rpc("validate_wbs_for_run", { p_run_id: runId }),
		trusted.rpc("validate_risks_for_run", { p_run_id: runId }),
		trusted.rpc("validate_inspections_for_run", { p_run_id: runId }),
		trusted.rpc("validate_meetings_for_run", { p_run_id: runId }),
		supabase.from("artifact_templates").select("id, original_filename, version, sha256, detected_format").eq("project_id", projectId).order("version", { ascending: false }),
		supabase.from("artifact_template_mappings").select("id, template_id, version, approved_at, source_kind").order("version", { ascending: false }),
		supabase.from("generated_artifacts").select("id, template_id, mapping_id, content_sha256, approved_at, unresolved_required_fields").order("created_at", { ascending: false }),
	]);

	return (
		<>
			<AppHeader
				actions={
					<form action={logout}>
						<button className="krds-btn small secondary" type="submit">
							로그아웃
						</button>
					</form>
				}
			/>
			<main className="app-inner app-page">
				<a className="app-skip-link" href="#workspace-content">
					작업 영역 본문으로 건너뛰기
				</a>
				<Link
					className="krds-btn small text app-back-link"
					href={`/projects/${projectId}/rfp`}
				>
					RFP 목록으로 돌아가기
				</Link>
				<h1 className="app-page-title">
					작업 영역 · {project.name} (M15~M20 통합 보기)
				</h1>
				<p className="app-page-lead">
					WBS, 회의록, 리스크/이슈/변경, 검사/근거, Closeout 항목을 Requirement
					Baseline에서 도출된 run 단위로 추적합니다.
				</p>

				{statusMessage ? (
					<p className="app-status" role="status" data-status={status ?? ""}>
						{statusMessage}
					</p>
				) : null}

				<section
					aria-labelledby="workspace-heading"
					className="app-section"
					id="workspace-content"
					tabIndex={-1}
				>
					<h2 className="app-section-title" id="workspace-heading">
						WBS 작업 (M15)
					</h2>
					<dl className="app-meta-grid">
						<dt>요구사항 수</dt>
						<dd>{(wbsGate.data as { requirementCount?: number } | null)?.requirementCount ?? 0}</dd>
						<dt>작업 수</dt>
						<dd>{(wbsGate.data as { taskCount?: number } | null)?.taskCount ?? 0}</dd>
						<dt>요구 미충족</dt>
						<dd>{(wbsGate.data as { requirementsWithoutTask?: number } | null)?.requirementsWithoutTask ?? 0}</dd>
						<dt>담당 미지정</dt>
						<dd>{(wbsGate.data as { taskWithoutOwner?: number } | null)?.taskWithoutOwner ?? 0}</dd>
						<dt>계층 날짜 충돌</dt>
						<dd>{(wbsGate.data as { hierarchyDateViolation?: number } | null)?.hierarchyDateViolation ?? 0}</dd>
					</dl>
					<ul className="app-span-list">
						{(tasksResult.data ?? []).map((task) => (
							<li className="app-evidence-item" key={task.id}>
								<p>{task.title}</p>
								<p className="app-muted">
									담당: {task.owner ?? "미배정"} · 마감: {task.due_date ?? "미정"} ·
									원본 요구:{" "}
									{task.requirement_candidate_id
										? task.requirement_candidate_id.slice(0, 8)
										: "(없음)"}
								</p>
							</li>
						))}
					</ul>
					<form action={createWbsTaskAction} className="app-form-grid">
						<input type="hidden" name="projectId" value={projectId} />
						<input type="hidden" name="runId" value={runId} />
						<label>
							작업 제목
							<input name="title" required maxLength={200} />
						</label>
						<label>
							담당자
							<input name="owner" maxLength={120} placeholder="예: 홍길동" />
						</label>
						<label>
							마감일
							<input name="dueDate" type="date" />
						</label>
						<label>
							요구사항
							<select name="requirementCandidateId" required>
								<option value="">선택</option>
								{(candidatesResult.data ?? []).map((candidate) => (
									<option key={candidate.id} value={candidate.id}>
										{candidate.official_id ?? candidate.id.slice(0, 8)} ·{" "}
										{candidate.interpretation}
									</option>
								))}
							</select>
						</label>
						<button className="krds-btn primary" type="submit">
							WBS 작업 추가
						</button>
					</form>
					<form action={createWbsDeliverableAction} className="app-form-grid">
						<input type="hidden" name="projectId" value={projectId} />
						<input type="hidden" name="runId" value={runId} />
						<label>
							상위 작업
							<select name="taskId" required>
								<option value="">선택</option>
								{(tasksResult.data ?? []).map((task) => (
									<option key={task.id} value={task.id}>
										{task.title}
									</option>
								))}
							</select>
						</label>
						<label>
							산출물 제목
							<input name="title" required maxLength={200} />
						</label>
						<label>
							상대 경로 (선택)
							<input name="contentPath" maxLength={500} placeholder="deliverables/report.docx" />
						</label>
						<button className="krds-btn secondary" type="submit">
							산출물 추가
						</button>
					</form>
				</section>

				<section
					aria-labelledby="meetings-heading"
					className="app-section"
				>
					<h2 className="app-section-title" id="meetings-heading">
						회의록 (M17)
					</h2>
					<dl className="app-meta-grid">
						<dt>회의 수</dt>
						<dd>{(meetingsGate.data as { meetingCount?: number } | null)?.meetingCount ?? 0}</dd>
						<dt>DRAFT</dt>
						<dd>{(meetingsGate.data as { draftCount?: number } | null)?.draftCount ?? 0}</dd>
						<dt>미승인</dt>
						<dd>{(meetingsGate.data as { unapprovedCount?: number } | null)?.unapprovedCount ?? 0}</dd>
					</dl>
					<ul className="app-span-list">
						{(meetingsResult.data ?? []).map((meeting) => (
							<li className="app-evidence-item" key={meeting.id}>
								<p>{meeting.title}</p>
								<p className="app-muted">
									{new Date(meeting.held_at).toISOString()} · {meeting.status}
								</p>
							</li>
						))}
					</ul>
					<form action={createMeetingAction} className="app-form-grid">
						<input type="hidden" name="projectId" value={projectId} />
						<input type="hidden" name="runId" value={runId} />
						<label>
							회의 제목
							<input name="title" required maxLength={200} />
						</label>
						<label>
							개최 일시
							<input name="heldAt" type="datetime-local" required />
						</label>
						<button className="krds-btn primary" type="submit">
							회의 등록 (DRAFT)
						</button>
					</form>
					<form action={approveMeetingAction} className="app-form-grid">
						<input type="hidden" name="projectId" value={projectId} />
						<input type="hidden" name="runId" value={runId} />
						<label>
							H9 승인할 회의
							<select name="meetingId" required>
								<option value="">선택</option>
								{(meetingsResult.data ?? []).map((meeting) => (
									<option key={meeting.id} value={meeting.id}>
										{meeting.title} ({meeting.status})
									</option>
								))}
							</select>
						</label>
						<label>
							회의록 본문 (Markdown)
							<textarea name="contentMd" rows={4} required />
						</label>
						<button className="krds-btn primary" type="submit">
							H9 회의록 승인
						</button>
					</form>
				</section>

				<section
					aria-labelledby="risks-heading"
					className="app-section"
				>
					<h2 className="app-section-title" id="risks-heading">
						리스크 / 이슈 / 변경 (M18)
					</h2>
					<dl className="app-meta-grid">
						<dt>열림</dt>
						<dd>{(risksGate.data as { openCount?: number } | null)?.openCount ?? 0}</dd>
						<dt>승인됨</dt>
						<dd>{(risksGate.data as { approvedCount?: number } | null)?.approvedCount ?? 0}</dd>
						<dt>반려됨</dt>
						<dd>{(risksGate.data as { rejectedCount?: number } | null)?.rejectedCount ?? 0}</dd>
					</dl>
					<ul className="app-span-list">
						{(risksResult.data ?? []).map((risk) => (
							<li className="app-evidence-item" key={risk.id}>
								<p>{risk.title}</p>
								<p className="app-muted">
									심각도: {risk.severity} · 상태: {risk.status} · 사람 승인:{" "}
									{risk.approved_at ? "완료" : "대기"}
								</p>
							</li>
						))}
					</ul>
					<form action={createRiskAction} className="app-form-grid">
						<input type="hidden" name="projectId" value={projectId} />
						<input type="hidden" name="runId" value={runId} />
						<label>
							리스크 제목
							<input name="title" required maxLength={200} />
						</label>
						<label>
							심각도
							<select name="severity" required>
								<option value="LOW">낮음</option>
								<option value="MEDIUM">보통</option>
								<option value="HIGH">높음</option>
								<option value="CRITICAL">심각</option>
							</select>
						</label>
						<label>
							원본 요구사항 (선택)
							<select name="requirementCandidateId">
								<option value="">(없음)</option>
								{(candidatesResult.data ?? []).map((candidate) => (
									<option key={candidate.id} value={candidate.id}>
										{candidate.official_id ?? candidate.id.slice(0, 8)}
									</option>
								))}
							</select>
						</label>
						<button className="krds-btn primary" type="submit">
							리스크 등록 (AI 후보)
						</button>
					</form>
					<form action={approveRiskAction} className="app-form-grid">
						<input type="hidden" name="projectId" value={projectId} />
						<input type="hidden" name="runId" value={runId} />
						<label>
							승인할 리스크
							<select name="riskId" required>
								<option value="">선택</option>
								{(risksResult.data ?? []).map((risk) => (
									<option key={risk.id} value={risk.id}>
										{risk.title} ({risk.status})
									</option>
								))}
							</select>
						</label>
						<button className="krds-btn primary" type="submit">
							H 리스크 승인
						</button>
					</form>
				</section>

				<section
					aria-labelledby="inspections-heading"
					className="app-section"
				>
					<h2 className="app-section-title" id="inspections-heading">
						검사 / 근거 (M19)
					</h2>
					<dl className="app-meta-grid">
						<dt>총 검사</dt>
						<dd>{(inspectionsGate.data as { inspectionCount?: number } | null)?.inspectionCount ?? 0}</dd>
						<dt>합격</dt>
						<dd>{(inspectionsGate.data as { passCount?: number } | null)?.passCount ?? 0}</dd>
						<dt>불합격</dt>
						<dd>{(inspectionsGate.data as { failCount?: number } | null)?.failCount ?? 0}</dd>
						<dt>대기</dt>
						<dd>{(inspectionsGate.data as { pendingCount?: number } | null)?.pendingCount ?? 0}</dd>
						<dt>고아 검사</dt>
						<dd>{(inspectionsGate.data as { orphanCount?: number } | null)?.orphanCount ?? 0}</dd>
					</dl>
					<ul className="app-span-list">
						{(inspectionsResult.data ?? []).map((inspection) => (
							<li className="app-evidence-item" key={inspection.id}>
								<p>{inspection.criterion}</p>
								<p className="app-muted">
									방법: {inspection.method} · 결과: {inspection.result}
								</p>
							</li>
						))}
					</ul>
					<form action={createInspectionAction} className="app-form-grid">
						<input type="hidden" name="projectId" value={projectId} />
						<input type="hidden" name="runId" value={runId} />
						<label>
							판정 기준
							<input name="criterion" required maxLength={500} />
						</label>
						<label>
							검사 방법
							<input name="method" required maxLength={500} />
						</label>
						<label>
							결과
							<select name="result" required>
								<option value="PASS">PASS</option>
								<option value="FAIL">FAIL</option>
								<option value="PENDING">PENDING</option>
							</select>
						</label>
						<label>
							근거 경로 (PASS/FAIL 필수)
							<input name="evidenceRef" maxLength={500} placeholder="evidence/..." />
						</label>
						<label>
							원본 요구사항 (선택)
							<select name="requirementCandidateId">
								<option value="">(없음)</option>
								{(candidatesResult.data ?? []).map((candidate) => (
									<option key={candidate.id} value={candidate.id}>
										{candidate.official_id ?? candidate.id.slice(0, 8)}
									</option>
								))}
							</select>
						</label>
						<button className="krds-btn primary" type="submit">
							검사 추가
						</button>
					</form>
				</section>

				<section
					aria-labelledby="artifacts-heading"
					className="app-section"
				>
					<h2 className="app-section-title" id="artifacts-heading">
						회사/고객 Template 기반 산출물 (M16)
					</h2>
					<p className="app-muted">
						HWPX 템플릿의 바이트 해시가 버전의 원본입니다. 같은 바이트를 다시 업로드하면
						같은 버전이 반환되며 원본은 덮어쓰지 않습니다. 매핑은 H8 인간 승인 후에만
						산출물 생성에 사용할 수 있습니다.
					</p>
					<ul className="app-span-list">
						{(templatesResult.data ?? []).map((template) => (
							<li className="app-evidence-item" key={template.id}>
								<p>
									{template.original_filename} · v{template.version} ·{" "}
									{template.detected_format}
								</p>
								<p className="app-muted">sha256: {template.sha256}</p>
							</li>
						))}
					</ul>
					<form action={registerTemplateAction} className="app-form-grid">
						<input type="hidden" name="projectId" value={projectId} />
						<input type="hidden" name="runId" value={runId} />
						<label>
							원본 파일명
							<input name="originalFilename" required maxLength={255} placeholder="company-template.hwpx" />
						</label>
						<label>
							저장 경로
							<input name="storagePath" required maxLength={500} placeholder={`${projectId}/templates/company.hwpx`} />
						</label>
						<label>
							바이트 sha256
							<input name="sha256" required pattern="[0-9a-f]{64}" maxLength={64} placeholder="64자 hex" />
						</label>
						<input type="hidden" name="mediaType" value="application/hwp+zip" />
						<button className="krds-btn primary" type="submit">
							템플릿 등록 (불변 버전)
						</button>
					</form>

					<form action={recordTemplateFieldAction} className="app-form-grid">
						<input type="hidden" name="projectId" value={projectId} />
						<input type="hidden" name="runId" value={runId} />
						<label>
							대상 템플릿
							<select name="templateId" required>
								<option value="">선택</option>
								{(templatesResult.data ?? []).map((template) => (
									<option key={template.id} value={template.id}>
										{template.original_filename} v{template.version}
									</option>
								))}
							</select>
						</label>
						<label>
							필드 키
							<input name="fieldKey" required maxLength={128} placeholder="contract_title" />
						</label>
						<label>
							앵커 종류
							<select name="anchorKind" required>
								<option value="PARAGRAPH">PARAGRAPH</option>
								<option value="TABLE_CELL">TABLE_CELL</option>
								<option value="TEXT_BOX">TEXT_BOX</option>
								<option value="RUN">RUN</option>
								<option value="HEADER">HEADER</option>
								<option value="FOOTER">FOOTER</option>
							</select>
						</label>
						<label>
							앵커 셀렉터
							<input name="anchorSelector" required maxLength={1024} placeholder="/section[1]/p[1]" />
						</label>
						<label>
							설명
							<input name="description" maxLength={500} />
						</label>
						<label className="app-checkbox">
							<input name="required" type="checkbox" />
							필수 필드
						</label>
						<button className="krds-btn secondary" type="submit">
							필드 기록
						</button>
					</form>

					<form action={submitTemplateMappingAction} className="app-form-grid">
						<input type="hidden" name="projectId" value={projectId} />
						<input type="hidden" name="runId" value={runId} />
						<label>
							대상 템플릿
							<select name="templateId" required>
								<option value="">선택</option>
								{(templatesResult.data ?? []).map((template) => (
									<option key={template.id} value={template.id}>
										{template.original_filename} v{template.version}
									</option>
								))}
							</select>
						</label>
						<label>
							소스 종류
							<select name="sourceKind" required>
								<option value="REQUIREMENT_BASELINE">REQUIREMENT_BASELINE</option>
								<option value="CONTRACT_BASELINE">CONTRACT_BASELINE</option>
								<option value="WBS_TASK">WBS_TASK</option>
								<option value="INSPECTION">INSPECTION</option>
								<option value="MEETING_MINUTE">MEETING_MINUTE</option>
								<option value="CLOSE_OUT">CLOSE_OUT</option>
								<option value="MANUAL_INPUT">MANUAL_INPUT</option>
							</select>
						</label>
						<label>
							소스 ID
							<input name="sourceId" required pattern="[0-9a-f-]{36}" maxLength={64} />
						</label>
						<label>
							매핑 JSON
							<textarea name="mappingJson" rows={4} required defaultValue='{"contract_title":{"type":"manual","value":"계약서 제목"}}' />
						</label>
						<button className="krds-btn primary" type="submit">
							H8 매핑 검토 제출
						</button>
					</form>

					<form action={approveTemplateMappingAction} className="app-form-grid">
						<input type="hidden" name="projectId" value={projectId} />
						<input type="hidden" name="runId" value={runId} />
						<label>
							H8 승인할 매핑
							<select name="mappingId" required>
								<option value="">선택</option>
								{(mappingsResult.data ?? []).map((mapping) => (
									<option key={mapping.id} value={mapping.id}>
										template v{mapping.version} · {mapping.source_kind} · {mapping.approved_at ? "승인됨" : "대기"}
									</option>
								))}
							</select>
						</label>
						<button className="krds-btn primary" type="submit">
							H8 매핑 승인
						</button>
					</form>

					<form action={generateArtifactAction} className="app-form-grid">
						<input type="hidden" name="projectId" value={projectId} />
						<input type="hidden" name="runId" value={runId} />
						<label>
							승인된 매핑
							<select name="mappingId" required>
								<option value="">선택</option>
								{(mappingsResult.data ?? [])
									.filter((mapping) => mapping.approved_at)
									.map((mapping) => (
										<option key={mapping.id} value={mapping.id}>
											template v{mapping.version} · {mapping.source_kind}
										</option>
									))}
							</select>
						</label>
						<label>
							저장 경로
							<input name="storagePath" required maxLength={500} placeholder={`${projectId}/artifacts/final.hwpx`} />
						</label>
						<label>
							생성 산출물 sha256
							<input name="contentSha256" required pattern="[0-9a-f]{64}" maxLength={64} />
						</label>
						<button className="krds-btn primary" type="submit">
							산출물 생성 (H8 매핑 + 검증 PASS 필수)
						</button>
					</form>

					<ul className="app-span-list">
						{(artifactsResult.data ?? []).map((artifact) => (
							<li className="app-evidence-item" key={artifact.id}>
								<p>
									artifact · sha256 {artifact.content_sha256.slice(0, 12)}…
									{artifact.approved_at ? " · H10 승인" : " · 미승인"}
								</p>
								{Array.isArray(artifact.unresolved_required_fields) &&
								(artifact.unresolved_required_fields as unknown[]).length > 0 ? (
									<p className="app-muted">
										미해결 필수 필드:{" "}
										{(artifact.unresolved_required_fields as string[]).join(", ")}
									</p>
								) : null}
							</li>
						))}
					</ul>

					<form action={approveArtifactAction} className="app-form-grid">
						<input type="hidden" name="projectId" value={projectId} />
						<input type="hidden" name="runId" value={runId} />
						<label>
							H10 승인할 산출물
							<select name="artifactId" required>
								<option value="">선택</option>
								{(artifactsResult.data ?? [])
									.filter((artifact) => !artifact.approved_at)
									.map((artifact) => (
										<option key={artifact.id} value={artifact.id}>
											{artifact.content_sha256.slice(0, 12)}…
										</option>
									))}
							</select>
						</label>
						<button className="krds-btn primary" type="submit">
							H10 산출물 승인
						</button>
					</form>
				</section>

				<section
					aria-labelledby="closeout-heading"
					className="app-section"
				>
					<h2 className="app-section-title" id="closeout-heading">
						Closeout / 지식 재사용 (M20)
					</h2>
					{closeoutResult.data ? (
						<dl className="app-meta-grid">
							<dt>최종 인수</dt>
							<dd>{closeoutResult.data.final_accepted ? "예" : "아니오"}</dd>
							<dt>보안 종료</dt>
							<dd>{closeoutResult.data.security_terminated ? "예" : "아니오"}</dd>
							<dt>사람 승인</dt>
							<dd>{closeoutResult.data.approved_at ? "완료" : "대기"}</dd>
						</dl>
					) : (
						<p className="app-muted">
							아직 Closeout 기록이 없습니다. 모든 검증 항목을 통과해야 기록할 수 있습니다.
						</p>
					)}
					<form action={recordCloseoutAction} className="app-form-grid">
						<input type="hidden" name="projectId" value={projectId} />
						<input type="hidden" name="runId" value={runId} />
						<label>
							Lessons Learned
							<textarea name="lessonsLearned" rows={3} />
						</label>
						<label>
							미해결 이관
							<textarea name="unresolvedTransfer" rows={3} />
						</label>
						<label className="app-checkbox">
							<input name="finalAccepted" type="checkbox" />
							최종 인수
						</label>
						<label className="app-checkbox">
							<input name="securityTerminated" type="checkbox" />
							보안 종료
						</label>
						<button className="krds-btn primary" type="submit">
							H10 Closeout 기록
						</button>
					</form>
				</section>
			</main>
		</>
	);
}
