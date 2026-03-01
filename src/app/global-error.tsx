"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: "2rem", fontFamily: "system-ui", background: "#0a0a0a", color: "#fff" }}>
        <h2>Something went wrong</h2>
        <button
          type="button"
          onClick={() => reset()}
          style={{ padding: "0.5rem 1rem", cursor: "pointer", marginTop: "1rem" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
