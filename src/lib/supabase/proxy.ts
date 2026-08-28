import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabasePublicConfig } from "./config";

export async function updateSession(request: NextRequest) {
	try {
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
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const stack = error instanceof Error ? error.stack : undefined;
		console.error("PROXY_UNCAUGHT", message, stack);
		return new NextResponse(
			`PROXY_UNCAUGHT: ${message}${stack ? "\n" + stack : ""}`,
			{ status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
		);
	}
}
