"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main
      className="container"
      style={{ textAlign: "center", padding: "100px 20px" }}
    >
      <p className="eyebrow">AYOUB SHOP</p>
      <h1 style={{ fontSize: 32, margin: "25px 0" }}>One moment, please.</h1>
      <p style={{ color: "#96a3ba", marginBottom: 25 }}>
        We couldn’t load this page. Please try again.
      </p>
      <button className="primary-btn" onClick={reset}>
        Try again
      </button>
      <a
        className="text-link"
        href="/"
        style={{ display: "block", marginTop: 20 }}
      >
        Back to the collection
      </a>
    </main>
  );
}
