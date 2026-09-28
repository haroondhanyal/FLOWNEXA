ALTER TABLE "OrganizationInvitation" ADD COLUMN "revokedAt" TIMESTAMP(3);

CREATE INDEX "OrganizationInvitation_organizationId_revokedAt_expiresAt_idx" ON "OrganizationInvitation"("organizationId", "revokedAt", "expiresAt");
