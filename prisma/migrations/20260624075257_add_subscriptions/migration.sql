-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "auto_billing_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "billing_day_of_month" INTEGER DEFAULT 1,
ADD COLUMN     "expires_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "manager_id" TEXT NOT NULL,
    "stripe_intent_id" TEXT NOT NULL,
    "stripe_payment_id" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'thb',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "plan_days" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_intent_id_key" ON "subscriptions"("stripe_intent_id");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
