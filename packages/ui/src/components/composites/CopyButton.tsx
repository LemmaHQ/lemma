import { CopyIcon } from "#icons/copy";
import { Button } from "#primitives/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "#primitives/tooltip";

import { useCopyText } from "./useCopyText";

/** Ghost icon button that copies `text`; the icon turns into a drawn check and the tooltip reads `copiedLabel` for a moment. */
export function CopyButton({
    text,
    label,
    copiedLabel,
}: {
    text: string;
    label: string;
    copiedLabel: string;
}) {
    const { copied, copy } = useCopyText();
    const tooltip = copied ? copiedLabel : label;

    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={tooltip}
                        onClick={() => copy(text)}
                    />
                }
            >
                <span
                    className="grid size-4 place-items-center"
                    aria-hidden="true"
                >
                    <span
                        className="swap-layer grid place-items-center [grid-area:1/1]"
                        data-on={!copied}
                    >
                        <CopyIcon />
                    </span>
                    <span
                        className="swap-layer grid place-items-center [grid-area:1/1]"
                        data-on={copied}
                    >
                        <svg
                            className="fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
                            viewBox="0 0 24 24"
                        >
                            <path
                                key={copied ? "copied" : "copy"}
                                className="animate-draw"
                                d="m4 12 5 5L20 6"
                                pathLength={1}
                            />
                        </svg>
                    </span>
                </span>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
    );
}
