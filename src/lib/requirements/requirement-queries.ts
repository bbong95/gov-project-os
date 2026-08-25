import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FindExistingRunInput } from "./extract-requirements";

export async function findExistingRequirementRun(
	supabase: SupabaseClient,
	input: FindExistingRunInput,
): Promise<string | null> {
	const { data, error } = await supabase
		.from("requirement_extraction_runs")
		.select("id")
		.eq("tenant_id", input.tenantId)
		.eq("project_id", input.projectId)
		.eq("document_id", input.documentId)
		.eq("document_parse_id", input.documentParseId)
		.eq("fingerprint_sha256", input.fingerprintSha256)
		.maybeSingle();
	if (error) {
		throw new Error("Requirement run lookup failed.");
	}
	return typeof data?.id === "string" ? data.id : null;
}
