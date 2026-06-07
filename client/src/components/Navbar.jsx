import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FaRocket,
  FaBars,
  FaTimes,
  FaArrowRight,
} from "react-icons/fa";

function Navbar() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    {
      name: "Home",
      path: "/",
    },

    {
      name: "About",
      path: "/about",
    },

    {
      name: "Verify Certificate",
      path: "/verify",
    },

    {
      name: "Contact",
      path: "/contact",
    },
  ];

  return (
    <>
      {/* TOP INFO BAR */}

      <div className="bg-gradient-to-r from-slate-950 via-blue-900 to-cyan-700 text-white">

        <div className="max-w-[1800px] mx-auto px-6 py-2 text-center text-sm font-medium tracking-wide">

          AI Solutions • Software Development • Internship Programs • Verified Certificates • Technology Consulting

        </div>

      </div>

      {/* MAIN NAVBAR */}

      <nav className="sticky top-0 z-50">

        <div
          className="
          bg-white/80
          backdrop-blur-2xl
          border-b
          border-slate-200
          shadow-[0_10px_40px_rgba(0,0,0,0.06)]
          "
        >

          <div className="max-w-[1700px] mx-auto px-8">

            <div className="h-[95px] flex items-center justify-between">

              {/* LOGO */}

              <Link
                to="/"
                className="flex items-center gap-4 group"
              >

                <div
                  className="
                  relative
                  w-16
                  h-16
                  rounded-3xl
                  bg-gradient-to-br
                  from-blue-600
                  via-cyan-500
                  to-purple-600
                  flex
                  items-center
                  justify-center
                  text-white
                  text-2xl
                  font-black
                  shadow-[0_15px_40px_rgba(37,99,235,0.35)]
                  group-hover:scale-105
                  transition-all
                  duration-300
                  "
                >
                  CN
                </div>

                <div>

                  <h1 className="text-[38px] font-black text-slate-900 leading-none">
                    CyberNet
                  </h1>

                  <p className="text-sm text-blue-600 font-bold tracking-wide">
                    Technology Systems
                  </p>

                </div>

              </Link>

              {/* DESKTOP MENU */}
                            <div className="hidden xl:flex items-center gap-10">

                {navItems.map((item) => (

                  <Link
                    key={item.name}
                    to={item.path}
                    className={`
                    relative
                    text-[16px]
                    font-bold
                    transition-all
                    duration-300
                    ${
                      location.pathname === item.path
                        ? "text-blue-600"
                        : "text-slate-700 hover:text-blue-600"
                    }
                    `}
                  >

                    {item.name}

                    <span
                      className={`
                      absolute
                      left-0
                      -bottom-3
                      h-[3px]
                      rounded-full
                      bg-gradient-to-r
                      from-blue-600
                      to-cyan-500
                      transition-all
                      duration-300
                      ${
                        location.pathname === item.path
                          ? "w-full"
                          : "w-0"
                      }
                      `}
                    />

                  </Link>

                ))}

              </div>

              {/* RIGHT SIDE */}

              <div className="flex items-center gap-4">

                {/* TRUST BADGE */}

                <div
                  className="
                  hidden
                  lg:flex
                  items-center
                  gap-3
                  px-6
                  py-3
                  rounded-full
                  bg-emerald-50
                  border
                  border-emerald-200
                  text-emerald-700
                  font-bold
                  "
                >

                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>

                  Trusted Since 2025

                </div>

                {/* LOGIN */}

                <Link to="/login">

                  <button
                    className="
                    hidden
                    md:block
                    px-8
                    py-3
                    rounded-2xl
                    border
                    border-slate-300
                    bg-white
                    text-slate-700
                    font-bold
                    hover:shadow-lg
                    hover:border-blue-300
                    transition-all
                    duration-300
                    "
                  >
                    Login
                  </button>

                </Link>

                {/* REGISTER */}

                <Link to="/register">

                  <button
                    className="
                    px-8
                    py-3
                    rounded-2xl
                    text-white
                    font-black
                    bg-gradient-to-r
                    from-blue-600
                    via-cyan-500
                    to-blue-600
                    flex
                    items-center
                    gap-3
                    shadow-[0_15px_35px_rgba(37,99,235,0.35)]
                    hover:scale-105
                    transition-all
                    duration-300
                    "
                  >

                    <FaRocket />

                    Register

                    <FaArrowRight className="text-sm" />

                  </button>

                </Link>

                {/* MOBILE MENU BUTTON */}

                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="
                  xl:hidden
                  text-2xl
                  text-slate-700
                  "
                >

                  {menuOpen ? (
                    <FaTimes />
                  ) : (
                    <FaBars />
                  )}

                </button>

              </div>

            </div>

          </div>

        </div>

        {/* MOBILE MENU START */}
                {menuOpen && (

          <div
            className="
            xl:hidden
            bg-white
            border-t
            border-slate-200
            shadow-2xl
            "
          >

            <div className="px-6 py-6 flex flex-col gap-6">

              {navItems.map((item) => (

                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setMenuOpen(false)}
                  className={`
                  py-3
                  text-lg
                  font-bold
                  transition-all
                  duration-300
                  ${
                    location.pathname === item.path
                      ? "text-blue-600"
                      : "text-slate-700"
                  }
                  `}
                >
                  {item.name}
                </Link>

              ))}

              <div className="border-t border-slate-200 pt-5 flex flex-col gap-4">

                {/* Login */}

                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                >

                  <button
                    className="
                    w-full
                    py-3
                    rounded-2xl
                    border
                    border-slate-300
                    font-bold
                    text-slate-700
                    bg-white
                    "
                  >
                    Login
                  </button>

                </Link>

                {/* Register */}

                <Link
                  to="/register"
                  onClick={() => setMenuOpen(false)}
                >

                  <button
                    className="
                    w-full
                    py-3
                    rounded-2xl
                    bg-gradient-to-r
                    from-blue-600
                    via-cyan-500
                    to-blue-600
                    text-white
                    font-black
                    flex
                    items-center
                    justify-center
                    gap-2
                    "
                  >
                    <FaRocket />
                    Register
                  </button>

                </Link>

              </div>

            </div>

          </div>

        )}

      </nav>

    </>
  );
}

export default Navbar;