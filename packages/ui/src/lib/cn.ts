import { createCn } from "cn/config";

/** Joins class names and resolves Tailwind conflicts, treating the theme's type roles as font sizes rather than text colors. */
export const cn = createCn({
    extend: {
        classGroups: {
            "font-size": [
                {
                    text: [
                        "caption",
                        "small",
                        "body",
                        "reading",
                        "title",
                        "display",
                    ],
                },
            ],
        },
    },
});
