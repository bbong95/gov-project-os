import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
	MAX_RFP_ORIGINAL_BYTES,
	PRIVACY_CLASSIFICATIONS,
	type PrivacyClassification,
} from "../../../../lib/documents/rfp-original";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

type RfpPageProps = {
	params: Promise<{ projectId: string }>;
	searchParams: Promise<{
		status?: string | string[];
		error?: string | string[];
	}>;
};

const CLASSIFICATION_LABELS: Record<PrivacyClassification, string> = {
	PUBLIC: "공개",
	INTERNAL: "내부",
	PERSONAL: "개인정보 포함",
	SENSITIVE: "민감정보 포함",
	RESTRICTED: "제한자료",
};

const ERROR_MESSAGES: Record<string, string> = {
	invalid_request: "업로드 요청을 읽지 못했습니다.",
	missing_file: "업로드할 RFP 원본 파일을 선택하세요.",
	empty_file: "빈 파일은 업로드할 수 없습니다.",
	file_too_large: "파일 크기는 6 MiB 이하여야 합니다.",
	filename_too_long: "파일 이름은 255자 이하여야 합니다.",
	unsupported_extension: "PDF, HWP, HWPX, DOCX, XLSX, TXT 파일만 업로드할 수 있습니다.",
	invalid_classification: "자료 분류를 선택하세요.",
	project_not_found: "접근 가능한 프로젝트를 찾지 못했습니다.",
	upload_failed: "업로드 권한과 파일 상태를 확인하세요.",
	metadata_failed: "문서 기록을 완료하지 못했습니다. 다시 시도하세요.",
	unsupported_format: "현재 이 파일 형식은 파싱할 수 없습니다.",
	invalid_text_encoding: "TXT 원본이 올바른 UTF-8 형식이 아닙니다.",
	empty_source: "파싱할 원문 내용이 없습니다.",
	source_integrity_failed: "저장된 원본의 무결성을 확인하지 못했습니다.",
	parse_limit_exceeded: "원문이 현재 파싱 안전 한도를 초과했습니다.",
	parse_failed: "원본을 파싱하지 못했습니다.",
	persist_failed: "파싱 결과를 안전하게 보관하지 못했습니다.",
};

const STATUS_MESSAGES: Record<string, string> = {
	uploaded: "RFP 원본을 안전하게 저장했습니다.",
	parsed: "RFP 원본 파싱을 완료했습니다.",
	already_parsed: "동일한 파싱 결과가 이미 보관되어 있습니다.",
};

export default async function RfpPage({ params, searchParams }: RfpPageProps) {
	const { projectId } = await params;
	const resultParams = await searchParams;
	const supabase = await createServerSupabaseClient();
	const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
	const userId =
		typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";
	if (claimsError || !userId) {
		redirect("/login");
	}

	const { data: project, error: projectError } = await supabase
		.from("projects")
		.select("id, tenant_id, name")
		.eq("id", projectId)
		.maybeSingle();
	if (projectError || !project) {
		notFound();
	}

	const [projectMembershipResult, tenantMembershipResult, documentResult, parseResult] = await Promise.all([
		supabase
			.from("project_memberships")
			.select("role")
			.eq("project_id", projectId)
			.eq("user_id", userId)
			.maybeSingle(),
		supabase
			.from("tenant_memberships")
			.select("role")
			.eq("tenant_id", project.tenant_id)
			.eq("user_id", userId)
			.maybeSingle(),
		supabase
			.from("documents")
			.select(
				"id, original_filename, privacy_classification, byte_size, sha256, created_at",
			)
			.eq("project_id", projectId)
			.eq("document_kind", "RFP")
			.order("created_at", { ascending: false }),
		supabase
			.from("document_parses")
			.select("document_id, created_at")
			.eq("project_id", projectId)
			.order("created_at", { ascending: false }),
	]);
	const canUpload =
		projectMembershipResult.data?.role === "EDITOR" ||
		projectMembershipResult.data?.role === "PROJECT_ADMIN" ||
		tenantMembershipResult.data?.role === "TENANT_ADMIN";
	const statusCode = typeof resultParams.status === "string" ? resultParams.status : null;
	const statusMessage = statusCode ? STATUS_MESSAGES[statusCode] : null;
	const errorCode = typeof resultParams.error === "string" ? resultParams.error : null;
	const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] : null;
	const parsedDocumentIds = new Set(
		(parseResult.data ?? []).map((parse) => parse.document_id),
	);

	return (
		<main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-12">
			<header className="space-y-3 border-b border-slate-300 pb-6">
				<Link
					className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-800 underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
					href="/projects"
				>
					내 프로젝트로 돌아가기
				</Link>
				<p className="text-sm font-medium text-slate-700">{project.name}</p>
				<h1 className="text-3xl font-semibold tracking-tight">RFP 원본</h1>
				<p className="leading-7 text-slate-700">
					원본은 비공개 불변 자료로 보관됩니다. 검증 가능한 형식은 AI 없이 파싱해 원문 증거를 분리 보관합니다.
				</p>
			</header>

			{statusMessage ? (
				<p className="mt-6 rounded-md border border-green-700 bg-green-50 p-3 text-green-950" role="status">
					{statusMessage}
				</p>
			) : null}
			{errorMessage ? (
				<p className="mt-6 rounded-md border border-red-700 bg-red-50 p-3 text-red-950" role="alert">
					{errorMessage}
				</p>
			) : null}

			<section aria-labelledby="rfp-upload-heading" className="border-b border-slate-300 py-8">
				<h2 className="text-xl font-semibold" id="rfp-upload-heading">
					새 원본 등록
				</h2>
				{canUpload ? (
					<form
						action={`/projects/${project.id}/rfp/upload`}
						className="mt-5 space-y-5"
						encType="multipart/form-data"
						method="post"
					>
						<div className="space-y-2">
							<label className="block font-medium" htmlFor="rfp-original-file">
								RFP 원본 파일
							</label>
							<input
								accept=".pdf,.hwp,.hwpx,.docx,.xlsx,.txt"
								aria-describedby="rfp-file-help"
								className="block min-h-11 w-full rounded-md border border-slate-500 bg-white px-3 py-2 file:mr-3 file:rounded file:border-0 file:bg-blue-800 file:px-3 file:py-2 file:font-semibold file:text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
								id="rfp-original-file"
								name="file"
								required
								type="file"
							/>
							<p className="text-sm leading-6 text-slate-700" id="rfp-file-help">
								PDF, HWP, HWPX, DOCX, XLSX, TXT · 최대 {MAX_RFP_ORIGINAL_BYTES / 1024 / 1024} MiB
							</p>
						</div>
						<div className="space-y-2">
							<label className="block font-medium" htmlFor="rfp-classification">
								자료 분류
							</label>
							<select
								className="min-h-11 w-full rounded-md border border-slate-500 bg-white px-3 py-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
								defaultValue=""
								id="rfp-classification"
								name="classification"
								required
							>
								<option disabled value="">
									선택하세요
								</option>
								{PRIVACY_CLASSIFICATIONS.map((classification) => (
									<option key={classification} value={classification}>
										{CLASSIFICATION_LABELS[classification]}
									</option>
								))}
							</select>
						</div>
						<button
							className="min-h-11 rounded-md bg-blue-800 px-5 py-2 font-semibold text-white hover:bg-blue-900 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
							type="submit"
						>
							RFP 원본 업로드
						</button>
					</form>
				) : (
					<p className="mt-4 text-slate-700">이 프로젝트에서는 RFP 원본을 조회만 할 수 있습니다.</p>
				)}
			</section>

			<section aria-labelledby="rfp-list-heading" className="py-8">
				<h2 className="text-xl font-semibold" id="rfp-list-heading">
					등록된 원본
				</h2>
				{documentResult.error || parseResult.error ? (
					<p className="mt-4 rounded-md border border-red-700 bg-red-50 p-3 text-red-950" role="alert">
						등록된 원본을 불러오지 못했습니다.
					</p>
				) : documentResult.data && documentResult.data.length > 0 ? (
					<ul className="mt-5 space-y-4">
						{documentResult.data.map((document) => {
							const parsed = parsedDocumentIds.has(document.id);
							const parseable = document.original_filename.toLowerCase().endsWith(".txt");
							return <li className="rounded-md border border-slate-300 bg-white p-5" key={document.id}>
								<p className="font-semibold">{document.original_filename}</p>
								<dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[9rem_1fr]">
									<dt className="font-medium">자료 분류</dt>
									<dd>{CLASSIFICATION_LABELS[document.privacy_classification as PrivacyClassification]}</dd>
									<dt className="font-medium">파일 크기</dt>
									<dd>{document.byte_size} 바이트</dd>
									<dt className="font-medium">SHA-256</dt>
									<dd className="break-all font-mono">{document.sha256}</dd>
								</dl>
								<p className="mt-3 text-sm font-medium">
									파싱 상태: {parsed ? "파싱 완료" : parseable ? "파싱 가능" : "파싱 미지원"}
								</p>
								<div className="mt-4 flex flex-wrap gap-3">
									<Link
									aria-label={`${document.original_filename} 다운로드`}
									className="inline-flex min-h-11 items-center rounded-md border border-blue-800 px-4 py-2 font-semibold text-blue-900 hover:bg-blue-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
									href={`/projects/${project.id}/documents/${document.id}/download`}
								>
									다운로드
									</Link>
									{parsed ? (
										<Link
											aria-label={`${document.original_filename} SourceSpan 보기`}
											className="inline-flex min-h-11 items-center rounded-md border border-blue-800 px-4 py-2 font-semibold text-blue-900 hover:bg-blue-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
											href={`/projects/${project.id}/documents/${document.id}/source`}
										>
											SourceSpan 보기
										</Link>
									) : null}
									{canUpload && parseable ? (
										<form action={`/projects/${project.id}/documents/${document.id}/parse`} method="post">
											<button
												aria-label={`${document.original_filename} 파싱 시작`}
												className="min-h-11 rounded-md bg-blue-800 px-4 py-2 font-semibold text-white hover:bg-blue-900 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
												type="submit"
											>
												파싱 시작
											</button>
										</form>
									) : null}
								</div>
							</li>
						})}
					</ul>
				) : (
					<p className="mt-4 text-slate-700" role="status">
						등록된 RFP 원본이 없습니다.
					</p>
				)}
			</section>
		</main>
	);
}
