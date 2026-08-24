import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
	createLocalRfpFixture,
	type LocalRfpFixture,
} from "../e2e/support/local-supabase";

test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

let fixture: LocalRfpFixture;

test.beforeAll(async () => {
	fixture = await createLocalRfpFixture();
});

test.afterAll(async () => {
	await fixture?.dispose();
});

test("RFP upload and populated document list have no detectable WCAG A or AA violations", async ({
	page,
}) => {
	await page.goto("/login");
	await page.getByLabel("이메일").fill(fixture.assignedEmail);
	await page.getByLabel("비밀번호").fill(fixture.assignedPassword);
	await page.getByRole("button", { name: "로그인" }).press("Enter");
	await expect(page).toHaveURL(/\/projects$/, { timeout: 30_000 });

	await page.getByRole("link", { name: fixture.assignedProjectName }).click();
	await expect(page).toHaveURL(
		new RegExp(`/projects/${fixture.assignedProjectId}/rfp$`),
		{ timeout: 30_000 },
	);

	const emptyResults = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
		.analyze();
	expect(emptyResults.violations).toEqual([]);

	await page.getByLabel("RFP 원본 파일").setInputFiles({
		name: "m06-a11y-synthetic-rfp.txt",
		mimeType: "text/plain",
		buffer: Buffer.from("M06 accessibility synthetic RFP. No customer information.\n", "utf8"),
	});
	await page.getByLabel("자료 분류").selectOption("INTERNAL");
	await page.getByRole("button", { name: "RFP 원본 업로드" }).press("Enter");
	await page.waitForURL(/\/rfp\?status=uploaded$/, { timeout: 60_000 });

	const populatedResults = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
		.analyze();
	expect(populatedResults.violations).toEqual([]);
});
