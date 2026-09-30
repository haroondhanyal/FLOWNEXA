import { prisma } from "../clients/dbClient";

/** Removes only a test task whose unpredictable id and unique marker were captured by this run. */
export async function removeGeneratedTask(taskId: string, marker: string) {
  if (!taskId || !marker.startsWith("FNQA_DB_")) return;
  await prisma.task.deleteMany({ where: { id: taskId, title: marker } });
}
