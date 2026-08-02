import { dbClient } from '@zakupki/database';

export class ProductAttributeRepository {
    constructor() {}

    async list(typeId?: number) {
        return dbClient.productAttribute.findMany({
            where: typeId ? { typeId } : undefined,
            orderBy: [{ typeId: 'asc' }, { name: 'asc' }],
            include: {
                characteristics: {
                    include: { characteristic: true },
                    orderBy: [{ position: 'asc' }, { characteristicId: 'asc' }],
                },
            },
        });
    }

    async create(data: {
        typeId: number;
        name: string;
        isBrand?: boolean;
        parentId?: number | null;
        showInTitle?: boolean;
        characteristicIds?: number[];
    }) {
        const { characteristicIds, ...rest } = data;
        const isBrand = rest.isBrand ?? false;
        const parentId = rest.parentId ?? null;

        if (isBrand && parentId != null) {
            throw new Error('Бренд не может иметь родителя');
        }
        if (parentId != null) {
            if (isBrand) {
                throw new Error('Под брендом можно добавить только значение');
            }
            const parent = await dbClient.productAttribute.findUnique({ where: { id: parentId } });
            if (!parent?.isBrand) {
                throw new Error('Значение можно добавить только под бренд');
            }
            if (parent.typeId !== rest.typeId) {
                throw new Error('Бренд и значение должны относиться к одному типу');
            }
        }

        return dbClient.productAttribute.create({
            data: {
                typeId: rest.typeId,
                name: rest.name,
                isBrand: rest.isBrand ?? false,
                showInTitle: rest.showInTitle ?? true,
                parentId: rest.parentId ?? null,
                ...(characteristicIds?.length
                    ? {
                          characteristics: {
                              create: characteristicIds.map((characteristicId, position) => ({
                                  characteristicId,
                                  position,
                              })),
                          },
                      }
                    : {}),
            },
            include: {
                characteristics: {
                    include: { characteristic: true },
                    orderBy: [{ position: 'asc' }, { characteristicId: 'asc' }],
                },
            },
        });
    }

    async update(id: number, data: { name?: string; showInTitle?: boolean; characteristicIds?: number[] }) {
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
                        orderBy: [{ position: 'asc' }, { characteristicId: 'asc' }],
                    },
                },
            });
        }
        return dbClient.productAttribute.update({
            where: { id },
            data: rest,
            include: {
                characteristics: {
                    include: { characteristic: true },
                    orderBy: [{ position: 'asc' }, { characteristicId: 'asc' }],
                },
            },
        });
    }

    async setCharacteristics(attributeId: number, characteristicIds: number[]) {
        await dbClient.$transaction([
            dbClient.productAttributeCharacteristic.deleteMany({ where: { attributeId } }),
            ...(characteristicIds.length > 0
                ? [
                      dbClient.productAttributeCharacteristic.createMany({
                          data: characteristicIds.map((characteristicId, position) => ({
                              attributeId,
                              characteristicId,
                              position,
                          })),
                      }),
                  ]
                : []),
        ]);
    }

    async delete(id: number) {
        return dbClient.productAttribute.delete({ where: { id } });
    }
}
