ALTER TABLE "Workspace" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "WorkspaceNote" ADD COLUMN "workspaceId" TEXT;

UPDATE "WorkspaceNote" AS note
SET "workspaceId" = (
  SELECT workspace."id"
  FROM "Workspace" AS workspace
  WHERE workspace."organizationId" = note."organizationId"
  ORDER BY workspace."createdAt" ASC
  LIMIT 1
);

ALTER TABLE "WorkspaceNote" ALTER COLUMN "workspaceId" SET NOT NULL;
CREATE INDEX "WorkspaceNote_workspaceId_updatedAt_idx" ON "WorkspaceNote"("workspaceId", "updatedAt");
ALTER TABLE "WorkspaceNote" ADD CONSTRAINT "WorkspaceNote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
