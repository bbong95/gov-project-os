"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { createTrustedSupabaseClient } from "../../../../lib/supabase/trusted-server";
import { loadGenome } from "../../../../lib/genome/project-genome";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function readText(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value : "";
}

function redirectToProject(
	projectId: string,
	genomeId: string,
	kind: "evidence" | "fail",
): never {
	const params = new URLSearchParams();
	params.set(kind, "1");
	if (kind === "fail") params.set("evidence", "");
	redirect(`/projects/${projectId}/genome?genomeId=${genomeId}&${params.toString()}`);
}

export async function addEvidenceAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const genomeId = readText(formData, "genomeId");
	const requirementExternalId = readText(formData, "requirementExternalId").trim();
	const inspectionExternalId = readText(formData, "inspectionExternalId").trim();
	const title = readText(formData, "title").trim();
	const kindRaw = readText(formData, "kind").trim();
	const storageBucket = readText(formData, "storageBucket").trim();
	const storagePath = readText(formData, "storagePath").trim();
	const sha256 = readText(formData, "sha256").trim();
	if (!UUID_PATTERN.test(projectId) || !UUID_PATTERN.test(genomeId)) {
		redirectToProject(projectId, genomeId, "fail");
	}
	if (!title || !kindRaw || !storageBucket || !storagePath || !sha256) {
		redirectToProject(projectId, genomeId, "fail");
	}
	if (!SHA256_PATTERN.test(sha256)) {
		redirectToProject(projectId, genomeId, "fail");
	}
	const validKinds = new Set([
		"DOCUMENT",
		"SCREENSHOT",
		"TEST_REPORT",
		"MEETING",
		"EMAIL",
		"OTHER",
	]);
	if (!validKinds.has(kindRaw)) {
		redirectToProject(projectId, genomeId, "fail");
	}
	const supabase = await createServerSupabaseClient();
	const { data: claimsData } = await supabase.auth.getClaims();
	const actorId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";
	if (!actorId) redirect("/login");

	const trusted = createTrustedSupabaseClient();
	const { data: project } = await trusted
		.from("projects")
		.select("id, tenant_id")
		.eq("id", projectId)
		.maybeSingle();
	if (!project) redirectToProject(projectId, genomeId, "fail");

	// Resolve the actual requirement/inspection UUIDs from the Genome
	// (so a maliciously crafted external_id never injects a row into
	// someone else's Genome). loadGenome also enforces RLS.
	const detail = await loadGenome(project.tenant_id, projectId, genomeId).catch(() => null);
	if (!detail) redirectToProject(projectId, genomeId, "fail");

	let requirementId: string | null = null;
	if (requirementExternalId) {
		const r = detail.requirements.find(
			(row) => row.external_id === requirementExternalId,
		);
		if (!r) redirectToProject(projectId, genomeId, "fail");
		requirementId = r.id;
	}

	let inspectionId: string | null = null;
	if (inspectionExternalId) {
		// Inspection external_id convention: "<REQ>|NONE" or "<REQ>|<DEL>"
		// (we always store the requirement id portion). Resolve by
		// looking up the requirement in the Genome.
		const reqExt = inspectionExternalId.split("|")[0] ?? "";
		const r = detail.requirements.find((row) => row.external_id === reqExt);
		if (!r) redirectToProject(projectId, genomeId, "fail");
		inspectionId = null; // not in genome_inspection_criteria table; mapped to req only
	}

	const { error } = await trusted.from("genome_evidence").insert({
		tenant_id: project.tenant_id,
		project_id: projectId,
		genome_id: genomeId,
		genome_version: 1,
		external_id: `EVD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
		requirement_id: requirementId,
		inspection_criterion_id: inspectionId,
		kind: kindRaw,
		title,
		storage_bucket: storageBucket,
		storage_path: storagePath,
		sha256,
		collected_by: actorId,
	});
	if (error) {
		redirectToProject(projectId, genomeId, "fail");
	}
	revalidatePath(`/projects/${projectId}/genome?genomeId=${genomeId}`);
	redirectToProject(projectId, genomeId, "evidence");
}
