// Unified LLM provider selector. OpenAI Responses API is the default;
// pass provider: "groq" to route to Groq. fixtureMode short-circuits to
// the deterministic fixture for tests and local-dev-without-keys.

import "server-only";

import {
	OpenAIRateLimitError,
	OpenAIServerError,
	type ProviderOptions,
	type ResponsesRequest,
	type ResponsesResult,
} from "./openai-responses";
import { callGroqResponses } from "./groq-responses";

export type ProviderName = "openai" | "groq";

export type DispatchOptions = ProviderOptions & {
	provider?: ProviderName;
};

function readEnv(name: string): string {
	const value = process.env[name];
	return typeof value === "string" ? value : "";
}

function pickDefaultProvider(): ProviderName {
	if (readEnv("GROQ_API_KEY").length > 0) return "groq";
	return "openai";
}

export async function dispatchResponses(
	request: ResponsesRequest,
	options: DispatchOptions,
): Promise<ResponsesResult> {
	if (options.fixtureMode) {
		const { callResponses } = await import("./openai-responses");
		return callResponses(request, options);
	}
	const provider = options.provider ?? pickDefaultProvider();
	if (provider === "groq") return callGroqResponses(request, options);
	if (provider === "openai") {
		const { callResponses } = await import("./openai-responses");
		return callResponses(request, options);
	}
	throw new OpenAIServerError(`Unknown LLM provider: ${String(provider)}`);
}

export { OpenAIRateLimitError, OpenAIServerError };
export type { ProviderOptions, ResponsesRequest, ResponsesResult };
