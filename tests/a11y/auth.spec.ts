import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
	createLocalAuthFixture,
	type LocalAuthFixture,
} from "../e2e/support/local-supabase";

test.describe.configure({ mode: "serial" });

let fixture: LocalAuthFixture;

test.beforeAll(async () => {
	fixture = await createLocalAuthFixture();
});

test.afterAll(async () => {
	await fixture?.dispose();
});

test("login and signed-in project list have no detectable WCAG A or AA violations", async ({
	page,
}) => {
	await page.goto("/login");

	const loginResults = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
		.analyze();

	expect(loginResults.violations).toEqual([]);

	await page.getByLabel("이메일").fill(fixture.email);
	await page.getByLabel("비밀번호").fill(fixture.password);
	await page.getByRole("button", { name: "로그인" }).press("Enter");
	await expect(page).toHaveURL(/\/projects$/, { timeout: 30_000 });

	const projectResults = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
		.analyze();

	expect(projectResults.violations).toEqual([]);
});
