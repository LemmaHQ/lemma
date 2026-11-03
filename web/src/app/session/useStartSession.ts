import { useSidebar } from "@lemma/ui";
import { useNavigate } from "react-router";

import { paths } from "../route-paths";

/** Closes the mobile sidebar and opens the home view for a new session. */
export function useStartSession(): () => void {
    const navigate = useNavigate();
    const { setOpenMobile } = useSidebar();
    return () => {
        setOpenMobile(false);
        void navigate(paths.home);
    };
}
