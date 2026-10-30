-- Preferencja konta, wspólna dla jego członkostw. Maile transakcyjne są obowiązkowe.
ALTER TABLE "User" ADD COLUMN "trialReminderEnabled" BOOLEAN NOT NULL DEFAULT true;
