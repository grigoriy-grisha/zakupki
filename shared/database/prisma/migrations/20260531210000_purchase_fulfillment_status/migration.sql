CREATE TYPE "PurchaseFulfillmentStatus" AS ENUM (
    'COLLECTION',
    'REORDER',
    'PAYMENT',
    'SUPPLIER_ASSEMBLY',
    'PREPARING_SHIPMENT_RF',
    'IN_TRANSIT_RF',
    'IN_TRANSIT_TO_ORGANIZER',
    'PACKAGING',
    'READY_FOR_PICKUP'
);

ALTER TABLE "Purchase"
ADD COLUMN "fulfillmentStatus" "PurchaseFulfillmentStatus" NOT NULL DEFAULT 'COLLECTION';

CREATE INDEX "Purchase_fulfillmentStatus_idx" ON "Purchase"("fulfillmentStatus");
