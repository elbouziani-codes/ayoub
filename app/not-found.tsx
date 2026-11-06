export default function NotFound() {
  return (
    <main
      className="container"
      style={{ textAlign: "center", padding: "120px 20px" }}
    >
      <p className="eyebrow" style={{ justifyContent: "center" }}>
        AYOUB SHOP · 404
      </p>
      <h1 style={{ fontSize: 38, margin: "25px 0" }}>
        This moment slipped away.
      </h1>
      <p style={{ color: "#8c9bb3", marginBottom: 30 }}>
        The watch or page you’re looking for isn’t available.
      </p>
      <a className="primary-btn" href="/">
        Discover the collection ↗
      </a>
    </main>
  );
}
