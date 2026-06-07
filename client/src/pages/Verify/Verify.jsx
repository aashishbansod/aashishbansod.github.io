import React, { useState } from "react";
import axios from "axios";
import {
  FaSearch,
  FaCheckCircle,
  FaTimesCircle,
  FaDownload,
  FaShieldAlt,
  FaCertificate,
  FaUserCheck,
  FaDatabase,
} from "react-icons/fa";

const Verify = () => {
  const [certificateId, setCertificateId] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const verifyCertificate = async () => {
    if (!certificateId.trim()) {
      alert("Please enter Certificate ID");
      return;
    }

    try {
      setLoading(true);

      const response = await axios.get(
        `http://localhost:5000/api/certificates/verify/${certificateId}`
      );

      setResult(response.data);
    } catch (error) {
      setResult("notfound");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">

      {/* HERO SECTION */}

      <section
        className="
        bg-gradient-to-r
        from-slate-900
        via-blue-900
        to-cyan-700
        text-white
        py-24
        "
      >

        <div className="max-w-7xl mx-auto px-6 text-center">

          <div
            className="
            inline-flex
            items-center
            gap-2
            px-5
            py-2
            rounded-full
            bg-white/10
            border
            border-white/20
            mb-8
            "
          >
            <FaShieldAlt />
            Secure Certificate Verification Portal
          </div>

          <h1
            className="
            text-5xl
            md:text-7xl
            font-black
            leading-tight
            "
          >
            Verify
            <span className="block text-cyan-300">
              Internship Certificates
            </span>
          </h1>

          <p
            className="
            mt-8
            text-xl
            text-slate-200
            max-w-3xl
            mx-auto
            "
          >
            Instantly verify internship certificates issued by
            CyberNet Technology Systems through our secure
            verification database.
          </p>

        </div>

      </section>

      {/* SEARCH CARD */}

      <section className="-mt-16 relative z-10">

        <div className="max-w-5xl mx-auto px-6">

          <div
            className="
            bg-white
            rounded-[32px]
            shadow-2xl
            border
            p-10
            "
          >

            <h2
              className="
              text-4xl
              font-black
              text-center
              text-slate-900
              "
            >
              Certificate Verification
            </h2>

            <p
              className="
              text-center
              text-slate-500
              mt-3
              "
            >
              Enter your Certificate ID below
            </p>

            <div className="mt-10 flex flex-col md:flex-row gap-4">

              <div className="relative flex-1">

                <FaSearch
                  className="
                  absolute
                  left-5
                  top-1/2
                  -translate-y-1/2
                  text-slate-400
                  text-lg
                  "
                />

                <input
                  type="text"
                  value={certificateId}
                  onChange={(e) =>
                    setCertificateId(e.target.value)
                  }
                  placeholder="Enter Certificate ID"
                  className="
                  w-full
                  h-16
                  pl-14
                  pr-4
                  border-2
                  rounded-2xl
                  outline-none
                  focus:border-blue-500
                  text-lg
                  "
                />

              </div>

              <button
                onClick={verifyCertificate}
                disabled={loading}
                className="
                h-16
                px-10
                rounded-2xl
                bg-blue-600
                hover:bg-blue-700
                text-white
                font-bold
                text-lg
                shadow-lg
                transition-all
                "
              >
                {loading
                  ? "Verifying..."
                  : "Verify Certificate"}
              </button>

            </div>

            {/* TRUST BADGES */}

            <div
              className="
              grid
              md:grid-cols-4
              gap-4
              mt-10
              "
            >

              <div className="bg-slate-50 rounded-2xl p-5 text-center">

                <FaCertificate className="mx-auto text-3xl text-blue-600 mb-3" />

                <h4 className="font-bold">
                  Official Records
                </h4>

              </div>

              <div className="bg-slate-50 rounded-2xl p-5 text-center">

                <FaShieldAlt className="mx-auto text-3xl text-green-600 mb-3" />

                <h4 className="font-bold">
                  Secure Database
                </h4>

              </div>

              <div className="bg-slate-50 rounded-2xl p-5 text-center">

                <FaUserCheck className="mx-auto text-3xl text-purple-600 mb-3" />

                <h4 className="font-bold">
                  Instant Verification
                </h4>

              </div>

              <div className="bg-slate-50 rounded-2xl p-5 text-center">

                <FaDatabase className="mx-auto text-3xl text-cyan-600 mb-3" />

                <h4 className="font-bold">
                  Trusted System
                </h4>

              </div>

            </div>

          </div>

        </div>

      </section>
            {/* VERIFIED RESULT */}

      {result && result !== "notfound" && (

        <section className="py-20">

          <div className="max-w-6xl mx-auto px-6">

            <div
              className="
              bg-white
              rounded-[32px]
              shadow-xl
              overflow-hidden
              border
              "
            >

              {/* TOP STATUS */}

              <div
                className="
                bg-gradient-to-r
                from-green-600
                to-emerald-500
                p-8
                text-white
                "
              >

                <div className="flex items-center gap-4">

                  <FaCheckCircle className="text-5xl" />

                  <div>

                    <h2 className="text-4xl font-black">
                      Certificate Verified
                    </h2>

                    <p className="text-green-100 mt-2">
                      This certificate is officially issued
                      and verified by CyberNet Technology Systems.
                    </p>

                  </div>

                </div>

              </div>

              {/* CONTENT */}

              <div className="p-10">

                {/* STUDENT PROFILE */}

                <div
                  className="
                  bg-slate-50
                  border
                  rounded-3xl
                  p-8
                  mb-8
                  "
                >

                  <div className="flex items-center gap-5">

                    <div
                      className="
                      w-20
                      h-20
                      rounded-full
                      bg-blue-100
                      flex
                      items-center
                      justify-center
                      text-blue-600
                      text-3xl
                      "
                    >
                      👨‍🎓
                    </div>

                    <div>

                      <h3 className="text-3xl font-black text-slate-900">
                        {result.studentName}
                      </h3>

                      <p className="text-slate-500 mt-1">
                        Verified Internship Candidate
                      </p>

                    </div>

                  </div>

                </div>

                {/* DETAILS GRID */}

                <div className="grid lg:grid-cols-2 gap-6">

                  <div className="border rounded-3xl p-8">

                    <h3 className="text-2xl font-bold mb-6">
                      Student Information
                    </h3>

                    <div className="space-y-5">

                      <div>
                        <p className="text-slate-500">
                          Student Name
                        </p>

                        <h4 className="font-bold text-lg">
                          {result.studentName}
                        </h4>
                      </div>

                      <div>
                        <p className="text-slate-500">
                          Certificate ID
                        </p>

                        <h4 className="font-bold text-lg">
                          {result.certificateId}
                        </h4>
                      </div>

                      <div>
                        <p className="text-slate-500">
                          Verification Status
                        </p>

                        <span
                          className="
                          inline-flex
                          px-4
                          py-2
                          rounded-full
                          bg-green-100
                          text-green-700
                          font-bold
                          "
                        >
                          VERIFIED
                        </span>
                      </div>

                    </div>

                  </div>

                  <div className="border rounded-3xl p-8">

                    <h3 className="text-2xl font-bold mb-6">
                      Internship Details
                    </h3>

                    <div className="space-y-5">

                      <div>
                        <p className="text-slate-500">
                          Internship Program
                        </p>

                        <h4 className="font-bold text-lg">
                          {result.internship}
                        </h4>
                      </div>

                      <div>
                        <p className="text-slate-500">
                          Duration
                        </p>

                        <h4 className="font-bold text-lg">
                          {result.duration}
                        </h4>
                      </div>

                      <div>
                        <p className="text-slate-500">
                          Issue Date
                        </p>

                        <h4 className="font-bold text-lg">
                          {result.issueDate}
                        </h4>
                      </div>

                    </div>

                  </div>

                </div>

                {/* PERFORMANCE */}

                <div className="grid md:grid-cols-3 gap-6 mt-8">

                  <div
                    className="
                    bg-blue-50
                    rounded-3xl
                    p-8
                    text-center
                    "
                  >

                    <h3 className="text-5xl font-black text-blue-600">
                      {result.score}%
                    </h3>

                    <p className="text-slate-600 mt-3">
                      Assessment Score
                    </p>

                  </div>

                  <div
                    className="
                    bg-green-50
                    rounded-3xl
                    p-8
                    text-center
                    "
                  >

                    <h3 className="text-5xl font-black text-green-600">
                      ✓
                    </h3>

                    <p className="text-slate-600 mt-3">
                      Successfully Completed
                    </p>

                  </div>

                  <div
                    className="
                    bg-purple-50
                    rounded-3xl
                    p-8
                    text-center
                    "
                  >

                    <h3 className="text-5xl font-black text-purple-600">
                      A+
                    </h3>

                    <p className="text-slate-600 mt-3">
                      Performance Grade
                    </p>

                  </div>

                </div>

                {/* ACTION BUTTON */}

                <div className="mt-10 flex justify-center">

                  <a
                    href={result.certificateUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="
                    inline-flex
                    items-center
                    gap-3
                    px-8
                    py-4
                    rounded-2xl
                    bg-blue-600
                    hover:bg-blue-700
                    text-white
                    font-bold
                    shadow-lg
                    transition-all
                    "
                  >
                    <FaDownload />

                    Download Certificate
                  </a>

                </div>

              </div>

            </div>

          </div>

        </section>

      )}
            {/* CERTIFICATE NOT FOUND */}

      {result === "notfound" && (

        <section className="py-20">

          <div className="max-w-4xl mx-auto px-6">

            <div
              className="
              bg-white
              rounded-[32px]
              shadow-xl
              overflow-hidden
              border
              "
            >

              {/* TOP ERROR BAR */}

              <div
                className="
                bg-gradient-to-r
                from-red-600
                to-red-500
                text-white
                p-8
                "
              >

                <div className="flex items-center gap-4">

                  <FaTimesCircle className="text-5xl" />

                  <div>

                    <h2 className="text-4xl font-black">
                      Certificate Not Found
                    </h2>

                    <p className="text-red-100 mt-2">
                      No matching certificate record was found
                      in our verification database.
                    </p>

                  </div>

                </div>

              </div>

              {/* CONTENT */}

              <div className="p-12 text-center">

                <div
                  className="
                  w-32
                  h-32
                  mx-auto
                  rounded-full
                  bg-red-100
                  flex
                  items-center
                  justify-center
                  text-red-600
                  text-6xl
                  "
                >
                  <FaTimesCircle />
                </div>

                <h3
                  className="
                  mt-8
                  text-4xl
                  font-black
                  text-slate-900
                  "
                >
                  Verification Failed
                </h3>

                <p
                  className="
                  mt-5
                  text-lg
                  text-slate-600
                  max-w-2xl
                  mx-auto
                  leading-8
                  "
                >
                  The Certificate ID entered does not exist,
                  may be invalid, or has not yet been issued
                  by CyberNet Technology Systems.
                </p>

                {/* WARNING BOX */}

                <div
                  className="
                  mt-8
                  bg-red-50
                  border
                  border-red-200
                  rounded-2xl
                  p-6
                  max-w-2xl
                  mx-auto
                  "
                >

                  <h4 className="font-bold text-red-700 text-lg">
                    Possible Reasons
                  </h4>

                  <ul
                    className="
                    mt-4
                    text-slate-600
                    text-left
                    space-y-2
                    "
                  >
                    <li>• Certificate ID entered incorrectly</li>
                    <li>• Certificate has not been issued yet</li>
                    <li>• Invalid or fake certificate ID</li>
                    <li>• Record unavailable in database</li>
                  </ul>

                </div>

                {/* ACTION BUTTONS */}

                <div
                  className="
                  mt-10
                  flex
                  flex-col
                  md:flex-row
                  gap-4
                  justify-center
                  "
                >

                  <button
                    onClick={() => {
                      setCertificateId("");
                      setResult(null);
                    }}
                    className="
                    px-8
                    py-4
                    rounded-2xl
                    bg-blue-600
                    hover:bg-blue-700
                    text-white
                    font-bold
                    transition-all
                    "
                  >
                    Try Again
                  </button>

                  <button
                    onClick={() =>
                      window.location.href = "/contact"
                    }
                    className="
                    px-8
                    py-4
                    rounded-2xl
                    border-2
                    border-slate-300
                    hover:bg-slate-100
                    font-bold
                    text-slate-700
                    transition-all
                    "
                  >
                    Contact Support
                  </button>

                </div>

              </div>

            </div>

          </div>

        </section>

      )}

    </div>
  );
};

export default Verify;