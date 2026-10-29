import { motion, type Variants } from "motion/react";

import {
    getVariants,
    IconWrapper,
    useAnimateIconContext,
    type IconProps,
} from "@animate-ui/react/icons";

type ChevronUpDownProps = IconProps<keyof typeof animations>;

const animations = {
    default: {
        path1: {
            initial: {
                y: 0,
                transition: { duration: 0.3, ease: "easeInOut" },
            },
            animate: {
                y: 3,
                transition: { duration: 0.3, ease: "easeInOut" },
            },
        },
        path2: {
            initial: {
                y: 0,
                transition: { duration: 0.3, ease: "easeInOut" },
            },
            animate: {
                y: -3,
                transition: { duration: 0.3, ease: "easeInOut" },
            },
        },
    } satisfies Record<string, Variants>,
    "default-loop": {
        path1: {
            initial: {
                y: 0,
            },
            animate: {
                y: [0, 3, 0],
                transition: { duration: 0.6, ease: "easeInOut" },
            },
        },
        path2: {
            initial: {
                y: 0,
            },
            animate: {
                y: [0, -3, 0],
                transition: { duration: 0.6, ease: "easeInOut" },
            },
        },
    } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: ChevronUpDownProps) {
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
            <motion.path
                d="m7 15 5 5 5-5"
                variants={variants.path1}
                initial="initial"
                {...animate}
            />
            <motion.path
                d="m7 9 5-5 5 5"
                variants={variants.path2}
                initial="initial"
                {...animate}
            />
        </motion.svg>
    );
}

function ChevronUpDown(props: ChevronUpDownProps) {
    return <IconWrapper icon={IconComponent} {...props} />;
}

export {
    ChevronUpDown,
    ChevronUpDown as ChevronUpDownIcon,
    type ChevronUpDownProps,
    type ChevronUpDownProps as ChevronUpDownIconProps,
};
