'use client';

import { useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

import type { PhotoUploaderProps } from '../../lib/types';

export function PhotoUploader({ photoIds, onPhotoIdsChange, productId, onDeletePhoto }: PhotoUploaderProps) {
    const [uploading, setUploading] = useState(false);

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files?.length) return;

        setUploading(true);
        try {
            for (const file of Array.from(files)) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('productId', String(productId));
                formData.append('sortOrder', String(photoIds.length));

                const res = await fetch('/api/upload', { method: 'POST', body: formData });
                if (!res.ok) throw new Error('Upload failed');
                const { id } = await res.json();
                onPhotoIdsChange([...photoIds, id]);
            }
            toast.success('Фото загружено');
        } catch {
            toast.error('Ошибка загрузки фото');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    }

    async function handleRemovePhoto(photoId: number) {
        await onDeletePhoto(photoId);
        onPhotoIdsChange(photoIds.filter((id) => id !== photoId));
    }

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Фото</label>
            <div className="flex flex-wrap gap-2">
                {photoIds.map((id) => (
                    <div key={id} className="relative">
                        <img
                            src={`/api/photos/${id}`}
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
                <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-md border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary">
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} disabled={uploading} />
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                </label>
            </div>
        </div>
    );
}
