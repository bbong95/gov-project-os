import { describe, expect, it } from "vitest";
import { createParserRegistry } from "./parser-registry";

describe("ParserRegistry", () => {
	it("treats HWPX filenames as a parseable Workers format", () => {
		const registry = createParserRegistry();

		expect(() => registry.resolve("m07.synthetic.hwpx")).not.toThrow();
		expect(registry.resolve("m07.synthetic.hwpx")).toMatchObject({
			canonicalMimeType: "application/hwp+zip",
		});
	});
});
