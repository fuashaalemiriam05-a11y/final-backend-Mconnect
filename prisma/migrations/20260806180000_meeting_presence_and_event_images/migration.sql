-- AlterTable
ALTER TABLE "meetings" ADD COLUMN "active_user_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "events" ADD COLUMN "image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[];
