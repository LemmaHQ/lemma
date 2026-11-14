import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { Wordmark } from "./wordmark";

it("renders default and splash wordmark scales with trailing brand dot", () => {
    const { rerender } = render(
        <Wordmark label="Lemma" className="tracking-tight" />,
    );

    const wordmark = screen.getByText("Lemma");
    expect(wordmark.dataset.slot).toBe("wordmark");
    expect(wordmark.className).toContain("text-wordmark");
    expect(wordmark.className).toContain("tracking-tight");
    const dot = wordmark.querySelector('[aria-hidden="true"]');
    expect(dot?.className).toContain("bg-brand");

    rerender(<Wordmark label="Lemma" size="splash" />);
    expect(screen.getByText("Lemma").className).toContain(
        "text-wordmark-splash",
    );
});
