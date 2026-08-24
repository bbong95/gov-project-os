import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { logout } from "./actions";

export default async function ProjectsPage() {
	const supabase = await createServerSupabaseClient();
	const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

	if (claimsError || !claimsData?.claims) {
		redirect("/login");
	}

	const { data: projects, error: projectsError } = await supabase
		.from("projects")
		.select("id, name")
		.order("name");

	return (
		<main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-12">
			<header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-300 pb-6">
				<div className="space-y-1">
					<p className="text-sm font-medium text-blue-800">GOV Project OS</p>
					<h1 className="text-3xl font-semibold tracking-tight">내 프로젝트</h1>
				</div>
				<form action={logout}>
					<button
						className="min-h-11 rounded-md border border-slate-600 bg-white px-4 py-2 font-semibold text-slate-950 hover:bg-slate-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
						type="submit"
					>
						로그아웃
					</button>
				</form>
			</header>

			<section aria-labelledby="project-list-heading" className="py-8">
				<h2 className="text-xl font-semibold" id="project-list-heading">
					접근 가능한 프로젝트
				</h2>
				{projectsError ? (
					<p className="mt-4 rounded-md border border-red-700 bg-red-50 p-3 text-red-900" role="alert">
						프로젝트를 불러오지 못했습니다.
					</p>
				) : projects && projects.length > 0 ? (
					<ul className="mt-4 grid gap-3">
						{projects.map((project) => (
							<li className="rounded-md border border-slate-300 bg-white p-4 font-medium" key={project.id}>
								{project.name}
							</li>
						))}
					</ul>
				) : (
					<p className="mt-4 text-slate-700" role="status">
						접근 가능한 프로젝트가 없습니다.
					</p>
				)}
			</section>
		</main>
	);
}
