import { useState } from "react";
import { verifyHrAccess } from "../api/hrApi";

const STORAGE_KEY = "hr_modules_unlocked";

function HrAccessGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(STORAGE_KEY) === "1");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onUnlock(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await verifyHrAccess(username, password);
      sessionStorage.setItem(STORAGE_KEY, "1");
      setUnlocked(true);
      setUsername("");
      setPassword("");
    } catch (err) {
      setError(err.message || "Failed to verify password");
    } finally {
      setLoading(false);
    }
  }

  if (unlocked) return children;

  return (
    <section style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#eef4fb", padding: "16px" }}>
      <form
        onSubmit={onUnlock}
        style={{
          width: "min(420px, 100%)",
          background: "#fff",
          border: "1px solid #d9e7f6",
          borderRadius: "14px",
          padding: "18px",
          boxShadow: "0 12px 28px rgba(33, 73, 113, 0.12)",
        }}
      >
        <h2 style={{ margin: 0, color: "#1f456d" }}>HR Modules Locked</h2>
        <p style={{ marginTop: "8px", color: "#5d7791" }}>
          Enter the HR access password to continue.
        </p>
        {error && (
          <div style={{ marginBottom: "10px", background: "#fff1f1", color: "#b42318", padding: "10px", borderRadius: "8px" }}>
            {error}
          </div>
        )}
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="HR Username"
          required
          style={{ width: "100%", border: "1px solid #c6d7ec", borderRadius: "10px", padding: "10px", marginBottom: "10px" }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="HR Password"
          required
          style={{ width: "100%", border: "1px solid #c6d7ec", borderRadius: "10px", padding: "10px" }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: "10px",
            width: "100%",
            border: "none",
            borderRadius: "10px",
            background: "#2a7fe0",
            color: "#fff",
            padding: "10px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {loading ? "Checking..." : "Unlock HR Modules"}
        </button>
      </form>
    </section>
  );
}

export default HrAccessGate;
