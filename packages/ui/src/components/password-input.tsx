import { AnimateIcon } from "@animate-ui/react/icons";
import { useState, type ComponentProps, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "#components/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "#components/tooltip";
import { EyeIcon } from "#icons/eye";
import { EyeOffIcon } from "#icons/eye-off";

/** Password field with a show/hide toggle; `children` adds leading addons. */
function PasswordInput({
    className,
    children,
    ...props
}: Omit<ComponentProps<typeof InputGroupInput>, "type" | "children"> & {
    children?: ReactNode;
}) {
    const { t } = useTranslation("ui");
    const [visible, setVisible] = useState(false);
    const label = visible ? t("passwordInput.hide") : t("passwordInput.show");

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
