// @vitest-environment node
import { describe, expect, it } from "vitest";
import { HwpStreamParser } from "./hwp-stream-parser";

function collect(input: string): { textRuns: string[] }[] {
	const out: { textRuns: string[] }[] = [];
	const parser = new HwpStreamParser();
	// Feed in 1024-byte chunks to exercise the stream boundary.
	for (let i = 0; i < input.length; i += 1024) {
		parser.feed(input.slice(i, i + 1024), (p) => out.push(p));
	}
	parser.flush((p) => out.push(p));
	return out;
}

describe("HWP stream parser", () => {
	it("emits a single paragraph with one text run for a simple <p>", () => {
		const paragraphs = collect("<p><t>hello</t></p>");
		expect(paragraphs).toEqual([{ textRuns: ["hello"] }]);
	});

	it("emits a paragraph with multiple <t> runs in order", () => {
		const paragraphs = collect(
			"<p><t>foo</t><t>bar</t><t>baz</t></p>",
		);
		expect(paragraphs).toEqual([{ textRuns: ["foo", "bar", "baz"] }]);
	});

	it("emits multiple paragraphs in order", () => {
		const paragraphs = collect(
			"<p><t>one</t></p><p><t>two</t></p><p><t>three</t></p>",
		);
		expect(paragraphs).toEqual([
			{ textRuns: ["one"] },
			{ textRuns: ["two"] },
			{ textRuns: ["three"] },
		]);
	});

	it("decodes the standard XML entities", () => {
		const paragraphs = collect("<p><t>foo &amp; bar &lt;baz&gt; &quot;qux&quot;</t></p>");
		expect(paragraphs[0]?.textRuns[0]).toBe('foo & bar <baz> "qux"');
	});

	it("converts <lineBreak/> into a newline text run", () => {
		const paragraphs = collect("<p><t>a</t><lineBreak/><t>b</t></p>");
		expect(paragraphs[0]?.textRuns).toEqual(["a", "\n", "b"]);
	});

	it("converts <tab/> into a tab text run", () => {
		const paragraphs = collect("<p><t>a</t><tab/><t>b</t></p>");
		expect(paragraphs[0]?.textRuns).toEqual(["a", "\t", "b"]);
	});

	it("drops <sdt> and other unknown self-closing tags", () => {
		const paragraphs = collect("<p><t>a</t><sdt><t:b/></sdt><t>b</t></p>");
		expect(paragraphs[0]?.textRuns).toEqual(["a", "b"]);
	});

	it("supports the hwp namespace prefix (hp:p, hp:t)", () => {
		const paragraphs = collect(
			"<hp:p xmlns:hp=\"http://www.hancom.co.kr/hwpml/2011/paragraph\"><hp:t>ns</hp:t></hp:p>",
		);
		expect(paragraphs[0]?.textRuns).toEqual(["ns"]);
	});

	it("handles a stream split inside a text run", () => {
		// '<p><t>hel' arrives in the first chunk, 'lo</t></p>' in the next.
		const out: { textRuns: string[] }[] = [];
		const parser = new HwpStreamParser();
		parser.feed("<p><t>hel", (p) => out.push(p));
		parser.feed("lo</t></p>", (p) => out.push(p));
		parser.flush((p) => out.push(p));
		expect(out).toEqual([{ textRuns: ["hello"] }]);
	});

	it("handles a stream split between two paragraphs", () => {
		const out: { textRuns: string[] }[] = [];
		const parser = new HwpStreamParser();
		parser.feed("<p><t>o", (p) => out.push(p));
		parser.feed("ne</t></p><p><t>two</t></p>", (p) => out.push(p));
		parser.flush((p) => out.push(p));
		expect(out).toEqual([{ textRuns: ["one"] }, { textRuns: ["two"] }]);
	});

	it("does not emit when there are no paragraphs", () => {
		const paragraphs = collect("<hp:t>stray</hp:t>");
		expect(paragraphs).toEqual([]);
	});

	it("does not blow up on unterminated <p> at end of stream", () => {
		const out: { textRuns: string[] }[] = [];
		const parser = new HwpStreamParser();
		parser.feed("<p><t>cut off", (p) => out.push(p));
		parser.flush((p) => out.push(p));
		expect(out).toEqual([{ textRuns: ["cut off"] }]);
	});
});
