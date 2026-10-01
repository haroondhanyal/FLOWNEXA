import { Tabs } from "expo-router";

// Keep quick-access tabs visible; the Home screen drawer contains the full workspace navigation.
export default function TabLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarStyle: { height: 62, paddingTop: 5, paddingBottom: 7, borderTopColor: "#e8eaf1", backgroundColor: "#fff" }, tabBarActiveTintColor: "#6655b5", tabBarInactiveTintColor: "#8b90a0", tabBarLabelStyle: { fontSize: 10, fontWeight: "700" } }}>
    <Tabs.Screen name="index" options={{ title: "Home", tabBarLabel: "Home" }}/>
    <Tabs.Screen name="tasks" options={{ title: "My Tasks", tabBarLabel: "Tasks" }}/>
    <Tabs.Screen name="create" options={{ title: "Create", tabBarLabel: "Create" }}/>
    <Tabs.Screen name="inbox" options={{ title: "Inbox", tabBarLabel: "Inbox" }}/>
    <Tabs.Screen name="profile" options={{ title: "Profile", tabBarLabel: "Profile" }}/>
  </Tabs>;
}
