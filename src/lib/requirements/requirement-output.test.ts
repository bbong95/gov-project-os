import { describe, expect, it } from "vitest";

import type { ExtractionSourceSpan } from "./requirement-extraction-input";
import { validateAndMapRequirementOutput } from "./requirement-output";

const spans: ExtractionSourceSpan[] = [
	{
		id: "50000000-0000-4000-8000-000000000011",
		ordinal: 1,
		location: { kind: "TEXT_LINES", lineStart: 3, lineEnd: 4 },
		originalText: "SER-001  서비스는 암호화해야 한다.  ",
		normalizedText: "SER-001 서비스는 암호화해야 한다.",
	},
	{
		id: "50000000-0000-4000-8000-000000000012",
		ordinal: 2,
		location: { kind: "TEXT_LINES", lineStart: 6, lineEnd: 6 },
		originalText: "PMR-001 주간보고를 제출한다.\r\n",
		normalizedText: "PMR-001 주간보고를 제출한다.",
	},
];

function candidate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		officialId: "SER-001",
		interpretation: "서비스 통신 구간 암호화를 구현해야 한다.",
		type: "SECURITY",
		atomicity: "ATOMIC",
		sourceSpanOrdinals: [2, 1],
		...overrides,
	};
}

describe("validateAndMapRequirementOutput", () => {
	it("maps ordinals to immutable evidence and derives source text on the server", async () => {
		const result = await validateAndMapRequirementOutput({
			value: { candidates: [candidate()] },
			spans,
		});

		expect(result).toEqual({
			candidates: [
				{
					candidateOrder: 1,
					officialId: "SER-001",
					sourceText:
						"SER-001  서비스는 암호화해야 한다.  \n\nPMR-001 주간보고를 제출한다.\r\n",
					interpretation: "서비스 통신 구간 암호화를 구현해야 한다.",
					type: "SECURITY",
					atomicity: "ATOMIC",
					provenanceState: "AI_DRAFT",
					contentSha256:
						"bed08e38dc3e630c05dce8f503238d726840dcd8ff39510a1bd84fffd3f4adb9",
					sources: [
						{
							sourceSpanId: "50000000-0000-4000-8000-000000000011",
							sourceSpanOrdinal: 1,
							sourceOrder: 1,
						},
						{
							sourceSpanId: "50000000-0000-4000-8000-000000000012",
							sourceSpanOrdinal: 2,
							sourceOrder: 2,
						},
					],
				},
			],
			acceptedOutputSha256:
				"c71559ce7c5e51203180597d6bc6c0f09bafd45bb838179ae2fe6f01afb49290",
		});
	});

	it("keeps provider array order as deterministic candidate order", async () => {
		const result = await validateAndMapRequirementOutput({
			value: {
				candidates: [
					candidate(),
					candidate({
						officialId: null,
						interpretation: "주간보고를 제출해야 한다.",
						type: "PROJECT_MANAGEMENT",
						sourceSpanOrdinals: [2],
					}),
				],
			},
			spans,
		});

		expect(result.candidates.map(({ candidateOrder }) => candidateOrder)).toEqual([1, 2]);
		expect(result.candidates[1]).toMatchObject({
			officialId: null,
			sourceText: "PMR-001 주간보고를 제출한다.\r\n",
			provenanceState: "AI_DRAFT",
		});
	});

	it("requires an official identifier to occur exactly in cited original evidence", async () => {
		await expect(
			validateAndMapRequirementOutput({
				value: {
					candidates: [candidate({ officialId: "ser-001", sourceSpanOrdinals: [1] })],
				},
				spans,
			}),
		).rejects.toMatchObject({ code: "AI_OUTPUT_INVALID" });
	});

	it.each([
		{ name: "null root", value: null },
		{ name: "array root", value: [] },
		{ name: "missing candidates", value: {} },
		{ name: "extra root key", value: { candidates: [], sourceText: "forged" } },
		{
			name: "provider source text",
			value: { candidates: [candidate({ sourceText: "모델이 만든 인용문" })] },
		},
		{
			name: "provider database ID",
			value: { candidates: [candidate({ sourceSpanId: spans[0].id })] },
		},
		{
			name: "missing required field",
			value: {
				candidates: [
					{
						officialId: null,
						interpretation: "합성 해석",
						type: "OTHER",
						sourceSpanOrdinals: [1],
					},
				],
			},
		},
		{
			name: "free-form type",
			value: { candidates: [candidate({ type: "NEW_TYPE" })] },
		},
		{
			name: "free-form atomicity",
			value: { candidates: [candidate({ atomicity: "MAYBE" })] },
		},
		{
			name: "empty interpretation",
			value: { candidates: [candidate({ interpretation: "  " })] },
		},
		{
			name: "blank official identifier",
			value: { candidates: [candidate({ officialId: " " })] },
		},
		{
			name: "empty evidence",
			value: { candidates: [candidate({ sourceSpanOrdinals: [] })] },
		},
		{
			name: "duplicate evidence",
			value: { candidates: [candidate({ sourceSpanOrdinals: [1, 1] })] },
		},
		{
			name: "unknown evidence",
			value: { candidates: [candidate({ sourceSpanOrdinals: [3] })] },
		},
		{
			name: "non-integer evidence",
			value: { candidates: [candidate({ sourceSpanOrdinals: [1.5] })] },
		},
	] as const)("rejects $name without returning a partial snapshot", async ({ value }) => {
		await expect(validateAndMapRequirementOutput({ value, spans })).rejects.toMatchObject({
			code: "AI_OUTPUT_INVALID",
		});
	});

	it.each([
		{
			name: "official identifier length",
			value: { candidates: [candidate({ officialId: "S".repeat(129) })] },
		},
		{
			name: "interpretation byte length",
			value: { candidates: [candidate({ interpretation: "가".repeat(2_731) })] },
		},
		{
			name: "evidence count",
			value: {
				candidates: [
					candidate({ sourceSpanOrdinals: Array.from({ length: 65 }, (_, index) => index + 1) }),
				],
			},
		},
		{
			name: "candidate count",
			value: { candidates: Array.from({ length: 501 }, () => candidate()) },
		},
	] as const)("rejects $name overflow without truncation", async ({ value }) => {
		await expect(validateAndMapRequirementOutput({ value, spans })).rejects.toMatchObject({
			code: "AI_OUTPUT_LIMIT_EXCEEDED",
		});
	});
});
