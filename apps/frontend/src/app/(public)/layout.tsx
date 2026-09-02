import { ShopFooter } from '@/components/shop/shop-footer';
import { ShopHeader } from '@/components/shop/shop-header';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-[100dvh] flex-col bg-bg-base">
            <ShopHeader />
            <main className="min-w-0 flex-1">{children}</main>
            <ShopFooter />
        </div>
    );
}
