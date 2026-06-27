import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FaArrowRight,
  FaBrain,
  FaCode,
  FaShieldAlt,
  FaCloud,
  FaUsers,
  FaAward,
  FaHandshake,
  FaCertificate,
  FaStar,
  FaUserTie,
  FaLightbulb,
  FaProjectDiagram,
  FaClock,
  FaCheckCircle,
  FaLaptopCode,
  FaRocket,
  FaBuilding,
} from "react-icons/fa";

import ceoImage from "../../assets/ceo.jpeg";

function SectionTitle({ eyebrow, title, subtitle }) {
  return (
    <div className="text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 shadow-sm">
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
      whileHover={{ y: -6 }}
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

function ServiceCard({ icon: Icon, title, desc }) {
  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ duration: 0.2 }}
      className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm"
    >
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-600">
        <Icon />
      </div>
      <h3 className="text-2xl font-black text-slate-900">{title}</h3>
      <p className="mt-4 leading-8 text-slate-600">{desc}</p>
    </motion.div>
  );
}

function ValueCard({ icon: Icon, title, desc }) {
  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ duration: 0.2 }}
      className="rounded-[28px] border border-slate-200 bg-slate-50 p-7 shadow-sm"
    >
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl text-blue-600 shadow-sm">
        <Icon />
      </div>
      <h3 className="text-2xl font-black text-slate-900">{title}</h3>
      <p className="mt-4 leading-7 text-slate-600">{desc}</p>
    </motion.div>
  );
}

function FeatureChip({ icon: Icon, label }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
      <Icon className="text-blue-500" />
      {label}
    </span>
  );
}

export default function About() {
  const stats = useMemo(
    () => [
      { value: "500+", label: "Students Trained", icon: FaUsers },
      { value: "100+", label: "Projects Delivered", icon: FaHandshake },
      { value: "50+", label: "Internship Programs", icon: FaAward },
      { value: "24/7", label: "Support & Guidance", icon: FaClock },
    ],
    []
  );

  const services = useMemo(
    () => [
      {
        icon: FaBrain,
        title: "AI Automation",
        desc: "Smart workflows, resume analysis, career guidance and productivity systems built for real use.",
      },
      {
        icon: FaCode,
        title: "Software Development",
        desc: "Frontend, backend, full stack and Java-based solutions with modern engineering practices.",
      },
      {
        icon: FaShieldAlt,
        title: "Cyber Security",
        desc: "Practical security-focused learning, enterprise protection ideas and hands-on implementation support.",
      },
      {
        icon: FaCloud,
        title: "Cloud Solutions",
        desc: "Scalable deployment, infrastructure planning and cloud-ready application architecture.",
      },
    ],
    []
  );

  const values = useMemo(
    () => [
      {
        icon: FaLightbulb,
        title: "Innovation",
        desc: "We build with new ideas, practical execution and modern technology first.",
      },
      {
        icon: FaUserTie,
        title: "Leadership",
        desc: "We prepare students to grow into confident professionals and future leaders.",
      },
      {
        icon: FaProjectDiagram,
        title: "Real Projects",
        desc: "Learning is connected with real products, internship tasks and outcomes.",
      },
      {
        icon: FaStar,
        title: "Quality",
        desc: "Every workflow is designed to feel premium, trustworthy and production-ready.",
      },
    ],
    []
  );

  return (
    <div className="min-h-screen overflow-hidden bg-white text-slate-900">
      {/* HERO */}
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-cyan-50" />
        <div className="absolute left-0 top-0 h-[360px] w-[360px] rounded-full bg-blue-200/40 blur-3xl" />
        <div className="absolute right-0 top-24 h-[360px] w-[360px] rounded-full bg-cyan-200/30 blur-3xl" />

        <div className="relative w-full px-4 py-12 sm:px-6 lg:px-8 xl:px-10 2xl:px-16 sm:py-16 lg:py-20">
          <div className="grid items-center gap-12 xl:grid-cols-[1.08fr_0.92fr]">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
              className="max-w-3xl"
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                <FaBuilding />
                CyberNet Technology Systems
              </div>

              <h1 className="mt-6 max-w-2xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Building AI Powered
                <span className="block text-blue-600">Technology Solutions</span>
                For The Future
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                CyberNet Technology Systems is an AI-powered technology company focused on
                software development, internship programs, cybersecurity, cloud solutions
                and practical learning experiences for students, startups and businesses.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <FeatureChip icon={FaBrain} label="AI Powered Learning" />
                <FeatureChip icon={FaCertificate} label="Verified Certificates" />
                <FeatureChip icon={FaProjectDiagram} label="Real Projects" />
                <FeatureChip icon={FaLaptopCode} label="Premium Dashboard" />
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  to="/internships"
                  className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-7 py-4 font-bold text-white shadow-lg transition hover:scale-[1.02]"
                >
                  Explore Internships
                  <FaArrowRight />
                </Link>

                <Link
                  to="/contact"
                  className="rounded-2xl border border-slate-300 px-7 py-4 font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Contact Us
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
              className="relative"
            >
              <div className="rounded-[34px] border border-blue-100 bg-white p-5 shadow-sm sm:p-7">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 sm:text-3xl">
                      CyberNet Overview
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      AI, software, internships and verification
                    </p>
                  </div>
                  <div className="h-4 w-4 rounded-full bg-green-500 shadow-[0_0_0_8px_rgba(34,197,94,0.12)] animate-pulse" />
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl bg-blue-50 p-5 sm:p-6">
                    <FaBrain className="mb-4 text-4xl text-blue-600" />
                    <h4 className="text-3xl font-black text-slate-900">AI</h4>
                    <p className="text-slate-600">Automation Solutions</p>
                  </div>

                  <div className="rounded-3xl bg-cyan-50 p-5 sm:p-6">
                    <FaCode className="mb-4 text-4xl text-cyan-600" />
                    <h4 className="text-3xl font-black text-slate-900">Dev</h4>
                    <p className="text-slate-600">Software Engineering</p>
                  </div>

                  <div className="rounded-3xl bg-emerald-50 p-5 sm:p-6">
                    <FaShieldAlt className="mb-4 text-4xl text-emerald-600" />
                    <h4 className="text-3xl font-black text-slate-900">Secure</h4>
                    <p className="text-slate-600">Cyber Security</p>
                  </div>

                  <div className="rounded-3xl bg-purple-50 p-5 sm:p-6">
                    <FaRocket className="mb-4 text-4xl text-purple-600" />
                    <h4 className="text-3xl font-black text-slate-900">Growth</h4>
                    <p className="text-slate-600">Career Programs</p>
                  </div>
                </div>

                <div className="mt-6 rounded-[28px] border border-blue-100 bg-slate-50 p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <FaLaptopCode className="text-blue-600" />
                    <div>
                      <h4 className="font-bold text-slate-900">Built for students</h4>
                      <p className="text-sm text-slate-600">
                        Dashboard, mentor support, certificates and leaderboard in one place.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ repeat: Infinity, duration: 4 }}
                className="absolute -left-2 top-8 rounded-3xl bg-white px-5 py-4 shadow-xl"
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
                className="absolute -right-2 top-28 rounded-3xl bg-white px-5 py-4 shadow-xl"
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

      {/* COMPANY OVERVIEW */}
      <section className="bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-[1800px] px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-16">
          <SectionTitle
            eyebrow="WHO WE ARE"
            title="Building Future Through Technology"
            subtitle="CyberNet Technology Systems is focused on artificial intelligence, software development, internship programs, cloud technologies and cyber security solutions. We help students and organizations gain practical skills, real-world experience and modern technology exposure."
          />

          <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((item) => (
              <StatCard
                key={item.label}
                value={item.value}
                label={item.label}
                icon={item.icon}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CEO SECTION */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-[1800px] px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-16">
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="flex justify-center"
            >
              <div className="relative">
                <div className="absolute -inset-6 rounded-[40px] bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-400 blur-2xl opacity-25" />
                <div className="relative rounded-[40px] bg-white p-4 shadow-2xl">
                  <img
                    src={ceoImage}
                    alt="CEO of CyberNet Technology Systems"
                    className="h-[500px] w-full max-w-[430px] rounded-[30px] object-cover"
                  />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-5 py-2 font-bold text-blue-700">
                FOUNDER & CEO
              </span>

              <h2 className="mt-6 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Ashish Bansod
              </h2>

              <h3 className="mt-3 text-xl font-bold text-blue-600 sm:text-2xl">
                Founder & Chief Executive Officer
              </h3>

              <p className="mt-8 text-base leading-8 text-slate-600 sm:text-lg sm:leading-9">
                CyberNet Technology Systems was founded with a vision to create practical
                technology solutions and career opportunities for students, startups and
                businesses. We believe that real learning happens when students work on
                real products, real tasks and real outcomes.
              </p>

              <p className="mt-6 text-base leading-8 text-slate-600 sm:text-lg sm:leading-9">
                Our platform combines AI, software engineering, cyber security, cloud
                systems and internship programs to help learners build confidence,
                portfolios and career-ready skills.
              </p>

              <div className="mt-10 grid gap-5 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                  <h4 className="text-4xl font-black text-blue-600">100+</h4>
                  <p className="mt-2 text-slate-600">Projects</p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                  <h4 className="text-4xl font-black text-cyan-600">500+</h4>
                  <p className="mt-2 text-slate-600">Students</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* MISSION VISION */}
      <section className="bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-[1800px] px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-16">
          <SectionTitle
            eyebrow="OUR PURPOSE"
            title="Mission & Vision"
            subtitle="We are committed to empowering learners and organizations through innovative technology, practical training and career-focused product experiences."
          />

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            <ValueCard
              icon={FaLightbulb}
              title="Mission"
              desc="To empower students and businesses through innovative technology solutions, AI systems, practical internships and professional learning experiences that create measurable career growth."
            />

            <ValueCard
              icon={FaRocket}
              title="Vision"
              desc="To become a trusted technology company helping future innovators through AI, software engineering, cyber security and digital transformation."
            />
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-[1800px] px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-16">
          <SectionTitle
            eyebrow="AI SERVICES"
            title="What We Do"
            subtitle="Advanced technology solutions designed for students, startups and modern businesses."
          />

          <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {services.map((service) => (
              <ServiceCard
                key={service.title}
                icon={service.icon}
                title={service.title}
                desc={service.desc}
              />
            ))}
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-[1800px] px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-16">
          <SectionTitle
            eyebrow="WHY CHOOSE US"
            title="Why CyberNet?"
            subtitle="A premium technology platform designed with real student success, verified certificates and practical career outcomes in mind."
          />

          <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {values.map((item) => (
              <ValueCard
                key={item.title}
                icon={item.icon}
                title={item.title}
                desc={item.desc}
              />
            ))}
          </div>
        </div>
      </section>

      {/* BOTTOM STRIP */}
      <section className="bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 py-14 text-white">
        <div className="mx-auto max-w-[1800px] px-4 text-center sm:px-6 lg:px-8 xl:px-10 2xl:px-16">
          <h2 className="text-3xl font-black sm:text-5xl">
            CyberNet Technology Systems
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-blue-50/90">
            AI Automation • Software Development • Cyber Security • Cloud Solutions • Internship Programs
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              to="/internships"
              className="rounded-2xl bg-white px-6 py-3 font-bold text-blue-700 transition hover:scale-[1.03]"
            >
              Explore Internships
            </Link>
            <Link
              to="/contact"
              className="rounded-2xl border border-white/25 px-6 py-3 font-bold text-white transition hover:bg-white/10"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}