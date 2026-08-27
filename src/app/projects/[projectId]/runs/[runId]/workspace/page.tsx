import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logout } from "@/app/projects/actions";

type WorkspacePageProps = {
	params: Promise<{ projectId: string; runId: string }>;
};

export default async function WorkspacePage({ params }: WorkspacePageProps) {
	const { projectId, runId } = await params;
	const supabase = await createServerSupabaseClient();
	const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
	if (claimsError || typeof claimsData?.claims?.sub !== "string") {
		redirect("/login");
	}

	const [projectResult, tasksResult, meetingsResult, risksResult, inspectionsResult, closeoutResult] =
		await Promise.all([
			supabase.from("projects").select("id, name, tenant_id").eq("id", projectId).maybeSingle(),
			supabase.from("wbs_tasks").select("id, title, owner, due_date, requirement_candidate_id").eq("run_id", runId).order("title"),
			supabase.from("meetings").select("id, title, held_at, status").eq("run_id", runId).order("held_at", { ascending: false }),
			supabase.from("risks").select("id, title, severity, status, approved_at").eq("run_id", runId).order("severity"),
			supabase.from("inspections").select("id, criterion, method, result, inspected_at").eq("run_id", runId).order("inspected_at", { ascending: false }),
			supabase.from("closeouts").select("id, final_accepted, security_terminated, approved_at").eq("run_id", runId).maybeSingle(),
		]);

	if (projectResult.error || !projectResult.data) {
		notFound();
	}
	const project = projectResult.data;

	return (
		<>
			<AppHeader
				actions={
					<form action={logout}>
						<button className="krds-btn small secondary" type="submit">
							로그아웃
						</button>
					</form>
				}
			/>
			<main className="app-inner app-page">
				<a className="app-skip-link" href="#workspace-content">
					작업 영역 본문으로 건너뛰기
				</a>
				<Link
					className="krds-btn small text app-back-link"
					href={`/projects/${projectId}/rfp`}
				>
					RFP 목록으로 돌아가기
				</Link>
				<h1 className="app-page-title">
					작업 영역 · {project.name} (M15~M20 통합 보기)
				</h1>
				<p className="app-page-lead">
					WBS, 회의록, 리스크/이슈/변경, 검사/근거, Closeout 항목을 Requirement
					Baseline에서 도출된 run 단위로 추적합니다.
				</p>

				<section
					aria-labelledby="workspace-heading"
					className="app-section"
					id="workspace-content"
					tabIndex={-1}
				>
					<h2 className="app-section-title" id="workspace-heading">
						WBS 작업 (M15)
					</h2>
					<ul className="app-span-list">
						{(tasksResult.data ?? []).map((task) => (
							<li className="app-evidence-item" key={task.id}>
								<p>{task.title}</p>
								<p className="app-muted">
									담당: {task.owner ?? "미배정"} · 마감: {task.due_date ?? "미정"} ·
									원본 요구:{" "}
									{task.requirement_candidate_id
										? task.requirement_candidate_id.slice(0, 8)
										: "(없음)"}
								</p>
							</li>
						))}
					</ul>
				</section>

				<section
					aria-labelledby="meetings-heading"
					className="app-section"
				>
					<h2 className="app-section-title" id="meetings-heading">
						회의록 (M17)
					</h2>
					<ul className="app-span-list">
						{(meetingsResult.data ?? []).map((meeting) => (
							<li className="app-evidence-item" key={meeting.id}>
								<p>{meeting.title}</p>
								<p className="app-muted">
									{new Date(meeting.held_at).toISOString()} · {meeting.status}
								</p>
							</li>
						))}
					</ul>
				</section>

				<section
					aria-labelledby="risks-heading"
					className="app-section"
				>
					<h2 className="app-section-title" id="risks-heading">
						리스크 / 이슈 / 변경 (M18)
					</h2>
					<ul className="app-span-list">
						{(risksResult.data ?? []).map((risk) => (
							<li className="app-evidence-item" key={risk.id}>
								<p>{risk.title}</p>
								<p className="app-muted">
									심각도: {risk.severity} · 상태: {risk.status} · 사람 승인:{" "}
									{risk.approved_at ? "완료" : "대기"}
								</p>
							</li>
						))}
					</ul>
				</section>

				<section
					aria-labelledby="inspections-heading"
					className="app-section"
				>
					<h2 className="app-section-title" id="inspections-heading">
						검사 / 근거 (M19)
					</h2>
					<ul className="app-span-list">
						{(inspectionsResult.data ?? []).map((inspection) => (
							<li className="app-evidence-item" key={inspection.id}>
								<p>{inspection.criterion}</p>
								<p className="app-muted">
									방법: {inspection.method} · 결과: {inspection.result}
								</p>
							</li>
						))}
					</ul>
				</section>

				<section
					aria-labelledby="closeout-heading"
					className="app-section"
				>
					<h2 className="app-section-title" id="closeout-heading">
						Closeout / 지식 재사용 (M20)
					</h2>
					{closeoutResult.data ? (
						<dl className="app-meta-grid">
							<dt>최종 인수</dt>
							<dd>{closeoutResult.data.final_accepted ? "예" : "아니오"}</dd>
							<dt>보안 종료</dt>
							<dd>{closeoutResult.data.security_terminated ? "예" : "아니오"}</dd>
							<dt>사람 승인</dt>
							<dd>{closeoutResult.data.approved_at ? "완료" : "대기"}</dd>
						</dl>
					) : (
						<p className="app-muted">아직 Closeout 기록이 없습니다.</p>
					)}
				</section>
			</main>
		</>
	);
}
