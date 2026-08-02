export {};

declare global {
    interface Window {
        Telegram?: {
            WebApp?: {
                initData?: string;
                ready?: () => void;
                expand?: () => void;
                openLink?: (url: string) => void;
            };
            Login?: {
                auth: (options: { bot_id: number; request_access: boolean }, callback: (user: unknown) => void) => void;
            };
        };
    }
}
