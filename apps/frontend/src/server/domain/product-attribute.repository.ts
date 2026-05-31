import { dbClient } from '@zakupki/database';

export class ProductAttributeRepository {
    constructor() {}

    async list(typeId?: number) {
        return dbClient.productAttribute.findMany({
            where: typeId ? { typeId } : undefined,
            orderBy: [{ typeId: 'asc' }, { name: 'asc' }],
            include: {
                characteristics: { include: { characteristic: true }, orderBy: { characteristic: { position: 'asc' } } },
            },
        });
    }

    async create(data: { typeId: number; name: string; characteristicIds?: number[] }) {
        const { characteristicIds, ...rest } = data;
        return dbClient.productAttribute.create({
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
            return dbClient.productAttribute.findUniqueOrThrow({
                where: { id },
                include: {
                    characteristics: {
                        include: { characteristic: true },
                        orderBy: { characteristic: { position: 'asc' } },
                    },
                },
            });
        }
        return dbClient.productAttribute.update({
            where: { id },
            data: rest,
            include: {
                characteristics: { include: { characteristic: true }, orderBy: { characteristic: { position: 'asc' } } },
            },
        });
    }

    async setCharacteristics(attributeId: number, characteristicIds: number[]) {
        await dbClient.$transaction([
            dbClient.productAttributeCharacteristic.deleteMany({ where: { attributeId } }),
            ...(characteristicIds.length > 0
                ? [
                      dbClient.productAttributeCharacteristic.createMany({
                          data: characteristicIds.map((characteristicId) => ({ attributeId, characteristicId })),
                      }),
                  ]
                : []),
        ]);
    }

    async delete(id: number) {
        return dbClient.productAttribute.delete({ where: { id } });
    }
}
