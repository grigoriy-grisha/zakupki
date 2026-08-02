/**
 * Вычисляет следующую позицию для сортировки.
 * Используется в репозиториях для автоматического добавления записей в конец списка.
 *
 * @param findFirst - функция, которая находит последнюю запись по position desc
 */
export async function getNextPosition(
    findFirst: (args: { orderBy: { position: 'desc' } }) => Promise<{ position: number } | null>,
): Promise<number> {
    const last = await findFirst({ orderBy: { position: 'desc' } });
    return (last?.position ?? -1) + 1;
}
