import { login } from "./actions";

type LoginPageProps = {
	searchParams: Promise<{ error?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
	const params = await searchParams;
	const hasCredentialError = params.error === "credentials";

	return (
		<main className="app-inner app-page app-login-page">
			<section aria-labelledby="login-heading" className="app-section">
				<h1 id="login-heading" className="app-page-title">
					로그인
				</h1>
				<p className="app-page-lead">승인된 계정으로 프로젝트에 접속하세요.</p>

				{hasCredentialError ? (
					<p className="app-alert-danger" role="alert">
						이메일과 비밀번호를 확인하세요.
					</p>
				) : null}

				<form action={login} className="fieldset">
					<div className="form-group">
						<div className="form-tit">
							<label htmlFor="email">이메일</label>
						</div>
						<div className="form-conts">
							<input
								autoComplete="email"
								className="krds-input"
								id="email"
								name="email"
								required
								type="email"
							/>
						</div>
					</div>
					<div className="form-group">
						<div className="form-tit">
							<label htmlFor="password">비밀번호</label>
						</div>
						<div className="form-conts">
							<input
								autoComplete="current-password"
								className="krds-input"
								id="password"
								name="password"
								required
								type="password"
							/>
						</div>
					</div>
					<button className="krds-btn medium primary app-login-submit" type="submit">
						로그인
					</button>
				</form>
			</section>
		</main>
	);
}
