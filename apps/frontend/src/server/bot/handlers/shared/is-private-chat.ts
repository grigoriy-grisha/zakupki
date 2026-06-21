import type { CustomContext } from '../../domain/types';

/** Проверяет, что сообщение пришло в личке (не группе, не канале). */
export function isPrivateChat(ctx: CustomContext): boolean {
    return ctx.chat?.type === 'private';
}
