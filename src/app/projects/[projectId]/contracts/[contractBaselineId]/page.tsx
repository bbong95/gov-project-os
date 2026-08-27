import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { logout } from "@/app/projects/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ContractPageProps = {
	params: Promise<{ projectId: string; contractBaselineId: string }>;
};

const CHANGE_TYPE_LABELS: Record<string, string> = {
	ADDED: "추가",
	MODIFIED: "변경",
	DELETED: "삭제",
	CONFLICT: "충돌",
};

export default async function ContractPage({ params }: ContractPageProps) {
	const { projectId, contractBaselineId } = await params;
	const supabase = await createServerSupabaseClient();
	const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
	if (claimsError || typeof claimsData?.claims?.sub !== "string") {
		redirect("/login");
	}

	const { data: project } = await supabase
		.from("projects")
		.select("id, name, tenant_id")
		.eq("id", projectId)
		.maybeSingle();
	if (!project) {
		notFound();
	}

	const [contractResult, itemsResult] = await Promise.all([
		supabase
			.from("contract_baselines")
			.select("id, version, change_summary, approved_by, approved_at, run_id, proposal_id")
			.eq("id", contractBaselineId)
			.eq("project_id", projectId)
			.maybeSingle(),
		supabase
			.from("contract_baseline_items")
			.select("change_type, obligation_text, source_requirement_candidate_id")
			.eq("baseline_id", contractBaselineId),
	]);

	if (contractResult.error || !contractResult.data) {
		notFound();
	}
	const contract = contractResult.data;

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
				<a className="app-skip-link" href="#contract-content">
					계약 본문으로 건너뛰기
				</a>
				<Link
					className="krds-btn small text app-back-link"
					href={`/projects/${projectId}/proposals/${contract.proposal_id}`}
				>
					제안서로 돌아가기
				</Link>
				<p>
					<span className="krds-badge bg-light-warning">계약 Baseline</span>
				</p>
				<h1 className="app-page-title">
					Contract Baseline v{contract.version} · {project.name}
				</h1>
				<p className="app-page-lead">{contract.change_summary}</p>

				<section
					aria-labelledby="contract-heading"
					className="app-section"
					id="contract-content"
					tabIndex={-1}
				>
					<h2 className="app-section-title" id="contract-heading">
						변경 의무 항목
					</h2>
					<ol className="app-proposal-sections">
						{(itemsResult.data ?? []).map((item, index) => (
							<li className="app-proposal-section" key={index}>
								<h3>{CHANGE_TYPE_LABELS[item.change_type] ?? item.change_type}</h3>
								<p>{item.obligation_text}</p>
								<p className="app-muted app-evidence-list">
									원본 요구사항 ID:{" "}
									{item.source_requirement_candidate_id
										? item.source_requirement_candidate_id.slice(0, 8)
										: "(없음)"}
								</p>
							</li>
						))}
					</ol>
				</section>
			</main>
		</>
	);
}
