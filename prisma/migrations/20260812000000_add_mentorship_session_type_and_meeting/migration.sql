-- Add session_type (VIDEO / CHAT / IN_PERSON) and meeting_id to mentorship_requests
ALTER TABLE "mentorship_requests" ADD COLUMN "session_type" TEXT NOT NULL DEFAULT 'VIDEO';
ALTER TABLE "mentorship_requests" ADD COLUMN "meeting_id" INTEGER;
