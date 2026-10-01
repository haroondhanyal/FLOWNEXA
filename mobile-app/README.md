# FlowNexa Mobile

FlowNexa Mobile is the Expo and React Native client for Android and iOS. It connects to the FlowNexa API and provides account access, task and workspace tools, work updates, and notifications.

## Requirements

- Node.js `>=22.13.0`
- npm
- Expo Go for basic development, or an Android/iOS development build for native features such as push notifications
- A reachable FlowNexa API server

## Setup

From this directory:

```sh
npm install
cp .env.example .env
```

Set `EXPO_PUBLIC_API_URL` in `.env` to the API base URL, including the `/api/v1` path. For example:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.20:4000/api/v1
EXPO_PUBLIC_EAS_PROJECT_ID=
```

Use your development computer's LAN IP when testing on a physical phone; `localhost` on the phone refers to the phone itself. Keep the API reachable from the device and use HTTPS for deployed environments.

## Start the app

```sh
npm start
```

Use the Expo CLI prompts or run a platform shortcut:

```sh
npm run android
npm run ios
```

Run `npm run typecheck` to check the TypeScript sources.

## App features

- Sign in and account creation, email verification, forgot-password requests, and password reset
- Home workspace dashboard, task browsing, status/progress updates, and task comments
- Work update submission with optional camera photo evidence
- Offline work-update drafts, with retry/sync when connectivity returns
- Workspace inbox with read and archive actions, plus realtime workspace refresh
- Profile and account settings, appearance preferences, and sign out
- Optional device push registration

The app stores its access token with Expo SecureStore. Work-update drafts and local evidence photos are kept on the device until successfully synced or uploaded. Push notifications require `EXPO_PUBLIC_EAS_PROJECT_ID` and a compatible development or production build; they may not work in Expo Go.

## Project structure

- `app/` — Expo Router screens and navigation
- `components/` — shared workspace interface
- `lib/api.ts` — API requests, token storage, and shared API types
- `.env.example` — mobile environment variable template

## Dependencies

The project uses Expo SDK 57, React Native 0.86, React 19, and Expo Router. When adding or changing Expo native packages, use `npx expo install <package>` to select a version compatible with the installed SDK, then commit the updated lockfile.
