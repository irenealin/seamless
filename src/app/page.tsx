export default function Home() {
  return (
    <div className="grid2">
      <div style={{ display: "grid", gap: 14 }}>
        <h1 className="h1">
          Book exceptional private dining —{" "}
          <span style={{ color: "#334155" }}>without the back-and-forth.</span>
        </h1>
        <p className="p">
          Seamless recommends venues for your event using the details that matter:
          privacy, noise, vibe, A/V, capacity, and spend expectations.
        </p>

        <div className="row">
          <a className="btn btnPrimary" href="/discover">Book your first event</a>
          <a className="btn" href="/discover">Explore venues</a>
        </div>

      </div>

      <div className="card">
        <div className="cardInner">
          <div className="small" style={{ fontWeight: 800 }}>What you’ll do in 60 seconds</div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <div>• Tell us your area + event details</div>
            <div>• Get Top 3 recommendations instantly</div>
            <div>• Browse other strong options</div>
            <div>• (Next) Send outreach & compare quotes</div>
          </div>
        </div>
      </div>
    </div>
  );
}
