import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { logout } from "@/app/projects/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ProposalPageProps = {
	params: Promise<{ projectId: string; proposalId: string }>;
	searchParams: Promise<{ created?: string | string[] }>;
};

const SECTION_LABELS: Record<string, string> = {
	"compliance-matrix": "RFP 요구사항 매트릭스",
	"proposal-outline": "제안서 목차",
	"evaluation-mapping": "평가 항목 대응",
	"response-strategy": "응답 전략",
	"evidence-and-gap": "근거 및 보완 항목",
};

const SECTION_ORDER: readonly string[] = [
	"compliance-matrix",
	"proposal-outline",
	"evaluation-mapping",
	"response-strategy",
	"evidence-and-gap",
];

function sectionLabel(key: string): string {
	return SECTION_LABELS[key] ?? key;
}

function renderSections(contents: readonly { section_key: string; content_md: string; evidence_candidate_ids: unknown }[]) {
	return contents.map((section) => {
		const lines = section.content_md.split("\n");
		return {
			...section,
			rendered: lines.map((line) => {
				if (line.startsWith("## ")) {
					return { kind: "h4" as const, text: line.slice(3) };
				}
				if (line.startsWith("# ")) {
					return { kind: "h3" as const, text: line.slice(2) };
				}
				if (line.startsWith("- ")) {
					return { kind: "li" as const, text: line.slice(2) };
				}
				if (line.startsWith("| ")) {
					return { kind: "pre" as const, text: line };
				}
				if (line.trim() === "") {
					return { kind: "p" as const, text: "" };
				}
				return { kind: "p" as const, text: line };
			}),
		};
	});
}

function formatEvidence(candidateIds: unknown): string {
	if (!Array.isArray(candidateIds)) {
		return "";
	}
	return candidateIds
		.map((value) => (typeof value === "string" ? value.slice(0, 8) : ""))
		.filter(Boolean)
		.join(", ");
}

export default async function ProposalPage({
	params,
	searchParams,
}: ProposalPageProps) {
	const { projectId, proposalId } = await params;
	const { created } = await searchParams;
	const justCreated = created === "1";
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

	const [proposalResult, sectionsResult] = await Promise.all([
		supabase
			.from("proposals")
			.select("id, version, status, run_id, baseline_id, created_at")
			.eq("id", proposalId)
			.eq("project_id", projectId)
			.maybeSingle(),
		supabase
			.from("proposal_sections")
			.select("section_key, content_md, evidence_candidate_ids")
			.eq("proposal_id", proposalId),
	]);

	if (proposalResult.error || !proposalResult.data) {
		notFound();
	}
	const proposal = proposalResult.data;

	const sortedSections = (sectionsResult.data ?? []).slice().sort(
		(left, right) => {
			const leftIdx = SECTION_ORDER.indexOf(left.section_key);
			const rightIdx = SECTION_ORDER.indexOf(right.section_key);
			if (leftIdx === -1 && rightIdx === -1) {
				return left.section_key.localeCompare(right.section_key);
			}
			if (leftIdx === -1) {
				return 1;
			}
			if (rightIdx === -1) {
				return -1;
			}
			return leftIdx - rightIdx;
		},
	);

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
				<a className="app-skip-link" href="#proposal-content">
					제안서 본문으로 건너뛰기
				</a>
				<Link
					className="krds-btn small text app-back-link"
					href={`/projects/${projectId}/requirements/${proposal.run_id}`}
				>
					Baseline으로 돌아가기
				</Link>
				<p>
					<span className="krds-badge bg-light-secondary">제안서 초안</span>
				</p>
				<h1 className="app-page-title">
					제안서 v{proposal.version} · {project.name}
				</h1>
				<p className="app-page-lead">
					모든 내용은 Requirement Baseline에서 직접 도출되었으며, 회사 실적·자격·재무·인력 정보는
					포함되어 있지 않습니다.
				</p>

				{justCreated ? (
					<p className="app-status-success" role="status">
						제안서 초안이 Requirement Baseline 기반으로 생성되었습니다.
					</p>
				) : null}

				<section
					aria-labelledby="proposal-heading"
					className="app-section"
					id="proposal-content"
					tabIndex={-1}
				>
					<h2 className="app-section-title" id="proposal-heading">
						본문
					</h2>
					<ol className="app-proposal-sections">
						{renderSections(sortedSections).map((section) => (
							<li
								className="app-proposal-section"
								key={section.section_key}
							>
								<h3>{sectionLabel(section.section_key)}</h3>
								<div className="app-proposal-content">
									{section.rendered.map((line, index) => {
										const key = `${section.section_key}-${index}`;
										if (line.kind === "h3") {
											return <h4 key={key}>{line.text}</h4>;
										}
										if (line.kind === "h4") {
											return <h5 key={key}>{line.text}</h5>;
										}
										if (line.kind === "li") {
											return <p key={key}>· {line.text}</p>;
										}
										if (line.kind === "pre") {
											return <pre key={key} className="app-proposal-mono">{line.text}</pre>;
										}
										return <p key={key}>{line.text}</p>;
									})}
								</div>
								<p className="app-muted app-evidence-list">
									근거 후보 ID: {formatEvidence(section.evidence_candidate_ids)}
								</p>
							</li>
						))}
					</ol>
				</section>
			</main>
		</>
	);
}
