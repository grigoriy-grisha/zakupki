import type { PrismaClient } from '@zakupki/database';

export class ProductAttributeRepository {
    constructor(private db: PrismaClient) {}

    async list(typeId?: number) {
        return this.db.productAttribute.findMany({
            where: typeId ? { typeId } : undefined,
            orderBy: [{ typeId: 'asc' }, { name: 'asc' }],
            include: {
                characteristics: { include: { characteristic: true }, orderBy: { characteristic: { position: 'asc' } } },
            },
        });
    }

    async create(data: { typeId: number; name: string; characteristicIds?: number[] }) {
        const { characteristicIds, ...rest } = data;
        return this.db.productAttribute.create({
            data: {
                ...rest,
                ...(characteristicIds?.length
                    ? {
                          characteristics: {
                              create: characteristicIds.map((characteristicId) => ({ characteristicId })),
                          },
                      }
                    : {}),
            },
            include: {
                characteristics: { include: { characteristic: true }, orderBy: { characteristic: { position: 'asc' } } },
            },
        });
    }

    async update(id: number, data: { name?: string; characteristicIds?: number[] }) {
        const { characteristicIds, ...rest } = data;
        if (characteristicIds !== undefined) {
            await this.setCharacteristics(id, characteristicIds);
        }
        if (Object.keys(rest).length === 0) {
            return this.db.productAttribute.findUniqueOrThrow({
                where: { id },
                include: {
                    characteristics: {
                        include: { characteristic: true },
                        orderBy: { characteristic: { position: 'asc' } },
                    },
                },
            });
        }
        return this.db.productAttribute.update({
            where: { id },
            data: rest,
            include: {
                characteristics: { include: { characteristic: true }, orderBy: { characteristic: { position: 'asc' } } },
            },
        });
    }

    async setCharacteristics(attributeId: number, characteristicIds: number[]) {
        await this.db.$transaction([
            this.db.productAttributeCharacteristic.deleteMany({ where: { attributeId } }),
            ...(characteristicIds.length > 0
                ? [
                      this.db.productAttributeCharacteristic.createMany({
                          data: characteristicIds.map((characteristicId) => ({ attributeId, characteristicId })),
                      }),
                  ]
                : []),
        ]);
    }

    async delete(id: number) {
        return this.db.productAttribute.delete({ where: { id } });
    }
}
