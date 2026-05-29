'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

import { productPhotoUrl } from '@/lib/product-photo-url';

interface PhotoUploaderProps {
    photoIds: number[];
    onPhotoIdsChange: (ids: number[]) => void;
    productId: number;
    onDeletePhoto: (id: number) => Promise<void>;
}

type LocalPreview = { key: string; preview: string };

export function PhotoUploader({ photoIds, onPhotoIdsChange, productId, onDeletePhoto }: PhotoUploaderProps) {
    const [uploading, setUploading] = useState(false);
    const [localPreviews, setLocalPreviews] = useState<LocalPreview[]>([]);
    const [cacheVersion, setCacheVersion] = useState<Record<number, number>>({});
    const previewsRef = useRef(localPreviews);

    previewsRef.current = localPreviews;

    useEffect(() => {
        return () => {
            for (const p of previewsRef.current) URL.revokeObjectURL(p.preview);
        };
    }, []);

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files?.length) return;

        setUploading(true);
        const added: LocalPreview[] = Array.from(files).map((file) => ({
            key: crypto.randomUUID(),
            preview: URL.createObjectURL(file),
        }));
        setLocalPreviews((prev) => [...prev, ...added]);

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
                setCacheVersion((prev) => ({ ...prev, [id]: Date.now() }));
            }
            toast.success('Фото загружено');
        } catch {
            toast.error('Ошибка загрузки фото');
        } finally {
            for (const p of added) URL.revokeObjectURL(p.preview);
            setLocalPreviews((prev) => prev.filter((p) => !added.some((a) => a.key === p.key)));
            setUploading(false);
            e.target.value = '';
        }
    }

    async function handleRemovePhoto(photoId: number) {
        await onDeletePhoto(photoId);
        onPhotoIdsChange(photoIds.filter((id) => id !== photoId));
        setCacheVersion((prev) => {
            const next = { ...prev };
            delete next[photoId];
            return next;
        });
    }

    return (
        <div className="flex flex-wrap gap-2">
                {photoIds.map((id) => (
                    <div key={id} className="relative">
                        <img
                            src={productPhotoUrl(id, cacheVersion[id])}
                            alt=""
                            className="h-20 w-20 rounded-md object-cover"
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
