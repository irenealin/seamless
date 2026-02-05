export default function Home() {
  return (
    <div className="landingPage">
      <header className="landingHeader">
        <div className="landingInner">
          <div className="landingBrand">
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
              <div className="landingBrandSub">
                Private dining for corporate events
              </div>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="landingHero">
          <div className="landingInner">
            <div className="landingHeroCopy">
              <div className="landingEyebrow">Curated private dining</div>
              <h1>Book exceptional venues without the back-and-forth.</h1>
              <p>Curated venues. Fast booking. Flawless events.</p>

              <div className="landingActions">
                <a className="landingBtn landingBtnPrimary" href="/book">{/* Routes to the email capture step before booking. */}
                  Book an Event
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="landingMinimalGrid">
          <div className="landingInner">
            <div>
              <h2>Effortless excellence.</h2>
              <p>Vetted venues. Guided booking. Zero friction.</p>
            </div>

            <div className="landingStepsGrid">
              <div className="landingStepCard">
                <div className="landingStepTitle">Share</div>
                <div className="landingStepBody">
                  Your date, size, and preferences.
                </div>
              </div>

              <div className="landingStepCard">
                <div className="landingStepTitle">Review</div>
                <div className="landingStepBody">
                  Curated matches, instantly.
                </div>
              </div>

              <div className="landingStepCard">
                <div className="landingStepTitle">Confirm</div>
                <div className="landingStepBody">
                  Your space with confidence.
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
