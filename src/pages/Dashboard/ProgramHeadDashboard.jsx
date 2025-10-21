import React from "react";
import "../../styles/AcademicHeadDashboard.css";
import stiLogo from "../../assets/stilogo.png";
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

const ProgramHeadDashboard = () => {
  const navigate = useNavigate();

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
          <img src={stiLogo} alt="STI Logo" className="dashboard-logo" />
          <span className="dashboard-title">Academic Resource Management</span>
          <div className="dashboard-user">
            <span className="dashboard-bell" aria-label="Notifications">
              <HiBell className="dashboard-icon solid" />
            </span>
            <span className="dashboard-user-icon" aria-label="User">
              <HiUserCircle className="dashboard-icon solid" />
            </span>
            <span className="dashboard-username">Program Head</span>
          </div>
        </div>
      </div>
      <div className="dashboard-main">
        <aside className="dashboard-sidebar">
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
                <HiClipboardDocumentList className="side-icon" /> Schedule Overview
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
                <HiArchiveBox className="side-icon" /> Archive
              </NavLink>
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
        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ProgramHeadDashboard;
