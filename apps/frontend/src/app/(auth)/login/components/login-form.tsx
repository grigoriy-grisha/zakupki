'use client';

import { Loader2 } from 'lucide-react';

import { TelegramIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';

type LoginFormProps = {
    onTelegramLogin: () => void;
    telegramLoading: boolean;
    autoLoginFailed: boolean;
};

export function LoginForm({ onTelegramLogin, telegramLoading, autoLoginFailed }: LoginFormProps) {
    return (
        <div className="flex w-full flex-col">
            <div className="flex flex-col items-center text-center animate-fade-in-up">
                <h2 className="mt-5 text-h1 text-fg-primary">
                    С возвращением!
                </h2>
            </div>

            {autoLoginFailed && (
                <p className="mt-6 rounded-xl bg-error-50 p-3 text-13-regular text-error animate-fade-in">
                    Не удалось войти автоматически — воспользуйтесь кнопками ниже
                </p>
            )}

            <div className="mt-8 flex flex-col gap-4 animate-fade-in-up [animation-delay:100ms]">
                <Button
                    onClick={onTelegramLogin}
                    disabled={telegramLoading}
                    size="lg"
                    className="h-11 w-full rounded-full bg-telegram text-telegram-foreground hover:bg-telegram/90"
                >
                    {telegramLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <TelegramIcon className="size-4" />
                    )}
                    {telegramLoading ? 'Авторизация…' : 'Продолжить с Telegram'}
                </Button>

                <div aria-hidden className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-12-regular text-fg-tertiary">или</span>
                    <span className="h-px flex-1 bg-border" />
                </div>

                <div className="flex min-h-[44px] w-full justify-center">
                    <div id="vk-widget" />
                </div>
            </div>

            <p className="mt-8 text-center text-12-regular text-fg-tertiary animate-fade-in [animation-delay:300ms]">
                Продолжая, вы соглашаетесь с условиями сервиса
            </p>
        </div>
    );
}
