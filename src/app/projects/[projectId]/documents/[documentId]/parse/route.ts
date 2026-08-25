import { DocumentParseError } from "../../../../../../lib/parsing/document-parser";
import { createParserRegistry } from "../../../../../../lib/parsing/parser-registry";
import { prepareRfpParse } from "../../../../../../lib/parsing/prepare-rfp-parse";
import { createServerSupabaseClient } from "../../../../../../lib/supabase/server";
import { persistTrustedDocumentParse } from "../../../../../../lib/supabase/trusted-server";
import { SupabasePrivateStorageProvider } from "../../../../../../lib/storage/supabase-private-storage";

type ParseRouteContext = {
	params: Promise<{ projectId: string; documentId: string }>;
};

const ERROR_CODES: Record<string, string> = {
	UNSUPPORTED_FORMAT: "unsupported_format",
	INVALID_TEXT_ENCODING: "invalid_text_encoding",
	EMPTY_SOURCE: "empty_source",
	SOURCE_INTEGRITY_FAILED: "source_integrity_failed",
	PARSE_LIMIT_EXCEEDED: "parse_limit_exceeded",
	PARSE_FAILED: "parse_failed",
};

function redirectToRfp(projectId: string, key: "status" | "error", value: string): Response {
	const search = new URLSearchParams({ [key]: value });
	return new Response(null, {
		status: 303,
		headers: { Location: `/projects/${encodeURIComponent(projectId)}/rfp?${search}` },
	});
}

export async function POST(_request: Request, context: ParseRouteContext): Promise<Response> {
	const { projectId, documentId } = await context.params;
	const supabase = await createServerSupabaseClient();
	const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
	const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";
	if (claimsError || !userId) {
		return new Response(null, { status: 303, headers: { Location: "/login" } });
	}

	const { data: document, error: documentError } = await supabase
		.from("documents")
		.select("id, tenant_id, project_id, original_filename, media_type, storage_bucket, storage_path, sha256")
		.eq("id", documentId)
		.eq("project_id", projectId)
		.eq("document_kind", "RFP")
		.maybeSingle();
	if (documentError || !document) {
		return new Response(null, { status: 404 });
	}

	const [projectMembership, tenantMembership] = await Promise.all([
		supabase
			.from("project_memberships")
			.select("role")
			.eq("project_id", projectId)
			.eq("user_id", userId)
			.maybeSingle(),
		supabase
			.from("tenant_memberships")
			.select("role")
			.eq("tenant_id", document.tenant_id)
			.eq("user_id", userId)
			.maybeSingle(),
	]);
	const canParse =
		projectMembership.data?.role === "EDITOR" ||
		projectMembership.data?.role === "PROJECT_ADMIN" ||
		tenantMembership.data?.role === "TENANT_ADMIN";
	if (projectMembership.error || tenantMembership.error || !canParse) {
		return new Response(null, { status: 404 });
	}

	try {
		const prepared = await prepareRfpParse(
			{
				id: document.id,
				originalFilename: document.original_filename,
				mediaType: document.media_type,
				storageBucket: document.storage_bucket,
				storagePath: document.storage_path,
				sha256: document.sha256,
			},
			new SupabasePrivateStorageProvider(supabase),
			createParserRegistry(),
		);
		const { data: existing, error: existingError } = await supabase
			.from("document_parses")
			.select("id, result_sha256")
			.eq("document_id", document.id)
			.eq("source_sha256", prepared.target_source_sha256)
			.eq("parser_key", prepared.target_parser_key)
			.eq("parser_version", prepared.target_parser_version)
			.eq("normalization_version", prepared.target_normalization_version)
			.maybeSingle();
		if (existingError) {
			return redirectToRfp(projectId, "error", "persist_failed");
		}
		await persistTrustedDocumentParse({ target_actor_user_id: userId, ...prepared });
		const status = existing?.result_sha256 === prepared.target_result_sha256
			? "already_parsed"
			: "parsed";
		return redirectToRfp(projectId, "status", status);
	} catch (error) {
		if (error instanceof DocumentParseError) {
			return redirectToRfp(projectId, "error", ERROR_CODES[error.code] ?? "parse_failed");
		}
		return redirectToRfp(projectId, "error", "persist_failed");
	}
}
