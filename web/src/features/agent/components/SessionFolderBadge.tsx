import { Tooltip, TooltipContent, TooltipTrigger } from "@lemma/ui";

import { lastPathSegment } from "../tool-output";

interface SessionFolderBadgeProps {
    directory: string;
}

/** Read-only workspace folder badge shown in the composer footer of a bound session. */
export function SessionFolderBadge({ directory }: SessionFolderBadgeProps) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <span className="max-w-44 truncate px-1.5 font-mono text-small text-subtle-foreground" />
                }
            >
                {lastPathSegment(directory)}
            </TooltipTrigger>
            <TooltipContent>{directory}</TooltipContent>
        </Tooltip>
    );
}
