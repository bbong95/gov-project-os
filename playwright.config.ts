import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const localRequire = createRequire(resolve(process.cwd(), "package.json"));

function backendSecret(): string {
	if (process.env.SUPABASE_BACKEND_SECRET) {
		return process.env.SUPABASE_BACKEND_SECRET;
	}
	const cliEntry = localRequire.resolve("supabase/dist/supabase.js");
	const result = spawnSync(process.execPath, [cliEntry, "status", "--output", "json"], {
		cwd: process.cwd(),
		encoding: "utf8",
	});
	const jsonStart = result.stdout.indexOf("{");
	if (result.status !== 0 || jsonStart < 0) {
		throw new Error("Local Supabase must be running for browser tests.");
	}
	const status = JSON.parse(result.stdout.slice(jsonStart)) as { SERVICE_ROLE_KEY?: string };
	if (!status.SERVICE_ROLE_KEY) {
		throw new Error("Local Supabase did not return a backend-only credential.");
	}
	return status.SERVICE_ROLE_KEY;
}

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
	webServer: [
		{
			command: "node tests/e2e/support/openai-responses-stub.mjs",
			url: "http://127.0.0.1:4319/health",
			reuseExistingServer: false,
			timeout: 30_000,
			stdout: "ignore",
			stderr: "pipe",
		},
		{
			command: "pnpm dev --hostname 127.0.0.1",
			url: "http://127.0.0.1:3000",
			reuseExistingServer: false,
			timeout: 120_000,
			stdout: "ignore",
			env: {
				SUPABASE_BACKEND_SECRET: backendSecret(),
				OPENAI_API_KEY: "synthetic-openai-key",
				OPENAI_REQUIREMENT_MODEL: "synthetic-requirement-model",
				GOV_PROJECT_OS_OPENAI_RESPONSES_URL:
					"http://127.0.0.1:4319/v1/responses",
				GOV_PROJECT_OS_ALLOW_TEST_OPENAI_URL: "1",
			},
			stderr: "pipe",
		},
	],
});
