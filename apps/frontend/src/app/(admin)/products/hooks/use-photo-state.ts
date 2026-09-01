'use client';

import { useEffect, useRef, useState } from 'react';

import { type PendingFile, revokePendingFiles } from '@/lib/product-form-utils';

export function usePhotoState(editId: number | null, existingPhotos?: { id: number }[]) {
    const [photoIds, setPhotoIds] = useState<number[]>([]);
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const pendingFilesRef = useRef(pendingFiles);
    pendingFilesRef.current = pendingFiles;

    // Cleanup pending files on unmount
    useEffect(() => {
        return () => revokePendingFiles(pendingFilesRef.current);
    }, []);

    // Sync photo IDs from existing product data
    useEffect(() => {
        if (editId && existingPhotos) {
            const serverPhotoIds = existingPhotos.map((p) => p.id);
            setPhotoIds((prev) => {
                if (prev.join(',') === serverPhotoIds.join(',')) return prev;
                return serverPhotoIds;
            });
        }
    }, [editId, existingPhotos]);

    // Reset when switching to create mode
    useEffect(() => {
        if (editId == null) {
            setPhotoIds([]);
            setPendingFiles((prev) => {
                revokePendingFiles(prev);
                return [];
            });
        }
    }, [editId]);

    return { photoIds, setPhotoIds, pendingFiles, setPendingFiles };
}
