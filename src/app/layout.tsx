import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "GOV Project OS",
	description: "대한민국 공공사업 전주기 AI 운영 플랫폼",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="ko">
			<head>
				<link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
				<link href="/krds/css/token/krds_tokens.css" rel="stylesheet"></link>
				<link href="/krds/css/common/common.css" rel="stylesheet"></link>
				<link href="/krds/css/component/component.css" rel="stylesheet"></link>
			</head>
			<body>{children}</body>
		</html>
	);
}
