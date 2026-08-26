import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "../../../../../components/AppHeader";
import type { SourceLocation } from "../../../../../lib/parsing/document-parser";
import {
	type RequirementAtomicity,
	type RequirementType,
} from "../../../../../lib/requirements/requirement-extraction";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";
import { logout } from "../../../actions";
import {
	mergeCandidatesAction,
	reviewCandidateAction,
	splitCandidateAction,
} from "./actions";

export const dynamic = "force-dynamic";

type RequirementResultPageProps = {
	params: Promise<{ projectId: string; runId: string }>;
	searchParams: Promise<{ review?: string | string[] }>;
};

const REQUIREMENT_TYPE_LABELS: Record<RequirementType, string> = {
	FUNCTIONAL: "기능",
	SYSTEM_CONFIGURATION: "시스템 구성",
	PERFORMANCE: "성능",
	INTERFACE: "인터페이스",
	DATA: "데이터",
	TEST: "테스트",
	SECURITY: "보안",
	QUALITY: "품질",
	CONSTRAINT: "제약사항",
	PROJECT_MANAGEMENT: "사업관리",
	PROJECT_SUPPORT: "사업지원",
	OTHER: "기타",
};

const ATOMICITY_LABELS: Record<RequirementAtomicity, string> = {
	ATOMIC: "원자",
	COMPOSITE: "복합",
	REVIEW_REQUIRED: "검토 필요",
};

const STATE_LABELS: Record<string, string> = {
	AI_DRAFT: "AI 초안",
	SOURCE_VERIFIED: "원문 확인됨",
	HUMAN_VERIFIED: "사람 확인됨",
	REVIEW_REQUIRED: "검토 필요",
	REJECTED: "반려됨",
};

const STATE_TONES: Record<string, string> = {
	AI_DRAFT: "bg-light-information",
	SOURCE_VERIFIED: "bg-light-secondary",
	HUMAN_VERIFIED: "bg-light-success",
	REVIEW_REQUIRED: "bg-light-warning",
	REJECTED: "bg-light-danger",
};

const REVIEW_STATUS_MESSAGES: Record<string, string> = {
	approved: "검토 상태가 저장되었습니다: 승인",
	source_verified: "검토 상태가 저장되었습니다: 원문 확인",
	needs_review: "검토 상태가 저장되었습니다: 검토 필요",
	rejected: "검토 상태가 저장되었습니다: 반려",
	edited: "검토 상태가 저장되었습니다: 해석 편집",
	merged: "선택한 후보를 병합했습니다.",
	split: "후보를 분할했습니다.",
};

function locationLabel(location: SourceLocation): string {	switch (location.kind) {
		case "TEXT_LINES":
			return location.lineStart + "–" + location.lineEnd + "행";
		case "PAGE":
			return (
				location.pageNumber +
				"쪽" +
				(location.blockIndex === undefined
					? ""
					: " · 블록 " + location.blockIndex)
			);
		case "SHEET":
			return (
				(location.sheetName ?? "시트 " + location.sheetIndex) +
				(location.cellRange ? " · " + location.cellRange : "")
			);
		case "SECTION":
			return (
				(location.label ?? "섹션 " + location.sectionIndex) +
				(location.blockIndex === undefined
					? ""
					: " · 블록 " + location.blockIndex)
			);
	}
}

export default async function RequirementResultPage({
	params,
	searchParams,
}: RequirementResultPageProps) {
	const { projectId, runId } = await params;
	const reviewParam = await searchParams;
	const reviewState =
		typeof reviewParam.review === "string" ? reviewParam.review : null;
	const supabase = await createServerSupabaseClient();
	const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
	if (claimsError || typeof claimsData?.claims?.sub !== "string") {
		redirect("/login");
	}
	const userId = claimsData.claims.sub;

	const { data: run, error: runError } = await supabase
		.from("requirement_extraction_runs")
		.select("id, tenant_id, document_id, document_parse_id")
		.eq("id", runId)
		.eq("project_id", projectId)
		.maybeSingle();
	if (runError || !run) {
		notFound();
	}

	const [documentResult, candidatesResult, evidenceLinksResult, projectMembershipResult, tenantMembershipResult] =
		await Promise.all([
			supabase
				.from("documents")
				.select("id, original_filename")
				.eq("id", run.document_id)
				.eq("project_id", projectId)
				.eq("document_kind", "RFP")
				.maybeSingle(),
			supabase
				.from("requirement_candidates")
				.select(
					"id, candidate_order, official_id, source_text, interpretation, requirement_type, atomicity, provenance_state",
				)
				.eq("run_id", run.id)
				.eq("project_id", projectId)
				.order("candidate_order", { ascending: true }),
			supabase
				.from("requirement_candidate_source_spans")
				.select("candidate_id, source_span_id, source_order")
				.eq("run_id", run.id)
				.eq("project_id", projectId)
				.order("source_order", { ascending: true }),
			supabase
				.from("project_memberships")
				.select("role")
				.eq("project_id", projectId)
				.eq("user_id", userId)
				.maybeSingle(),
			supabase
				.from("tenant_memberships")
				.select("role")
				.eq("tenant_id", run.tenant_id)
				.eq("user_id", userId)
				.maybeSingle(),
		]);
	const document = documentResult.data;
	const candidates = candidatesResult.data;
	const evidenceLinks = evidenceLinksResult.data;
	if (documentResult.error || !document || !candidates || candidates.length === 0) {
		notFound();
	}
	if (!evidenceLinks || evidenceLinks.length === 0) {
		notFound();
	}

	const canReview =
		projectMembershipResult.data?.role === "EDITOR" ||
		projectMembershipResult.data?.role === "PROJECT_ADMIN" ||
		tenantMembershipResult.data?.role === "TENANT_ADMIN";

	const sourceSpanIds = [
		...new Set(evidenceLinks.map((evidence) => evidence.source_span_id)),
	];
	const { data: sourceSpans, error: sourceSpansError } = await supabase
		.from("source_spans")
		.select("id, ordinal, location, original_text")
		.eq("project_id", projectId)
		.eq("document_id", run.document_id)
		.eq("document_parse_id", run.document_parse_id)
		.in("id", sourceSpanIds);
	if (
		sourceSpansError ||
		!sourceSpans ||
		sourceSpans.length !== sourceSpanIds.length
	) {
		notFound();
	}

	const sourceSpanById = new Map(
		sourceSpans.map((sourceSpan) => [sourceSpan.id, sourceSpan]),
	);
	const evidenceByCandidateId = new Map<
		string,
		NonNullable<typeof evidenceLinks>
	>();
	for (const evidence of evidenceLinks) {
		const candidateEvidence =
			evidenceByCandidateId.get(evidence.candidate_id) ?? [];
		candidateEvidence.push(evidence);
		evidenceByCandidateId.set(evidence.candidate_id, candidateEvidence);
	}
	if (
		candidates.some(
			(candidate) =>
				(evidenceByCandidateId.get(candidate.id)?.length ?? 0) === 0,
		)
	) {
		notFound();
	}

	const reviewMessage = reviewState ? REVIEW_STATUS_MESSAGES[reviewState] : null;
	const reviewFailed = reviewState === "failed";
	const statusMessage = !reviewFailed && reviewMessage ? reviewMessage : null;
	const sortedSourceSpans = [...sourceSpans].sort(
		(left, right) => left.ordinal - right.ordinal,
	);

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
				<a className="app-skip-link" href="#requirement-candidates">
					요구사항 후보 목록으로 건너뛰기
				</a>
				<Link
					className="krds-btn small text app-back-link"
					href={"/projects/" + projectId + "/rfp"}
				>
					RFP 목록으로 돌아가기
				</Link>
				<p>
					<span className="krds-badge bg-light-information">AI 분석 결과</span>
				</p>
				<h1 className="app-page-title">요구사항 AI 초안</h1>
				<p className="app-muted">{document.original_filename}</p>
				<p className="app-page-lead">
					원문 증거와 AI 해석을 분리해 표시합니다. 승인과 병합·분할은 사람만 수행할 수
					있습니다.
				</p>

				{reviewFailed ? (
					<p className="app-alert-danger" role="alert">
						검토를 저장하지 못했습니다. 다시 시도하세요.
					</p>
				) : null}
				{statusMessage ? (
					<p className="app-status-success" role="status">
						{statusMessage}
					</p>
				) : null}

				<div className="app-workbench">
					<nav aria-label="후보 목록" className="app-workbench-list">
						<h2 className="app-section-title">후보 목록</h2>
						<ol className="app-candidate-nav">
							{candidates.map((candidate) => (
								<li key={candidate.id}>
									<a
										className="app-candidate-nav-link"
										href={"#candidate-" + candidate.id}
									>
										<span>
											후보 {candidate.candidate_order} ·{" "}
											{candidate.official_id ?? "식별자 없음"}
										</span>
										<span className="krds-badge bg-light-gray">
											{STATE_LABELS[candidate.provenance_state] ?? candidate.provenance_state}
										</span>
									</a>
								</li>
							))}
						</ol>
					</nav>

					<section
						aria-labelledby="requirement-candidates-heading"
						className="app-workbench-main"
						id="requirement-candidates"
						tabIndex={-1}
					>
						<h2 className="app-section-title" id="requirement-candidates-heading">
							요구사항 후보
						</h2>
						<ol className="app-candidate-list">
							{candidates.map((candidate) => {
								const officialId = candidate.official_id ?? "식별자 없음";
								const candidateEvidence =
									evidenceByCandidateId.get(candidate.id) ?? [];
								const stateLabel =
									STATE_LABELS[candidate.provenance_state] ??
									candidate.provenance_state;
								const stateTone =
									STATE_TONES[candidate.provenance_state] ?? "bg-light-gray";
								const reviewable = canReview && candidate.provenance_state !== "REJECTED";
								const splitable = reviewable && candidateEvidence.length >= 2;
								return (
									<li key={candidate.id}>
										<article
											aria-label={
												"요구사항 후보 " +
												candidate.candidate_order +
												" " +
												officialId
											}
											className="app-span-card"
											id={"candidate-" + candidate.id}
										>
											<h3>
												후보 {candidate.candidate_order} · {officialId}
											</h3>
											<dl className="app-meta-grid">
												<dt>공식 식별자</dt>
												<dd>{officialId}</dd>
												<dt>요구사항 유형</dt>
												<dd>
													{
														REQUIREMENT_TYPE_LABELS[
															candidate.requirement_type as RequirementType
														]
													}
												</dd>
												<dt>원자성</dt>
												<dd>
													{
														ATOMICITY_LABELS[
															candidate.atomicity as RequirementAtomicity
														]
													}
												</dd>
												<dt>출처 상태</dt>
												<dd>
													<span className={"krds-badge " + stateTone}>
														{stateLabel}
													</span>
												</dd>
											</dl>

											<h4>AI 해석</h4>
											<p>{candidate.interpretation}</p>

											<h4>원문 인용</h4>
											<pre
												className="app-source-text"
												data-testid="candidate-source-text"
											>
												{candidate.source_text}
											</pre>

											<h4>SourceSpan 증거</h4>
											<ol className="app-span-list">
												{candidateEvidence.map((evidence) => {
													const sourceSpan = sourceSpanById.get(
														evidence.source_span_id,
													);
													if (!sourceSpan) {
														return null;
													}
													return (
														<li
															className="app-evidence-item"
															key={evidence.source_span_id}
														>
															<p className="app-muted">
																{locationLabel(
																	sourceSpan.location as SourceLocation,
																)}
															</p>
															<pre className="app-source-text app-source-text-tight">
																{sourceSpan.original_text}
															</pre>
															<Link
																className="krds-btn small secondary"
																href={
																	"/projects/" +
																	projectId +
																	"/documents/" +
																	run.document_id +
																	"/source#span-" +
																	sourceSpan.id
																}
															>
																{officialId} 후보 SourceSpan{" "}
																{evidence.source_order} 증거 보기
															</Link>
														</li>
													);
												})}
											</ol>

											{canReview ? (
												<div className="btn-wrap">
													{candidate.provenance_state === "AI_DRAFT" ? (
														<form
															action={reviewCandidateAction}
														>
															<input name="projectId" type="hidden" value={projectId} />
															<input name="runId" type="hidden" value={runId} />
															<input name="candidateId" type="hidden" value={candidate.id} />
															<input name="action" type="hidden" value="SOURCE_VERIFIED" />
															<button
																aria-label={"후보 " + candidate.candidate_order + " 원문 확인"}
																className="krds-btn small secondary"
																type="submit"
															>
																원문 확인
															</button>
														</form>
													) : null}
													{reviewable ? (
														<>
															<form action={reviewCandidateAction}>
																<input name="projectId" type="hidden" value={projectId} />
																<input name="runId" type="hidden" value={runId} />
																<input name="candidateId" type="hidden" value={candidate.id} />
																<input name="action" type="hidden" value="APPROVE" />
																<button
																	aria-label={"후보 " + candidate.candidate_order + " 승인"}
																	className="krds-btn small primary"
																	type="submit"
																>
																	승인
																</button>
															</form>
															<form action={reviewCandidateAction}>
																<input name="projectId" type="hidden" value={projectId} />
																<input name="runId" type="hidden" value={runId} />
																<input name="candidateId" type="hidden" value={candidate.id} />
																<input name="action" type="hidden" value="NEEDS_REVIEW" />
																<button
																	aria-label={"후보 " + candidate.candidate_order + " 검토 필요"}
																	className="krds-btn small secondary"
																	type="submit"
																>
																	검토 필요
																</button>
															</form>
															<form action={reviewCandidateAction}>
																<input name="projectId" type="hidden" value={projectId} />
																<input name="runId" type="hidden" value={runId} />
																<input name="candidateId" type="hidden" value={candidate.id} />
																<input name="action" type="hidden" value="REJECT" />
																<button
																	aria-label={"후보 " + candidate.candidate_order + " 반려"}
																	className="krds-btn small secondary"
																	type="submit"
																>
																	반려
																</button>
															</form>
														</>
													) : null}
												</div>
											) : null}

											{reviewable ? (
												<form action={reviewCandidateAction} className="app-edit-form">
													<input name="projectId" type="hidden" value={projectId} />
													<input name="runId" type="hidden" value={runId} />
													<input name="candidateId" type="hidden" value={candidate.id} />
													<input name="action" type="hidden" value="EDIT" />
													<div className="form-group">
														<div className="form-tit">
															<label htmlFor={"edit-" + candidate.id}>
																후보 {candidate.candidate_order} 해석 편집
															</label>
														</div>
														<div className="form-conts">
															<textarea
																className="krds-textarea"
																defaultValue={candidate.interpretation}
																id={"edit-" + candidate.id}
																name="newInterpretation"
																rows={2}
															/>
														</div>
													</div>
													<button
														aria-label={"후보 " + candidate.candidate_order + " 편집 저장"}
														className="krds-btn small primary"
														type="submit"
													>
														편집 저장
													</button>
												</form>
											) : null}

											{splitable ? (
												<form action={splitCandidateAction} className="app-edit-form">
													<input name="projectId" type="hidden" value={projectId} />
													<input name="runId" type="hidden" value={runId} />
													<input name="candidateId" type="hidden" value={candidate.id} />
													<div className="form-group">
														<div className="form-tit">
															<label htmlFor={"split-" + candidate.id}>
																후보 {candidate.candidate_order} 분할 새 해석
															</label>
														</div>
														<div className="form-conts">
															<input
																className="krds-input"
																id={"split-" + candidate.id}
																name="newInterpretation"
																type="text"
															/>
														</div>
														<p className="form-hint">
															첫 번째 증거가 새 해석 후보로 분리되고 나머지 증거는 기존
															해석 후보에 유지됩니다.
														</p>
													</div>
													<button
														aria-label={"후보 " + candidate.candidate_order + " 분할 실행"}
														className="krds-btn small secondary"
														type="submit"
													>
														분할 실행
													</button>
												</form>
											) : null}

											{canReview && candidate.provenance_state !== "REJECTED" ? (
												<div className="krds-form-check app-merge-select">
													<input
														form="merge-form"
														id={"merge-" + candidate.id}
														name="candidateIds"
														type="checkbox"
														value={candidate.id}
													/>
													<label htmlFor={"merge-" + candidate.id}>
														후보 {candidate.candidate_order} 병합 선택
													</label>
												</div>
											) : null}
										</article>
									</li>
								);
							})}
						</ol>

						{canReview ? (
							<form action={mergeCandidatesAction} className="app-merge-form" id="merge-form">
								<input name="projectId" type="hidden" value={projectId} />
								<input name="runId" type="hidden" value={runId} />
								<div className="form-group">
									<div className="form-tit">
										<label htmlFor="merge-interpretation">병합 해석</label>
									</div>
									<div className="form-conts">
										<input
											className="krds-input"
											id="merge-interpretation"
											name="interpretation"
											type="text"
										/>
									</div>
									<p className="form-hint">
										체크한 후보들을 하나의 사람 확인 후보로 병합합니다. 원본 후보는
										반려 처리됩니다.
									</p>
								</div>
								<button className="krds-btn small primary" type="submit">
									선택한 후보 병합
								</button>
							</form>
						) : null}
					</section>

					<aside aria-label="원문 증거" className="app-workbench-source">
						<h2 className="app-section-title">원문 증거</h2>
						<ol className="app-span-list">
							{sortedSourceSpans.map((sourceSpan) => (
								<li className="app-evidence-item" key={sourceSpan.id}>
									<p className="app-muted">
										SourceSpan {sourceSpan.ordinal} ·{" "}
										{locationLabel(sourceSpan.location as SourceLocation)}
									</p>
									<pre className="app-source-text app-source-text-tight">
										{sourceSpan.original_text}
									</pre>
								</li>
							))}
						</ol>
					</aside>
				</div>
			</main>
		</>
	);
}
