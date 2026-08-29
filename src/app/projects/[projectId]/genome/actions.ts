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
import { draftProposalStrategy } from "../../../../lib/ai/proposal-strategy";
import { draftBaselinePlan } from "../../../../lib/ai/baseline-plan";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function readText(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value : "";
}

function redirectToProject(
	projectId: string,
	kind: "genome" | "seed" | "load" | "proposal" | "fail" | "created" | "loaded",
	extra?: { genomeId?: string; coverage?: string; gap?: string; partial?: string },
): never {
	const params = new URLSearchParams();
	params.set(kind, kind === "created" || kind === "loaded" || kind === "proposal" ? "1" : kind);
	if (extra?.genomeId) params.set("genomeId", extra.genomeId);
	if (extra?.coverage) params.set("coverage", extra.coverage);
	if (extra?.gap) params.set("gap", extra.gap);
	if (extra?.partial) params.set("partial", extra.partial);
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

export async function draftProposalAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const genomeId = readText(formData, "genomeId");
	const projectType = readText(formData, "projectType") || "SW";
	const provider = readText(formData, "provider") as "openai" | "groq" | "";
	const fixtureMode = readText(formData, "fixtureMode") === "on";
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
		.select("id, name, tenant_id")
		.eq("id", projectId)
		.maybeSingle();
	if (!project) redirectToProject(projectId, "fail");

	const detail = await loadGenome(project.tenant_id, projectId, genomeId).catch(() => null);
	if (!detail) redirectToProject(projectId, "fail");

	const strategy = await draftProposalStrategy({
		projectName: project.name,
		projectType: projectType as "SW" | "CLOUD" | "DR" | "ISP" | "PMO" | "OPS" | "OTHER",
		requirements: detail.requirements.map((r) => ({ externalId: r.external_id, title: r.title })),
		evaluationItems: detail.evaluationItems.map((e) => ({
			externalId: e.external_id,
			category: e.category,
			title: e.title,
			maxScore: e.max_score,
		})),
		promptVersion: "v1",
		fixtureMode,
		provider: provider || undefined,
	});

	const sectionIds: Record<string, string> = {};
	for (const section of strategy.proposedSections) {
		const { data, error } = await trusted.rpc("upsert_proposal_section", {
			p_actor_id: actorId,
			p_genome_id: genomeId,
			p_section_key: section.sectionKey,
			p_title: section.title,
			p_body_md: section.outline.map((line, i) => `## ${i + 1}. ${line}`).join("\n\n"),
			p_word_count: section.outline.join(" ").length,
			p_prompt_version: "v1",
			p_model_fingerprint: strategy.modelFingerprint,
		});
		if (error) {
			redirectToProject(projectId, "fail", { genomeId });
		}
		if (typeof data === "string") {
			sectionIds[section.sectionKey] = data;
		}
	}

	let addressed = 0;
	let partialCount = 0;
	let gapCount = 0;
	for (const row of strategy.complianceMatrix) {
		const { error: rowError } = await trusted.rpc("upsert_compliance_row", {
			p_actor_id: actorId,
			p_genome_id: genomeId,
			p_requirement_external_id: row.requirementExternalId,
			p_evaluation_item_external_id: row.evaluationItemExternalId,
			p_proposal_section_id: sectionIds[row.proposalSectionKey] ?? null,
			p_status: row.status,
			p_notes: row.notes,
		});
		if (rowError) {
			redirectToProject(projectId, "fail", { genomeId });
		}
		if (row.status === "ADDRESSED") addressed += 1;
		else if (row.status === "PARTIAL") partialCount += 1;
		else if (row.status === "GAP") gapCount += 1;
	}

	for (const wp of strategy.winningPoints) {
		const { error: wpError } = await trusted.rpc("upsert_winning_point", {
			p_actor_id: actorId,
			p_genome_id: genomeId,
			p_theme: wp.theme,
			p_rationale: wp.rationale,
			p_target_evaluation_items: wp.targetEvaluationItems,
		});
		if (wpError) {
			redirectToProject(projectId, "fail", { genomeId });
		}
	}

	const total = strategy.complianceMatrix.length;
	const coveragePct = total === 0 ? 0 : Math.round((addressed / total) * 100);

	revalidatePath(`/projects/${projectId}`);
	redirectToProject(projectId, "proposal", {
		genomeId,
		coverage: String(coveragePct),
		gap: String(gapCount),
		partial: String(partialCount),
	});
}

export async function draftBaselineAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const genomeId = readText(formData, "genomeId");
	const projectType = readText(formData, "projectType") || "SW";
	const projectStartDay = Number(readText(formData, "projectStartDay") || "0");
	const provider = readText(formData, "provider") as "openai" | "groq" | "";
	const fixtureMode = readText(formData, "fixtureMode") === "on";
	const redirectCoverage = readText(formData, "redirectCoverage");
	const redirectGap = readText(formData, "redirectGap");
	const redirectPartial = readText(formData, "redirectPartial");
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
		.select("id, name, tenant_id")
		.eq("id", projectId)
		.maybeSingle();
	if (!project) redirectToProject(projectId, "fail");

	const detail = await loadGenome(project.tenant_id, projectId, genomeId).catch(() => null);
	if (!detail) redirectToProject(projectId, "fail");

	const plan = await draftBaselinePlan({
		projectName: project.name,
		projectType: projectType as "SW" | "CLOUD" | "DR" | "ISP" | "PMO" | "OPS" | "OTHER",
		projectStartDay: Number.isFinite(projectStartDay) ? projectStartDay : 0,
		requirements: detail.requirements.map((r) => ({
			externalId: r.external_id,
			title: r.title,
			priority: r.priority as "CRITICAL" | "HIGH" | "NORMAL" | "LOW",
		})),
		deliverables: detail.deliverables.map((d) => ({
			externalId: d.external_id,
			title: d.title,
			submissionPhase: d.submission_phase,
		})),
		promptVersion: "v1",
		fixtureMode,
		provider: provider || undefined,
	}).catch(() => ({ wbs: [], inspectionCriteria: [], modelFingerprint: "error" }));

	for (const task of plan.wbs) {
		const { error: wbsError } = await trusted.rpc("upsert_wbs_task", {
			p_actor_id: actorId,
			p_genome_id: genomeId,
			p_requirement_external_id: task.requirementExternalId,
			p_task_title: task.taskTitle,
			p_start_day: task.startDay,
			p_end_day: task.endDay,
			p_owner: task.owner,
		});
		if (wbsError) {
			redirectToProject(projectId, "fail", { genomeId });
		}
	}

	for (const criterion of plan.inspectionCriteria) {
		const { error: icError } = await trusted.rpc("upsert_inspection_criterion", {
			p_actor_id: actorId,
			p_genome_id: genomeId,
			p_requirement_external_id: criterion.requirementExternalId,
			p_deliverable_external_id: criterion.deliverableExternalId,
			p_criterion: criterion.criterion,
			p_method: criterion.method,
			p_acceptance: criterion.acceptance,
		});
		if (icError) {
			redirectToProject(projectId, "fail", { genomeId });
		}
	}

	revalidatePath(`/projects/${projectId}`);
	redirectToProject(projectId, "proposal", {
		genomeId,
		coverage: redirectCoverage || "?",
		gap: redirectGap || "?",
		partial: redirectPartial || "?",
	});
}


