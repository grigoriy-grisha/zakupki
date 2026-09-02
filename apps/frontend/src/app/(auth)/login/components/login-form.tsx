'use client';

import { Loader2 } from 'lucide-react';

import { AppLink } from '@/components/app-link';
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
                        className="w-full text-14-bold sm:text-16-bold"
                    >
                        {vkLoading ? (
                            <Loader2 className="size-5 animate-spin" />
                        ) : (
                            <VkOutlineIcon className="size-[25px]" />
                        )}
                        {vkLoading ? 'Авторизация…' : 'Войти через VK'}
                    </Button>
                )}

                <Button
                    variant="outline-primary"
                    onClick={onTelegramLogin}
                    disabled={telegramLoading}
                    className="w-full text-14-bold sm:text-16-bold"
                >
                    {telegramLoading ? (
                        <Loader2 className="size-5 animate-spin" />
                    ) : (
                        <TelegramOutlineIcon className="size-[23px]" />
                    )}
                    {telegramLoading ? 'Авторизация…' : 'Войти через Telegram'}
                </Button>
            </div>

            <p className="mt-6 max-w-[320px] animate-fade-in-up text-center text-12-regular leading-relaxed text-fg-tertiary [animation-delay:400ms] sm:max-w-sm sm:text-13-regular">
                Регистрируясь, вы подтверждаете{' '}
                <AppLink href="/privacy" className="underline underline-offset-2 hover:text-primary">
                    согласие на обработку персональных данных
                </AppLink>
            </p>
        </div>
    );
}
