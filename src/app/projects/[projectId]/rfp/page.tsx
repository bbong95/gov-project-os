import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "../../../../components/AppHeader";
import {
	MAX_RFP_ORIGINAL_BYTES,
	PRIVACY_CLASSIFICATIONS,
	type PrivacyClassification,
} from "../../../../lib/documents/rfp-original";
import {
	indexLatestRequirementRuns,
	isParseableRfpFilename,
} from "../../../../lib/parsing/rfp-workflow-state";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { logout } from "../../actions";

type RfpPageProps = {
	params: Promise<{ projectId: string }>;
	searchParams: Promise<{
		status?: string | string[];
		error?: string | string[];
		runId?: string | string[];
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
	requirements_failed: "AI 서비스 일시 실패 — 저장된 후보 없음",
};

const SUCCESS_MESSAGES: Record<string, string> = {
	uploaded: "RFP 원본을 안전하게 저장했습니다.",
	parsed: "RFP 원본 파싱을 완료했습니다.",
	already_parsed: "동일한 파싱 결과가 이미 보관되어 있습니다.",
	requirements_created: "AI 초안 생성 완료",
	requirements_reused: "동일 설정의 기존 결과 재사용",
};

const BLOCKING_MESSAGES: Record<string, string> = {
	requirements_review: "개인정보 검토 필요 — AI에 전송하지 않음",
	requirements_blocked: "정책상 AI 전송 차단",
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

	const [
		projectMembershipResult,
		tenantMembershipResult,
		documentResult,
		parseResult,
		requirementRunResult,
	] = await Promise.all([
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
			.select("id, document_id, created_at")
			.eq("project_id", projectId)
			.order("created_at", { ascending: false }),
		supabase
			.from("requirement_extraction_runs")
			.select("id, document_id, created_at")
			.eq("project_id", projectId)
			.order("created_at", { ascending: false }),
	]);
	const canUpload =
		projectMembershipResult.data?.role === "EDITOR" ||
		projectMembershipResult.data?.role === "PROJECT_ADMIN" ||
		tenantMembershipResult.data?.role === "TENANT_ADMIN";
	const statusCode = typeof resultParams.status === "string" ? resultParams.status : null;
	const successMessage = statusCode ? SUCCESS_MESSAGES[statusCode] : null;
	const blockingMessage = statusCode ? BLOCKING_MESSAGES[statusCode] : null;
	const errorCode = typeof resultParams.error === "string" ? resultParams.error : null;
	const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] : null;
	const latestParseByDocumentId = new Map<
		string,
		{ id: string; document_id: string }
	>();
	for (const parse of parseResult.data ?? []) {
		if (!latestParseByDocumentId.has(parse.document_id)) {
			latestParseByDocumentId.set(parse.document_id, {
				id: parse.id,
				document_id: parse.document_id,
			});
		}
	}
	const latestRequirementRunByDocumentId = indexLatestRequirementRuns(
		requirementRunResult.data ?? [],
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
				<p className="app-muted">{project.name}</p>
				<h1 className="app-page-title">RFP 원본</h1>
				<p className="app-page-lead">
					원본은 비공개 불변 자료로 보관됩니다. 검증 가능한 형식은 AI 없이 파싱해 원문 증거를
					분리 보관합니다.
				</p>

				{blockingMessage ? (
					<p className="app-alert-warning" role="alert">
						{blockingMessage}
					</p>
				) : null}
				{successMessage ? (
					<p className="app-status-success" role="status">
						{successMessage}
					</p>
				) : null}
				{errorMessage ? (
					<p className="app-alert-danger" role="alert">
						{errorMessage}
					</p>
				) : null}

				<section aria-labelledby="rfp-upload-heading" className="app-section">
					<h2 className="app-section-title" id="rfp-upload-heading">
						새 원본 등록
					</h2>
					{canUpload ? (
						<form
							action={`/projects/${project.id}/rfp/upload`}
							className="fieldset"
							encType="multipart/form-data"
							method="post"
						>
							<div className="form-group">
								<div className="form-tit">
									<label htmlFor="rfp-original-file">RFP 원본 파일</label>
								</div>
								<div className="form-conts">
									<input
										accept=".pdf,.hwp,.hwpx,.docx,.xlsx,.txt"
										className="krds-input"
										id="rfp-original-file"
										name="file"
										required
										type="file"
									/>
								</div>
								<p className="form-hint">
									PDF, HWP, HWPX, DOCX, XLSX, TXT · 최대{" "}
									{MAX_RFP_ORIGINAL_BYTES / 1024 / 1024} MiB
								</p>
							</div>
							<div className="form-group">
								<div className="form-tit">
									<label htmlFor="rfp-classification">자료 분류</label>
								</div>
								<div className="form-conts">
									<select
										className="krds-form-select"
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
							</div>
							<button className="krds-btn medium primary" type="submit">
								RFP 원본 업로드
							</button>
						</form>
					) : (
						<p className="app-muted">이 프로젝트에서는 RFP 원본을 조회만 할 수 있습니다.</p>
					)}
				</section>

				<section aria-labelledby="rfp-list-heading" className="app-section">
					<h2 className="app-section-title" id="rfp-list-heading">
						등록된 원본
					</h2>
					{documentResult.error || parseResult.error || requirementRunResult.error ? (
						<p className="app-alert-danger" role="alert">
							등록된 원본을 불러오지 못했습니다.
						</p>
					) : documentResult.data && documentResult.data.length > 0 ? (
						<ul className="krds-structured-list type-full">
							{documentResult.data.map((document) => {
								const parse = latestParseByDocumentId.get(document.id);
								const parsed = Boolean(parse);
								const parseable = isParseableRfpFilename(document.original_filename);
								const requirementRun = latestRequirementRunByDocumentId.get(document.id);
								const classification =
									document.privacy_classification as PrivacyClassification;
								const extractionState =
									classification === "PUBLIC" || classification === "INTERNAL"
										? { label: "추출 가능", tone: "bg-light-success" as const }
										: classification === "PERSONAL"
											? {
													label: "개인정보 검토 필요 — AI에 전송하지 않음",
													tone: "bg-light-warning" as const,
												}
											: { label: "정책상 AI 전송 차단", tone: "bg-light-danger" as const };
								const canCallAi =
									classification === "PUBLIC" || classification === "INTERNAL";
								return (
									<li className="structured-item" key={document.id}>
										<div className="in">
											<div className="card-body">
												<p className="c-tit">
													<span className="span">{document.original_filename}</span>
												</p>
												<dl className="app-meta-grid">
													<dt>자료 분류</dt>
													<dd>
														{
															CLASSIFICATION_LABELS[
																document.privacy_classification as PrivacyClassification
															]
														}
													</dd>
													<dt>파일 크기</dt>
													<dd>{document.byte_size} 바이트</dd>
													<dt>SHA-256</dt>
													<dd>{document.sha256}</dd>
												</dl>
												<p className="app-muted">
													파싱 상태: {parsed ? "파싱 완료" : parseable ? "파싱 가능" : "파싱 미지원"}
												</p>
												{parsed ? (
													<p>
														<span className={"krds-badge " + extractionState.tone}>
															{extractionState.label}
														</span>
													</p>
												) : null}
												<div className="btn-wrap">
													<Link
														aria-label={`${document.original_filename} 다운로드`}
														className="krds-btn small secondary"
														href={`/projects/${project.id}/documents/${document.id}/download`}
													>
														다운로드
													</Link>
													{parsed ? (
														<Link
															aria-label={`${document.original_filename} SourceSpan 보기`}
															className="krds-btn small secondary"
															href={`/projects/${project.id}/documents/${document.id}/source`}
														>
															SourceSpan 보기
														</Link>
													) : null}
													{requirementRun ? (
														<Link
															aria-label={document.original_filename + " 요구사항 검토 계속"}
															className="krds-btn small primary"
															href={
																"/projects/" +
																project.id +
																"/requirements/" +
																requirementRun.id
															}
														>
															요구사항 검토 계속
														</Link>
													) : null}
													{canUpload && parse && canCallAi && !requirementRun ? (
														<form
															action={"/projects/" + project.id + "/requirements/extract"}
															method="post"
														>
															<input
																name="documentParseId"
																type="hidden"
																value={parse.id}
															/>
															<button
																aria-label={document.original_filename + " 요구사항 추출"}
																className="krds-btn small primary"
																type="submit"
															>
																요구사항 추출
															</button>
														</form>
													) : null}
													{canUpload && parseable && !parsed ? (
														<form
															action={`/projects/${project.id}/documents/${document.id}/parse`}
															method="post"
														>
															<button
																aria-label={`${document.original_filename} 파싱 시작`}
																className="krds-btn small primary"
																type="submit"
															>
																파싱 시작
															</button>
														</form>
													) : null}
												</div>
											</div>
										</div>
									</li>
								);
							})}
						</ul>
					) : (
						<p className="app-muted" role="status">
							등록된 RFP 원본이 없습니다.
						</p>
					)}
				</section>
			</main>
		</>
	);
}
