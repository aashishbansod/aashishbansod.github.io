import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import {
  FaLaptopCode,
  FaCode,
  FaRobot,
  FaBrain,
  FaShieldAlt,
  FaCheckCircle,
  FaArrowRight,
  FaSearch,
  FaFilter,
  FaLock,
  FaClock,
  FaCertificate,
  FaGraduationCap,
  FaProjectDiagram,
  FaBuilding,
  FaStar,
  FaTimes,
} from "react-icons/fa";

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("cybernet_token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken") ||
    sessionStorage.getItem("cybernet_token") ||
    ""
  );
}

function SectionTitle({ eyebrow, title, subtitle }) {
  return (
    <div className="text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
        {eyebrow}
      </span>
      <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-slate-600">
        {subtitle}
      </p>
    </div>
  );
}

function StatCard({ value, label, icon: Icon }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <Icon />
      </div>
      <div className="mt-4 text-3xl font-black text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-600">{label}</div>
    </motion.div>
  );
}

function CompactInfo({ title, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function ProgramCard({ program, onViewDetails, onApply, isLoggedIn }) {
  const Icon = program.icon;

  return (
    <motion.div
      whileHover={{ y: -5 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm"
    >
      <div className="bg-gradient-to-r from-blue-600 to-cyan-500 p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur">
            <Icon />
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
            {program.level}
          </span>
        </div>

        <h3 className="mt-4 text-2xl font-black leading-tight">
          {program.title}
        </h3>

        <p className="mt-2 text-sm leading-7 text-blue-50/90">
          {program.shortDescription}
        </p>
      </div>

      <div className="p-5">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Internship Provider
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            CyberNet Technology Systems
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Duration
            </p>
            <p className="mt-1 text-sm font-black text-slate-900">
              {program.duration}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Mode
            </p>
            <p className="mt-1 text-sm font-black text-slate-900">
              {program.mode}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {program.skills.slice(0, 3).map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-blue-100 px-3 py-1.5 text-[11px] font-semibold text-blue-700"
            >
              {skill}
            </span>
          ))}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => onViewDetails(program)}
            className="flex-1 rounded-xl border border-blue-600 px-4 py-3 text-sm font-bold text-blue-600 transition hover:bg-blue-50"
          >
            Details
          </button>

          <button
            onClick={() => onApply(program)}
            className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-bold text-white transition hover:opacity-95"
          >
            {isLoggedIn ? "Apply" : "Login"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Internships() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("All");
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(Boolean(getToken()));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const internships = useMemo(
    () => [
      {
        id: 1,
        slug: "frontend-development",
        icon: FaLaptopCode,
        title: "Frontend Development",
        duration: "12 Weeks",
        level: "Beginner",
        mode: "Online",
        seats: 100,
        fee: "Scholarship Based",
        skills: ["HTML", "CSS", "JavaScript", "React"],
        highlights: [
          "Responsive UI building",
          "Component-based development",
          "Real project assignments",
          "Certificate on completion",
        ],
        shortDescription:
          "Learn UI development, responsive design and React applications.",
        description:
          "Learn modern UI development, responsive design and React applications with real project work and mentor support.",
      },
      {
        id: 2,
        slug: "backend-development",
        icon: FaCode,
        title: "Backend Development",
        duration: "12 Weeks",
        level: "Intermediate",
        mode: "Online",
        seats: 75,
        fee: "Scholarship Based",
        skills: ["Node.js", "Express", "MongoDB", "REST API"],
        highlights: [
          "API development",
          "Database design",
          "Authentication flow",
          "Production backend patterns",
        ],
        shortDescription:
          "Build scalable APIs, databases and server-side systems.",
        description:
          "Build scalable APIs, databases and enterprise backend systems using Node.js, Express and MongoDB.",
      },
      {
        id: 3,
        slug: "full-stack-development",
        icon: FaProjectDiagram,
        title: "Full Stack Development",
        duration: "12 Weeks",
        level: "Intermediate",
        mode: "Online",
        seats: 120,
        fee: "Scholarship Based",
        skills: ["React", "Node.js", "MongoDB", "Tailwind CSS"],
        highlights: [
          "Frontend + backend integration",
          "Real world application flow",
          "Deployment readiness",
          "Portfolio project support",
        ],
        shortDescription:
          "Complete frontend and backend training with project-based learning.",
        description:
          "Work on complete frontend and backend real-world applications with industry style architecture and deployment workflow.",
      },
      {
        id: 4,
        slug: "artificial-intelligence",
        icon: FaRobot,
        title: "Artificial Intelligence",
        duration: "12 Weeks",
        level: "Advanced",
        mode: "Online",
        seats: 50,
        fee: "Scholarship Based",
        skills: ["Python", "Machine Learning", "AI", "Deep Learning"],
        highlights: [
          "AI fundamentals",
          "Model training concepts",
          "Automation use cases",
          "Industry aligned AI exposure",
        ],
        shortDescription:
          "Explore AI systems, machine learning and automation.",
        description:
          "Explore AI systems, machine learning models and intelligent automation for practical modern use cases.",
      },
      {
        id: 5,
        slug: "data-science",
        icon: FaBrain,
        title: "Data Science",
        duration: "12 Weeks",
        level: "Intermediate",
        mode: "Online",
        seats: 60,
        fee: "Scholarship Based",
        skills: ["Python", "Pandas", "NumPy", "Data Analytics"],
        highlights: [
          "Data analysis basics",
          "Visualization workflows",
          "Business insights",
          "Analytical problem solving",
        ],
        shortDescription:
          "Work with data analysis, dashboards and problem solving.",
        description:
          "Analyze data and create practical data-driven solutions using modern libraries and real datasets.",
      },
      {
        id: 6,
        slug: "cyber-security",
        icon: FaShieldAlt,
        title: "Cyber Security",
        duration: "12 Weeks",
        level: "Intermediate",
        mode: "Online",
        seats: 80,
        fee: "Scholarship Based",
        skills: ["Linux", "Networking", "OWASP", "Security"],
        highlights: [
          "Ethical hacking basics",
          "Security testing principles",
          "Web app security",
          "Defense and awareness",
        ],
        shortDescription:
          "Learn security basics, ethical hacking and web app protection.",
        description:
          "Understand ethical hacking, cyber defense and security testing through practical and guided learning.",
      },
    ],
    []
  );

  const filteredInternships = useMemo(() => {
    return internships.filter((item) => {
      const matchesSearch = item.title
        .toLowerCase()
        .includes(searchTerm.toLowerCase().trim());
      const matchesLevel =
        selectedLevel === "All" ? true : item.level === selectedLevel;
      return matchesSearch && matchesLevel;
    });
  }, [internships, searchTerm, selectedLevel]);

  const handleApply = (program) => {
    const token = getToken();

    if (!token) {
      toast.error("Please login to apply for CyberNet internships.");
      navigate("/login?role=student");
      return;
    }

    navigate("/student/apply-internship", {
      state: {
        programSlug: program.slug,
        programTitle: program.title,
      },
    });
  };

  const openDetails = (program) => setSelectedProgram(program);
  const closeDetails = () => setSelectedProgram(null);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-cyan-50" />
        <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="absolute right-0 top-32 h-72 w-72 rounded-full bg-cyan-200/30 blur-3xl" />

        <div className="relative w-full px-4 py-12 sm:px-6 lg:px-8 xl:px-10 2xl:px-16">
          <div className="grid min-h-[420px] items-center gap-10 xl:grid-cols-[1.15fr_0.85fr]">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-3xl"
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                <FaBuilding />
                Internship programs provided by CyberNet Technology Systems
              </div>

              <h1 className="mt-6 max-w-2xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Internship Programs
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                Simple, clean and professional internship tracks with real projects,
                mentor support, assessments and verified certificates.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={() =>
                    document.getElementById("internship-programs")?.scrollIntoView({
                      behavior: "smooth",
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
                >
                  Explore Programs
                  <FaArrowRight />
                </button>

                <button
                  onClick={() => navigate("/contact")}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Contact Support
                </button>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">
                  <FaStar className="text-amber-400" />
                  Login required to apply
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">
                  <FaCertificate className="text-cyan-600" />
                  Verified certificate
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    Program Highlights
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Simple internship learning flow
                  </p>
                </div>
                <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
              </div>

              <div className="mt-6 space-y-3">
                {[
                  "Industry focused curriculum",
                  "Real world projects",
                  "Weekly mentor sessions",
                  "Skill assessments",
                  "Project based learning",
                  "Verified certificates",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                  >
                    <FaCheckCircle className="text-green-500" />
                    <span className="text-sm font-medium text-slate-700">
                      {item}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Internship provider
                </p>
                <p className="mt-1 font-bold text-slate-900">
                  CyberNet Technology Systems
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  All programs on this page are provided by CyberNet Technology Systems.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-14 sm:py-16">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-16">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard value="6" label="Internship Tracks" icon={FaGraduationCap} />
            <StatCard value="12 Weeks" label="Per Program" icon={FaClock} />
            <StatCard value="Login" label="Required To Apply" icon={FaLock} />
            <StatCard value="100%" label="Certificate Verification" icon={FaCertificate} />
          </div>
        </div>
      </section>

      <section className="bg-white py-10">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-16">
          <SectionTitle
            eyebrow="PROVIDER"
            title="CyberNet Technology Systems"
            subtitle="All internship programs listed here are provided by CyberNet Technology Systems with project-based learning, mentor support and verified completion certificates."
          />
        </div>
      </section>

      <section className="bg-white py-10">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-16">
          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
              <div className="relative">
                <FaSearch className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search internship programs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-14 outline-none transition focus:border-blue-500"
                />
              </div>

              <div className="relative">
                <FaFilter className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="h-14 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-14 outline-none transition focus:border-blue-500"
                >
                  <option value="All">All Levels</option>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
              <span>
                Showing{" "}
                <span className="font-bold text-slate-800">
                  {filteredInternships.length}
                </span>{" "}
                programs
              </span>
              <span className="inline-flex items-center gap-2">
                <FaLock className="text-amber-500" />
                Application requires login
              </span>
            </div>
          </div>
        </div>
      </section>

      <section id="internship-programs" className="bg-white pb-20 pt-4">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-16">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                <FaGraduationCap />
                Internship Programs
              </span>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                Choose Your Track
              </h2>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              View publicly — apply after login
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3">
            {filteredInternships.map((item) => (
              <ProgramCard
                key={item.id}
                program={item}
                onViewDetails={openDetails}
                onApply={handleApply}
                isLoggedIn={isLoggedIn}
              />
            ))}
          </div>

          {filteredInternships.length === 0 && (
            <div className="mt-12 rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <FaSearch className="mx-auto text-4xl text-slate-400" />
              <h3 className="mt-4 text-2xl font-black text-slate-900">
                No programs found
              </h3>
              <p className="mt-3 text-slate-600">
                Try changing your search or filter to explore more internships.
              </p>
            </div>
          )}
        </div>
      </section>

      {!isLoggedIn && (
        <section className="bg-slate-950 py-14 text-white">
          <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-16">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-2xl font-black">
                    Login Required For Application
                  </h3>
                  <p className="mt-3 max-w-3xl text-slate-300">
                    You can view the internship programs publicly, but applying,
                    dashboard access, tasks, AI mentor, certificates and assessment
                    features require a logged-in student account.
                  </p>
                </div>

                <button
                  onClick={() => navigate("/login?role=student")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-4 font-black text-white shadow-lg transition hover:scale-[1.03]"
                >
                  <FaLock />
                  Login Now
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <AnimatePresence>
        {selectedProgram && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-[2px]"
            onClick={closeDetails}
          >
            <motion.div
              initial={{ scale: 0.96, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 16 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-[28px] bg-white p-5 shadow-2xl sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                    Detailed Program View
                  </span>
                  <h3 className="mt-3 text-2xl font-black text-slate-900 sm:text-3xl">
                    {selectedProgram.title}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                    {selectedProgram.description}
                  </p>
                </div>

                <button
                  onClick={closeDetails}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  Internship Provider
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  CyberNet Technology Systems
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <CompactInfo title="Duration" value={selectedProgram.duration} />
                <CompactInfo title="Level" value={selectedProgram.level} />
                <CompactInfo title="Seats" value={selectedProgram.seats} />
                <CompactInfo title="Mode" value={selectedProgram.mode} />
                <CompactInfo title="Fee" value={selectedProgram.fee} />
                <CompactInfo title="Support" value="Mentor Guided" />
              </div>

              <div className="mt-5">
                <h4 className="font-black text-slate-900">Skills Covered</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedProgram.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <h4 className="font-black text-slate-900">Program Highlights</h4>
                <div className="mt-3 space-y-2">
                  {selectedProgram.highlights.map((point) => (
                    <div
                      key={point}
                      className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    >
                      <FaCheckCircle className="text-green-500" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    const token = getToken();

                    if (!token) {
                      toast.error("Please login to apply for CyberNet internships.");
                      navigate("/login?role=student");
                      return;
                    }

                    navigate("/student/apply-internship", {
                      state: {
                        programSlug: selectedProgram.slug,
                        programTitle: selectedProgram.title,
                      },
                    });
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-lg"
                >
                  {isLoggedIn ? "Apply Now" : "Login to Apply"}
                  {!isLoggedIn ? <FaLock /> : <FaArrowRight />}
                </button>

                <button
                  onClick={() => navigate("/contact")}
                  className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Ask for Help
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}