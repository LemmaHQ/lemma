import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { Wordmark } from "./wordmark";

it("renders the brand label and trailing dot", () => {
    render(<Wordmark label="Lemma" className="tracking-tight" />);

    const wordmark = screen.getByText("Lemma");
    expect(wordmark.dataset.slot).toBe("wordmark");
    expect(wordmark.className).toContain("font-brand");
    expect(wordmark.className).toContain("tracking-tight");
    const dot = wordmark.querySelector('[aria-hidden="true"]');
    expect(dot?.className).toContain("bg-brand");
});
