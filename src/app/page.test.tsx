import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home", () => {
	it("exposes the product name as the level-one heading", () => {
		render(<Home />);

		expect(screen.getByRole("heading", { level: 1, name: "GOV Project OS" })).toBeVisible();
	});

	it("offers an accessible login entry point", () => {
		render(<Home />);

		expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
	});
});
