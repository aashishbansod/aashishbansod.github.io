import React from "react";
import { Link } from "react-router-dom";

import {
  FaBuilding,
  FaUserTie,
  FaRocket,
  FaBullseye,
  FaBrain,
  FaLaptopCode,
  FaShieldAlt,
  FaCloud,
  FaCheckCircle,
} from "react-icons/fa";

const About = () => {
  return (
    <div className="min-h-screen bg-slate-50 overflow-hidden">

      {/* HERO SECTION */}

      <section
        className="
        relative
        overflow-hidden
        bg-gradient-to-br
        from-slate-950
        via-blue-950
        to-cyan-900
        py-32
        "
      >

        {/* Background Blur */}

        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-cyan-500/20 blur-[140px]" />

        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-600/20 blur-[140px]" />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-10 text-center text-white">

          <div
            className="
            inline-flex
            items-center
            gap-3
            px-6
            py-3
            rounded-full
            bg-white/10
            backdrop-blur-md
            border
            border-white/10
            "
          >

            <FaBuilding />

            <span className="font-medium">
              About CyberNet Technology Systems
            </span>

          </div>

          <h1
            className="
            mt-10
            text-6xl
            lg:text-8xl
            font-black
            leading-tight
            "
          >
            Building Technology

            <span
              className="
              block
              bg-gradient-to-r
              from-cyan-400
              via-blue-400
              to-cyan-300
              bg-clip-text
              text-transparent
              "
            >
              For The Future
            </span>

          </h1>

          <p
            className="
            mt-10
            text-xl
            text-slate-300
            max-w-4xl
            mx-auto
            leading-10
            "
          >

            CyberNet Technology Systems delivers
            AI Solutions, Software Development,
            Internship Programs, Cloud Technologies,
            Cyber Security and Digital Transformation
            services for students, startups and businesses.

          </p>

          <div
            className="
            mt-14
            flex
            flex-wrap
            justify-center
            gap-5
            "
          >

            <Link
              to="/contact"
              className="
              px-10
              py-4
              rounded-2xl
              bg-gradient-to-r
              from-blue-600
              to-cyan-500
              font-bold
              shadow-xl
              "
            >
              Contact Team
            </Link>

            <Link
              to="/verify"
              className="
              px-10
              py-4
              rounded-2xl
              border
              border-white/20
              bg-white/5
              backdrop-blur-md
              font-bold
              "
            >
              Verify Certificate
            </Link>

          </div>

        </div>

      </section>

      {/* FOUNDER SECTION */}

      <section className="py-28 bg-white">

        <div className="max-w-7xl mx-auto px-6 lg:px-10">

          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Founder Image */}
                        <div className="flex justify-center">

              {/* CEO PHOTO */}

              <div
                className="
                w-full
                max-w-[500px]
                h-[550px]
                rounded-[40px]
                overflow-hidden
                shadow-[0_20px_80px_rgba(0,0,0,0.15)]
                bg-gradient-to-br
                from-blue-600
                via-cyan-500
                to-purple-600
                flex
                items-center
                justify-center
                "
              >

                {/* Replace with your real image */}

                <div className="text-center text-white">

                  <FaUserTie className="text-8xl mx-auto mb-8" />

                  <h3 className="text-4xl font-black">
                    CEO
                  </h3>

                  <p className="mt-3 text-xl">
                    CyberNet Technology Systems
                  </p>

                </div>

              </div>

            </div>

            {/* Founder Content */}

            <div>

              <span
                className="
                inline-block
                px-5
                py-2
                rounded-full
                bg-blue-100
                text-blue-700
                font-bold
                "
              >
                FOUNDER & CEO
              </span>

              <h2
                className="
                mt-6
                text-5xl
                lg:text-6xl
                font-black
                text-slate-900
                "
              >
                Ashish Bansod
              </h2>

              <p
                className="
                mt-4
                text-cyan-600
                text-2xl
                font-bold
                "
              >
                Founder & Chief Executive Officer
              </p>

              <p
                className="
                mt-8
                text-lg
                text-slate-600
                leading-9
                "
              >

                CyberNet Technology Systems was founded
                with a vision to create practical technology
                solutions and career opportunities for students,
                startups and businesses.

              </p>

              <p
                className="
                mt-6
                text-lg
                text-slate-600
                leading-9
                "
              >

                The company focuses on software development,
                AI systems, cloud technologies, cyber security
                and digital innovation while helping learners
                gain real-world experience.

              </p>

              <div className="grid grid-cols-2 gap-5 mt-10">

                <div className="bg-slate-50 rounded-3xl p-6">

                  <h4 className="text-4xl font-black text-blue-600">
                    500+
                  </h4>

                  <p className="mt-2 text-slate-600">
                    Projects Delivered
                  </p>

                </div>

                <div className="bg-slate-50 rounded-3xl p-6">

                  <h4 className="text-4xl font-black text-cyan-600">
                    2500+
                  </h4>

                  <p className="mt-2 text-slate-600">
                    Students Connected
                  </p>

                </div>

              </div>

            </div>

          </div>

        </div>

      </section>

      {/* MISSION & VISION */}

      <section className="py-28 bg-slate-50">

        <div className="max-w-7xl mx-auto px-6 lg:px-10">

          <div className="grid lg:grid-cols-2 gap-10">

            {/* Mission */}

            <div
              className="
              bg-white
              rounded-[40px]
              p-10
              shadow-xl
              "
            >

              <div className="text-blue-600 text-5xl mb-6">
                <FaBullseye />
              </div>

              <h3 className="text-4xl font-black text-slate-900">
                Our Mission
              </h3>

              <p
                className="
                mt-6
                text-lg
                text-slate-600
                leading-9
                "
              >

                To empower students, startups and
                businesses through modern technology,
                innovation and practical learning.

              </p>

            </div>

            {/* Vision */}

            <div
              className="
              bg-white
              rounded-[40px]
              p-10
              shadow-xl
              "
            >

              <div className="text-cyan-600 text-5xl mb-6">
                <FaRocket />
              </div>

              <h3 className="text-4xl font-black text-slate-900">
                Our Vision
              </h3>

              <p
                className="
                mt-6
                text-lg
                text-slate-600
                leading-9
                "
              >

                To become a trusted global technology
                company delivering innovative digital
                solutions and career transformation.

              </p>

            </div>

          </div>

        </div>

      </section>

      {/* SERVICES SECTION */}

      <section className="py-28 bg-white">

        <div className="max-w-7xl mx-auto px-6 lg:px-10">

          <div className="text-center mb-20">

            <span
              className="
              px-5
              py-2
              rounded-full
              bg-blue-100
              text-blue-700
              font-bold
              "
            >
              OUR SERVICES
            </span>

            <h2 className="mt-6 text-6xl font-black text-slate-900">
              Technology Solutions
            </h2>

          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-8">
                        {/* AI Solutions */}

            <div
              className="
              bg-slate-50
              rounded-[35px]
              p-8
              shadow-lg
              hover:-translate-y-2
              transition-all
              duration-300
              "
            >

              <div className="text-5xl text-blue-600 mb-6">
                <FaBrain />
              </div>

              <h3 className="text-2xl font-black text-slate-900">
                AI Solutions
              </h3>

              <p className="mt-4 text-slate-600 leading-8">
                Intelligent automation, AI powered systems
                and smart digital solutions for businesses.
              </p>

            </div>

            {/* Software Development */}

            <div
              className="
              bg-slate-50
              rounded-[35px]
              p-8
              shadow-lg
              hover:-translate-y-2
              transition-all
              duration-300
              "
            >

              <div className="text-5xl text-cyan-600 mb-6">
                <FaLaptopCode />
              </div>

              <h3 className="text-2xl font-black text-slate-900">
                Software Development
              </h3>

              <p className="mt-4 text-slate-600 leading-8">
                Modern web applications, enterprise systems
                and custom software development services.
              </p>

            </div>

            {/* Cyber Security */}

            <div
              className="
              bg-slate-50
              rounded-[35px]
              p-8
              shadow-lg
              hover:-translate-y-2
              transition-all
              duration-300
              "
            >

              <div className="text-5xl text-green-600 mb-6">
                <FaShieldAlt />
              </div>

              <h3 className="text-2xl font-black text-slate-900">
                Cyber Security
              </h3>

              <p className="mt-4 text-slate-600 leading-8">
                Security focused infrastructure, monitoring
                and digital protection solutions.
              </p>

            </div>

            {/* Cloud Services */}

            <div
              className="
              bg-slate-50
              rounded-[35px]
              p-8
              shadow-lg
              hover:-translate-y-2
              transition-all
              duration-300
              "
            >

              <div className="text-5xl text-purple-600 mb-6">
                <FaCloud />
              </div>

              <h3 className="text-2xl font-black text-slate-900">
                Cloud Infrastructure
              </h3>

              <p className="mt-4 text-slate-600 leading-8">
                Scalable cloud deployment, hosting,
                infrastructure and management services.
              </p>

            </div>

          </div>

        </div>

      </section>

      {/* WHY CHOOSE US */}

      <section className="py-28 bg-slate-50">

        <div className="max-w-7xl mx-auto px-6 lg:px-10">

          <div className="text-center mb-20">

            <span
              className="
              px-5
              py-2
              rounded-full
              bg-cyan-100
              text-cyan-700
              font-bold
              "
            >
              WHY CHOOSE US
            </span>

            <h2 className="mt-6 text-6xl font-black text-slate-900">
              Why CyberNet?
            </h2>

          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">

            <div className="bg-white rounded-[30px] p-8 shadow-lg">
              <FaCheckCircle className="text-green-500 text-3xl mb-5" />
              <h3 className="text-xl font-black">
                Professional Technology Team
              </h3>
            </div>

            <div className="bg-white rounded-[30px] p-8 shadow-lg">
              <FaCheckCircle className="text-green-500 text-3xl mb-5" />
              <h3 className="text-xl font-black">
                AI Powered Solutions
              </h3>
            </div>

            <div className="bg-white rounded-[30px] p-8 shadow-lg">
              <FaCheckCircle className="text-green-500 text-3xl mb-5" />
              <h3 className="text-xl font-black">
                Secure Infrastructure
              </h3>
            </div>

            <div className="bg-white rounded-[30px] p-8 shadow-lg">
              <FaCheckCircle className="text-green-500 text-3xl mb-5" />
              <h3 className="text-xl font-black">
                Industry Experience
              </h3>
            </div>

            <div className="bg-white rounded-[30px] p-8 shadow-lg">
              <FaCheckCircle className="text-green-500 text-3xl mb-5" />
              <h3 className="text-xl font-black">
                Verified Services
              </h3>
            </div>

            <div className="bg-white rounded-[30px] p-8 shadow-lg">
              <FaCheckCircle className="text-green-500 text-3xl mb-5" />
              <h3 className="text-xl font-black">
                Long Term Support
              </h3>
            </div>

          </div>

        </div>

      </section>

      {/* COMPANY STATS */}

      <section className="py-28 bg-gradient-to-r from-blue-700 via-cyan-600 to-blue-700 text-white">

        <div className="max-w-7xl mx-auto px-6 lg:px-10">

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-10 text-center">
                        <div>

              <h3 className="text-6xl font-black">
                500+
              </h3>

              <p className="mt-3 text-xl text-blue-100">
                Projects Delivered
              </p>

            </div>

            <div>

              <h3 className="text-6xl font-black">
                2500+
              </h3>

              <p className="mt-3 text-xl text-blue-100">
                Students Connected
              </p>

            </div>

            <div>

              <h3 className="text-6xl font-black">
                100+
              </h3>

              <p className="mt-3 text-xl text-blue-100">
                Internship Programs
              </p>

            </div>

            <div>

              <h3 className="text-6xl font-black">
                24/7
              </h3>

              <p className="mt-3 text-xl text-blue-100">
                Support Available
              </p>

            </div>

          </div>

        </div>

      </section>

      {/* CONTACT CTA */}

      <section className="py-28 bg-slate-950 text-white">

        <div className="max-w-6xl mx-auto px-6 lg:px-10 text-center">

          <span
            className="
            inline-block
            px-5
            py-2
            rounded-full
            bg-white/10
            border
            border-white/20
            font-bold
            "
          >
            LET'S WORK TOGETHER
          </span>

          <h2
            className="
            mt-8
            text-5xl
            lg:text-7xl
            font-black
            "
          >
            Ready To Build
            <span className="block text-cyan-400">
              Something Amazing?
            </span>
          </h2>

          <p
            className="
            mt-8
            text-xl
            text-slate-300
            max-w-3xl
            mx-auto
            leading-9
            "
          >
            Whether you're a student, startup or business,
            CyberNet Technology Systems is ready to help
            you with innovative technology solutions.
          </p>

          <div
            className="
            mt-12
            flex
            flex-wrap
            justify-center
            gap-5
            "
          >

            <Link
              to="/contact"
              className="
              px-10
              py-4
              rounded-2xl
              bg-gradient-to-r
              from-blue-600
              to-cyan-500
              font-bold
              shadow-xl
              hover:scale-105
              transition-all
              "
            >
              Contact Us
            </Link>

            <Link
              to="/verify"
              className="
              px-10
              py-4
              rounded-2xl
              border
              border-white/20
              bg-white/5
              backdrop-blur-md
              font-bold
              "
            >
              Verify Certificate
            </Link>

          </div>

        </div>

      </section>

    </div>
  );
};

export default About;