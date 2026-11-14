import { motion, type Variants } from "motion/react";

import {
    getVariants,
    IconWrapper,
    type IconProps,
    useAnimateIconContext,
} from "@animate-ui/react/icons";

type CornerDownLeftProps = IconProps<keyof typeof animations>;

const animations = {
    default: {
        group: {
            initial: {
                x: 0,
                transition: { ease: "easeInOut", duration: 0.25 },
            },
            animate: {
                x: -2,
                transition: { ease: "easeInOut", duration: 0.25 },
            },
        },
    } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: CornerDownLeftProps) {
    const { controls } = useAnimateIconContext();
    const variants: Record<keyof (typeof animations)["default"], Variants> =
        getVariants(animations);
    const animate = controls === undefined ? {} : { animate: controls };

    return (
        <motion.svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <motion.g variants={variants.group} initial="initial" {...animate}>
                <polyline points="9 10 4 15 9 20" />
                <path d="M20 4v7a4 4 0 0 1-4 4H4" />
            </motion.g>
        </motion.svg>
    );
}

function CornerDownLeft(props: CornerDownLeftProps) {
    return <IconWrapper icon={IconComponent} {...props} />;
}

export {
    CornerDownLeft,
    CornerDownLeft as CornerDownLeftIcon,
    type CornerDownLeftProps,
    type CornerDownLeftProps as CornerDownLeftIconProps,
};
