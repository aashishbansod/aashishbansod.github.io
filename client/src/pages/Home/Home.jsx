import React from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";

import {
  FaArrowRight,
  FaCheckCircle,
  FaBrain,
  FaLaptopCode,
  FaMobileAlt,
  FaShieldAlt,
  FaCloud,
  FaUsers,
  FaAward,
  FaHandshake,
} from "react-icons/fa";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">

      {/* NAVBAR */}

      <Navbar />

      {/* HERO SECTION */}

      <section className="relative overflow-hidden">

        {/* Background */}

        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-cyan-50"></div>

        <div className="absolute top-20 left-20 w-96 h-96 bg-blue-300/20 blur-3xl rounded-full"></div>

        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-cyan-300/20 blur-3xl rounded-full"></div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-10">

          <div className="grid lg:grid-cols-2 gap-20 items-center min-h-[90vh]">

            {/* LEFT */}

            <div>

              <div className="inline-flex items-center gap-3 px-5 py-3 rounded-full bg-white border border-blue-100 shadow-lg">

                <FaCheckCircle className="text-green-500" />

                <span className="font-semibold text-slate-700">
                  Trusted Technology Company
                </span>

              </div>

              <h1 className="mt-8 text-6xl lg:text-7xl font-black leading-tight text-slate-900">

                Transforming

                <span className="block bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-700 bg-clip-text text-transparent">

                  Ideas Into

                </span>

                Technology

              </h1>

              <p className="mt-8 text-xl leading-9 text-slate-600 max-w-2xl">

                CyberNet Technology Systems helps businesses,
                students and professionals with software
                development, AI solutions, cloud computing,
                cyber security and digital transformation.

              </p>

              <div className="flex flex-wrap gap-5 mt-10">

                <button
                  onClick={() => navigate("/about")}
                  className="
                  px-8
                  py-4
                  rounded-2xl
                  bg-gradient-to-r
                  from-blue-600
                  to-cyan-500
                  text-white
                  font-bold
                  flex
                  items-center
                  gap-3
                  shadow-xl
                  hover:scale-105
                  transition-all
                  "
                >
                  Explore Company

                  <FaArrowRight />
                </button>

                <button
                  onClick={() => navigate("/contact")}
                  className="
                  px-8
                  py-4
                  rounded-2xl
                  bg-white
                  border
                  border-slate-300
                  font-bold
                  shadow-md
                  hover:bg-slate-100
                  transition-all
                  "
                >
                  Contact Us
                </button>

              </div>

            </div>

            {/* RIGHT SIDE PREMIUM DASHBOARD */}

            <div className="relative">
                            {/* Main Dashboard Card */}

              <div
                className="
                bg-white
                rounded-[40px]
                p-8
                shadow-[0_20px_80px_rgba(0,0,0,0.08)]
                border
                border-slate-100
                "
              >

                <div className="flex items-center justify-between mb-8">

                  <div>

                    <h3 className="text-2xl font-black text-slate-900">
                      CyberNet Dashboard
                    </h3>

                    <p className="text-slate-500">
                      Real Time Technology Solutions
                    </p>

                  </div>

                  <div className="w-4 h-4 rounded-full bg-green-500 animate-pulse"></div>

                </div>

                {/* Dashboard Stats */}

                <div className="grid grid-cols-2 gap-5">

                  <div className="rounded-3xl bg-blue-50 p-6">

                    <FaUsers className="text-blue-600 text-3xl mb-4" />

                    <h4 className="text-4xl font-black text-slate-900">
                      500+
                    </h4>

                    <p className="text-slate-500">
                      Clients
                    </p>

                  </div>

                  <div className="rounded-3xl bg-cyan-50 p-6">

                    <FaHandshake className="text-cyan-600 text-3xl mb-4" />

                    <h4 className="text-4xl font-black text-slate-900">
                      100+
                    </h4>

                    <p className="text-slate-500">
                      Projects
                    </p>

                  </div>

                  <div className="rounded-3xl bg-green-50 p-6">

                    <FaAward className="text-green-600 text-3xl mb-4" />

                    <h4 className="text-4xl font-black text-slate-900">
                      10+
                    </h4>

                    <p className="text-slate-500">
                      Services
                    </p>

                  </div>

                  <div className="rounded-3xl bg-purple-50 p-6">

                    <FaCheckCircle className="text-purple-600 text-3xl mb-4" />

                    <h4 className="text-4xl font-black text-slate-900">
                      24/7
                    </h4>

                    <p className="text-slate-500">
                      Support
                    </p>

                  </div>

                </div>

              </div>

              {/* Floating Cards */}

              <div className="absolute -top-5 -left-5 bg-white rounded-3xl px-6 py-4 shadow-xl">

                <div className="flex items-center gap-3">

                  <FaBrain className="text-blue-600 text-2xl" />

                  <div>

                    <h4 className="font-bold text-slate-900">
                      AI Solutions
                    </h4>

                    <p className="text-sm text-slate-500">
                      Smart Automation
                    </p>

                  </div>

                </div>

              </div>

              <div className="absolute top-20 -right-5 bg-white rounded-3xl px-6 py-4 shadow-xl">

                <div className="flex items-center gap-3">

                  <FaCloud className="text-cyan-600 text-2xl" />

                  <div>

                    <h4 className="font-bold text-slate-900">
                      Cloud Systems
                    </h4>

                    <p className="text-sm text-slate-500">
                      Scalable Infrastructure
                    </p>

                  </div>

                </div>

              </div>

              <div className="absolute bottom-10 -left-5 bg-white rounded-3xl px-6 py-4 shadow-xl">

                <div className="flex items-center gap-3">

                  <FaShieldAlt className="text-green-600 text-2xl" />

                  <div>

                    <h4 className="font-bold text-slate-900">
                      Cyber Security
                    </h4>

                    <p className="text-sm text-slate-500">
                      Enterprise Protection
                    </p>

                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>

      </section>

      {/* SERVICES SECTION */}

      <section className="py-24 bg-white">

        <div className="max-w-7xl mx-auto px-6 lg:px-10">

          <div className="text-center mb-16">

            <span className="inline-block px-5 py-2 rounded-full bg-blue-100 text-blue-700 font-bold">

              OUR SERVICES

            </span>

            <h2 className="mt-6 text-5xl font-black text-slate-900">

              What We Do

            </h2>

            <p className="mt-4 text-xl text-slate-600">

              Professional technology solutions designed for growth.

            </p>

          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {/* SERVICE 1 */}

            <div className="bg-slate-50 rounded-[35px] p-10 hover:-translate-y-2 transition-all duration-300 shadow-lg">

              <FaBrain className="text-5xl text-blue-600 mb-6" />

              <h3 className="text-2xl font-black text-slate-900">
                AI Solutions
              </h3>

              <p className="mt-4 text-slate-600 leading-8">

                AI automation, intelligent systems,
                chatbots and advanced business solutions.

              </p>

            </div>

            {/* SERVICE 2 */}

            <div className="bg-slate-50 rounded-[35px] p-10 hover:-translate-y-2 transition-all duration-300 shadow-lg">

              <FaLaptopCode className="text-5xl text-cyan-600 mb-6" />

              <h3 className="text-2xl font-black text-slate-900">
                Web Development
              </h3>

              <p className="mt-4 text-slate-600 leading-8">

                Modern websites, dashboards,
                enterprise portals and web apps.

              </p>

            </div>

            {/* SERVICE 3 */}

            <div className="bg-slate-50 rounded-[35px] p-10 hover:-translate-y-2 transition-all duration-300 shadow-lg">

              <FaMobileAlt className="text-5xl text-green-600 mb-6" />

              <h3 className="text-2xl font-black text-slate-900">
                Mobile Applications
              </h3>

              <p className="mt-4 text-slate-600 leading-8">

                Android and cross-platform applications
                built for performance and scalability.

              </p>

            </div>

            {/* SERVICE 4 */}

            <div className="bg-slate-50 rounded-[35px] p-10 hover:-translate-y-2 transition-all duration-300 shadow-lg">

              <FaCloud className="text-5xl text-sky-600 mb-6" />

              <h3 className="text-2xl font-black text-slate-900">
                Cloud Infrastructure
              </h3>

              <p className="mt-4 text-slate-600 leading-8">

                Secure cloud deployment,
                hosting and infrastructure management.

              </p>

            </div>

            {/* SERVICE 5 */}

            <div className="bg-slate-50 rounded-[35px] p-10 hover:-translate-y-2 transition-all duration-300 shadow-lg">

              <FaShieldAlt className="text-5xl text-emerald-600 mb-6" />

              <h3 className="text-2xl font-black text-slate-900">
                Cyber Security
              </h3>

              <p className="mt-4 text-slate-600 leading-8">

                Security audits, monitoring,
                protection and cyber defense solutions.

              </p>

            </div>

            {/* SERVICE 6 */}

            <div className="bg-slate-50 rounded-[35px] p-10 hover:-translate-y-2 transition-all duration-300 shadow-lg">

              <FaAward className="text-5xl text-purple-600 mb-6" />

              <h3 className="text-2xl font-black text-slate-900">
                Technology Consulting
              </h3>

              <p className="mt-4 text-slate-600 leading-8">

                Strategic guidance for startups,
                businesses and digital transformation.

              </p>

            </div>

          </div>

        </div>

      </section>

      {/* ABOUT FOUNDER SECTION */}

      <section className="py-24 bg-slate-50">

        <div className="max-w-7xl mx-auto px-6 lg:px-10">

          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* PHOTO SIDE */}

            <div>

              <div
                className="
                h-[500px]
                rounded-[40px]
                bg-gradient-to-br
                from-blue-600
                via-cyan-500
                to-purple-600
                shadow-[0_20px_80px_rgba(37,99,235,0.25)]
                flex
                items-center
                justify-center
                "
              >

                <div className="text-center text-white">

                  <div className="w-40 h-40 rounded-full bg-white/20 mx-auto mb-8"></div>

                  <h3 className="text-4xl font-black">
                    Aashish G. Bansod
                  </h3>

                  <p className="text-xl mt-3">
                    Founder & CEO
                  </p>

                </div>

              </div>

            </div>

            {/* CONTENT SIDE */}

            <div>

              <span className="inline-block px-5 py-2 rounded-full bg-blue-100 text-blue-700 font-bold">

                FOUNDER

              </span>

              <h2 className="mt-6 text-5xl font-black text-slate-900">

                Building The Future Through Technology

              </h2>

              <p className="mt-8 text-xl text-slate-600 leading-10">

                CyberNet Technology Systems was created with a vision
                to help businesses and individuals adopt modern
                technology and digital solutions.

              </p>

              <p className="mt-6 text-xl text-slate-600 leading-10">

                We focus on innovation, security,
                software development and AI-powered solutions
                that create real-world impact.

              </p>

              <button
                onClick={() => navigate("/about")}
                className="
                mt-10
                px-8
                py-4
                rounded-2xl
                bg-gradient-to-r
                from-blue-600
                to-cyan-500
                text-white
                font-bold
                shadow-lg
                "
              >
                About Company
              </button>

            </div>

          </div>

        </div>

      </section>
            {/* VERIFY CERTIFICATE SECTION */}

      <section className="py-24 bg-white">

        <div className="max-w-7xl mx-auto px-6 lg:px-10">

          <div
            className="
            rounded-[40px]
            bg-gradient-to-r
            from-blue-700
            via-cyan-500
            to-blue-700
            p-12
            lg:p-16
            text-center
            text-white
            shadow-[0_20px_80px_rgba(37,99,235,0.25)]
            "
          >

            <span className="inline-block px-5 py-2 rounded-full bg-white/20 backdrop-blur-md font-bold">

              CERTIFICATE VERIFICATION

            </span>

            <h2 className="mt-6 text-4xl lg:text-6xl font-black">

              Verify Certificates Instantly

            </h2>

            <p className="mt-6 text-xl text-blue-100 max-w-3xl mx-auto leading-9">

              Securely validate certificates using our
              verification portal and unique certificate IDs.

            </p>

            <button
              onClick={() => navigate("/verify")}
              className="
              mt-10
              px-10
              py-4
              rounded-2xl
              bg-white
              text-blue-700
              font-black
              shadow-xl
              hover:scale-105
              transition-all
              "
            >
              Verify Certificate
            </button>

          </div>

        </div>

      </section>

      {/* CONTACT CTA */}

      <section className="py-24 bg-slate-950 text-white">

        <div className="max-w-5xl mx-auto px-6 text-center">

          <span className="inline-block px-5 py-2 rounded-full bg-white/10 border border-white/20 font-bold">

            GET IN TOUCH

          </span>

          <h2 className="mt-8 text-5xl lg:text-7xl font-black">

            Ready To Work With Us?

          </h2>

          <p className="mt-8 text-xl text-slate-300 leading-9 max-w-3xl mx-auto">

            Let's discuss your project, technology requirements
            or digital transformation goals.

          </p>

          <div className="flex flex-wrap justify-center gap-5 mt-12">

            <button
              onClick={() => navigate("/contact")}
              className="
              px-10
              py-4
              rounded-2xl
              bg-gradient-to-r
              from-blue-600
              to-cyan-500
              text-white
              font-bold
              shadow-xl
              hover:scale-105
              transition-all
              "
            >
              Contact Us
            </button>

            <button
              onClick={() => navigate("/about")}
              className="
              px-10
              py-4
              rounded-2xl
              border
              border-white/30
              text-white
              font-bold
              hover:bg-white
              hover:text-slate-900
              transition-all
              "
            >
              Learn More
            </button>

          </div>

        </div>

      </section>

    </div>
  );
}

export default Home;