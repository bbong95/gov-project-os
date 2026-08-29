// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
	classifyRequirementType,
	deriveDeliverables,
	deriveEvaluationItems,
	deriveContractTerms,
	deriveRisks,
} from "./project-genome";

const fakeSpan = (text: string, sha = "0".repeat(64)) => ({
	ordinal: 0,
	originalText: text,
	normalizedText: text,
	originalTextSha256: sha,
	location: { kind: "SECTION" as const, sectionIndex: 1, blockIndex: 1 },
});

describe("MVP1 genome extractors", () => {
	it("classifies a ○ SER-001 requirement as SECURITY and ATOMIC", () => {
		const r = classifyRequirementType("○ SER-001 시스템은 사용자 접근권한을 관리하여야 한다");
		expect(r.type).toBe("SECURITY");
		expect(r.atomicity).toBe("ATOMIC");
		expect(r.priority).toBe("HIGH");
	});

	it("classifies a generic COMPOSITE sentence", () => {
		const r = classifyRequirementType(
			"본 시스템은; 첫째로 데이터 무결성을 보장하고, 둘째로 백업 절차를 따라야 하며, 셋째로 복구 시험을 수행하여야 한다; 마지막으로 결과를 기록하여야 한다; 또한 성능 기준을 만족하여야 한다",
		);
		expect(r.atomicity).toBe("COMPOSITE");
	});

	it("derives deliverables from the deliverable pattern list", () => {
		const out = deriveDeliverables([
			fakeSpan("제안서는 A4 10매 이내로 작성하여야 한다"),
			fakeSpan("사업수행계획서에는 품질관리 계획을 포함하여야 한다"),
			fakeSpan("완료보고서는 검수 완료 후 14일 이내에 제출하여야 한다"),
		]);
		const phases = out.map((d) => d.submissionPhase);
		expect(phases).toContain("PROPOSAL");
		expect(phases).toContain("KICKOFF");
		expect(phases).toContain("CLOSEOUT");
	});

	it("derives evaluation items and rescales to 100", () => {
		const out = deriveEvaluationItems([
			fakeSpan("기술방안 평가 항목"),
			fakeSpan("사업관리 평가"),
			fakeSpan("가격 평가"),
		]);
		const total = out.reduce((acc: number, item) => acc + item.maxScore, 0);
		expect(total).toBeGreaterThan(0);
		expect(Math.abs(total - 100)).toBeLessThanOrEqual(0.5);
	});

	it("derives contract terms and dedupes by term type", () => {
		const out = deriveContractTerms([
			fakeSpan("입찰 참가자격은 다음 각호를 충족하여야 한다"),
			fakeSpan("입찰 참가자격이 없는 경우"),
			fakeSpan("사업기간은 12개월 이내로 한다"),
		]);
		const types = out.map((c) => c.termType);
		expect(types.filter((t) => t === "QUALIFICATION").length).toBe(1);
		expect(types).toContain("PERIOD");
	});

	it("does not classify ○ requirement lines as risks", () => {
		const out = deriveRisks([
			fakeSpan("○ SER-001 위험 관리가 필요"),
			fakeSpan("보안 위험이 존재한다"),
		]);
		const rsk = out.find((r) => r.title.includes("SER-001"));
		expect(rsk).toBeUndefined();
	});
});
