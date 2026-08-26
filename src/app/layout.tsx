import type { Metadata } from "next";
import "krds-uiux/resources/css/token/krds_tokens.css";
import "krds-uiux/resources/css/common/common.css";
import "krds-uiux/resources/css/component/component.css";
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
			</head>
			<body>{children}</body>
		</html>
	);
}
