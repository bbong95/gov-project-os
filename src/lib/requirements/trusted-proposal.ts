import "server-only";

import { createTrustedSupabaseClient } from "../supabase/trusted-server";

export type CreateProposalInput = {
	actorId: string;
	runId: string;
};

export type CreateProposalResult = {
	proposalId: string;
	version: number;
	sectionCount: number;
};

function isProposalResult(value: unknown): value is CreateProposalResult {
	if (value === null || typeof value !== "object") {
		return false;
	}
	const record = value as Record<string, unknown>;
	return (
		typeof record.proposalId === "string" &&
		typeof record.version === "number" &&
		typeof record.sectionCount === "number"
	);
}

export async function createTrustedProposal(
	input: CreateProposalInput,
): Promise<CreateProposalResult> {
	const client = createTrustedSupabaseClient();
	const { data, error } = await client.rpc("generate_proposal", {
		p_actor_id: input.actorId,
		p_run_id: input.runId,
	});
	if (error || !isProposalResult(data)) {
		throw new Error("Trusted proposal generation failed.");
	}
	return data;
}
