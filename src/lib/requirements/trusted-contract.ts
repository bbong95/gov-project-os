import "server-only";

import { createTrustedSupabaseClient } from "../supabase/trusted-server";

export type CreateContractBaselineInput = {
	actorId: string;
	runId: string;
	proposalId: string;
	changeSummary: string;
	items: Array<{
		changeType: "ADDED" | "MODIFIED" | "DELETED" | "CONFLICT";
		obligationText: string;
		sourceRequirementCandidateId: string | null;
	}>;
};

export type CreateContractBaselineResult = {
	baselineId: string;
	version: number;
	itemCount: number;
	contentSha256: string;
};

function isContractResult(value: unknown): value is CreateContractBaselineResult {
	if (value === null || typeof value !== "object") {
		return false;
	}
	const record = value as Record<string, unknown>;
	return (
		typeof record.baselineId === "string" &&
		typeof record.version === "number" &&
		typeof record.itemCount === "number" &&
		typeof record.contentSha256 === "string"
	);
}

export type ContractChangeType = "ADDED" | "MODIFIED" | "DELETED" | "CONFLICT";

export async function createTrustedContractBaseline(
	input: CreateContractBaselineInput,
): Promise<CreateContractBaselineResult> {
	const client = createTrustedSupabaseClient();
	const { data, error } = await client.rpc("create_contract_baseline", {
		p_actor_id: input.actorId,
		p_run_id: input.runId,
		p_proposal_id: input.proposalId,
		p_change_summary: input.changeSummary,
		p_items: input.items.map((item) => ({
			changeType: item.changeType,
			obligationText: item.obligationText,
			sourceRequirementCandidateId: item.sourceRequirementCandidateId,
		})),
	});
	if (error || !isContractResult(data)) {
		throw new Error("Trusted contract baseline failed.");
	}
	return data;
}
