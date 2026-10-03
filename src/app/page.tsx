import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function HomePage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Ultra-Clean Apple Navigation */}
      <Navigation />

      <main style={{ flex: 1 }}>
        {/* =================================================================
            HERO TILE: Pure White Canvas with Rich Spacing
            ================================================================= */}
        <section className="product-tile-light" id="overview">
          <div className="container">
            <div style={{ marginBottom: "var(--spacing-md)" }}>
              <span
                style={{
                  fontSize: "17px",
                  fontWeight: 600,
                  color: "var(--color-ink-muted-48)",
                  letterSpacing: "-0.2px",
                }}
              >
                Clean Air &bull; Climate Resilience
              </span>
            </div>

            <h1 className="hero-display" style={{ marginBottom: "var(--spacing-md)" }}>
              Air. Measured to the meter.
            </h1>

            <p
              className="lead"
              style={{
                maxWidth: "760px",
                margin: "0 auto var(--spacing-xl) auto",
                color: "var(--color-ink-muted-48)",
              }}
            >
              A federated atmospheric intelligence platform for Indian economic corridors.
              Fusing ISRO geostationary telemetry, Google Earth Engine Sentinel-5P harmonization, and edge citizen radiometry.
            </p>

            <div className="hero-button-group">
              <Link href="/corridor" className="button-primary">
                Explore Corridor Map
              </Link>
              <Link href="/insat" className="button-secondary-pill">
                Orbital Cadence &rarr;
              </Link>
            </div>

            {/* Elevated Architecture Pedestal Card (Apple Product Elevation) */}
            <div
              className="store-utility-card apple-product-elevation"
              style={{
                maxWidth: "960px",
                margin: "0 auto",
                backgroundColor: "#ffffff",
                padding: "var(--spacing-xxl) var(--spacing-xl)",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "var(--spacing-xl)",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--color-primary)",
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                      marginBottom: "6px",
                    }}
                  >
                    Spatial Resolution
                  </div>
                  <h3 className="body-strong" style={{ fontSize: "19px", marginBottom: "8px" }}>
                    Corridor Air-Shed
                  </h3>
                  <p className="caption" style={{ lineHeight: "1.5", marginBottom: "16px" }}>
                    Bridges sparse macro stations with acute hyper-local hotspot detection along key industrial transit arteries.
                  </p>
                  <Link href="/corridor" className="text-link" style={{ fontSize: "14px" }}>
                    View live corridor &rarr;
                  </Link>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--color-primary)",
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                      marginBottom: "6px",
                    }}
                  >
                    Temporal Cadence
                  </div>
                  <h3 className="body-strong" style={{ fontSize: "19px", marginBottom: "8px" }}>
                    ISRO INSAT-3DR
                  </h3>
                  <p className="caption" style={{ lineHeight: "1.5", marginBottom: "16px" }}>
                    Continuous 15-minute geostationary scans over India at 74&deg;E, capturing the dusk twilight evasion window.
                  </p>
                  <Link href="/insat" className="text-link" style={{ fontSize: "14px" }}>
                    Compare satellite scans &rarr;
                  </Link>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--color-primary)",
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                      marginBottom: "6px",
                    }}
                  >
                    Accountability
                  </div>
                  <h3 className="body-strong" style={{ fontSize: "19px", marginBottom: "8px" }}>
                    Source Attribution
                  </h3>
                  <p className="caption" style={{ lineHeight: "1.5", marginBottom: "16px" }}>
                    Inverse Lagrangian particle dispersion tracing wind vectors backward in time to pinpoint the emitter.
                  </p>
                  <Link href="/attribution" className="text-link" style={{ fontSize: "14px" }}>
                    Simulate trajectory &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================
            DARK TILE: Breakthrough Technology Showcase
            ================================================================= */}
        <section className="product-tile-dark" id="innovations">
          <div className="container">
            <span
              style={{
                fontSize: "17px",
                fontWeight: 600,
                color: "var(--color-primary-on-dark)",
                letterSpacing: "-0.2px",
                marginBottom: "8px",
                display: "inline-block",
              }}
            >
              Scientific Breakthroughs
            </span>

            <h2 className="display-lg" style={{ color: "#ffffff", marginBottom: "var(--spacing-sm)" }}>
              Physics-informed. Zero cloud overhead.
            </h2>

            <p
              className="lead-airy"
              style={{
                maxWidth: "760px",
                margin: "0 auto var(--spacing-xxl) auto",
              }}
            >
              Engineered to overcome the physical satellite blind spots, legal blame games,
              and expensive hardware barriers that stall existing government action.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "var(--spacing-lg)",
                textAlign: "left",
              }}
            >
              {/* Card 1 */}
              <div
                style={{
                  backgroundColor: "var(--color-surface-tile-2)",
                  padding: "var(--spacing-xl)",
                  borderRadius: "var(--rounded-lg)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <div style={{ color: "var(--color-primary-on-dark)", fontSize: "12px", fontWeight: 600, letterSpacing: "0.5px", marginBottom: "8px" }}>
                  INNOVATION 01
                </div>
                <h3 className="tagline" style={{ color: "#ffffff", marginBottom: "8px" }}>
                  15-Min Geostationary Cadence
                </h3>
                <p className="caption" style={{ color: "var(--color-body-muted)", marginBottom: "var(--spacing-lg)" }}>
                  NASA polar satellites pass India only twice a day. ISRO INSAT-3DR continuously captures
                  optical depth every 15 minutes, cross-calibrated with Google Earth Engine Sentinel-5P TROPOMI baselines.
                </p>
                <Link href="/insat" className="text-link-on-dark" style={{ fontSize: "14px" }}>
                  Explore orbital cadence &rarr;
                </Link>
              </div>

              {/* Card 2 */}
              <div
                style={{
                  backgroundColor: "var(--color-surface-tile-2)",
                  padding: "var(--spacing-xl)",
                  borderRadius: "var(--rounded-lg)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <div style={{ color: "var(--color-primary-on-dark)", fontSize: "12px", fontWeight: 600, letterSpacing: "0.5px", marginBottom: "8px" }}>
                  INNOVATION 02
                </div>
                <h3 className="tagline" style={{ color: "#ffffff", marginBottom: "8px" }}>
                  Inverse Ray-Tracing Attribution
                </h3>
                <p className="caption" style={{ color: "var(--color-body-muted)", marginBottom: "var(--spacing-lg)" }}>
                  Reverses atmospheric advection-diffusion vectors to answer the core administrative question:
                  who emitted the toxic plume?
                </p>
                <Link href="/attribution" className="text-link-on-dark" style={{ fontSize: "14px" }}>
                  View attribution physics &rarr;
                </Link>
              </div>

              {/* Card 3 */}
              <div
                style={{
                  backgroundColor: "var(--color-surface-tile-2)",
                  padding: "var(--spacing-xl)",
                  borderRadius: "var(--rounded-lg)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <div style={{ color: "var(--color-primary-on-dark)", fontSize: "12px", fontWeight: 600, letterSpacing: "0.5px", marginBottom: "8px" }}>
                  INNOVATION 03
                </div>
                <h3 className="tagline" style={{ color: "#ffffff", marginBottom: "8px" }}>
                  Smartphone Camera Radiometry
                </h3>
                <p className="caption" style={{ color: "var(--color-body-muted)", marginBottom: "var(--spacing-lg)" }}>
                  Zero physical sensors. Calculates particulate optical depth from camera EXIF exposure values
                  directly in the browser for $0.
                </p>
                <Link href="/radiometry" className="text-link-on-dark" style={{ fontSize: "14px" }}>
                  Test camera radiometry &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================
            PARCHMENT TILE: Intelligent Atmospheric Advisor
            ================================================================= */}
        <section className="product-tile-parchment">
          <div className="container" style={{ textAlign: "center" }}>
            <span
              style={{
                fontSize: "17px",
                fontWeight: 600,
                color: "var(--color-primary)",
                letterSpacing: "-0.2px",
                marginBottom: "8px",
                display: "inline-block",
              }}
            >
              Intelligent Air Guidance
            </span>

            <h2 className="display-lg" style={{ marginBottom: "var(--spacing-sm)" }}>
              Exur Advisor.
            </h2>

            <p
              className="lead"
              style={{
                maxWidth: "720px",
                margin: "0 auto var(--spacing-xl) auto",
                color: "var(--color-ink-muted-48)",
              }}
            >
              Consult specialized atmospheric intelligence for inter-district relocation,
              elderly asthma defense, and hyper-local aerosol dispersion across Delhi-NCR.
            </p>

            <Link href="/advisor" className="button-primary">
              Consult Atmospheric Advisor
            </Link>
          </div>
        </section>
      </main>

      {/* Reusable Adaptive Minimal Footer */}
      <Footer />
    </div>
  );
}
