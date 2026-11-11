import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { Skeleton } from "./skeleton";

it("announces a placeholder by the label it is given", () => {
    render(<Skeleton shape="circle" aria-label="Loading" />);

    expect(screen.getByLabelText("Loading")).toBeDefined();
});
