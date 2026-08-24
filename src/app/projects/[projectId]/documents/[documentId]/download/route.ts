import {
	buildDownloadContentDisposition,
} from "../../../../../../lib/documents/rfp-original";
import { createServerSupabaseClient } from "../../../../../../lib/supabase/server";
import { SupabasePrivateStorageProvider } from "../../../../../../lib/storage/supabase-private-storage";

type DownloadRouteContext = {
	params: Promise<{ projectId: string; documentId: string }>;
};

export async function GET(_request: Request, context: DownloadRouteContext): Promise<Response> {
	const { projectId, documentId } = await context.params;
	const supabase = await createServerSupabaseClient();
	const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
	if (claimsError || !claimsData?.claims) {
		return new Response(null, { status: 401 });
	}

	const { data: document, error: documentError } = await supabase
		.from("documents")
		.select("original_filename, storage_bucket, storage_path")
		.eq("id", documentId)
		.eq("project_id", projectId)
		.eq("document_kind", "RFP")
		.maybeSingle();
	if (documentError || !document) {
		return new Response(null, { status: 404 });
	}

	const storage = new SupabasePrivateStorageProvider(supabase);
	let original: Blob;
	try {
		original = await storage.downloadObject(document.storage_bucket, document.storage_path);
	} catch {
		return new Response(null, { status: 404 });
	}

	return new Response(original, {
		status: 200,
		headers: {
			"Cache-Control": "private, no-store",
			"Content-Disposition": buildDownloadContentDisposition(document.original_filename),
			"Content-Length": String(original.size),
			"Content-Type": "application/octet-stream",
			"X-Content-Type-Options": "nosniff",
		},
	});
}
