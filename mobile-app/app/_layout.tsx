import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

// A small root stack lets the sign-in screen hand off to the main tab layout.
export default function RootLayout() {
  return <><StatusBar style="dark"/><Stack screenOptions={{ headerShown: false }}/></>;
}
