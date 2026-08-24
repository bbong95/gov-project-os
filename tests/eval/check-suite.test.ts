import { describe, expect, it } from "vitest";
import { summarizeEvalChecks } from "./check-suite";

describe("summarizeEvalChecks", () => {
	it("reports failed check identifiers", () => {
		const summary = summarizeEvalChecks([
			{ id: "source-fidelity", passed: false },
			{ id: "schema", passed: true },
		]);

		expect(summary).toEqual({
			passed: false,
			failedCheckIds: ["source-fidelity"],
		});
	});
});
