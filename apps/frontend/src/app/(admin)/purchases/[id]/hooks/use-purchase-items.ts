import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';

type TgPublishOutcome = {
    purchaseItemId: number;
    productName: string;
    ok: boolean;
    error?: string;
};

function showTgPublishToasts(outcomes: TgPublishOutcome[] | null | undefined) {
    if (!outcomes || outcomes.length === 0) return;

    const ok = outcomes.filter((o) => o.ok);
    const failed = outcomes.filter((o) => !o.ok);

    if (ok.length > 0) {
        toast.success(
            ok.length === 1
                ? `Опубликовано в Telegram: ${ok[0]?.productName ?? ''}`
                : `Опубликовано в Telegram: ${ok.length} постов`,
        );
    }

    if (failed.length > 0) {
        const first = failed[0]?.error ?? 'неизвестная ошибка';
        toast.error(
            failed.length === 1
                ? `Не опубликовано «${failed[0]?.productName ?? ''}»: ${first}`
                : `Не опубликовано ${failed.length} товаров. Причина: ${first}`,
        );
    }
}

export function useAddPurchaseItems(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.purchases.addItems.useMutation({
        onSuccess: (data) => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            toast.success('Товары добавлены');
            showTgPublishToasts(data?.tgPublish);
        },
        onError: (err) => toast.error(err.message),
    });
}

export function usePublishItemToTg(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.purchases.publishItemToTg.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            toast.success('Опубликовано в Telegram');
        },
        onError: (err) => toast.error(err.message),
    });
}

export function useRemovePurchaseItem(purchaseId: number) {
    const utils = trpc.useUtils();

    return trpc.purchases.removeItem.useMutation({
        onSuccess: () => {
            void utils.purchases.getById.invalidate({ id: purchaseId });
            toast.success('Товар удалён из закупки');
        },
        onError: (err) => toast.error(err.message),
    });
}
