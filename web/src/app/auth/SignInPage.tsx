import { SignInPanel } from "@/features/auth";

import { paths } from "../route-paths";

export function SignInPage() {
    return <SignInPanel signUpPath={paths.signUp} />;
}
