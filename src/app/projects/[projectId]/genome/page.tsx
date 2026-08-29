import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createTrustedSupabaseClient } from "@/lib/supabase/trusted-server";
import { logout } from "@/app/projects/actions";
import {
	draftProposalAction,
	loadGenomeAction,
	seedGenomeAction,
	listGenomesAction,
} from "./actions";
import { loadGenome } from "../../../../lib/genome/project-genome";

type GenomePageProps = {
	params: Promise<{ projectId: string }>;
	searchParams: Promise<{
		seed?: string;
		load?: string;
		fail?: string;
		proposal?: string;
		created?: string;
		loaded?: string;
		genomeId?: string;
		coverage?: string;
		gap?: string;
		partial?: string;
	}>;
};

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const STATUS_MESSAGES: Record<string, string> = {
	seed: "Project Genome을 새로 생성했습니다. 결과는 아래에 표시됩니다.",
	created: "Project Genome을 새로 생성했습니다.",
	loaded: "Project Genome을 불러왔습니다.",
	fail: "Project Genome 작업에 실패했습니다. 서버 로그와 service_role 설정을 확인하세요.",
};

function firstStatus(value: string | string[] | undefined): string | null {
	if (Array.isArray(value)) return value[0] ?? null;
	return typeof value === "string" ? value : null;
}

type ParsedDocumentRow = {
	id: string;
	original_filename: string;
	privacy_classification: string;
	byte_size: number;
	created_at: string;
};

type DocumentParseRow = {
	id: string;
	document_id: string;
	created_at: string;
};

type RequirementExtractionRunRow = {
	id: string;
	document_id: string;
};

type WinningPointRow = {
	theme: string;
	rationale: string;
	targetItems: string[];
};

type ComplianceReport = {
	total: number;
	addressed: number;
	partial: number;
	gap: number;
	coverage: number;
};

async function loadPageData(projectId: string) {
	const supabase = await createServerSupabaseClient();
	const trusted = createTrustedSupabaseClient();
	const { data: project } = await supabase
		.from("projects")
		.select("id, name, tenant_id")
		.eq("id", projectId)
		.maybeSingle();
	if (!project) return { kind: "not_found" as const };

	const { data: docs } = await trusted
		.from("documents")
		.select("id, original_filename, privacy_classification, byte_size, created_at")
		.eq("project_id", projectId)
		.eq("document_kind", "RFP")
		.order("created_at", { ascending: false })
		.limit(20);
	const { data: parses } = await trusted
		.from("document_parses")
		.select("id, document_id, created_at")
		.eq("project_id", projectId)
		.order("created_at", { ascending: false })
		.limit(20);
	const { data: runs } = await trusted
		.from("requirement_extraction_runs")
		.select("id, document_id")
		.eq("project_id", projectId)
		.order("created_at", { ascending: false })
		.limit(20);

	const genomes: Array<{ id: string; stage: string; summary: string | null; created_at: string; updated_at: string }> = await listGenomesAction(projectId).catch(() => []);
	return {
		kind: "ok" as const,
		project,
		documents: (docs ?? []) as ParsedDocumentRow[],
		parses: (parses ?? []) as DocumentParseRow[],
		runs: (runs ?? []) as RequirementExtractionRunRow[],
		genomes,
	};
}

type ProposalArtifacts = {
	winningPoints: WinningPointRow[];
	proposedSections: Array<{ id: string; section_key: string; title: string; body_md: string }>;
	complianceReport: ComplianceReport;
};

async function loadProposalArtifacts(
	tenantId: string,
	projectId: string,
	genomeId: string,
): Promise<ProposalArtifacts> {
	const trusted = createTrustedSupabaseClient();
	const [{ data: matrix }, { data: sections }, { data: report }] = await Promise.all([
		trusted.rpc("load_project_genome", {
			p_tenant_id: tenantId,
			p_project_id: projectId,
			p_genome_id: genomeId,
		}),
		trusted
			.from("genome_proposal_sections")
			.select("id, section_key, title, body_md")
			.eq("genome_id", genomeId)
			.order("section_key"),
		trusted.rpc("load_compliance_report", {
			p_tenant_id: tenantId,
			p_project_id: projectId,
			p_genome_id: genomeId,
		}),
	]);
	const winningPoints: WinningPointRow[] = [];
	for (const row of ((matrix as { notes?: string }[] | null) ?? [])) {
		if (!row.notes) continue;
		try {
			const parsed = JSON.parse(row.notes) as {
				kind?: string;
				theme?: string;
				rationale?: string;
				targetEvaluationItems?: string[];
			};
			if (parsed.kind === "WINNING_POINT") {
				winningPoints.push({
					theme: parsed.theme ?? "",
					rationale: parsed.rationale ?? "",
					targetItems: parsed.targetEvaluationItems ?? [],
				});
			}
		} catch {
			// ignore non-JSON notes
		}
	}
	return {
		winningPoints,
		proposedSections: (sections ?? []) as Array<{
			id: string;
			section_key: string;
			title: string;
			body_md: string;
		}>,
		complianceReport: (report as ComplianceReport | null) ?? {
			total: 0,
			addressed: 0,
			partial: 0,
			gap: 0,
			coverage: 0,
		},
	};
}

export default async function GenomePage({ params, searchParams }: GenomePageProps) {
	const { projectId } = await params;
	const sp = await searchParams;
	if (!UUID_PATTERN.test(projectId)) {
		notFound();
	}
	const supabase = await createServerSupabaseClient();
	const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
	if (claimsError || typeof claimsData?.claims?.sub !== "string") {
		redirect("/login");
	}

	const data = await loadPageData(projectId);
	if (data.kind === "not_found") notFound();

	const seedOrLoadStatus = firstStatus(sp.seed ?? sp.created ?? sp.loaded ?? sp.fail);
	const proposalStatus = firstStatus(sp.proposal);
	const focusedGenomeId = firstStatus(sp.genomeId);
	const statusMessage = seedOrLoadStatus
		? STATUS_MESSAGES[seedOrLoadStatus] ?? null
		: null;
	const proposalMessage =
		proposalStatus === "proposal"
			? `제안 Compliance Matrix가 생성되었습니다. ADDRESSED ${sp.coverage ?? "?"}% (PARTIAL ${sp.partial ?? "?"}건, GAP ${sp.gap ?? "?"}건).`
			: null;

	const parseByDocumentId = new Map<string, string>();
	for (const p of data.parses) parseByDocumentId.set(p.document_id, p.id);
	const runByDocumentId = new Map<string, string>();
	for (const r of data.runs) runByDocumentId.set(r.document_id, r.id);
	const documentsWithParse = data.documents.map((d) => ({
		...d,
		parseId: parseByDocumentId.get(d.id) ?? null,
		hasRun: runByDocumentId.has(d.id),
	}));

	const focusedGenome = focusedGenomeId
		? data.genomes.find((g) => g.id === focusedGenomeId) ?? null
		: data.genomes[0] ?? null;
	const focusedGenomeDetail = focusedGenome && data.kind === "ok"
		? ((await loadGenome(data.project.tenant_id, projectId, focusedGenome.id).catch(
				() => null,
		  )) as Awaited<ReturnType<typeof loadGenome>> | null)
		: null;
	const proposalArtifacts = focusedGenome && data.kind === "ok"
		? await loadProposalArtifacts(data.project.tenant_id, projectId, focusedGenome.id).catch(
				() => null,
		  )
		: null;

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
				<Link
					className="krds-btn small text app-back-link"
					href={`/projects/${projectId}/rfp`}
				>
					RFP 원본으로 돌아가기
				</Link>
				<p className="app-muted">{data.kind === "ok" ? data.project.name : ""}</p>
				<h1 className="app-page-title">Project Genome</h1>
				<p className="app-page-lead">
					RFP 한 번 입력으로 사업의 구조화된 기준정보(요구사항·산출물·평가·계약·리스크)를 자동 생성합니다. 사람
					검증 후 모든 후속 단계(제안·수행·감리·검사)에서 이 Genome을 기준으로 작동합니다.
				</p>

				{statusMessage ? (
					<p className="app-status-success" role="status">
						{statusMessage}
					</p>
				) : null}
				{proposalMessage ? (
					<p className="app-status-success" role="status">
						{proposalMessage}
					</p>
				) : null}

				<section aria-labelledby="seed-heading" className="app-section">
					<h2 className="app-section-title" id="seed-heading">
						RFP → Genome 자동 생성
					</h2>
					{data.kind === "ok" && documentsWithParse.length === 0 ? (
						<p className="app-muted" role="status">
							아직 파싱된 RFP가 없습니다. RFP 원본 페이지에서 업로드·파싱을 먼저 진행하세요.
						</p>
					) : (
						<ul className="app-span-list">
							{data.kind === "ok" &&
								documentsWithParse.map((d) => (
									<li className="app-evidence-item" key={d.id}>
										<p>
											{d.original_filename} · {d.privacy_classification} · {d.byte_size} 바이트
										</p>
										<form action={seedGenomeAction} className="app-form-grid">
											<input type="hidden" name="projectId" value={projectId} />
											<input type="hidden" name="documentId" value={d.id} />
											<input
												type="hidden"
												name="documentParseId"
												value={d.parseId ?? ""}
											/>
											<button
												className="krds-btn primary"
												type="submit"
												disabled={!d.parseId}
												aria-label={`${d.original_filename} Genome 자동 생성`}
											>
												{d.parseId
													? "Genome 자동 생성"
													: "Genome 생성 잠김 (파싱 필요)"}
											</button>
										</form>
									</li>
								))}
						</ul>
					)}
				</section>

				<section aria-labelledby="genome-list-heading" className="app-section">
					<h2 className="app-section-title" id="genome-list-heading">
						저장된 Genome
					</h2>
					{data.genomes.length === 0 ? (
						<p className="app-muted" role="status">
							아직 생성된 Genome이 없습니다.
						</p>
					) : (
						<ul className="krds-structured-list type-full">
							{data.genomes.map((g) => (
								<li className="structured-item" key={g.id}>
									<div className="in">
										<div className="card-body">
											<p className="c-tit">
												<span className="span">
													Genome {g.id.slice(0, 8)} · {g.stage}
												</span>
											</p>
											<p className="c-txt">{g.summary ?? "요약 없음"}</p>
											<form action={loadGenomeAction}>
												<input type="hidden" name="projectId" value={projectId} />
												<input type="hidden" name="genomeId" value={g.id} />
												<button
													className="krds-btn small primary"
													type="submit"
													aria-label={`Genome ${g.id.slice(0, 8)} 보기`}
												>
													이 Genome 보기
												</button>
											</form>
										</div>
									</div>
								</li>
							))}
						</ul>
					)}
				</section>

				{focusedGenomeDetail ? (
					<section aria-labelledby="genome-detail-heading" className="app-section">
						<h2 className="app-section-title" id="genome-detail-heading">
							Genome 상세
						</h2>
						<dl className="app-meta-grid">
							<dt>Stage</dt>
							<dd>{focusedGenomeDetail.genome.stage}</dd>
							<dt>요약</dt>
							<dd>{focusedGenomeDetail.genome.summary ?? "—"}</dd>
							<dt>요구사항</dt>
							<dd>
								{focusedGenomeDetail.requirements.length}건 (검증{" "}
								{
									focusedGenomeDetail.requirements.filter(
										(r) => r.human_verified,
									).length
								}
								건)
							</dd>
							<dt>산출물</dt>
							<dd>{focusedGenomeDetail.deliverables.length}건</dd>
							<dt>평가항목</dt>
							<dd>{focusedGenomeDetail.evaluationItems.length}건</dd>
							<dt>계약조건</dt>
							<dd>{focusedGenomeDetail.contractTerms.length}건</dd>
							<dt>리스크</dt>
							<dd>{focusedGenomeDetail.risks.length}건</dd>
						</dl>

						{focusedGenomeDetail.requirements.length > 0 ? (
							<details>
								<summary>요구사항 목록</summary>
								<ul className="app-span-list">
									{focusedGenomeDetail.requirements.map((r) => (
										<li className="app-evidence-item" key={r.id}>
											<p>
												{r.external_id} · {r.title.slice(0, 60)} ·{" "}
												{r.requirement_type} · {r.priority}
											</p>
										</li>
									))}
								</ul>
							</details>
						) : null}

						{focusedGenomeDetail.deliverables.length > 0 ? (
							<details>
								<summary>산출물 목록</summary>
								<ul className="app-span-list">
									{focusedGenomeDetail.deliverables.map((d) => (
										<li className="app-evidence-item" key={d.id}>
											<p>
												{d.external_id} · {d.title} · {d.submission_phase}
											</p>
										</li>
									))}
								</ul>
							</details>
						) : null}

						{focusedGenomeDetail.evaluationItems.length > 0 ? (
							<details>
								<summary>평가 항목</summary>
								<ul className="app-span-list">
									{focusedGenomeDetail.evaluationItems.map((e) => (
										<li className="app-evidence-item" key={e.id}>
											<p>
												{e.external_id} · {e.title} · {e.category} · {e.max_score}점
											</p>
										</li>
									))}
								</ul>
							</details>
						) : null}

						{focusedGenomeDetail.contractTerms.length > 0 ? (
							<details>
								<summary>계약 조건</summary>
								<ul className="app-span-list">
									{focusedGenomeDetail.contractTerms.map((c) => (
										<li className="app-evidence-item" key={c.id}>
											<p>
												{c.external_id} · {c.term_type} ·{" "}
												{c.title.slice(0, 60)}
											</p>
										</li>
									))}
								</ul>
							</details>
						) : null}

						{focusedGenomeDetail.risks.length > 0 ? (
							<details>
								<summary>리스크</summary>
								<ul className="app-span-list">
									{focusedGenomeDetail.risks.map((r) => (
										<li className="app-evidence-item" key={r.id}>
											<p>
												{r.external_id} · {r.severity} · {r.title.slice(0, 60)}
											</p>
										</li>
									))}
								</ul>
							</details>
						) : null}
					</section>
				) : null}

				{focusedGenome && data.kind === "ok" ? (
					<section aria-labelledby="proposal-heading" className="app-section">
						<h2 className="app-section-title" id="proposal-heading">
							MVP2 Proposal Planner · Compliance Matrix + Winning Point
						</h2>
						<p className="app-page-lead">
							요구사항 ↔ 평가항목 ↔ 제안 섹션을 자동 매핑하고, 평가 카테고리별 Winning Point를 도출합니다.
						</p>
						{proposalArtifacts ? (
							<>
								<dl className="app-meta-grid">
									<dt>Compliance Coverage</dt>
									<dd>
										{proposalArtifacts.complianceReport.coverage}% (
										{proposalArtifacts.complianceReport.addressed}/
										{proposalArtifacts.complianceReport.total}건)
									</dd>
									<dt>ADDRESSED</dt>
									<dd>{proposalArtifacts.complianceReport.addressed}건</dd>
									<dt>PARTIAL</dt>
									<dd>{proposalArtifacts.complianceReport.partial}건</dd>
									<dt>GAP</dt>
									<dd>{proposalArtifacts.complianceReport.gap}건</dd>
								</dl>

								{proposalArtifacts.winningPoints.length > 0 ? (
									<details open>
										<summary>Winning Point</summary>
										<ul className="app-span-list">
											{proposalArtifacts.winningPoints.map((wp, i) => (
												<li className="app-evidence-item" key={i}>
													<p>
														<strong>{wp.theme}</strong>
													</p>
													<p>{wp.rationale}</p>
													{wp.targetItems.length > 0 ? (
														<p className="app-muted">
															대상 평가: {wp.targetItems.join(", ")}
														</p>
													) : null}
												</li>
											))}
										</ul>
									</details>
								) : null}

								{proposalArtifacts.proposedSections.length > 0 ? (
									<details>
										<summary>제안서 섹션 (목차)</summary>
										<ul className="app-span-list">
											{proposalArtifacts.proposedSections.map((s) => (
												<li className="app-evidence-item" key={s.id}>
													<p>
														<strong>{s.title}</strong> · {s.section_key}
													</p>
													<pre className="app-muted">{s.body_md}</pre>
												</li>
											))}
										</ul>
									</details>
								) : null}
							</>
						) : null}

						<form action={draftProposalAction} className="app-form-grid">
							<input type="hidden" name="projectId" value={projectId} />
							<input type="hidden" name="genomeId" value={focusedGenome.id} />
							<input type="hidden" name="projectType" value="DR" />
							<label>
								LLM Provider
								<select name="provider" defaultValue="groq">
									<option value="groq">Groq (qwen3.8-27b) — 무료</option>
									<option value="openai">OpenAI (gpt-5-mini)</option>
								</select>
							</label>
							<label className="app-checkbox">
								<input name="fixtureMode" type="checkbox" />
								fixture 모드 (LLM 미사용)
							</label>
							<button
								className="krds-btn primary"
								type="submit"
								aria-label="제안 Compliance Matrix 자동 생성"
							>
								제안 Compliance Matrix + Winning Point 자동 생성
							</button>
						</form>
					</section>
				) : null}
			</main>
		</>
	);
}
