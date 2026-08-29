import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	createLocalRfpFixture,
	type LocalRfpFixture,
} from "../e2e/support/local-supabase";

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const STUB_URL = "http://127.0.0.1:4319";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SOURCE = [
	"SER-001 사업자는 사용자 접근권한을 최소권한 원칙에 따라 관리하여야 한다.",
	"",
	"PMR-001 사업자는 주간 업무보고를 수행하여야 한다.",
	"",
	"PSR-001 사업자는 교육 및 기술지원을 제공하여야 한다.",
].join(String.fromCharCode(10));
const WRITE_CONTROL_PATTERN = /편집|승인|반려|Baseline|베이스라인/;

let fixture: LocalRfpFixture;
let editorClient: SupabaseClient;
let allowedRunHref = "";
let allowedDocumentId = "";

async function expectNoViolations(page: Page): Promise<void> {
	const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
	expect(results.violations).toEqual([]);
}

async function login(page: Page, email: string, password: string): Promise<void> {
	await page.goto("/login");
	await page.getByLabel("이메일").fill(email);
	await page.getByLabel("비밀번호").fill(password);
	await page.getByRole("button", { name: "로그인" }).press("Enter");
	await expect(page).toHaveURL(new RegExp("/projects$"), { timeout: 30_000 });
}

async function resetStub(): Promise<void> {
	expect((await fetch(STUB_URL + "/__reset", { method: "POST" })).ok).toBe(true);
}

async function stubState(): Promise<{ callCount: number }> {
	const response = await fetch(STUB_URL + "/__state");
	expect(response.ok).toBe(true);
	return response.json();
}

async function uploadAndParse(
	page: Page,
	filename: string,
	classification: "INTERNAL" | "PERSONAL",
): Promise<{ parseId: string }> {
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
	return { parseId: parse!.id };
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

test("editor reaches the AI draft read-only with semantic status and no violations", async ({
	page,
}) => {
	await login(page, fixture.assignedEmail, fixture.assignedPassword);
	const filename = "m08-a11y-synthetic-rfp.txt";
	await uploadAndParse(page, filename, "INTERNAL");
	await expect(page.getByText("추출 가능", { exact: true })).toBeVisible();

	const extractButton = page.getByRole("button", {
		name: filename + " 요구사항 추출",
	});
	const targetBox = await extractButton.boundingBox();
	expect(targetBox).not.toBeNull();
	expect(targetBox!.height).toBeGreaterThanOrEqual(24);
	expect(targetBox!.width).toBeGreaterThanOrEqual(24);
	await extractButton.focus();
	await page.keyboard.press("Enter");
	await page.waitForURL(/status=requirements_created/, { timeout: 60_000 });
	await expect(page.getByRole("status")).toHaveText("AI 초안 생성 완료");
	await expectNoViolations(page);

	const resultLink = page.getByRole("link", {
		name: filename + " 요구사항 검토 계속",
	});
	const href = await resultLink.getAttribute("href");
	expect(href).toMatch(new RegExp("/requirements/[0-9a-f-]{36}$"));
	allowedRunHref = href!;

	await page.goto(allowedRunHref);

	const levelOneHeadings = page.getByRole("heading", { level: 1 });
	await expect(levelOneHeadings).toHaveCount(1);
	await expect(levelOneHeadings).toHaveAccessibleName("요구사항 AI 초안");

	const firstCandidate = page.getByRole("article", {
		name: "요구사항 후보 1 SER-001",
	});
	await expect(firstCandidate).toBeVisible();
	await expect(firstCandidate.getByRole("term")).toHaveCount(4);

	const evidenceLink = firstCandidate.getByRole("link", {
		name: "SER-001 후보 SourceSpan 1 증거 보기",
	});
	const evidenceHref = await evidenceLink.getAttribute("href");
	expect(evidenceHref).toMatch(
		/\/documents\/[0-9a-f-]{36}\/source#span-[0-9a-f-]{36}$/,
	);
	allowedDocumentId = evidenceHref!.split("/documents/")[1]!.split("/")[0];

	await expect(
		firstCandidate.getByRole("button", { name: "후보 1 승인" }),
	).toBeVisible();
	await expectNoViolations(page);

	const state = await stubState();
	expect(state).toMatchObject({ callCount: 1 });
});

test("editor can focus the requirement-candidates skip link and reach the source evidence", async ({
	page,
}) => {
	expect(allowedRunHref).not.toBe("");
	await login(page, fixture.assignedEmail, fixture.assignedPassword);
	await page.goto(allowedRunHref);

	const skipLink = page.getByRole("link", {
		name: "요구사항 후보 목록으로 건너뛰기",
	});
	await skipLink.focus();
	await expect(skipLink).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(
		page.getByRole("region", { name: "요구사항 후보" }),
	).toBeInViewport();

	const firstEvidence = page
		.getByRole("article", { name: "요구사항 후보 1 SER-001" })
		.getByRole("link", { name: "SER-001 후보 SourceSpan 1 증거 보기" });
	const evidenceHref = await firstEvidence.getAttribute("href");
	const spanId = evidenceHref!.split("#span-")[1];

	await page.goto(
		"/projects/" + fixture.assignedProjectId + "/documents/" + allowedDocumentId + "/source",
	);
	await expect(page.locator("#span-" + spanId)).toBeVisible();
	const sourceSkipLink = page.getByRole("link", {
		name: "SourceSpan 목록으로 건너뛰기",
	});
	await sourceSkipLink.focus();
	await expect(sourceSkipLink).toBeFocused();
	await page.keyboard.press("Enter");
	await expectNoViolations(page);
});

test("viewer reads the draft without any write, extraction, or approval control", async ({
	page,
}) => {
	expect(allowedRunHref).not.toBe("");
	await login(page, fixture.viewerEmail, fixture.viewerPassword);
	await page.goto(allowedRunHref);
	await expect(
		page.getByRole("heading", { level: 1, name: "요구사항 AI 초안" }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: /요구사항 추출|편집|승인|반려|Baseline|베이스라인/ }),
	).toHaveCount(0);
	await expect(
		page.getByRole("link", { name: WRITE_CONTROL_PATTERN }),
	).toHaveCount(0);
	await expectNoViolations(page);
});

test("privacy-blocked documents announce blocking as an alert with zero provider calls", async ({
	page,
}) => {
	await resetStub();
	await login(page, fixture.assignedEmail, fixture.assignedPassword);
	const filename = "m08-a11y-blocked-synthetic-rfp.txt";
	const prepared = await uploadAndParse(page, filename, "PERSONAL");
	const documentItem = page
		.getByRole("listitem")
		.filter({ hasText: filename });
	await expect(
		documentItem.getByText("개인정보 검토 필요 — AI에 전송하지 않음", {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: filename + " 요구사항 추출" }),
	).toHaveCount(0);

	const response = await page.request.post(
		"/projects/" + fixture.assignedProjectId + "/requirements/extract",
		{ form: { documentParseId: prepared.parseId }, maxRedirects: 0 },
	);
	expect(response.status()).toBe(303);
	await page.goto(response.headers().location!);
	await expect(page.getByRole("alert")).toHaveText(
		"개인정보 검토 필요 — AI에 전송하지 않음",
	);
	await expect(page.getByRole("status")).toHaveCount(0);
	await expectNoViolations(page);
	expect(await stubState()).toMatchObject({ callCount: 0 });
});
