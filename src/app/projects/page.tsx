import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "../../components/AppHeader";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

type LoadResult = { kind: "unauthenticated" } | { kind: "error"; message: string; stack?: string } | { kind: "ok"; projects: { id: string; name: string }[] };

async function loadProjects(): Promise<LoadResult> {
	try {
		const supabase = await createServerSupabaseClient();
		const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
		if (claimsError || !claimsData?.claims) {
			return { kind: "unauthenticated" };
		}
		const { data: projects, error: projectsError } = await supabase
			.from("projects")
			.select("id, name")
			.order("name");
		if (projectsError) {
			return { kind: "error", message: projectsError.message };
		}
		return { kind: "ok", projects: projects ?? [] };
	} catch (error) {
		return {
			kind: "error",
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		};
	}
}

export default async function ProjectsPage() {
	const result = await loadProjects();

	if (result.kind === "unauthenticated") {
		redirect("/login");
	}

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
				<h1 className="app-page-title">내 프로젝트</h1>

				<section aria-labelledby="project-list-heading" className="app-section">
					<h2 className="app-section-title" id="project-list-heading">
						접근 가능한 프로젝트
					</h2>
					{result.kind === "error" ? (
						<>
							<p className="app-alert-danger" role="alert">
								프로젝트를 불러오지 못했습니다: {result.message}
							</p>
							{result.stack ? (
								<pre className="app-source-text" style={{ whiteSpace: "pre-wrap" }}>{result.stack}</pre>
							) : null}
						</>
					) : result.kind === "ok" && result.projects.length > 0 ? (
						<ul className="krds-structured-list type-full">
							{result.projects.map((project) => (
								<li className="structured-item" key={project.id}>
									<div className="in">
										<div className="card-body">
											<Link className="c-text" href={`/projects/${project.id}/rfp`}>
												<p className="c-tit">
													<span className="span">{project.name}</span>
												</p>
												<p className="c-txt">RFP 원본 관리</p>
											</Link>
										</div>
									</div>
								</li>
							))}
						</ul>
					) : (
						<p className="app-muted" role="status">
							접근 가능한 프로젝트가 없습니다.
						</p>
					)}
				</section>
			</main>
		</>
	);
}
