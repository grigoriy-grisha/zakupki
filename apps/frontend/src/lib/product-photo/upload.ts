export async function uploadProductPhoto(file: File, productId: number, sortOrder: number): Promise<number> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('productId', String(productId));
    formData.append('sortOrder', String(sortOrder));
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Upload failed');
    const { id } = await res.json();
    return id;
}
