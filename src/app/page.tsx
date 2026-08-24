export default function Home() {
	return (
		<main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center gap-6 px-6 py-12">
			<p className="text-sm font-semibold tracking-wide text-blue-800">대한민국 공공사업 전주기 AI 플랫폼</p>
			<h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">GOV Project OS</h1>
			<p className="max-w-2xl text-lg leading-8 text-slate-700">
				RFP부터 제안·계약·수행·검수·종료·지식 재사용까지, 근거와 사람의 승인을 중심으로 연결합니다.
			</p>
			<div>
				<a
					className="inline-flex min-h-11 items-center rounded-md bg-blue-800 px-5 py-2 font-semibold text-white hover:bg-blue-900 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
					href="/login"
				>
					로그인
				</a>
			</div>
		</main>
	);
}
