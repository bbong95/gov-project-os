// @vitest-environment node

import { describe, expect, it } from "vitest";
import { prepareRfpParse } from "./prepare-rfp-parse";
import { createParserRegistry } from "./parser-registry";
import type { StorageProvider } from "../storage/storage-provider";
import { sha256Hex } from "../documents/rfp-original";
import {
	SYNTHETIC_HWPX_PARAGRAPHS,
	syntheticHwpxBytes,
} from "../../../tests/support/synthetic-hwpx";

const DOCUMENT_ID = "43000000-0000-4000-8000-000000000102";

class BlobStorage implements StorageProvider {
	constructor(private readonly blob: Blob) {}

	async downloadObject(): Promise<Blob> {
		return this.blob;
	}

	async uploadObject(): Promise<void> {
		throw new Error("unused upload");
	}

	async removeUnregisteredObject(): Promise<void> {
		throw new Error("unused removal");
	}
}

describe("prepareRfpParse HWPX support", () => {
	it("maps verified HWPX bytes to section-based trusted SourceSpan payloads", async () => {
		const sourceBytes = Uint8Array.from(syntheticHwpxBytes());
		const payload = await prepareRfpParse(
			{
				id: DOCUMENT_ID,
				originalFilename: "m07.synthetic.hwpx",
				mediaType: "application/hwp+zip",
				storageBucket: "rfp-originals",
				storagePath: `synthetic-project/${DOCUMENT_ID}/original`,
				sha256: await sha256Hex(sourceBytes.buffer),
			},
			new BlobStorage(new Blob([sourceBytes.buffer])),
			createParserRegistry(),
		);

		expect(payload.target_detected_format).toBe("hwpx");
		expect(payload.target_spans).toMatchObject([
			{
				ordinal: 1,
				location: { kind: "SECTION", sectionIndex: 1, blockIndex: 1 },
				originalText: SYNTHETIC_HWPX_PARAGRAPHS[0],
				normalizedText: SYNTHETIC_HWPX_PARAGRAPHS[0],
			},
			{
				ordinal: 2,
				location: { kind: "SECTION", sectionIndex: 1, blockIndex: 2 },
				originalText: SYNTHETIC_HWPX_PARAGRAPHS[1],
				normalizedText: SYNTHETIC_HWPX_PARAGRAPHS[1],
			},
			{
				ordinal: 3,
				location: { kind: "SECTION", sectionIndex: 1, blockIndex: 3 },
				originalText: SYNTHETIC_HWPX_PARAGRAPHS[2],
				normalizedText: SYNTHETIC_HWPX_PARAGRAPHS[2],
			},
		]);
	});
});
