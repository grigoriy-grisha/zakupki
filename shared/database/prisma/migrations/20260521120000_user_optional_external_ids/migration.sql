-- Make external auth ids optional and add profile/oauth fields on User
ALTER TABLE "User" ALTER COLUMN "telegramId" DROP NOT NULL;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "vkId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "vkAvatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramAvatarUrl" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_vkId_key" ON "User"("vkId");
