import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import EmployeePage from "./EmployeePage";
import HomeDashboard from "../components/HomeDashboard.jsx";
import "../styles/Home.css";

function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { member, signOut, profileType } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("hrms_theme") === "dark");
  const [headerSearch, setHeaderSearch] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const menuRef = useRef(null);
  const notifRef = useRef(null);

  const notifications = useMemo(
    () => [
      { id: 1, type: "high", text: "Compliance verification pending for 3 employees." },
      { id: 2, type: "medium", text: "Two onboarding checklists are incomplete." },
      { id: 3, type: "low", text: "Employee directory synced successfully." },
    ],
    []
  );

  useEffect(() => {
    function onDocMouseDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    }

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    if (location.pathname === "/home") {
      navigate("/home/dashboard", { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    document.body.classList.toggle("theme-dark", darkMode);
    localStorage.setItem("hrms_theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  async function onLogout() {
    await signOut();
    navigate("/auth");
  }

  const currentModule = useMemo(() => {
    if (location.pathname.includes("/home/employees")) return "employees";
    if (location.pathname.includes("/home/hr-modules")) return "hr";
    return "dashboard";
  }, [location.pathname]);

  const breadcrumb = useMemo(() => {
    if (currentModule === "employees") return "Home / Employees";
    if (currentModule === "hr") return "Home / HR Suite";
    return "Home / Dashboard";
  }, [currentModule]);

  const navItems = [
    { key: "dashboard", label: "Dashboard", icon: "bi-grid-1x2", onClick: () => navigate("/home/dashboard") },
    { key: "employees", label: "Employees", icon: "bi-people", onClick: () => navigate("/home/employees") },
    { key: "add", label: "Add Employee", icon: "bi-plus-circle", onClick: () => navigate("/home/employees/new") },
  ];
  if (profileType === "hr") {
    navItems.push({ key: "hr", label: "HR Suite", icon: "bi-stars", onClick: () => navigate("/home/hr-modules") });
  }

  function renderMainView() {
    if (currentModule === "dashboard") return <HomeDashboard />;
    if (currentModule === "employees") return <EmployeePage globalSearch={headerSearch} />;
    return <HomeDashboard />;
  }

  return (
    <div className="home-shell">
      <div className="home-topbar">
        <div className="home-top-left">
          <button
            className="icon-btn desktop-only"
            type="button"
            aria-label="Toggle sidebar"
            onClick={() => setSidebarCollapsed((v) => !v)}
          >
            <i className="bi bi-layout-sidebar-inset" />
          </button>
          <button
            className="icon-btn mobile-only"
            type="button"
            aria-label="Open navigation"
            onClick={() => setMobileDrawerOpen(true)}
          >
            <i className="bi bi-list" />
          </button>
          <div className="home-brand-kicker">OPERATIONS CONSOLE</div>
          <div className="home-brand-title">HRMS Portal</div>
        </div>

        <div className="home-top-actions">
          <div className="home-top-search">
            <i className="bi bi-search" />
            <input
              type="search"
              placeholder="Search employees, department, alerts..."
              value={headerSearch}
              onChange={(e) => setHeaderSearch(e.target.value)}
            />
          </div>

          <button className="icon-btn" type="button" onClick={() => setDarkMode((v) => !v)} aria-label="Toggle dark mode">
            <i className={`bi ${darkMode ? "bi-sun" : "bi-moon-stars"}`} />
          </button>

          <div className="dropdown" ref={notifRef}>
            <button className="icon-btn" type="button" aria-label="Notifications" onClick={() => setNotifOpen((v) => !v)}>
              <i className="bi bi-bell" />
              <span className="notif-dot" />
            </button>
            <div className={`notif-panel${notifOpen ? " open" : ""}`}>
              <h4>Notifications</h4>
              {notifications.map((item) => (
                <div key={item.id} className={`notif-item ${item.type}`}>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="dropdown" ref={menuRef}>
          <button
            className="home-userbtn"
            type="button"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <i className="bi bi-person-circle" />
          </button>

          <ul className={`dropdown-menu dropdown-menu-end home-dropdown${menuOpen ? " show" : ""}`}>
            <li className="px-3 pt-2 pb-1">
              <div className="home-userline">
                <i className="bi bi-person-circle" />
                <div>
                  <div className="home-username">{member?.name || "--"}</div>
                  <div className="home-userdetail">{member?.email || "--"}</div>
                  <div className="home-userdetail">{member?.phone || "--"}</div>
                </div>
              </div>
            </li>
            <li>
              <hr className="dropdown-divider" />
            </li>
            <li className="px-3 pb-3">
              <button className="btn btn-danger w-100" type="button" onClick={onLogout}>
                Logout
              </button>
            </li>
          </ul>
        </div>
        </div>
      </div>

      <main className="home-layout" aria-live="polite">
        <aside className={`home-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${mobileDrawerOpen ? "open" : ""}`}>
          <button className="icon-btn mobile-close" type="button" onClick={() => setMobileDrawerOpen(false)} aria-label="Close navigation">
            <i className="bi bi-x-lg" />
          </button>
          <div className="home-side-head">
            <div className="home-side-role">{profileType === "hr" ? "HR Profile" : "User Profile"}</div>
            <div className="home-side-name">{member?.name || "--"}</div>
          </div>
          <nav className="home-nav">
            {navItems.map((item) => (
              <button
                key={item.key}
                className={`home-nav-item${currentModule === item.key || (item.key === "add" && location.pathname.endsWith("/employees/new")) ? " active" : ""}`}
                onClick={() => {
                  item.onClick();
                  setMobileDrawerOpen(false);
                }}
              >
                <i className={`bi ${item.icon}`} />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </nav>
        </aside>
        <div className="home-main-panel">
          <div className="home-panel-head">
            <div>
              <button className="ghost-back" type="button" onClick={() => window.history.back()}>
                <i className="bi bi-arrow-left" /> Back
              </button>
              <div className="crumb">{breadcrumb}</div>
              <h1 className="home-title">
                {currentModule === "dashboard" && "Dashboard"}
                {currentModule === "employees" && "Employee Directory"}
                {currentModule === "hr" && "HR Suite"}
              </h1>
              <p className="home-subtitle">Modern enterprise controls with responsive, click-based modules.</p>
            </div>
          </div>
          <div className="panel-fade">{renderMainView()}</div>
        </div>
      </main>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {navItems.slice(0, 4).map((item) => (
          <button
            key={item.key}
            type="button"
            className={currentModule === item.key ? "active" : ""}
            onClick={item.onClick}
          >
            <i className={`bi ${item.icon}`} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default HomePage;
