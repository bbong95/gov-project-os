import { DocumentParseError } from "../../../../../../lib/parsing/document-parser";
import { createParserRegistry } from "../../../../../../lib/parsing/parser-registry";
import { prepareRfpParse } from "../../../../../../lib/parsing/prepare-rfp-parse";
import { createServerSupabaseClient } from "../../../../../../lib/supabase/server";
import { createTrustedSupabaseClient, persistTrustedDocumentParse } from "../../../../../../lib/supabase/trusted-server";
import { SupabasePrivateStorageProvider } from "../../../../../../lib/storage/supabase-private-storage";

type ParseRouteContext = {
	params: Promise<{ projectId: string; documentId: string }>;
};

const ERROR_CODES: Record<string, string> = {
	UNSUPPORTED_FORMAT: "unsupported_format",
	INVALID_TEXT_ENCODING: "invalid_text_encoding",
	EMPTY_SOURCE: "empty_source",
	SOURCE_INTEGRITY_FAILED: "source_integrity_failed",
	PARSE_LIMIT_EXCEEDED: "parse_limit_exceaded", // typo-safe alias below
	PARSE_FAILED: "parse_failed",
};

const PARSE_BACKGROUND_THRESHOLD_BYTES = 1024 * 1024; // 1MB

function redirectToRfp(projectId: string, key: "status" | "error", value: string): Response {
	const search = new URLSearchParams({ [key]: value });
	return new Response(null, {
		status: 303,
		headers: { Location: `/projects/${encodeURIComponent(projectId)}/rfp?${search}` },
	});
}

async function dispatchBackgroundParse(input: {
	projectId: string;
	tenantId: string;
	storageBucket: string;
	storagePath: string;
	sha256: string;
}): Promise<Response | null> {
	const supabaseUrl = process.env.SUPABASE_BACKEND_SECRET_URL ?? "";
	if (!supabaseUrl) return null;
	const token = process.env.GOV_PROJECT_DISPATCH_TOKEN ?? process.env.SUPABASE_BACKEND_SECRET ?? "";
	if (!token) return null;
	// We hit the GitHub REST API to trigger parse-rfp.yml with a
	// personal access token. The user provides this token in the
	// worker env as GOV_PROJECT_DISPATCH_TOKEN. In production this
	// would be replaced with a Cloudflare Queue producer.
	try {
		const res = await fetch(
			"https://api.github.com/repos/bbong95/gov-project-os/actions/workflows/parse-rfp.yml/dispatches",
			{
				method: "POST",
				headers: {
					Accept: "application/vnd.github+json",
					Authorization: `Bearer ${token}`,
					"X-GitHub-Api-Version": "2022-11-28",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					ref: "main",
					inputs: {
						project_id: input.projectId,
						tenant_id: input.tenantId,
						storage_bucket: input.storageBucket,
						storage_path: input.storagePath,
						sha256: input.sha256,
					},
				}),
			},
		);
		if (!res.ok) return null;
	} catch {
		return null;
	}
	return new Response(null, {
		status: 202,
		headers: { "Content-Type": "application/json" },
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
		.select("id, tenant_id, project_id, original_filename, media_type, storage_bucket, storage_path, sha256, byte_size")
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

	const isLargeFile =
		typeof document.byte_size === "number" &&
		document.byte_size > PARSE_BACKGROUND_THRESHOLD_BYTES;

	if (isLargeFile) {
		const dispatched = await dispatchBackgroundParse({
			projectId,
			tenantId: document.tenant_id,
			storageBucket: document.storage_bucket,
			storagePath: document.storage_path,
			sha256: document.sha256,
		});
		if (dispatched) {
			return redirectToRfp(projectId, "status", "parse_dispatched");
		}
		// Fall through to inline parsing if the dispatch token is not
		// configured. The streaming parser keeps the inline path alive
		// for small files.
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
