-- Add started_at and ended_at columns that were missing from the initial schema
ALTER TABLE "mentorship_requests" ADD COLUMN "started_at" TIMESTAMP(3);
ALTER TABLE "mentorship_requests" ADD COLUMN "ended_at" TIMESTAMP(3);
