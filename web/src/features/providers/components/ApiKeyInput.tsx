import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { useState, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "@/components/ui/input-group";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

/** Password input for an API key with a show/hide toggle. */
export function ApiKeyInput({
    className,
    ...props
}: Omit<ComponentProps<typeof InputGroupInput>, "type">) {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);
    const label = visible
        ? t("providers.hideApiKey")
        : t("providers.showApiKey");

    return (
        <InputGroup className={className}>
            <InputGroupInput type={visible ? "text" : "password"} {...props} />
            <InputGroupAddon align="inline-end">
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <InputGroupButton
                                size="icon-xs"
                                aria-label={label}
                                onClick={() => setVisible((v) => !v)}
                            />
                        }
                    >
                        {visible ? <IconEyeOff /> : <IconEye />}
                    </TooltipTrigger>
                    <TooltipContent>{label}</TooltipContent>
                </Tooltip>
            </InputGroupAddon>
        </InputGroup>
    );
}
