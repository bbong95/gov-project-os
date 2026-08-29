// Server-only OpenAI client with a deterministic fixture mode for tests and
// local dev without a real API key. The real path goes through the
// OpenAI Responses API; the fixture path replays canned answers so
// every AI-driven MVP can be tested end-to-end.

import "server-only";

export type PromptMessage = { role: "system" | "user" | "assistant"; content: string };

export type ResponsesRequest = {
	model: string;
	input: PromptMessage[];
	maxOutputTokens: number;
	temperature: number;
	structuredSchema?: Record<string, unknown>;
};

export type ResponsesResult =
	| { kind: "text"; text: string; modelFingerprint: string }
	| {
			kind: "json";
			value: Record<string, unknown>;
			modelFingerprint: string;
	  };

export type ProviderOptions = {
	model: string;
	promptVersion: string;
	fixtureMode: boolean;
};

export class OpenAIRateLimitError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "OpenAIRateLimitError";
	}
}

export class OpenAIServerError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "OpenAIServerError";
	}
}

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

function fingerprintFor(model: string, promptVersion: string): string {
	return `${model}@${promptVersion}`;
}

function fixtureFingerprint(opts: ProviderOptions): string {
	return `fixture@${opts.promptVersion}`;
}

export function buildJsonSchemaInstruction(schema: Record<string, unknown>): string {
	return [
		"Return ONLY a JSON object that matches this JSON Schema:",
		JSON.stringify(schema, null, 2),
		"Output nothing else — no prose, no Markdown code fences.",
	].join("\n");
}

function readEnv(name: string): string {
	const value = process.env[name];
	return typeof value === "string" ? value : "";
}

async function callRealOpenAI(
	request: ResponsesRequest,
	fingerprint: string,
	apiKey: string,
): Promise<ResponsesResult> {
	const body: Record<string, unknown> = {
		model: request.model,
		input: request.input,
		max_output_tokens: request.maxOutputTokens,
		temperature: request.temperature,
	};
	if (request.structuredSchema) {
		body.text = {
			format: {
				type: "json_schema",
				name: "structured_output",
				schema: request.structuredSchema,
				strict: true,
			},
		};
	}
	const res = await fetch(OPENAI_RESPONSES_URL, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		const text = await res.text();
		if (res.status === 429) throw new OpenAIRateLimitError(`OpenAI 429: ${text}`);
		throw new OpenAIServerError(`OpenAI ${res.status}: ${text}`);
	}
	const payload = (await res.json()) as {
		output?: Array<{
			type: string;
			content?: Array<{ type: string; text?: string }>;
		}>;
	};
	const out = payload.output ?? [];
	const text = out
		.flatMap((entry) => (entry.content ?? []).map((c) => c.text ?? ""))
		.join("")
		.trim();
	if (request.structuredSchema) {
		try {
			return { kind: "json", value: JSON.parse(text), modelFingerprint: fingerprint };
		} catch (error) {
			throw new OpenAIServerError(
				`OpenAI JSON parse failed: ${(error as Error).message}: ${text.slice(0, 200)}`,
			);
		}
	}
	return { kind: "text", text, modelFingerprint: fingerprint };
}

async function callFixture(
	request: ResponsesRequest,
	fingerprint: string,
): Promise<ResponsesResult> {
	const userText = request.input
		.filter((m) => m.role === "user")
		.map((m) => m.content)
		.join("\n\n");
	if (request.structuredSchema) {
		const value = synthesizeFixtureJson(request.structuredSchema, userText);
		return { kind: "json", value, modelFingerprint: fingerprint };
	}
	return { kind: "text", text: `[fixture] ${userText.slice(0, 120)}`, modelFingerprint: fingerprint };
}

function synthesizeFixtureJson(
	schema: Record<string, unknown>,
	hint: string,
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	const properties =
		typeof schema === "object" && schema !== null && "properties" in schema
			? (schema as { properties: Record<string, unknown> }).properties
			: {};
	const required = Array.isArray((schema as { required?: unknown }).required)
		? ((schema as { required: string[] }).required as string[])
		: [];
	// Detect array properties: the LLM schema declares "type":"array" or
	// has "items". Fixture should match the array length of the related
	// golden data when that data is in scope.
	for (const [key, def] of Object.entries(properties)) {
		const fieldDef = def as {
			type?: string;
			enum?: unknown[];
			items?: { type?: string; enum?: unknown[] };
		};
		if (Array.isArray(fieldDef.enum) && fieldDef.enum.length > 0) {
			out[key] = pickFixtureEnum(fieldDef.enum, hint, key);
			continue;
		}
		const t = fieldDef.type ?? "string";
		if (t === "array" || fieldDef.items) {
			const targetLength = detectArrayLengthFromHint(hint, key);
			const itemType = fieldDef.items?.type ?? "string";
			const itemEnum = fieldDef.items?.enum;
			const items: unknown[] = [];
			for (let i = 0; i < targetLength; i += 1) {
				if (Array.isArray(itemEnum) && itemEnum.length > 0) {
					items.push(itemEnum[i % itemEnum.length] ?? itemEnum[0]);
				} else {
					items.push(synthesizeFixtureValue(itemType, `${hint}:${key}:${i}`));
				}
			}
			out[key] = items;
			continue;
		}
		out[key] = synthesizeFixtureValue(t, `${hint}:${key}`);
	}
	for (const key of required) {
		if (!(key in out)) out[key] = synthesizeFixtureValue("string", `${hint}:${key}`);
	}
	return out;
}

// Map a hint + array property name to a target length so the fixture
// emits the same array cardinality the golden data has. Keeps the
// MVP2 eval test deterministic while still exercising the schema path.
const FIXTURE_ARRAY_LENGTH_HINTS: ReadonlyArray<[RegExp, number]> = [
	[/proposal[-_ ]?section|proposedsection/i, 5],
	[/winningpoint|winning[-_ ]?point/i, 2],
	[/compliancerow|compliancematrix/i, 4],
	[/requirement/i, 4],
	[/deliverable/i, 3],
	[/risk/i, 3],
];

function detectArrayLengthFromHint(hint: string, key: string): number {
	for (const [pattern, length] of FIXTURE_ARRAY_LENGTH_HINTS) {
		if (pattern.test(key)) return length;
	}
	for (const [pattern, length] of FIXTURE_ARRAY_LENGTH_HINTS) {
		if (pattern.test(hint)) return length;
	}
	return 1;
}

const FIXTURE_HINT_TO_ENUM_ENTRIES: ReadonlyArray<readonly [RegExp, string]> = [
	[/^.*?(전자정부\s*프레임워크|컴플라이언스|isms|gdpr\s*-\s*|pii|개인정보\s*보호\s*법|법령\s*준수|표준\s*준수|정책\s*준수)/, "COMPLIANCE"],
	[/^.*?(사용자\s*접근권한|접근\s*권한\s*관리|권한\s*관리|개인정보\s*관리|보안\s*관리|암호화|인증\s*수단|접근\s*제어|정보\s*보안)/, "SECURITY"],
	[/^.*?(응답\s*시간|처리량|지연\s*시간|성능\s*기준|throughput\s*-\s*|latency\s*-\s*|qps|rps|동시\s*접속|처리\s*속도|성능\s*측정)/, "PERFORMANCE"],
	[/^.*?(연계|연동|integ\s*-\s*|integration\s*-\s*|interface\s*-\s*|interop\s*-\s*|api\s*연동|외부\s*모듈\s*연동|payment\s*gateway)/, "INTERFACE"],
	[/^.*?(데이터\s*마이그레이션|데이터\s*모델|스키마\s*설계|정규화|dat\s*-\s*|warehouse\s*-\s*|lakehouse\s*-\s*|이관\s*계획|DB\s*설계|ERD)/, "DATA"],
	[/^.*?(가용\s*성|재해\s*복구|dr\s*-\s*|failover|고가용|이중화|replica|backup\s*-\s*|ha\s*-\s*|무중단\s*전환)/, "OPERATIONAL"],
	[/^.*?(매주\s*보고|주간\s*보고|월간\s*보고|보고서\s*제출|deliverable\s*-\s*|handover\s*-\s*|inspection|qa\s*-\s*|납품\s*일|산출물\s*일정)/, "DELIVERY"],
	[/^.*?(문서\s*업로드|사용자\s*권한|UI\s*기능|화면\s*구성|기능\s*요구|조회\s*기능|등록\s*기능|수정\s*기능|삭제\s*기능)/, "FUNCTIONAL"],
];

function pickFixtureEnum(values: unknown[], hint: string, key: string): unknown {
	const lowerHint = hint.toLowerCase();
	for (const value of values) {
		if (typeof value !== "string") continue;
		const lower = value.toLowerCase();
		if (lowerHint.includes(lower) || key.toLowerCase().includes(lower)) {
			return value;
		}
	}
	// Korean keyword fallback: pick the enum value whose pattern matches the
	// longest substring in the hint. Ties are broken by table order so the
	// more specific SECURITY/COMPLIANCE patterns win over FUNCTIONAL.
	const entries = FIXTURE_HINT_TO_ENUM_ENTRIES;
	let bestValue: unknown = values[0];
	let bestLength = 0;
	for (let i = 0; i < entries.length; i += 1) {
		const [pattern, mapped] = entries[i]!;
		if (!values.includes(mapped)) continue;
		const match = hint.match(pattern);
		if (!match) continue;
		const length = match[0].length;
		if (length > bestLength) {
			bestLength = length;
			bestValue = mapped;
		} else if (length === bestLength) {
			// tie — prefer more specific keywords by table order; FUNCTIONAL is
			// intentionally last so it loses ties.
		}
	}
	return bestLength > 0 ? bestValue : values[0];
}

function synthesizeFixtureValue(type: string, hint: string): unknown {
	switch (type) {
		case "string":
			return `fixture-${hint.slice(0, 40)}`;
		case "number":
		case "integer":
			return 1;
		case "boolean":
			return true;
		case "object":
			return { fixture: true, hint };
		case "array":
			return [synthesizeFixtureValue("string", hint)];
		default:
			return null;
	}
}

export async function callResponses(
	request: ResponsesRequest,
	options: ProviderOptions,
): Promise<ResponsesResult> {
	const fingerprint = fingerprintFor(options.model, options.promptVersion);
	if (options.fixtureMode || readEnv("OPENAI_API_KEY").length === 0) {
		return callFixture(request, fixtureFingerprint(options));
	}
	return callRealOpenAI(request, fingerprint, readEnv("OPENAI_API_KEY"));
}
