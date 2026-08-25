import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { SourceLocation } from "../../../../../../lib/parsing/document-parser";
import { createServerSupabaseClient } from "../../../../../../lib/supabase/server";

type SourcePageProps = {
	params: Promise<{ projectId: string; documentId: string }>;
};

function locationLabel(location: SourceLocation): string {
	switch (location.kind) {
		case "TEXT_LINES":
			return `${location.lineStart}–${location.lineEnd}행`;
		case "PAGE":
			return `${location.pageNumber}쪽${location.blockIndex === undefined ? "" : ` · 블록 ${location.blockIndex}`}`;
		case "SHEET":
			return `${location.sheetName ?? `시트 ${location.sheetIndex}`}${location.cellRange ? ` · ${location.cellRange}` : ""}`;
		case "SECTION":
			return `${location.label ?? `섹션 ${location.sectionIndex}`}${location.blockIndex === undefined ? "" : ` · 블록 ${location.blockIndex}`}`;
	}
}

export default async function SourcePage({ params }: SourcePageProps) {
	const { projectId, documentId } = await params;
	const supabase = await createServerSupabaseClient();
	const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
	if (claimsError || typeof claimsData?.claims?.sub !== "string") {
		redirect("/login");
	}

	const { data: document, error: documentError } = await supabase
		.from("documents")
		.select("id, original_filename, sha256")
		.eq("id", documentId)
		.eq("project_id", projectId)
		.eq("document_kind", "RFP")
		.maybeSingle();
	if (documentError || !document) {
		notFound();
	}

	const { data: parse, error: parseError } = await supabase
		.from("document_parses")
		.select("id, parser_key, parser_version, normalization_version, detected_format, warnings, result_sha256, created_at")
		.eq("project_id", projectId)
		.eq("document_id", documentId)
		.order("created_at", { ascending: false })
		.limit(1)
		.maybeSingle();
	if (parseError || !parse) {
		notFound();
	}

	const { data: spans, error: spansError } = await supabase
		.from("source_spans")
		.select("id, ordinal, location, original_text, normalized_text, original_text_sha256")
		.eq("project_id", projectId)
		.eq("document_id", documentId)
		.eq("document_parse_id", parse.id)
		.order("ordinal", { ascending: true });
	if (spansError || !spans || spans.length === 0) {
		notFound();
	}

	const warningCount = Array.isArray(parse.warnings) ? parse.warnings.length : 0;

	return (
		<main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-12">
			<a
				className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-white focus:p-3 focus:outline-3 focus:outline-blue-700"
				href="#source-spans"
			>
				SourceSpan 목록으로 건너뛰기
			</a>
			<header className="space-y-3 border-b border-slate-300 pb-6">
				<Link
					className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-800 underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
					href={`/projects/${projectId}/rfp`}
				>
					RFP 원본으로 돌아가기
				</Link>
				<h1 className="text-3xl font-semibold tracking-tight">RFP SourceSpan</h1>
				<p className="text-slate-700">{document.original_filename}</p>
				<p className="leading-7 text-slate-700">
					원문 증거와 결정적 정규화문을 분리해 표시합니다. 허용된 내용만 권한·정책 확인 후 서버에서 AI로 전송할 수 있으며, 문서 내용은 실행하지 않습니다.
				</p>
			</header>

			<section aria-labelledby="parse-summary-heading" className="border-b border-slate-300 py-8">
				<h2 className="text-xl font-semibold" id="parse-summary-heading">파싱 스냅샷</h2>
				<dl className="mt-5 grid gap-2 text-sm sm:grid-cols-[11rem_1fr]">
					<dt className="font-medium">문서 SHA-256</dt>
					<dd className="break-all font-mono">{document.sha256}</dd>
					<dt className="font-medium">결과 SHA-256</dt>
					<dd className="break-all font-mono">{parse.result_sha256}</dd>
					<dt className="font-medium">파서</dt>
					<dd>{parse.parser_key} {parse.parser_version}</dd>
					<dt className="font-medium">정규화 버전</dt>
					<dd>{parse.normalization_version}</dd>
					<dt className="font-medium">감지 형식</dt>
					<dd>{parse.detected_format}</dd>
					<dt className="font-medium">파서 경고</dt>
					<dd>{warningCount === 0 ? "경고 없음" : `${warningCount}개`}</dd>
				</dl>
			</section>

			<section aria-labelledby="source-spans-heading" className="py-8" id="source-spans">
				<h2 className="text-xl font-semibold" id="source-spans-heading">SourceSpan 목록</h2>
				<ol className="mt-5 space-y-8">
					{spans.map((span) => {
						const headingId = `source-span-${span.ordinal}`;
						return (
							<li key={span.id}>
								<section
									aria-labelledby={headingId}
									className="rounded-md border border-slate-300 bg-white p-5"
									id={"span-" + span.id}
								>
									<h2 className="text-xl font-semibold" id={headingId}>SourceSpan {span.ordinal}</h2>
									<dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
										<dt className="font-medium">원본 위치</dt>
										<dd>{locationLabel(span.location as SourceLocation)}</dd>
										<dt className="font-medium">원문 SHA-256</dt>
										<dd className="break-all font-mono">{span.original_text_sha256}</dd>
									</dl>
									<h3 className="mt-5 font-semibold">원문</h3>
									<pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-slate-100 p-4 font-mono text-sm" data-testid="source-original">{span.original_text}</pre>
									<h3 className="mt-5 font-semibold">정규화문</h3>
									<pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-slate-100 p-4 font-mono text-sm" data-testid="source-normalized">{span.normalized_text}</pre>
								</section>
							</li>
						);
					})}
				</ol>
			</section>
		</main>
	);
}
