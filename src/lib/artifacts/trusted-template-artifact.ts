import "server-only";

import { createTrustedSupabaseClient } from "../supabase/trusted-server";

export type RegisterTemplateInput = {
	actorId: string;
	projectId: string;
	originalFilename: string;
	mediaType: string;
	storageBucket: string;
	storagePath: string;
	sha256: string;
	detectedFormat: string;
};

export type RegisterTemplateResult = {
	templateId: string;
	version: number;
	created: boolean;
};

function isRegisterResult(value: unknown): value is RegisterTemplateResult {
	if (value === null || typeof value !== "object") return false;
	const record = value as Record<string, unknown>;
	return (
		typeof record.templateId === "string" &&
		typeof record.version === "number" &&
		typeof record.created === "boolean"
	);
}

export async function registerTrustedArtifactTemplate(
	input: RegisterTemplateInput,
): Promise<RegisterTemplateResult> {
	const client = createTrustedSupabaseClient();
	const { data, error } = await client.rpc("register_artifact_template", {
		p_actor_id: input.actorId,
		p_project_id: input.projectId,
		p_original_filename: input.originalFilename,
		p_media_type: input.mediaType,
		p_storage_bucket: input.storageBucket,
		p_storage_path: input.storagePath,
		p_sha256: input.sha256,
		p_detected_format: input.detectedFormat,
	});
	if (error || !isRegisterResult(data)) {
		throw new Error("Trusted template registration failed.");
	}
	return data;
}

export type RecordTemplateFieldInput = {
	actorId: string;
	templateId: string;
	fieldKey: string;
	anchorKind: string;
	anchorSelector: string;
	required: boolean;
	description: string;
};

export type RecordTemplateFieldResult = {
	fieldId: string;
	contentSha256: string;
};

function isFieldResult(value: unknown): value is RecordTemplateFieldResult {
	if (value === null || typeof value !== "object") return false;
	const record = value as Record<string, unknown>;
	return typeof record.fieldId === "string" && typeof record.contentSha256 === "string";
}

export async function recordTrustedArtifactTemplateField(
	input: RecordTemplateFieldInput,
): Promise<RecordTemplateFieldResult> {
	const client = createTrustedSupabaseClient();
	const { data, error } = await client.rpc("record_artifact_template_field", {
		p_actor_id: input.actorId,
		p_template_id: input.templateId,
		p_field_key: input.fieldKey,
		p_anchor_kind: input.anchorKind,
		p_anchor_selector: input.anchorSelector,
		p_required: input.required,
		p_description: input.description,
	});
	if (error || !isFieldResult(data)) {
		throw new Error("Trusted template field upsert failed.");
	}
	return data;
}

export type SubmitMappingInput = {
	actorId: string;
	templateId: string;
	sourceKind:
		| "CONTRACT_BASELINE"
		| "REQUIREMENT_BASELINE"
		| "WBS_TASK"
		| "INSPECTION"
		| "MEETING_MINUTE"
		| "CLOSE_OUT"
		| "MANUAL_INPUT";
	sourceId: string;
	mapping: Record<string, unknown>;
};

export type SubmitMappingResult = {
	mappingId: string;
	version: number;
	mappingSha256: string;
	fieldCount: number;
};

function isMappingResult(value: unknown): value is SubmitMappingResult {
	if (value === null || typeof value !== "object") return false;
	const record = value as Record<string, unknown>;
	return (
		typeof record.mappingId === "string" &&
		typeof record.version === "number" &&
		typeof record.mappingSha256 === "string" &&
		typeof record.fieldCount === "number"
	);
}

export async function submitTrustedArtifactTemplateMapping(
	input: SubmitMappingInput,
): Promise<SubmitMappingResult> {
	const client = createTrustedSupabaseClient();
	const { data, error } = await client.rpc("submit_artifact_template_mapping", {
		p_actor_id: input.actorId,
		p_template_id: input.templateId,
		p_source_kind: input.sourceKind,
		p_source_id: input.sourceId,
		p_mapping: input.mapping,
	});
	if (error || !isMappingResult(data)) {
		throw new Error("Trusted mapping submit failed.");
	}
	return data;
}

export type ApproveMappingInput = {
	actorId: string;
	mappingId: string;
};

export type ApproveMappingResult = {
	mappingId: string;
	approvedBy: string;
	approvedAt: string;
};

function isApproveResult(value: unknown): value is ApproveMappingResult {
	if (value === null || typeof value !== "object") return false;
	const record = value as Record<string, unknown>;
	return (
		typeof record.mappingId === "string" &&
		typeof record.approvedBy === "string" &&
		typeof record.approvedAt === "string"
	);
}

export async function approveTrustedArtifactTemplateMapping(
	input: ApproveMappingInput,
): Promise<ApproveMappingResult> {
	const client = createTrustedSupabaseClient();
	const { data, error } = await client.rpc("approve_artifact_template_mapping", {
		p_actor_id: input.actorId,
		p_mapping_id: input.mappingId,
	});
	if (error || !isApproveResult(data)) {
		throw new Error("Trusted mapping approval failed.");
	}
	return data;
}

export type GenerateArtifactInput = {
	actorId: string;
	mappingId: string;
	runId: string | null;
	unresolvedRequiredFields: string[];
	validation: { passed: boolean; checks: string[] };
	previewMetadata: Record<string, unknown>;
	storageBucket: string;
	storagePath: string;
	contentSha256: string;
	modelFingerprint: string;
	promptVersion: string;
};

export type GenerateArtifactResult = {
	artifactId: string;
	baselineId: string | null;
	contentSha256: string;
};

function isGenerateResult(value: unknown): value is GenerateArtifactResult {
	if (value === null || typeof value !== "object") return false;
	const record = value as Record<string, unknown>;
	return typeof record.artifactId === "string" && typeof record.contentSha256 === "string";
}

export async function generateTrustedArtifact(
	input: GenerateArtifactInput,
): Promise<GenerateArtifactResult> {
	const client = createTrustedSupabaseClient();
	const { data, error } = await client.rpc("generate_artifact", {
		p_actor_id: input.actorId,
		p_mapping_id: input.mappingId,
		p_run_id: input.runId,
		p_unresolved_required_fields: input.unresolvedRequiredFields,
		p_validation: input.validation,
		p_preview_metadata: input.previewMetadata,
		p_storage_bucket: input.storageBucket,
		p_storage_path: input.storagePath,
		p_content_sha256: input.contentSha256,
		p_model_fingerprint: input.modelFingerprint,
		p_prompt_version: input.promptVersion,
	});
	if (error || !isGenerateResult(data)) {
		throw new Error("Trusted artifact generation failed.");
	}
	return data;
}

export async function approveTrustedArtifact(input: {
	actorId: string;
	artifactId: string;
}): Promise<{ artifactId: string; approvedBy: string; approvedAt: string }> {
	const client = createTrustedSupabaseClient();
	const { data, error } = await client.rpc("approve_artifact", {
		p_actor_id: input.actorId,
		p_artifact_id: input.artifactId,
	});
	if (error || typeof data !== "object" || data === null) {
		throw new Error("Trusted artifact approval failed.");
	}
	const record = data as Record<string, unknown>;
	if (
		typeof record.artifactId !== "string" ||
		typeof record.approvedBy !== "string" ||
		typeof record.approvedAt !== "string"
	) {
		throw new Error("Trusted artifact approval returned a malformed payload.");
	}
	return {
		artifactId: record.artifactId,
		approvedBy: record.approvedBy,
		approvedAt: record.approvedAt,
	};
}
