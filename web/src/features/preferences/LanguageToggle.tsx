import { AnimateIcon } from "@animate-ui/react/icons";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@lemma/ui/components/dropdown-menu";
import { GlobeIcon } from "@lemma/ui/icons/globe";
import { useTranslation } from "react-i18next";

import { Button } from "@lemma/ui/components/button";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@lemma/ui/components/tooltip";

/** Icon button opening the interface language menu. */
export function LanguageToggle() {
    const { i18n, t } = useTranslation();

    return (
        <DropdownMenu>
            <Tooltip>
                <AnimateIcon animateOnHover asChild>
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
                        <GlobeIcon />
                    </TooltipTrigger>
                </AnimateIcon>
                <TooltipContent>{t("language.toggle")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                    value={i18n.language.startsWith("zh") ? "zh" : "en"}
                    onValueChange={(value: unknown) => {
                        if (value === "zh" || value === "en") {
                            void i18n.changeLanguage(value);
                        }
                    }}
                >
                    <DropdownMenuRadioItem value="zh">
                        中文
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="en">
                        English
                    </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
