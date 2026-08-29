"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { createTrustedSupabaseClient } from "../../../../lib/supabase/trusted-server";
import {
	listGenomesForProject,
	seedGenomeFromRfp,
	loadGenome,
} from "../../../../lib/genome/project-genome";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function readText(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value : "";
}

function redirectToProject(
	projectId: string,
	kind: "genome" | "seed" | "load" | "fail" | "created" | "loaded",
	extra?: { genomeId?: string },
): never {
	const params = new URLSearchParams();
	params.set(kind, kind === "created" || kind === "loaded" ? "1" : kind);
	if (extra?.genomeId) params.set("genomeId", extra.genomeId);
	const search = params.toString();
	redirect(`/projects/${projectId}?${search}`);
}

export async function seedGenomeAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const documentId = readText(formData, "documentId");
	const documentParseId = readText(formData, "documentParseId");
	if (!UUID_PATTERN.test(projectId) || !UUID_PATTERN.test(documentId) || !UUID_PATTERN.test(documentParseId)) {
		redirectToProject(projectId, "fail");
	}
	const supabase = await createServerSupabaseClient();
	const { data: claimsData } = await supabase.auth.getClaims();
	const actorId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";
	if (!actorId) redirect("/login");

	const trusted = createTrustedSupabaseClient();
	const { data: document } = await trusted
		.from("documents")
		.select("tenant_id, original_filename, media_type, storage_bucket, storage_path, sha256")
		.eq("id", documentId)
		.maybeSingle();
	if (!document) redirectToProject(projectId, "fail");

	let genomeId: string;
	try {
		const result = await seedGenomeFromRfp({
			actorId,
			tenantId: document.tenant_id,
			projectId,
			rfpDocumentId: documentId,
			rfpDocumentParseId: documentParseId,
			storageBucket: document.storage_bucket,
			storagePath: document.storage_path,
			originalFilename: document.original_filename,
			mediaType: document.media_type,
			sha256: document.sha256,
		});
		genomeId = result.genomeId;
	} catch {
		redirectToProject(projectId, "fail");
	}
	revalidatePath(`/projects/${projectId}`);
	redirectToProject(projectId, "seed", { genomeId });
}

export async function loadGenomeAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const genomeId = readText(formData, "genomeId");
	if (!UUID_PATTERN.test(projectId) || !UUID_PATTERN.test(genomeId)) {
		redirectToProject(projectId, "fail");
	}
	const supabase = await createServerSupabaseClient();
	const { data: claimsData } = await supabase.auth.getClaims();
	const actorId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";
	if (!actorId) redirect("/login");
	const trusted = createTrustedSupabaseClient();
	const { data: project } = await trusted
		.from("projects")
		.select("tenant_id")
		.eq("id", projectId)
		.maybeSingle();
	if (!project) redirectToProject(projectId, "fail");
	try {
		await loadGenome(project.tenant_id, projectId, genomeId);
	} catch {
		redirectToProject(projectId, "fail");
	}
	revalidatePath(`/projects/${projectId}`);
	redirectToProject(projectId, "load", { genomeId });
}

export async function listGenomesAction(projectId: string): Promise<
	Array<{ id: string; stage: string; summary: string | null; created_at: string; updated_at: string }>
> {
	if (!UUID_PATTERN.test(projectId)) return [];
	const supabase = await createServerSupabaseClient();
	const { data: claimsData } = await supabase.auth.getClaims();
	const actorId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";
	if (!actorId) return [];
	const trusted = createTrustedSupabaseClient();
	const { data: project } = await trusted
		.from("projects")
		.select("tenant_id")
		.eq("id", projectId)
		.maybeSingle();
	if (!project) return [];
	try {
		return await listGenomesForProject(project.tenant_id, projectId);
	} catch {
		return [];
	}
}
