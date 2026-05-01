import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./context/ThemeContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata = {
  title: "Discord Server Cloner - By Vortex",
  description:
    "A powerful Discord Server Cloner tool built by Vortex. Easily clone servers, roles, channels, permissions, and structure with high accuracy and speed.",
  keywords: [
    "discord",
    "server cloner",
    "discord tool",
    "vortex",
    "discord automation",
    "discord bot tools",
    "server backup",
    "discord copy server"
  ],
  authors: [{ name: "Vortex" }],
  creator: "Vortex",
  publisher: "Vortex",

  openGraph: {
    title: "Discord Server Cloner - By Vortex",
    description:
      "Clone Discord servers quickly and efficiently with roles, channels, permissions, and full structure support.",
    url: "https://cloner.saifx.xyz",
    siteName: "Vortex Tools",
    type: "website",
    images: [
      {
        url: "/images/vortex.png",
        width: 1200,
        height: 630,
        alt: "Discord Server Cloner"
      }
    ]
  },

  twitter: {
    card: "summary_large_image",
    title: "Discord Server Cloner | Vortex Tools",
    description:
      "Fast and powerful Discord server cloning tool with full structure support.",
    images: ["/images/vortex.png"]
  },

  metadataBase: new URL("https://cloner.saifx.xyz")
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="h-[100vh] flex flex-col font-sans">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}