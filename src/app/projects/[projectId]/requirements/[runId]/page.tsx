import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { SourceLocation } from "../../../../../lib/parsing/document-parser";
import {
	type RequirementAtomicity,
	type RequirementType,
} from "../../../../../lib/requirements/requirement-extraction";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";

type RequirementResultPageProps = {
	params: Promise<{ projectId: string; runId: string }>;
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

function locationLabel(location: SourceLocation): string {
	switch (location.kind) {
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
}: RequirementResultPageProps) {
	const { projectId, runId } = await params;
	const supabase = await createServerSupabaseClient();
	const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
	if (claimsError || typeof claimsData?.claims?.sub !== "string") {
		redirect("/login");
	}

	const { data: run, error: runError } = await supabase
		.from("requirement_extraction_runs")
		.select("id, document_id, document_parse_id")
		.eq("id", runId)
		.eq("project_id", projectId)
		.maybeSingle();
	if (runError || !run) {
		notFound();
	}

	const { data: document, error: documentError } = await supabase
		.from("documents")
		.select("id, original_filename")
		.eq("id", run.document_id)
		.eq("project_id", projectId)
		.eq("document_kind", "RFP")
		.maybeSingle();
	if (documentError || !document) {
		notFound();
	}

	const { data: candidates, error: candidatesError } = await supabase
		.from("requirement_candidates")
		.select(
			"id, candidate_order, official_id, source_text, interpretation, requirement_type, atomicity, provenance_state",
		)
		.eq("run_id", run.id)
		.eq("project_id", projectId)
		.order("candidate_order", { ascending: true });
	if (candidatesError || !candidates || candidates.length === 0) {
		notFound();
	}

	const { data: evidenceLinks, error: evidenceLinksError } = await supabase
		.from("requirement_candidate_source_spans")
		.select("candidate_id, source_span_id, source_order")
		.eq("run_id", run.id)
		.eq("project_id", projectId)
		.order("source_order", { ascending: true });
	if (evidenceLinksError || !evidenceLinks || evidenceLinks.length === 0) {
		notFound();
	}

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
				candidate.provenance_state !== "AI_DRAFT" ||
				(evidenceByCandidateId.get(candidate.id)?.length ?? 0) === 0,
		)
	) {
		notFound();
	}

	return (
		<main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-12">
			<a
				className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-white focus:p-3 focus:outline-3 focus:outline-blue-700"
				href="#requirement-candidates"
			>
				요구사항 후보 목록으로 건너뛰기
			</a>
			<header className="space-y-3 border-b border-slate-300 pb-6">
				<Link
					className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-800 underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
					href={"/projects/" + projectId + "/rfp"}
				>
					RFP 목록으로 돌아가기
				</Link>
				<p className="font-semibold text-amber-800">AI 초안</p>
				<h1 className="text-3xl font-semibold tracking-tight">
					요구사항 AI 초안
				</h1>
				<p className="text-slate-700">{document.original_filename}</p>
				<p className="leading-7 text-slate-700">
					원문 증거와 AI 해석을 분리해 표시합니다. 이 화면에서는 편집하거나
					Baseline을 만들 수 없습니다.
				</p>
			</header>

			<section
				aria-labelledby="requirement-candidates-heading"
				className="py-8"
				id="requirement-candidates"
			>
				<h2 className="text-xl font-semibold" id="requirement-candidates-heading">
					요구사항 후보
				</h2>
				<ol className="mt-5 space-y-8">
					{candidates.map((candidate) => {
						const officialId = candidate.official_id ?? "식별자 없음";
						const candidateEvidence =
							evidenceByCandidateId.get(candidate.id) ?? [];
						return (
							<li key={candidate.id}>
								<article
									aria-label={
										"요구사항 후보 " +
										candidate.candidate_order +
										" " +
										officialId
									}
									className="rounded-md border border-slate-300 bg-white p-5"
								>
									<h3 className="text-xl font-semibold">
										후보 {candidate.candidate_order} · {officialId}
									</h3>
									<dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
										<dt className="font-medium">공식 식별자</dt>
										<dd>{officialId}</dd>
										<dt className="font-medium">요구사항 유형</dt>
										<dd>
											{
												REQUIREMENT_TYPE_LABELS[
													candidate.requirement_type as RequirementType
												]
											}
										</dd>
										<dt className="font-medium">원자성</dt>
										<dd>
											{
												ATOMICITY_LABELS[
													candidate.atomicity as RequirementAtomicity
												]
											}
										</dd>
										<dt className="font-medium">출처 상태</dt>
										<dd>AI 초안</dd>
									</dl>

									<h4 className="mt-6 font-semibold">AI 해석</h4>
									<p className="mt-2 leading-7">{candidate.interpretation}</p>

									<h4 className="mt-6 font-semibold">원문 인용</h4>
									<pre
										className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-slate-100 p-4 font-mono text-sm"
										data-testid="candidate-source-text"
									>
										{candidate.source_text}
									</pre>

									<h4 className="mt-6 font-semibold">SourceSpan 증거</h4>
									<ol className="mt-3 space-y-4">
										{candidateEvidence.map((evidence) => {
											const sourceSpan = sourceSpanById.get(
												evidence.source_span_id,
											);
											if (!sourceSpan) {
												return null;
											}
											return (
												<li
													className="rounded-md border border-slate-200 p-4"
													key={evidence.source_span_id}
												>
													<p className="text-sm text-slate-700">
														{locationLabel(
															sourceSpan.location as SourceLocation,
														)}
													</p>
													<pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-slate-100 p-3 font-mono text-sm">
														{sourceSpan.original_text}
													</pre>
													<Link
														className="mt-3 inline-flex min-h-11 items-center font-semibold text-blue-800 underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
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
								</article>
							</li>
						);
					})}
				</ol>
			</section>
		</main>
	);
}