import { Archive, Send } from 'lucide-react';

import { cn } from '@/lib/utils';

const TELEGRAM_CONTACT = {
    handle: '@kind_of_girl',
    url: 'https://t.me/kind_of_girl',
};

const SHIP_DATA_ITEMS = [
    'Транспортная компания',
    'Город',
    'Адрес ПВЗ',
    'Номер телефона получателя',
    'Фамилия, Имя, Отчество',
    'Страховка посылки — на полную сумму заказа или минимальная (обычно 1 000–3 000 ₽, зависит от ТК)',
    'Какие закупки / заказы необходимо отправить вместе',
];

export type HandoffMessageStatus = 'READY_TO_SHIP' | 'STORED';

export function HandoffMessageCard({
    status,
    className,
}: {
    status: HandoffMessageStatus;
    className?: string;
}) {
    return (
        <div className={cn('rounded-2xl border border-border-low bg-bg-soft p-4', className)}>
            {status === 'READY_TO_SHIP' ? <ShipContent /> : <StoredContent />}
        </div>
    );
}

function ContactLink({ className }: { className?: string }) {
    return (
        <a
            href={TELEGRAM_CONTACT.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('font-medium text-primary underline-offset-2 hover:underline', className)}
        >
            {TELEGRAM_CONTACT.handle}
        </a>
    );
}

function ShipContent() {
    return (
        <div>
            <div className="flex items-center gap-2">
                <Send className="size-4 shrink-0 text-accent-teal" />
                <p className="text-14-semibold text-fg-primary">Готовим отправку</p>
            </div>
            <p className="mt-2 text-13-regular text-fg-secondary">
                Чтобы отправить заказ, напишите в ЛС <ContactLink /> следующие данные:
            </p>
            <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-13-regular text-fg-primary">
                {SHIP_DATA_ITEMS.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ol>
            <p className="mt-2.5 text-13-regular text-fg-secondary">
                После получения данных оформим заявку на доставку и сообщим сумму к оплате. После оплаты посылка
                будет передана в отправку.
            </p>
            <details className="group mt-3">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-13-semibold text-primary">
                    <span className="inline-block transition-transform group-open:rotate-90">▸</span>
                    Можно оформить доставку самостоятельно
                </summary>
                <div className="mt-2 space-y-1.5 border-l-2 border-border-low pl-3 text-13-regular text-fg-secondary">
                    <p>
                        Создайте отправление в удобной транспортной компании. Если для оформления потребуется фото
                        посылки — напишите нам, отправим.
                    </p>
                    <p>
                        После оформления пришлите в ЛС <ContactLink /> штрихкод, QR-код или номер отправления, который
                        нужно предъявить при передаче посылки. Так отправка уедет заметно быстрее.
                    </p>
                </div>
            </details>
        </div>
    );
}

function StoredContent() {
    return (
        <div>
            <div className="flex items-center gap-2">
                <Archive className="size-4 shrink-0 text-warning" />
                <p className="text-14-semibold text-fg-primary">Заказ на хранении</p>
            </div>
            <p className="mt-2 text-13-regular text-fg-secondary">
                Когда будете готовы получить заказ, напишите в ЛС <ContactLink />, какие закупки необходимо отправить
                вместе. Если к заказу добавятся новые закупки, их можно будет объединить в одну отправку.
            </p>
        </div>
    );
}
