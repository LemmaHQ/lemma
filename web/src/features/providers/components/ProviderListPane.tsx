import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@lemma/ui/components/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { Provider } from "@/gen/lemma/v1/provider_pb";
import {
    IconChevronDown,
    IconChevronRight,
    IconPlus,
    IconSearch,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

interface ProviderListPaneProps {
    providers: Provider[];
    loaded: boolean;
    selectedId: string | null;
    onSelect: (id: string) => void;
    onCreate: () => void;
}

function ProviderGroup({
    label,
    providers,
    selectedId,
    onSelect,
}: {
    label: string;
    providers: Provider[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}) {
    const [open, setOpen] = useState(true);
    if (providers.length === 0) {
        return null;
    }
    return (
        <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger
                render={
                    <Button
                        variant="ghost"
                        size="xs"
                        className="w-full justify-start"
                    />
                }
            >
                {open ? <IconChevronDown /> : <IconChevronRight />}
                {label}
                <span className="ml-auto">{providers.length}</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col">
                {providers.map((provider) => (
                    <Button
                        key={provider.id}
                        variant={
                            provider.id === selectedId ? "secondary" : "ghost"
                        }
                        className="w-full justify-start"
                        onClick={() => onSelect(provider.id)}
                        aria-pressed={provider.id === selectedId}
                    >
                        <Avatar size="sm">
                            <AvatarFallback>
                                {(provider.name === "" ? "?" : provider.name)
                                    .charAt(0)
                                    .toUpperCase()}
                            </AvatarFallback>
                            {provider.enabled && <AvatarBadge />}
                        </Avatar>
                        <span className="truncate">{provider.name}</span>
                    </Button>
                ))}
            </CollapsibleContent>
        </Collapsible>
    );
}

const SKELETON_ROW_WIDTHS = ["w-3/5", "w-2/5", "w-1/2"];

export function ProviderListPane({
    providers,
    loaded,
    selectedId,
    onSelect,
    onCreate,
}: ProviderListPaneProps) {
    const { t } = useTranslation();
    const [query, setQuery] = useState("");

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (q === "") {
            return providers;
        }
        return providers.filter((p) => p.name.toLowerCase().includes(q));
    }, [providers, query]);

    const enabledProviders = filtered.filter((p) => p.enabled);
    const disabledProviders = filtered.filter((p) => !p.enabled);

    return (
        <section className="flex w-65 shrink-0 flex-col border-r">
            <div className="flex items-center gap-2 p-3">
                <InputGroup className="flex-1">
                    <InputGroupAddon>
                        <IconSearch />
                    </InputGroupAddon>
                    <InputGroupInput
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t("providers.searchPlaceholder")}
                    />
                </InputGroup>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={t("providers.newProvider")}
                    onClick={onCreate}
                >
                    <IconPlus className="size-4" />
                </Button>
            </div>
            <ScrollArea className="min-h-0 flex-1">
                {loaded ? (
                    <div className="px-2 pb-3">
                        <ProviderGroup
                            label={t("providers.enabledGroup")}
                            providers={enabledProviders}
                            selectedId={selectedId}
                            onSelect={onSelect}
                        />
                        <ProviderGroup
                            label={t("providers.disabledGroup")}
                            providers={disabledProviders}
                            selectedId={selectedId}
                            onSelect={onSelect}
                        />
                    </div>
                ) : (
                    <output
                        aria-label={t("common.loading")}
                        className="flex flex-col px-2 pt-6 pb-3"
                    >
                        {SKELETON_ROW_WIDTHS.map((width) => (
                            <div
                                key={width}
                                className="flex h-8 items-center gap-1.5 px-2.5"
                            >
                                <Skeleton shape="circle" className="size-6" />
                                <div className={width}>
                                    <Skeleton className="h-3.5" />
                                </div>
                            </div>
                        ))}
                    </output>
                )}
            </ScrollArea>
        </section>
    );
}
