import { forwardRef } from 'react';
import type { SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement>;

export function createBrandIcon(displayName: string, path: string) {
    const Icon = forwardRef<SVGSVGElement, IconProps>(({ className, ...props }, ref) => (
        <svg ref={ref} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
            <path d={path} />
        </svg>
    ));
    Icon.displayName = displayName;
    return Icon;
}
