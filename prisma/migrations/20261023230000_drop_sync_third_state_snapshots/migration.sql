-- DropForeignKey
ALTER TABLE "ShopifyTranslationSnapshot" DROP CONSTRAINT "ShopifyTranslationSnapshot_bindingId_fkey";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "shopifyBaseSnapshot";

-- AlterTable
ALTER TABLE "ShopifyTranslationBinding" DROP COLUMN "lastSyncedSnapshot";

-- DropTable
DROP TABLE "ShopifyTranslationSnapshot";

