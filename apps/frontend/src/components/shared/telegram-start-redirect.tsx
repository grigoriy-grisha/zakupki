'use client';

import { useEffect } from 'react';

import { useAppRouter } from '@/lib/hooks/use-app-router';
import { parseTelegramStartParamFromQuery, shopPathForStartTarget } from '@/lib/telegram-start-param';

/**
 * Telegram открывает мини-апп по прямой ссылке с ?tgWebAppStartParam=... на том
 * URL, который прописан в BotFather, — какой бы это ни был маршрут. Компонент в
 * root layout перехватывает параметр на любом пути и уводит на целевую страницу.
 * Вход мини-аппа (/webapp) не трогаем — там своя схема с авторизацией.
 */
export function TelegramStartRedirect() {
    const router = useAppRouter();

    useEffect(() => {
        const target = parseTelegramStartParamFromQuery(window.location.search);
        if (!target) return;

        const appPathname = window.location.pathname.replace(/^\/(tg|vk)/, '');
        const targetPath = shopPathForStartTarget(target);
        if (appPathname === targetPath || appPathname === '/webapp' || appPathname === '/login') return;

        router.replace(targetPath);
    }, [router]);

    return null;
}
