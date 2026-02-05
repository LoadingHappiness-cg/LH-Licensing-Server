import "./globals.css";

export const metadata = {
  title: "LH Licensing Server",
  description: "Admin console for licensing"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
