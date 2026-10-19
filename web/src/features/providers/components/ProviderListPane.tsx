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
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Provider } from "@/gen/lemma/v1/provider_pb";
import { cn } from "@/lib/utils";
import { IconChevronDown, IconPlus, IconSearch } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

interface ProviderListPaneProps {
    providers: Provider[];
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
            <CollapsibleTrigger className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/60">
                <IconChevronDown
                    className={cn(
                        "size-3.5 transition-transform",
                        !open && "-rotate-90",
                    )}
                />
                {label}
                <span className="ml-auto">{providers.length}</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-0.5">
                {providers.map((provider) => (
                    <button
                        key={provider.id}
                        type="button"
                        onClick={() => onSelect(provider.id)}
                        aria-pressed={provider.id === selectedId}
                        className={cn(
                            "flex w-full items-center gap-2.5 rounded-md p-2 text-left text-sm transition-colors",
                            provider.id === selectedId
                                ? "bg-accent"
                                : "hover:bg-accent/60",
                        )}
                    >
                        <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-background text-xs font-semibold">
                            {(provider.name === "" ? "?" : provider.name)
                                .charAt(0)
                                .toUpperCase()}
                        </span>
                        <span className="flex-1 truncate">{provider.name}</span>
                        <span
                            className={cn(
                                "size-1.5 shrink-0 rounded-full",
                                provider.enabled
                                    ? "bg-primary"
                                    : "bg-muted-foreground/40",
                            )}
                        />
                    </button>
                ))}
            </CollapsibleContent>
        </Collapsible>
    );
}

export function ProviderListPane({
    providers,
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
            </ScrollArea>
        </section>
    );
}
