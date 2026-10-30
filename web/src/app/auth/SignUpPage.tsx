import { SignUpPanel } from "@/features/auth";

import { paths } from "../route-paths";

export function SignUpPage() {
    return <SignUpPanel signInPath={paths.signIn} />;
}
