import { describe, expect, it } from "vitest";
import {
	indexLatestRequirementRuns,
	isParseableRfpFilename,
} from "./rfp-workflow-state";

describe("RFP workflow state", () => {
	it("offers the next parse action for TXT and HWPX only", () => {
		expect(isParseableRfpFilename("synthetic.txt")).toBe(true);
		expect(isParseableRfpFilename("synthetic.hwpx")).toBe(true);
		expect(isParseableRfpFilename("synthetic.hwp")).toBe(false);
		expect(isParseableRfpFilename("synthetic.pdf")).toBe(false);
	});

	it("keeps the latest requirement draft reachable after redirect parameters disappear", () => {
		const latest = indexLatestRequirementRuns([
			{ id: "run-new", document_id: "document-a", created_at: "2026-08-29T02:00:00Z" },
			{ id: "run-old", document_id: "document-a", created_at: "2026-08-29T01:00:00Z" },
			{ id: "run-b", document_id: "document-b", created_at: "2026-08-29T00:00:00Z" },
		]);

		expect(latest.get("document-a")?.id).toBe("run-new");
		expect(latest.get("document-b")?.id).toBe("run-b");
	});
});
