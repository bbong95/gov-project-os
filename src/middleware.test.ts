import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Cloudflare Auth middleware contract", () => {
	it("uses the Edge middleware convention supported by OpenNext Cloudflare", () => {
		const middlewarePath = resolve(process.cwd(), "src/middleware.ts");
		const nodeProxyPath = resolve(process.cwd(), "src/proxy.ts");

		expect(existsSync(middlewarePath)).toBe(true);
		expect(existsSync(nodeProxyPath)).toBe(false);
		expect(readFileSync(middlewarePath, "utf8")).toContain(
			"export async function middleware",
		);
	});
});
