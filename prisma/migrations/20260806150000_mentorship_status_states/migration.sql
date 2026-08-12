-- AlterTable
ALTER TABLE "mentorship_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Convert existing lowercase statuses to the uppercase state machine
-- (pending/accepted/completed/cancelled -> PENDING/ACTIVE/COMPLETED/CANCELLED)
UPDATE "mentorship_requests" SET "status" = 'PENDING'   WHERE "status" = 'pending';
UPDATE "mentorship_requests" SET "status" = 'ACTIVE'    WHERE "status" = 'accepted';
UPDATE "mentorship_requests" SET "status" = 'COMPLETED' WHERE "status" = 'completed';
UPDATE "mentorship_requests" SET "status" = 'CANCELLED' WHERE "status" = 'cancelled';
