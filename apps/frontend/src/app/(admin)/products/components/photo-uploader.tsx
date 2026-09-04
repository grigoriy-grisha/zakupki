'use client';

import { Loader2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/client/trpc';
import { uploadProductPhoto } from '@/lib/product-photo/upload';
import { productPhotoUrl } from '@/lib/product-photo-url';

interface PhotoUploaderProps {
    photoIds: number[];
    onPhotoIdsChange: (ids: number[]) => void;
    productId: number;
    onDeletePhoto: (id: number) => Promise<void>;
}

type LocalPreview = { key: string; preview: string };

/** Mime types Telegram accepts in sendPhoto; anything else would fail to publish. */
const TELEGRAM_SUPPORTED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function PhotoUploader({ photoIds, onPhotoIdsChange, productId, onDeletePhoto }: PhotoUploaderProps) {
    const utils = trpc.useUtils();
    const [uploading, setUploading] = useState(false);
    const [localPreviews, setLocalPreviews] = useState<LocalPreview[]>([]);
    const [previewByPhotoId, setPreviewByPhotoId] = useState<Record<number, string>>({});
    const [cacheVersion, setCacheVersion] = useState<Record<number, number>>({});
    const previewsRef = useRef(localPreviews);
    const previewByPhotoIdRef = useRef(previewByPhotoId);

    previewsRef.current = localPreviews;
    previewByPhotoIdRef.current = previewByPhotoId;

    useEffect(() => {
        return () => {
            for (const p of previewsRef.current) URL.revokeObjectURL(p.preview);
            for (const url of Object.values(previewByPhotoIdRef.current)) URL.revokeObjectURL(url);
        };
    }, []);

    async function refreshProductPhotos() {
        await Promise.all([utils.products.list.invalidate(), utils.products.getById.invalidate({ id: productId })]);
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files?.length) return;

        // Telegram Bot API rejects other formats (AVIF from phones is a common
        // case) with IMAGE_PROCESS_FAILED, so skip them and warn right away.
        const supported = Array.from(files).filter((file) => TELEGRAM_SUPPORTED_PHOTO_TYPES.has(file.type));
        for (const file of Array.from(files)) {
            if (file.type && !TELEGRAM_SUPPORTED_PHOTO_TYPES.has(file.type)) {
                toast.warning(`«${file.name}»: формат не поддерживается Telegram. Используйте JPEG, PNG или WebP`);
            }
        }
        if (!supported.length) {
            e.target.value = '';
            return;
        }

        setUploading(true);
        const added: LocalPreview[] = supported.map((file) => ({
            key: crypto.randomUUID(),
            preview: URL.createObjectURL(file),
        }));
        setLocalPreviews((prev) => [...prev, ...added]);

        const uploadedPreviewById = new Map<number, string>();

        try {
            let nextIds = photoIds;
            for (let i = 0; i < supported.length; i++) {
                const id = await uploadProductPhoto(supported[i], productId, nextIds.length);
                nextIds = [...nextIds, id];
                onPhotoIdsChange(nextIds);
                uploadedPreviewById.set(id, added[i]?.preview ?? '');
                setCacheVersion((prev) => ({ ...prev, [id]: Date.now() }));
            }

            setPreviewByPhotoId((prev) => {
                const next = { ...prev };
                for (const [photoId, preview] of uploadedPreviewById) {
                    next[photoId] = preview;
                }
                return next;
            });

            await refreshProductPhotos();
            toast.success('Фото загружено');
        } catch {
            for (const preview of uploadedPreviewById.values()) {
                URL.revokeObjectURL(preview);
            }
            toast.error('Ошибка загрузки фото');
        } finally {
            for (const p of added) {
                if (![...uploadedPreviewById.values()].includes(p.preview)) {
                    URL.revokeObjectURL(p.preview);
                }
            }
            setLocalPreviews((prev) => prev.filter((p) => !added.some((a) => a.key === p.key)));
            setUploading(false);
            e.target.value = '';
        }
    }

    function handlePhotoLoaded(photoId: number) {
        setPreviewByPhotoId((prev) => {
            const preview = prev[photoId];
            if (!preview) return prev;
            URL.revokeObjectURL(preview);
            const next = { ...prev };
            delete next[photoId];
            return next;
        });
    }

    async function handleRemovePhoto(photoId: number) {
        await onDeletePhoto(photoId);
        onPhotoIdsChange(photoIds.filter((id) => id !== photoId));
        setPreviewByPhotoId((prev) => {
            const preview = prev[photoId];
            if (preview) URL.revokeObjectURL(preview);
            const next = { ...prev };
            delete next[photoId];
            return next;
        });
        setCacheVersion((prev) => {
            const next = { ...prev };
            delete next[photoId];
            return next;
        });
        await refreshProductPhotos();
    }

    return (
        <div className="flex flex-wrap gap-2">
            {photoIds.map((id) => (
                <div key={id} className="relative">
                    <img
                        src={previewByPhotoId[id] ?? productPhotoUrl(id, cacheVersion[id])}
                        alt=""
                        className="h-20 w-20 rounded-md object-cover"
                        onLoad={() => handlePhotoLoaded(id)}
                    />
                    <Button
                        type="button"
                        variant="destructive"
                        size="icon-xs"
                        aria-label="Удалить фото"
                        onClick={() => handleRemovePhoto(id)}
                        className="absolute -top-1 -right-1 size-5 rounded-full p-0 text-error-foreground hover:bg-error/90"
                    >
                        <X className="size-3" />
                    </Button>
                </div>
            ))}
            {localPreviews.map((p) => (
                <div key={p.key} className="relative opacity-70">
                    <img src={p.preview} alt="" className="h-20 w-20 rounded-md object-cover" />
                    {uploading && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-bg-base/60">
                            <Loader2 className="size-5 animate-spin" />
                        </div>
                    )}
                </div>
            ))}
            <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-md border-2 border-dashed text-fg-secondary hover:border-primary hover:text-primary">
                <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                />
                {uploading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
            </label>
        </div>
    );
}
