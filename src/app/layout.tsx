import "./globals.css";

export const metadata = {
  title: "Seamless",
  description: "AI-Powered Private Dining for Corporate Events",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <header className="header">
            <a className="brand" href="/">
              <div className="logo">S</div>
              <div>
                <div className="brandTitle">Seamless</div>
                <div className="brandSub">AI-Powered Private Dining for Corporate Events</div>
              </div>
            </a>

            <nav className="nav">
              <a className="btn" href="/discover">Discovery</a>
              <a className="btn btnPrimary" href="/discover">Book your first event</a>
            </nav>
          </header>

          <main className="section">{children}</main>
        </div>
      </body>
    </html>
  );
}


