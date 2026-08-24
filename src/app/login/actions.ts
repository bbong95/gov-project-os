"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../lib/supabase/server";

export async function login(formData: FormData): Promise<never> {
	const emailValue = formData.get("email");
	const passwordValue = formData.get("password");
	const email = typeof emailValue === "string" ? emailValue.trim() : "";
	const password = typeof passwordValue === "string" ? passwordValue : "";

	if (!email || !password) {
		redirect("/login?error=credentials");
	}

	const supabase = await createServerSupabaseClient();
	const { error } = await supabase.auth.signInWithPassword({ email, password });

	if (error) {
		redirect("/login?error=credentials");
	}

	redirect("/projects");
}
