-- CreateEnum
CREATE TYPE "VisitPlatform" AS ENUM ('TELEGRAM', 'VK', 'WEB');

-- CreateEnum
CREATE TYPE "VisitDevice" AS ENUM ('MOBILE', 'TABLET', 'DESKTOP');

-- CreateTable
CREATE TABLE "UserVisit" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "platform" "VisitPlatform" NOT NULL,
    "device" "VisitDevice" NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserVisit_day_idx" ON "UserVisit"("day");

-- CreateIndex
CREATE UNIQUE INDEX "UserVisit_userId_day_platform_device_key" ON "UserVisit"("userId", "day", "platform", "device");

-- AddForeignKey
ALTER TABLE "UserVisit" ADD CONSTRAINT "UserVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
