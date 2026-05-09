import "./globals.css";
import { ReactNode } from "react";
import { TradeNotifications } from "../components/trade-notifications";

export const metadata = {
  title: "Probabylon",
  description: "Collective probabilistic intelligence terminal",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TradeNotifications />
        {children}
      </body>
    </html>
  );
}
