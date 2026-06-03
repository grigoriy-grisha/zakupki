import { ShoppingCart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export interface EmptyStateProps {
    title: string;
    description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
    return (
        <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="mt-4 text-lg font-medium">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </CardContent>
        </Card>
    );
}
