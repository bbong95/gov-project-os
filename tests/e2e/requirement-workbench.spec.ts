import { expect, test, type Page } from "@playwright/test";
import {
	createLocalRfpFixture,
	type LocalRfpFixture,
} from "./support/local-supabase";

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const STUB_URL = "http://127.0.0.1:4319";
const SOURCE = [
	"○ SER-001 사업자는 사용자 접근권한을 최소권한 원칙에 따라 관리하여야 한다.",
	"",
	"○ PMR-001 사업자는 주간 업무보고를 수행하여야 한다.",
	"",
	"○ PSR-001 사업자는 교육 및 기술지원을 제공하여야 한다.",
].join(String.fromCharCode(10));

let fixture: LocalRfpFixture;
let allowedRunHref = "";

async function login(page: Page, email: string, password: string): Promise<void> {
	await page.goto("/login");
	await page.getByLabel("이메일").fill(email);
	await page.getByLabel("비밀번호").fill(password);
	await page.getByRole("button", { name: "로그인" }).press("Enter");
	await expect(page).toHaveURL(new RegExp("/projects$"), { timeout: 30_000 });
}

async function stubState(): Promise<{ callCount: number }> {
	const response = await fetch(STUB_URL + "/__state");
	expect(response.ok).toBe(true);
	return response.json();
}

async function uploadParseAndExtract(
	page: Page,
	filename: string,
): Promise<void> {
	const rfpUrl = "/projects/" + fixture.assignedProjectId + "/rfp";
	let uploaded = false;
	for (let attempt = 0; attempt < 2 && !uploaded; attempt++) {
		await page.goto(rfpUrl);
		await page.getByLabel("RFP 원본 파일").setInputFiles({
			name: filename,
			mimeType: "text/plain",
			buffer: Buffer.from(SOURCE, "utf8"),
		});
		await page.getByLabel("자료 분류").selectOption("INTERNAL");
		await page.getByRole("button", { name: "RFP 원본 업로드" }).press("Enter");
		uploaded = await page
			.waitForURL(/status=uploaded$/, { timeout: 60_000 })
			.then(
				() => true,
				() => false,
			);
	}
	expect(uploaded, "upload should complete").toBe(true);

	let parsed = false;
	for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
		if (attempt > 0) {
			await page.goto(rfpUrl);
		}
		await page
			.getByRole("button", { name: filename + " 파싱 시작" })
			.press("Enter");
		parsed = await page
			.waitForURL(/status=parsed$/, { timeout: 60_000 })
			.then(
				() => true,
				() => false,
			);
	}
	expect(parsed, "parse should complete").toBe(true);

	let extracted = false;
	for (let attempt = 0; attempt < 2 && !extracted; attempt++) {
		if (attempt > 0) {
			await page.goto(rfpUrl);
		}
		await page
			.getByRole("button", { name: filename + " 요구사항 추출" })
			.press("Enter");
		extracted = await page
			.waitForURL(/status=requirements_created/, { timeout: 60_000 })
			.then(
				() => true,
				() => false,
			);
	}
	expect(extracted, "extraction should complete").toBe(true);

	const resultLink = page.getByRole("link", {
		name: filename + " AI 초안 결과 보기",
	});
	allowedRunHref = (await resultLink.getAttribute("href"))!;
}

function candidateCard(page: Page, label: string) {
	return page.getByRole("article", { name: label });
}

test.beforeAll(async () => {
	test.setTimeout(120_000);
	fixture = await createLocalRfpFixture();
	});

test.afterAll(async () => {
	test.setTimeout(120_000);
	await fixture?.dispose();
});

test("editor approves, source-verifies, flags, and rejects candidates by keyboard", async ({
	page,
}) => {
	await login(page, fixture.assignedEmail, fixture.assignedPassword);
	await uploadParseAndExtract(page, "m10-workbench-synthetic-rfp.txt");
	expect(allowedRunHref).toMatch(/\/requirements\/[0-9a-f-]{36}$/);

	await page.goto(allowedRunHref);

	const first = candidateCard(page, "요구사항 후보 1 SER-001");
	await expect(first.getByText("AI 초안", { exact: true })).toBeVisible();

	// Approve candidate 1 by keyboard.
	await first.getByRole("button", { name: "후보 1 승인" }).focus();
	await page.keyboard.press("Enter");
	await page.waitForURL(/review=approved/);
	await expect(
		candidateCard(page, "요구사항 후보 1 SER-001").getByText("사람 확인됨", {
			exact: true,
		}),
	).toBeVisible();

	// Mark candidate 2 as source verified.
	const second = candidateCard(page, "요구사항 후보 2 PMR-001");
	await second.getByRole("button", { name: "후보 2 원문 확인" }).focus();
	await page.keyboard.press("Enter");
	await page.waitForURL(/review=source_verified/);
	await expect(
		candidateCard(page, "요구사항 후보 2 PMR-001").getByText("원문 확인됨", {
			exact: true,
		}),
	).toBeVisible();

	// Flag candidate 3 for review.
	const third = candidateCard(page, "요구사항 후보 3 식별자 없음");
	await third.getByRole("button", { name: "후보 3 검토 필요" }).focus();
	await page.keyboard.press("Enter");
	await page.waitForURL(/review=needs_review/);
	await expect(
		candidateCard(page, "요구사항 후보 3 식별자 없음")
			.getByText("검토 필요", { exact: true })
			.first(),
	).toBeVisible();

	// Reject candidate 3.
	await candidateCard(page, "요구사항 후보 3 식별자 없음")
		.getByRole("button", { name: "후보 3 반려" })
		.focus();
	await page.keyboard.press("Enter");
	await page.waitForURL(/review=rejected/);
	await expect(
		candidateCard(page, "요구사항 후보 3 식별자 없음").getByText("반려됨", {
			exact: true,
		}),
	).toBeVisible();

	// Rejected candidates expose no further actions.
	expect(
		await candidateCard(page, "요구사항 후보 3 식별자 없음")
			.getByRole("button")
			.count(),
	).toBe(0);

	expect(await stubState()).toMatchObject({ callCount: 1 });
});

test("editor edits an interpretation and the edit is human verified", async ({
	page,
}) => {
	await login(page, fixture.assignedEmail, fixture.assignedPassword);
	await page.goto(allowedRunHref);

	const second = candidateCard(page, "요구사항 후보 2 PMR-001");
	await second
		.getByLabel("후보 2 해석 편집")
		.fill("주간 업무보고를 수행하고 결과를 공유해야 한다.");
	await second.getByRole("button", { name: "후보 2 편집 저장" }).focus();
	await page.keyboard.press("Enter");
	await page.waitForURL(/review=edited/);

	const edited = candidateCard(page, "요구사항 후보 2 PMR-001");
	await expect(
		edited
			.getByText("주간 업무보고를 수행하고 결과를 공유해야 한다.", {
				exact: true,
			})
			.first(),
	).toBeVisible();
	await expect(
		edited.getByText("사람 확인됨", { exact: true }),
	).toBeVisible();
});

test("editor merges two candidates into one human-verified candidate", async ({
	page,
}) => {
	await login(page, fixture.assignedEmail, fixture.assignedPassword);
	await page.goto(allowedRunHref);

	await candidateCard(page, "요구사항 후보 1 SER-001")
		.getByText("후보 1 병합 선택", { exact: true }).click();
	await candidateCard(page, "요구사항 후보 2 PMR-001")
		.getByText("후보 2 병합 선택", { exact: true }).click();
	await page
		.getByLabel("병합 해석")
		.fill("접근권한 최소권한 원칙과 주간 보고를 함께 수행한다.");
	await page.getByRole("button", { name: "선택한 후보 병합" }).focus();
	await page.keyboard.press("Enter");
	await page.waitForURL(/review=merged/);

	const merged = page
		.getByRole("article")
		.filter({
			hasText: "접근권한 최소권한 원칙과 주간 보고를 함께 수행한다.",
		});
	await expect(merged).toHaveCount(1);
	await expect(
		merged
			.getByText("접근권한 최소권한 원칙과 주간 보고를 함께 수행한다.", {
				exact: true,
			})
			.first(),
	).toBeVisible();
	await expect(merged.getByText("사람 확인됨", { exact: true })).toBeVisible();

	await expect(
		candidateCard(page, "요구사항 후보 1 SER-001").getByText("반려됨", {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		candidateCard(page, "요구사항 후보 1 SER-001").getByRole("button"),
	).toHaveCount(0);
});

test("editor splits a multi-evidence candidate into two human-verified parts", async ({
	page,
}) => {
	await login(page, fixture.assignedEmail, fixture.assignedPassword);
	await page.goto(allowedRunHref);

	const merged = page
		.getByRole("article")
		.filter({
			hasText: "접근권한 최소권한 원칙과 주간 보고를 함께 수행한다.",
		});
	await merged.getByLabel(/분할 새 해석/).fill("주간 보고 요구로 분할");
	await merged.getByRole("button", { name: /분할 실행/ }).focus();
	await page.keyboard.press("Enter");
	await page.waitForURL(/review=split/);

	await expect(
		page
			.getByRole("article")
			.filter({ hasText: "주간 보고 요구로 분할" }),
	).toHaveCount(1);
	await expect(
		page
			.getByRole("article")
			.filter({
				hasText: "접근권한 최소권한 원칙과 주간 보고를 함께 수행한다.",
			})
			.filter({ hasText: "반려됨" }),
	).toHaveCount(1);
});

test("editor creates an immutable requirement baseline and re-creating adds a version", async ({
	page,
}) => {
	await login(page, fixture.assignedEmail, fixture.assignedPassword);
	await page.goto(allowedRunHref);

	async function currentBaselineVersion(): Promise<number | null> {
		const heading = page.getByRole("heading", {
			name: /요구사항 Baseline v\d+/,
		});
		if ((await heading.count()) === 0) {
			return null;
		}
		const text = (await heading.textContent()) ?? "";
		const match = text.match(/v(\d+)/);
		return match ? Number(match[1]) : null;
	}

	await page.getByRole("button", { name: "요구사항 Baseline 생성" }).focus();
	await page.keyboard.press("Enter");
	await page.waitForURL(/review=created/);
	const versionBefore = await currentBaselineVersion();
	expect(versionBefore).not.toBeNull();

	const baselineSection = page
		.getByRole("region", { name: new RegExp("요구사항 Baseline v" + versionBefore) });
	await expect(baselineSection).toBeVisible();
	await expect(
		baselineSection.getByText(/^[0-9a-f]{64}$/).first(),
	).toBeVisible();

	// Re-creating never mutates an existing version; it appends the next one.
	await page.getByRole("button", { name: "요구사항 Baseline 생성" }).focus();
	await page.keyboard.press("Enter");
	await expect
		.poll(async () => currentBaselineVersion(), { timeout: 30_000 })
		.toBeGreaterThan(versionBefore!);
	const versionAfter = await currentBaselineVersion();
	expect(versionAfter).not.toBeNull();
	expect(versionAfter!).toBeGreaterThan(versionBefore!);
});

test("editor drafts a proposal draft sourced only from the approved baseline", async ({
	page,
}) => {
	await login(page, fixture.assignedEmail, fixture.assignedPassword);
	await page.goto(allowedRunHref);

	const baselineHeading = page
		.getByRole("heading", { name: /요구사항 Baseline v\d+/ });
	await expect(baselineHeading).toBeVisible();

	await page.getByRole("button", { name: "제안서 초안 생성" }).focus();
	await page.keyboard.press("Enter");
	await page.waitForURL(/\/proposals\//);

	await expect(
		page.getByRole("heading", { level: 1, name: /제안서 v\d+/ }),
	).toBeVisible();
	await expect(
		page.getByRole("status", { name: /생성되었습니다/ }),
	).toBeVisible();
	const expectedSections = [
		"RFP 요구사항 매트릭스",
		"제안서 목차",
		"평가 항목 대응",
		"응답 전략",
		"근거 및 보완 항목",
	];
	for (const label of expectedSections) {
		await expect(
			page.getByRole("heading", { level: 3, name: label }),
		).toBeVisible();
	}
	await expect(
		page.getByText(/회사 실적·인증·재무|정량적 경쟁력|도출되었습니다/),
	).toBeVisible();
});

test("viewer sees the workbench read-only without any review control", async ({
	page,
}) => {
	await login(page, fixture.viewerEmail, fixture.viewerPassword);
	await page.goto(allowedRunHref);
	await expect(
		page.getByRole("heading", { level: 1, name: "요구사항 AI 초안" }),
	).toBeVisible();
	await expect(page.getByRole("article").getByRole("button")).toHaveCount(0);
	await expect(page.getByRole("article").getByRole("checkbox")).toHaveCount(0);
	await expect(page.getByLabel("병합 해석")).toHaveCount(0);
});

test("anonymous users are redirected to login and the AI stub stays unused", async ({
	page,
}) => {
	await page.context().clearCookies();
	await page.goto(allowedRunHref);
	await expect(page).toHaveURL(new RegExp("/login$"));
	expect(await stubState()).toMatchObject({ callCount: 1 });
});
