import type { PrivacyClassification } from "../../../../../lib/documents/rfp-original";
import type { SourceLocation } from "../../../../../lib/parsing/document-parser";
import { createProductionRequirementAiProvider } from "../../../../../lib/ai/openai-responses-provider";
import { extractRequirements } from "../../../../../lib/requirements/extract-requirements";
import { findExistingRequirementRun } from "../../../../../lib/requirements/requirement-queries";
import {
	persistTrustedRequirementExtraction,
	recordTrustedRequirementExtractionOutcome,
} from "../../../../../lib/requirements/trusted-requirement-extraction";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";

type ExtractRouteContext = {
	params: Promise<{ projectId: string }>;
};

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function redirectToRfp(
	projectId: string,
	key: "status" | "error",
	value: string,
	runId?: string,
): Response {
	const search = new URLSearchParams({ [key]: value });
	if (runId) {
		search.set("runId", runId);
	}
	return new Response(null, {
		status: 303,
		headers: {
			Location: "/projects/" + encodeURIComponent(projectId) + "/rfp?" + search,
		},
	});
}

export async function POST(
	request: Request,
	context: ExtractRouteContext,
): Promise<Response> {
	const { projectId } = await context.params;
	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return new Response(null, { status: 404 });
	}
	const keys = [...formData.keys()];
	const documentParseId = formData.get("documentParseId");
	if (
		keys.length !== 1 ||
		keys[0] !== "documentParseId" ||
		typeof documentParseId !== "string" ||
		!UUID_PATTERN.test(documentParseId)
	) {
		return new Response(null, { status: 404 });
	}

	const supabase = await createServerSupabaseClient();
	const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
	const actorId =
		typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";
	if (claimsError || !actorId) {
		return new Response(null, {
			status: 303,
			headers: { Location: "/login" },
		});
	}

	const { data: parse, error: parseError } = await supabase
		.from("document_parses")
		.select(
			"id, tenant_id, project_id, document_id, parser_key, parser_version, normalization_version, result_sha256",
		)
		.eq("id", documentParseId)
		.eq("project_id", projectId)
		.maybeSingle();
	if (parseError || !parse) {
		return new Response(null, { status: 404 });
	}

	const [documentResult, projectMembership, tenantMembership, spansResult] =
		await Promise.all([
			supabase
				.from("documents")
				.select("id, tenant_id, project_id, privacy_classification")
				.eq("id", parse.document_id)
				.eq("project_id", projectId)
				.eq("document_kind", "RFP")
				.maybeSingle(),
			supabase
				.from("project_memberships")
				.select("role")
				.eq("project_id", projectId)
				.eq("user_id", actorId)
				.maybeSingle(),
			supabase
				.from("tenant_memberships")
				.select("role")
				.eq("tenant_id", parse.tenant_id)
				.eq("user_id", actorId)
				.maybeSingle(),
			supabase
				.from("source_spans")
				.select("id, ordinal, location, original_text, normalized_text")
				.eq("tenant_id", parse.tenant_id)
				.eq("project_id", projectId)
				.eq("document_id", parse.document_id)
				.eq("document_parse_id", parse.id)
				.order("ordinal", { ascending: true }),
		]);
	const document = documentResult.data;
	const canExtract =
		projectMembership.data?.role === "EDITOR" ||
		projectMembership.data?.role === "PROJECT_ADMIN" ||
		tenantMembership.data?.role === "TENANT_ADMIN";
	if (
		documentResult.error ||
		projectMembership.error ||
		tenantMembership.error ||
		spansResult.error ||
		!document ||
		!canExtract ||
		document.tenant_id !== parse.tenant_id ||
		document.project_id !== parse.project_id ||
		!spansResult.data ||
		spansResult.data.length === 0
	) {
		return new Response(null, { status: 404 });
	}

	let provider;
	try {
		provider = createProductionRequirementAiProvider();
	} catch {
		return redirectToRfp(projectId, "error", "requirements_failed");
	}

	const result = await extractRequirements(
		{
			actorId,
			privacyClassification:
				document.privacy_classification as PrivacyClassification,
			tenantId: parse.tenant_id,
			projectId: parse.project_id,
			documentId: parse.document_id,
			documentParseId: parse.id,
			parserName: parse.parser_key,
			parserVersion: parse.parser_version,
			normalizationVersion: parse.normalization_version,
			parseResultSha256: parse.result_sha256,
			spans: spansResult.data.map((span) => ({
				id: span.id,
				ordinal: span.ordinal,
				location: span.location as SourceLocation,
				originalText: span.original_text,
				normalizedText: span.normalized_text,
			})),
		},
		{
			provider,
			findExisting: (input) => findExistingRequirementRun(supabase, input),
			persist: persistTrustedRequirementExtraction,
			recordOutcome: recordTrustedRequirementExtractionOutcome,
		},
	);

	switch (result.kind) {
		case "CREATED":
			return redirectToRfp(
				projectId,
				"status",
				"requirements_created",
				result.runId,
			);
		case "REUSED":
			return redirectToRfp(
				projectId,
				"status",
				"requirements_reused",
				result.runId,
			);
		case "BLOCKED":
			return redirectToRfp(
				projectId,
				"status",
				result.decision === "REVIEW_REQUIRED"
					? "requirements_review"
					: "requirements_blocked",
			);
		case "FAILED":
			return redirectToRfp(projectId, "error", "requirements_failed");
	}
}
