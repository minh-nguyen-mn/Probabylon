import "./globals.css";
import { ReactNode } from "react";
import { TradeNotifications } from "../components/trade-notifications";
import { NavbarWrapper } from "../components/navbar";

export const metadata = {
  title: "Probabylon",
  description: "Collective probabilistic intelligence terminal",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavbarWrapper>{children}</NavbarWrapper>
        <TradeNotifications />
      </body>
    </html>
  );
}
