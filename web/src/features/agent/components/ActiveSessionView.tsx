import { ComposerBox, SessionStage, toast } from "@lemma/ui";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import { useActiveSession } from "../store";
import { buildSessionTree, groupTurns } from "../tree";
import type { ModelSelection } from "../useModelSelection";
import { ComposerDock, type ComposerDockState } from "./ComposerDock";
import { type ActiveRightPane, SessionRightPane } from "./SessionRightPane";
import { TurnView } from "./TurnView";

interface ActiveSessionViewProps {
    sessionId: string;
    draft: string;
    onDraftChange: (value: string) => void;
    onSubmit?: () => void;
    model: ModelSelection | null;
    sharedFooter: ReactNode;
    onOpenModelPicker: () => void;
}

type RightPaneState =
    | { mode: "closed" }
    | { mode: "step"; sessionId: string; stepId: string }
    | { mode: "code"; sessionId: string; code: string; language: string }
    | { mode: "tree"; sessionId: string };

/** Active session stage with turns, step/code/tree right pane, rewind, and error retry. */
export function ActiveSessionView({
    sessionId,
    draft,
    onDraftChange,
    onSubmit,
    model,
    sharedFooter,
    onOpenModelPicker,
}: ActiveSessionViewProps) {
    const { t } = useTranslation();
    const session = useActiveSession();
    const [pane, setPane] = useState<RightPaneState>({ mode: "closed" });
    const [fallbackStartMs] = useState(() => Date.now());

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (
                (event.metaKey || event.ctrlKey) &&
                !event.altKey &&
                !event.shiftKey &&
                event.key.toLowerCase() === "k"
            ) {
                event.preventDefault();
                setPane((current) =>
                    current.mode === "tree" && current.sessionId === sessionId
                        ? { mode: "closed" }
                        : { mode: "tree", sessionId },
                );
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [sessionId]);

    const turns = groupTurns(session.items);
    const tree = buildSessionTree(session.treeMessages, session.leafId, {
        filter: "all",
        search: "",
    });
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
        activePane = {
            mode: "tree",
            rows: tree.rows,
            pathCount: tree.pathCount,
        };
    }

    const handleSelectTreeRow = (id: string) => {
        const question = tree.rows.find(
            (row) => row.id === id && row.role === "user",
        );
        if (question === undefined) {
            void session.switchLeaf(id).catch((error: unknown) => {
                toast.error(errorText(error, t));
            });
            return;
        }
        if (session.streaming) {
            return;
        }
        session.startRewind(id);
        onDraftChange(question.text);
        setPane({ mode: "closed" });
    };

    const lastTurn = turns.at(-1);
    const lastReply = lastTurn?.finalReply;
    const retryTarget =
        session.rewind === null &&
        !session.streaming &&
        lastTurn !== undefined &&
        lastReply?.status === "error"
            ? { turn: lastTurn, reply: lastReply }
            : undefined;

    const errorDockState: ComposerDockState | undefined =
        retryTarget === undefined
            ? undefined
            : {
                  kind: "error",
                  error: retryTarget.reply.error,
                  retryModel: model?.model ?? retryTarget.reply.model,
                  onRetry: () => {
                      const retryProviderId =
                          model?.providerId ?? retryTarget.reply.providerId;
                      const retryModel =
                          model?.model ?? retryTarget.reply.model;
                      void session
                          .send(
                              retryProviderId,
                              retryModel,
                              retryTarget.turn.userMessage.content,
                              retryTarget.turn.userMessage.parentId ?? "",
                          )
                          .catch((error: unknown) => {
                              toast.error(errorText(error, t));
                          });
                  },
                  onSwitchModel: onOpenModelPicker,
              };
    const dockState: ComposerDockState | undefined =
        session.rewind === null
            ? errorDockState
            : {
                  kind: "rewind",
                  onRestore: () => {
                      session.cancelRewind();
                      onDraftChange("");
                  },
              };

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
              startedAtMs: session.turnStartedAtMs ?? fallbackStartMs,
              warn: session.reconnectingOffset !== null,
              stopLabel: t("agent.stopShort"),
              onStop: () => {
                  void session.abort();
              },
          }
        : undefined;

    return (
        <SessionStage
            paned={activePane !== undefined}
            turns={turns.map((turn) => ({
                id: turn.id,
                label: turn.userMessage.content,
            }))}
            outlineLabel={t("session.treeFilterQuestions")}
            onClosePane={() => setPane({ mode: "closed" })}
            {...(activePane === undefined
                ? {}
                : {
                      rightPane: (
                          <SessionRightPane
                              pane={activePane}
                              onSelectTreeRow={handleSelectTreeRow}
                              onSaveLabel={(id, label) => {
                                  void session
                                      .labelMessage(id, label)
                                      .catch((error: unknown) => {
                                          toast.error(errorText(error, t));
                                      });
                              }}
                              onClose={() => setPane({ mode: "closed" })}
                          />
                      ),
                  })}
            composer={
                <ComposerBox
                    value={draft}
                    onChange={onDraftChange}
                    {...(onSubmit === undefined ? {} : { onSubmit })}
                    placeholder={
                        model === null
                            ? t("session.noModelPlaceholder")
                            : t("session.inputPlaceholder")
                    }
                    sendLabel={t("session.send")}
                    disabled={model === null}
                    canSend={!session.streaming && draft.trim() !== ""}
                    {...(dockState === undefined
                        ? {}
                        : { dock: <ComposerDock state={dockState} /> })}
                    {...(running === undefined ? {} : { running })}
                    footerStart={
                        <>
                            {sharedFooter}
                            <button
                                type="button"
                                aria-pressed={effectivePane.mode === "tree"}
                                onClick={() =>
                                    setPane((current) =>
                                        current.mode === "tree" &&
                                        current.sessionId === sessionId
                                            ? { mode: "closed" }
                                            : { mode: "tree", sessionId },
                                    )
                                }
                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-small text-muted-foreground transition-colors duration-base hover:bg-selected hover:text-foreground"
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
                        </>
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
                        onInspectStep={(step) =>
                            setPane({
                                mode: "step",
                                sessionId,
                                stepId: step.id,
                            })
                        }
                        onInspectCode={(code, language) =>
                            setPane({
                                mode: "code",
                                sessionId,
                                code,
                                language,
                            })
                        }
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
