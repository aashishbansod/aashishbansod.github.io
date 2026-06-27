import { useState } from "react";
import { Outlet } from "react-router-dom";
import {
  FaBars,
  FaTimes,
  FaBell,
  FaUserShield,
} from "react-icons/fa";

import Sidebar from "../components/common/Sidebar";

function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  return (
    <div className="h-screen flex bg-slate-100 overflow-hidden">

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed lg:static
          top-0 left-0
          z-50
          h-full
          transition-transform duration-300
          ${
            sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0"
          }
        `}
      >
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="bg-white border-b border-slate-200 shadow-sm">

          <div className="flex items-center justify-between px-6 py-4">

            <div className="flex items-center gap-4">

              <button
                onClick={() =>
                  setSidebarOpen(
                    !sidebarOpen
                  )
                }
                className="lg:hidden text-xl"
              >
                {sidebarOpen ? (
                  <FaTimes />
                ) : (
                  <FaBars />
                )}
              </button>

              <div>
                <h1 className="font-bold text-xl">
                  CyberNet Admin Portal
                </h1>

                <p className="text-sm text-slate-500">
                  Internship Management System
                </p>
              </div>

            </div>

            <div className="flex items-center gap-4">

              <button className="bg-slate-100 p-3 rounded-xl">
                <FaBell />
              </button>

              <div className="flex items-center gap-2">

                <FaUserShield className="text-3xl text-blue-600" />

                <div>
                  <h4 className="font-semibold">
                    Admin
                  </h4>

                  <p className="text-xs text-slate-500">
                    CyberNet
                  </p>
                </div>

              </div>

            </div>

          </div>

        </header>

        {/* Page Area */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>

      </div>

    </div>
  );
}

export default AdminLayout;