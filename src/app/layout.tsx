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
            <a className="landingBrand" href="/">
              <span className="landingLogoMark" aria-hidden="true">
                <svg viewBox="0 0 120 120" role="img">
                  <g fill="none" stroke="currentColor" strokeWidth="3.4">
                    <circle cx="60" cy="18" r="16" />
                    <circle cx="60" cy="18" r="10" />
                    <circle cx="60" cy="18" r="5" />
                    <circle cx="60" cy="102" r="16" />
                    <circle cx="60" cy="102" r="10" />
                    <circle cx="60" cy="102" r="5" />
                    <circle cx="18" cy="60" r="16" />
                    <circle cx="18" cy="60" r="10" />
                    <circle cx="18" cy="60" r="5" />
                    <circle cx="102" cy="60" r="16" />
                    <circle cx="102" cy="60" r="10" />
                    <circle cx="102" cy="60" r="5" />
                    <circle cx="60" cy="60" r="22" />
                    <circle cx="60" cy="60" r="14" />
                    <circle cx="60" cy="60" r="7" />
                  </g>
                </svg>
              </span>
              <div>
                <div className="landingBrandTitle">Seamless</div>
                <div className="landingBrandSub">Private dining for corporate events</div>
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

