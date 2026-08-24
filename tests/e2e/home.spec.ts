import { expect, test } from "@playwright/test";

test("home identifies GOV Project OS", async ({ page }) => {
	await page.goto("/");

	await expect(page.getByRole("heading", { level: 1, name: "GOV Project OS" })).toBeVisible();
});
