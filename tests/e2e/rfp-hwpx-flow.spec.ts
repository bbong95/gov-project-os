import { expect, test, type Page } from "@playwright/test";
import {
	createLocalRfpFixture,
	type LocalRfpFixture,
} from "./support/local-supabase";
import { syntheticHwpxBytes } from "../support/synthetic-hwpx";

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

let fixture: LocalRfpFixture;

async function login(page: Page, email: string, password: string): Promise<void> {
	await page.goto("/login");
	await page.getByLabel("이메일").fill(email);
	await page.getByLabel("비밀번호").fill(password);
	await page.getByRole("button", { name: "로그인" }).press("Enter");
	await expect(page).toHaveURL(new RegExp("/projects$"), { timeout: 30_000 });
}

test.beforeAll(async () => {
	fixture = await createLocalRfpFixture();
});

test.afterAll(async () => {
	await fixture?.dispose();
});

test("HWPX upload exposes the parse-to-extract next step", async ({ page }) => {
	await login(page, fixture.assignedEmail, fixture.assignedPassword);
	const filename = "m08-allowed-synthetic-rfp.hwpx";
	await page.goto("/projects/" + fixture.assignedProjectId + "/rfp");
	await page.getByLabel("RFP 원본 파일").setInputFiles({
		name: filename,
		mimeType: "application/hwp+zip",
		buffer: syntheticHwpxBytes(),
	});
	await page.getByLabel("자료 분류").selectOption("INTERNAL");
	await page.getByRole("button", { name: "RFP 원본 업로드" }).press("Enter");
	await page.waitForURL(/status=uploaded$/, { timeout: 60_000 });

	await expect(
		page.getByRole("button", { name: filename + " 파싱 시작" }),
	).toBeVisible();

	await page.getByRole("button", { name: filename + " 파싱 시작" }).press("Enter");
	await page.waitForURL(/status=parsed$/, { timeout: 60_000 });

	await expect(page.getByText("추출 가능", { exact: true })).toBeVisible();
	await expect(
		page.getByRole("button", { name: filename + " 요구사항 추출" }),
	).toBeVisible();

	await page
		.getByRole("button", { name: filename + " 요구사항 추출" })
		.press("Enter");
	await page.waitForURL(/status=requirements_created/, { timeout: 120_000 });
	const reviewLink = page.getByRole("link", {
		name: filename + " 요구사항 검토 계속",
	});
	await expect(reviewLink).toBeVisible();
	const reviewHref = await reviewLink.getAttribute("href");
	expect(reviewHref).toMatch(new RegExp("/requirements/[0-9a-f-]{36}$"));

	await page.goto("/projects/" + fixture.assignedProjectId + "/rfp");
	await expect(
		page.getByRole("link", { name: filename + " 요구사항 검토 계속" }),
	).toHaveAttribute("href", reviewHref!);
});
