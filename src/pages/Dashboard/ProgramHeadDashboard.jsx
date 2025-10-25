import React from "react";
import "../../styles/AcademicHeadDashboard.css";
import stiLogo from "../../assets/logo.png";
import { HiBell, HiUserCircle } from "react-icons/hi";
import {
  HiHome,
  HiCalendarDays,
  HiUsers,
  HiClipboardDocumentList,
  HiBookOpen,
  HiArrowsRightLeft,
  HiArchiveBox,
  HiArrowRightOnRectangle,
} from "react-icons/hi2";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { HiMenu } from "react-icons/hi";

const ProgramHeadDashboard = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(window.innerWidth > 768);

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleSignOut = () => {
    const confirmed = window.confirm("Are you sure you want to sign out?");
    if (confirmed) {
      navigate("/");
    }
  };

  return (
    <div className="dashboard-root">
      <div className="dashboard-header">
        <div className="dashboard-topbar">
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen((v) => !v)}
            style={{
              marginRight: 16,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 28,
              color: "#0a2f5c",
              display: "flex",
              alignItems: "center",
            }}
            aria-label="Toggle sidebar"
          >
            <HiMenu />
          </button>
          <span className="dashboard-title">Academic Resource Management</span>
          <div className="dashboard-user">
            <span className="dashboard-username">Program Head</span>
          </div>
        </div>
      </div>
      <div className="dashboard-main">
        {sidebarOpen && (
          <aside className="dashboard-sidebar">
            <img
              src={stiLogo}
              alt="ARM Logo"
              className="dashboard-logo"
              style={{ marginBottom: 12 }}
            />
            <ul className="sidebar-list">
              <li>
                <NavLink
                  to="."
                  end
                  className={({ isActive }) =>
                    isActive ? "side-link active" : "side-link"
                  }
                >
                  <HiHome className="side-icon" /> Home
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="approve-user"
                  className={({ isActive }) =>
                    isActive ? "side-link active" : "side-link"
                  }
                >
                  <HiUserCircle className="side-icon" /> Approve User
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="faculty-scheduling"
                  className={({ isActive }) =>
                    isActive ? "side-link active" : "side-link"
                  }
                >
                  <HiCalendarDays className="side-icon" /> Faculty Scheduling
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="faculty-loading"
                  className={({ isActive }) =>
                    isActive ? "side-link active" : "side-link"
                  }
                >
                  <HiUsers className="side-icon" /> Faculty Loading
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="schedule-overview"
                  className={({ isActive }) =>
                    isActive ? "side-link active" : "side-link"
                  }
                >
                  <HiClipboardDocumentList className="side-icon" /> Schedule
                  Overview
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="reservations"
                  className={({ isActive }) =>
                    isActive ? "side-link active" : "side-link"
                  }
                >
                  <HiBookOpen className="side-icon" /> Reservations
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="substitution"
                  className={({ isActive }) =>
                    isActive ? "side-link active" : "side-link"
                  }
                >
                  <HiArrowsRightLeft className="side-icon" /> Substitution
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="faculty-archive"
                  className={({ isActive }) =>
                    isActive ? "side-link active" : "side-link"
                  }
                >
                  <HiArchiveBox className="side-icon" /> Archives
                </NavLink>
              </li>
              <li>
                <div
                  className="side-link"
                  onClick={handleSignOut}
                  style={{ cursor: "pointer" }}
                >
                  <HiArrowRightOnRectangle className="side-icon" /> Sign Out
                </div>
              </li>
            </ul>
          </aside>
        )}
        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ProgramHeadDashboard;
