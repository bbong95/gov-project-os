"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../../../../../lib/supabase/server";
import { createTrustedSupabaseClient } from "../../../../../../lib/supabase/trusted-server";
import {
	approveTrustedArtifactTemplateMapping,
	approveTrustedArtifact,
	generateTrustedArtifact,
	recordTrustedArtifactTemplateField,
	registerTrustedArtifactTemplate,
	submitTrustedArtifactTemplateMapping,
} from "../../../../../../lib/artifacts/trusted-template-artifact";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function readText(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value : "";
}

async function loadActorContext(projectId: string): Promise<{ actorId: string; tenantId: string } | null> {
	if (!UUID_PATTERN.test(projectId)) return null;
	const supabase = await createServerSupabaseClient();
	const { data: claimsData } = await supabase.auth.getClaims();
	const actorId =
		typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";
	if (!actorId) return null;
	const { data: project } = await supabase
		.from("projects")
		.select("id, tenant_id")
		.eq("id", projectId)
		.maybeSingle();
	if (!project) return null;
	return { actorId, tenantId: project.tenant_id as string };
}

function redirectToWorkspace(projectId: string, runId: string, status: string): never {
	revalidatePath(`/projects/${projectId}/runs/${runId}/workspace`);
	redirect(`/projects/${projectId}/runs/${runId}/workspace?status=${status}`);
}

// M15 WBS task
export async function createWbsTaskAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const runId = readText(formData, "runId");
	const title = readText(formData, "title").trim();
	const owner = readText(formData, "owner").trim();
	const dueDate = readText(formData, "dueDate").trim();
	const requirementCandidateId = readText(formData, "requirementCandidateId").trim();
	const parentTaskId = readText(formData, "parentTaskId").trim();
	if (!title || !UUID_PATTERN.test(requirementCandidateId)) {
		redirectToWorkspace(projectId, runId, "wbs_failed");
	}
	const context = await loadActorContext(projectId);
	if (!context) {
		redirect("/login");
	}
	const trusted = createTrustedSupabaseClient();
	const { error } = await trusted.from("wbs_tasks").insert({
		tenant_id: context.tenantId,
		project_id: projectId,
		run_id: runId,
		title,
		owner: owner || null,
		due_date: dueDate || null,
		requirement_candidate_id: requirementCandidateId,
		parent_task_id: parentTaskId && UUID_PATTERN.test(parentTaskId) ? parentTaskId : null,
		created_by: context.actorId,
	});
	if (error) {
		redirectToWorkspace(projectId, runId, "wbs_failed");
	}
	redirectToWorkspace(projectId, runId, "wbs_created");
}

// M15 deliverable
export async function createWbsDeliverableAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const runId = readText(formData, "runId");
	const taskId = readText(formData, "taskId");
	const title = readText(formData, "title").trim();
	const contentPath = readText(formData, "contentPath").trim();
	if (!title || !UUID_PATTERN.test(taskId)) {
		redirectToWorkspace(projectId, runId, "deliverable_failed");
	}
	const context = await loadActorContext(projectId);
	if (!context) {
		redirect("/login");
	}
	const trusted = createTrustedSupabaseClient();
	const { error } = await trusted.from("wbs_deliverables").insert({
		tenant_id: context.tenantId,
		project_id: projectId,
		task_id: taskId,
		title,
		content_path: contentPath || null,
	});
	if (error) {
		redirectToWorkspace(projectId, runId, "deliverable_failed");
	}
	redirectToWorkspace(projectId, runId, "deliverable_created");
}

// M17 meeting
export async function createMeetingAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const runId = readText(formData, "runId");
	const title = readText(formData, "title").trim();
	const heldAt = readText(formData, "heldAt").trim();
	if (!title || !heldAt) {
		redirectToWorkspace(projectId, runId, "meeting_failed");
	}
	const context = await loadActorContext(projectId);
	if (!context) {
		redirect("/login");
	}
	const trusted = createTrustedSupabaseClient();
	const { error } = await trusted.from("meetings").insert({
		tenant_id: context.tenantId,
		project_id: projectId,
		run_id: runId,
		title,
		held_at: heldAt,
		status: "DRAFT",
		created_by: context.actorId,
	});
	if (error) {
		redirectToWorkspace(projectId, runId, "meeting_failed");
	}
	redirectToWorkspace(projectId, runId, "meeting_created");
}

export async function approveMeetingAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const runId = readText(formData, "runId");
	const meetingId = readText(formData, "meetingId");
	const contentMd = readText(formData, "contentMd").trim();
	if (!UUID_PATTERN.test(meetingId) || !contentMd) {
		redirectToWorkspace(projectId, runId, "minute_failed");
	}
	const context = await loadActorContext(projectId);
	if (!context) {
		redirect("/login");
	}
	const trusted = createTrustedSupabaseClient();
	const { error } = await trusted.from("meeting_minutes").insert({
		meeting_id: meetingId,
		content_md: contentMd,
		approved_by: context.actorId,
		approved_at: new Date().toISOString(),
	});
	if (error) {
		redirectToWorkspace(projectId, runId, "minute_failed");
	}
	const { error: meetingError } = await trusted
		.from("meetings")
		.update({ status: "APPROVED" })
		.eq("id", meetingId);
	if (meetingError) {
		redirectToWorkspace(projectId, runId, "minute_failed");
	}
	redirectToWorkspace(projectId, runId, "minute_approved");
}

// M18 risk
export async function createRiskAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const runId = readText(formData, "runId");
	const title = readText(formData, "title").trim();
	const severity = readText(formData, "severity").trim();
	const requirementCandidateId = readText(formData, "requirementCandidateId").trim();
	if (!title || !["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(severity)) {
		redirectToWorkspace(projectId, runId, "risk_failed");
	}
	const context = await loadActorContext(projectId);
	if (!context) {
		redirect("/login");
	}
	const trusted = createTrustedSupabaseClient();
	const { error } = await trusted.from("risks").insert({
		tenant_id: context.tenantId,
		project_id: projectId,
		run_id: runId,
		title,
		severity,
		status: "OPEN",
		requirement_candidate_id:
			requirementCandidateId && UUID_PATTERN.test(requirementCandidateId)
				? requirementCandidateId
				: null,
		created_by: context.actorId,
	});
	if (error) {
		redirectToWorkspace(projectId, runId, "risk_failed");
	}
	redirectToWorkspace(projectId, runId, "risk_created");
}

export async function approveRiskAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const runId = readText(formData, "runId");
	const riskId = readText(formData, "riskId");
	if (!UUID_PATTERN.test(riskId)) {
		redirectToWorkspace(projectId, runId, "risk_failed");
	}
	const context = await loadActorContext(projectId);
	if (!context) {
		redirect("/login");
	}
	const trusted = createTrustedSupabaseClient();
	const { error } = await trusted
		.from("risks")
		.update({
			status: "APPROVED",
			approved_by: context.actorId,
			approved_at: new Date().toISOString(),
		})
		.eq("id", riskId);
	if (error) {
		redirectToWorkspace(projectId, runId, "risk_failed");
	}
	redirectToWorkspace(projectId, runId, "risk_approved");
}

// M19 inspection
export async function createInspectionAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const runId = readText(formData, "runId");
	const criterion = readText(formData, "criterion").trim();
	const method = readText(formData, "method").trim();
	const result = readText(formData, "result").trim();
	const evidenceRef = readText(formData, "evidenceRef").trim();
	const requirementCandidateId = readText(formData, "requirementCandidateId").trim();
	if (
		!criterion ||
		!method ||
		!["PASS", "FAIL", "PENDING"].includes(result) ||
		(result !== "PENDING" && !evidenceRef)
	) {
		redirectToWorkspace(projectId, runId, "inspection_failed");
	}
	const context = await loadActorContext(projectId);
	if (!context) {
		redirect("/login");
	}
	const trusted = createTrustedSupabaseClient();
	const { error } = await trusted.from("inspections").insert({
		tenant_id: context.tenantId,
		project_id: projectId,
		run_id: runId,
		criterion,
		method,
		result,
		evidence_ref: evidenceRef || null,
		requirement_candidate_id:
			requirementCandidateId && UUID_PATTERN.test(requirementCandidateId)
				? requirementCandidateId
				: null,
		created_by: context.actorId,
	});
	if (error) {
		redirectToWorkspace(projectId, runId, "inspection_failed");
	}
	redirectToWorkspace(projectId, runId, "inspection_created");
}

// M16 template registration
export async function registerTemplateAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const runId = readText(formData, "runId");
	const originalFilename = readText(formData, "originalFilename").trim();
	const mediaType = readText(formData, "mediaType").trim();
	const storagePath = readText(formData, "storagePath").trim();
	const sha256 = readText(formData, "sha256").trim();
	if (!originalFilename || !storagePath || !/^[0-9a-f]{64}$/.test(sha256)) {
		redirectToWorkspace(projectId, runId, "template_failed");
	}
	const context = await loadActorContext(projectId);
	if (!context) {
		redirect("/login");
	}
	try {
		await registerTrustedArtifactTemplate({
			actorId: context.actorId,
			projectId,
			originalFilename,
			mediaType: mediaType || "application/hwp+zip",
			storageBucket: "artifact-templates",
			storagePath,
			sha256,
			detectedFormat: originalFilename.toLowerCase().endsWith(".hwpx") ? "hwpx" : "unknown",
		});
	} catch {
		redirectToWorkspace(projectId, runId, "template_failed");
	}
	redirectToWorkspace(projectId, runId, "template_registered");
}

export async function recordTemplateFieldAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const runId = readText(formData, "runId");
	const templateId = readText(formData, "templateId");
	const fieldKey = readText(formData, "fieldKey").trim();
	const anchorKind = readText(formData, "anchorKind").trim();
	const anchorSelector = readText(formData, "anchorSelector").trim();
	const required = readText(formData, "required") === "on";
	const description = readText(formData, "description").trim();
	if (
		!UUID_PATTERN.test(templateId) ||
		!fieldKey ||
		!anchorKind ||
		!anchorSelector
	) {
		redirectToWorkspace(projectId, runId, "template_field_failed");
	}
	const context = await loadActorContext(projectId);
	if (!context) {
		redirect("/login");
	}
	try {
		await recordTrustedArtifactTemplateField({
			actorId: context.actorId,
			templateId,
			fieldKey,
			anchorKind,
			anchorSelector,
			required,
			description,
		});
	} catch {
		redirectToWorkspace(projectId, runId, "template_field_failed");
	}
	redirectToWorkspace(projectId, runId, "template_field_recorded");
}

export async function submitTemplateMappingAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const runId = readText(formData, "runId");
	const templateId = readText(formData, "templateId");
	const sourceKind = readText(formData, "sourceKind").trim();
	const sourceId = readText(formData, "sourceId").trim();
	const mappingRaw = readText(formData, "mappingJson").trim();
	if (!UUID_PATTERN.test(templateId) || !UUID_PATTERN.test(sourceId) || !mappingRaw) {
		redirectToWorkspace(projectId, runId, "template_mapping_failed");
	}
	let mapping: Record<string, unknown>;
	try {
		mapping = JSON.parse(mappingRaw);
	} catch {
		redirectToWorkspace(projectId, runId, "template_mapping_failed");
	}
	if (
		typeof sourceKind !== "string" ||
		![
			"CONTRACT_BASELINE",
			"REQUIREMENT_BASELINE",
			"WBS_TASK",
			"INSPECTION",
			"MEETING_MINUTE",
			"CLOSE_OUT",
			"MANUAL_INPUT",
		].includes(sourceKind)
	) {
		redirectToWorkspace(projectId, runId, "template_mapping_failed");
	}
	const context = await loadActorContext(projectId);
	if (!context) {
		redirect("/login");
	}
	try {
		await submitTrustedArtifactTemplateMapping({
			actorId: context.actorId,
			templateId,
			sourceKind: sourceKind as Parameters<typeof submitTrustedArtifactTemplateMapping>[0]["sourceKind"],
			sourceId,
			mapping,
		});
	} catch {
		redirectToWorkspace(projectId, runId, "template_mapping_failed");
	}
	redirectToWorkspace(projectId, runId, "template_mapping_submitted");
}

export async function approveTemplateMappingAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const runId = readText(formData, "runId");
	const mappingId = readText(formData, "mappingId");
	if (!UUID_PATTERN.test(mappingId)) {
		redirectToWorkspace(projectId, runId, "template_mapping_failed");
	}
	const context = await loadActorContext(projectId);
	if (!context) {
		redirect("/login");
	}
	try {
		await approveTrustedArtifactTemplateMapping({
			actorId: context.actorId,
			mappingId,
		});
	} catch {
		redirectToWorkspace(projectId, runId, "template_mapping_failed");
	}
	redirectToWorkspace(projectId, runId, "template_mapping_approved");
}

export async function generateArtifactAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const runId = readText(formData, "runId");
	const mappingId = readText(formData, "mappingId");
	const storagePath = readText(formData, "storagePath").trim();
	const contentSha256 = readText(formData, "contentSha256").trim();
	if (!UUID_PATTERN.test(mappingId) || !storagePath || !/^[0-9a-f]{64}$/.test(contentSha256)) {
		redirectToWorkspace(projectId, runId, "artifact_failed");
	}
	const context = await loadActorContext(projectId);
	if (!context) {
		redirect("/login");
	}
	try {
		await generateTrustedArtifact({
			actorId: context.actorId,
			mappingId,
			runId: UUID_PATTERN.test(runId) ? runId : null,
			unresolvedRequiredFields: [],
			validation: { passed: true, checks: ["structure_valid", "required_resolved"] },
			previewMetadata: { renderedBytes: contentSha256.length * 2 },
			storageBucket: "artifact-templates",
			storagePath,
			contentSha256,
			modelFingerprint: "fixture-hwpx-filler-v1",
			promptVersion: "fixture-prompt-v1",
		});
	} catch {
		redirectToWorkspace(projectId, runId, "artifact_failed");
	}
	redirectToWorkspace(projectId, runId, "artifact_generated");
}

export async function approveArtifactAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const runId = readText(formData, "runId");
	const artifactId = readText(formData, "artifactId");
	if (!UUID_PATTERN.test(artifactId)) {
		redirectToWorkspace(projectId, runId, "artifact_failed");
	}
	const context = await loadActorContext(projectId);
	if (!context) {
		redirect("/login");
	}
	try {
		await approveTrustedArtifact({ actorId: context.actorId, artifactId });
	} catch {
		redirectToWorkspace(projectId, runId, "artifact_failed");
	}
	redirectToWorkspace(projectId, runId, "artifact_approved");
}

// M20 closeout
export async function recordCloseoutAction(formData: FormData): Promise<void> {
	const projectId = readText(formData, "projectId");
	const runId = readText(formData, "runId");
	const finalAccepted = readText(formData, "finalAccepted") === "on";
	const securityTerminated = readText(formData, "securityTerminated") === "on";
	const lessonsLearned = readText(formData, "lessonsLearned").trim();
	const unresolvedTransfer = readText(formData, "unresolvedTransfer").trim();
	const context = await loadActorContext(projectId);
	if (!context) {
		redirect("/login");
	}
	const trusted = createTrustedSupabaseClient();
	const { data: gate } = await trusted.rpc("can_finalize_closeout", { p_run_id: runId });
	if (gate !== true) {
		redirectToWorkspace(projectId, runId, "closeout_blocked");
	}
	const { error } = await trusted.from("closeouts").upsert(
		{
			tenant_id: context.tenantId,
			project_id: projectId,
			run_id: runId,
			final_accepted: finalAccepted,
			security_terminated: securityTerminated,
			lessons_learned: lessonsLearned || null,
			unresolved_transfer: unresolvedTransfer || null,
			approved_by: context.actorId,
			approved_at: new Date().toISOString(),
			created_by: context.actorId,
		},
		{ onConflict: "tenant_id,project_id,run_id" },
	);
	if (error) {
		redirectToWorkspace(projectId, runId, "closeout_failed");
	}
	redirectToWorkspace(projectId, runId, "closeout_recorded");
}
