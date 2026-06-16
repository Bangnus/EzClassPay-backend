-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "room_id" TEXT,
ALTER COLUMN "period_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
