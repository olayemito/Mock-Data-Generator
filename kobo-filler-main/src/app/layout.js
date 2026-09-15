import "./globals.css"

export const metadata = {
  title: "KoboFiller — AI Survey Data Generator",
  description: "Generate realistic synthetic survey data using AI and push it to KoboToolbox.",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
