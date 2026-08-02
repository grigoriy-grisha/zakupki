import * as React from 'react';

type LogoIconProps = {
    size?: number;
    className?: string;
};

/**
 * Минималистичный логотип «Закупки»: стилизованная монограмма в виде
 * покупательской корзины с лёгкими штрихами (stroke 1.5, Claude-look).
 */
export function LogoIcon({ size = 26, className }: LogoIconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 26 26"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-hidden
        >
            <rect x="2" y="2" width="22" height="22" rx="7" fill="currentColor" opacity="0.08" />
            <path
                d="M7 9.5h1.6l1.4 7.2c.07.4.42.7.83.7h6.4c.38 0 .72-.27.79-.64l1.1-5.4a.83.83 0 0 0-.81-1.01H9.9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx="11" cy="20.5" r="1" fill="currentColor" />
            <circle cx="16.5" cy="20.5" r="1" fill="currentColor" />
        </svg>
    );
}
