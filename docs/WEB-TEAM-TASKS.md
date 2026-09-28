# FlowNexa web team task board

This board divides the web roadmap into six work streams. Each developer should take a feature branch from `web-app` and own the files listed for that stream. Do not have two developers edit `src/app/page.tsx`, `database/prisma/schema.prisma`, shared CSS, or the same Prisma migration at once. One integrator owns those shared files and reviews each feature branch.

## Current screen map

| Screen | Purpose | Current entry point |
| --- | --- | --- |
| Sign in / create account | Authenticate a user and choose the post-login destination. | `web-app/src/app/login/page.tsx` |
| Workspace setup | Create the first organization, workspace, team, invitations, and starter project. | `web-app/src/app/onboarding/page.tsx` |
| Overview | Show task counts, due-today work, progress, projects, and recent updates. | `web-app/src/components/screens/OverviewScreen.tsx` |
| My work / board / My day | Review tasks in a list or status columns and focus on today's work. | `web-app/src/components/screens/TaskListScreen.tsx`, `BoardScreen.tsx`, `MyDayScreen.tsx` |
| Projects / teams / roles / invite | View or create projects, see members, generate invites, inspect access roles. | `web-app/src/components/screens/ProjectListScreen.tsx`, `ProjectCreateScreen.tsx`, `TeamMembersScreen.tsx`, `InviteMemberScreen.tsx`, `RolesScreen.tsx` |
| Calendar / work updates / reviews | Check due dates, post evidence and progress, and review submitted work. | `web-app/src/components/screens/` |
| Inbox / audit / reports / search | Read notifications, inspect changes, see organization metrics, and find work. | `web-app/src/components/screens/` |
| AI assistant | Ask a question grounded in organization task and update records. | `web-app/src/components/AiAssistantScreen.tsx` |

Each screen component starts with a short code comment stating what the screen does and why users need it. Keep the interface simple: one clear page goal, a small number of primary actions, useful empty/loading/error states, and API calls through `apiFetch`.

## Six developer assignments

### Dev 1 — Sign-in, sessions, and account security

**Own:** `web-app/src/app/login/`, `web-app/src/lib/api.ts`, and `web-app/api/src/auth/`.

**Build:** finish accessible login and registration states, clear validation and API errors, logout/session expiry handling, password reset, password change, and email verification screens and endpoints. Keep credentials out of browser storage; use the existing HTTP-only refresh cookie and short-lived access token flow.

**Done when:** login, registration, logout, refresh, reset, change-password, and verification flows have clear success/failure states; invalid or expired tokens return the user safely to sign-in; API DTOs validate input and throttle sensitive routes; document required mail configuration.

### Dev 2 — Organization setup, teams, invitations, and permissions

**Own:** `web-app/src/app/onboarding/`, `web-app/src/components/screens/TeamMembersScreen.tsx`, `InviteMemberScreen.tsx`, `RolesScreen.tsx`, and `web-app/api/src/organizations/` (including teams and invitations).

**Current:** organization member directory, team creation/membership changes, custom role definitions, and task/project permission checks are implemented. Remaining work: invitation list/revoke/resend/state, email delivery and verification/reset flows, and applying fine-grained permission checks to invitations, reviews, evidence, reports, and audit access. Keep member, invite, and access screens as separate components.

**Done when:** a new user can set up or resume an organization; invite links expire/revoke correctly; users cannot read or change another organization's members/settings; each role has a written permissions table and API enforcement.

### Dev 3 — Projects and planning

**Own:** `web-app/api/src/projects/` and `web-app/src/components/screens/ProjectListScreen.tsx`, `ProjectCreateScreen.tsx` (later these can move together into `src/features/projects/`).

**Build:** split project list, project details, create/edit form, and project overview into separate screens/components. Add project descriptions, owner/lead, dates, status, milestones, and task counts through the existing organization-scoped API.

**Done when:** users can create, view, and edit projects; project list filters and empty/error states work; project progress is calculated from persisted tasks; invalid dates and missing names are rejected by the API.

### Dev 4 — Tasks, board, and assignments

**Own:** `web-app/api/src/tasks/` and `web-app/src/components/screens/TaskListScreen.tsx`, `BoardScreen.tsx`, `MyDayScreen.tsx` (later these can move together into `src/features/tasks/`).

**Build:** separate task list, board, task details, create/edit form, filters, and assignment UI. Support status, priority, due date, assignees, project, dependencies, and comments entry point. Keep status transitions in one small helper shared by list and board.

**Done when:** each task view shows the same saved data; a status/assignment change appears after refresh and realtime update; filters can be combined; users can only access tasks in an organization they belong to; empty and loading states are clear.

### Dev 5 — Work updates, evidence, time, and review

**Own:** `web-app/src/components/screens/TaskActivityScreen.tsx`, `web-app/src/components/screens/ReviewsScreen.tsx`, `web-app/api/src/work-updates/`, `comments/`, `time-entries/`, and `reviews/`.

**Build:** make the task activity view a readable timeline; allow progress notes, evidence links, threaded comments, manual time, and review requests. Split submitter and reviewer actions into small components. Clearly show review state and require a reason when changes are requested.

**Done when:** each activity item persists to its matching API endpoint; unauthorized users cannot review work; reviewers can see who submitted and when; submitted updates and decisions appear in the timeline and audit history. Keep binary evidence upload as its own follow-up if object storage is not ready.

### Dev 6 — Overview, reports, search, inbox, and realtime

**Own:** `web-app/src/components/screens/OverviewScreen.tsx`, `ReportsScreen.tsx`, `SearchScreen.tsx`, `InboxScreen.tsx`, `AuditScreen.tsx`, `CalendarScreen.tsx`, `AiAssistantScreen.tsx`, `RealtimeBridge.tsx`, and `web-app/api/src/ai/`, `events/`, `workspace-tools/`.

**Build:** improve the standalone Overview and analytics, search, inbox, audit, calendar, and AI screens; keep each in its own component with a short purpose comment. Handle loading, empty, and failure states consistently. Confirm realtime updates only reach members of the joined organization and add a non-realtime fallback where needed.

**Done when:** dashboard figures match API data; search and reports remain organization-scoped; inbox read state persists; AI explains when provider setup is missing and does not claim unsupported facts; disconnected clients recover or can refresh data manually.

## Shared integration rules

1. Keep `src/app/page.tsx` as routing and shared layout only. Feature screens belong in `src/features/<feature>/` or `src/components/screens/` and get typed props.
2. Keep API controllers, services, DTOs, and tests inside their feature folder. Reuse `apiFetch`; do not construct authorization headers by hand.
3. A feature must not query organization-wide data without passing the selected organization ID and enforcing membership in the API.
4. Coordinate Prisma schema changes with the integrator. Use one migration per merged schema change; never rewrite an already-applied migration.
5. Add one concise purpose comment to each screen and one inline explanation only where the logic is not self-evident. Avoid comments that just repeat the line below.
6. Before merging, run the relevant web/API lint, typecheck, build, and access tests. Include a short manual walkthrough and screenshots for visual changes.

## Suggested delivery order

1. Dev 1 and Dev 2 establish account and organization access flows.
2. Dev 3 and Dev 4 build projects and tasks on top of the selected organization.
3. Dev 5 adds evidence and review workflows to task details.
4. Dev 6 completes the cross-workspace screens and realtime polish against those APIs.
5. The integrator handles shared shell changes, Prisma migrations, and release checks.
