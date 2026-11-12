import {
    FieldDescription,
    Item,
    ItemActions,
    ItemContent,
    ItemGroup,
    ItemSeparator,
    ItemTitle,
    Switch,
} from "@lemma/ui";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";

import type { Model } from "../store";

interface PredefinedModelListProps {
    models: Model[];
}

export function PredefinedModelList({ models }: PredefinedModelListProps) {
    const { t } = useTranslation();
    return (
        <section className="flex flex-col gap-3 pt-6">
            <h3 className="text-title">{t("provider.modelList")}</h3>
            <FieldDescription>{t("provider.modelsReadOnly")}</FieldDescription>
            <ItemGroup>
                {models.map((model, index) => (
                    <Fragment key={model.id}>
                        {index > 0 && <ItemSeparator />}
                        <Item size="xs">
                            <ItemContent>
                                <ItemTitle>{model.id}</ItemTitle>
                            </ItemContent>
                            <ItemActions>
                                <span className="text-small text-muted-foreground">
                                    {t("provider.toolCalling")}
                                </span>
                                <Switch
                                    checked={model.toolCalling}
                                    disabled
                                    aria-label={`${model.id} ${t("provider.toolCalling")}`}
                                />
                            </ItemActions>
                        </Item>
                    </Fragment>
                ))}
            </ItemGroup>
        </section>
    );
}
