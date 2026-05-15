import React, {
  useContext
} from "react";

import {
  useNavigate
} from "react-router-dom";

import {
  FaCheckCircle,
  FaTimesCircle,
  FaTrophy,
  FaRocket,
  FaBrain,
  FaChartLine
} from "react-icons/fa";

import {
  ExamContext
} from "../context/ExamContext";

import "../styles/result.css";

function Result() {

  const navigate =
  useNavigate();

  const {
    answers
  } = useContext(ExamContext);

  /* ========================= */
  /* QUESTIONS */
  /* ========================= */

  const questions = [

    {
      id:1,

      correctAnswer:
      "Hyper Text Markup Language"
    },

    {
      id:2,

      correctAnswer:
      "Styling"
    }

  ];

  /* ========================= */
  /* SCORE */
  /* ========================= */

  let score = 0;

  questions.forEach((q)=>{

    if(
      answers[q.id]
      === q.correctAnswer
    ){

      score++;

    }

  });

  const percentage =
  Math.floor(
    (score / questions.length) * 100
  );

  const isPass =
  percentage >= 40;

  /* ========================= */
  /* USER */
  /* ========================= */

  const user = JSON.parse(

    localStorage.getItem("user")

  );

  return (

    <div className="result-page">

      {/* BACKGROUND */}

      <div className="result-glow glow1"></div>
      <div className="result-glow glow2"></div>

      {/* CARD */}

      <div className="result-card">

        {/* TOP */}

        <div className="result-top">

          <div className="result-badge">

            🤖 AI Exam Analysis

          </div>

          <h1>

            🎉 Exam Completed

          </h1>

          <p>

            CyberNet AI has analyzed
            your performance successfully.

          </p>

        </div>

        {/* SCORE */}

        <div className="score-wrapper">

          <div className="score-circle">

            <div className="inner-circle">

              <h2>

                {percentage}%

              </h2>

              <p>

                Score

              </p>

            </div>

          </div>

        </div>

        {/* USER */}

        <div className="student-result-info">

          <h2>

            👨‍🎓 {

              user?.name ||

              "Student"

            }

          </h2>

          <p>

            Frontend Development Exam

          </p>

        </div>

        {/* STATUS */}

        <div className="result-status">

          {

            isPass

            ?

            <div className="pass-box">

              <FaCheckCircle />

              PASS

            </div>

            :

            <div className="fail-box">

              <FaTimesCircle />

              FAIL

            </div>

          }

        </div>

        {/* STATS */}

        <div className="result-stats">

          <div className="result-stat-card">

            <FaTrophy />

            <h3>

              {score}

            </h3>

            <span>

              Correct Answers

            </span>

          </div>

          <div className="result-stat-card">

            <FaRocket />

            <h3>

              {questions.length}

            </h3>

            <span>

              Total Questions

            </span>

          </div>

          <div className="result-stat-card">

            <FaBrain />

            <h3>

              AI

            </h3>

            <span>

              Performance Checked

            </span>

          </div>

          <div className="result-stat-card">

            <FaChartLine />

            <h3>

              #12

            </h3>

            <span>

              Global Rank

            </span>

          </div>

        </div>

        {/* ANALYSIS */}

        <div className="ai-analysis-box">

          <h2>

            📊 AI Performance Analysis

          </h2>

          <p>

            Your exam performance shows
            strong understanding of
            frontend concepts.
            Continue solving coding
            challenges to improve
            your ranking and unlock
            premium internships.

          </p>

        </div>

        {/* BUTTONS */}

        <div className="result-buttons">

          <button
            className="dashboard-btn"
            onClick={() =>
              navigate("/dashboard")
            }
          >

            Back To Dashboard

          </button>

          {

            isPass &&

            <button
              className="certificate-btn"
              onClick={() =>
                navigate(
                  "/certificate-form"
                )
              }
            >

              Claim Certificate

            </button>

          }

        </div>

      </div>

    </div>

  );

}

export default Result;