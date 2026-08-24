export const RFP_ORIGINAL_BUCKET = "rfp-originals";
export const MAX_RFP_ORIGINAL_BYTES = 6 * 1024 * 1024;

export const PRIVACY_CLASSIFICATIONS = [
	"PUBLIC",
	"INTERNAL",
	"PERSONAL",
	"SENSITIVE",
	"RESTRICTED",
] as const;

export type PrivacyClassification = (typeof PRIVACY_CLASSIFICATIONS)[number];

export type RfpOriginalValidationError =
	| "missing_file"
	| "empty_file"
	| "file_too_large"
	| "filename_too_long"
	| "unsupported_extension"
	| "invalid_classification";

export type ValidatedRfpOriginal = {
	classification: PrivacyClassification;
	mediaType: string;
	originalFilename: string;
	byteSize: number;
};

type ValidationResult =
	| { ok: true; value: ValidatedRfpOriginal }
	| { ok: false; error: RfpOriginalValidationError };

const SUPPORTED_EXTENSIONS = new Set(["pdf", "hwp", "hwpx", "docx", "xlsx", "txt"]);

function isPrivacyClassification(value: unknown): value is PrivacyClassification {
	return (
		typeof value === "string" &&
		(PRIVACY_CLASSIFICATIONS as readonly string[]).includes(value)
	);
}

export function validateRfpOriginal(file: unknown, classification: unknown): ValidationResult {
	if (!(file instanceof File)) {
		return { ok: false, error: "missing_file" };
	}
	if (file.size === 0) {
		return { ok: false, error: "empty_file" };
	}
	if (file.size > MAX_RFP_ORIGINAL_BYTES) {
		return { ok: false, error: "file_too_large" };
	}
	if (file.name.length > 255) {
		return { ok: false, error: "filename_too_long" };
	}
	const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "";
	if (!extension || !SUPPORTED_EXTENSIONS.has(extension)) {
		return { ok: false, error: "unsupported_extension" };
	}
	if (!isPrivacyClassification(classification)) {
		return { ok: false, error: "invalid_classification" };
	}

	return {
		ok: true,
		value: {
			classification,
			mediaType: file.type.trim() || "application/octet-stream",
			originalFilename: file.name,
			byteSize: file.size,
		},
	};
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

export function buildRfpOriginalStoragePath(projectId: string, documentId: string): string {
	return `${projectId}/${documentId}/original`;
}

export function buildDownloadContentDisposition(filename: string): string {
	const sanitized = filename.replace(/[\u0000-\u001f\u007f]/g, "").trim() || "download";
	const asciiFallback =
		sanitized
			.normalize("NFKD")
			.replace(/[^\x20-\x7e]/g, "_")
			.replace(/["\\]/g, "_")
			.slice(0, 180) || "download";
	const encoded = encodeURIComponent(sanitized).replace(/[!'()*]/g, (character) =>
		`%${character.charCodeAt(0).toString(16).toUpperCase()}`,
	);

	return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
