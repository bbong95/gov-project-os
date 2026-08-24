import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: true,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	outputDir: "temp/playwright-results",
	reporter: [
		["list"],
		["html", { outputFolder: "temp/playwright-report", open: "never" }],
	],
	use: {
		baseURL: "http://127.0.0.1:3000",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: "pnpm dev --hostname 127.0.0.1",
		url: "http://127.0.0.1:3000",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		stdout: "ignore",
		stderr: "pipe",
	},
});
