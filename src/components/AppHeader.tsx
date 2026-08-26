import Link from "next/link";
import type { ReactNode } from "react";

type AppHeaderProps = {
	actions?: ReactNode;
};

export function AppHeader({ actions }: AppHeaderProps) {
	return (
		<header id="krds-header">
			<div className="header-in">
				<div className="header-container">
					<div className="inner app-header-inner">
						<Link className="app-logo" href="/projects">
							GOV Project OS
						</Link>
						{actions ? <div className="app-header-actions">{actions}</div> : null}
					</div>
				</div>
			</div>
		</header>
	);
}
