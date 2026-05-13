import React from "react";

import {
  useLocation
} from "react-router-dom";

import "../styles/payment.css";

function PaymentPage() {

  const location = useLocation();

  const course =
  location.state || {

    title:"Web Development",

    duration:"3 Months",

    price:"199",

    upi:"cybernet@ybl"

  };

  return (

    <div className="payment-page">

      {/* LEFT SIDE */}

      <div className="payment-left">

        <h1>
          🚀 Complete Your Payment
        </h1>

        <p>
          Activate your CyberNet internship
          and unlock premium dashboard features.
        </p>

        <div className="internship-card">

          <h2>
            {course.title} Internship
          </h2>

          <span>
            Duration:
            {" "}
            {course.duration}
          </span>

          <ul>

            <li>
              ✔ Real Projects
            </li>

            <li>
              ✔ Coding Tasks
            </li>

            <li>
              ✔ Internship Certificate
            </li>

            <li>
              ✔ Live Exams
            </li>

            <li>
              ✔ Premium Dashboard Access
            </li>

          </ul>

        </div>

      </div>

      {/* RIGHT SIDE */}

      <div className="payment-right">

        <div className="payment-box">

          <h2>
            Payment Summary
          </h2>

          <div className="price-box">

            <h1>
              ₹{course.price}
            </h1>

            <p>
              One Time Internship Fee
            </p>

          </div>

          {/* QR */}

          <div className="qr-box">

            <img

              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${course.upi}`}

              alt="QR"

            />

          </div>

          {/* UPI */}

          <div className="upi-box">

            <p>
              UPI ID
            </p>

            <h3>
              {course.upi}
            </h3>

          </div>

          {/* BUTTON */}

          <button className="pay-btn">

            Pay Now

          </button>

          <div className="payment-note">

            🔒 Secure Payment Gateway

          </div>

        </div>

      </div>

    </div>

  );

}

export default PaymentPage;