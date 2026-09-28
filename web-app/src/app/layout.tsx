import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlowNexa — Plan. Execute. Prove.",
  description: "A clear view of your team's work, progress, and priorities.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
