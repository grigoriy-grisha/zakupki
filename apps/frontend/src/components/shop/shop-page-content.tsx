import { cn } from '@/lib/utils';

function ShopPageContent({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('flex flex-1 flex-col px-4 pb-10 pt-8 sm:px-8 sm:pt-10', className)}>
            <div className="mx-auto flex w-full max-w-[1362px] flex-1 flex-col">{children}</div>
        </div>
    );
}

export { ShopPageContent };
