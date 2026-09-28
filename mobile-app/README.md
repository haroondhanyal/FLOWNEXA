# FlowNexa Mobile

Expo Router app for FlowNexa on iOS and Android. It is the team's mobile companion for assigned work, progress updates, quick task creation, offline update drafts, local evidence photos, comments, time entries, inbox, and push registration.

The app connects to the shared NestJS API and PostgreSQL data model; it has no separate workspace database. The API checks identity, organization membership, permissions, and input. See the [mobile branch overview](../README.md) for system architecture, setup, screen responsibilities, configuration, and limitations. The web dashboard and shared API workstream is documented on the [`web-app` branch](https://github.com/haroondhanyal/FLOWNEXA/tree/web-app).

## Start

```sh
npm ci
cp .env.example .env
# Set EXPO_PUBLIC_API_URL to an API address the simulator/phone can reach.
npm start
```

Physical devices must use the development computer's LAN IP instead of `localhost`. Start PostgreSQL, Redis, and the API using the root README instructions before signing in. The API base URL must end in `/api/v1`.

## App flow

- `app/index.tsx` signs in and stores the short-lived access token in Expo SecureStore.
- `app/(tabs)/index.tsx` shows the signed-in user's task overview.
- `app/(tabs)/tasks.tsx` lists assigned tasks.
- `app/(tabs)/create.tsx` handles updates, explicit draft sync, camera capture, comments, manual time, and task creation.
- `app/(tabs)/inbox.tsx` loads stored notifications and marks them read.
- `app/(tabs)/profile.tsx` manages opt-in push registration and logout.
- `lib/api.ts` owns API requests, token refresh, and encrypted token storage.
- `lib/useWorkspaceEvents.ts` joins an organization Socket.IO room after API authentication.

## Environment

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Reachable shared API URL; default is local computer `localhost`. |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | EAS project identifier for push token registration. |

`EXPO_PUBLIC_` values are embedded in the app bundle. Never put API secrets, JWT keys, database credentials, or AI keys there.

## Check before pushing

```sh
npx expo install --check
npm run typecheck
```

Push notifications require an EAS project, native build, and OS permission. Camera photos stay in app storage until a private server upload service is available. Offline support currently queues work updates only.
