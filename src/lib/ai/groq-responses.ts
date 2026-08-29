// Server-only Groq provider. OpenAI-compatible Responses API via fetch +
// Llama 3.3 70B (free tier). The same fixture mode contract as the
// OpenAI adapter, so every LLM call site can pick provider without
// changing its schema or its tests.

import "server-only";

import Groq from "groq-sdk";
import {
	buildJsonSchemaInstruction,
	OpenAIRateLimitError,
	OpenAIServerError,
	type ProviderOptions,
	type ResponsesRequest,
	type ResponsesResult,
} from "./openai-responses";

// Note: PromptMessage is re-exported only via ./openai-responses to avoid
// pulling in unused symbols here.

const DEFAULT_MODEL = "qwen/qwen3.8-27b";

function readEnv(name: string): string {
	const value = process.env[name];
	return typeof value === "string" ? value : "";
}

function fingerprintFor(model: string, promptVersion: string): string {
	return `groq:${model}@${promptVersion}`;
}

async function callGroq(
	request: ResponsesRequest,
	fingerprint: string,
	apiKey: string,
): Promise<ResponsesResult> {
	const client = new Groq({ apiKey });
	const systemText = request.input
		.filter((m) => m.role === "system")
		.map((m) => m.content)
		.join("\n\n");
	const userText = request.input
		.filter((m) => m.role === "user")
		.map((m) => m.content)
		.join("\n\n");
	const composed = [
		systemText,
		systemText && request.structuredSchema ? buildJsonSchemaInstruction(request.structuredSchema) : "",
		userText,
	]
		.filter(Boolean)
		.join("\n\n");

	try {
		const completion = await client.chat.completions.create({
			model: request.model || DEFAULT_MODEL,
			messages: [{ role: "user", content: composed }],
			max_tokens: request.maxOutputTokens,
			temperature: request.temperature,
			response_format: request.structuredSchema
				? { type: "json_object" }
				: undefined,
		});
		const text = completion.choices[0]?.message?.content?.trim() ?? "";
		if (request.structuredSchema) {
			try {
				return { kind: "json", value: JSON.parse(text), modelFingerprint: fingerprint };
			} catch (error) {
				throw new OpenAIServerError(
					`Groq JSON parse failed: ${(error as Error).message}: ${text.slice(0, 200)}`,
				);
			}
		}
		return { kind: "text", text, modelFingerprint: fingerprint };
	} catch (error) {
		const message = (error as Error).message ?? "Groq error";
		if (/429|rate/i.test(message)) throw new OpenAIRateLimitError(message);
		throw new OpenAIServerError(message);
	}
}

export async function callGroqResponses(
	request: ResponsesRequest,
	options: ProviderOptions,
): Promise<ResponsesResult> {
	const fingerprint = fingerprintFor(options.model || DEFAULT_MODEL, options.promptVersion);
	const apiKey = readEnv("GROQ_API_KEY");
	if (options.fixtureMode || apiKey.length === 0) {
		return (await import("./openai-responses")).callResponses(request, options);
	}
	return callGroq(request, fingerprint, apiKey);
}
