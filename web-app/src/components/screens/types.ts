// Shared screen inputs: these screens receive only the org and task data they need.
export type Task = { id: string; title: string; project: string; date: string; state: string };
export type WorkspaceScreenProps = {
  organizationId: string;
  workspaceId?: string;
  tasks: Task[];
  query: string;
  onMessage: (message: string) => void;
};

export type WorkspaceTask = Task & {
  priority: string;
  person: string;
  projectId?: string;
  initials: string;
  color: string;
};
export type WorkspaceProject = { id?: string; name: string; status: string; due: string; lead: string; progress: number };
export type WorkspaceMember = { name: string; email: string; role: string; team: string };
