import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
	createLocalRfpFixture,
	type LocalRfpFixture,
} from "../e2e/support/local-supabase";

test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const FILENAME = "m07-a11y-synthetic-rfp.txt";

let fixture: LocalRfpFixture;

async function expectNoViolations(page: Page): Promise<void> {
	const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
	expect(results.violations).toEqual([]);
}

test.beforeAll(async () => {
	fixture = await createLocalRfpFixture();
});

test.afterAll(async () => {
	await fixture?.dispose();
});

test("parseable, parsed, and populated SourceSpan states have no detectable WCAG A or AA violations", async ({
	page,
}) => {
	await page.goto("/login");
	await page.getByLabel("이메일").fill(fixture.assignedEmail);
	await page.getByLabel("비밀번호").fill(fixture.assignedPassword);
	await page.getByRole("button", { name: "로그인" }).press("Enter");
	await expect(page).toHaveURL(/\/projects$/, { timeout: 30_000 });

	await page.goto(`/projects/${fixture.assignedProjectId}/rfp`);
	await page.getByLabel("RFP 원본 파일").setInputFiles({
		name: FILENAME,
		mimeType: "text/plain",
		buffer: Buffer.from(
			"Accessibility requirement A\r\nAccessibility requirement B  \r\n\r\nSynthetic evidence only",
			"utf8",
		),
	});
	await page.getByLabel("자료 분류").selectOption("INTERNAL");
	await page.getByRole("button", { name: "RFP 원본 업로드" }).press("Enter");
	await page.waitForURL(/status=uploaded$/, { timeout: 60_000 });
	await expect(page.getByText("파싱 상태: 파싱 가능", { exact: true })).toBeVisible();
	await expectNoViolations(page);

	const parseButton = page.getByRole("button", { name: `${FILENAME} 파싱 시작` });
	await parseButton.focus();
	await page.keyboard.press("Enter");
	await page.waitForURL(/status=parsed$/, { timeout: 60_000 });
	await expect(page.getByText("파싱 상태: 파싱 완료", { exact: true })).toBeVisible();
	await expectNoViolations(page);

	const sourceLink = page.getByRole("link", { name: `${FILENAME} SourceSpan 보기` });
	await sourceLink.focus();
	await page.keyboard.press("Enter");
	await page.waitForURL(/\/source$/, { timeout: 60_000 });
	await expect(page.getByRole("heading", { level: 2, name: "SourceSpan 1" })).toBeVisible();
	await expect(page.getByRole("heading", { level: 2, name: "SourceSpan 2" })).toBeVisible();
	await expectNoViolations(page);
});
