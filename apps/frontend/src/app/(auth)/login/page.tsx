'use client';

export default function LoginPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-lg">
                <div className="mb-8 text-center">
                    <h1 className="text-2xl font-bold">Закупки</h1>
                    <p className="mt-2 text-sm text-muted-foreground">Войдите, чтобы продолжить</p>
                </div>

                <div className="flex flex-col items-center gap-4">
                    <div id="vk-widget" className="w-full min-h-[44px]" />
                </div>
            </div>
        </div>
    );
}
