import { IconLoader, type IconProps } from "@tabler/icons-react";
import { cn } from "cn";
import { useTranslation } from "react-i18next";

function Spinner({ className, ...props }: IconProps) {
    const { t } = useTranslation();
    return (
        <IconLoader
            data-slot="spinner"
            role="status"
            aria-label={t("common.loading")}
            className={cn("size-4 animate-spin", className)}
            {...props}
        />
    );
}

export { Spinner };
