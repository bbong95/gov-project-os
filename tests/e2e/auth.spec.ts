import { expect, test } from "@playwright/test";
import { createLocalAuthFixture, type LocalAuthFixture } from "./support/local-supabase";

test.describe.configure({ mode: "serial" });

let fixture: LocalAuthFixture;

test.beforeAll(async () => {
	fixture = await createLocalAuthFixture();
});

test.afterAll(async () => {
	await fixture?.dispose();
});

test("user signs in, sees only the assigned project, and signs out by keyboard", async ({ page }) => {
	await page.goto("/login");
	await expect(page.locator("html")).toHaveAttribute("lang", "ko");

	await page.getByLabel("이메일").fill(fixture.email);
	await page.getByLabel("비밀번호").fill(fixture.password);
	await page.getByRole("button", { name: "로그인" }).focus();
	await page.keyboard.press("Enter");

	await expect
		.poll(async () => {
			const cookies = await page.context().cookies();
			return cookies.some((cookie) => cookie.name.startsWith("sb-"));
		}, { timeout: 30_000 })
		.toBe(true);
	await expect(page).toHaveURL(/\/projects$/, { timeout: 30_000 });
	await expect(page.getByRole("heading", { level: 1, name: "내 프로젝트" })).toBeVisible();
	await expect(page.getByText(fixture.assignedProjectName, { exact: true })).toBeVisible();
	await expect(page.getByText(fixture.crossTenantProjectName, { exact: true })).toHaveCount(0);

	await page.getByRole("button", { name: "로그아웃" }).focus();
	await page.keyboard.press("Enter");

	await expect(page).toHaveURL(/\/login$/);
	await expect(page.getByRole("heading", { level: 1, name: "로그인" })).toBeVisible();
});

test("invalid credentials are announced without disclosing account existence", async ({ page }) => {
	await page.goto("/login");

	await page.getByLabel("이메일").fill(fixture.email);
	await page.getByLabel("비밀번호").fill(`${fixture.password}-wrong`);
	await page.getByRole("button", { name: "로그인" }).click();

	await expect(
		page.getByRole("alert").filter({ hasText: "이메일과 비밀번호를 확인하세요." }),
	).toHaveText("이메일과 비밀번호를 확인하세요.");
});
