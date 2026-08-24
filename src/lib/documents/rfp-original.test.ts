import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
	MAX_RFP_ORIGINAL_BYTES,
	buildDownloadContentDisposition,
	sha256Hex,
	validateRfpOriginal,
} from "./rfp-original";
import { SupabasePrivateStorageProvider } from "../storage/supabase-private-storage";

describe("RFP original validation", () => {
	it("accepts the supported synthetic document extensions with an explicit classification", () => {
		for (const extension of ["pdf", "hwp", "hwpx", "docx", "xlsx", "txt"]) {
			const file = new File(["synthetic"], `synthetic-rfp.${extension}`, {
				type: "application/octet-stream",
			});
			expect(validateRfpOriginal(file, "INTERNAL")).toEqual({
				ok: true,
				value: {
					classification: "INTERNAL",
					mediaType: "application/octet-stream",
					originalFilename: `synthetic-rfp.${extension}`,
					byteSize: 9,
				},
			});
		}
	});

	it("returns fixed errors for missing, empty, oversized, unsupported, and unclassified input", () => {
		expect(validateRfpOriginal(null, "INTERNAL")).toEqual({ ok: false, error: "missing_file" });
		expect(validateRfpOriginal(new File([], "empty.pdf"), "INTERNAL")).toEqual({
			ok: false,
			error: "empty_file",
		});
		expect(
			validateRfpOriginal(
				new File([new Uint8Array(MAX_RFP_ORIGINAL_BYTES + 1)], "large.pdf"),
				"INTERNAL",
			),
		).toEqual({ ok: false, error: "file_too_large" });
		expect(validateRfpOriginal(new File(["x"], "unsafe.exe"), "INTERNAL")).toEqual({
			ok: false,
			error: "unsupported_extension",
		});
		expect(validateRfpOriginal(new File(["x"], "synthetic.pdf"), "UNKNOWN")).toEqual({
			ok: false,
			error: "invalid_classification",
		});
		expect(
			validateRfpOriginal(new File(["x"], `${"a".repeat(252)}.pdf`), "INTERNAL"),
		).toEqual({ ok: false, error: "filename_too_long" });
	});
});

describe("RFP original evidence helpers", () => {
	it("computes the stable lowercase SHA-256 for bytes", async () => {
		const bytes = new TextEncoder().encode("abc");
		expect(await sha256Hex(bytes.buffer)).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
	});

	it("builds a CRLF-safe attachment header while retaining a UTF-8 filename", () => {
		const disposition = buildDownloadContentDisposition('합성"\r\nX-Injected: yes.txt');
		expect(disposition).toContain("attachment;");
		expect(disposition).toContain("filename*=UTF-8''");
		expect(disposition).not.toMatch(/[\r\n]/);
		expect(disposition).not.toContain("%0D");
		expect(disposition).not.toContain("%0A");
	});
});

describe("Supabase private StorageProvider", () => {
	it("uploads only as a new object and exposes authenticated download and compensation removal", async () => {
		const blob = new Blob(["synthetic"]);
		const upload = vi.fn().mockResolvedValue({ data: { path: "path" }, error: null });
		const download = vi.fn().mockResolvedValue({ data: blob, error: null });
		const remove = vi.fn().mockResolvedValue({ data: [], error: null });
		const from = vi.fn().mockReturnValue({ upload, download, remove });
		const client = { storage: { from } } as unknown as SupabaseClient;
		const provider = new SupabasePrivateStorageProvider(client);
		const bytes = new TextEncoder().encode("synthetic").buffer;

		await provider.uploadObject({
			bucket: "rfp-originals",
			path: "project/document/original",
			bytes,
			mediaType: "text/plain",
		});
		expect(upload).toHaveBeenCalledWith("project/document/original", bytes, {
			cacheControl: "0",
			contentType: "text/plain",
			upsert: false,
		});
		expect(await provider.downloadObject("rfp-originals", "project/document/original")).toBe(
			blob,
		);
		await expect(
			provider.removeUnregisteredObject("rfp-originals", "project/document/original"),
		).resolves.toBeUndefined();
		expect(from).toHaveBeenCalledWith("rfp-originals");
	});

	it("does not disclose a raw provider error", async () => {
		const upload = vi.fn().mockResolvedValue({
			data: null,
			error: { message: "raw storage detail must not escape" },
		});
		const client = {
			storage: { from: vi.fn().mockReturnValue({ upload }) },
		} as unknown as SupabaseClient;
		const provider = new SupabasePrivateStorageProvider(client);

		await expect(
			provider.uploadObject({
				bucket: "rfp-originals",
				path: "project/document/original",
				bytes: new ArrayBuffer(1),
				mediaType: "application/octet-stream",
			}),
		).rejects.toThrow("Private Storage upload failed.");
		await expect(
			provider.uploadObject({
				bucket: "rfp-originals",
				path: "project/document/original",
				bytes: new ArrayBuffer(1),
				mediaType: "application/octet-stream",
			}),
		).rejects.not.toThrow("raw storage detail must not escape");
	});
});
