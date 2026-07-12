import { OrderRepository } from '../domain/order.repository';
import { PaymentRepository } from '../domain/payment.repository';
import { ProductRepository } from '../domain/product.repository';
import { PurchaseRepository } from '../domain/purchase.repository';
import { UserRepository } from '../domain/user.repository';
import { BotPaymentService } from '../services/bot-payment.service';
import { OrderService } from '../services/order.service';
import { PaymentService } from '../services/payment.service';
import { PricingSettingsService } from '../services/settings/pricing-settings';
import { SettingsService } from '../services/settings/settings.service';
import { ProductService } from '../services/product.service';
import { PromoCodeService } from '../services/promo-code.service';
import { PurchaseService } from '../services/purchase.service';
import { PurchaseStatusService } from '../services/purchase-status.service';
import { TelegramPublishService } from '../services/telegram-publish.service';
import { UserService } from '../services/user.service';

import { AttributeTypeRepository } from '../domain/attribute-type.repository';
import { CharacteristicRepository } from '../domain/characteristic.repository';
import { PostTemplateRepository } from '../domain/post-template.repository';
import { ProductAttributeRepository } from '../domain/product-attribute.repository';
import { PromoCodeRepository } from '../domain/promo-code.repository';
import { SupplierRepository } from '../domain/supplier.repository';
import { AttributeTypeService } from '../services/attribute-type.service';
import { CharacteristicService } from '../services/characteristic.service';
import { ProductAttributeService } from '../services/product-attribute.service';
import { PostTemplateService } from '../services/post-template.service';
import { SupplierService } from '../services/supplier.service';

import { EventBus } from '@zakupki/queue';

export class ServiceContainer {
    private readonly userRepo = new UserRepository();
    private readonly orderRepo = new OrderRepository();
    private readonly purchaseRepo = new PurchaseRepository();
    private readonly productRepo = new ProductRepository();
    private readonly paymentRepo = new PaymentRepository();
    private readonly promoCodeRepo = new PromoCodeRepository();
    private readonly attributeTypeRepo = new AttributeTypeRepository();
    private readonly characteristicRepo = new CharacteristicRepository();
    private readonly productAttributeRepo = new ProductAttributeRepository();
    private readonly postTemplateRepo = new PostTemplateRepository();
    private readonly supplierRepo = new SupplierRepository();

    public readonly eventBus = new EventBus();
    public readonly telegramPublish = new TelegramPublishService(this.eventBus);
    public readonly user = new UserService(this.userRepo);
    public readonly settings = new SettingsService();
    public readonly pricingSettings = new PricingSettingsService(this.settings);
    public readonly order = new OrderService(this.orderRepo, this.purchaseRepo, this.pricingSettings, this.eventBus);
    public readonly purchase = new PurchaseService(
        this.purchaseRepo,
        this.productRepo,
        this.telegramPublish,
        this.orderRepo,
        this.eventBus,
        this.pricingSettings,
    );
    public readonly purchaseStatus = new PurchaseStatusService(this.purchaseRepo, this.orderRepo, this.eventBus);
    public readonly product = new ProductService(this.productRepo, this.eventBus);
    public readonly payment = new PaymentService(this.paymentRepo);
    public readonly botPayment = new BotPaymentService(this.paymentRepo, this.order);
    public readonly promoCode = new PromoCodeService(this.promoCodeRepo);
    public readonly attributeType = new AttributeTypeService(this.attributeTypeRepo);
    public readonly characteristic = new CharacteristicService(this.characteristicRepo);
    public readonly productAttribute = new ProductAttributeService(this.productAttributeRepo);
    public readonly postTemplate = new PostTemplateService(this.postTemplateRepo);
    public readonly supplier = new SupplierService(this.supplierRepo);
}

export const serviceContainer = new ServiceContainer();
