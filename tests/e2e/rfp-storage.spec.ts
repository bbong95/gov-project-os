import { createHash, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
	createLocalRfpFixture,
	type LocalRfpFixture,
} from "./support/local-supabase";

test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

let fixture: LocalRfpFixture;

test.beforeAll(async () => {
	test.setTimeout(180_000);
	fixture = await createLocalRfpFixture();
});

test.afterAll(async () => {
	await fixture?.dispose();
});

test("private RFP original is project isolated and cannot be overwritten", async () => {
	const assignedClient = await fixture.createAssignedClient();
	const crossTenantClient = await fixture.createCrossTenantClient();
	const anonymousClient = fixture.createAnonymousClient();
	const originalBytes = new TextEncoder().encode(
		"M06 synthetic RFP original. No customer information.\n",
	);
	const replacementBytes = new TextEncoder().encode("unauthorized replacement\n");
	const sha256 = createHash("sha256").update(originalBytes).digest("hex");
	const documentId = randomUUID();
	const storagePath = `${fixture.assignedProjectId}/${documentId}/original`;
	fixture.trackStoragePath(storagePath);

	const { error: uploadError } = await assignedClient.storage
		.from("rfp-originals")
		.upload(storagePath, originalBytes, {
			contentType: "text/plain",
			upsert: false,
		});
	expect(uploadError).toBeNull();

	const { error: metadataError } = await assignedClient.from("documents").insert({
		id: documentId,
		tenant_id: fixture.assignedTenantId,
		project_id: fixture.assignedProjectId,
		document_kind: "RFP",
		privacy_classification: "INTERNAL",
		original_filename: "m06-synthetic-rfp.txt",
		media_type: "text/plain",
		byte_size: originalBytes.byteLength,
		storage_bucket: "rfp-originals",
		storage_path: storagePath,
		sha256,
		created_by: fixture.assignedUserId,
	});
	expect(metadataError).toBeNull();

	const { data: assignedDownload, error: assignedDownloadError } =
		await assignedClient.storage.from("rfp-originals").download(storagePath);
	expect(assignedDownloadError).toBeNull();
	expect(assignedDownload).not.toBeNull();
	expect(Buffer.from(await assignedDownload!.arrayBuffer())).toEqual(Buffer.from(originalBytes));

	const { data: crossDownload, error: crossDownloadError } = await crossTenantClient.storage
		.from("rfp-originals")
		.download(storagePath);
	expect(crossDownload).toBeNull();
	expect(crossDownloadError).not.toBeNull();

	const { data: anonymousDownload, error: anonymousDownloadError } =
		await anonymousClient.storage.from("rfp-originals").download(storagePath);
	expect(anonymousDownload).toBeNull();
	expect(anonymousDownloadError).not.toBeNull();

	const { data: assignedList, error: assignedListError } = await assignedClient.storage
		.from("rfp-originals")
		.list(fixture.assignedProjectId);
	expect(assignedListError).toBeNull();
	expect(assignedList).toEqual([]);

	const { data: crossList, error: crossListError } = await crossTenantClient.storage
		.from("rfp-originals")
		.list(fixture.assignedProjectId);
	expect(crossListError).toBeNull();
	expect(crossList).toEqual([]);

	const { error: duplicateError } = await assignedClient.storage
		.from("rfp-originals")
		.upload(storagePath, replacementBytes, {
			contentType: "text/plain",
			upsert: false,
		});
	expect(duplicateError).not.toBeNull();

	const { error: upsertError } = await assignedClient.storage
		.from("rfp-originals")
		.upload(storagePath, replacementBytes, {
			contentType: "text/plain",
			upsert: true,
		});
	expect(upsertError).not.toBeNull();

	const { data: registeredDelete, error: registeredDeleteError } = await assignedClient.storage
		.from("rfp-originals")
		.remove([storagePath]);
	expect(registeredDeleteError).toBeNull();
	expect(registeredDelete).toEqual([]);

	const { data: unchangedDownload, error: unchangedDownloadError } =
		await assignedClient.storage.from("rfp-originals").download(storagePath);
	expect(unchangedDownloadError).toBeNull();
	expect(Buffer.from(await unchangedDownload!.arrayBuffer())).toEqual(Buffer.from(originalBytes));

	const { data: unchangedMetadata, error: unchangedMetadataError } = await assignedClient
		.from("documents")
		.select("sha256")
		.eq("id", documentId)
		.single();
	expect(unchangedMetadataError).toBeNull();
	expect(unchangedMetadata?.sha256).toBe(sha256);

	const orphanDocumentId = randomUUID();
	const orphanPath = `${fixture.assignedProjectId}/${orphanDocumentId}/original`;
	fixture.trackStoragePath(orphanPath);
	const { error: orphanUploadError } = await assignedClient.storage
		.from("rfp-originals")
		.upload(orphanPath, originalBytes, { contentType: "text/plain", upsert: false });
	expect(orphanUploadError).toBeNull();
	const { error: orphanDeleteError } = await assignedClient.storage
		.from("rfp-originals")
		.remove([orphanPath]);
	expect(orphanDeleteError).toBeNull();
	const { data: orphanDownload, error: orphanDownloadError } = await assignedClient.storage
		.from("rfp-originals")
		.download(orphanPath);
	expect(orphanDownload).toBeNull();
	expect(orphanDownloadError).not.toBeNull();
});
