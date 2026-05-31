'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/client/trpc';

import { productPhotoUrl } from '@/lib/product-photo-url';

interface PhotoUploaderProps {
    photoIds: number[];
    onPhotoIdsChange: (ids: number[]) => void;
    productId: number;
    onDeletePhoto: (id: number) => Promise<void>;
}

type LocalPreview = { key: string; preview: string };

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
        await Promise.all([
            utils.products.list.invalidate(),
            utils.products.getById.invalidate({ id: productId }),
        ]);
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files?.length) return;

        setUploading(true);
        const added: LocalPreview[] = Array.from(files).map((file) => ({
            key: crypto.randomUUID(),
            preview: URL.createObjectURL(file),
        }));
        setLocalPreviews((prev) => [...prev, ...added]);

        const uploadedPreviewById = new Map<number, string>();

        try {
            let nextIds = photoIds;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const formData = new FormData();
                formData.append('file', file);
                formData.append('productId', String(productId));
                formData.append('sortOrder', String(nextIds.length));

                const res = await fetch('/api/upload', { method: 'POST', body: formData });
                if (!res.ok) throw new Error('Upload failed');
                const { id } = await res.json();
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
                    <button
                        type="button"
                        onClick={() => handleRemovePhoto(id)}
                        className="absolute -top-1 -right-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            ))}
            {localPreviews.map((p) => (
                <div key={p.key} className="relative opacity-70">
                    <img src={p.preview} alt="" className="h-20 w-20 rounded-md object-cover" />
                    {uploading && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/60">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    )}
                </div>
            ))}
            <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-md border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary">
                <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                />
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            </label>
        </div>
    );
}
