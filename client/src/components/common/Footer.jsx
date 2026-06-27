import { Link } from "react-router-dom";
import {
  FaLinkedinIn,
  FaInstagram,
  FaGithub,
  FaEnvelope,
  FaPhoneAlt,
  FaMapMarkerAlt,
} from "react-icons/fa";

const Footer = () => {
  return (
    <footer className="bg-slate-950 text-white border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Company */}
          <div>
            <h2 className="text-2xl font-bold">
              CyberNet Technology Systems
            </h2>

            <p className="mt-4 text-slate-400 text-sm leading-7">
              AI-powered software development,
              internship programs, learning platform,
              cybersecurity solutions and certificate
              verification services.
            </p>

            <div className="flex gap-3 mt-6">
              <a
                href="#"
                className="w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center hover:border-cyan-500"
              >
                <FaLinkedinIn />
              </a>

              <a
                href="#"
                className="w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center hover:border-pink-500"
              >
                <FaInstagram />
              </a>

              <a
                href="#"
                className="w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center hover:border-white"
              >
                <FaGithub />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-semibold text-lg mb-4">
              Quick Links
            </h3>

            <div className="flex flex-col gap-3 text-slate-400">
              <Link to="/">Home</Link>
              <Link to="/about">About</Link>
              <Link to="/internships">Internships</Link>
              <Link to="/contact">Contact</Link>
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-semibold text-lg mb-4">
              Services
            </h3>

            <div className="flex flex-col gap-3 text-slate-400">
              <span>Software Development</span>
              <span>AI Automation</span>
              <span>Cyber Security</span>
              <span>Internship Programs</span>
              <span>Learning Platform</span>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-lg mb-4">
              Contact
            </h3>

            <div className="space-y-4 text-slate-400">
              <div className="flex gap-3">
                <FaEnvelope className="mt-1 text-cyan-400" />
                <span>
                  support@cybernettechnology.in
                </span>
              </div>

              <div className="flex gap-3">
                <FaPhoneAlt className="mt-1 text-cyan-400" />
                <span>+91 XXXXX XXXXX</span>
              </div>

              <div className="flex gap-3">
                <FaMapMarkerAlt className="mt-1 text-cyan-400" />
                <span>Maharashtra, India</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Policy Links */}
      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap justify-center gap-8 text-sm">
          <Link
            to="/privacy-policy"
            className="text-slate-400 hover:text-cyan-400"
          >
            Privacy Policy
          </Link>

          <Link
            to="/terms-and-conditions"
            className="text-slate-400 hover:text-cyan-400"
          >
            Terms & Conditions
          </Link>

          <Link
            to="/refund-policy"
            className="text-slate-400 hover:text-cyan-400"
          >
            Refund Policy
          </Link>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-5 text-center">
          <p className="text-slate-500 text-sm">
            © 2026 CyberNet Technology Systems.
            All Rights Reserved.
          </p>

          <p className="text-slate-600 text-xs mt-2">
            Designed & Developed by Ashish Bansod
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;