"use server";

import { revalidatePath } from "next/cache";

const API = "https://api.github.com";

async function getToken(): Promise<string | null> {
	const t = process.env.GOV_PROJECT_DISPATCH_TOKEN;
	return t && t.length > 0 ? t : null;
}

export type DispatchStatus = {
	state: "queued" | "in_progress" | "completed" | "unknown";
	conclusion: string | null;
	updatedAt: string | null;
	htmlUrl: string;
};

export async function getDispatchStatus(
	runId: string,
): Promise<DispatchStatus | null> {
	const token = await getToken();
	if (!token) return null;
	try {
		const res = await fetch(`${API}/repos/bbong95/gov-project-os/actions/runs/${runId}`, {
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${token}`,
			},
			cache: "no-store",
		});
		if (!res.ok) return null;
		const data = (await res.json()) as {
			status?: string;
			conclusion?: string | null;
			updated_at?: string;
			html_url?: string;
		};
		return {
			state: (data.status as DispatchStatus["state"]) ?? "unknown",
			conclusion: data.conclusion ?? null,
			updatedAt: data.updated_at ?? null,
			htmlUrl: data.html_url ?? "",
		};
	} catch {
		return null;
	}
}

export async function revalidateGenomeAction(projectId: string): Promise<void> {
	revalidatePath(`/projects/${projectId}/genome`);
}
