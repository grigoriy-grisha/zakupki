-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- Default: скидка 3% от цены за пачку бисера
INSERT INTO "AppSetting" ("key", "value", "updatedAt")
VALUES ('bead_pack_price_discount_percent', '3', CURRENT_TIMESTAMP);
