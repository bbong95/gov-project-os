import Link from "next/link";

export default function Home() {
	return (
		<main className="app-inner app-page">
			<section className="app-section">
				<span className="krds-badge bg-light-primary">대한민국 공공사업 전주기 AI 플랫폼</span>
				<h1 className="app-hero-title">GOV Project OS</h1>
				<p className="app-hero-text">
					RFP부터 제안·계약·수행·검수·종료·지식 재사용까지, 근거와 사람의 승인을 중심으로
					연결합니다.
				</p>
				<Link className="krds-btn medium primary" href="/login">
					로그인
				</Link>
			</section>
		</main>
	);
}
