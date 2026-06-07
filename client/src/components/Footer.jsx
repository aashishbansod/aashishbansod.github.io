import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaTwitter,
  FaArrowRight,
  FaMapMarkerAlt,
  FaEnvelope,
  FaGlobe,
  FaPhoneAlt,
  FaShieldAlt,
} from "react-icons/fa";

function Footer() {
  return (
    <footer className="bg-slate-950 text-white mt-24">

      {/* TOP CTA */}

      <div className="max-w-7xl mx-auto px-6 pt-20">

        <div className="relative overflow-hidden rounded-[40px] bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-700 p-10 lg:p-16 shadow-2xl">

          <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>

          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10">

            <div>

              <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full text-sm font-semibold mb-5">
                🚀 Admissions Open 2026
              </div>

              <h2 className="text-4xl lg:text-5xl font-black">
                Ready To Launch Your Career?
              </h2>

              <p className="mt-5 text-blue-100 text-lg max-w-2xl leading-8">
                Join CyberNet Technology Systems and gain
                practical experience through internships,
                assessments, projects and verified certifications.
              </p>

            </div>

            <button className="bg-white text-blue-700 px-8 py-4 rounded-2xl font-bold flex items-center gap-3 hover:scale-105 transition-all">
              Apply Internship
              <FaArrowRight />
            </button>

          </div>

        </div>

      </div>

      {/* MAIN FOOTER */}

      <div className="max-w-7xl mx-auto px-6 py-20">

        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-14">

          {/* BRAND */}

          <div>

            <div className="flex items-center gap-4 mb-8">

              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-500 via-cyan-400 to-purple-500 flex items-center justify-center text-white text-3xl font-black shadow-xl">
                CN
              </div>

              <div>
                <h2 className="text-3xl font-black">
                  CyberNet
                </h2>

                <p className="text-cyan-400 font-medium">
                  Technology Systems
                </p>
              </div>

            </div>

            <p className="text-slate-400 leading-8">
              CyberNet Technology Systems provides
              industry-focused internships,
              AI assessments,
              verified certificates,
              offer letters,
              experience letters
              and project-based learning.
            </p>

            <div className="flex gap-3 mt-8 flex-wrap">

              <span className="bg-slate-800 px-4 py-2 rounded-xl text-sm">
                🚀 Startup Driven
              </span>

              <span className="bg-slate-800 px-4 py-2 rounded-xl text-sm">
                🎓 Certified
              </span>

              <span className="bg-slate-800 px-4 py-2 rounded-xl text-sm">
                🏆 Skill Based
              </span>

            </div>

          </div>

          {/* QUICK LINKS */}

          <div>

            <h3 className="text-xl font-bold mb-8">
              Quick Links
            </h3>

            <ul className="space-y-5 text-slate-400">

              <li className="hover:text-cyan-400 cursor-pointer transition">
                Home
              </li>

              <li className="hover:text-cyan-400 cursor-pointer transition">
                Internships
              </li>

              <li className="hover:text-cyan-400 cursor-pointer transition">
                Assessment
              </li>

              <li className="hover:text-cyan-400 cursor-pointer transition">
                Scholarship
              </li>

              <li className="hover:text-cyan-400 cursor-pointer transition">
                Certificates
              </li>

              <li className="hover:text-cyan-400 cursor-pointer transition">
                Contact Us
              </li>

            </ul>

          </div>

          {/* DOMAINS */}

          <div>

            <h3 className="text-xl font-bold mb-8">
              Internship Domains
            </h3>

            <ul className="space-y-5 text-slate-400">

              <li>💻 Full Stack Development</li>
              <li>🐍 Python Development</li>
              <li>☕ Java Development</li>
              <li>🤖 AI & Machine Learning</li>
              <li>🔐 Cyber Security</li>
              <li>📈 Digital Marketing</li>

            </ul>

          </div>

          {/* CONTACT */}

          <div>

            <h3 className="text-xl font-bold mb-8">
              Contact Information
            </h3>

            <div className="space-y-5 text-slate-400">

              <p className="flex items-center gap-3">
                <FaEnvelope className="text-cyan-400" />
                support@cybernet.in
              </p>

              <p className="flex items-center gap-3">
                <FaGlobe className="text-cyan-400" />
                www.cybernet.in
              </p>

              <p className="flex items-center gap-3">
                <FaMapMarkerAlt className="text-cyan-400" />
                Maharashtra, India
              </p>

              <p className="flex items-center gap-3">
                <FaPhoneAlt className="text-cyan-400" />
                +91 XXXXX XXXXX
              </p>

            </div>

            {/* SOCIAL */}

            <div className="flex gap-4 mt-8">

              <button className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-blue-600 transition">
                <FaFacebookF className="mx-auto mt-4" />
              </button>

              <button className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-pink-600 transition">
                <FaInstagram className="mx-auto mt-4" />
              </button>

              <button className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-blue-700 transition">
                <FaLinkedinIn className="mx-auto mt-4" />
              </button>

              <button className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-sky-500 transition">
                <FaTwitter className="mx-auto mt-4" />
              </button>

            </div>

          </div>

        </div>

      </div>

      {/* STATS */}

      <div className="border-y border-slate-800">

        <div className="max-w-7xl mx-auto px-6 py-16">

          <div className="grid md:grid-cols-4 gap-10 text-center">

            <div>
              <h2 className="text-5xl font-black text-cyan-400">
                5000+
              </h2>
              <p className="text-slate-400 mt-3">
                Registered Students
              </p>
            </div>

            <div>
              <h2 className="text-5xl font-black text-blue-400">
                2500+
              </h2>
              <p className="text-slate-400 mt-3">
                Certificates Issued
              </p>
            </div>

            <div>
              <h2 className="text-5xl font-black text-purple-400">
                150+
              </h2>
              <p className="text-slate-400 mt-3">
                Projects Completed
              </p>
            </div>

            <div>
              <h2 className="text-5xl font-black text-green-400">
                20+
              </h2>
              <p className="text-slate-400 mt-3">
                Internship Domains
              </p>
            </div>

          </div>

        </div>

      </div>

      {/* BOTTOM */}

      <div className="max-w-7xl mx-auto px-6 py-8">

        <div className="flex flex-col lg:flex-row justify-between items-center gap-5">

          <p className="text-slate-500 text-sm">
            © 2026 CyberNet Technology Systems. All Rights Reserved.
          </p>

          <div className="flex flex-wrap gap-6 text-sm">

            <a href="#" className="text-slate-500 hover:text-cyan-400">
              Privacy Policy
            </a>

            <a href="#" className="text-slate-500 hover:text-cyan-400">
              Terms & Conditions
            </a>

            <a href="#" className="text-slate-500 hover:text-cyan-400">
              Refund Policy
            </a>

            <a href="#" className="text-slate-500 hover:text-cyan-400 flex items-center gap-2">
              <FaShieldAlt />
              Verify Certificate
            </a>

          </div>

        </div>

      </div>

    </footer>
  );
}

export default Footer;