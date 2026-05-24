export type AppRoute = {
    path: string;
    label: string;
};

export type TelegramLoginApi = {
    auth: (options: { bot_id: number; request_access: boolean }, callback: (data: unknown) => void) => void;
};
