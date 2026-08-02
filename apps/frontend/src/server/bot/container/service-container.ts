import type { Api } from 'grammy';
import { getRedisConnection, type RedisClient } from '@zakupki/queue';
import { dbClient, type PrismaClient } from '@zakupki/database';

import type { BotConfig } from '../config/bot-config';
import { TgClient } from '../lib/tg-client';
import { ChannelDiscussion } from '../lib/channel-discussion';
import { DiscussionMessageStore } from '../lib/discussion-message-store';
import { NotificationRepository } from '../../domain/notification.repository';
import { UserRepository } from '../../domain/user.repository';
import { SettingsService } from '../../services/settings/settings.service';
import { PricingSettingsService } from '../../services/settings/pricing-settings';
import { PurchaseItemResolver } from '../services/purchase-item-resolver';
import { OrderCollectionService } from '../services/order-collection.service';
import { TgPostWorker } from '../services/tg-post-worker';
import { UserDmWorker } from '../services/user-dm-worker';
import { BotUserService } from '../services/bot/bot-user.service';
import { BotOrderService } from '../services/bot/bot-order.service';
import { BotPaymentService } from '../services/bot/bot-payment.service';
import { BotProductRenderer } from '../services/bot/bot-product-renderer.service';
import { PurchasePaymentGuard } from '../lib/purchase-payment-guard';
import { PaymentFlowStateMachine } from '../services/payment-flow-state-machine';

/**
 * ServiceContainer — единая точка владения всеми долгоживущими сервисами бота.
 *
 * Конструируется один раз в start.ts, затем пробрасывается в HandlerRegistry,
 * middleware и хендлеры через конструктор.
 *
 * Lifecycle:
 *  1. `new ServiceContainer(cfg)` — сервисы инициализируются (без api/api-зависимостей).
 *  2. `await container.init()` — инициализирует ChannelDiscussion и ставит TgPostWorker.
 *     Должен быть вызван ДО `bot.start()` — иначе первый же job может упасть
 *     из-за незагруженного linkedDiscussionChatId.
 */
export class ServiceContainer {
    readonly cfg: BotConfig;
    readonly db: PrismaClient;
    readonly redis: RedisClient;

    // Сервисы, которым нужен Api (устанавливаются через initBotApi)
    private _tg: TgClient | null = null;
    private _discussion: ChannelDiscussion | null = null;
    private _worker: TgPostWorker | null = null;
    private _dmWorker: UserDmWorker | null = null;

    // Независимые от Api сервисы
    readonly discussionStore: DiscussionMessageStore;
    readonly purchaseItemResolver: PurchaseItemResolver;
    readonly pricingSettings: PricingSettingsService;
    readonly orderCollection: OrderCollectionService;
    readonly userService: BotUserService;
    readonly orderService: BotOrderService;
    readonly paymentService: BotPaymentService;
    readonly paymentGuard: PurchasePaymentGuard;
    readonly productRenderer: BotProductRenderer;

    constructor(cfg: BotConfig) {
        this.cfg = cfg;
        this.db = dbClient;
        this.redis = getRedisConnection();

        this.discussionStore = new DiscussionMessageStore(this.redis);
        this.purchaseItemResolver = new PurchaseItemResolver(this.redis);
        this.pricingSettings = new PricingSettingsService(new SettingsService());
        this.orderCollection = new OrderCollectionService(this.purchaseItemResolver);

        // Bot-internal facades (Phase E). В будущем — копия логики, сейчас — делегаты
        // на serviceContainer, чтобы убрать прямой import из bot-handler'ов.
        this.userService = new BotUserService();
        this.orderService = new BotOrderService();
        this.paymentService = new BotPaymentService();
        this.paymentGuard = new PurchasePaymentGuard(this.db);
        this.productRenderer = new BotProductRenderer();
    }

    /**
     * Создаёт state machine для конкретного ctx.session.
     * Удобно для handler'ов: `container.flowFor(ctx)`.
     */
    flowFor(ctx: import('../domain/types').CustomContext): PaymentFlowStateMachine {
        return new PaymentFlowStateMachine(ctx);
    }

    /**
     * Привязывает TgClient к живому `bot.api` (из grammY). Должен быть вызван
     * после `new Bot(...)`, но до `bot.start()`.
     */
    initBotApi(api: Api): void {
        this._tg = new TgClient(api, this.cfg);
        this._discussion = new ChannelDiscussion(this.cfg.telegram.channelId);
        this._worker = new TgPostWorker(this._tg, api, this.productRenderer, this.db);
        this._dmWorker = new UserDmWorker(this._tg, new UserRepository(), new NotificationRepository());
    }

    /**
     * Асинхронная инициализация: загружает linkedDiscussionChatId и ставит
     * BullMQ worker. Должен быть вызван после initBotApi.
     */
    async init(): Promise<void> {
        if (!this._tg || !this._discussion || !this._worker) {
            throw new Error('ServiceContainer.init() called before initBotApi()');
        }
        await this._discussion.init(this._tg.api);
        this._worker.setupWorker();
        // The DM worker degrades gracefully when no bot token is configured:
        // jobs will simply retry until processed. Only skip if initBotApi wasn't called.
        if (this._dmWorker) this._dmWorker.setupWorker();
    }

    get tg(): TgClient {
        if (!this._tg) throw new Error('TgClient not initialized — call initBotApi() first');
        return this._tg;
    }

    get discussion(): ChannelDiscussion {
        if (!this._discussion) throw new Error('ChannelDiscussion not initialized — call initBotApi() first');
        return this._discussion;
    }

    get worker(): TgPostWorker {
        if (!this._worker) throw new Error('TgPostWorker not initialized — call initBotApi() first');
        return this._worker;
    }
}
