/*
  Warnings:

  - You are about to drop the column `data` on the `ProductPhoto` table. All the data in the column will be lost.
  - Made the column `objectKey` on table `ProductPhoto` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ProductPhoto" DROP COLUMN "data",
ALTER COLUMN "objectKey" SET NOT NULL;
