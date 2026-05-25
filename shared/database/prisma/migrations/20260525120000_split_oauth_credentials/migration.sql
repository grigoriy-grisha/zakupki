-- CreateTable
CREATE TABLE "TelegramCredential" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "telegramId" TEXT NOT NULL,
    "username" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VkCredential" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "vkId" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VkCredential_pkey" PRIMARY KEY ("id")
);

-- Telegram: only legacy fields that existed in migrations (telegramId, username)
INSERT INTO "TelegramCredential" ("userId", "telegramId", "username", "avatarUrl", "updatedAt")
SELECT "id", "telegramId", "username", NULL, CURRENT_TIMESTAMP
FROM "User"
WHERE "telegramId" IS NOT NULL;

-- VK: only if vkId was added to User (e.g. via db push)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'vkId'
    ) THEN
        INSERT INTO "VkCredential" ("userId", "vkId", "avatarUrl", "updatedAt")
        SELECT "id", "vkId", NULL, CURRENT_TIMESTAMP
        FROM "User"
        WHERE "vkId" IS NOT NULL;
    END IF;
END $$;

ALTER TABLE "User" DROP COLUMN IF EXISTS "telegramId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "vkId";
-- optional columns from db push (not in migration history); safe to drop if present
ALTER TABLE "User" DROP COLUMN IF EXISTS "vkAvatarUrl";
ALTER TABLE "User" DROP COLUMN IF EXISTS "telegramAvatarUrl";

-- CreateIndex
CREATE UNIQUE INDEX "TelegramCredential_userId_key" ON "TelegramCredential"("userId");
CREATE UNIQUE INDEX "TelegramCredential_telegramId_key" ON "TelegramCredential"("telegramId");
CREATE UNIQUE INDEX "VkCredential_userId_key" ON "VkCredential"("userId");
CREATE UNIQUE INDEX "VkCredential_vkId_key" ON "VkCredential"("vkId");

-- AddForeignKey
ALTER TABLE "TelegramCredential" ADD CONSTRAINT "TelegramCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VkCredential" ADD CONSTRAINT "VkCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
