import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	createLocalRfpFixture,
	type LocalRfpFixture,
} from "./support/local-supabase";

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const STUB_URL = "http://127.0.0.1:4319";
const SOURCE = [
	"SER-001 사업자는 사용자 접근권한을 최소권한 원칙에 따라 관리하여야 한다.",
	"",
	"PMR-001 사업자는 주간 업무보고를 수행하여야 한다.",
	"",
	"PSR-001 사업자는 교육 및 기술지원을 제공하여야 한다.",
].join(String.fromCharCode(10));

let fixture: LocalRfpFixture;
let editorClient: SupabaseClient;
let allowedParseId = "";
let allowedRunHref = "";

async function login(page: Page, email: string, password: string): Promise<void> {
	await page.goto("/login");
	await page.getByLabel("이메일").fill(email);
	await page.getByLabel("비밀번호").fill(password);
	await page.getByRole("button", { name: "로그인" }).press("Enter");
	await expect(page).toHaveURL(new RegExp("/projects$"), { timeout: 30_000 });
}

async function stubRequest(path: string, body?: unknown): Promise<Response> {
	return fetch(STUB_URL + path, {
		method: "POST",
		headers: body === undefined ? undefined : { "content-type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
}

async function resetStub(): Promise<void> {
	expect((await stubRequest("/__reset")).ok).toBe(true);
}

async function stubState(): Promise<{
	callCount: number;
	lastRequest: Record<string, unknown> | null;
}> {
	const response = await fetch(STUB_URL + "/__state");
	expect(response.ok).toBe(true);
	return response.json();
}

async function uploadAndParse(
	page: Page,
	filename: string,
	classification:
		| "PUBLIC"
		| "INTERNAL"
		| "PERSONAL"
		| "SENSITIVE"
		| "RESTRICTED",
): Promise<{ documentId: string; parseId: string }> {
	await page.goto("/projects/" + fixture.assignedProjectId + "/rfp");
	await page.getByLabel("RFP 원본 파일").setInputFiles({
		name: filename,
		mimeType: "text/plain",
		buffer: Buffer.from(SOURCE, "utf8"),
	});
	await page.getByLabel("자료 분류").selectOption(classification);
	await page.getByRole("button", { name: "RFP 원본 업로드" }).press("Enter");
	await page.waitForURL(/status=uploaded$/, { timeout: 60_000 });

	const { data: document, error: documentError } = await editorClient
		.from("documents")
		.select("id")
		.eq("project_id", fixture.assignedProjectId)
		.eq("original_filename", filename)
		.single();
	expect(documentError).toBeNull();
	expect(document).not.toBeNull();

	await page
		.getByRole("button", { name: filename + " 파싱 시작" })
		.press("Enter");
	await page.waitForURL(/status=parsed$/, { timeout: 60_000 });
	const { data: parse, error: parseError } = await editorClient
		.from("document_parses")
		.select("id")
		.eq("document_id", document!.id)
		.single();
	expect(parseError).toBeNull();
	expect(parse).not.toBeNull();
	return { documentId: document!.id, parseId: parse!.id };
}

async function expectNoSnapshot(parseId: string): Promise<void> {
	const { count, error } = await editorClient
		.from("requirement_extraction_runs")
		.select("id", { count: "exact", head: true })
		.eq("document_parse_id", parseId);
	expect(error).toBeNull();
	expect(count).toBe(0);
}

test.beforeAll(async () => {
	test.setTimeout(120_000);
	fixture = await createLocalRfpFixture();
	editorClient = await fixture.createAssignedClient();
});

test.afterAll(async () => {
	test.setTimeout(120_000);
	await fixture?.dispose();
});

test.beforeEach(async () => {
	await resetStub();
});

test("editor creates one AI draft and reuses it with an authoritative parse-only form", async ({
	page,
}) => {
	await login(page, fixture.assignedEmail, fixture.assignedPassword);
	const filename = "m08-allowed-synthetic-rfp.txt";
	const prepared = await uploadAndParse(page, filename, "INTERNAL");
	allowedParseId = prepared.parseId;

	await expect(page.getByText("추출 가능", { exact: true })).toBeVisible();
	const button = page.getByRole("button", {
		name: filename + " 요구사항 추출",
	});
	const form = button.locator("xpath=ancestor::form");
	await expect(form).toHaveAttribute(
		"action",
		"/projects/" + fixture.assignedProjectId + "/requirements/extract",
	);
	expect(
		await form.locator("input, select, textarea").evaluateAll((elements) =>
			elements.map((element) => ({
				name: element.getAttribute("name"),
				value: element.getAttribute("value"),
			})),
		),
	).toEqual([{ name: "documentParseId", value: prepared.parseId }]);

	await button.press("Enter");
	await page.waitForURL(/status=requirements_created/, { timeout: 60_000 });
	await expect(page.getByRole("status")).toHaveText("AI 초안 생성 완료");
	const resultLink = page.getByRole("link", {
		name: filename + " 요구사항 검토 계속",
	});
	const href = await resultLink.getAttribute("href");
	expect(href).toMatch(new RegExp("/requirements/[0-9a-f-]{36}$"));
	const runId = href!.split("/").at(-1)!;
	allowedRunHref = href!;

	const { count: candidateCount } = await editorClient
		.from("requirement_candidates")
		.select("id", { count: "exact", head: true })
		.eq("run_id", runId);
	expect(candidateCount).toBe(3);
	const { data: firstCandidateRow, error: firstCandidateError } =
		await editorClient
			.from("requirement_candidates")
			.select("id")
			.eq("run_id", runId)
			.eq("candidate_order", 1)
			.single();
	expect(firstCandidateError).toBeNull();
	const { data: evidenceRows, error: evidenceError } = await editorClient
		.from("requirement_candidate_source_spans")
		.select("source_span_id, source_order")
		.eq("candidate_id", firstCandidateRow!.id)
		.order("source_order", { ascending: true });
	expect(evidenceError).toBeNull();
	expect(evidenceRows).toHaveLength(1);

	await resultLink.press("Enter");
	await page.waitForURL(new RegExp("/requirements/" + runId + "$"));
	await expect(
		page.getByRole("heading", { level: 1, name: "요구사항 AI 초안" }),
	).toBeVisible();
	await expect(page.getByText("AI 초안", { exact: true }).first()).toBeVisible();

	const firstCandidate = page.getByRole("article", {
		name: "요구사항 후보 1 SER-001",
	});
	await expect(firstCandidate.getByText("SER-001", { exact: true })).toBeVisible();
	await expect(
		firstCandidate
			.getByText(
				"사용자 접근권한을 최소권한 원칙으로 관리해야 한다.",
				{ exact: true },
			)
			.first(),
	).toBeVisible();
	await expect(firstCandidate.getByText("보안", { exact: true })).toBeVisible();
	await expect(firstCandidate.getByText("원자", { exact: true })).toBeVisible();
	await expect(
		firstCandidate.getByTestId("candidate-source-text"),
	).toHaveText(
		"SER-001 사업자는 사용자 접근권한을 최소권한 원칙에 따라 관리하여야 한다.",
	);
	const firstEvidence = firstCandidate.getByRole("link", {
		name: "SER-001 후보 SourceSpan 1 증거 보기",
	});
	await expect(firstEvidence).toHaveAttribute(
		"href",
		"/projects/" +
			fixture.assignedProjectId +
			"/documents/" +
			prepared.documentId +
			"/source#span-" +
			evidenceRows![0].source_span_id,
	);

	const thirdCandidate = page.getByRole("article", {
		name: "요구사항 후보 3 식별자 없음",
	});
	await expect(
		thirdCandidate.getByText("식별자 없음", { exact: true }),
	).toBeVisible();

	await firstEvidence.press("Enter");
	await page.waitForURL(/source#span-/);
	await expect(
		page.locator("#span-" + evidenceRows![0].source_span_id),
	).toBeVisible();

	const firstState = await stubState();
	expect(firstState).toMatchObject({
		callCount: 1,
		lastRequest: {
			bodySha256: expect.stringMatching(/^[0-9a-f]{64}$/),
			inputSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
			model: "synthetic-requirement-model",
			store: false,
			strict: true,
			toolsPresent: false,
		},
	});
	expect(JSON.stringify(firstState)).not.toContain(SOURCE);

	await page.goto("/projects/" + fixture.assignedProjectId + "/rfp");
	await page
		.getByRole("button", { name: filename + " 요구사항 추출" })
		.press("Enter");
	await page.waitForURL(/status=requirements_reused/, { timeout: 60_000 });
	await expect(page.getByRole("status")).toHaveText(
		"동일 설정의 기존 결과 재사용",
	);
	expect(await stubState()).toMatchObject({ callCount: 1 });
	const { count: runCount } = await editorClient
		.from("requirement_extraction_runs")
		.select("id", { count: "exact", head: true })
		.eq("document_parse_id", prepared.parseId);
	expect(runCount).toBe(1);
});

test("viewer, cross-project, forged, and anonymous requests cannot extract", async ({
	page,
}) => {
	expect(allowedParseId).not.toBe("");
	await login(page, fixture.viewerEmail, fixture.viewerPassword);
	await page.goto("/projects/" + fixture.assignedProjectId + "/rfp");
	await expect(page.getByRole("button", { name: /요구사항 추출/ })).toHaveCount(0);
	expect(allowedRunHref).not.toBe("");
	const viewerResult = await page.goto(allowedRunHref);
	expect(viewerResult?.status()).toBe(200);
	await expect(
		page.getByRole("heading", { level: 1, name: "요구사항 AI 초안" }),
	).toBeVisible();

	await page.context().clearCookies();
	await login(page, fixture.crossEmail, fixture.crossPassword);
	const crossResult = await page.goto(allowedRunHref);
	expect(crossResult?.status()).toBe(404);
	const mismatchedScope = await page.goto(
		"/projects/" +
			fixture.crossTenantProjectId +
			"/requirements/" +
			allowedRunHref.split("/").at(-1),
	);
	expect(mismatchedScope?.status()).toBe(404);
	for (const [projectId, parseId] of [
		[fixture.assignedProjectId, allowedParseId],
		[fixture.crossTenantProjectId, "ffffffff-ffff-4fff-8fff-ffffffffffff"],
	]) {
		const response = await page.request.post(
			"/projects/" + projectId + "/requirements/extract",
			{ form: { documentParseId: parseId }, maxRedirects: 0 },
		);
		expect(response.status()).toBe(404);
	}

	await page.context().clearCookies();
	await page.goto(allowedRunHref);
	await expect(page).toHaveURL(new RegExp("/login$"));
	const anonymous = await page.request.post(
		"/projects/" + fixture.assignedProjectId + "/requirements/extract",
		{ form: { documentParseId: allowedParseId }, maxRedirects: 0 },
	);
	expect([302, 303, 307, 308]).toContain(anonymous.status());
	expect(anonymous.headers().location).toContain("/login");
	expect(await stubState()).toMatchObject({ callCount: 0 });
});

test("non-ALLOW documents show a blocking state and make zero provider calls", async ({
	page,
}) => {
	await login(page, fixture.assignedEmail, fixture.assignedPassword);
	for (const [classification, filename, label] of [
		[
			"PERSONAL",
			"m08-personal-synthetic-rfp.txt",
			"개인정보 검토 필요 — AI에 전송하지 않음",
		],
		["SENSITIVE", "m08-sensitive-synthetic-rfp.txt", "정책상 AI 전송 차단"],
		["RESTRICTED", "m08-restricted-synthetic-rfp.txt", "정책상 AI 전송 차단"],
	] as const) {
		const prepared = await uploadAndParse(page, filename, classification);
		const documentItem = page
			.getByRole("listitem")
			.filter({ hasText: filename });
		await expect(documentItem.getByText(label, { exact: true })).toBeVisible();
		await expect(
			page.getByRole("button", { name: filename + " 요구사항 추출" }),
		).toHaveCount(0);
		const response = await page.request.post(
			"/projects/" + fixture.assignedProjectId + "/requirements/extract",
			{ form: { documentParseId: prepared.parseId }, maxRedirects: 0 },
		);
		expect(response.status()).toBe(303);
		await expectNoSnapshot(prepared.parseId);
	}
	expect(await stubState()).toMatchObject({ callCount: 0 });
});

test("refusal, incomplete, and invalid output store no snapshot or raw detail", async ({
	page,
}) => {
	await login(page, fixture.assignedEmail, fixture.assignedPassword);
	for (const mode of ["refusal", "incomplete", "invalid"] as const) {
		expect((await stubRequest("/__mode", { mode })).ok).toBe(true);
		const filename = "m08-" + mode + "-synthetic-rfp.txt";
		const prepared = await uploadAndParse(page, filename, "INTERNAL");
		await page
			.getByRole("button", { name: filename + " 요구사항 추출" })
			.press("Enter");
		await page.waitForURL(/error=requirements_failed/, { timeout: 60_000 });
		await expect(
			page
				.getByRole("alert")
				.filter({ hasText: "AI 서비스 일시 실패 — 저장된 후보 없음" }),
		).toHaveText("AI 서비스 일시 실패 — 저장된 후보 없음");
		await expectNoSnapshot(prepared.parseId);
		expect(await page.content()).not.toContain("synthetic refusal detail");
		expect(await page.content()).not.toContain("synthetic invalid detail");
	}
	expect(await stubState()).toMatchObject({ callCount: 3 });
});
