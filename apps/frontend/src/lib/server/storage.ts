import { dbClient } from '@zakupki/database';

export interface IStorage {
    upload(productId: number, data: Uint8Array, mimeType: string, sortOrder: number): Promise<number>;
    read(id: number): Promise<{ data: Uint8Array; mimeType: string } | null>;
    delete(id: number): Promise<void>;
}

export class DbStorage implements IStorage {
    async upload(productId: number, data: Uint8Array, mimeType: string, sortOrder: number): Promise<number> {
        const photo = await dbClient.productPhoto.create({
            data: { productId, data: new Uint8Array(data), mimeType, sortOrder },
        });
        return photo.id;
    }

    async read(id: number): Promise<{ data: Uint8Array; mimeType: string } | null> {
        const photo = await dbClient.productPhoto.findUnique({ where: { id } });
        if (!photo) return null;
        return { data: new Uint8Array(photo.data), mimeType: photo.mimeType };
    }

    async delete(id: number): Promise<void> {
        await dbClient.productPhoto.delete({ where: { id } });
    }
}

// S3Storage — future implementation:
// export class S3Storage implements IStorage {
//   async upload(productId, data, mimeType, sortOrder) { ... }
//   async read(id) { ... }
//   async delete(id) { ... }
// }

export const storage: IStorage = new DbStorage();
