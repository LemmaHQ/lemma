import { AnimateIcon } from "@animate-ui/react/icons";
import { GithubIcon } from "@lemma/ui/components/brand/github";
import { Button } from "@lemma/ui/components/button";
import { Separator } from "@lemma/ui/components/separator";
import { useEffect } from "react";
import { Navigate, Outlet } from "react-router";

import { useAuth } from "@/features/auth/store";
import { LanguageToggle } from "@/features/preferences/LanguageToggle";
import { ThemeToggle } from "@/features/preferences/ThemeToggle";
import { setTitleBarSurface } from "@/features/preferences/theme";

import { VersionTags } from "./VersionTags";

const REPOSITORY_URL = "https://github.com/LemmaHQ/lemma";

/** Page frame of the sign-in and sign-up routes; signed-in users go home. */
export function AuthLayout() {
    const user = useAuth((s) => s.user);

    useEffect(() => {
        setTitleBarSurface("background");
    }, []);
    if (user !== null) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="flex min-h-dvh flex-col bg-background">
            <header className="px-6 py-4">
                <span className="font-serif text-xl font-semibold">Lemma</span>
            </header>
            <main className="flex flex-1 items-center justify-center px-4 py-8">
                <div className="w-full max-w-sm">
                    <Outlet />
                </div>
            </main>
            <footer className="flex items-center justify-between gap-4 px-4 pb-4">
                <div className="flex items-center gap-1">
                    <LanguageToggle />
                    <Separator orientation="vertical" className="h-4" />
                    <ThemeToggle />
                </div>
                <div className="flex items-center gap-2">
                    <VersionTags />
                    <Separator orientation="vertical" className="h-4" />
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
