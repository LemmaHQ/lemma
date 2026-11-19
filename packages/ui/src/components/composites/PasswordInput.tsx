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

type PasswordInputFieldProps = Pick<
    ComponentProps<typeof InputGroupInput>,
    | "id"
    | "value"
    | "onChange"
    | "placeholder"
    | "autoComplete"
    | "disabled"
    | "aria-label"
    | "aria-invalid"
>;

/** Password field with a show/hide toggle named by `showLabel` and `hideLabel`; `children` adds leading addons. */
export function PasswordInput({
    children,
    showLabel,
    hideLabel,
    ...props
}: PasswordInputFieldProps & {
    children?: ReactNode;
    showLabel: string;
    hideLabel: string;
}) {
    const [visible, setVisible] = useState(false);
    const label = visible ? hideLabel : showLabel;

    return (
        <InputGroup>
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
