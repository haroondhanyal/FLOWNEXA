ALTER TABLE "User" ADD COLUMN "phoneNumber" TEXT;

CREATE TABLE "WorkspaceNote" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT 'Untitled note',
  "content" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkspaceNote_organizationId_updatedAt_idx" ON "WorkspaceNote"("organizationId", "updatedAt");
CREATE INDEX "WorkspaceNote_authorId_idx" ON "WorkspaceNote"("authorId");
ALTER TABLE "WorkspaceNote" ADD CONSTRAINT "WorkspaceNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceNote" ADD CONSTRAINT "WorkspaceNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
