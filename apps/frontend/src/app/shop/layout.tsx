import { ShopShell } from '@/components/shop/shop-shell';
import { PageContent } from '@/components/ui/page-content';

export default function ShopLayout({ children }: { children: React.ReactNode }) {
    return (
        <ShopShell>
            <PageContent>{children}</PageContent>
        </ShopShell>
    );
}
