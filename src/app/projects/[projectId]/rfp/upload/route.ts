import {
	RFP_ORIGINAL_BUCKET,
	buildRfpOriginalStoragePath,
	sha256Hex,
	validateRfpOriginal,
} from "../../../../../lib/documents/rfp-original";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";
import { SupabasePrivateStorageProvider } from "../../../../../lib/storage/supabase-private-storage";

type RfpUploadRouteContext = {
	params: Promise<{ projectId: string }>;
};

function rfpRedirect(
	_request: Request,
	projectId: string,
	result: { status: "uploaded" } | { error: string },
): Response {
	const searchParams = new URLSearchParams();
	if ("status" in result) {
		searchParams.set("status", result.status);
	} else {
		searchParams.set("error", result.error);
	}
	return new Response(null, {
		status: 303,
		headers: {
			Location: "/projects/" + encodeURIComponent(projectId) + "/rfp?" + searchParams.toString(),
		},
	});
}

export async function POST(request: Request, context: RfpUploadRouteContext): Promise<Response> {
	const { projectId } = await context.params;
	const supabase = await createServerSupabaseClient();
	const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
	const userId =
		typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";
	if (claimsError || !userId) {
		return new Response(null, { status: 303, headers: { Location: "/login" } });
	}

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return rfpRedirect(request, projectId, { error: "invalid_request" });
	}

	const fileValue = formData.get("file");
	const classificationValue = formData.get("classification");
	const validation = validateRfpOriginal(fileValue, classificationValue);
	if (!validation.ok) {
		return rfpRedirect(request, projectId, { error: validation.error });
	}

	const { data: project, error: projectError } = await supabase
		.from("projects")
		.select("id, tenant_id")
		.eq("id", projectId)
		.maybeSingle();
	if (projectError || !project) {
		return rfpRedirect(request, projectId, { error: "project_not_found" });
	}

	const file = fileValue as File;
	const bytes = await file.arrayBuffer();
	const sha256 = await sha256Hex(bytes);
	const documentId = crypto.randomUUID();
	const storagePath = buildRfpOriginalStoragePath(projectId, documentId);
	const storage = new SupabasePrivateStorageProvider(supabase);

	try {
		await storage.uploadObject({
			bucket: RFP_ORIGINAL_BUCKET,
			path: storagePath,
			bytes,
			mediaType: validation.value.mediaType,
		});
	} catch {
		return rfpRedirect(request, projectId, { error: "upload_failed" });
	}

	const { error: metadataError } = await supabase.from("documents").insert({
		id: documentId,
		tenant_id: project.tenant_id,
		project_id: projectId,
		document_kind: "RFP",
		privacy_classification: validation.value.classification,
		original_filename: validation.value.originalFilename,
		media_type: validation.value.mediaType,
		byte_size: validation.value.byteSize,
		storage_bucket: RFP_ORIGINAL_BUCKET,
		storage_path: storagePath,
		sha256,
		created_by: userId,
	});
	if (metadataError) {
		try {
			await storage.removeUnregisteredObject(RFP_ORIGINAL_BUCKET, storagePath);
		} catch {
			// An unregistered object is unreadable; later maintenance can remove a failed compensation.
		}
		return rfpRedirect(request, projectId, { error: "metadata_failed" });
	}

	return rfpRedirect(request, projectId, { status: "uploaded" });
}
