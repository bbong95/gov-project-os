import { afterEach, describe, expect, it, vi } from "vitest";

const serverOnlyGuard = vi.hoisted(() => ({ blocked: false }));

vi.mock("server-only", () => {
	if (serverOnlyGuard.blocked) {
		throw new Error("SERVER_ONLY_GUARD");
	}
	return {};
});

import {
	mergeTrustedRequirementCandidates,
	reviewTrustedRequirementCandidate,
	splitTrustedRequirementCandidate,
	type MergeCandidatesInput,
	type ReviewCandidateInput,
	type SplitCandidateInput,
} from "./trusted-requirement-review";

const ACTOR_ID = "51000000-0000-4000-8000-000000000001";
const RUN_ID = "56000000-0000-4000-8000-000000000101";
const CANDIDATE_ID = "57000000-0000-4000-8000-000000000101";

const REVIEW_INPUT: ReviewCandidateInput = {
	actorId: ACTOR_ID,
	runId: RUN_ID,
	candidateId: CANDIDATE_ID,
	action: "APPROVE",
	newInterpretation: null,
};

const MERGE_INPUT: MergeCandidatesInput = {
	actorId: ACTOR_ID,
	runId: RUN_ID,
	candidateIds: [CANDIDATE_ID, "57000000-0000-4000-8000-000000000103"],
	interpretation: "병합 해석",
};

const SPLIT_INPUT: SplitCandidateInput = {
	actorId: ACTOR_ID,
	runId: RUN_ID,
	candidateId: CANDIDATE_ID,
	parts: [
		{ interpretation: "파트 하나", sourceSpanOrdinals: [1] },
		{ interpretation: "파트 둘", sourceSpanOrdinals: [3] },
	],
};

function stubRpcResponse(body: unknown, ok = true): {
	capturedUrl: string;
	capturedHeaders: Headers;
	capturedBody: unknown;
} {
	const state = {
		capturedUrl: "",
		capturedHeaders: new Headers(),
		capturedBody: {} as unknown,
	};
	vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = new Request(input, init);
		state.capturedUrl = request.url;
		state.capturedHeaders = new Headers(request.headers);
		state.capturedBody = JSON.parse(await request.text());
		return new Response(JSON.stringify(body), {
			status: ok ? 200 : 400,
			headers: { "content-type": "application/json" },
		});
	});
	return state;
}

afterEach(() => {
	serverOnlyGuard.blocked = false;
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("trusted requirement review adapters", () => {
	it("invokes the review RPC with exact snake-case arguments and maps the result", async () => {
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.invalid");
		vi.stubEnv("SUPABASE_BACKEND_SECRET", "synthetic-backend-secret");
		const state = stubRpcResponse({
			candidateId: CANDIDATE_ID,
			provenanceState: "HUMAN_VERIFIED",
		});

		await expect(reviewTrustedRequirementCandidate(REVIEW_INPUT)).resolves.toEqual({
			candidateId: CANDIDATE_ID,
			provenanceState: "HUMAN_VERIFIED",
		});
		expect(state.capturedUrl).toBe(
			"https://synthetic.invalid/rest/v1/rpc/review_requirement_candidate",
		);
		expect(state.capturedHeaders.get("apikey")).toBe("synthetic-backend-secret");
		expect(state.capturedBody).toEqual({
			p_actor_id: ACTOR_ID,
			p_run_id: RUN_ID,
			p_candidate_id: CANDIDATE_ID,
			p_action: "APPROVE",
			p_new_interpretation: null,
		});
		expect(JSON.stringify(state.capturedBody)).not.toContain("synthetic-backend-secret");
	});

	it("invokes the merge RPC with the candidate id array", async () => {
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.invalid");
		vi.stubEnv("SUPABASE_BACKEND_SECRET", "synthetic-backend-secret");
		const newId = "57000000-0000-4000-8000-000000000201";
		const state = stubRpcResponse({ candidateId: newId, candidateIds: [newId] });

		await expect(mergeTrustedRequirementCandidates(MERGE_INPUT)).resolves.toEqual({
			candidateId: newId,
		});
		expect(state.capturedUrl).toBe(
			"https://synthetic.invalid/rest/v1/rpc/merge_requirement_candidates",
		);
		expect(state.capturedBody).toEqual({
			p_actor_id: ACTOR_ID,
			p_run_id: RUN_ID,
			p_candidate_ids: MERGE_INPUT.candidateIds,
			p_interpretation: "병합 해석",
		});
	});

	it("invokes the split RPC with the evidence-disjoint parts", async () => {
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.invalid");
		vi.stubEnv("SUPABASE_BACKEND_SECRET", "synthetic-backend-secret");
		const state = stubRpcResponse({
			candidateIds: ["57000000-0000-4000-8000-000000000301", "57000000-0000-4000-8000-000000000302"],
		});

		await expect(splitTrustedRequirementCandidate(SPLIT_INPUT)).resolves.toEqual({
			candidateIds: [
				"57000000-0000-4000-8000-000000000301",
				"57000000-0000-4000-8000-000000000302",
			],
		});
		expect(state.capturedUrl).toBe(
			"https://synthetic.invalid/rest/v1/rpc/split_requirement_candidate",
		);
		expect(state.capturedBody).toEqual({
			p_actor_id: ACTOR_ID,
			p_run_id: RUN_ID,
			p_candidate_id: CANDIDATE_ID,
			p_parts: SPLIT_INPUT.parts,
		});
	});

	it("maps malformed or failed responses to one fixed error", async () => {
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.invalid");
		vi.stubEnv("SUPABASE_BACKEND_SECRET", "synthetic-backend-secret");
		stubRpcResponse({ unexpected: true });

		await expect(
			reviewTrustedRequirementCandidate(REVIEW_INPUT),
		).rejects.toThrow("Trusted requirement review failed.");

		stubRpcResponse({ message: "db error" }, false);
		await expect(
			mergeTrustedRequirementCandidates(MERGE_INPUT),
		).rejects.toThrow("Trusted requirement review failed.");

		stubRpcResponse({ candidateIds: [] });
		await expect(
			splitTrustedRequirementCandidate(SPLIT_INPUT),
		).rejects.toThrow("Trusted requirement review failed.");
	});

	it("fails closed before any network call when the backend secret is missing", async () => {
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.invalid");
		vi.stubEnv("SUPABASE_BACKEND_SECRET", "");
		let fetchCalled = false;
		vi.stubGlobal("fetch", async () => {
			fetchCalled = true;
			return new Response("{}", { status: 200 });
		});

		await expect(
			reviewTrustedRequirementCandidate(REVIEW_INPUT),
		).rejects.toThrow();
		await expect(
			mergeTrustedRequirementCandidates(MERGE_INPUT),
		).rejects.toThrow();
		await expect(
			splitTrustedRequirementCandidate(SPLIT_INPUT),
		).rejects.toThrow();
		expect(fetchCalled).toBe(false);
	});
});
