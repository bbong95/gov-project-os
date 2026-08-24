import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const localRequire = createRequire(resolve(process.cwd(), "package.json"));

type LocalStatus = {
	API_URL: string;
	SERVICE_ROLE_KEY: string;
};

export type LocalAuthFixture = {
	email: string;
	password: string;
	assignedProjectName: string;
	crossTenantProjectName: string;
	dispose: () => Promise<void>;
};

function readLocalStatus(): LocalStatus {
	const cliEntry = localRequire.resolve("supabase/dist/supabase.js");
	const result = spawnSync(process.execPath, [cliEntry, "status", "--output", "json"], {
		cwd: process.cwd(),
		encoding: "utf8",
	});

	if (result.status !== 0) {
		throw new Error("Local Supabase must be running for the Auth E2E test.");
	}

	const jsonStart = result.stdout.indexOf("{");
	if (jsonStart < 0) {
		throw new Error("Local Supabase status did not return JSON.");
	}

	const status = JSON.parse(result.stdout.slice(jsonStart)) as Partial<LocalStatus>;
	if (!status.API_URL || !status.SERVICE_ROLE_KEY) {
		throw new Error("Local Supabase status is missing its API URL or service credential.");
	}

	return status as LocalStatus;
}

async function requireSuccess(
	operation: PromiseLike<{ error: { message: string } | null }>,
	label: string,
): Promise<void> {
	const { error } = await operation;
	if (error) {
		throw new Error(`${label}: ${error.message}`);
	}
}

async function cleanupFixture(
	admin: SupabaseClient,
	tenantIds: string[],
	userId: string,
): Promise<void> {
	await admin.from("tenants").delete().in("id", tenantIds);
	await admin.auth.admin.deleteUser(userId);
}

export async function createLocalAuthFixture(): Promise<LocalAuthFixture> {
	const status = readLocalStatus();
	const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});
	const suffix = randomUUID();
	const email = `m05-${suffix}@example.test`;
	const password = `M05-${randomUUID()}-aA1!`;
	const tenantAId = randomUUID();
	const tenantBId = randomUUID();
	const projectAId = randomUUID();
	const projectBId = randomUUID();
	const assignedProjectName = `합성 프로젝트 A ${suffix.slice(0, 8)}`;
	const crossTenantProjectName = `합성 프로젝트 B ${suffix.slice(0, 8)}`;

	const { data: userData, error: userError } = await admin.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
	});
	if (userError || !userData.user) {
		throw new Error(`Synthetic Auth user setup failed: ${userError?.message ?? "missing user"}`);
	}

	const userId = userData.user.id;

	try {
		await requireSuccess(
			admin.from("tenants").insert([
				{ id: tenantAId, name: "합성 기관 A", created_by: userId },
				{ id: tenantBId, name: "합성 기관 B", created_by: userId },
			]),
			"Synthetic tenant setup failed",
		);
		await requireSuccess(
			admin.from("projects").insert([
				{
					id: projectAId,
					tenant_id: tenantAId,
					name: assignedProjectName,
					created_by: userId,
				},
				{
					id: projectBId,
					tenant_id: tenantBId,
					name: crossTenantProjectName,
					created_by: userId,
				},
			]),
			"Synthetic project setup failed",
		);
		await requireSuccess(
			admin.from("project_memberships").insert({
				tenant_id: tenantAId,
				project_id: projectAId,
				user_id: userId,
				role: "VIEWER",
			}),
			"Synthetic membership setup failed",
		);
	} catch (error) {
		await cleanupFixture(admin, [tenantAId, tenantBId], userId);
		throw error;
	}

	return {
		email,
		password,
		assignedProjectName,
		crossTenantProjectName,
		dispose: () => cleanupFixture(admin, [tenantAId, tenantBId], userId),
	};
}
