import { createParserRegistry } from "./parser-registry";

export type RequirementRunSummary = {
	id: string;
	document_id: string;
	created_at: string;
};

export function isParseableRfpFilename(originalFilename: string): boolean {
	try {
		createParserRegistry().resolve(originalFilename);
		return true;
	} catch {
		return false;
	}
}

export function indexLatestRequirementRuns(
	runs: readonly RequirementRunSummary[],
): Map<string, RequirementRunSummary> {
	const latest = new Map<string, RequirementRunSummary>();
	for (const run of runs) {
		const current = latest.get(run.document_id);
		if (!current || run.created_at > current.created_at) {
			latest.set(run.document_id, run);
		}
	}
	return latest;
}
