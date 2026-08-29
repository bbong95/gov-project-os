import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createTrustedSupabaseClient } from "@/lib/supabase/trusted-server";
import { logout } from "@/app/projects/actions";
import {
	loadGenomeAction,
	seedGenomeAction,
	listGenomesAction,
} from "./actions";
import { loadGenome } from "../../../../lib/genome/project-genome";

export type ListGenomesResult = Array<{
	id: string;
	stage: string;
	summary: string | null;
	created_at: string;
	updated_at: string;
}>;

type GenomeDetail =
	| {
			genome: {
				id: string;
				stage: string;
				summary: string | null;
				rfp_document_id: string | null;
				rfp_document_parse_id: string | null;
				created_at: string;
				updated_at: string;
			};
			requirements: Array<{
				id: string;
				external_id: string;
				title: string;
				original_text: string;
				requirement_type: string;
				priority: string;
				mandatory: boolean;
				human_verified: boolean;
				rfp_page: string | null;
			}>;
			deliverables: Array<{
				id: string;
				external_id: string;
				title: string;
				description: string | null;
				submission_phase: string;
				mandatory: boolean;
			}>;
			evaluationItems: Array<{
				id: string;
				external_id: string;
				category: string;
				title: string;
				max_score: number;
				method: string | null;
				rfp_page: string | null;
			}>;
			contractTerms: Array<{
				id: string;
				external_id: string;
				term_type: string;
				title: string;
				original_text: string;
				rfp_page: string | null;
			}>;
			risks: Array<{
				id: string;
				external_id: string;
				severity: string;
				title: string;
				description: string;
				mitigation: string | null;
				rfp_page: string | null;
			}>;
			auditEvents: Array<{ id: string; event_type: string; actor_user_id: string; created_at: string }>;
	  }
	| null;

type GenomePageProps = {
	params: Promise<{ projectId: string }>;
	searchParams: Promise<{
		seed?: string;
		load?: string;
		fail?: string;
		created?: string;
		loaded?: string;
		genomeId?: string;
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

	const genomes: ListGenomesResult = await listGenomesAction(projectId);
	return {
		kind: "ok" as const,
		project,
		documents: (docs ?? []) as ParsedDocumentRow[],
		parses: (parses ?? []) as DocumentParseRow[],
		runs: (runs ?? []) as RequirementExtractionRunRow[],
		genomes,
	};
}

function firstStatus(value: string | string[] | undefined): string | null {
	if (Array.isArray(value)) return value[0] ?? null;
	return typeof value === "string" ? value : null;
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

	const status = firstStatus(sp.seed ?? sp.created ?? sp.loaded ?? sp.fail);
	const focusedGenomeId = firstStatus(sp.genomeId);
	const statusMessage = status ? STATUS_MESSAGES[status] ?? null : null;

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
const focusedGenomeDetail: GenomeDetail = focusedGenome && data.kind === "ok"
		? ((await loadGenome(data.project.tenant_id, projectId, focusedGenome.id).catch(() => null)) as GenomeDetail)
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
				<p className="app-muted">{data.project.name}</p>
				<h1 className="app-page-title">Project Genome</h1>
				<p className="app-page-lead">
					RFP 한 번 입력으로 사업의 구조화된 기준정보(요구사항·산출물·평가·계약·리스크)를 자동 생성합니다. 사람
					검증 후 모든 후속 단계(제안·수행·감리)에서 이 Genome을 기준으로 작동합니다.
				</p>

				{statusMessage ? (
					<p className="app-status-success" role="status">
						{statusMessage}
					</p>
				) : null}

				<section aria-labelledby="seed-heading" className="app-section">
					<h2 className="app-section-title" id="seed-heading">
						RFP → Genome 자동 생성
					</h2>
					{documentsWithParse.length === 0 ? (
						<p className="app-muted" role="status">
							아직 파싱된 RFP가 없습니다. RFP 원본 페이지에서 업로드·파싱을 먼저 진행하세요.
						</p>
					) : (
						<ul className="app-span-list">
							{documentsWithParse.map((d) => (
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
							{data.genomes.map((g: { id: string; stage: string; summary: string | null; created_at: string; updated_at: string }) => (
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
									{focusedGenomeDetail.requirements.map((r: { id: string; external_id: string; title: string; requirement_type: string; priority: string; mandatory: boolean; rfp_page: string | null }) => (
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
									{focusedGenomeDetail.deliverables.map((d: { id: string; external_id: string; title: string; description: string | null; submission_phase: string; mandatory: boolean }) => (
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
									{focusedGenomeDetail.evaluationItems.map((e: { id: string; external_id: string; category: string; title: string; max_score: number; method: string | null; rfp_page: string | null }) => (
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
									{focusedGenomeDetail.contractTerms.map((c: { id: string; external_id: string; term_type: string; title: string; original_text: string; rfp_page: string | null }) => (
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
									{focusedGenomeDetail.risks.map((r: { id: string; external_id: string; severity: string; title: string; description: string; mitigation: string | null; rfp_page: string | null }) => (
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
			</main>
		</>
	);
}
