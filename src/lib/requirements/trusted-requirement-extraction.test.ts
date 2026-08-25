import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

const serverOnlyGuard = vi.hoisted(() => ({ blocked: false }));

vi.mock("server-only", () => {
	if (serverOnlyGuard.blocked) {
		throw new Error("SERVER_ONLY_GUARD");
	}
	return {};
});

import {
	persistTrustedRequirementExtraction,
	recordTrustedRequirementExtractionOutcome,
	type PersistRequirementExtractionInput,
	type RecordRequirementExtractionOutcomeInput,
} from "./trusted-requirement-extraction";

const RUN_ID = "56000000-0000-4000-8000-000000000101";

const PERSIST_INPUT: PersistRequirementExtractionInput = {
	actorId: "51000000-0000-4000-8000-000000000001",
	documentParseId: "54000000-0000-4000-8000-000000000101",
	privacyClassification: "INTERNAL",
	provider: "OPENAI",
	model: "synthetic-model",
	policyVersion: "document-privacy-v1",
	promptVersion: "requirement-extraction-v1",
	schemaVersion: "requirement-candidates-v1",
	parseResultSha256: "1".repeat(64),
	canonicalInputSha256: "a".repeat(64),
	fingerprintSha256: "b".repeat(64),
	acceptedOutputSha256: "f".repeat(64),
	providerResponseId: "resp_synthetic",
	usage: { inputTokens: 10, outputTokens: 5 },
	candidates: [
		{
			candidateOrder: 1,
			officialId: "M08",
			sourceText: "Synthetic source must not be trusted by SQL.",
			interpretation: "Synthetic interpretation",
			type: "FUNCTIONAL",
			atomicity: "ATOMIC",
			provenanceState: "AI_DRAFT",
			contentSha256: "c".repeat(64),
			sources: [
				{
					sourceSpanId: "55000000-0000-4000-8000-000000000101",
					sourceSpanOrdinal: 1,
					sourceOrder: 1,
				},
			],
		},
	],
};

const OUTCOME_INPUT: RecordRequirementExtractionOutcomeInput = {
	actorId: "51000000-0000-4000-8000-000000000001",
	documentParseId: "54000000-0000-4000-8000-000000000101",
	policyDecision: "ALLOW",
	outcomeCode: "AI_PROVIDER_UNAVAILABLE",
	fingerprintSha256: "b".repeat(64),
	provider: "OPENAI",
	model: "synthetic-model",
	policyVersion: "document-privacy-v1",
	promptVersion: "requirement-extraction-v1",
	schemaVersion: "requirement-candidates-v1",
	durationMs: 123,
};

afterEach(() => {
	serverOnlyGuard.blocked = false;
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("trusted requirement extraction persistence", () => {
	it("accepts only privacy classifications permitted by the persistence policy", () => {
		expectTypeOf<PersistRequirementExtractionInput["privacyClassification"]>()
			.toEqualTypeOf<"PUBLIC" | "INTERNAL">();
	});

	it("fails closed before HTTP when the backend secret is absent", async () => {
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.invalid");
		vi.stubEnv("SUPABASE_BACKEND_SECRET", "");
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_BACKEND_SECRET", "public-must-not-count");
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);

		await expect(persistTrustedRequirementExtraction(PERSIST_INPUT)).rejects.toThrow(
			"Trusted Supabase configuration is missing.",
		);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("maps a validated snapshot to the exact service-role RPC without source text or request secrets", async () => {
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.invalid");
		vi.stubEnv("SUPABASE_BACKEND_SECRET", "synthetic-backend-secret");
		const forgedInput = {
			...PERSIST_INPUT,
			backendSecret: "forged-request-secret",
		};
		let capturedUrl = "";
		let capturedHeaders = new Headers();
		let capturedBody: unknown;
		vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = new Request(input, init);
			capturedUrl = request.url;
			capturedHeaders = new Headers(request.headers);
			capturedBody = JSON.parse(await request.text());
			return new Response(JSON.stringify({ runId: RUN_ID, reused: false }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		});

		await expect(
			persistTrustedRequirementExtraction(forgedInput),
		).resolves.toEqual({ runId: RUN_ID, reused: false });
		expect(capturedUrl).toBe(
			"https://synthetic.invalid/rest/v1/rpc/persist_requirement_extraction",
		);
		expect(capturedHeaders.get("apikey")).toBe("synthetic-backend-secret");
		expect(capturedHeaders.get("authorization")).toBe(
			"Bearer synthetic-backend-secret",
		);
		expect(capturedBody).toEqual({
			p_actor_id: PERSIST_INPUT.actorId,
			p_document_parse_id: PERSIST_INPUT.documentParseId,
			p_privacy_classification: "INTERNAL",
			p_provider: "OPENAI",
			p_model: "synthetic-model",
			p_policy_version: "document-privacy-v1",
			p_prompt_version: "requirement-extraction-v1",
			p_schema_version: "requirement-candidates-v1",
			p_parse_result_sha256: PERSIST_INPUT.parseResultSha256,
			p_canonical_input_sha256: PERSIST_INPUT.canonicalInputSha256,
			p_fingerprint_sha256: PERSIST_INPUT.fingerprintSha256,
			p_accepted_output_sha256: PERSIST_INPUT.acceptedOutputSha256,
			p_provider_response_id: "resp_synthetic",
			p_input_tokens: 10,
			p_output_tokens: 5,
			p_candidates: [
				{
					candidateOrder: 1,
					officialId: "M08",
					interpretation: "Synthetic interpretation",
					type: "FUNCTIONAL",
					atomicity: "ATOMIC",
					provenanceState: "AI_DRAFT",
					contentSha256: "c".repeat(64),
					sources: PERSIST_INPUT.candidates[0].sources,
				},
			],
		});
		expect(JSON.stringify(capturedBody)).not.toContain("forged-request-secret");
		expect(JSON.stringify(capturedBody)).not.toContain("sourceText");
	});

	it("maps malformed or failed persistence responses to one fixed error", async () => {
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.invalid");
		vi.stubEnv("SUPABASE_BACKEND_SECRET", "synthetic-backend-secret");
		vi.stubGlobal("fetch", async () =>
			new Response(JSON.stringify({ message: "raw database detail" }), {
				status: 400,
				headers: { "content-type": "application/json" },
			}),
		);

		await expect(persistTrustedRequirementExtraction(PERSIST_INPUT)).rejects.toThrow(
			"Trusted requirement persistence failed.",
		);
	});

	it("maps a safe outcome to the exact service-role RPC", async () => {
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.invalid");
		vi.stubEnv("SUPABASE_BACKEND_SECRET", "synthetic-backend-secret");
		let capturedUrl = "";
		let capturedBody: unknown;
		vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = new Request(input, init);
			capturedUrl = request.url;
			capturedBody = JSON.parse(await request.text());
			return new Response(null, { status: 204 });
		});

		await expect(
			recordTrustedRequirementExtractionOutcome(OUTCOME_INPUT),
		).resolves.toBeUndefined();
		expect(capturedUrl).toBe(
			"https://synthetic.invalid/rest/v1/rpc/record_requirement_extraction_outcome",
		);
		expect(capturedBody).toEqual({
			p_actor_id: OUTCOME_INPUT.actorId,
			p_document_parse_id: OUTCOME_INPUT.documentParseId,
			p_policy_decision: "ALLOW",
			p_outcome_code: "AI_PROVIDER_UNAVAILABLE",
			p_fingerprint_sha256: OUTCOME_INPUT.fingerprintSha256,
			p_provider: "OPENAI",
			p_model: "synthetic-model",
			p_policy_version: "document-privacy-v1",
			p_prompt_version: "requirement-extraction-v1",
			p_schema_version: "requirement-candidates-v1",
			p_duration_ms: 123,
		});
	});

	it("sanitizes safe-outcome RPC failures", async () => {
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.invalid");
		vi.stubEnv("SUPABASE_BACKEND_SECRET", "synthetic-backend-secret");
		vi.stubGlobal("fetch", async () =>
			new Response(JSON.stringify({ message: "raw source and provider body" }), {
				status: 500,
				headers: { "content-type": "application/json" },
			}),
		);

		await expect(
			recordTrustedRequirementExtractionOutcome(OUTCOME_INPUT),
		).rejects.toThrow("Trusted requirement outcome recording failed.");
	});

	it("is stopped by the server-only import guard", async () => {
		vi.resetModules();
		const guard = vi.fn(() => {
			throw new Error("SERVER_ONLY_GUARD");
		});
		vi.doMock("server-only", guard);

		await expect(import("./trusted-requirement-extraction")).rejects.toThrow();
		expect(guard).toHaveBeenCalledOnce();
	});
});
