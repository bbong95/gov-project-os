import { login } from "./actions";
import Link from "next/link";

type LoginPageProps = {
	searchParams: Promise<{ error?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
	const params = await searchParams;
	const hasCredentialError = params.error === "credentials";

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
			<div className="space-y-2">
				<Link className="text-sm font-medium text-blue-800 underline underline-offset-4" href="/">
					GOV Project OS
				</Link>
				<h1 className="text-3xl font-semibold tracking-tight">로그인</h1>
				<p className="text-sm leading-6 text-slate-700">승인된 계정으로 프로젝트에 접속하세요.</p>
			</div>

			{hasCredentialError ? (
				<p className="rounded-md border border-red-700 bg-red-50 p-3 text-sm text-red-900" role="alert">
					이메일과 비밀번호를 확인하세요.
				</p>
			) : null}

			<form action={login} className="space-y-5">
				<div className="space-y-2">
					<label className="block text-sm font-medium" htmlFor="email">
						이메일
					</label>
					<input
						autoComplete="email"
						className="min-h-11 w-full rounded-md border border-slate-500 bg-white px-3 py-2 text-slate-950 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
						id="email"
						name="email"
						required
						type="email"
					/>
				</div>
				<div className="space-y-2">
					<label className="block text-sm font-medium" htmlFor="password">
						비밀번호
					</label>
					<input
						autoComplete="current-password"
						className="min-h-11 w-full rounded-md border border-slate-500 bg-white px-3 py-2 text-slate-950 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
						id="password"
						name="password"
						required
						type="password"
					/>
				</div>
				<button
					className="min-h-11 w-full rounded-md bg-blue-800 px-4 py-2 font-semibold text-white hover:bg-blue-900 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
					type="submit"
				>
					로그인
				</button>
			</form>
		</main>
	);
}
