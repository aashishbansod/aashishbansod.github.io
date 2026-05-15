import React, { useState } from "react";

import "../styles/cybernet.css";

function CertificateForm() {

  const [formData, setFormData] = useState({

    fullName: "",
    email: "",
    college: "",
    course: "",
    domain: "",
    duration: "",
    project: ""

  });

  const handleChange = (e) => {

    setFormData({

      ...formData,
      [e.target.name]: e.target.value

    });

  };

  const submitForm = (e) => {

    e.preventDefault();

    alert(
      "Certificate request submitted successfully. Certificate will be sent within 24 hours."
    );

    console.log(formData);

  };

  return (

    <div className="certificate-page">

      <div className="certificate-box">

        <h1>
          📜 Certificate Request Form
        </h1>

        <p>
          Fill all details carefully.
          Your certificate will be sent within 24 hours after verification.
        </p>

        <form onSubmit={submitForm}>

          <input
            type="text"
            name="fullName"
            placeholder="Full Name"
            onChange={handleChange}
            required
          />

          <input
            type="email"
            name="email"
            placeholder="Email Address"
            onChange={handleChange}
            required
          />

          <input
            type="text"
            name="college"
            placeholder="College Name"
            onChange={handleChange}
            required
          />

          <input
            type="text"
            name="course"
            placeholder="Course / Branch"
            onChange={handleChange}
            required
          />

          {/* DOMAIN SELECT */}

          <select
            name="domain"
            onChange={handleChange}
            required
          >

            <option value="">
              Select Internship Domain
            </option>

            <option value="Frontend Development">
              Frontend Development
            </option>

            <option value="Backend Development">
              Backend Development
            </option>

            <option value="Full Stack Development">
              Full Stack Development
            </option>

            <option value="Python Development">
              Python Development
            </option>

            <option value="Java Development">
              Java Development
            </option>

            <option value="UI UX Design">
              UI / UX Design
            </option>

            <option value="AI Automation">
              AI Automation
            </option>

            <option value="Cyber Security">
              Cyber Security
            </option>

          </select>

          {/* DURATION SELECT */}

          <select
            name="duration"
            onChange={handleChange}
            required
          >

            <option value="">
              Select Internship Duration
            </option>

            <option value="15 Days">
              15 Days
            </option>

            <option value="1 Month">
              1 Month
            </option>

            <option value="2 Months">
              2 Months
            </option>

            <option value="3 Months">
              3 Months
            </option>

            <option value="6 Months">
              6 Months
            </option>

          </select>

          <input
            type="text"
            name="project"
            placeholder="Project Name"
            onChange={handleChange}
            required
          />

          <button type="submit">

            Submit Request

          </button>

        </form>

      </div>

    </div>

  );

}

export default CertificateForm;