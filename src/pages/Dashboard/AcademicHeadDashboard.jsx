import React from "react";
import "../../styles/AcademicHeadDashboard.css";
import stiLogo from "../../assets/logo.png";
import { HiBell, HiUserCircle } from "react-icons/hi";
import {
  HiHome,
  HiBookOpen,
  HiCalendarDays,
  HiClipboardDocumentList,
  HiArchiveBox,
  HiArrowRightOnRectangle,
} from "react-icons/hi2";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { HiMenu } from "react-icons/hi";

const AcademicHeadDashboard = () => {
  const navigate = useNavigate();
  const [scheduleOpen, setScheduleOpen] = React.useState(true);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(window.innerWidth > 768);

  const handleSignOut = () => {
    const confirmed = window.confirm('Are you sure you want to sign out?');
    if (confirmed) {
      navigate('/');
    }
  };

  return (
    <div className="dashboard-root">
      <div className="dashboard-header">
        <div className="dashboard-topbar">
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen((v) => !v)}
            style={{ marginRight: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 28, color: '#0a2f5c', display: 'flex', alignItems: 'center' }}
            aria-label="Toggle sidebar"
          >
            <HiMenu />
          </button>
          <span className="dashboard-title">Academic Resource Management</span>
          <div className="dashboard-user">
            <span className="dashboard-username">Academic Head</span>
          </div>
        </div>
      </div>
      <div className="dashboard-main">
        {sidebarOpen && (
          <aside className="dashboard-sidebar">
            <img src={stiLogo} alt="ARM Logo" className="dashboard-logo" style={{ marginBottom: 24 }} />
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
                  to="curriculum"
                  className={({ isActive }) =>
                    isActive ? "side-link active" : "side-link"
                  }
                >
                  <HiClipboardDocumentList className="side-icon" /> Academic
                </NavLink>
              </li>
              <li>
                <div
                  className="sidebar-category"
                  onClick={() => setScheduleOpen((v) => !v)}
                >
                  <HiCalendarDays className="side-icon" /> Schedule
                  <span
                    className={"sidebar-arrow" + (scheduleOpen ? " open" : "")}
                  >
                    ▼
                  </span>
                </div>
                {scheduleOpen && (
                  <ul className="sidebar-sublist">
                    <li>
                      <NavLink
                        to="create-schedule"
                        className={({ isActive }) =>
                          isActive ? "side-link active" : "side-link"
                        }
                      >
                        Create Schedule
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        to="schedule-overview"
                        className={({ isActive }) =>
                          isActive ? "side-link active" : "side-link"
                        }
                      >
                        Schedule Overview
                      </NavLink>
                    </li>
                  </ul>
                )}
              </li>
              <li>
                <div
                  className="sidebar-category"
                  onClick={() => setArchiveOpen((v) => !v)}
                >
                  <HiArchiveBox className="side-icon" /> Archive
                  <span
                    className={"sidebar-arrow" + (archiveOpen ? " open" : "")}
                  >
                    ▼
                  </span>
                </div>
                {archiveOpen && (
                  <ul className="sidebar-sublist">
                    <li>
                      <NavLink
                        to="curriculum-archive"
                        className={({ isActive }) =>
                          isActive ? "side-link active" : "side-link"
                        }
                      >
                        Academic Archive
                      </NavLink>
                    </li>
                  </ul>
                )}
              </li>
              <li>
                <div
                  className="side-link"
                  onClick={handleSignOut}
                  style={{ cursor: 'pointer' }}
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

export default AcademicHeadDashboard;
