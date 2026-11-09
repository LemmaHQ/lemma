import type { ComponentProps } from "react";

import { cn } from "#lib/cn";

/** Lemma's mark: the serif L in the current text color and the brand-blue dot, enlarged from the app icon so it stays visible at small sizes. It is decorative; pass `aria-hidden={false}` with an `aria-label` where it stands alone. */
function LemmaLogo({ className, ...props }: ComponentProps<"svg">) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="136 95 300 300"
            aria-hidden="true"
            className={cn("size-5 shrink-0", className)}
            {...props}
        >
            <path
                fill="currentColor"
                transform="translate(148.05 384) scale(3.7622)"
                d="M53.997509-25.205479H52.204234C51.407223-15.342466 50.11208-2.590286 33.075965-2.590286H23.81071C19.825654-2.590286 19.626401-3.088418 19.626401-6.475716V-60.871731C19.626401-64.458281 19.825654-65.454545 27.39726-65.454545H29.589041V-68.044832C25.504359-67.845579 20.722291-67.845579 16.637609-67.845579C13.549191-67.845579 7.970112-67.845579 5.080946-68.044832V-65.454545C11.955168-65.454545 13.051059-65.454545 13.051059-60.971357V-7.073474C13.051059-2.590286 11.955168-2.590286 5.080946-2.590286V0H51.606476L53.997509-25.205479Z"
            />
            <circle cx="388" cy="124" r="22" className="fill-brand" />
        </svg>
    );
}

export { LemmaLogo };
