import React, { useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";

import {
  FaPhoneAlt,
  FaEnvelope,
  FaPaperPlane,
  FaWhatsapp,
  FaMapMarkerAlt,
  FaHeadset,
  FaClock,
  FaShieldAlt,
} from "react-icons/fa";

const Contact = () => {

  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {

      setLoading(true);

      await axios.post(
        "http://localhost:5000/api/contact/send",
        formData
      );

      toast.success("Message Sent Successfully");

      setFormData({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
      });

    } catch (error) {

      toast.error(
        error?.response?.data?.message ||
        "Failed To Send Message"
      );

    } finally {

      setLoading(false);

    }
  };

  return (

    <div className="min-h-screen bg-slate-50">

      {/* HERO SECTION */}

      <section
        className="
        relative
        overflow-hidden
        bg-gradient-to-r
        from-slate-950
        via-blue-950
        to-cyan-900
        text-white
        "
      >

        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500 rounded-full blur-[120px]" />
          <div className="absolute bottom-10 right-10 w-80 h-80 bg-cyan-400 rounded-full blur-[140px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-28">

          <div className="text-center">

            <span
              className="
              inline-flex
              items-center
              gap-2
              px-5
              py-2
              rounded-full
              bg-white/10
              backdrop-blur-xl
              border
              border-white/20
              text-sm
              font-semibold
              "
            >
              <FaHeadset />
              CyberNet Support Center
            </span>

            <h1
              className="
              mt-8
              text-5xl
              md:text-7xl
              font-black
              leading-tight
              "
            >
              Contact
              <span className="text-cyan-400">
                {" "}CyberNet
              </span>
            </h1>

            <p
              className="
              mt-6
              max-w-3xl
              mx-auto
              text-lg
              text-slate-300
              leading-8
              "
            >
              Get support for internships, assessments,
              certificates, technical assistance,
              project guidance and career development.
            </p>

          </div>

        </div>

      </section>

      {/* CONTACT CARDS */}

      <section className="-mt-14 relative z-10">

        <div className="max-w-7xl mx-auto px-6">

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
                        {/* PHONE */}

            <div
              className="
              bg-white
              rounded-3xl
              p-8
              shadow-lg
              border
              border-slate-200
              hover:-translate-y-2
              hover:shadow-2xl
              transition-all
              duration-300
              "
            >

              <div
                className="
                w-16
                h-16
                rounded-2xl
                bg-blue-100
                text-blue-600
                flex
                items-center
                justify-center
                text-2xl
                "
              >
                <FaPhoneAlt />
              </div>

              <h3 className="mt-6 text-2xl font-bold">
                Phone Support
              </h3>

              <p className="mt-3 text-slate-600">
                +91 8010612993
              </p>

            </div>

            {/* EMAIL */}

            <div
              className="
              bg-white
              rounded-3xl
              p-8
              shadow-lg
              border
              border-slate-200
              hover:-translate-y-2
              hover:shadow-2xl
              transition-all
              duration-300
              "
            >

              <div
                className="
                w-16
                h-16
                rounded-2xl
                bg-cyan-100
                text-cyan-600
                flex
                items-center
                justify-center
                text-2xl
                "
              >
                <FaEnvelope />
              </div>

              <h3 className="mt-6 text-2xl font-bold">
                Email Support
              </h3>

              <p className="mt-3 text-slate-600">
                cybernet.tech.india@gmail.com
              </p>

            </div>

            {/* WHATSAPP */}

            <div
              className="
              bg-white
              rounded-3xl
              p-8
              shadow-lg
              border
              border-slate-200
              hover:-translate-y-2
              hover:shadow-2xl
              transition-all
              duration-300
              "
            >

              <div
                className="
                w-16
                h-16
                rounded-2xl
                bg-green-100
                text-green-600
                flex
                items-center
                justify-center
                text-2xl
                "
              >
                <FaWhatsapp />
              </div>

              <h3 className="mt-6 text-2xl font-bold">
                WhatsApp
              </h3>

              <p className="mt-3 text-slate-600">
                Instant Support Available
              </p>

            </div>

            {/* LOCATION */}

            <div
              className="
              bg-white
              rounded-3xl
              p-8
              shadow-lg
              border
              border-slate-200
              hover:-translate-y-2
              hover:shadow-2xl
              transition-all
              duration-300
              "
            >

              <div
                className="
                w-16
                h-16
                rounded-2xl
                bg-orange-100
                text-orange-600
                flex
                items-center
                justify-center
                text-2xl
                "
              >
                <FaMapMarkerAlt />
              </div>

              <h3 className="mt-6 text-2xl font-bold">
                Location
              </h3>

              <p className="mt-3 text-slate-600">
                Amravati, Maharashtra, India
              </p>

            </div>

          </div>

        </div>

      </section>

      {/* MAIN CONTACT SECTION */}

      <section className="py-24">

        <div className="max-w-7xl mx-auto px-6">

          <div className="grid lg:grid-cols-2 gap-12">

            {/* LEFT SIDE */}

            <div>

              <span
                className="
                inline-block
                px-4
                py-2
                rounded-full
                bg-blue-100
                text-blue-700
                font-semibold
                text-sm
                "
              >
                Contact CyberNet
              </span>

              <h2
                className="
                mt-6
                text-5xl
                font-black
                leading-tight
                text-slate-900
                "
              >
                Let's Build Your
                <span className="text-blue-600">
                  {" "}Career Together
                </span>
              </h2>

              <p
                className="
                mt-6
                text-lg
                text-slate-600
                leading-8
                "
              >
                Whether you need internship support,
                certificate assistance, project guidance,
                scholarship help or technical support,
                our team is ready to assist you.
              </p>
                            {/* SUPPORT BOXES */}

              <div className="mt-10 space-y-5">

                <div
                  className="
                  bg-white
                  border
                  border-slate-200
                  rounded-3xl
                  p-6
                  shadow-sm
                  "
                >

                  <div className="flex items-start gap-4">

                    <div
                      className="
                      w-14
                      h-14
                      rounded-2xl
                      bg-blue-100
                      text-blue-600
                      flex
                      items-center
                      justify-center
                      text-xl
                      "
                    >
                      <FaHeadset />
                    </div>

                    <div>

                      <h3 className="text-xl font-bold">
                        Internship Support
                      </h3>

                      <p className="text-slate-600 mt-2 leading-7">
                        Guidance regarding internship programs,
                        enrollment process, assessments and
                        project submissions.
                      </p>

                    </div>

                  </div>

                </div>

                <div
                  className="
                  bg-white
                  border
                  border-slate-200
                  rounded-3xl
                  p-6
                  shadow-sm
                  "
                >

                  <div className="flex items-start gap-4">

                    <div
                      className="
                      w-14
                      h-14
                      rounded-2xl
                      bg-green-100
                      text-green-600
                      flex
                      items-center
                      justify-center
                      text-xl
                      "
                    >
                      <FaShieldAlt />
                    </div>

                    <div>

                      <h3 className="text-xl font-bold">
                        Certificate Verification
                      </h3>

                      <p className="text-slate-600 mt-2 leading-7">
                        Assistance regarding certificate
                        verification, authenticity and
                        digital credential support.
                      </p>

                    </div>

                  </div>

                </div>

                <div
                  className="
                  bg-white
                  border
                  border-slate-200
                  rounded-3xl
                  p-6
                  shadow-sm
                  "
                >

                  <div className="flex items-start gap-4">

                    <div
                      className="
                      w-14
                      h-14
                      rounded-2xl
                      bg-orange-100
                      text-orange-600
                      flex
                      items-center
                      justify-center
                      text-xl
                      "
                    >
                      <FaClock />
                    </div>

                    <div>

                      <h3 className="text-xl font-bold">
                        Fast Response Time
                      </h3>

                      <p className="text-slate-600 mt-2 leading-7">
                        Our support team responds quickly
                        to help students and professionals
                        resolve issues efficiently.
                      </p>

                    </div>

                  </div>

                </div>

              </div>

            </div>

            {/* RIGHT SIDE FORM */}

            <div
              className="
              bg-white
              rounded-[32px]
              shadow-xl
              border
              border-slate-200
              p-8
              "
            >

              <h3 className="text-4xl font-black text-slate-900">
                Send Message
              </h3>

              <p className="mt-3 text-slate-600">
                Fill out the form and our team will
                contact you shortly.
              </p>

              <form
                onSubmit={handleSubmit}
                className="mt-8 space-y-5"
              >

                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Full Name"
                  required
                  className="
                  w-full
                  h-14
                  px-5
                  rounded-2xl
                  border
                  border-slate-300
                  outline-none
                  focus:border-blue-500
                  "
                />

                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email Address"
                  required
                  className="
                  w-full
                  h-14
                  px-5
                  rounded-2xl
                  border
                  border-slate-300
                  outline-none
                  focus:border-blue-500
                  "
                />

                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Phone Number"
                  className="
                  w-full
                  h-14
                  px-5
                  rounded-2xl
                  border
                  border-slate-300
                  outline-none
                  focus:border-blue-500
                  "
                />

                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="Subject"
                  required
                  className="
                  w-full
                  h-14
                  px-5
                  rounded-2xl
                  border
                  border-slate-300
                  outline-none
                  focus:border-blue-500
                  "
                />
                                <textarea
                  rows="6"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Write your message..."
                  required
                  className="
                  w-full
                  p-5
                  rounded-2xl
                  border
                  border-slate-300
                  outline-none
                  resize-none
                  focus:border-blue-500
                  "
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="
                  w-full
                  h-14
                  rounded-2xl
                  bg-gradient-to-r
                  from-blue-600
                  to-cyan-500
                  text-white
                  font-bold
                  flex
                  items-center
                  justify-center
                  gap-3
                  shadow-lg
                  hover:scale-[1.02]
                  transition-all
                  duration-300
                  "
                >
                  <FaPaperPlane />

                  {loading
                    ? "Sending Message..."
                    : "Send Support Request"}
                </button>

              </form>

            </div>

          </div>

        </div>

      </section>

      {/* BOTTOM CTA */}

      <section className="pb-24">

        <div className="max-w-6xl mx-auto px-6">

          <div
            className="
            rounded-[40px]
            bg-gradient-to-r
            from-blue-600
            via-cyan-500
            to-blue-700
            p-12
            md:p-16
            text-center
            text-white
            shadow-[0_20px_80px_rgba(37,99,235,0.25)]
            "
          >

            <h2 className="text-4xl md:text-5xl font-black">
              Need Immediate Assistance?
            </h2>

            <p className="mt-5 text-lg text-blue-100 max-w-2xl mx-auto">
              Our support team is available to help with
              internships, certificates, assessments,
              technical issues and career guidance.
            </p>

            <div
              className="
              mt-10
              flex
              flex-wrap
              justify-center
              gap-4
              "
            >

              <a
                href="https://wa.me/918010612993"
                target="_blank"
                rel="noopener noreferrer"
                className="
                px-8
                py-4
                rounded-2xl
                bg-white
                text-green-600
                font-bold
                flex
                items-center
                gap-3
                shadow-lg
                hover:scale-105
                transition-all
                "
              >
                <FaWhatsapp />
                WhatsApp Support
              </a>

              <a
                href="mailto:cybernet.tech.india@gmail.com"
                className="
                px-8
                py-4
                rounded-2xl
                border
                border-white/30
                bg-white/10
                backdrop-blur-md
                text-white
                font-bold
                flex
                items-center
                gap-3
                hover:bg-white/20
                transition-all
                "
              >
                <FaEnvelope />
                Email Support
              </a>

            </div>

          </div>

        </div>

      </section>

    </div>

  );
};

export default Contact;