import type { SupabaseClient } from "@supabase/supabase-js";
import {
	StorageProviderError,
	type StorageProvider,
	type StorageUpload,
} from "./storage-provider";

export class SupabasePrivateStorageProvider implements StorageProvider {
	constructor(private readonly client: SupabaseClient) {}

	async uploadObject(input: StorageUpload): Promise<void> {
		const { error } = await this.client.storage.from(input.bucket).upload(input.path, input.bytes, {
			cacheControl: "0",
			contentType: input.mediaType,
			upsert: false,
		});
		if (error) {
			throw new StorageProviderError("upload");
		}
	}

	async downloadObject(bucket: string, path: string): Promise<Blob> {
		const { data, error } = await this.client.storage.from(bucket).download(path);
		if (error || !data) {
			throw new StorageProviderError("download");
		}
		return data;
	}

	async removeUnregisteredObject(bucket: string, path: string): Promise<void> {
		const { error } = await this.client.storage.from(bucket).remove([path]);
		if (error) {
			throw new StorageProviderError("removal");
		}
	}
}
