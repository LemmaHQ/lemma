import { AnimateIcon } from "@animate-ui/react/icons";
import { useState, type ComponentProps, type ReactNode } from "react";

import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "#primitives/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "#primitives/tooltip";
import { EyeIcon } from "#icons/eye";
import { EyeOffIcon } from "#icons/eye-off";

/** Password field with a show/hide toggle named by `showLabel` and `hideLabel`; `children` adds leading addons. */
function PasswordInput({
    className,
    children,
    showLabel,
    hideLabel,
    ...props
}: Omit<ComponentProps<typeof InputGroupInput>, "type" | "children"> & {
    children?: ReactNode;
    showLabel: string;
    hideLabel: string;
}) {
    const [visible, setVisible] = useState(false);
    const label = visible ? hideLabel : showLabel;

    return (
        <InputGroup className={className}>
            {children}
            <InputGroupInput type={visible ? "text" : "password"} {...props} />
            <InputGroupAddon align="inline-end">
                <Tooltip>
                    <AnimateIcon animateOnHover asChild>
                        <TooltipTrigger
                            render={
                                <InputGroupButton
                                    size="icon-xs"
                                    aria-label={label}
                                    onClick={() => setVisible((v) => !v)}
                                />
                            }
                        >
                            {visible ? <EyeOffIcon /> : <EyeIcon />}
                        </TooltipTrigger>
                    </AnimateIcon>
                    <TooltipContent>{label}</TooltipContent>
                </Tooltip>
            </InputGroupAddon>
        </InputGroup>
    );
}

export { PasswordInput };
