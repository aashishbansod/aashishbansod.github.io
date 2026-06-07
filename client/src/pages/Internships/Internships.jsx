import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  FaSearch,
  FaCode,
  FaRobot,
  FaShieldAlt,
  FaDatabase,
  FaMobileAlt,
  FaCloud,
  FaLaptopCode,
  FaBrain,
  FaBriefcase,
  FaCertificate,
  FaUsers,
  FaRocket,
  FaArrowRight,
  FaCheckCircle,
} from "react-icons/fa";

function Internships() {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] =
    useState("");

  const [selectedLevel, setSelectedLevel] =
    useState("All");

  const internships = [
    {
      id: 1,
      icon: <FaLaptopCode />,
      title: "Frontend Developer Internship",
      duration: "3 Months",
      level: "Beginner",
      stipend: "Performance Based",
      seats: 100,
      skills: [
        "HTML",
        "CSS",
        "JavaScript",
        "React"
      ],
      assessmentRequired: true,
      fee: 999,
      description:
        "Build modern responsive websites using React and modern frontend tools.",
    },

    {
      id: 2,
      icon: <FaCode />,
      title: "Backend Developer Internship",
      duration: "3 Months",
      level: "Intermediate",
      stipend: "Performance Based",
      seats: 75,
      skills: [
        "Node.js",
        "Express",
        "MongoDB",
        "REST API"
      ],
      assessmentRequired: true,
      fee: 1299,
      description:
        "Develop APIs, databases and scalable backend applications.",
    },

    {
      id: 3,
      icon: <FaCode />,
      title: "Full Stack Development Internship",
      duration: "3 Months",
      level: "Intermediate",
      stipend: "Performance Based",
      seats: 120,
      skills: [
        "React",
        "Node.js",
        "MongoDB",
        "Tailwind"
      ],
      assessmentRequired: true,
      fee: 1499,
      description:
        "Work on complete frontend and backend real-world projects.",
    },

    {
      id: 4,
      icon: <FaRobot />,
      title: "Artificial Intelligence Internship",
      duration: "3 Months",
      level: "Advanced",
      stipend: "Performance Based",
      seats: 50,
      skills: [
        "Python",
        "ML",
        "Deep Learning",
        "AI"
      ],
      assessmentRequired: true,
      fee: 1999,
      description:
        "Learn AI models, machine learning and practical implementations.",
    },

    {
      id: 5,
      icon: <FaBrain />,
      title: "Data Science Internship",
      duration: "3 Months",
      level: "Intermediate",
      stipend: "Performance Based",
      seats: 60,
      skills: [
        "Python",
        "Pandas",
        "NumPy",
        "Visualization"
      ],
      assessmentRequired: true,
      fee: 1799,
      description:
        "Analyze data and create real-world data science solutions.",
    },

    {
      id: 6,
      icon: <FaShieldAlt />,
      title: "Cyber Security Internship",
      duration: "3 Months",
      level: "Intermediate",
      stipend: "Performance Based",
      seats: 80,
      skills: [
        "Linux",
        "Networking",
        "Security",
        "OWASP"
      ],
      assessmentRequired: true,
      fee: 1899,
      description:
        "Learn ethical security practices and cyber defense techniques.",
    },

    {
      id: 7,
      icon: <FaCloud />,
      title: "Cloud Computing Internship",
      duration: "3 Months",
      level: "Advanced",
      stipend: "Performance Based",
      seats: 50,
      skills: [
        "AWS",
        "Azure",
        "Docker",
        "DevOps"
      ],
      assessmentRequired: true,
      fee: 1999,
      description:
        "Build cloud-native applications and deployment pipelines.",
    },

    {
      id: 8,
      icon: <FaDatabase />,
      title: "Database Developer Internship",
      duration: "2 Months",
      level: "Beginner",
      stipend: "Performance Based",
      seats: 90,
      skills: [
        "SQL",
        "MySQL",
        "MongoDB",
        "PL/SQL"
      ],
      assessmentRequired: true,
      fee: 999,
      description:
        "Master database design, queries and optimization techniques.",
    },

    {
      id: 9,
      icon: <FaMobileAlt />,
      title: "Android Development Internship",
      duration: "3 Months",
      level: "Intermediate",
      stipend: "Performance Based",
      seats: 70,
      skills: [
        "Java",
        "Kotlin",
        "Android Studio"
      ],
      assessmentRequired: true,
      fee: 1499,
      description:
        "Create modern Android applications using industry practices.",
    },

    {
      id: 10,
      icon: <FaBriefcase />,
      title: "Digital Marketing Internship",
      duration: "2 Months",
      level: "Beginner",
      stipend: "Performance Based",
      seats: 150,
      skills: [
        "SEO",
        "Social Media",
        "Content Marketing"
      ],
      assessmentRequired: true,
      fee: 799,
      description:
        "Learn marketing strategies, SEO and campaign management.",
    },
  ];

  const filteredInternships =
    internships.filter((item) => {
      const matchesSearch =
        item.title
          .toLowerCase()
          .includes(
            searchTerm.toLowerCase()
          );

      const matchesLevel =
        selectedLevel === "All"
          ? true
          : item.level ===
            selectedLevel;

      return (
        matchesSearch &&
        matchesLevel
      );
    });

  return (
    <div className="min-h-screen bg-slate-50">
            {/* HERO SECTION */}

      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 text-white">

        <div className="absolute inset-0">

          <div className="absolute top-20 left-20 w-96 h-96 bg-cyan-500/20 rounded-full blur-[120px]" />

          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[150px]" />

        </div>

        <div className="relative max-w-[1800px] mx-auto px-12 py-24">

          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* LEFT */}

            <div>

              <div className="inline-flex items-center gap-3 bg-white/10 border border-white/20 rounded-full px-6 py-3 backdrop-blur-lg">

                <FaCheckCircle className="text-green-400" />

                <span className="font-semibold">
                  AI Powered Internship Platform
                </span>

              </div>

              <h1 className="text-7xl font-black leading-tight mt-8">

                Industry Ready
                <span className="block text-cyan-400">
                  Internship Programs
                </span>

              </h1>

              <p className="text-xl text-slate-300 leading-9 mt-8 max-w-3xl">

                Join CyberNet Technology Systems and work
                on real projects, complete assessments,
                unlock scholarships, receive offer letters
                and earn verified certificates.

              </p>

              <div className="flex flex-wrap gap-5 mt-10">

                <button
                  onClick={() =>
                    navigate("/assessment")
                  }
                  className="px-10 py-5 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 font-black flex items-center gap-3 shadow-2xl"
                >
                  Take Assessment
                  <FaArrowRight />
                </button>

                <button
                  onClick={() =>
                    navigate("/register")
                  }
                  className="px-10 py-5 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg font-bold"
                >
                  Register Now
                </button>

              </div>

            </div>

            {/* RIGHT */}

            <div>

              <div className="bg-white/10 border border-white/20 rounded-[40px] p-10 backdrop-blur-xl">

                <h2 className="text-4xl font-black">
                  Internship Workflow
                </h2>

                <div className="space-y-5 mt-10">

                  {[
                    "Register Account",
                    "Take Assessment",
                    "Get Scholarship",
                    "Choose Internship",
                    "Pay Enrollment Fee",
                    "Receive Offer Letter",
                    "Complete Weekly Tasks",
                    "Submit Project",
                    "Get Verified Certificate"
                  ].map((step) => (
                    <div
                      key={step}
                      className="flex items-center gap-4"
                    >
                      <FaCheckCircle className="text-green-400" />

                      <span className="text-lg">
                        {step}
                      </span>
                    </div>
                  ))}

                </div>

              </div>

            </div>

          </div>

        </div>

      </section>

      {/* STATS SECTION */}

      <section className="py-20 bg-white">

        <div className="max-w-[1800px] mx-auto px-12">

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-8">

            <div className="bg-white border rounded-[35px] p-10 shadow-xl">

              <FaUsers className="text-5xl text-blue-600 mb-5" />

              <h2 className="text-5xl font-black">
                5000+
              </h2>

              <p className="text-slate-500 mt-3">
                Active Students
              </p>

            </div>

            <div className="bg-white border rounded-[35px] p-10 shadow-xl">

              <FaBriefcase className="text-5xl text-orange-500 mb-5" />

              <h2 className="text-5xl font-black">
                20+
              </h2>

              <p className="text-slate-500 mt-3">
                Internship Domains
              </p>

            </div>

            <div className="bg-white border rounded-[35px] p-10 shadow-xl">

              <FaRocket className="text-5xl text-green-500 mb-5" />

              <h2 className="text-5xl font-black">
                100+
              </h2>

              <p className="text-slate-500 mt-3">
                Real Projects
              </p>

            </div>

            <div className="bg-white border rounded-[35px] p-10 shadow-xl">

              <FaCertificate className="text-5xl text-purple-500 mb-5" />

              <h2 className="text-5xl font-black">
                100%
              </h2>

              <p className="text-slate-500 mt-3">
                Verified Certificates
              </p>

            </div>

          </div>

        </div>

      </section>

      {/* ASSESSMENT REQUIRED */}

      <section className="py-10 bg-slate-50">

        <div className="max-w-[1800px] mx-auto px-12">

          <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-[35px] p-10 shadow-xl">

            <h2 className="text-4xl font-black">
              Assessment Required Before Internship
            </h2>

            <p className="text-xl mt-4 text-red-100">

              All students must complete the CyberNet
              Assessment before applying for internship
              programs.

            </p>

            <button
              onClick={() =>
                navigate("/assessment")
              }
              className="mt-8 px-8 py-4 rounded-2xl bg-white text-red-600 font-black"
            >
              Start Assessment
            </button>

          </div>

        </div>

      </section>

      {/* SCHOLARSHIP BANNER */}

      <section className="py-10 bg-slate-50">

        <div className="max-w-[1800px] mx-auto px-12">

          <div className="bg-gradient-to-r from-blue-700 via-cyan-500 to-blue-700 text-white rounded-[35px] p-10 shadow-xl">

            <h2 className="text-4xl font-black">
              Scholarship Benefits
            </h2>

            <p className="text-xl mt-4 text-blue-100">

              Score high in assessment and unlock
              scholarship discounts on internship fees.

            </p>

            <div className="grid md:grid-cols-4 gap-5 mt-10">

              <div className="bg-white/10 rounded-2xl p-5">
                <h3 className="text-3xl font-black">
                  90+
                </h3>
                <p>30% Scholarship</p>
              </div>

              <div className="bg-white/10 rounded-2xl p-5">
                <h3 className="text-3xl font-black">
                  80+
                </h3>
                <p>20% Scholarship</p>
              </div>

              <div className="bg-white/10 rounded-2xl p-5">
                <h3 className="text-3xl font-black">
                  70+
                </h3>
                <p>10% Scholarship</p>
              </div>

              <div className="bg-white/10 rounded-2xl p-5">
                <h3 className="text-3xl font-black">
                  Below 70
                </h3>
                <p>No Scholarship</p>
              </div>

            </div>

          </div>

        </div>

      </section>

      {/* SEARCH + FILTER */}

      <section className="py-16 bg-white">

        <div className="max-w-[1800px] mx-auto px-12">

          <div className="flex flex-col lg:flex-row gap-6">

            <div className="relative flex-1">

              <FaSearch className="absolute left-5 top-5 text-slate-400 text-xl" />

              <input
                type="text"
                placeholder="Search Internship..."
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm(
                    e.target.value
                  )
                }
                className="w-full h-16 pl-14 pr-5 rounded-2xl border shadow-lg outline-none"
              />

            </div>

            <select
              value={selectedLevel}
              onChange={(e) =>
                setSelectedLevel(
                  e.target.value
                )
              }
              className="h-16 px-6 rounded-2xl border shadow-lg font-semibold"
            >
              <option>All</option>
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>

          </div>

        </div>

      </section>
            {/* INTERNSHIP PROGRAMS */}

      <section className="py-24 bg-slate-50">

        <div className="max-w-[1800px] mx-auto px-12">

          <div className="text-center mb-16">

            <h2 className="text-6xl font-black text-slate-900">
              Available Internship Programs
            </h2>

            <p className="text-slate-500 text-xl mt-5">
              Select your preferred domain and start your career journey.
            </p>

          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-10">

            {filteredInternships.map((item) => (

              <div
                key={item.id}
                className="
                bg-white
                rounded-[35px]
                border
                shadow-xl
                hover:shadow-2xl
                hover:-translate-y-2
                transition-all
                duration-300
                overflow-hidden
                "
              >

                {/* TOP */}

                <div className="p-8 border-b">

                  <div className="flex items-center justify-between">

                    <div className="
                    w-20 h-20
                    rounded-3xl
                    bg-gradient-to-r
                    from-blue-600
                    to-cyan-500
                    text-white
                    flex
                    items-center
                    justify-center
                    text-4xl
                    ">
                      {item.icon}
                    </div>

                    <div className="text-right">

                      <span className="
                      px-4 py-2
                      rounded-full
                      bg-green-100
                      text-green-700
                      font-bold
                      text-sm
                      ">
                        {item.level}
                      </span>

                    </div>

                  </div>

                  <h3 className="text-3xl font-black text-slate-900 mt-6">
                    {item.title}
                  </h3>

                  <p className="text-slate-600 mt-5 leading-8">
                    {item.description}
                  </p>

                </div>

                {/* DETAILS */}

                <div className="p-8">

                  <div className="grid grid-cols-2 gap-4">

                    <div className="bg-slate-50 rounded-2xl p-4">

                      <p className="text-slate-500 text-sm">
                        Duration
                      </p>

                      <h4 className="font-black text-lg">
                        {item.duration}
                      </h4>

                    </div>

                    <div className="bg-slate-50 rounded-2xl p-4">

                      <p className="text-slate-500 text-sm">
                        Seats
                      </p>

                      <h4 className="font-black text-lg">
                        {item.seats}
                      </h4>

                    </div>

                    <div className="bg-slate-50 rounded-2xl p-4">

                      <p className="text-slate-500 text-sm">
                        Stipend
                      </p>

                      <h4 className="font-black text-lg">
                        {item.stipend}
                      </h4>

                    </div>

                    <div className="bg-slate-50 rounded-2xl p-4">

                      <p className="text-slate-500 text-sm">
                        Fee
                      </p>

                      <h4 className="font-black text-lg text-blue-600">
                        ₹{item.fee}
                      </h4>

                    </div>

                  </div>

                  {/* SKILLS */}

                  <div className="mt-8">

                    <h4 className="font-black text-lg mb-4">
                      Required Skills
                    </h4>

                    <div className="flex flex-wrap gap-3">

                      {item.skills.map((skill) => (

                        <span
                          key={skill}
                          className="
                          px-4 py-2
                          rounded-full
                          bg-blue-100
                          text-blue-700
                          font-semibold
                          text-sm
                          "
                        >
                          {skill}
                        </span>

                      ))}

                    </div>

                  </div>

                  {/* SCHOLARSHIP */}

                  <div className="
                  mt-8
                  rounded-3xl
                  bg-gradient-to-r
                  from-green-500
                  to-emerald-600
                  text-white
                  p-6
                  ">

                    <h4 className="font-black text-xl">
                      Scholarship Available
                    </h4>

                    <p className="mt-2">
                      Assessment score can reduce your internship fee by up to 30%.
                    </p>

                  </div>

                  {/* ELIGIBILITY */}

                  <div className="
                  mt-6
                  bg-orange-50
                  border
                  border-orange-200
                  rounded-3xl
                  p-6
                  ">

                    <div className="flex items-center gap-3">

                      <FaCheckCircle className="text-orange-500" />

                      <span className="font-bold text-orange-700">
                        Assessment Required Before Applying
                      </span>

                    </div>

                  </div>

                  {/* BUTTONS */}

                  <div className="grid grid-cols-2 gap-4 mt-8">

                    <button
                      onClick={() =>
                        navigate("/assessment")
                      }
                      className="
                      h-14
                      rounded-2xl
                      bg-gradient-to-r
                      from-blue-600
                      to-cyan-500
                      text-white
                      font-black
                      shadow-xl
                      "
                    >
                      Take Assessment
                    </button>

                    <button
                      onClick={() =>
                        navigate(
                          "/student/apply-internship"
                        )
                      }
                      className="
                      h-14
                      rounded-2xl
                      border-2
                      border-blue-600
                      text-blue-600
                      font-black
                      hover:bg-blue-600
                      hover:text-white
                      transition-all
                      "
                    >
                      Apply Now
                    </button>

                  </div>

                </div>

              </div>

            ))}

          </div>

        </div>

      </section>

      {/* PROCESS FLOW */}

      <section className="py-24 bg-white">

        <div className="max-w-[1800px] mx-auto px-12">

          <div className="text-center">

            <h2 className="text-6xl font-black text-slate-900">
              Internship Enrollment Process
            </h2>

            <p className="text-slate-500 text-xl mt-5">
              Complete these steps to unlock your internship.
            </p>

          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-8 mt-20">

            {[
              "Register",
              "Assessment",
              "Scholarship",
              "Payment",
              "Internship Access"
            ].map((step, index) => (

              <div
                key={step}
                className="
                bg-slate-50
                rounded-[35px]
                p-10
                text-center
                shadow-lg
                "
              >

                <div className="
                w-16 h-16
                rounded-full
                bg-gradient-to-r
                from-blue-600
                to-cyan-500
                text-white
                flex
                items-center
                justify-center
                text-2xl
                font-black
                mx-auto
                ">
                  {index + 1}
                </div>

                <h3 className="text-2xl font-black mt-6">
                  {step}
                </h3>

              </div>

            ))}

          </div>

        </div>

      </section>
            {/* INTERNSHIP BENEFITS */}

      <section className="py-24 bg-slate-50">

        <div className="max-w-[1800px] mx-auto px-12">

          <div className="text-center">

            <h2 className="text-6xl font-black text-slate-900">
              Internship Benefits
            </h2>

            <p className="text-slate-500 text-xl mt-5">
              Everything included in your CyberNet internship.
            </p>

          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-8 mt-20">

            <div className="bg-white rounded-[35px] p-10 shadow-xl">
              <div className="text-6xl">📜</div>

              <h3 className="text-3xl font-black mt-6">
                Offer Letter
              </h3>

              <p className="text-slate-600 mt-5 leading-8">
                Official internship offer letter after successful enrollment.
              </p>
            </div>

            <div className="bg-white rounded-[35px] p-10 shadow-xl">
              <div className="text-6xl">🎓</div>

              <h3 className="text-3xl font-black mt-6">
                Certificate
              </h3>

              <p className="text-slate-600 mt-5 leading-8">
                QR verified internship completion certificate.
              </p>
            </div>

            <div className="bg-white rounded-[35px] p-10 shadow-xl">
              <div className="text-6xl">💼</div>

              <h3 className="text-3xl font-black mt-6">
                Experience Letter
              </h3>

              <p className="text-slate-600 mt-5 leading-8">
                Professional experience letter after project completion.
              </p>
            </div>

            <div className="bg-white rounded-[35px] p-10 shadow-xl">
              <div className="text-6xl">👨‍🏫</div>

              <h3 className="text-3xl font-black mt-6">
                Mentor Support
              </h3>

              <p className="text-slate-600 mt-5 leading-8">
                Weekly guidance from industry mentors.
              </p>
            </div>

          </div>

        </div>

      </section>

      {/* OFFER LETTER + CERTIFICATE */}

      <section className="py-24 bg-white">

        <div className="max-w-[1800px] mx-auto px-12">

          <div className="grid lg:grid-cols-2 gap-10">

            <div className="bg-gradient-to-br from-blue-700 to-cyan-500 rounded-[40px] p-12 text-white shadow-2xl">

              <h2 className="text-5xl font-black">
                Internship Offer Letter
              </h2>

              <p className="mt-6 text-blue-100 text-lg leading-8">
                Official internship offer letter with student details,
                internship domain, duration and verification ID.
              </p>

              <ul className="space-y-4 mt-10">
                <li>✅ Student Name</li>
                <li>✅ Internship Domain</li>
                <li>✅ Duration</li>
                <li>✅ Verification Number</li>
                <li>✅ Digital Approval</li>
              </ul>

            </div>

            <div className="bg-gradient-to-br from-purple-700 to-pink-500 rounded-[40px] p-12 text-white shadow-2xl">

              <h2 className="text-5xl font-black">
                Verified Certificate
              </h2>

              <p className="mt-6 text-purple-100 text-lg leading-8">
                Every certificate contains QR verification and unique certificate ID.
              </p>

              <ul className="space-y-4 mt-10">
                <li>✅ QR Verification</li>
                <li>✅ Unique ID</li>
                <li>✅ Online Validation</li>
                <li>✅ Project Completion Proof</li>
                <li>✅ Industry Standard Format</li>
              </ul>

            </div>

          </div>

        </div>

      </section>

      {/* FAQ */}

      <section className="py-24 bg-slate-50">

        <div className="max-w-6xl mx-auto px-10">

          <div className="text-center">

            <h2 className="text-6xl font-black text-slate-900">
              Frequently Asked Questions
            </h2>

          </div>

          <div className="space-y-6 mt-16">

            <div className="bg-white rounded-3xl p-8 shadow-lg">
              <h3 className="text-2xl font-black">
                Is assessment mandatory?
              </h3>

              <p className="text-slate-600 mt-4">
                Yes. Students must complete assessment before internship enrollment.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-lg">
              <h3 className="text-2xl font-black">
                Can I get scholarship?
              </h3>

              <p className="text-slate-600 mt-4">
                Yes. Scholarship depends on assessment score.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-lg">
              <h3 className="text-2xl font-black">
                Do I receive certificate?
              </h3>

              <p className="text-slate-600 mt-4">
                Yes. After successful internship completion.
              </p>
            </div>

          </div>

        </div>

      </section>

      {/* FINAL CTA */}

      <section className="py-28 bg-gradient-to-r from-blue-900 via-blue-700 to-cyan-500 text-white">

        <div className="max-w-6xl mx-auto px-10 text-center">

          <h2 className="text-7xl font-black">
            Ready To Launch
            <span className="block">
              Your Career?
            </span>
          </h2>

          <p className="text-xl text-blue-100 mt-8">
            Complete assessment, unlock scholarship and join CyberNet internships.
          </p>

          <div className="flex flex-wrap justify-center gap-6 mt-12">

            <button
              onClick={() => navigate("/assessment")}
              className="px-10 py-5 rounded-2xl bg-white text-blue-700 font-black shadow-xl"
            >
              Take Assessment
            </button>

            <button
              onClick={() => navigate("/register")}
              className="px-10 py-5 rounded-2xl border border-white text-white font-black"
            >
              Register Now
            </button>

          </div>

        </div>

      </section>

    </div>
  );
}

export default Internships;