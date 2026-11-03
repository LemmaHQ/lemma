import { create } from "@bufbuild/protobuf";
import { beforeEach, expect, it, vi } from "vitest";

import { clearActiveSession } from "@/features/agent";
import { useAuth } from "@/features/auth";
import { clearSessions } from "@/features/session";
import { clearProviders } from "@/features/provider";
import { UserSchema } from "@/gen/lemma/v1/auth_pb";

import { installAccountDataReset } from "./account-data";

vi.mock("@/features/agent", () => ({
    clearActiveSession: vi.fn<() => void>(),
}));
vi.mock("@/features/session", () => ({
    clearSessions: vi.fn<() => void>(),
}));
vi.mock("@/features/provider", () => ({
    clearProviders: vi.fn<() => void>(),
}));

const user = (id: string) => create(UserSchema, { id, username: id });

const clears = () => [
    vi.mocked(clearActiveSession).mock.calls.length,
    vi.mocked(clearSessions).mock.calls.length,
    vi.mocked(clearProviders).mock.calls.length,
];

beforeEach(() => {
    vi.clearAllMocks();
});

it("empties account data when the user changes, not on a same-user update", () => {
    installAccountDataReset();

    useAuth.setState({ user: user("u1") });
    expect(clears()).toEqual([1, 1, 1]);

    useAuth.setState({ user: user("u1") });
    expect(clears()).toEqual([1, 1, 1]);

    useAuth.setState({ user: user("u2") });
    useAuth.setState({ user: null });
    expect(clears()).toEqual([3, 3, 3]);
});
