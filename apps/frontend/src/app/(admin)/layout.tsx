import { AdminShell } from '@/components/admin/admin-shell';
import { PageContent } from '@/components/ui/page-content';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <AdminShell>
            <PageContent>{children}</PageContent>
        </AdminShell>
    );
}
