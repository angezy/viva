import "./globals.css";
import ConditionalShell from "./components/ConditionalShell";
import ToastProvider from "./components/ToastProvider";
import ScrollToTop from "./components/ScrollToTop";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";

export const metadata = {
  title: "Weluxo Shop",
  description: "Weluxo Shop - Your partner in performance",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppRouterCacheProvider>
          <ScrollToTop />
          <ConditionalShell>{children}</ConditionalShell>
          <ToastProvider />
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
