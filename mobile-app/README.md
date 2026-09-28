# FlowNexa Mobile

React Native application for Android and iOS, built with Expo Router.

## Run

```sh
npm install
cp .env.example .env
npm start
```

Set `EXPO_PUBLIC_API_URL` to the API host reachable from the phone. For a physical device, use the computer's LAN address instead of `localhost`. Expo SDK 57 uses React Native 0.86; install the SDK-matched packages through `npx expo install` when adding dependencies.

The app supports sign-in, assigned task browsing, work updates, comments, manual time entries, an inbox, authenticated realtime refresh, camera capture stored on-device, and offline drafts for work updates. Access tokens use SecureStore. Push registration requires an EAS project ID and a development build; captured photos stay local until the server's private evidence upload service is configured.
