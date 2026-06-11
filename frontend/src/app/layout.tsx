import type { Metadata } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";
import { AuthProvider } from "@/components/app/auth-provider";
import { I18nProvider } from "@/components/app/i18n-provider";
import { SystemPreferencesProvider } from "@/components/app/system-preferences-provider";
import { Toaster } from "@/components/app/toaster";
import "./globals.css";

const firaSans = Fira_Sans({
  variable: "--font-fira-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sot Samban GuestHouse",
  description: "Operations dashboard for guesthouse rooms, guests, bookings, payments, and users.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${firaSans.variable} ${firaCode.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col">
        <I18nProvider>
          <AuthProvider>
            <SystemPreferencesProvider>{children}</SystemPreferencesProvider>
          </AuthProvider>
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
