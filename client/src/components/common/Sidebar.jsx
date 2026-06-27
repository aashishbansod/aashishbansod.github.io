import { NavLink, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaUserGraduate,
  FaTasks,
  FaCode,
  FaCertificate,
  FaTrophy,
  FaBrain,
  FaClipboardCheck,
  FaBriefcase,
  FaUser,
  FaSignOutAlt,
} from "react-icons/fa";

import LogoLight from "../../assets/logo-light.png";

function Sidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("cybernet_token");
    localStorage.removeItem("userRole");

    navigate("/login");
  };

  const menuItems = [
    {
      name: "Dashboard",
      path: "/student/dashboard",
      icon: <FaHome />,
    },
    {
      name: "Internships",
      path: "/student/internships",
      icon: <FaBriefcase />,
    },
    {
      name: "Daily Tasks",
      path: "/student/daily-tasks",
      icon: <FaTasks />,
    },
    {
      name: "Coding Practice",
      path: "/student/coding-practice",
      icon: <FaCode />,
    },
    {
      name: "Assessment",
      path: "/student/assessment",
      icon: <FaClipboardCheck />,
    },
    {
      name: "Certificates",
      path: "/student/certificates",
      icon: <FaCertificate />,
    },
    {
      name: "Leaderboard",
      path: "/student/leaderboard",
      icon: <FaTrophy />,
    },
    {
      name: "Scholarship",
      path: "/student/scholarship",
      icon: <FaUserGraduate />,
    },
    {
      name: "AI Mentor",
      path: "/student/ai-mentor",
      icon: <FaBrain />,
    },
    {
      name: "Profile",
      path: "/student/profile",
      icon: <FaUser />,
    },
  ];

  return (
    <aside className="w-72 min-h-screen bg-slate-950 border-r border-slate-800 flex flex-col">

      {/* Logo */}
      <div className="p-6 border-b border-slate-800">
        <img
          src={LogoLight}
          alt="CyberNet"
          className="h-12 object-contain"
        />

        <h2 className="text-white text-xl font-bold mt-4">
          Student Portal
        </h2>

        <p className="text-slate-400 text-sm">
          CyberNet Technology Systems
        </p>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-4 space-y-2">

        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300
              ${
                isActive
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`
            }
          >
            <span className="text-lg">
              {item.icon}
            </span>

            <span className="font-medium">
              {item.name}
            </span>
          </NavLink>
        ))}

      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800">

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-3 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl transition"
        >
          <FaSignOutAlt />
          Logout
        </button>

      </div>

    </aside>
  );
}

export default Sidebar;