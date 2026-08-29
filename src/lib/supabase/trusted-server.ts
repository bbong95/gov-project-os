import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { PreparedRfpParse } from "../parsing/prepare-rfp-parse";

export type TrustedDocumentParseInput = PreparedRfpParse & {
	target_actor_user_id: string;
};

type TrustedEnv = {
	NEXT_PUBLIC_SUPABASE_URL?: string;
	SUPABASE_BACKEND_SECRET?: string;
};

function readTrustedEnv(): TrustedEnv {
	const env: TrustedEnv = {};
	try {
		const ctx = getCloudflareContext({ async: false });
		const cfEnv = (ctx as { env?: { get?: (k: string) => unknown } } | null)?.env;
		if (cfEnv && typeof cfEnv.get === "function") {
			env.NEXT_PUBLIC_SUPABASE_URL =
				typeof cfEnv.get("NEXT_PUBLIC_SUPABASE_URL") === "string"
					? (cfEnv.get("NEXT_PUBLIC_SUPABASE_URL") as string)
					: undefined;
			env.SUPABASE_BACKEND_SECRET =
				typeof cfEnv.get("SUPABASE_BACKEND_SECRET") === "string"
					? (cfEnv.get("SUPABASE_BACKEND_SECRET") as string)
					: undefined;
		}
	} catch {
		// fall through to process.env when not running on Cloudflare (dev)
	}
	if (!env.NEXT_PUBLIC_SUPABASE_URL) {
		env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
	}
	if (!env.SUPABASE_BACKEND_SECRET) {
		env.SUPABASE_BACKEND_SECRET = process.env.SUPABASE_BACKEND_SECRET;
	}
	return env;
}

function getTrustedSupabaseConfig(): { url: string; backendSecret: string } {
	const env = readTrustedEnv();
	const url = env.NEXT_PUBLIC_SUPABASE_URL;
	const backendSecret = env.SUPABASE_BACKEND_SECRET;
	if (!url || !backendSecret) {
		throw new Error("Trusted Supabase configuration is missing.");
	}
	return { url, backendSecret };
}

export function createTrustedSupabaseClient(): SupabaseClient {
	const { url, backendSecret } = getTrustedSupabaseConfig();
	return createClient(url, backendSecret, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
			detectSessionInUrl: false,
		},
	});
}

export async function persistTrustedDocumentParse(
	input: TrustedDocumentParseInput,
): Promise<string> {
	const client = createTrustedSupabaseClient();
	const { data, error } = await client.rpc("persist_document_parse", input);
	if (error || typeof data !== "string") {
		throw new Error("Trusted parse persistence failed.");
	}
	return data;
}
