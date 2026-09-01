'use client';

import { Loader2 } from 'lucide-react';

import { BrandLogo, TelegramOutlineIcon, VkOutlineIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';

type LoginFormProps = {
    onTelegramLogin: () => void;
    telegramLoading: boolean;
    onVkLogin: () => void;
    vkLoading: boolean;
    showVkButton: boolean;
    autoLoginFailed: boolean;
};

export function LoginForm({
    onTelegramLogin,
    telegramLoading,
    onVkLogin,
    vkLoading,
    showVkButton,
    autoLoginFailed,
}: LoginFormProps) {
    return (
        <div className="flex w-full flex-col items-center text-primary">
            <BrandLogo className="w-[124px] animate-fade-in-up sm:w-[180px]" />

            <div
                aria-hidden
                className="mt-[28px] flex w-[124px] animate-fade-in-up items-center gap-[13.6px] sm:mt-[26px] sm:w-[165px] sm:gap-[13.65px] [animation-delay:100ms]"
            >
                <span className="h-0.5 flex-1 rounded-full bg-primary" />
                <span className="size-[7.3px] rounded-full bg-primary sm:size-[9.7px]" />
                <span className="h-0.5 flex-1 rounded-full bg-primary" />
            </div>

            <p className="mt-[21px] animate-fade-in-up text-center text-12-regular sm:mt-[26px] sm:text-20-regular [animation-delay:200ms]">
                Совместные закупки
                <br />
                товаров для творчества
                <br />
                премиального качества.
            </p>

            {autoLoginFailed && (
                <p className="mt-6 rounded-xl bg-error-50 p-3 text-center text-13-regular text-error animate-fade-in">
                    Не удалось войти автоматически — воспользуйтесь кнопками ниже
                </p>
            )}

            <div className="mt-[29px] flex w-full animate-fade-in-up flex-col gap-[22px] sm:mt-8 sm:gap-6 [animation-delay:300ms]">
                {showVkButton && (
                    <Button
                        variant="secondary"
                        onClick={onVkLogin}
                        disabled={vkLoading}
                        className="relative w-full text-14-bold sm:text-16-bold"
                    >
                        {vkLoading ? (
                            <Loader2 className="absolute left-[14px] top-1/2 size-4 -translate-y-1/2 animate-spin sm:left-[11px]" />
                        ) : (
                            <VkOutlineIcon className="absolute left-[14px] top-1/2 size-[25px] -translate-y-1/2 sm:left-[11px]" />
                        )}
                        {vkLoading ? 'Авторизация…' : 'Войти через VK'}
                    </Button>
                )}

                <Button
                    variant="outline-primary"
                    onClick={onTelegramLogin}
                    disabled={telegramLoading}
                    className="relative w-full text-14-bold sm:text-16-bold"
                >
                    {telegramLoading ? (
                        <Loader2 className="absolute left-[14px] top-1/2 size-4 -translate-y-1/2 animate-spin sm:left-[11px]" />
                    ) : (
                        <TelegramOutlineIcon className="absolute left-[14px] top-1/2 size-[23px] -translate-y-1/2 sm:left-[11px]" />
                    )}
                    {telegramLoading ? 'Авторизация…' : 'Войти через Telegram'}
                </Button>
            </div>
        </div>
    );
}
