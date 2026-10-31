import {
    AnimateIcon,
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
    GlobeIcon,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@lemma/ui";
import { useTranslation } from "react-i18next";

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
                >
                    <DropdownMenuRadioItem
                        value="zh"
                        onClick={() => {
                            void i18n.changeLanguage("zh");
                        }}
                    >
                        中文
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                        value="en"
                        onClick={() => {
                            void i18n.changeLanguage("en");
                        }}
                    >
                        English
                    </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
