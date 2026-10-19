import { IconLanguage } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export function LanguageToggle() {
    const { i18n, t } = useTranslation();
    return (
        <DropdownMenu>
            <Tooltip>
                <TooltipTrigger
                    render={
                        <DropdownMenuTrigger
                            render={
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t("language.toggle")}
                                />
                            }
                        />
                    }
                >
                    <IconLanguage />
                </TooltipTrigger>
                <TooltipContent>{t("language.toggle")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    onClick={() => void i18n.changeLanguage("zh")}
                >
                    中文
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => void i18n.changeLanguage("en")}
                >
                    English
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
