import { AnimateIcon, Button, GithubIcon, Separator } from "@lemma/ui";
import { Navigate, Outlet } from "react-router";

import { useTitleBarSurface } from "@/app/shell/useTitleBarSurface";
import { useAuth } from "@/features/auth";
import { LanguageToggle, ThemeToggle } from "@/features/preferences";
import { VersionTags } from "@/features/system";

const REPOSITORY_URL = "https://github.com/LemmaHQ/lemma";

/** Page frame of the sign-in and sign-up routes; signed-in users go home. */
export function AuthLayout() {
    const user = useAuth((s) => s.user);

    useTitleBarSurface("background");
    if (user !== null) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="flex min-h-dvh flex-col bg-background">
            <header className="px-6 py-4">
                <span className="font-serif text-xl font-semibold">Lemma</span>
            </header>
            <main className="flex flex-1 items-center justify-center px-4 py-8">
                <div className="w-full max-w-sm animate-in duration-slow ease-enter fade-in-0 slide-in-from-bottom-2">
                    <Outlet />
                </div>
            </main>
            <footer className="flex items-center justify-between gap-4 px-4 pb-4">
                <div className="flex items-center gap-1">
                    <LanguageToggle />
                    <Separator
                        orientation="vertical"
                        className="h-4 data-vertical:self-center"
                    />
                    <ThemeToggle />
                </div>
                <div className="flex items-center gap-2">
                    <VersionTags />
                    <Separator
                        orientation="vertical"
                        className="h-4 data-vertical:self-center"
                    />
                    <AnimateIcon animateOnHover asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            nativeButton={false}
                            render={
                                <a
                                    href={REPOSITORY_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label="GitHub"
                                />
                            }
                        >
                            <GithubIcon />
                        </Button>
                    </AnimateIcon>
                </div>
            </footer>
        </div>
    );
}
