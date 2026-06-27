import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FaArrowRight,
  FaBrain,
  FaBolt,
  FaCertificate,
  FaCheckCircle,
  FaChartLine,
  FaCloud,
  FaCode,
  FaCommentDots,
  FaGraduationCap,
  FaHandshake,
  FaLaptopCode,
  FaLayerGroup,
  FaProjectDiagram,
  FaRocket,
  FaServer,
  FaShieldAlt,
  FaStar,
  FaUserShield,
  FaUsers,
  FaRobot,
  FaDatabase,
  FaClipboardCheck,
  FaGlobe,
  FaCogs,
} from "react-icons/fa";

function SectionTitle({ eyebrow, title, subtitle, centered = true }) {
  return (
    <div className={centered ? "text-center" : ""}>
      <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 shadow-sm">
        {eyebrow}
      </span>

      <h2 className="mt-6 text-4xl font-black tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
        {title}
      </h2>

      <p
        className={`mt-5 text-base leading-8 text-slate-600 md:text-lg ${
          centered ? "mx-auto max-w-3xl" : "max-w-2xl"
        }`}
      >
        {subtitle}
      </p>
    </div>
  );
}

function StatCard({ value, label, icon: Icon, accent = "blue" }) {
  const accentMap = {
    blue: "from-blue-50 to-blue-100 text-blue-700",
    cyan: "from-cyan-50 to-cyan-100 text-cyan-700",
    emerald: "from-emerald-50 to-emerald-100 text-emerald-700",
    purple: "from-purple-50 to-purple-100 text-purple-700",
    amber: "from-amber-50 to-amber-100 text-amber-700",
  };

  return (
    <motion.div
      whileHover={{ y: -6 }}
      className={`rounded-3xl border border-slate-100 bg-gradient-to-br ${accentMap[accent]} p-6 shadow-lg`}
    >
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
        <Icon className="text-xl" />
      </div>

      <div className="text-4xl font-black text-slate-900">{value}</div>
      <div className="mt-2 text-sm font-medium text-slate-600">{label}</div>
    </motion.div>
  );
}

function FeatureCard({ icon: Icon, title, desc }) {
  return (
    <motion.div
      whileHover={{ y: -8 }}
      className="rounded-[28px] border border-slate-100 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
    >
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 text-2xl text-blue-600">
        <Icon />
      </div>

      <h3 className="text-2xl font-black text-slate-900">{title}</h3>
      <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">{desc}</p>
    </motion.div>
  );
}

function ServiceCard({ icon: Icon, title, desc, points = [] }) {
  return (
    <motion.div
      whileHover={{ y: -8 }}
      className="rounded-[30px] bg-white p-8 shadow-lg ring-1 ring-slate-100"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-2xl bg-blue-50 p-4 text-3xl text-blue-600">
          <Icon />
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          Production
        </span>
      </div>

      <h3 className="mt-6 text-2xl font-black text-slate-900">{title}</h3>
      <p className="mt-4 leading-7 text-slate-600">{desc}</p>

      {points.length > 0 && (
        <div className="mt-6 space-y-3">
          {points.map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 text-sm text-slate-600"
            >
              <FaCheckCircle className="text-emerald-500" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function TimelineCard({ step, title, desc, icon: Icon }) {
  return (
    <motion.div
      whileHover={{ y: -8 }}
      className="rounded-[28px] border border-slate-100 bg-white p-8 shadow-lg"
    >
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 font-black text-white">
        {step}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <Icon className="text-2xl text-blue-600" />
        <h3 className="text-2xl font-black text-slate-900">{title}</h3>
      </div>
      <p className="mt-4 leading-7 text-slate-600">{desc}</p>
    </motion.div>
  );
}

function Home() {
  const navigate = useNavigate();

  const stats = useMemo(
    () => [
      { value: "500+", label: "Students Trained", icon: FaUsers, accent: "blue" },
      { value: "100+", label: "Projects Delivered", icon: FaHandshake, accent: "cyan" },
      { value: "50+", label: "Internship Programs", icon: FaCertificate, accent: "emerald" },
      { value: "24/7", label: "Platform Support", icon: FaBolt, accent: "purple" },
    ],
    []
  );

  const companyPillars = useMemo(
    () => [
      {
        icon: FaLaptopCode,
        title: "Software Development",
        desc: "Modern web apps, portals, dashboards, admin systems and business software with clean, scalable architecture.",
      },
      {
        icon: FaBrain,
        title: "AI Automation",
        desc: "Smart workflows, AI mentor, resume guidance, learning support and productivity tools for students and teams.",
      },
      {
        icon: FaShieldAlt,
        title: "Cyber Security",
        desc: "Security-focused training, ethical practices, safe development concepts and practical protection awareness.",
      },
      {
        icon: FaCloud,
        title: "Cloud Solutions",
        desc: "Deployment support, scalable hosting, server planning and cloud-ready application delivery.",
      },
      {
        icon: FaRobot,
        title: "AI Learning Platform",
        desc: "Doubt solving, guided lessons, progress tracking and personalized support for internship success.",
      },
      {
        icon: FaCertificate,
        title: "Certificate Verification",
        desc: "Secure certificate generation and public verification for internship completion and achievement tracking.",
      },
    ],
    []
  );

  const services = useMemo(
    () => [
      {
        icon: FaCode,
        title: "Custom Web Development",
        desc: "Responsive websites, business portals, dashboards and client-ready web applications.",
        points: ["React UI", "API Integration", "Production Deployments"],
      },
      {
        icon: FaCogs,
        title: "Internal Business Systems",
        desc: "Management tools, CRM-style systems, student portals and workflow automation for organizations.",
        points: ["Admin Panels", "Reporting", "Role-based Access"],
      },
      {
        icon: FaProjectDiagram,
        title: "Project-Based Learning",
        desc: "Students learn through real features, real tasks and real software projects instead of only theory.",
        points: ["Hands-on Tasks", "Portfolio Work", "Mentorship"],
      },
      {
        icon: FaServer,
        title: "Backend & APIs",
        desc: "Secure server-side development, authentication, routes, data handling and scalable integrations.",
        points: ["Node/Express", "MongoDB", "JWT Auth"],
      },
      {
        icon: FaDatabase,
        title: "Data & Analytics",
        desc: "Tracking for performance, certificates, payments, internships and learning progress.",
        points: ["Dashboards", "Insights", "Live Metrics"],
      },
      {
        icon: FaGlobe,
        title: "Platform Hosting",
        desc: "Ready for production deployment with clean performance and reliable online access.",
        points: ["Fast Load", "Secure Setup", "Scalable Structure"],
      },
    ],
    []
  );

  const programs = useMemo(
    () => [
      {
        title: "Full Stack Development",
        desc: "Build complete applications from frontend to backend with real projects and guided mentorship.",
        bullets: ["React UI", "Node/Express API", "MongoDB Database"],
        icon: FaCode,
      },
      {
        title: "Java Development",
        desc: "Learn object-oriented programming, backend logic and structured problem solving.",
        bullets: ["Core Java", "OOPs", "Project Work"],
        icon: FaLayerGroup,
      },
      {
        title: "Python & AI",
        desc: "Develop Python skills, automation workflows and AI concepts for modern careers.",
        bullets: ["Python Basics", "Automation", "AI Projects"],
        icon: FaBrain,
      },
      {
        title: "Cyber Security",
        desc: "Understand security fundamentals, threat awareness and safe development concepts.",
        bullets: ["Security Basics", "Ethical Practices", "Hands-on Learning"],
        icon: FaShieldAlt,
      },
      {
        title: "Cloud & DevOps",
        desc: "Explore deployment, servers, CI/CD mindset and scalable infrastructure concepts.",
        bullets: ["Cloud Basics", "Server Setup", "Deployment Workflow"],
        icon: FaCloud,
      },
      {
        title: "Data & Analytics",
        desc: "Learn data handling, reporting, analysis and insights for real-world decisions.",
        bullets: ["Data Skills", "Reports", "Business Insights"],
        icon: FaChartLine,
      },
    ],
    []
  );

  const roadmap = useMemo(
    () => [
      {
        step: "01",
        title: "Register",
        desc: "Create your student account and choose your internship track.",
        icon: FaUserShield,
      },
      {
        step: "02",
        title: "Learn",
        desc: "Complete lessons, assessments and guided learning tasks.",
        icon: FaGraduationCap,
      },
      {
        step: "03",
        title: "Build",
        desc: "Work on real software projects and portfolio-worthy assignments.",
        icon: FaProjectDiagram,
      },
      {
        step: "04",
        title: "Verify",
        desc: "Generate and verify certificates after successful completion.",
        icon: FaClipboardCheck,
      },
    ],
    []
  );

  const dashboardFeatures = useMemo(
    () => [
      "Daily Tasks",
      "Internship Progress",
      "Assessment Tracking",
      "Leaderboard Ranking",
      "AI Mentor Support",
      "Certificate Vault",
    ],
    []
  );

  const aiSolutions = useMemo(
    () => [
      {
        icon: FaBrain,
        title: "AI Resume Analyzer",
        desc: "Analyze resumes instantly and get smart improvement suggestions.",
      },
      {
        icon: FaRobot,
        title: "AI Career Guidance",
        desc: "Receive personalized career advice based on your skills and goals.",
      },
      {
        icon: FaCommentDots,
        title: "AI Doubt Support",
        desc: "Ask questions and get quick learning support during your internship journey.",
      },
    ],
    []
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-900">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-cyan-50" />
        <div className="absolute left-0 top-0 h-[500px] w-[500px] rounded-full bg-blue-400/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[600px] w-[600px] rounded-full bg-cyan-400/20 blur-3xl" />

        <div className="relative mx-auto max-w-[1800px] px-6 py-16 sm:px-8 lg:px-16 lg:py-24">
          <div className="grid items-center gap-16 lg:min-h-[calc(100vh-120px)] lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-3 rounded-full border border-blue-100 bg-white px-5 py-3 shadow-xl">
                <FaCheckCircle className="text-green-500" />
                <span className="font-semibold text-slate-700">
                  AI Powered Technology Company
                </span>
              </div>

              <h1 className="mt-8 max-w-3xl text-5xl font-black leading-tight tracking-tight sm:text-6xl lg:text-8xl">
                Building
                <span className="block bg-gradient-to-r from-blue-600 via-cyan-500 to-purple-600 bg-clip-text text-transparent">
                  Next Generation
                </span>
                Technology Leaders
              </h1>

              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                CyberNet Technology Systems is a learning and internship company that provides
                software development, AI automation, certificate verification, cybersecurity,
                cloud solutions and real project-based training for students.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <button
                  onClick={() => navigate("/register")}
                  className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-purple-600 px-7 py-4 font-bold text-white shadow-xl transition hover:scale-[1.03]"
                >
                  Start Career
                  <FaArrowRight />
                </button>

                <button
                  onClick={() => navigate("/internships")}
                  className="inline-flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-7 py-4 font-bold text-slate-800 shadow-md transition hover:border-blue-400 hover:bg-slate-50"
                >
                  Explore Internships
                </button>

                <button
                  onClick={() => navigate("/certificates")}
                  className="inline-flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-7 py-4 font-bold text-slate-800 shadow-md transition hover:border-cyan-400 hover:bg-slate-50"
                >
                  Verify Certificate
                </button>

                <button
                  onClick={() => navigate("/login?role=student")}
                  className="inline-flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-7 py-4 font-bold text-slate-800 shadow-md transition hover:border-purple-400 hover:bg-slate-50"
                >
                  Student Login
                </button>
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200">
                  <FaStar className="text-amber-400" />
                  Internship provider
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200">
                  <FaStar className="text-amber-400" />
                  Software development company
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200">
                  <FaStar className="text-amber-400" />
                  AI-powered learning platform
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.9 }}
              className="relative"
            >
              <div className="rounded-[38px] border border-slate-100 bg-white p-6 shadow-[0_30px_100px_rgba(15,23,42,0.10)] sm:p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                      CyberNet Company Dashboard
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 sm:text-base">
                      Internship, software and learning platform
                    </p>
                  </div>

                  <div className="h-4 w-4 rounded-full bg-green-500 shadow-[0_0_0_8px_rgba(34,197,94,0.12)] animate-pulse" />
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl bg-blue-50 p-5 sm:p-6">
                    <FaUsers className="mb-4 text-3xl text-blue-600" />
                    <h4 className="text-3xl font-black">500+</h4>
                    <p className="text-sm text-slate-600">Students</p>
                  </div>

                  <div className="rounded-3xl bg-cyan-50 p-5 sm:p-6">
                    <FaHandshake className="mb-4 text-3xl text-cyan-600" />
                    <h4 className="text-3xl font-black">100+</h4>
                    <p className="text-sm text-slate-600">Projects</p>
                  </div>

                  <div className="rounded-3xl bg-emerald-50 p-5 sm:p-6">
                    <FaCertificate className="mb-4 text-3xl text-emerald-600" />
                    <h4 className="text-3xl font-black">50+</h4>
                    <p className="text-sm text-slate-600">Internships</p>
                  </div>

                  <div className="rounded-3xl bg-purple-50 p-5 sm:p-6">
                    <FaCheckCircle className="mb-4 text-3xl text-purple-600" />
                    <h4 className="text-3xl font-black">24/7</h4>
                    <p className="text-sm text-slate-600">Support</p>
                  </div>
                </div>

                <div className="mt-6 rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-500 p-[1px]">
                  <div className="rounded-[22px] bg-white px-5 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <FaRocket className="text-blue-600" />
                      <div>
                        <p className="font-bold text-slate-900">Built for students</p>
                        <p className="text-sm text-slate-500">
                          Assessments, tasks, AI mentor, certificates and leaderboard in one place.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ repeat: Infinity, duration: 4 }}
                className="absolute -left-3 top-8 rounded-3xl bg-white px-5 py-4 shadow-xl"
              >
                <div className="flex items-center gap-3">
                  <FaBrain className="text-2xl text-blue-600" />
                  <div>
                    <h4 className="font-bold text-slate-900">AI Automation</h4>
                    <p className="text-sm text-slate-500">Smart Systems</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 14, 0] }}
                transition={{ repeat: Infinity, duration: 5 }}
                className="absolute -right-3 top-28 rounded-3xl bg-white px-5 py-4 shadow-xl"
              >
                <div className="flex items-center gap-3">
                  <FaCloud className="text-2xl text-cyan-600" />
                  <div>
                    <h4 className="font-bold text-slate-900">Cloud Platform</h4>
                    <p className="text-sm text-slate-500">Scalable Infrastructure</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 6 }}
                className="absolute -bottom-4 left-6 rounded-3xl bg-white px-5 py-4 shadow-xl"
              >
                <div className="flex items-center gap-3">
                  <FaShieldAlt className="text-2xl text-emerald-600" />
                  <div>
                    <h4 className="font-bold text-slate-900">Cyber Security</h4>
                    <p className="text-sm text-slate-500">Enterprise Protection</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="bg-white py-10 sm:py-14">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-6 sm:px-8 lg:grid-cols-4 lg:px-16">
          {stats.map((item) => (
            <StatCard key={item.label} {...item} />
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-24 sm:py-28">
        <div className="mx-auto max-w-[1800px] px-6 sm:px-8 lg:px-16">
          <SectionTitle
            eyebrow="ABOUT CYBERNET"
            title="What We Do"
            subtitle="CyberNet Technology Systems is a learning and internship company helping students gain software development skills, AI exposure, and industry-ready project experience."
          />

          <div className="mt-16 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {companyPillars.map((feature) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                desc={feature.desc}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-24 sm:py-28">
        <div className="mx-auto max-w-[1800px] px-6 sm:px-8 lg:px-16">
          <SectionTitle
            eyebrow="SERVICES"
            title="Services We Provide"
            subtitle="From software development to AI automation, internships and verification systems — everything is designed to be practical and production-ready."
          />

          <div className="mt-16 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {services.map((feature) => (
              <ServiceCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                desc={feature.desc}
                points={feature.points}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-24 sm:py-28">
        <div className="mx-auto max-w-[1800px] px-6 sm:px-8 lg:px-16">
          <SectionTitle
            eyebrow="INTERNSHIP PROGRAMS"
            title="Launch Your Career"
            subtitle="Industry-focused internship tracks with project work, mentorship, assessments and verified certificates."
          />

          <div className="mt-16 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {programs.map((program) => (
              <motion.div
                key={program.title}
                whileHover={{ y: -8 }}
                className="rounded-[30px] bg-white p-8 shadow-lg ring-1 ring-slate-100"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="rounded-2xl bg-blue-50 p-4 text-3xl text-blue-600">
                    <program.icon />
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    Internship Track
                  </span>
                </div>

                <h3 className="mt-6 text-2xl font-black text-slate-900">
                  {program.title}
                </h3>
                <p className="mt-4 leading-7 text-slate-600">{program.desc}</p>

                <div className="mt-6 space-y-3">
                  {program.bullets.map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 text-sm text-slate-600"
                    >
                      <FaCheckCircle className="text-emerald-500" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => navigate("/register")}
                  className="mt-7 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white shadow-lg transition hover:bg-blue-700"
                >
                  Apply Now
                  <FaArrowRight />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-24 sm:py-28">
        <div className="mx-auto max-w-[1800px] px-6 sm:px-8 lg:px-16">
          <SectionTitle
            eyebrow="HOW IT WORKS"
            title="Simple Internship Roadmap"
            subtitle="A clear path from registration to certificate verification and career readiness."
          />

          <div className="mt-16 grid gap-6 lg:grid-cols-4">
            {roadmap.map((item) => (
              <TimelineCard
                key={item.step}
                step={item.step}
                title={item.title}
                desc={item.desc}
                icon={item.icon}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-24 sm:py-28">
        <div className="mx-auto max-w-[1800px] px-6 sm:px-8 lg:px-16">
          <SectionTitle
            eyebrow="AI SERVICES"
            title="AI Powered Automation"
            subtitle="Advanced artificial intelligence solutions designed to improve productivity, reduce manual work and provide smart guidance to students."
          />

          <div className="mt-16 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {aiSolutions.map((item) => (
              <motion.div
                key={item.title}
                whileHover={{ y: -8 }}
                className="rounded-[30px] border border-slate-100 bg-slate-50 p-8 shadow-lg"
              >
                <div className="mb-6 text-4xl text-blue-600">
                  <item.icon />
                </div>

                <h3 className="text-2xl font-black text-slate-900">
                  {item.title}
                </h3>

                <p className="mt-4 text-slate-600 leading-7">{item.desc}</p>

                <button
                  onClick={() => navigate("/register")}
                  className="mt-6 inline-flex items-center gap-2 font-bold text-blue-600 transition hover:gap-3"
                >
                  Start Now
                  <FaArrowRight />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-24 sm:py-28">
        <div className="mx-auto max-w-[1800px] px-6 sm:px-8 lg:px-16">
          <SectionTitle
            eyebrow="STUDENT PORTAL"
            title="Dashboard Features"
            subtitle="Everything a student needs: tasks, progress, AI mentor, leaderboard, certificates and performance tracking."
          />

          <div className="mt-16 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {dashboardFeatures.map((feature) => (
              <motion.div
                key={feature}
                whileHover={{ y: -8 }}
                className="rounded-[28px] bg-slate-50 p-8 shadow-lg ring-1 ring-slate-100"
              >
                <FaCheckCircle className="text-4xl text-emerald-500" />
                <h3 className="mt-5 text-2xl font-bold text-slate-900">
                  {feature}
                </h3>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 py-24 text-white sm:py-28">
        <div className="mx-auto max-w-5xl px-6 text-center sm:px-8">
          <h2 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-7xl">
            Ready To Start?
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
            Join CyberNet Technology Systems and explore internships, AI services and professional
            technology solutions built for real student success.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <button
              onClick={() => navigate("/contact")}
              className="rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-8 py-4 font-bold text-white shadow-xl transition hover:scale-[1.03]"
            >
              Contact Us
            </button>

            <button
              onClick={() => navigate("/register")}
              className="rounded-2xl border border-white/20 px-8 py-4 font-bold text-white transition hover:bg-white/10"
            >
              Create Account
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;