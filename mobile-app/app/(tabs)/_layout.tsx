import { Tabs } from "expo-router";

// Main mobile sections stay visible in a small bottom navigation bar.
export default function TabLayout() {
  return <Tabs screenOptions={{ headerStyle: { backgroundColor: "#fff" }, tabBarActiveTintColor: "#7566c5", tabBarLabelStyle: { fontSize: 12 } }}>
    <Tabs.Screen name="index" options={{ title: "Home", tabBarLabel: "Home" }}/>
    <Tabs.Screen name="tasks" options={{ title: "My Tasks", tabBarLabel: "Tasks" }}/>
    <Tabs.Screen name="create" options={{ title: "Create", tabBarLabel: "Create" }}/>
    <Tabs.Screen name="inbox" options={{ title: "Inbox", tabBarLabel: "Inbox" }}/>
    <Tabs.Screen name="profile" options={{ title: "Profile", tabBarLabel: "Profile" }}/>
  </Tabs>;
}
