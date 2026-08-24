import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabasePublicConfig } from "./config";

export async function updateSession(request: NextRequest) {
	let response = NextResponse.next({ request });
	const { url, publishableKey } = getSupabasePublicConfig();
	const supabase = createServerClient(url, publishableKey, {
		cookies: {
			getAll() {
				return request.cookies.getAll();
			},
			setAll(cookiesToSet) {
				cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
				response = NextResponse.next({ request });
				cookiesToSet.forEach(({ name, value, options }) => {
					response.cookies.set(name, value, options);
				});
			},
		},
	});

	const { data, error } = await supabase.auth.getClaims();
	if (error || !data?.claims) {
		const loginUrl = request.nextUrl.clone();
		loginUrl.pathname = "/login";
		loginUrl.search = "";
		return NextResponse.redirect(loginUrl);
	}

	return response;
}
