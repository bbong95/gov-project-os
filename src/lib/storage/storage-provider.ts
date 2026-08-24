export type StorageUpload = {
	bucket: string;
	path: string;
	bytes: ArrayBuffer;
	mediaType: string;
};

export interface StorageProvider {
	uploadObject(input: StorageUpload): Promise<void>;
	downloadObject(bucket: string, path: string): Promise<Blob>;
	removeUnregisteredObject(bucket: string, path: string): Promise<void>;
}

export class StorageProviderError extends Error {
	constructor(operation: "upload" | "download" | "removal") {
		super(`Private Storage ${operation} failed.`);
		this.name = "StorageProviderError";
	}
}
