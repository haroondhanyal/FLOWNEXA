import { ShieldCheck } from "lucide-react";

const roles = [
  { role: "Owner", desc: "Organization owner role" },
  { role: "Admin", desc: "Organization administrator role" },
  { role: "Member", desc: "Standard workspace member role" },
  { role: "Viewer", desc: "Read-only role; fine-grained restrictions are still in progress" },
];

// ROLES SCREEN: explains who can manage settings, deliver work, or read workspace data.
export function RolesScreen() {
  return <><div className="roles-grid">{roles.map((item) => <article className="role-card" key={item.role}><ShieldCheck size={17}/><b>{item.role}</b><p>{item.desc}</p></article>)}</div><p className="toolbar-note">Roles are stored on memberships. Fine-grained access rules are being completed separately.</p></>;
}
