import React, { useState } from "react";
import {
  FaCertificate,
  FaDownload,
  FaSearch,
  FaCheckCircle,
  FaAward,
  FaFilePdf,
  FaShieldAlt,
  FaUsers,
  FaLinkedin,
  FaQrcode
} from "react-icons/fa";

const Certificates = () => {
  const [search, setSearch] = useState("");

  const certificates = [
    {
      id: 1,
      certificateId: "CNTS-2026-001",
      title: "Frontend Development Internship",
      duration: "3 Months",
      status: "Verified",
      issueDate: "15 June 2026"
    },
    {
      id: 2,
      certificateId: "CNTS-2026-002",
      title: "Backend Development Internship",
      duration: "3 Months",
      status: "Verified",
      issueDate: "15 June 2026"
    },
    {
      id: 3,
      certificateId: "CNTS-2026-003",
      title: "Full Stack Development Internship",
      duration: "6 Months",
      status: "Verified",
      issueDate: "15 June 2026"
    },
    {
      id: 4,
      certificateId: "CNTS-2026-004",
      title: "Python Development Internship",
      duration: "3 Months",
      status: "Verified",
      issueDate: "15 June 2026"
    },
    {
      id: 5,
      certificateId: "CNTS-2026-005",
      title: "Java Development Internship",
      duration: "3 Months",
      status: "Verified",
      issueDate: "15 June 2026"
    }
  ];

  const filteredCertificates = certificates.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.certificateId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50">

      {/* HERO SECTION */}

      <section className="relative overflow-hidden bg-gradient-to-r from-blue-900 via-blue-700 to-cyan-600 py-28">

        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-300 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-6 text-center text-white">

          <div className="inline-flex items-center gap-3 bg-white/20 backdrop-blur-md px-6 py-3 rounded-full mb-8">

            <FaShieldAlt />

            <span className="font-semibold">
              CyberNet Verified Certificate Portal
            </span>

          </div>

          <h1 className="text-6xl md:text-7xl font-black leading-tight">

            Download & Verify

            <span className="block text-cyan-200">
              Internship Certificates
            </span>

          </h1>

          <p className="text-xl text-blue-100 mt-8 max-w-4xl mx-auto">

            Securely access internship certificates, verify
            authenticity, share achievements on LinkedIn,
            and build a stronger professional portfolio.

          </p>

          <div className="max-w-3xl mx-auto mt-12 relative">

            <FaSearch className="absolute left-5 top-5 text-slate-500 text-lg" />

            <input
              type="text"
              placeholder="Search by Certificate ID or Internship Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-16 rounded-2xl pl-14 pr-5 text-black outline-none shadow-2xl"
            />

          </div>

          <div className="flex flex-wrap justify-center gap-4 mt-10">

            <button className="px-8 py-4 rounded-2xl bg-white text-blue-700 font-bold hover:scale-105 transition">
              Download Certificate
            </button>

            <button className="px-8 py-4 rounded-2xl border-2 border-white text-white font-bold hover:bg-white hover:text-blue-700 transition">
              Verify Certificate
            </button>

          </div>

        </div>

      </section>

      {/* LIVE STATS */}

      <section className="max-w-7xl mx-auto px-6 py-16">

        <div className="grid md:grid-cols-4 gap-8">

          <div className="bg-white rounded-3xl p-8 shadow-lg">

            <FaCertificate className="text-5xl text-blue-600" />

            <h2 className="text-4xl font-black mt-4">
              2,500+
            </h2>

            <p className="text-slate-500">
              Certificates Generated
            </p>

          </div>

          <div className="bg-white rounded-3xl p-8 shadow-lg">

            <FaCheckCircle className="text-5xl text-green-600" />

            <h2 className="text-4xl font-black mt-4">
              100%
            </h2>

            <p className="text-slate-500">
              Verification Success
            </p>

          </div>

          <div className="bg-white rounded-3xl p-8 shadow-lg">

            <FaUsers className="text-5xl text-purple-600" />

            <h2 className="text-4xl font-black mt-4">
              1,200+
            </h2>

            <p className="text-slate-500">
              Active Interns
            </p>

          </div>

          <div className="bg-white rounded-3xl p-8 shadow-lg">

            <FaQrcode className="text-5xl text-orange-500" />

            <h2 className="text-4xl font-black mt-4">
              QR
            </h2>

            <p className="text-slate-500">
              Instant Verification
            </p>

          </div>

        </div>

      </section>
            {/* CERTIFICATE CARDS */}

      <section className="max-w-7xl mx-auto px-6 pb-20">

        <div className="flex items-center justify-between mb-10">

          <div>
            <h2 className="text-4xl font-black text-slate-900">
              Available Certificates
            </h2>

            <p className="text-slate-500 mt-2">
              Download, verify and manage internship certificates.
            </p>
          </div>

          <div className="hidden md:flex items-center gap-3 bg-blue-50 px-5 py-3 rounded-2xl">

            <FaCertificate className="text-blue-600" />

            <span className="font-semibold text-slate-700">
              {filteredCertificates.length} Certificates Found
            </span>

          </div>

        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">

          {filteredCertificates.map((certificate) => (

            <div
              key={certificate.id}
              className="bg-white rounded-3xl shadow-xl overflow-hidden hover:-translate-y-2 hover:shadow-2xl transition-all duration-300"
            >

              <div className="h-3 bg-gradient-to-r from-blue-600 via-cyan-500 to-purple-500" />

              <div className="p-8">

                <div className="flex justify-between items-center mb-6">

                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-500 flex items-center justify-center text-white text-4xl">
                    <FaFilePdf />
                  </div>

                  <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full font-bold text-sm">
                    VERIFIED
                  </span>

                </div>

                <h3 className="text-2xl font-black text-slate-900 mb-4">
                  {certificate.title}
                </h3>

                <div className="space-y-4">

                  <div className="flex justify-between">

                    <span className="text-slate-500">
                      Certificate ID
                    </span>

                    <span className="font-bold text-blue-600">
                      {certificate.certificateId}
                    </span>

                  </div>

                  <div className="flex justify-between">

                    <span className="text-slate-500">
                      Duration
                    </span>

                    <span className="font-semibold">
                      {certificate.duration}
                    </span>

                  </div>

                  <div className="flex justify-between">

                    <span className="text-slate-500">
                      Status
                    </span>

                    <span className="font-bold text-green-600">
                      {certificate.status}
                    </span>

                  </div>

                  <div className="flex justify-between">

                    <span className="text-slate-500">
                      Issue Date
                    </span>

                    <span className="font-semibold">
                      {certificate.issueDate}
                    </span>

                  </div>

                </div>

                <div className="grid grid-cols-2 gap-3 mt-8">

                  <button
                    className="py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold hover:scale-105 transition"
                  >
                    <FaDownload className="inline mr-2" />
                    Download
                  </button>

                  <button
                    className="py-3 rounded-xl border-2 border-blue-600 text-blue-600 font-bold hover:bg-blue-600 hover:text-white transition"
                  >
                    Verify
                  </button>

                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">

                  <button
                    className="py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition"
                  >
                    View PDF
                  </button>

                  <button
                    className="py-3 rounded-xl bg-[#0077B5] text-white font-bold hover:opacity-90 transition"
                  >
                    <FaLinkedin className="inline mr-2" />
                    LinkedIn
                  </button>

                </div>

              </div>

            </div>

          ))}

        </div>

      </section>

      {/* CERTIFICATE VERIFICATION */}

      <section className="bg-white py-20">

        <div className="max-w-6xl mx-auto px-6">

          <div className="text-center mb-16">

            <h2 className="text-5xl font-black text-slate-900">
              Verify Certificate
            </h2>

            <p className="text-slate-500 text-lg mt-4">
              Enter certificate ID and verify authenticity instantly.
            </p>

          </div>

          <div className="bg-slate-50 rounded-[40px] p-10 shadow-lg">

            <div className="grid md:grid-cols-4 gap-4">

              <input
                type="text"
                placeholder="Enter Certificate ID"
                className="md:col-span-3 h-14 rounded-2xl px-5 border outline-none"
              />

              <button
                className="h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold"
              >
                Verify Now
              </button>

            </div>

          </div>

        </div>

      </section>

      {/* CERTIFICATE FEATURES */}

      <section className="bg-slate-50 py-20">

        <div className="max-w-7xl mx-auto px-6">

          <div className="text-center mb-16">

            <h2 className="text-5xl font-black text-slate-900">
              Why CyberNet Certificates?
            </h2>

            <p className="text-slate-500 text-lg mt-4">
              Industry-ready certificates with verification support.
            </p>

          </div>

          <div className="grid md:grid-cols-3 gap-8">

            <div className="bg-white rounded-3xl p-8 shadow-lg">

              <div className="text-5xl mb-5">🔐</div>

              <h3 className="text-2xl font-black">
                Secure Verification
              </h3>

              <p className="text-slate-600 mt-4">
                Every certificate contains a unique verification ID.
              </p>

            </div>

            <div className="bg-white rounded-3xl p-8 shadow-lg">

              <div className="text-5xl mb-5">💼</div>

              <h3 className="text-2xl font-black">
                Resume Ready
              </h3>

              <p className="text-slate-600 mt-4">
                Strengthen your resume and professional portfolio.
              </p>

            </div>

            <div className="bg-white rounded-3xl p-8 shadow-lg">

              <div className="text-5xl mb-5">🚀</div>

              <h3 className="text-2xl font-black">
                Career Growth
              </h3>

              <p className="text-slate-600 mt-4">
                Showcase internship achievements to recruiters.
              </p>

            </div>

          </div>

        </div>

      </section>
            {/* TOP CERTIFIED STUDENTS */}

      <section className="bg-white py-24">

        <div className="max-w-7xl mx-auto px-6">

          <div className="text-center mb-16">

            <h2 className="text-5xl font-black text-slate-900">
              Top Certified Students
            </h2>

            <p className="text-slate-500 text-lg mt-4">
              Outstanding internship performers across CyberNet programs.
            </p>

          </div>

          <div className="overflow-x-auto bg-white rounded-[40px] shadow-2xl">

            <table className="w-full">

              <thead className="bg-gradient-to-r from-blue-700 to-cyan-600 text-white">

                <tr>

                  <th className="p-6 text-left">
                    Rank
                  </th>

                  <th className="p-6 text-left">
                    Student
                  </th>

                  <th className="p-6 text-left">
                    Domain
                  </th>

                  <th className="p-6 text-left">
                    Score
                  </th>

                  <th className="p-6 text-left">
                    Status
                  </th>

                </tr>

              </thead>

              <tbody>

                <tr className="border-b">

                  <td className="p-6 font-black">
                    🥇 #1
                  </td>

                  <td className="p-6">
                    Rahul Sharma
                  </td>

                  <td className="p-6">
                    Full Stack Development
                  </td>

                  <td className="p-6 text-green-600 font-bold">
                    98%
                  </td>

                  <td className="p-6">
                    <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full font-bold text-sm">
                      Verified
                    </span>
                  </td>

                </tr>

                <tr className="border-b">

                  <td className="p-6 font-black">
                    🥈 #2
                  </td>

                  <td className="p-6">
                    Priya Verma
                  </td>

                  <td className="p-6">
                    Python Development
                  </td>

                  <td className="p-6 text-green-600 font-bold">
                    96%
                  </td>

                  <td className="p-6">
                    <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full font-bold text-sm">
                      Verified
                    </span>
                  </td>

                </tr>

                <tr>

                  <td className="p-6 font-black">
                    🥉 #3
                  </td>

                  <td className="p-6">
                    Aman Gupta
                  </td>

                  <td className="p-6">
                    Frontend Development
                  </td>

                  <td className="p-6 text-green-600 font-bold">
                    94%
                  </td>

                  <td className="p-6">
                    <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full font-bold text-sm">
                      Verified
                    </span>
                  </td>

                </tr>

              </tbody>

            </table>

          </div>

        </div>

      </section>

      {/* CERTIFICATE BENEFITS */}

      <section className="bg-slate-50 py-24">

        <div className="max-w-7xl mx-auto px-6">

          <div className="text-center mb-16">

            <h2 className="text-5xl font-black text-slate-900">
              Certificate Benefits
            </h2>

            <p className="text-slate-500 text-lg mt-4">
              Why CyberNet certificates add value to your career.
            </p>

          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-8">

            <div className="bg-white rounded-3xl p-8 shadow-xl">

              <div className="text-6xl">
                📜
              </div>

              <h3 className="text-2xl font-black mt-6">
                Verified Credentials
              </h3>

              <p className="text-slate-600 mt-4">
                Every certificate includes a unique verification ID.
              </p>

            </div>

            <div className="bg-white rounded-3xl p-8 shadow-xl">

              <div className="text-6xl">
                💼
              </div>

              <h3 className="text-2xl font-black mt-6">
                Resume Enhancement
              </h3>

              <p className="text-slate-600 mt-4">
                Strengthen your resume and portfolio with verified experience.
              </p>

            </div>

            <div className="bg-white rounded-3xl p-8 shadow-xl">

              <div className="text-6xl">
                🌐
              </div>

              <h3 className="text-2xl font-black mt-6">
                LinkedIn Ready
              </h3>

              <p className="text-slate-600 mt-4">
                Easily showcase achievements on LinkedIn and job platforms.
              </p>

            </div>

            <div className="bg-white rounded-3xl p-8 shadow-xl">

              <div className="text-6xl">
                🚀
              </div>

              <h3 className="text-2xl font-black mt-6">
                Career Growth
              </h3>

              <p className="text-slate-600 mt-4">
                Improve internship and placement opportunities.
              </p>

            </div>

          </div>

        </div>

      </section>

      {/* LIVE CERTIFICATE STATS */}

      <section className="bg-white py-24">

        <div className="max-w-7xl mx-auto px-6">

          <div className="text-center mb-16">

            <h2 className="text-5xl font-black text-slate-900">
              Live Certificate Statistics
            </h2>

          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-8">

            <div className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-3xl p-10 text-center">

              <h3 className="text-5xl font-black">
                2,500+
              </h3>

              <p className="mt-3">
                Certificates Generated
              </p>

            </div>

            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-3xl p-10 text-center">

              <h3 className="text-5xl font-black">
                100%
              </h3>

              <p className="mt-3">
                Verification Success
              </p>

            </div>

            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-3xl p-10 text-center">

              <h3 className="text-5xl font-black">
                50+
              </h3>

              <p className="mt-3">
                Internship Domains
              </p>

            </div>

            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-3xl p-10 text-center">

              <h3 className="text-5xl font-black">
                24/7
              </h3>

              <p className="mt-3">
                Certificate Access
              </p>

            </div>

          </div>

        </div>

      </section>

      {/* INTERNSHIP COMPLETION RECORDS */}

      <section className="bg-slate-50 py-24">

        <div className="max-w-7xl mx-auto px-6">

          <div className="text-center mb-16">

            <h2 className="text-5xl font-black text-slate-900">
              Internship Completion Records
            </h2>

            <p className="text-slate-500 text-lg mt-4">
              Recently completed internship programs.
            </p>

          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">

            <div className="bg-white rounded-3xl p-8 shadow-xl">

              <h3 className="text-2xl font-black">
                Full Stack Development
              </h3>

              <p className="text-slate-500 mt-3">
                Completed Interns
              </p>

              <h4 className="text-5xl font-black text-blue-600 mt-4">
                420
              </h4>

            </div>

            <div className="bg-white rounded-3xl p-8 shadow-xl">

              <h3 className="text-2xl font-black">
                Python Development
              </h3>

              <p className="text-slate-500 mt-3">
                Completed Interns
              </p>

              <h4 className="text-5xl font-black text-green-600 mt-4">
                380
              </h4>

            </div>

            <div className="bg-white rounded-3xl p-8 shadow-xl">

              <h3 className="text-2xl font-black">
                Frontend Development
              </h3>

              <p className="text-slate-500 mt-3">
                Completed Interns
              </p>

              <h4 className="text-5xl font-black text-purple-600 mt-4">
                310
              </h4>

            </div>

          </div>

        </div>

      </section>

      {/* PART D STARTS BELOW */}
            {/* FAQ SECTION */}

      <section className="bg-white py-24">

        <div className="max-w-6xl mx-auto px-6">

          <div className="text-center mb-16">

            <h2 className="text-5xl font-black text-slate-900">
              Frequently Asked Questions
            </h2>

            <p className="text-slate-500 text-lg mt-4">
              Common questions regarding CyberNet certificates.
            </p>

          </div>

          <div className="space-y-6">

            <div className="bg-slate-50 rounded-3xl p-8 shadow-lg">

              <h3 className="text-2xl font-black">
                Are CyberNet certificates verified?
              </h3>

              <p className="text-slate-600 mt-4">
                Yes. Every certificate contains a unique verification ID
                and can be verified through the CyberNet verification portal.
              </p>

            </div>

            <div className="bg-slate-50 rounded-3xl p-8 shadow-lg">

              <h3 className="text-2xl font-black">
                Can I add certificates to LinkedIn?
              </h3>

              <p className="text-slate-600 mt-4">
                Yes. Certificates can be added to LinkedIn profiles,
                resumes, portfolios and job applications.
              </p>

            </div>

            <div className="bg-slate-50 rounded-3xl p-8 shadow-lg">

              <h3 className="text-2xl font-black">
                How do I verify a certificate?
              </h3>

              <p className="text-slate-600 mt-4">
                Enter the certificate ID in the verification section
                and the system will validate it instantly.
              </p>

            </div>

            <div className="bg-slate-50 rounded-3xl p-8 shadow-lg">

              <h3 className="text-2xl font-black">
                Can certificates be downloaded multiple times?
              </h3>

              <p className="text-slate-600 mt-4">
                Yes. Students can download certificates anytime
                after successful internship completion.
              </p>

            </div>

          </div>

        </div>

      </section>

      {/* SUPPORT SECTION */}

      <section className="bg-slate-50 py-24">

        <div className="max-w-7xl mx-auto px-6">

          <div className="bg-gradient-to-r from-blue-700 via-cyan-600 to-blue-500 rounded-[40px] p-12 text-white shadow-2xl">

            <div className="grid lg:grid-cols-2 gap-10 items-center">

              <div>

                <h2 className="text-5xl font-black">
                  Need Help With Certificates?
                </h2>

                <p className="text-xl text-blue-100 mt-6 leading-9">

                  Our support team can help you with certificate
                  downloads, verification issues, internship records
                  and profile updates.

                </p>

              </div>

              <div className="space-y-4">

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5">
                  📧 support@cybernet.in
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5">
                  🌐 www.cybernet.in
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5">
                  📍 Maharashtra, India
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5">
                  ⏰ Support Available 24/7
                </div>

              </div>

            </div>

          </div>

        </div>

      </section>

      {/* FINAL CTA */}

      <section className="bg-gradient-to-r from-slate-950 via-blue-950 to-cyan-900 py-24 text-white">

        <div className="max-w-6xl mx-auto px-6 text-center">

          <div className="inline-flex items-center gap-3 bg-white/10 px-6 py-3 rounded-full mb-8">

            <FaCertificate />

            <span>
              CyberNet Certificate Portal
            </span>

          </div>

          <h2 className="text-6xl font-black">

            Showcase Your
            <span className="block text-cyan-300">
              Internship Achievement
            </span>

          </h2>

          <p className="text-xl text-slate-300 mt-8 max-w-4xl mx-auto">

            Download verified certificates, share them on LinkedIn,
            verify authenticity and strengthen your professional profile.

          </p>

          <div className="flex flex-wrap justify-center gap-5 mt-12">

            <button
              className="
              px-10
              py-5
              rounded-2xl
              bg-white
              text-blue-700
              font-black
              shadow-xl
              hover:scale-105
              transition
              "
            >
              Download Certificate
            </button>

            <button
              className="
              px-10
              py-5
              rounded-2xl
              border-2
              border-white
              text-white
              font-black
              hover:bg-white
              hover:text-blue-700
              transition
              "
            >
              Verify Certificate
            </button>

          </div>

        </div>

      </section>

    </div>
  );
};

export default Certificates;