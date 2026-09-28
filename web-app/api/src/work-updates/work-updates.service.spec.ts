import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WorkUpdatesService } from "./work-updates.service";

// Timer tests cover duplicate active timers and ownership scoped stop operations.
describe("WorkUpdatesService timers", () => {
  const prisma = {
    organizationMember: { findUnique: jest.fn() },
    task: { findFirst: jest.fn() },
    timeEntry: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn() },
  } as unknown as PrismaService;
  const events = { publish: jest.fn() } as never;
  const service = new WorkUpdatesService(prisma, events);
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(prisma.organizationMember.findUnique).mockResolvedValue({ role: "MEMBER" } as never);
    jest.mocked(prisma.task.findFirst).mockResolvedValue({ id: "task-a" } as never);
  });

  it("prevents a member from opening a second running timer", async () => {
    jest.mocked(prisma.timeEntry.findFirst).mockResolvedValue({ id: "timer-existing" } as never);
    await expect(service.timeEntry("user-a", "org-a", "task-a", { startedAt: new Date().toISOString() })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.timeEntry.create).not.toHaveBeenCalled();
  });

  it("stores manual time as a completed interval without looking for an active timer", async () => {
    const start = new Date("2026-09-28T08:00:00.000Z");
    jest.mocked(prisma.timeEntry.create).mockResolvedValue({ id: "manual-a" } as never);
    await service.timeEntry("user-a", "org-a", "task-a", { startedAt: start.toISOString(), durationMinutes: 45 });
    expect(prisma.timeEntry.findFirst).not.toHaveBeenCalled();
    expect(prisma.timeEntry.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ endedAt: new Date(start.getTime() + 45 * 60000), durationMinutes: 45 }) }));
  });

  it("does not let a different user stop a timer they do not own", async () => {
    jest.mocked(prisma.timeEntry.findFirst).mockResolvedValue(null);
    await expect(service.stopTimer("user-b", "org-a", "task-a", "timer-a")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.timeEntry.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "timer-a", taskId: "task-a", userId: "user-b" } }));
    expect(prisma.timeEntry.update).not.toHaveBeenCalled();
  });
});
