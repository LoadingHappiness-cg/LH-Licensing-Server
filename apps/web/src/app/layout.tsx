import "./globals.css";
import { webConfig } from "@/lib/config";

export const metadata = {
  title: "LH Licensing Server",
  description: "Admin console for licensing"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  void webConfig;

  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
