import { createHash } from "node:crypto";
import { createServer } from "node:http";

const HOST = "127.0.0.1";
const PORT = 4319;
const MODES = new Set(["success", "refusal", "incomplete", "invalid"]);
const MAX_REQUEST_BYTES = 2 * 1024 * 1024;

let mode = "success";
let state = {
	callCount: 0,
	lastRequest: null,
};

function sha256(value) {
	return createHash("sha256").update(value).digest("hex");
}

function sendJson(response, status, value) {
	const body = JSON.stringify(value);
	response.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"content-length": Buffer.byteLength(body),
	});
	response.end(body);
}

async function readBody(request) {
	const chunks = [];
	let total = 0;
	for await (const chunk of request) {
		total += chunk.length;
		if (total > MAX_REQUEST_BYTES) {
			throw new Error("REQUEST_TOO_LARGE");
		}
		chunks.push(chunk);
	}
	return Buffer.concat(chunks).toString("utf8");
}

function requestMetadata(body, rawBody) {
	const inputText = body?.input?.[0]?.content?.[0]?.text;
	return {
		bodySha256: sha256(rawBody),
		inputSha256: typeof inputText === "string" ? sha256(inputText) : null,
		model: typeof body?.model === "string" ? body.model : null,
		store: body?.store,
		strict: body?.text?.format?.strict,
		toolsPresent: Object.hasOwn(body ?? {}, "tools"),
	};
}

function validateRequest(body) {
	if (
		body?.store !== false ||
		body?.text?.format?.type !== "json_schema" ||
		body?.text?.format?.strict !== true ||
		body?.text?.format?.schema?.additionalProperties !== false ||
		body?.text?.format?.schema?.properties?.candidates?.minItems !== 1 ||
		body?.text?.format?.schema?.properties?.candidates?.maxItems !== 500 ||
		Object.hasOwn(body ?? {}, "tools") ||
		typeof body?.input?.[0]?.content?.[0]?.text !== "string"
	) {
		throw new Error("INVALID_REQUEST_CONTRACT");
	}
}

function providerEnvelope() {
	const base = {
		id: "resp_m08_synthetic",
		object: "response",
		created_at: 1_777_777_777,
		error: null,
		model: "synthetic-requirement-model",
		usage: {
			input_tokens: 111,
			output_tokens: 77,
			total_tokens: 188,
		},
	};

	if (mode === "incomplete") {
		return {
			...base,
			status: "incomplete",
			incomplete_details: { reason: "max_output_tokens" },
			output: [],
		};
	}
	if (mode === "refusal") {
		return {
			...base,
			status: "completed",
			incomplete_details: null,
			output: [
				{
					type: "message",
					role: "assistant",
					status: "completed",
					content: [
						{
							type: "refusal",
							refusal: "synthetic refusal detail must not escape",
						},
					],
				},
			],
		};
	}

	const value =
		mode === "invalid"
			? { candidates: [{ forgedSourceText: "synthetic invalid detail" }] }
			: {
					candidates: [
						{
							officialId: "SER-001",
							interpretation: "사용자 접근권한을 최소권한 원칙으로 관리해야 한다.",
							type: "SECURITY",
							atomicity: "ATOMIC",
							sourceSpanOrdinals: [1],
						},
						{
							officialId: "PMR-001",
							interpretation: "주간 업무보고를 수행해야 한다.",
							type: "PROJECT_MANAGEMENT",
							atomicity: "ATOMIC",
							sourceSpanOrdinals: [2],
						},
						{
							officialId: null,
							interpretation: "교육과 기술지원을 제공해야 한다.",
							type: "PROJECT_SUPPORT",
							atomicity: "ATOMIC",
							sourceSpanOrdinals: [3],
						},
					],
				};
	return {
		...base,
		status: "completed",
		incomplete_details: null,
		output: [
			{
				type: "message",
				role: "assistant",
				status: "completed",
				content: [
					{
						type: "output_text",
						text: JSON.stringify(value),
						annotations: [],
					},
				],
			},
		],
	};
}

const server = createServer(async (request, response) => {
	const url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);
	try {
		if (request.method === "GET" && url.pathname === "/health") {
			return sendJson(response, 200, { ok: true });
		}
		if (request.method === "POST" && url.pathname === "/__reset") {
			mode = "success";
			state = { callCount: 0, lastRequest: null };
			return sendJson(response, 200, { ok: true });
		}
		if (request.method === "GET" && url.pathname === "/__state") {
			return sendJson(response, 200, { mode, ...state });
		}
		if (request.method === "POST" && url.pathname === "/__mode") {
			const body = JSON.parse(await readBody(request));
			if (!MODES.has(body?.mode)) {
				return sendJson(response, 400, { error: "INVALID_MODE" });
			}
			mode = body.mode;
			return sendJson(response, 200, { ok: true, mode });
		}
		if (request.method === "POST" && url.pathname === "/v1/responses") {
			const rawBody = await readBody(request);
			const body = JSON.parse(rawBody);
			state = {
				callCount: state.callCount + 1,
				lastRequest: requestMetadata(body, rawBody),
			};
			validateRequest(body);
			return sendJson(response, 200, providerEnvelope());
		}
		return sendJson(response, 404, { error: "NOT_FOUND" });
	} catch (error) {
		return sendJson(response, 400, {
			error:
				error instanceof Error && error.message === "REQUEST_TOO_LARGE"
					? "REQUEST_TOO_LARGE"
					: "INVALID_TEST_REQUEST",
		});
	}
});

server.listen(PORT, HOST);

function close() {
	server.close(() => process.exit(0));
}

process.on("SIGINT", close);
process.on("SIGTERM", close);
