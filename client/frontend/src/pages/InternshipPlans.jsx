import React from "react";

import { useNavigate } from "react-router-dom";

import "../styles/internship.css";

function InternshipPlans() {

  const navigate = useNavigate();

  const plans = [

    {
      title: "Web Development",
      price: "199",
      duration: "1 - 3 Months",
      upi: "webdev@ybl",

      features: [
        "HTML, CSS, JavaScript",
        "React Projects",
        "Live Tasks",
        "Certificate Included"
      ]
    },

    {
      title: "Cyber Security",
      price: "299",
      duration: "2 - 6 Months",
      upi: "cyber@ybl",

      features: [
        "Network Security",
        "Security Tools",
        "Practical Labs",
        "Certificate Included"
      ]
    },

    {
      title: "Ethical Hacking",
      price: "399",
      duration: "3 Months",
      upi: "hacking@ybl",

      features: [
        "Kali Linux",
        "Penetration Testing",
        "CTF Challenges",
        "Certificate Included"
      ]
    },

    {
      title: "Android Development",
      price: "249",
      duration: "2 Months",
      upi: "android@ybl",

      features: [
        "Android Studio",
        "UI Development",
        "Firebase",
        "Certificate Included"
      ]
    }

  ];

  return (

    <div className="plans-page">

      {/* HEADER */}

      <div className="plans-header">

        <h1>
          🚀 Internship Programs
        </h1>

        <p>
          Choose your internship plan
          and start your professional journey.
        </p>

      </div>

      {/* CARDS */}

      <div className="plans-grid">

        {

          plans.map((plan,index)=>(

            <div
              className="plan-card"
              key={index}
            >

              <h2>
                {plan.title}
              </h2>

              <h1>
                ₹{plan.price}
              </h1>

              <span>
                Duration:
                {" "}
                {plan.duration}
              </span>

              <ul>

                {

                  plan.features.map(
                    (feature,i)=>(

                    <li key={i}>
                      ✔ {feature}
                    </li>

                  ))

                }

              </ul>

              <button
                className="buy-btn"

                onClick={() =>

                  navigate("/payment", {

                    state: {

                      title: plan.title,

                      duration: plan.duration,

                      price: plan.price,

                      upi: plan.upi

                    }

                  })

                }

              >

                Buy Now

              </button>

            </div>

          ))

        }

      </div>

    </div>

  );

}

export default InternshipPlans;