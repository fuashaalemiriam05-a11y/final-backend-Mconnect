-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "message_type" TEXT NOT NULL DEFAULT 'text',
ALTER COLUMN "text" SET DEFAULT '';
