import { BrandLogo, InstagramIcon, PinterestIcon, TelegramCircleIcon, VkCircleIcon } from '@/components/icons';

const SOCIALS = [
    { label: 'Instagram', href: 'https://www.instagram.com/scheg.love', Icon: InstagramIcon },
    { label: 'Pinterest', href: 'https://ru.pinterest.com/SCHEGlove/', Icon: PinterestIcon },
    { label: 'Telegram', href: 'https://t.me/biser_zakupki', Icon: TelegramCircleIcon },
    { label: 'VK', href: 'https://vk.ru/biser_zakupki', Icon: VkCircleIcon },
];

const FOOTER_LINKS = ['японский и чешский бисер', 'фурнитура', 'инструменты', 'вдохновение'];

export function ShopFooter() {
    return (
        <footer className="mt-12">
            <div className="flex flex-col items-center gap-7 px-4 pb-9">
                <div className="flex items-center gap-4">
                    {SOCIALS.map(({ label, href, Icon }) => (
                        <a
                            key={label}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={label}
                            className="text-secondary transition-colors hover:text-primary"
                        >
                            <Icon className="size-10 sm:size-11" />
                        </a>
                    ))}
                </div>

                <p className="flex max-w-md flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-center text-14-regular text-secondary">
                    {FOOTER_LINKS.map((link, i) => (
                        <span key={link} className="flex items-center gap-3">
                            {i > 0 && <span aria-hidden className="size-1.5 rounded-full bg-secondary" />}
                            {link}
                        </span>
                    ))}
                </p>

                <BrandLogo className="w-[92px] text-secondary" />
            </div>

            <div
                className="bg-secondary py-2.5 text-center text-12-regular text-primary-foreground"
                style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
            >
                Россия г. Красноярск
            </div>
        </footer>
    );
}
