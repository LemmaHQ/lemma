/** The final path segment of each settings page. */
export type SettingsSegment = "appearance" | "providers" | "web";

/** URL paths of the app's routes. */
export const paths = {
    home: "/",
    signIn: "/signin",
    signUp: "/signup",
    settings: "/settings",
    session: (id: string) => `/sessions/${id}`,
    settingsPage: (segment: SettingsSegment) => `/settings/${segment}`,
};
