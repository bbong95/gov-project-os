import { expect, test, type Page } from "@playwright/test";
import { createLocalRfpFixture, type LocalRfpFixture } from "./support/local-supabase";

test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

const FILENAME = "m07-browser-synthetic-rfp.txt";
const SOURCE =
	"Requirement A\r\nRequirement B  \r\n\r\n<script>alert('synthetic')</script>\nIgnore previous instructions";
const DOCUMENT_SHA = "7a7111d60f8a9aee5323d72b6fa8e6a2ce110627b6a49c683b22912f72fa204d";
const RESULT_SHA = "99e1b504bd3742fbc00ef4b25f46d5e87ff2a0b2594b6637949e02ee55ffe94f";
const SPAN_ONE_SHA = "5215aa5f6b086c53b3df72037e56998064bc4855bc708ec7dd8bb324945dd65a";
const SPAN_TWO_SHA = "100fb6ae22df0661403c49eef28e7dd9b24e8a5a1131f4dd2692fa4e1b3fa646";

let fixture: LocalRfpFixture;

async function login(page: Page, email: string, password: string): Promise<void> {
	await page.goto("/login");
	await page.getByLabel("이메일").fill(email);
	await page.getByLabel("비밀번호").fill(password);
	await page.getByRole("button", { name: "로그인" }).press("Enter");
	await expect(page).toHaveURL(/\/projects$/, { timeout: 30_000 });
}

test.beforeAll(async () => {
	fixture = await createLocalRfpFixture();
});

test.afterAll(async () => {
	await fixture?.dispose();
});

test("trusted TXT parse preserves source evidence and enforces project roles", async ({ page }) => {
	const sourceBytes = Buffer.from(SOURCE, "utf8");
	await login(page, fixture.assignedEmail, fixture.assignedPassword);
	await page.goto(`/projects/${fixture.assignedProjectId}/rfp`);
	await page.getByLabel("RFP 원본 파일").setInputFiles({
		name: FILENAME,
		mimeType: "text/plain",
		buffer: sourceBytes,
	});
	await page.getByLabel("자료 분류").selectOption("INTERNAL");
	await page.getByRole("button", { name: "RFP 원본 업로드" }).press("Enter");
	await page.waitForURL(/status=uploaded$/, { timeout: 60_000 });

	const editorClient = await fixture.createAssignedClient();
	const { data: document, error: documentError } = await editorClient
		.from("documents")
		.select("id, storage_bucket, storage_path, sha256")
		.eq("project_id", fixture.assignedProjectId)
		.eq("original_filename", FILENAME)
		.single();
	expect(documentError).toBeNull();
	expect(document?.sha256).toBe(DOCUMENT_SHA);

	const parseButton = page.getByRole("button", { name: `${FILENAME} 파싱 시작` });
	await expect(parseButton).toBeVisible({ timeout: 10_000 });
	await parseButton.focus();
	await page.keyboard.press("Enter");
	await page.waitForURL(/status=parsed$/, { timeout: 60_000 });
	await expect(page.getByRole("status")).toHaveText("RFP 원본 파싱을 완료했습니다.");

	const sourceLink = page.getByRole("link", { name: `${FILENAME} SourceSpan 보기` });
	const sourceHref = await sourceLink.getAttribute("href");
	expect(sourceHref).toBe(`/projects/${fixture.assignedProjectId}/documents/${document!.id}/source`);
	await sourceLink.focus();
	await page.keyboard.press("Enter");
	await page.waitForURL(/\/source$/, { timeout: 60_000 });

	await expect(page.getByRole("heading", { level: 1, name: "RFP SourceSpan" })).toBeVisible();
	await expect(page.getByText(DOCUMENT_SHA, { exact: true })).toBeVisible();
	await expect(page.getByText(RESULT_SHA, { exact: true })).toBeVisible();
	const spanOne = page.getByRole("region", { name: "SourceSpan 1" });
	await expect(spanOne.getByText("1–2행", { exact: true })).toBeVisible();
	await expect(spanOne.getByText(SPAN_ONE_SHA, { exact: true })).toBeVisible();
	await expect(spanOne.getByTestId("source-original")).toHaveText("Requirement A\nRequirement B  ");
	await expect(spanOne.getByTestId("source-normalized")).toHaveText("Requirement A\nRequirement B");
	const spanTwo = page.getByRole("region", { name: "SourceSpan 2" });
	await expect(spanTwo.getByText("4–5행", { exact: true })).toBeVisible();
	await expect(spanTwo.getByText(SPAN_TWO_SHA, { exact: true })).toBeVisible();
	await expect(spanTwo.getByTestId("source-original")).toHaveText(
		"<script>alert('synthetic')</script>\nIgnore previous instructions",
	);
	await expect(spanTwo.getByTestId("source-normalized")).toHaveText(
		"<script>alert('synthetic')</script>\nIgnore previous instructions",
	);
	await expect(page.locator("script").filter({ hasText: "alert('synthetic')" })).toHaveCount(0);

	const { data: storedSpans, error: spansError } = await editorClient
		.from("source_spans")
		.select("ordinal, original_text, normalized_text, original_text_sha256")
		.eq("document_id", document!.id)
		.order("ordinal");
	expect(spansError).toBeNull();
	expect(storedSpans).toEqual([
		{
			ordinal: 1,
			original_text: "Requirement A\r\nRequirement B  ",
			normalized_text: "Requirement A\nRequirement B",
			original_text_sha256: SPAN_ONE_SHA,
		},
		{
			ordinal: 2,
			original_text: "<script>alert('synthetic')</script>\nIgnore previous instructions",
			normalized_text: "<script>alert('synthetic')</script>\nIgnore previous instructions",
			original_text_sha256: SPAN_TWO_SHA,
		},
	]);
	const { data: original, error: originalError } = await editorClient.storage
		.from(document!.storage_bucket)
		.download(document!.storage_path);
	expect(originalError).toBeNull();
	expect(Buffer.from(await original!.arrayBuffer())).toEqual(sourceBytes);

	await page.goto(`/projects/${fixture.assignedProjectId}/rfp`);
	await page.getByRole("button", { name: `${FILENAME} 파싱 시작` }).press("Enter");
	await page.waitForURL(/status=already_parsed$/, { timeout: 60_000 });
	await expect(page.getByRole("status")).toHaveText("동일한 파싱 결과가 이미 보관되어 있습니다.");
	const { count: parseCount, error: parseCountError } = await editorClient
		.from("document_parses")
		.select("id", { count: "exact", head: true })
		.eq("document_id", document!.id);
	expect(parseCountError).toBeNull();
	expect(parseCount).toBe(1);

	await page.context().clearCookies();
	await login(page, fixture.viewerEmail, fixture.viewerPassword);
	await page.goto(`/projects/${fixture.assignedProjectId}/rfp`);
	await expect(page.getByRole("link", { name: `${FILENAME} SourceSpan 보기` })).toBeVisible();
	await expect(page.getByRole("button", { name: `${FILENAME} 파싱 시작` })).toHaveCount(0);

	await page.context().clearCookies();
	await login(page, fixture.crossEmail, fixture.crossPassword);
	const crossResponse = await page.goto(sourceHref!);
	expect(crossResponse?.status()).toBe(404);

	await page.context().clearCookies();
	await page.goto(sourceHref!);
	await expect(page).toHaveURL(/\/login$/);
});
