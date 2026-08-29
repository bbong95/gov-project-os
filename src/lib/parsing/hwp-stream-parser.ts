// Simplified streaming XML walker specialised for HWPX section content.
// Reads the input stream as a sequence of chunks and emits one
// { textRuns: string[] } per <p>...</p> boundary. The walker keeps
// only the current buffer position; the HWPX section is consumed
// once. Peak memory is O(longest <p> block + 1 chunk), not the
// whole document.

type TextRun = { text: string };

export type ParsedHwpParagraph = {
	textRuns: string[];
};

export type HwpChunkConsumer = (paragraph: ParsedHwpParagraph) => void;

const PARA_OPEN = /<(?:[a-zA-Z][\w.-]*:)?p\b[^>]*>/g;
const PARA_CLOSE = /<\/(?:[a-zA-Z][\w.-]*:)?p\s*>/g;
const TEXT_OPEN = /<(?:[a-zA-Z][\w.-]*:)?t\b[^>]*>/g;
const TEXT_CLOSE = /<\/(?:[a-zA-Z][\w.-]*:)?t\s*>/g;
const INLINE_OPEN = /<(?:[a-zA-Z][\w.-]*:)?(?:sdt|bookmark|control|mark|pic|a)\b[^>]*>/g;
const INLINE_CLOSE = /<\/(?:[a-zA-Z][\w.-]*:)?(?:sdt|bookmark|control|mark|pic|a)\s*>/g;
const SELF_CLOSING = /<(?<!\/)[a-zA-Z][\w.-]*(?::[a-zA-Z][\w.-]*)?\b[^>]*\/>/g;
const LINE_BREAK = /^<(?:[a-zA-Z][\w.-]*:)?lineBreak\b/i;
const TAB = /^<(?:[a-zA-Z][\w.-]*:)?tab\b/i;

const ENTITY_MAP: Record<string, string> = {
	lt: "<",
	gt: ">",
	amp: "&",
	quot: '"',
	apos: "'",
};

function decodeEntities(input: string): string {
	let out = "";
	let i = 0;
	while (i < input.length) {
		const ch = input[i];
		if (ch !== "&") {
			out += ch;
			i += 1;
			continue;
		}
		const semi = input.indexOf(";", i);
		if (semi < 0 || semi - i > 8) {
			out += ch;
			i += 1;
			continue;
		}
		const entity = input.slice(i + 1, semi);
		if (entity.startsWith("#x")) {
			const code = Number.parseInt(entity.slice(2), 16);
			if (Number.isFinite(code) && code > 0) {
				out += String.fromCodePoint(code);
				i = semi + 1;
				continue;
			}
		} else if (entity.startsWith("#")) {
			const code = Number.parseInt(entity.slice(1), 10);
			if (Number.isFinite(code) && code > 0) {
				out += String.fromCodePoint(code);
				i = semi + 1;
				continue;
			}
		} else if (entity in ENTITY_MAP) {
			out += ENTITY_MAP[entity] ?? "";
			i = semi + 1;
			continue;
		}
		out += ch;
		i += 1;
	}
	return out;
}

function findFirst(input: string, pattern: RegExp, from: number): number {
	pattern.lastIndex = from;
	const match = pattern.exec(input);
	pattern.lastIndex = 0;
	return match ? match.index : -1;
}

/**
 * Streaming paragraph parser. Feeds `chunk` after `chunk` and emits
 * one paragraph per </p>. The `flush` call drains the trailing buffer
 * at end of input.
 */
export class HwpStreamParser {
	private buffer = "";
	private currentText: string | null = null;
	private currentRuns: string[] | null = null;

	feed(chunk: string, emit: HwpChunkConsumer): void {
		this.buffer += chunk;
		this.drain(emit);
	}

	flush(emit: HwpChunkConsumer): void {
		this.drain(emit);
		if (this.currentText !== null) {
			// textEnd tracks the offset right after the opening <t>'s
			// closing '>'. captureText reads from textEnd to the end
			// of the buffer (since </t> never arrived in unterminated
			// input).
			const collected = this.buffer.slice(this.textEnd);
			if (this.currentRuns !== null && collected.length > 0) {
				this.currentRuns.push(decodeEntities(collected));
			}
			this.currentText = null;
		}
		if (this.currentRuns !== null) {
			emit({ textRuns: this.currentRuns });
			this.currentRuns = null;
		}
		this.textEnd = 0;
	}

	private captureText(): string {
		// After the opening <t> tag at this.scanFrom, the text body is
		// everything up to the matching </t> tag (which the drain loop
		// already found). The captured slice is from this.scanFrom to the
		// first index less than that.
		// captureText is called immediately before the closing </t> is
		// processed, so the latest "</t" we saw is the boundary. Use
		// findFirst again to be safe.
		const close = findFirst(this.buffer, TEXT_CLOSE, 0);
		const raw = this.buffer.slice(this.scanFrom, close);
		this.scanFrom = close + this.buffer.slice(close).indexOf(">") + 1;
		return decodeEntities(raw);
	}

	private scanFrom = 0;
	private textEnd = 0;

	private drain(emit: HwpChunkConsumer): void {
		while (true) {
			const idxParaOpen = findFirst(this.buffer, PARA_OPEN, this.scanFrom);
			const idxParaClose = findFirst(this.buffer, PARA_CLOSE, this.scanFrom);
			const idxTextOpen = findFirst(this.buffer, TEXT_OPEN, this.scanFrom);
			const idxTextClose = findFirst(this.buffer, TEXT_CLOSE, this.scanFrom);
			const idxSelfClose = findFirst(this.buffer, SELF_CLOSING, this.scanFrom);
			const idxInlineOpen = findFirst(this.buffer, INLINE_OPEN, this.scanFrom);
			const idxInlineClose = findFirst(this.buffer, INLINE_CLOSE, this.scanFrom);

			const candidates = [
				idxParaOpen,
				idxParaClose,
				idxTextOpen,
				idxTextClose,
				idxSelfClose,
				idxInlineOpen,
				idxInlineClose,
			].filter((i) => i >= 0);
			if (candidates.length === 0) {
				// Compact the buffer to bound memory.
				if (this.scanFrom > 4096) {
					this.buffer = this.buffer.slice(this.scanFrom);
					this.scanFrom = 0;
				}
				return;
			}
			const next = Math.min(...candidates);

			if (next === idxParaOpen) {
				// Close any prior <p>.
				if (this.currentRuns !== null) {
					if (this.currentText !== null) {
						const collected = this.captureTextAt(idxParaOpen);
						if (collected.length > 0) this.currentRuns.push(collected);
						this.currentText = null;
					}
					emit({ textRuns: this.currentRuns });
					this.currentRuns = null;
				}
				const tagEnd = this.buffer.indexOf(">", idxParaOpen) + 1;
				this.scanFrom = tagEnd;
				this.currentRuns = [];
				continue;
			}
			if (next === idxTextOpen) {
				// Close any prior <t>.
				if (this.currentText !== null && this.currentRuns !== null) {
					const collected = this.captureTextAt(idxTextOpen);
					if (collected.length > 0) this.currentRuns.push(collected);
				}
				const tagEnd = this.buffer.indexOf(">", idxTextOpen) + 1;
				this.scanFrom = tagEnd;
				this.textEnd = tagEnd;
				this.currentText = "";
				continue;
			}
			if (next === idxTextClose) {
				if (this.currentText !== null && this.currentRuns !== null) {
					const collected = this.captureTextAt(idxTextClose);
					if (collected.length > 0) this.currentRuns.push(collected);
					this.currentText = null;
				}
				const tagEnd = this.buffer.indexOf(">", idxTextClose) + 1;
				this.scanFrom = tagEnd;
				continue;
			}
			if (next === idxInlineOpen || next === idxInlineClose) {
				// Drop inline container open/close tags completely so the
				// text inside the inline element is not leaked into the
				// parent paragraph's text run.
				const tagEnd = this.buffer.indexOf(">", next) + 1;
				this.scanFrom = tagEnd;
				continue;
			}
			if (next === idxParaClose) {
				// Close current <p>.
				if (this.currentText !== null && this.currentRuns !== null) {
					const collected = this.captureTextAt(idxParaClose);
					if (collected.length > 0) this.currentRuns.push(collected);
					this.currentText = null;
				}
				if (this.currentRuns !== null) {
					emit({ textRuns: this.currentRuns });
					this.currentRuns = null;
				}
				const tagEnd = this.buffer.indexOf(">", idxParaClose) + 1;
				this.scanFrom = tagEnd;
				continue;
			}
			// Self-closing tag.
			const tagEnd = this.buffer.indexOf(">", idxSelfClose) + 1;
			const tag = this.buffer.slice(idxSelfClose, tagEnd);
			if (LINE_BREAK.test(tag)) {
				if (this.currentText !== null) {
					this.currentText += "\n";
				} else if (this.currentRuns !== null) {
					this.currentRuns.push("\n");
				}
			} else if (TAB.test(tag)) {
				if (this.currentText !== null) {
					this.currentText += "\t";
				} else if (this.currentRuns !== null) {
					this.currentRuns.push("\t");
				}
			}
			this.scanFrom = tagEnd;
		}
	}

	private captureTextAt(nextBoundary: number): string {
		const raw = this.buffer.slice(this.scanFrom, nextBoundary);
		this.scanFrom = nextBoundary;
		return decodeEntities(raw);
	}
}
