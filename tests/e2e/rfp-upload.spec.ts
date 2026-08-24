import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import {
	createLocalAuthFixture,
	createLocalRfpFixture,
	type LocalAuthFixture,
	type LocalRfpFixture,
} from "./support/local-supabase";

test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);


let editorFixture: LocalRfpFixture;
let viewerFixture: LocalAuthFixture;

async function login(page: Page, email: string, password: string): Promise<void> {
	await page.goto("/login");
	await page.getByLabel("이메일").fill(email);
	await page.getByLabel("비밀번호").fill(password);
	await page.getByRole("button", { name: "로그인" }).press("Enter");
	await expect(page).toHaveURL(/\/projects$/, { timeout: 30_000 });
}

test.beforeAll(async () => {
	editorFixture = await createLocalRfpFixture();
	viewerFixture = await createLocalAuthFixture();
});

test.afterAll(async () => {
	await viewerFixture?.dispose();
	await editorFixture?.dispose();
});

test("editor uploads and downloads exact synthetic bytes while other project and anonymous access fail", async ({
	page,
	request,
}) => {
	const filename = "m06-browser-synthetic-rfp.txt";
	const originalBytes = Buffer.from("M06 browser synthetic RFP. No customer information.\n", "utf8");
	const sha256 = createHash("sha256").update(originalBytes).digest("hex");

	await login(page, editorFixture.assignedEmail, editorFixture.assignedPassword);
	await page.getByRole("link", { name: editorFixture.assignedProjectName }).click();
	await expect(page).toHaveURL(
		new RegExp(`/projects/${editorFixture.assignedProjectId}/rfp$`),
		{ timeout: 30_000 },
	);
	await expect(page.getByRole("heading", { level: 1, name: "RFP 원본" })).toBeVisible();

	await page.getByLabel("RFP 원본 파일").setInputFiles({
		name: filename,
		mimeType: "text/plain",
		buffer: originalBytes,
	});
	await page.getByLabel("자료 분류").selectOption("INTERNAL");
	await page.getByRole("button", { name: "RFP 원본 업로드" }).focus();
	await page.keyboard.press("Enter");
	await page.waitForURL(/\/rfp\?status=uploaded$/, { timeout: 60_000 });

	await expect(page).toHaveURL(/\/rfp\?status=uploaded$/);
	await expect(page.getByRole("status")).toHaveText("RFP 원본을 안전하게 저장했습니다.");
	await expect(page.getByText(filename, { exact: true })).toBeVisible();
	await expect(page.getByText(sha256, { exact: true })).toBeVisible();

	const downloadLink = page.getByRole("link", { name: `${filename} 다운로드` });
	const downloadHref = await downloadLink.getAttribute("href");
	expect(downloadHref).not.toBeNull();
	const absoluteDownloadUrl = new URL(downloadHref!, page.url()).toString();
	const downloadPromise = page.waitForEvent("download");
	await downloadLink.focus();
	await page.keyboard.press("Enter");
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toBe(filename);
	const downloadedPath = await download.path();
	expect(downloadedPath).not.toBeNull();
	expect(await readFile(downloadedPath!)).toEqual(originalBytes);

	const anonymousResponse = await request.get(downloadHref!, { maxRedirects: 0 });
	expect([302, 303, 307, 308]).toContain(anonymousResponse.status());
	expect(anonymousResponse.headers().location).toContain("/login");

	await page.context().clearCookies();
	await login(page, editorFixture.crossEmail, editorFixture.crossPassword);
	const crossProjectResponse = await page.goto(absoluteDownloadUrl);
	expect(crossProjectResponse?.status()).toBe(404);
});

test("viewer can open the RFP page but cannot see upload controls", async ({ page }) => {
	await login(page, viewerFixture.email, viewerFixture.password);
	await page.getByRole("link", { name: viewerFixture.assignedProjectName }).click();

	await expect(page.getByRole("heading", { level: 1, name: "RFP 원본" })).toBeVisible();
	await expect(page.getByText("이 프로젝트에서는 RFP 원본을 조회만 할 수 있습니다.")).toBeVisible();
	await expect(page.getByLabel("RFP 원본 파일")).toHaveCount(0);
	await expect(page.getByRole("button", { name: "RFP 원본 업로드" })).toHaveCount(0);
});
