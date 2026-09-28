import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WorkspaceToolsService } from "./workspace-tools.service";

// These tests protect the organization boundary and basic review authorization.
describe("WorkspaceToolsService access rules", () => {
  const prisma = {
    organizationMember: { findUnique: jest.fn() },
    notification: { updateMany: jest.fn() },
  } as unknown as PrismaService;
  const events = { publish: jest.fn() } as never;
  const service = new WorkspaceToolsService(prisma, events);
  beforeEach(() => jest.clearAllMocks());

  it("does not return review records to a user outside the organization", async () => {
    jest.mocked(prisma.organizationMember.findUnique).mockResolvedValue(null);
    await expect(service.reviews("user-a", "org-b")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("prevents a viewer from submitting work for review", async () => {
    jest.mocked(prisma.organizationMember.findUnique).mockResolvedValue({ role: "VIEWER" } as never);
    await expect(service.requestReview("user-a", "org-b", "task-c")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("scopes notification read writes to the signed-in user and organization", async () => {
    jest.mocked(prisma.organizationMember.findUnique).mockResolvedValue({ id: "member-a" } as never);
    jest.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 0 } as never);
    await expect(service.markRead("user-a", "org-b", "notice-c")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "notice-c", organizationId: "org-b", userId: "user-a" } }));
  });
});
