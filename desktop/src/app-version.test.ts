import { expect, it } from "vitest";

import { appVersionArg, readAppVersion } from "./app-version";

it("reads back the version passed on the renderer command line", () => {
    const argv = ["electron", "--type=renderer", appVersionArg("1.4.0")];

    expect(readAppVersion(argv)).toBe("1.4.0");
});

it("reads an empty version when the argument is absent", () => {
    expect(readAppVersion(["electron", "--type=renderer"])).toBe("");
});
