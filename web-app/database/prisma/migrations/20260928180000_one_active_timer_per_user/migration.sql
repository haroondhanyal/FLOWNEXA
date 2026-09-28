CREATE UNIQUE INDEX "TimeEntry_one_active_timer_per_user"
ON "TimeEntry"("userId")
WHERE "endedAt" IS NULL;
