import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const localRequire = createRequire(resolve(process.cwd(), "package.json"));

type LocalStatus = {
	API_URL: string;
	PUBLISHABLE_KEY: string;
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
	if (!status.API_URL || !status.PUBLISHABLE_KEY || !status.SERVICE_ROLE_KEY) {
		throw new Error("Local Supabase status is missing a required local endpoint or credential.");
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

export type LocalRfpFixture = {
	assignedEmail: string;
	assignedPassword: string;
	viewerEmail: string;
	viewerPassword: string;
	assignedProjectName: string;
	crossEmail: string;
	crossPassword: string;
	crossTenantProjectName: string;
	assignedTenantId: string;
	assignedProjectId: string;
	assignedUserId: string;
	viewerUserId: string;
	crossTenantId: string;
	crossTenantProjectId: string;
	trackStoragePath: (path: string) => void;
	createAssignedClient: () => Promise<SupabaseClient>;
	createViewerClient: () => Promise<SupabaseClient>;
	createCrossTenantClient: () => Promise<SupabaseClient>;
	createAnonymousClient: () => SupabaseClient;
	dispose: () => Promise<void>;
};

async function createSignedInClient(
	status: LocalStatus,
	email: string,
	password: string,
): Promise<SupabaseClient> {
	const client = createClient(status.API_URL, status.PUBLISHABLE_KEY, {
		auth: { autoRefreshToken: false, persistSession: false },
	});
	const { error } = await client.auth.signInWithPassword({ email, password });
	if (error) {
		throw new Error(`Synthetic publishable client sign-in failed: ${error.message}`);
	}
	return client;
}

async function cleanupRfpFixture(
	admin: SupabaseClient,
	projectIds: string[],
	tenantIds: string[],
	userIds: string[],
	trackedStoragePaths: Set<string>,
): Promise<void> {
	const { data: documents, error: documentReadError } = await admin
		.from("documents")
		.select("storage_path")
		.in("project_id", projectIds);
	if (documentReadError) {
		throw new Error(`Synthetic document cleanup lookup failed: ${documentReadError.message}`);
	}
	for (const document of documents ?? []) {
		trackedStoragePaths.add(document.storage_path);
	}
	if (trackedStoragePaths.size > 0) {
		await requireSuccess(
			admin.storage.from("rfp-originals").remove([...trackedStoragePaths]),
			"Synthetic Storage cleanup failed",
		);
	}
	await requireSuccess(
		admin.from("requirement_baseline_items").delete().in("project_id", projectIds),
		"Synthetic baseline item cleanup failed",
	);
	await requireSuccess(
		admin.from("proposal_sections").delete().in("project_id", projectIds),
		"Synthetic proposal section cleanup failed",
	);
	await requireSuccess(
		admin.from("proposals").delete().in("project_id", projectIds),
		"Synthetic proposal cleanup failed",
	);
	await requireSuccess(
		admin.from("requirement_baselines").delete().in("project_id", projectIds),
		"Synthetic baseline cleanup failed",
	);
	await requireSuccess(
		admin.from("requirement_candidate_source_spans").delete().in("project_id", projectIds),
		"Synthetic requirement candidate source cleanup failed",
	);
	await requireSuccess(
		admin.from("requirement_candidates").delete().in("project_id", projectIds),
		"Synthetic requirement candidate cleanup failed",
	);
	await requireSuccess(
		admin.from("requirement_extraction_runs").delete().in("project_id", projectIds),
		"Synthetic requirement run cleanup failed",
	);
	await requireSuccess(
		admin.from("source_spans").delete().in("project_id", projectIds),
		"Synthetic source span cleanup failed",
	);
	await requireSuccess(
		admin.from("document_parses").delete().in("project_id", projectIds),
		"Synthetic document parse cleanup failed",
	);
	await requireSuccess(
		admin.from("audit_events").delete().in("project_id", projectIds),
		"Synthetic audit cleanup failed",
	);
	await requireSuccess(
		admin.from("documents").delete().in("project_id", projectIds),
		"Synthetic document cleanup failed",
	);
	await requireSuccess(
		admin.from("tenants").delete().in("id", tenantIds),
		"Synthetic tenant cleanup failed",
	);
	for (const userId of userIds) {
		await admin.auth.admin.deleteUser(userId);
	}
}

export async function createLocalRfpFixture(): Promise<LocalRfpFixture> {
	const status = readLocalStatus();
	const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
		auth: { autoRefreshToken: false, persistSession: false },
	});
	const suffix = randomUUID();
	const assignedEmail = `m06-assigned-${suffix}@example.test`;
	const crossEmail = `m06-cross-${suffix}@example.test`;
	const viewerEmail = `m07-viewer-${suffix}@example.test`;
	const assignedPassword = `M06-A-${randomUUID()}-aA1!`;
	const crossPassword = `M06-B-${randomUUID()}-aA1!`;
	const viewerPassword = `M07-V-${randomUUID()}-aA1!`;
	const assignedTenantId = randomUUID();
	const crossTenantId = randomUUID();
	const assignedProjectId = randomUUID();
	const crossTenantProjectId = randomUUID();
	const trackedStoragePaths = new Set<string>();

	const { data: assignedUserData, error: assignedUserError } =
		await admin.auth.admin.createUser({
			email: assignedEmail,
			password: assignedPassword,
			email_confirm: true,
		});
	if (assignedUserError || !assignedUserData.user) {
		throw new Error(
			`Synthetic assigned user setup failed: ${assignedUserError?.message ?? "missing user"}`,
		);
	}

	const { data: crossUserData, error: crossUserError } = await admin.auth.admin.createUser({
		email: crossEmail,
		password: crossPassword,
		email_confirm: true,
	});
	if (crossUserError || !crossUserData.user) {
		await admin.auth.admin.deleteUser(assignedUserData.user.id);
		throw new Error(
			`Synthetic cross user setup failed: ${crossUserError?.message ?? "missing user"}`,
		);
	}
	const { data: viewerUserData, error: viewerUserError } = await admin.auth.admin.createUser({
		email: viewerEmail,
		password: viewerPassword,
		email_confirm: true,
	});
	if (viewerUserError || !viewerUserData.user) {
		await admin.auth.admin.deleteUser(assignedUserData.user.id);
		await admin.auth.admin.deleteUser(crossUserData.user.id);
		throw new Error(
			`Synthetic viewer user setup failed: ${viewerUserError?.message ?? "missing user"}`,
		);
	}

	const assignedUserId = assignedUserData.user.id;
	const viewerUserId = viewerUserData.user.id;
	const crossUserId = crossUserData.user.id;
	try {
		await requireSuccess(
			admin.from("tenants").insert([
				{ id: assignedTenantId, name: "M06 합성 기관 A", created_by: assignedUserId },
				{ id: crossTenantId, name: "M06 합성 기관 B", created_by: crossUserId },
			]),
			"Synthetic RFP tenant setup failed",
		);
		await requireSuccess(
			admin.from("projects").insert([
				{
					id: assignedProjectId,
					tenant_id: assignedTenantId,
					name: `M06 합성 프로젝트 A ${suffix.slice(0, 8)}`,
					created_by: assignedUserId,
				},
				{
					id: crossTenantProjectId,
					tenant_id: crossTenantId,
					name: `M06 합성 프로젝트 B ${suffix.slice(0, 8)}`,
					created_by: crossUserId,
				},
			]),
			"Synthetic RFP project setup failed",
		);
		await requireSuccess(
			admin.from("project_memberships").insert([
				{
					tenant_id: assignedTenantId,
					project_id: assignedProjectId,
					user_id: assignedUserId,
					role: "EDITOR",
				},
				{
					tenant_id: assignedTenantId,
					project_id: assignedProjectId,
					user_id: viewerUserId,
					role: "VIEWER",
				},
				{
					tenant_id: crossTenantId,
					project_id: crossTenantProjectId,
					user_id: crossUserId,
					role: "EDITOR",
				},
			]),
			"Synthetic RFP membership setup failed",
		);
	} catch (error) {
		await cleanupRfpFixture(
			admin,
			[assignedProjectId, crossTenantProjectId],
			[assignedTenantId, crossTenantId],
			[assignedUserId, viewerUserId, crossUserId],
			trackedStoragePaths,
		);
		throw error;
	}

	return {
		assignedEmail,
		assignedPassword,
		assignedProjectName: `M06 합성 프로젝트 A ${suffix.slice(0, 8)}`,
		viewerEmail,
		viewerPassword,
		crossEmail,
		crossPassword,
		crossTenantProjectName: `M06 합성 프로젝트 B ${suffix.slice(0, 8)}`,
		assignedTenantId,
		assignedProjectId,
		assignedUserId,
		viewerUserId,
		crossTenantId,
		crossTenantProjectId,
		trackStoragePath: (path) => trackedStoragePaths.add(path),
		createAssignedClient: () =>
			createSignedInClient(status, assignedEmail, assignedPassword),
		createViewerClient: () => createSignedInClient(status, viewerEmail, viewerPassword),
		createCrossTenantClient: () => createSignedInClient(status, crossEmail, crossPassword),
		createAnonymousClient: () =>
			createClient(status.API_URL, status.PUBLISHABLE_KEY, {
				auth: { autoRefreshToken: false, persistSession: false },
			}),
		dispose: () =>
			cleanupRfpFixture(
				admin,
				[assignedProjectId, crossTenantProjectId],
				[assignedTenantId, crossTenantId],
				[assignedUserId, viewerUserId, crossUserId],
				trackedStoragePaths,
			),
	};
}
