import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
	persistTrustedDocumentParse,
	type TrustedDocumentParseInput,
} from "./trusted-server";

const PARSE_ID = "44000000-0000-4000-8000-000000000101";
const RPC_INPUT: TrustedDocumentParseInput = {
	target_actor_user_id: "41000000-0000-4000-8000-000000000001",
	target_document_id: "43000000-0000-4000-8000-000000000101",
	target_source_sha256: "a".repeat(64),
	target_parser_key: "plain-text",
	target_parser_version: "1.0.0",
	target_normalization_version: "nfc-lines-v1",
	target_detected_format: "txt",
	target_warnings: [],
	target_result_sha256: "b".repeat(64),
	target_spans: [
		{
			ordinal: 1,
			location: { kind: "TEXT_LINES" as const, lineStart: 1, lineEnd: 1 },
			originalText: "abc",
			normalizedText: "abc",
		},
	],
};

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("persistTrustedDocumentParse", () => {
	it("fails closed when the server backend secret is absent", async () => {
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.invalid");
		vi.stubEnv("SUPABASE_BACKEND_SECRET", "");
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_BACKEND_SECRET", "public-must-not-count");

		await expect(persistTrustedDocumentParse(RPC_INPUT)).rejects.toThrow(
			"Trusted Supabase configuration is missing.",
		);
	});

	it("calls only the trusted RPC with the backend secret and no user session", async () => {
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.invalid");
		vi.stubEnv("SUPABASE_BACKEND_SECRET", "synthetic-backend-secret");
		let capturedUrl = "";
		let capturedHeaders = new Headers();
		let capturedBody = "";
		vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = new Request(input, init);
			capturedUrl = request.url;
			capturedHeaders = new Headers(request.headers);
			capturedBody = await request.text();
			return new Response(JSON.stringify(PARSE_ID), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		});

		await expect(persistTrustedDocumentParse(RPC_INPUT)).resolves.toBe(PARSE_ID);
		expect(capturedUrl).toBe(
			"https://synthetic.invalid/rest/v1/rpc/persist_document_parse",
		);
		expect(capturedHeaders.get("apikey")).toBe("synthetic-backend-secret");
		expect(capturedHeaders.get("authorization")).toBe(
			"Bearer synthetic-backend-secret",
		);
		expect(JSON.parse(capturedBody)).toEqual(RPC_INPUT);
	});
});
