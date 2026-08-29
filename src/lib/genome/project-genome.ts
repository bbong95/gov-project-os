import "server-only";

import { createHash } from "node:crypto";

import type { ParsedSourceSpan } from "../parsing/source-span";
import { hashParsedDocument } from "../parsing/source-span";
import { createParserRegistry } from "../parsing/parser-registry";
import type { ParseInput, ParsedDocument } from "../parsing/document-parser";
import { createTrustedSupabaseClient } from "../supabase/trusted-server";

export type GenomeRequirement = {
	externalId: string;
	title: string;
	originalText: string;
	normalizedText: string;
	requirementType:
		| "FUNCTIONAL"
		| "NON_FUNCTIONAL"
		| "INTERFACE"
		| "DATA"
		| "SECURITY"
		| "PERFORMANCE"
		| "COMPLIANCE"
		| "OPERATIONAL"
		| "DELIVERY"
		| "OTHER";
	atomicity: "ATOMIC" | "COMPOSITE" | "REVIEW_REQUIRED";
	priority: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
	mandatory: boolean;
	rfpPage: string | null;
	rfpParagraph: string | null;
	sourceSpanIds: string[];
};

export type GenomeDeliverable = {
	externalId: string;
	title: string;
	description: string | null;
	submissionPhase: "PROPOSAL" | "CONTRACT" | "KICKOFF" | "INTERIM" | "FINAL" | "CLOSEOUT";
	mandatory: boolean;
	rfpPage: string | null;
};

export type GenomeEvaluationItem = {
	externalId: string;
	category: string;
	title: string;
	maxScore: number;
	method: string | null;
	rfpPage: string | null;
};

export type GenomeContractTerm = {
	externalId: string;
	termType: "QUALIFICATION" | "PERIOD" | "BUDGET" | "PENALTY" | "WARRANTY" | "IP" | "NDA" | "PERFORMANCE_BOND" | "OTHER";
	title: string;
	originalText: string;
	rfpPage: string | null;
};

export type GenomeRisk = {
	externalId: string;
	severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
	title: string;
	description: string;
	mitigation: string | null;
	rfpPage: string | null;
};

export type ProjectGenomeDraft = {
	requirements: GenomeRequirement[];
	deliverables: GenomeDeliverable[];
	evaluationItems: GenomeEvaluationItem[];
	contractTerms: GenomeContractTerm[];
	risks: GenomeRisk[];
	summary: string;
	parserKey: string;
	parserVersion: string;
	normalizationVersion: string;
	resultSha256: string;
	spanCount: number;
	promptVersion: string;
	modelFingerprint: string;
};

export type GenomeDetail = Awaited<ReturnType<typeof loadGenome>>;

export type BuildGenomeInput = {
	actorId: string;
	tenantId: string;
	projectId: string;
	rfpDocumentId: string;
	rfpDocumentParseId: string;
	storageBucket: string;
	storagePath: string;
	originalFilename: string;
	mediaType: string;
	sha256: string;
};

export type BuildGenomeResult = {
	genomeId: string;
	genomeVersion: number;
	requirements: number;
	deliverables: number;
	evaluationItems: number;
	contractTerms: number;
	risks: number;
	resultSha256: string;
	spanCount: number;
	coverage: {
		requirements: number;
		deliverables: number;
		evaluationItems: number;
		contractTerms: number;
		risks: number;
	};
};

type SpanLike = Pick<ParsedSourceSpan, "ordinal" | "originalText" | "originalTextSha256" | "location" | "normalizedText">;

const REQ_PATTERNS: Array<{ pattern: RegExp; type: GenomeRequirement["requirementType"]; priority: GenomeRequirement["priority"] }> = [
	{ pattern: /^\s*○\s*SER[-_]?\d+/i, type: "SECURITY", priority: "HIGH" },
	{ pattern: /^\s*○\s*PMR[-_]?\d+/i, type: "OPERATIONAL", priority: "NORMAL" },
	{ pattern: /^\s*○\s*PSR[-_]?\d+/i, type: "OPERATIONAL", priority: "NORMAL" },
	{ pattern: /^\s*○\s*IF[-_]?\d+/i, type: "INTERFACE", priority: "NORMAL" },
	{ pattern: /^\s*○\s*FR[-_]?\d+/i, type: "FUNCTIONAL", priority: "NORMAL" },
	{ pattern: /^\s*○\s*NFR[-_]?\d+/i, type: "NON_FUNCTIONAL", priority: "NORMAL" },
	{ pattern: /^\s*○\s*DAT[-_]?\d+/i, type: "DATA", priority: "NORMAL" },
	{ pattern: /^\s*○\s*PRF[-_]?\d+/i, type: "PERFORMANCE", priority: "HIGH" },
];

const DELIVERABLE_PATTERNS: Array<{
	pattern: RegExp;
	phase: GenomeDeliverable["submissionPhase"];
	titleHint?: string;
}> = [
	{ pattern: /제안서/i, phase: "PROPOSAL", titleHint: "제안서" },
	{ pattern: /사업수행계획서/i, phase: "KICKOFF", titleHint: "사업수행계획서" },
	{ pattern: /WBS|업무분해/i, phase: "KICKOFF" },
	{ pattern: /요구사항\s*정의서/i, phase: "KICKOFF" },
	{ pattern: /검사\s*기준서|검수\s*기준/i, phase: "FINAL" },
	{ pattern: /완료\s*보고서|완료보고/i, phase: "CLOSEOUT" },
	{ pattern: /중간\s*보고/i, phase: "INTERIM" },
];

const EVAL_CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string; defaultScore: number }> = [
	{ pattern: /기술(방안|부문|평가)/, category: "기술", defaultScore: 30 },
	{ pattern: /사업(관리|이해도|전략|실적)/, category: "사업관리", defaultScore: 15 },
	{ pattern: /가격|입찰|견적/, category: "가격", defaultScore: 20 },
	{ pattern: /품질|검수/, category: "품질", defaultScore: 10 },
	{ pattern: /지원|유지|안정성/, category: "지원", defaultScore: 5 },
];

const CONTRACT_PATTERNS: Array<{ pattern: RegExp; type: GenomeContractTerm["termType"] }> = [
	{ pattern: /입찰\s*참가\s*자격|참가\s*자격/i, type: "QUALIFICATION" },
	{ pattern: /사업\s*기간|계약\s*기간|착수일|준공일/i, type: "PERIOD" },
	{ pattern: /사업비|예산|계약\s*금액|추정\s*가격/i, type: "BUDGET" },
	{ pattern: /지연\s*배상|위약금|지체상금/i, type: "PENALTY" },
	{ pattern: /하자\s*보수|하자\s*보증|하자\s*기간/i, type: "WARRANTY" },
	{ pattern: /지적\s*재산권|소유권|라이선스/i, type: "IP" },
	{ pattern: /비밀\s*유지|NDA|비공개/i, type: "NDA" },
];

const RISK_PATTERNS: Array<{ pattern: RegExp; severity: GenomeRisk["severity"] }> = [
	{ pattern: /위험|리스크|critical|치명|긴급|중단/i, severity: "CRITICAL" },
	{ pattern: /민감|개인정보|보안|취약점/i, severity: "HIGH" },
	{ pattern: /주의|지연|리스크|변경/i, severity: "MEDIUM" },
	{ pattern: /(?:단순|참고)/i, severity: "LOW" },
];

function deriveExternalId(prefix: string, ordinal: number): string {
	return `${prefix}-${String(ordinal).padStart(3, "0")}`;
}

export function classifyRequirementType(text: string): {
	type: GenomeRequirement["requirementType"];
	priority: GenomeRequirement["priority"];
	atomicity: "ATOMIC" | "COMPOSITE" | "REVIEW_REQUIRED";
} {
	const trimmed = text.trim();
	for (const r of REQ_PATTERNS) {
		if (r.pattern.test(trimmed)) {
			return { type: r.type, priority: r.priority, atomicity: "ATOMIC" };
		}
	}
	const isMandatory = /하여야\s*한다|해야\s*한다|반드시|필수/i.test(trimmed);
	const hasListSeparator = /[;,]\s[^,;]{8,}/.test(trimmed);
	if (hasListSeparator) {
		return { type: "OTHER", priority: isMandatory ? "HIGH" : "NORMAL", atomicity: "COMPOSITE" };
	}
	if (trimmed.length > 240) {
		return { type: "OTHER", priority: isMandatory ? "HIGH" : "NORMAL", atomicity: "COMPOSITE" };
	}
	return { type: "OTHER", priority: isMandatory ? "NORMAL" : "LOW", atomicity: "ATOMIC" };
}

export function deriveDeliverables(spans: SpanLike[]): GenomeDeliverable[] {
	const out: GenomeDeliverable[] = [];
	const seen = new Set<string>();
	for (let i = 0; i < spans.length; i += 1) {
		const text = spans[i]!.originalText;
		for (const rule of DELIVERABLE_PATTERNS) {
			if (rule.pattern.test(text)) {
				const phase = rule.phase;
				const title = rule.titleHint ?? text.slice(0, 60).trim();
				const externalId = `DEL-${phase}-${String(out.length + 1).padStart(3, "0")}`;
				if (!seen.has(externalId)) {
					seen.add(externalId);
					out.push({
						externalId,
						title,
						description: text,
						submissionPhase: phase,
						mandatory: /필수|반드시|제출/i.test(text),
						rfpPage: null,
					});
				}
				break;
			}
		}
	}
	if (out.length === 0) {
		out.push({
			externalId: "DEL-INTERIM-001",
			title: "추가 산출물 (자동 식별)",
			description: "RFP에서 자동 식별되지 않은 산출물 — 사람이 H8 매핑 시 추가 필요",
			submissionPhase: "INTERIM",
			mandatory: true,
			rfpPage: null,
		});
	}
	return out;
}

export function deriveEvaluationItems(spans: SpanLike[]): GenomeEvaluationItem[] {
	const seen = new Set<string>();
	const out: GenomeEvaluationItem[] = [];
	for (let i = 0; i < spans.length; i += 1) {
		const text = spans[i]!.originalText;
		for (const rule of EVAL_CATEGORY_PATTERNS) {
			if (rule.pattern.test(text)) {
				const title = rule.category;
				const key = `EVAL-${title}`;
				if (!seen.has(key)) {
					seen.add(key);
					out.push({
						externalId: `EVAL-${String(out.length + 1).padStart(3, "0")}`,
						category: title,
						title,
						maxScore: rule.defaultScore,
						method: null,
						rfpPage: null,
					});
				}
				break;
			}
		}
	}
	const total = out.reduce((acc, item) => acc + item.maxScore, 0);
	if (out.length > 0 && total !== 100) {
		const scale = 100 / total;
		for (const item of out) item.maxScore = Math.round(item.maxScore * scale * 100) / 100;
		const rounded = out.reduce((acc, item) => acc + item.maxScore, 0);
		if (out.length > 0) {
			out[0]!.maxScore = Math.round((out[0]!.maxScore + (100 - rounded)) * 100) / 100;
		}
	}
	return out;
}

export function deriveContractTerms(spans: SpanLike[]): GenomeContractTerm[] {
	const out: GenomeContractTerm[] = [];
	const seen = new Set<string>();
	for (let i = 0; i < spans.length; i += 1) {
		const text = spans[i]!.originalText;
		for (const rule of CONTRACT_PATTERNS) {
			if (rule.pattern.test(text)) {
				if (!seen.has(rule.type)) {
					seen.add(rule.type);
					out.push({
						externalId: `CTR-${rule.type}-001`,
						termType: rule.type,
						title: text.slice(0, 80),
						originalText: text,
						rfpPage: null,
					});
				}
				break;
			}
		}
	}
	return out;
}

export function deriveRisks(spans: SpanLike[]): GenomeRisk[] {
	const out: GenomeRisk[] = [];
	const seen = new Set<string>();
	for (let i = 0; i < spans.length; i += 1) {
		const text = spans[i]!.originalText;
		for (const rule of RISK_PATTERNS) {
			if (rule.pattern.test(text) && !/○\s*[A-Z]+[-_]?\d+/i.test(text.trim())) {
				const key = `${rule.severity}-${text.slice(0, 30)}`;
				if (!seen.has(key)) {
					seen.add(key);
					out.push({
						externalId: `RSK-${String(out.length + 1).padStart(3, "0")}`,
						severity: rule.severity,
						title: text.slice(0, 80),
						description: text,
						mitigation: null,
						rfpPage: null,
					});
				}
				break;
			}
		}
	}
	return out;
}

export async function extractSpanArchive(
	storageBucket: string,
	storagePath: string,
): Promise<{ bytes: Uint8Array; sha256: string }> {
	const { createClient } = await import("@supabase/supabase-js");
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:55421";
	const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
	const client = createClient(url, publishable, { auth: { persistSession: false } });
	const { data, error } = await client.storage.from(storageBucket).download(storagePath);
	if (error || !data) throw new Error(`Source download failed: ${error?.message ?? "no data"}`);
	const bytes = new Uint8Array(await data.arrayBuffer());
	const sha256 = createHash("sha256").update(bytes).digest("hex");
	return { bytes, sha256 };
}

export type GenomeSeedResult = ProjectGenomeDraft;

export async function seedGenomeFromRfp(
	input: BuildGenomeInput,
): Promise<BuildGenomeResult> {
	const client = createTrustedSupabaseClient();

	const archive = await extractSpanArchive(input.storageBucket, input.storagePath);
	const archiveBytes = archive.bytes;
	// fflate / Supabase storage may return ArrayBufferLike (SharedArrayBuffer in
	// node). Copy into a fresh ArrayBuffer to satisfy the parser contract.
	const bytes =
		archiveBytes.buffer instanceof ArrayBuffer
			? archiveBytes.buffer.slice(archiveBytes.byteOffset, archiveBytes.byteOffset + archiveBytes.byteLength)
			: new Uint8Array(archiveBytes).slice().buffer;
	const parseInput: ParseInput = {
		documentId: input.rfpDocumentId,
		originalFilename: input.originalFilename,
		canonicalMimeType: input.mediaType,
		sourceSha256: input.sha256,
		bytes,
	};
	// fflate unzipSync returns ArrayBufferLike; cast to ArrayBuffer for the
	// parser contract.
	const registry = createParserRegistry();
	const resolution = registry.resolve(input.originalFilename);
	const parsed: ParsedDocument = await resolution.parser.parse(parseInput);
	const spans = parsed.spans as SpanLike[];

	const requirements: GenomeRequirement[] = spans.map((s, i) => {
		const classified = classifyRequirementType(s.originalText);
		return {
			externalId: deriveExternalId("REQ", i + 1),
			title: s.originalText.slice(0, 80),
			originalText: s.originalText,
			normalizedText: s.originalText,
			requirementType: classified.type,
			atomicity: classified.atomicity,
			priority: classified.priority,
			mandatory: /하여야\s*한다|해야\s*한다|반드시|필수/i.test(s.originalText),
			rfpPage: null,
			rfpParagraph: null,
			sourceSpanIds: [s.originalTextSha256],
		};
	});
	const deliverables = deriveDeliverables(spans);
	const evaluationItems = deriveEvaluationItems(spans);
	const contractTerms = deriveContractTerms(spans);
	const risks = deriveRisks(spans);

	const resultSha256 = await hashParsedDocument(spans);

	const draft: ProjectGenomeDraft = {
		requirements,
		deliverables,
		evaluationItems,
		contractTerms,
		risks,
		summary: `RFP ${input.originalFilename}에서 ${requirements.length}개 요구사항, ${deliverables.length}개 산출물, ${evaluationItems.length}개 평가항목, ${contractTerms.length}개 계약조건, ${risks.length}개 리스크를 식별했습니다.`,
		parserKey: parsed.parserKey,
		parserVersion: parsed.parserVersion,
		normalizationVersion: parsed.normalizationVersion,
		resultSha256,
		spanCount: spans.length,
		promptVersion: "mvp1-genome-v1",
		modelFingerprint: "deterministic-v1",
	};

	// Persist to project_genome (using RPC to keep actor + audit in one place)
	const { data, error } = await client.rpc("upsert_project_genome", {
		p_actor_id: input.actorId,
		p_tenant_id: input.tenantId,
		p_project_id: input.projectId,
		p_rfp_document_id: input.rfpDocumentId,
		p_rfp_document_parse_id: input.rfpDocumentParseId,
		p_draft: draft,
	});
	if (error || typeof data !== "string") {
		throw new Error(`Genome persistence failed: ${error?.message ?? "no result"}`);
	}
	const genomeId = data;

	return {
		genomeId,
		genomeVersion: 1,
		requirements: requirements.length,
		deliverables: deliverables.length,
		evaluationItems: evaluationItems.length,
		contractTerms: contractTerms.length,
		risks: risks.length,
		resultSha256,
		spanCount: spans.length,
		coverage: {
			requirements: requirements.length,
			deliverables: deliverables.length,
			evaluationItems: evaluationItems.length,
			contractTerms: contractTerms.length,
			risks: risks.length,
		},
	};
}

export async function loadGenome(
	tenantId: string,
	projectId: string,
	genomeId: string,
): Promise<{
	genome: { id: string; stage: string; summary: string | null; rfp_document_id: string | null; rfp_document_parse_id: string | null; created_at: string; updated_at: string };
	requirements: Array<{ id: string; external_id: string; title: string; original_text: string; requirement_type: string; priority: string; mandatory: boolean; human_verified: boolean; rfp_page: string | null }>;
	deliverables: Array<{ id: string; external_id: string; title: string; description: string | null; submission_phase: string; mandatory: boolean }>;
	evaluationItems: Array<{ id: string; external_id: string; category: string; title: string; max_score: number }>;
	contractTerms: Array<{ id: string; external_id: string; term_type: string; title: string; original_text: string }>;
	risks: Array<{ id: string; external_id: string; severity: string; title: string; description: string; mitigation: string | null }>;
	auditEvents: Array<{ id: string; event_type: string; actor_user_id: string; created_at: string }>;
}> {
	const client = createTrustedSupabaseClient();
	const { data, error } = await client.rpc("load_project_genome", {
		p_tenant_id: tenantId,
		p_project_id: projectId,
		p_genome_id: genomeId,
	});
	if (error || !data) {
		throw new Error(`Genome load failed: ${error?.message ?? "no data"}`);
	}
	return data as Awaited<ReturnType<typeof loadGenome>>;
}

export async function listGenomesForProject(
	tenantId: string,
	projectId: string,
): Promise<Array<{ id: string; stage: string; summary: string | null; created_at: string; updated_at: string }>> {
	const client = createTrustedSupabaseClient();
	const { data, error } = await client.rpc("list_project_genomes", {
		p_tenant_id: tenantId,
		p_project_id: projectId,
	});
	if (error) throw new Error(`Genome list failed: ${error.message}`);
	return (data ?? []) as Array<{ id: string; stage: string; summary: string | null; created_at: string; updated_at: string }>;
}
