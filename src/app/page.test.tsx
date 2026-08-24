import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home", () => {
	it("exposes the product name as the level-one heading", () => {
		render(<Home />);

		expect(screen.getByRole("heading", { level: 1, name: "GOV Project OS" })).toBeVisible();
	});
});
