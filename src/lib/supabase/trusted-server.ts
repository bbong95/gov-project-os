import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { PreparedRfpParse } from "../parsing/prepare-rfp-parse";

export type TrustedDocumentParseInput = PreparedRfpParse & {
	target_actor_user_id: string;
};

function getTrustedSupabaseConfig(): { url: string; backendSecret: string } {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const backendSecret = process.env.SUPABASE_BACKEND_SECRET;
	if (!url || !backendSecret) {
		throw new Error("Trusted Supabase configuration is missing.");
	}
	return { url, backendSecret };
}

export async function persistTrustedDocumentParse(
	input: TrustedDocumentParseInput,
): Promise<string> {
	const { url, backendSecret } = getTrustedSupabaseConfig();
	const client = createClient(url, backendSecret, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
			detectSessionInUrl: false,
		},
	});
	const { data, error } = await client.rpc("persist_document_parse", input);
	if (error || typeof data !== "string") {
		throw new Error("Trusted parse persistence failed.");
	}
	return data;
}
