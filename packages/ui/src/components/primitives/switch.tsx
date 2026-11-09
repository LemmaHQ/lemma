import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "#lib/cn";

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
    return (
        <SwitchPrimitive.Root
            data-slot="switch"
            className={cn(
                "peer group/switch relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-all outline-none group-has-[:focus-visible]/field-label:ring-0 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:ring-3 aria-invalid:ring-destructive-ring data-checked:bg-primary data-unchecked:bg-track data-disabled:cursor-not-allowed data-disabled:opacity-50",
                className,
            )}
            {...props}
        >
            <SwitchPrimitive.Thumb
                data-slot="switch-thumb"
                className="pointer-events-none block size-4 rounded-full bg-thumb ring-0 transition-transform motion-reduce:transition-none group-data-checked/switch:translate-x-5 group-data-unchecked/switch:translate-x-0"
            />
        </SwitchPrimitive.Root>
    );
}

export { Switch };
