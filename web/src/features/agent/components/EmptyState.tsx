import { useTranslation } from "react-i18next";

import {
    Empty,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    MessageCirclePlusIcon,
} from "@lemma/ui";

export function EmptyState() {
    const { t } = useTranslation();

    return (
        <Empty className="h-full">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <MessageCirclePlusIcon />
                </EmptyMedia>
                <EmptyTitle>{t("session.emptyTitle")}</EmptyTitle>
            </EmptyHeader>
        </Empty>
    );
}
