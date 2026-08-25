import { describe, expect, it } from "vitest";

import type { SourceLocation } from "../parsing/document-parser";
import {
	buildRequirementExtractionInput,
	type RequirementExtractionInput,
} from "./requirement-extraction-input";

const TENANT_ID = "50000000-0000-4000-8000-000000000001";
const PROJECT_ID = "50000000-0000-4000-8000-000000000002";
const DOCUMENT_ID = "50000000-0000-4000-8000-000000000003";
const DOCUMENT_PARSE_ID = "50000000-0000-4000-8000-000000000004";
const PARSE_RESULT_SHA256 = "a".repeat(64);

function extractionInput(
	overrides: Partial<RequirementExtractionInput> = {},
): RequirementExtractionInput {
	return {
		tenantId: TENANT_ID,
		projectId: PROJECT_ID,
		documentId: DOCUMENT_ID,
		documentParseId: DOCUMENT_PARSE_ID,
		parserName: "plain-text",
		parserVersion: "1.0.0",
		normalizationVersion: "nfc-lines-v1",
		parseResultSha256: PARSE_RESULT_SHA256,
		provider: "OPENAI",
		model: "gpt-test",
		spans: [
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
		],
		...overrides,
	};
}

describe("buildRequirementExtractionInput", () => {
	it("builds the exact provider-visible envelope without database IDs or original text", async () => {
		const result = await buildRequirementExtractionInput(extractionInput());

		expect(result).toEqual({
			canonicalInput:
				'{"schemaVersion":"requirement-candidates-v1","parse":{"parserName":"plain-text","parserVersion":"1.0.0","normalizationVersion":"nfc-lines-v1","resultSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},"sourceSpans":[{"ordinal":1,"location":{"kind":"TEXT_LINES","lineStart":3,"lineEnd":4},"normalizedText":"SER-001 서비스는 암호화해야 한다."},{"ordinal":2,"location":{"kind":"TEXT_LINES","lineStart":6,"lineEnd":6},"normalizedText":"PMR-001 주간보고를 제출한다."}]}',
			canonicalInputSha256:
				"d8a6ed4426d402cc8e9ab5c03acb5f37ab2e1812b6c616435e805d540754e0aa",
			fingerprintSha256:
				"1ec75c3e46298470ee9de1f116b3559b9affab4a302cfe47600806aae4c07825",
		});
		expect(result.canonicalInput).not.toContain(DOCUMENT_PARSE_ID);
		expect(result.canonicalInput).not.toContain("50000000-0000-4000-8000-000000000011");
		expect(result.canonicalInput).not.toContain("  서비스는");
	});

	it("canonicalizes location key order and ignores source IDs and original text", async () => {
		const baseline = await buildRequirementExtractionInput(extractionInput());
		const location = {
			lineEnd: 4,
			kind: "TEXT_LINES",
			lineStart: 3,
		} as SourceLocation;
		const changedNonProviderData = extractionInput({
			spans: [
				{
					...extractionInput().spans[0],
					id: "50000000-0000-4000-8000-000000000099",
					location,
					originalText: "원문 표현이 달라도 normalizedText가 동일한 합성 데이터",
				},
				extractionInput().spans[1],
			],
		});

		expect(await buildRequirementExtractionInput(changedNonProviderData)).toEqual(baseline);
	});

	it("changes only the fingerprint when trusted scope or model changes", async () => {
		const baseline = await buildRequirementExtractionInput(extractionInput());

		for (const override of [
			{ tenantId: "50000000-0000-4000-8000-000000000101" },
			{ projectId: "50000000-0000-4000-8000-000000000102" },
			{ documentId: "50000000-0000-4000-8000-000000000103" },
			{ documentParseId: "50000000-0000-4000-8000-000000000104" },
			{ model: "gpt-test-next" },
		] satisfies Array<Partial<RequirementExtractionInput>>) {
			const changed = await buildRequirementExtractionInput(extractionInput(override));
			expect(changed.canonicalInput).toBe(baseline.canonicalInput);
			expect(changed.canonicalInputSha256).toBe(baseline.canonicalInputSha256);
			expect(changed.fingerprintSha256).not.toBe(baseline.fingerprintSha256);
		}
	});

	it("changes the canonical input and fingerprint when parser evidence changes", async () => {
		const baseline = await buildRequirementExtractionInput(extractionInput());
		const changed = await buildRequirementExtractionInput(
			extractionInput({ parserVersion: "1.0.1" }),
		);

		expect(changed.canonicalInput).not.toBe(baseline.canonicalInput);
		expect(changed.canonicalInputSha256).not.toBe(baseline.canonicalInputSha256);
		expect(changed.fingerprintSha256).not.toBe(baseline.fingerprintSha256);
	});

	it.each([
		{ name: "empty spans", spans: [] },
		{
			name: "non-contiguous ordinals",
			spans: [{ ...extractionInput().spans[0], ordinal: 2 }],
		},
		{
			name: "blank normalized text",
			spans: [{ ...extractionInput().spans[0], normalizedText: " \n " }],
		},
		{
			name: "invalid source location",
			spans: [
				{
					...extractionInput().spans[0],
					location: { kind: "TEXT_LINES", lineStart: 4, lineEnd: 3 } as SourceLocation,
				},
			],
		},
	] as const)("rejects $name before provider use", async ({ spans }) => {
		await expect(
			buildRequirementExtractionInput(
				extractionInput({ spans: [...spans] }),
			),
		).rejects.toMatchObject({ code: "AI_INPUT_INVALID" });
	});

	it("rejects an oversized canonical envelope instead of truncating it", async () => {
		await expect(
			buildRequirementExtractionInput(
				extractionInput({
					spans: [
						{
							...extractionInput().spans[0],
							normalizedText: "가".repeat(350_000),
						},
					],
				}),
			),
		).rejects.toMatchObject({ code: "AI_INPUT_LIMIT_EXCEEDED" });
	});
});
