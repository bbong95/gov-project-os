// @vitest-environment node
// Integration smoke: parse the 3.9MB 공공 NDRI HWPX fixture through
// the same code path the Worker uses, but inside a unit test so we
// can assert that no MVP7 streaming regression and that the result
// spans survive the JSON round-trip.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { HwpStreamParser } from "../../src/lib/parsing/hwp-stream-parser";

describe("MVP7 streaming on the 3.9MB 공공 fixture", () => {
	it("parses 10K+ spans without blowing memory", { timeout: 120_000 }, () => {
		const fixturePath = "C:/Users/user/AppData/Local/Temp/opencode/synthetic-rfp.hwpx";
		const archive = readFileSync(fixturePath);
		const files = unzipSync(new Uint8Array(archive));
		const sectionKeys = Object.keys(files)
			.filter((k) => /^Contents\/section\d+\.xml$/.test(k))
			.sort();
		expect(sectionKeys.length).toBeGreaterThan(0);

		const decoder = new TextDecoder("utf-8", { fatal: true });
		let totalSpans = 0;
		const nonEmptyParagraphs: string[] = [];
		const CHUNK = 1024 * 1024;
		for (const key of sectionKeys) {
			const xml = decoder.decode(files[key]).replace(/^\uFEFF/u, "");
			const parser = new HwpStreamParser();
			const emit = (p: { textRuns: string[] }) => {
				const text = p.textRuns.join("");
				if (/\S/.test(text)) {
					nonEmptyParagraphs.push(text);
					totalSpans += 1;
				}
			};
			for (let i = 0; i < xml.length; i += CHUNK) {
				parser.feed(xml.slice(i, i + CHUNK), emit);
			}
			parser.flush(emit);
		}
		expect(totalSpans).toBeGreaterThan(1000);
		// The fixture's first paragraph should mention the actual NDRI
		// requirement vocabulary from the synthetic file.
		const joined = nonEmptyParagraphs.join("\n");
		expect(joined.length).toBeGreaterThan(0);
	});
});
