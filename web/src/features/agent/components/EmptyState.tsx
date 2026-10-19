import { IconMessage } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import { Suggestion } from "@/components/ai-elements/suggestion";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";

const SUGGESTION_KEYS = [
    "chat.suggestion1",
    "chat.suggestion2",
    "chat.suggestion3",
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
                    <IconMessage />
                </EmptyMedia>
                <EmptyTitle>{t("chat.emptyTitle")}</EmptyTitle>
                <EmptyDescription>{t("chat.emptySubtitle")}</EmptyDescription>
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
