import React,{
  useEffect,
  useState,
  useRef
} from "react";

import axios from "axios";

import html2canvas from "html2canvas";

import jsPDF from "jspdf";

import {
  FaCheckCircle,
  FaDownload,
  FaShieldAlt
} from "react-icons/fa";

import logo from "../assets/logo.png";

import "../styles/certificate.css";

function Certificate(){

  const [certificate,
    setCertificate] =
    useState(null);

  const [loading,
    setLoading] =
    useState(true);

  const certificateRef =
    useRef();

  useEffect(()=>{

    fetchCertificate();

  },[]);

  /* FETCH CERTIFICATE */

  const fetchCertificate =
  async()=>{

    try{

      const response =
      await axios.get(
        "http://localhost:5000/api/certificates"
      );

      const latestCertificate =
      response.data.certificates[
        response.data.certificates.length - 1
      ];

      setCertificate(
        latestCertificate
      );

      setLoading(false);

    }

    catch(error){

      console.log(error);

      setLoading(false);

    }

  };

  /* DOWNLOAD PDF */

  const downloadCertificate =
  async()=>{

    const input =
    certificateRef.current;

    const button =
    document.querySelector(
      ".download-btn"
    );

    button.style.display =
    "none";

    const canvas =
    await html2canvas(input,{

      scale:4,

      useCORS:true,

      backgroundColor:"#ffffff"

    });

    const imgData =
    canvas.toDataURL(
      "image/png"
    );

    const pdf =
    new jsPDF({

      orientation:"landscape",

      unit:"px",

      format:[1400,900]

    });

    pdf.addImage(

      imgData,

      "PNG",

      0,

      0,

      1400,

      900

    );

    pdf.save(
      `CyberNet-${certificate.studentName}.pdf`
    );

    button.style.display =
    "flex";

  };

  /* LOADING */

  if(loading){

    return(

      <div className="certificate-loading">

        <h1>
          Loading Certificate...
        </h1>

      </div>

    );

  }

  /* NO CERTIFICATE */

  if(!certificate){

    return(

      <div className="certificate-loading">

        <h1>
          No Certificate Found
        </h1>

      </div>

    );

  }

  return(

    <div className="certificate-page">

      <div
        className="certificate-box"
        ref={certificateRef}
      >

        {/* HEADER */}

        <div className="certificate-header">

          {/* LOGO */}

          <div className="logo-section">

            <img
              src={logo}
              alt="CyberNet Logo"
              className="certificate-logo"
            />

          </div>

          {/* RIGHT INFO */}

          <div className="certificate-top-right">

            <div className="top-info">

              <span>
                Certificate ID
              </span>

              <h4>
                {certificate.certificateId}
              </h4>

            </div>

            <div className="top-info">

              <span>
                Issue Date
              </span>

              <h4>

                {
                  new Date(
                    certificate.issuedAt
                  ).toLocaleDateString()
                }

              </h4>

            </div>

          </div>

        </div>

        {/* MAIN */}

        <div className="certificate-content">

          <p className="small-text">
            OFFICIAL CERTIFICATION
          </p>

          <h1 className="certificate-title">
            CERTIFICATE
          </h1>

          <h2 className="certificate-subtitle">
            OF ACHIEVEMENT
          </h2>

          <div className="verify-badge">

            <FaShieldAlt />

          </div>

          <p className="present-text">

            This certificate is proudly presented to

          </p>

          <h1 className="student-name">

            {certificate.studentName}

          </h1>

          <div className="name-line"></div>

          <p className="complete-text">

            For successfully completing and passing

          </p>

          <h2 className="exam-name">

            {certificate.examTitle}

          </h2>

          {/* INFO CARDS */}

          <div className="certificate-info">

            <div className="info-card">

              <span>
                Final Score
              </span>

              <h4>

                {certificate.percentage}%

              </h4>

            </div>

            <div className="info-card">

              <span>
                Verification
              </span>

              <h4>

                AI VERIFIED

              </h4>

            </div>

            <div className="info-card">

              <span>
                Status
              </span>

              <h4 className="pass">

                <FaCheckCircle />

                PASS

              </h4>

            </div>

          </div>

          {/* DOWNLOAD */}

          <button
            className="download-btn"
            onClick={downloadCertificate}
          >

            <FaDownload />

            Download Certificate

          </button>

        </div>

      </div>

    </div>

  );

}

export default Certificate;