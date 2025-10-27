import React from "react";
import "../../styles/AcademicHeadDashboard.css";
import { db } from "../../firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp,
  deleteField,
  getDocs,
} from "firebase/firestore";

export default function ApproveUser() {
  const [users, setUsers] = React.useState([]);
  const [queryText, setQueryText] = React.useState("");
  const [showPendingOnly, setShowPendingOnly] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [rowLoading, setRowLoading] = React.useState({});

  React.useEffect(() => {
    setLoading(true);
    setError(null);

    // subscribe to all users so UI stays in sync; we'll filter locally
    const q = query(collection(db, "users"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUsers(list);
        setLoading(false);
      },
      (err) => {
        console.error("Users snapshot error:", err);
        setError(err.message || String(err));
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const handleApprove = async (id) => {
    const user = users.find((u) => u.id === id);
    const prevEmail = user?.email || null;
    // mark loading for this id
    setRowLoading((s) => ({ ...s, [id]: true }));
    try {
      const updates = {
        approved: true,
        declined: false,
        updatedAt: serverTimestamp(),
        archivedEmail: prevEmail || null,
      };
      if (prevEmail) updates.email = deleteField();
      await updateDoc(doc(db, "users", id), updates);
    } catch (err) {
      console.error("Approve error:", err);
      setError(err.message || String(err));
    } finally {
      setRowLoading((s) => ({ ...s, [id]: false }));
    }
  };

  const handleDecline = async (id) => {
    const confirmed = window.confirm("Decline this user's registration?");
    if (!confirmed) return;
    const user = users.find((u) => u.id === id);
    const archived = user?.archivedEmail || null;
    setRowLoading((s) => ({ ...s, [id]: true }));
    try {
      const updates = {
        approved: false,
        declined: true,
        updatedAt: serverTimestamp(),
      };
      // if we have an archivedEmail (from prior approval) restore it back to email
      if (archived) {
        updates.email = archived;
        updates.archivedEmail = deleteField();
      }
      await updateDoc(doc(db, "users", id), updates);
    } catch (err) {
      console.error("Decline error:", err);
      setError(err.message || String(err));
    } finally {
      setRowLoading((s) => ({ ...s, [id]: false }));
    }
  };

  const filtered = React.useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return users
      .filter((u) => {
        // If showPendingOnly is enabled we only hide explicitly declined users.
        // This keeps approved users visible in the list after approval.
        if (showPendingOnly && u.declined) return false;
        if (!q) return true;
        const name = (u.fullName || u.name || "").toString().toLowerCase();
        const username = (u.username || "").toString().toLowerCase();
        const role = (u.role || "").toString().toLowerCase();
        return name.includes(q) || username.includes(q) || role.includes(q);
      })
      // sort pending first then by createdAt if available
      .sort((a, b) => {
        const aa = a.approved ? 1 : 0;
        const bb = b.approved ? 1 : 0;
        if (aa !== bb) return aa - bb;
        const at = a.createdAt && typeof a.createdAt.toDate === "function" ? a.createdAt.toDate().getTime() : 0;
        const bt = b.createdAt && typeof b.createdAt.toDate === "function" ? b.createdAt.toDate().getTime() : 0;
        return bt - at;
      });
  }, [users, queryText, showPendingOnly]);

  const formatDate = (ts) => {
    if (!ts) return "-";
    try {
      if (typeof ts.toDate === "function") return ts.toDate().toLocaleString();
      const d = new Date(ts);
      return isNaN(d.getTime()) ? "-" : d.toLocaleString();
    } catch (e) {
      return "-";
    }
  };

  return (
    <div className="approve-user-root">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Approve Users</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={showPendingOnly} onChange={(e) => setShowPendingOnly(e.target.checked)} />
            Hide declined
          </label>
          <input
            placeholder="Search name, email, username or role"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
          />
        </div>
      </div>

      {error && (
        <div style={{ color: "#721c24", background: "#f8d7da", padding: 8, borderRadius: 6, marginBottom: 8 }}>{String(error)}</div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 8 }}>Name</th>
              <th style={{ textAlign: "left", padding: 8 }}>Username</th>
              <th style={{ textAlign: "left", padding: 8 }}>Registered</th>
              <th style={{ textAlign: "left", padding: 8 }}>Approved</th>
              <th style={{ textAlign: "left", padding: 8 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: 12, textAlign: "center", color: "#666" }}>Loading...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 12, textAlign: "center", color: "#666" }}>
                  No users found.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>{u.fullName || u.name || "-"}</td>
                  <td style={{ padding: 8 }}>{u.username || "-"}</td>
                  <td style={{ padding: 8 }}>{formatDate(u.createdAt)}</td>
                  <td style={{ padding: 8 }}>
                    <span style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      background: (!u.approved && !u.declined) ? "#fff3cd" : u.approved ? "#d4edda" : "#f8d7da",
                      color: (!u.approved && !u.declined) ? "#856404" : u.approved ? "#155724" : "#721c24",
                      fontWeight: 600,
                      fontSize: 12,
                    }}>{u.declined ? "declined" : u.approved ? "approved" : "pending"}</span>
                  </td>
                  <td style={{ padding: 8 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      {(() => {
                        const hasStatus = !!u.approved || !!u.declined;
                        const isBusy = !!rowLoading[u.id];
                        const disabled = isBusy || hasStatus;
                        return (
                          <>
                            <button
                              onClick={() => handleApprove(u.id)}
                              disabled={disabled}
                              style={{ padding: "6px 10px", borderRadius: 6, background: "#0a74da", color: "white", border: "none", cursor: disabled ? (isBusy ? "wait" : "not-allowed") : "pointer", opacity: disabled ? 0.65 : 1 }}
                            >
                              {isBusy ? "..." : "Approve"}
                            </button>
                            <button
                              onClick={() => handleDecline(u.id)}
                              disabled={disabled}
                              style={{ padding: "6px 10px", borderRadius: 6, background: "#e55353", color: "white", border: "none", cursor: disabled ? (isBusy ? "wait" : "not-allowed") : "pointer", opacity: disabled ? 0.65 : 1 }}
                            >
                              {isBusy ? "..." : "Decline"}
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
