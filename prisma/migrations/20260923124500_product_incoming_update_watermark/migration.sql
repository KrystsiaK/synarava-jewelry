CREATE TABLE "ProductIncomingUpdate" (
    "productId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductIncomingUpdate_pkey" PRIMARY KEY ("productId")
);

CREATE TABLE "ProductIncomingUpdateView" (
    "productId" TEXT NOT NULL,
    "adminUsername" TEXT NOT NULL,
    "viewedVersion" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductIncomingUpdateView_pkey" PRIMARY KEY ("productId", "adminUsername")
);

CREATE INDEX "ProductIncomingUpdateView_adminUsername_idx" ON "ProductIncomingUpdateView"("adminUsername");

ALTER TABLE "ProductIncomingUpdate" ADD CONSTRAINT "ProductIncomingUpdate_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductIncomingUpdateView" ADD CONSTRAINT "ProductIncomingUpdateView_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "ProductIncomingUpdate"("productId") ON DELETE CASCADE ON UPDATE CASCADE;
