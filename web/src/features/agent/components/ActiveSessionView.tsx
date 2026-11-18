import { isShortcutIgnored, toast } from "@lemma/ui";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import { groupTurns } from "../active-path";
import { buildSessionTree } from "../session-tree";
import { useActiveSession } from "../useActiveSession";
import { type ModelOption, useModelSelection } from "../useModelSelection";
import { ComposerDock, type ComposerDockState } from "./ComposerDock";
import { SessionComposer, type SessionProviderGroup } from "./SessionComposer";
import { SessionDirectoryBadge } from "./SessionDirectoryBadge";
import { type ActiveRightPane, SessionRightPane } from "./SessionRightPane";
import { SessionStage } from "./SessionStage";
import { TurnView } from "./TurnView";

export interface ActiveSessionViewProps {
    sessionId: string;
    directory?: string | undefined;
    modelOptions: ModelOption[];
    providers: SessionProviderGroup[];
    onOpenProviders: () => void;
}

type RightPaneState =
    | { mode: "closed" }
    | { mode: "step"; sessionId: string; stepId: string }
    | { mode: "code"; sessionId: string; code: string; language: string }
    | { mode: "tree"; sessionId: string };

function toggleTreeForSession(
    current: RightPaneState,
    sessionId: string,
): RightPaneState {
    return current.mode === "tree" && current.sessionId === sessionId
        ? { mode: "closed" }
        : { mode: "tree", sessionId };
}

/** Active session stage with turns, step/code/tree right pane, rewind, regenerate, and error retry. */
export function ActiveSessionView({
    sessionId,
    directory,
    modelOptions,
    providers,
    onOpenProviders,
}: ActiveSessionViewProps) {
    const { t } = useTranslation();
    const drawerId = useId();
    const session = useActiveSession(sessionId);
    const { model, selectModel } = useModelSelection(modelOptions);
    const [modelPickerOpen, setModelPickerOpen] = useState(false);
    const [focusTrigger, setFocusTrigger] = useState(0);
    const [pane, setPane] = useState<RightPaneState>({ mode: "closed" });

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (
                !isShortcutIgnored(event) &&
                (event.metaKey || event.ctrlKey) &&
                !event.altKey &&
                !event.shiftKey &&
                event.key.toLowerCase() === "k"
            ) {
                event.preventDefault();
                setPane((c) => toggleTreeForSession(c, sessionId));
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [sessionId]);

    const turns = groupTurns(session.items);
    const tree = buildSessionTree(session.treeMessages, session.leafId);
    const effectivePane =
        pane.mode !== "closed" && pane.sessionId === sessionId
            ? pane
            : ({ mode: "closed" } as const);
    const inspectedStep =
        effectivePane.mode === "step"
            ? turns
                  .flatMap((turn) => turn.steps)
                  .find((step) => step.id === effectivePane.stepId)
            : undefined;

    let activePane: ActiveRightPane | undefined;
    if (effectivePane.mode === "step" && inspectedStep !== undefined) {
        activePane = { mode: "step", step: inspectedStep };
    } else if (effectivePane.mode === "code") {
        activePane = {
            mode: "code",
            code: effectivePane.code,
            language: effectivePane.language,
        };
    } else if (effectivePane.mode === "tree") {
        activePane = { mode: "tree", ...tree };
    }

    const sendBranch = (
        providerId: string,
        selectedModel: string,
        content: string,
        explicitParentId?: string,
    ) => {
        void session
            .send(providerId, selectedModel, content, explicitParentId)
            .catch((error: unknown) => toast.error(errorText(error, t)));
    };

    const handleSelectTreeRow = (id: string) => {
        if (session.streaming) {
            return;
        }
        if (tree.rows.some((row) => row.id === id && row.kind === "question")) {
            session.startRewind(id);
            setFocusTrigger((count) => count + 1);
            setPane({ mode: "closed" });
            return;
        }
        void session
            .switchLeaf(id)
            .catch((error: unknown) => toast.error(errorText(error, t)));
    };

    const lastTurn = turns.at(-1);
    const lastReply = lastTurn?.finalReply;
    let dockState: ComposerDockState | undefined;
    if (session.rewind !== null) {
        dockState = { kind: "rewind", onRestore: () => session.cancelRewind() };
    } else if (
        !session.streaming &&
        lastTurn !== undefined &&
        lastReply?.status === "error"
    ) {
        dockState = {
            kind: "error",
            error: lastReply.error,
            retryModel: model?.model ?? lastReply.model,
            onRetry: () =>
                sendBranch(
                    model?.providerId ?? lastReply.providerId,
                    model?.model ?? lastReply.model,
                    lastTurn.userMessage.content,
                    lastTurn.userMessage.parentId ?? "",
                ),
            onSwitchModel: () => setModelPickerOpen(true),
        };
    }

    const running = session.streaming
        ? {
              stepLabel:
                  session.reconnectingOffset === null
                      ? session.currentStep?.kind === "tool"
                          ? t("agent.runningTool", {
                                name: session.currentStep.name,
                            })
                          : t("agent.thinkingInProgress")
                      : t("agent.reconnecting", {
                            offset: session.reconnectingOffset,
                        }),
              startedAtMs: session.turnStartedAtMs ?? undefined,
              warn: session.reconnectingOffset !== null,
              stopLabel: t("agent.stopShort"),
              onStop: () => void session.abort(),
          }
        : undefined;

    return (
        <SessionStage
            turns={turns.map((turn) => ({
                id: turn.id,
                label: turn.userMessage.content,
            }))}
            followTrigger={lastTurn?.id ?? null}
            drawerId={drawerId}
            onCloseDrawer={() => setPane({ mode: "closed" })}
            drawer={
                activePane === undefined ? undefined : (
                    <SessionRightPane
                        pane={activePane}
                        onSelectTreeRow={handleSelectTreeRow}
                        onSaveLabel={(id, label) =>
                            void session
                                .labelMessage(id, label)
                                .catch((e: unknown) =>
                                    toast.error(errorText(e, t)),
                                )
                        }
                        onClose={() => setPane({ mode: "closed" })}
                    />
                )
            }
            composer={
                <SessionComposer
                    sessionKey={sessionId}
                    onSubmit={
                        model === null
                            ? undefined
                            : (text) =>
                                  sendBranch(
                                      model.providerId,
                                      model.model,
                                      text,
                                  )
                    }
                    streaming={session.streaming}
                    focusTrigger={focusTrigger}
                    model={model}
                    providers={providers}
                    modelPickerOpen={modelPickerOpen}
                    onModelPickerOpenChange={setModelPickerOpen}
                    onSelectModel={selectModel}
                    onOpenProviders={onOpenProviders}
                    dock={
                        dockState === undefined ? undefined : (
                            <ComposerDock state={dockState} />
                        )
                    }
                    running={running}
                    directorySlot={
                        directory === undefined ? null : (
                            <SessionDirectoryBadge directory={directory} />
                        )
                    }
                    trailingFooter={
                        <button
                            type="button"
                            aria-expanded={effectivePane.mode === "tree"}
                            aria-controls={
                                activePane === undefined ? undefined : drawerId
                            }
                            onClick={() =>
                                setPane((c) =>
                                    toggleTreeForSession(c, sessionId),
                                )
                            }
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-small text-muted-foreground transition-colors duration-base hover:bg-selected hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <span
                                aria-hidden="true"
                                className="size-1.5 shrink-0 rounded-full bg-brand"
                            />
                            <span>
                                {t("session.treeButton", {
                                    count: tree.pathCount,
                                })}
                            </span>
                        </button>
                    }
                />
            }
        >
            <div className="flex flex-col gap-6">
                {turns.map((turn) => (
                    <TurnView
                        key={turn.id}
                        turn={turn}
                        activePaneStepId={inspectedStep?.id}
                        streaming={session.streaming}
                        onInspectStep={(step) =>
                            setPane({
                                mode: "step",
                                sessionId,
                                stepId: step.id,
                            })
                        }
                        onInspectCode={(code, language) =>
                            setPane({ mode: "code", sessionId, code, language })
                        }
                        onRegenerate={(targetTurn, reply) => {
                            const p = model?.providerId ?? reply.providerId;
                            const m = model?.model ?? reply.model;
                            if (p !== "" && m !== "") {
                                sendBranch(
                                    p,
                                    m,
                                    targetTurn.userMessage.content,
                                    targetTurn.userMessage.parentId ?? "",
                                );
                            }
                        }}
                    />
                ))}
                {session.reconnectingOffset !== null && (
                    <p className="text-small text-warning">
                        {t("agent.reconnecting", {
                            offset: session.reconnectingOffset,
                        })}
                    </p>
                )}
            </div>
        </SessionStage>
    );
}
