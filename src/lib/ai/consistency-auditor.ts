// MVP4 Consistency Auditor
// Deterministic consistency checks across the current Genome. Each
// audit returns a stable list of findings that the UI renders as a
// report and that the Eval harness measures against a golden set.

import "server-only";

import { loadGenome } from "../genome/project-genome";
import { createTrustedSupabaseClient } from "../supabase/trusted-server";

// Note: the test in consistency-auditor.test.ts stubs out the genome
// import by re-implementing makeDetail() locally. The runtime path here
// does the full Supabase walk that the Eval harness cannot exercise
// without a real database.

export type AuditSeverity = "INFO" | "WARN" | "FAIL";
export type AuditCategory =
	| "MISSING_DELIVERABLE"
	| "MISSING_EVALUATION"
	| "MISSING_CONTRACT"
	| "MISSING_RISK"
	| "UNVERIFIED_REQUIREMENT"
	| "LOW_PRIORITY_HIGH_SEVERITY_RISK"
	| "CRITICAL_REQUIREMENT_NO_INSPECTION"
	| "WBS_GAP";

export type AuditFinding = {
	id: string;
	category: AuditCategory;
	severity: AuditSeverity;
	message: string;
	relatedExternalId?: string;
};

export type AuditReport = {
	genomeId: string;
	runAt: string;
	findings: AuditFinding[];
	counts: Record<AuditSeverity, number>;
	summary: string;
};

function nextId(prefix: string): string {
	return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function auditGenomeConsistency(
	tenantId: string,
	projectId: string,
	genomeId: string,
): Promise<AuditReport> {
	const detail = await loadGenome(tenantId, projectId, genomeId);
	const findings: AuditFinding[] = [];

	const requirementExternalIds = new Set(detail.requirements.map((r) => r.external_id));
	const deliverableExternalIds = new Set(detail.deliverables.map((d) => d.external_id));
	const evaluationExternalIds = new Set(detail.evaluationItems.map((e) => e.external_id));

	// 1. Every deliverable should map back to a requirement or evaluation.
	for (const d of detail.deliverables) {
		const haystack = `${d.description ?? ""} ${(d as { notes?: string }).notes ?? ""}`.toLowerCase();
		if (
			haystack.trim().length === 0 ||
			(!Array.from(requirementExternalIds).some((id) => haystack.includes(id.toLowerCase())) &&
				!Array.from(evaluationExternalIds).some((id) => haystack.includes(id.toLowerCase())))
		) {
			findings.push({
				id: nextId("del"),
				category: "MISSING_DELIVERABLE",
				severity: "WARN",
				message: `산출물 ${d.external_id} (${d.title}) 가 매핑된 요구사항/평가항목을 설명에 명시하지 않습니다.`,
				relatedExternalId: d.external_id,
			});
		}
	}

	// 2. Every CRITICAL/HIGH priority requirement should appear in some
	// deliverable's notes. Heuristic: at least one deliverable should
	// mention the requirement's external_id.
	const highPriorityRequirements = detail.requirements.filter(
		(r) => r.priority === "CRITICAL" || r.priority === "HIGH",
	);
	for (const r of highPriorityRequirements) {
		const mentioned = detail.deliverables.some((d) => {
			const haystack = `${d.description ?? ""} ${(d as { notes?: string }).notes ?? ""}`.toLowerCase();
			return haystack.includes(r.external_id.toLowerCase());
		});
		if (!mentioned) {
			findings.push({
				id: nextId("req"),
				category: "MISSING_DELIVERABLE",
				severity: "WARN",
				message: `우선순위 ${r.priority} 요구사항 ${r.external_id} 가 어떤 산출물에도 매핑되지 않았습니다.`,
				relatedExternalId: r.external_id,
			});
		}
	}

	// 3. CRITICAL risks should have a mitigation note.
	for (const r of detail.risks) {
		if (r.severity === "CRITICAL" && !(r.mitigation ?? "").trim()) {
			findings.push({
				id: nextId("risk"),
				category: "LOW_PRIORITY_HIGH_SEVERITY_RISK",
				severity: "WARN",
				message: `CRITICAL 리스크 ${r.external_id} (${r.title}) 의 mitigation이 비어 있습니다.`,
				relatedExternalId: r.external_id,
			});
		}
	}

	// 4. CRITICAL/HIGH requirements without inspection criteria are
	// blocking — flag as FAIL.
	const inspectionReqExternalIds = new Set<string>();
	for (const d of detail.deliverables) {
		// optional: link to inspection table directly if rows exist; we use
		// the audit_events stream as a signal that inspection criteria have
		// been recorded for this genome.
	}
	const trusted = createTrustedSupabaseClient();
	const { data: inspectionRows } = await trusted
		.from("genome_inspection_criteria")
		.select("external_id")
		.eq("genome_id", genomeId);
	if (inspectionRows) {
		for (const row of inspectionRows) {
			const parts = row.external_id.split("|");
			if (parts[0]) inspectionReqExternalIds.add(parts[0]);
		}
	}
	for (const r of highPriorityRequirements) {
		if (!inspectionReqExternalIds.has(r.external_id)) {
			findings.push({
				id: nextId("insp"),
				category: "CRITICAL_REQUIREMENT_NO_INSPECTION",
				severity: "FAIL",
				message: `우선순위 ${r.priority} 요구사항 ${r.external_id} 에 검사기준이 없습니다.`,
				relatedExternalId: r.external_id,
			});
		}
	}

	// 5. WBS gap: every high-priority requirement should have at least
	// one WBS task. Detect from the audit events stream.
	const { data: wbsRows } = await trusted
		.from("genome_wbs_tasks")
		.select("external_id")
		.eq("genome_id", genomeId);
	const wbsReqExternalIds = new Set<string>();
	if (wbsRows) {
		for (const row of wbsRows) wbsReqExternalIds.add(row.external_id);
	}
	for (const r of highPriorityRequirements) {
		if (!wbsReqExternalIds.has(r.external_id)) {
			findings.push({
				id: nextId("wbs"),
				category: "WBS_GAP",
				severity: "WARN",
				message: `우선순위 ${r.priority} 요구사항 ${r.external_id} 에 WBS 작업이 없습니다.`,
				relatedExternalId: r.external_id,
			});
		}
	}

	// 6. Human verification gap: every HUMAN_VERIFIED requirement is
	// authoritative, but AI_DRAFT / SOURCE_VERIFIED / REVIEW_REQUIRED
	// requirements are the audit's primary concern.
	const unverifiedCount = detail.requirements.filter(
		(r) => !r.human_verified,
	).length;
	if (unverifiedCount > 0) {
		findings.push({
			id: nextId("unv"),
			category: "UNVERIFIED_REQUIREMENT",
			severity: "WARN",
			message: `사람 미검증 요구사항 ${unverifiedCount}건이 남아 있습니다.`,
		});
	}

	const counts: Record<AuditSeverity, number> = { INFO: 0, WARN: 0, FAIL: 0 };
	for (const f of findings) counts[f.severity] += 1;

	return {
		genomeId,
		runAt: new Date().toISOString(),
		findings,
		counts,
		summary:
			findings.length === 0
				? "일관성 검사 통과: 발견된 문제 없음."
				: `일관성 검사에서 ${findings.length}건 발견 (INFO ${counts.INFO}, WARN ${counts.WARN}, FAIL ${counts.FAIL}).`,
	};
}
