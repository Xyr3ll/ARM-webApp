import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import "../styles/LoginPage.css";
import stiLogo from "../assets/logo.png";

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const adminsRef = collection(db, "admins");
      const q = query(
        adminsRef,
        where("email", "==", email),
        where("password", "==", password)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const user = querySnapshot.docs[0].data();
        if (user.role === "Academic Head") {
          navigate("/dashboard/academic-head");
        } else if (user.role === "Program Head") {
          navigate("/dashboard/program-head");
        } else {
          alert(`Welcome, ${user.role || "Admin"}!`);
          // TODO: Add more role-based redirects if needed
        }
      } else {
        setError("Invalid credentials. Please try again.");
      }
    } catch (err) {
      setError("Login failed. Please try again later.");
      console.error(err);
    }
  };

  return (
    <div className="login-container">
      <div className="login-overlay">
        <div className="login-card">
          <img
            src={stiLogo}
            alt="ARM Logo"
            className="login-logo"
          />

          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div className="login-error">{error}</div>}
            <div className="input-group">
              <div className="input-icon">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3 4C3 3.44772 3.44772 3 4 3H16C16.5523 3 17 3.44772 17 4V5.5L10 10L3 5.5V4Z"
                    fill="currentColor"
                  />
                  <path
                    d="M3 7.5V16C3 16.5523 3.44772 17 4 17H16C16.5523 17 17 16.5523 17 16V7.5L10 12L3 7.5Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email"
                required
              />
            </div>

            <div className="input-group">
              <div className="input-icon">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5 8V6C5 3.79086 6.79086 2 9 2H11C13.2091 2 15 3.79086 15 6V8H16C16.5523 8 17 8.44772 17 9V17C17 17.5523 16.5523 18 16 18H4C3.44772 18 3 17.5523 3 17V9C3 8.44772 3.44772 8 4 8H5ZM7 8H13V6C13 4.89543 12.1046 4 11 4H9C7.89543 4 7 4.89543 7 6V8Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>

            <button type="submit" className="login-button">
              LOGIN
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
