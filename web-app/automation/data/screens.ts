// SCREEN INVENTORY: nav labels are intentionally kept here, not repeated through test files.
export const screens = [
  "Overview", "My work", "Calendar", "Inbox", "Projects", "Teams", "Reviews",
  "Audit history", "Reports", "AI assistant", "Notes", "Profile & account",
] as const;
export const coreScreens = screens;
export const viewportCases = [
  { name: "desktop-wide", width: 1600, height: 1000 },
  { name: "desktop-standard", width: 1366, height: 768 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const;
export const uiAssertions = ["breadcrumb", "screen-content", "selected-navigation", "page-title"] as const;
export const regressionChecks = ["screen title is stable", "navigation stays in workspace", "screen content is visible", "topbar remains visible", "no authentication redirect", "no page error state", "workspace shell remains mounted", "screen route is selectable", "navigation label remains available", "main region is visible"] as const;
