import { useTranslation } from "react-i18next";

import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    MessageCirclePlusIcon,
    Suggestion,
} from "@lemma/ui";

const SUGGESTION_KEYS = [
    "conversation.suggestion1",
    "conversation.suggestion2",
    "conversation.suggestion3",
] as const;

interface EmptyStateProps {
    onPickSuggestion: (text: string) => void;
}

export function EmptyState({ onPickSuggestion }: EmptyStateProps) {
    const { t } = useTranslation();

    return (
        <Empty className="h-full">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <MessageCirclePlusIcon />
                </EmptyMedia>
                <EmptyTitle>{t("conversation.emptyTitle")}</EmptyTitle>
                <EmptyDescription>
                    {t("conversation.emptySubtitle")}
                </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row flex-wrap justify-center">
                {SUGGESTION_KEYS.map((key) => (
                    <Suggestion
                        key={key}
                        suggestion={t(key)}
                        onClick={onPickSuggestion}
                    />
                ))}
            </EmptyContent>
        </Empty>
    );
}
