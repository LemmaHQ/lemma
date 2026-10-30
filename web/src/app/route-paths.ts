/** The final path segment of each settings section. */
export type SettingsSegment = "appearance" | "providers";

/** URL paths of the app's routes. */
export const paths = {
    home: "/",
    signIn: "/signin",
    signUp: "/signup",
    settings: "/settings",
    conversation: (id: string) => `/conversations/${id}`,
    settingsSection: (segment: SettingsSegment) => `/settings/${segment}`,
};
