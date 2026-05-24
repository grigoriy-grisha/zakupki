-- CreateEnum
CREATE TYPE "RoleKind" AS ENUM ('CLIENT', 'ADMIN');

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "kind" "RoleKind" NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- Seed roles
INSERT INTO "Role" ("kind") VALUES ('CLIENT'), ('ADMIN');

-- Assign CLIENT to all existing users
INSERT INTO "UserRole" ("userId", "roleId")
SELECT u."id", r."id"
FROM "User" u
CROSS JOIN "Role" r
WHERE r."kind" = 'CLIENT';

-- CreateIndex
CREATE UNIQUE INDEX "Role_kind_key" ON "Role"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_key" ON "UserRole"("userId");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
