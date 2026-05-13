import React, {
  useEffect,
  useState,
  useContext
} from "react";

import { useNavigate } from "react-router-dom";

import { ExamContext } from "../context/ExamContext";

import "../styles/cybernet.css";

function Exams() {

  const navigate = useNavigate();

  const {
    answers,
    setAnswers
  } = useContext(ExamContext);

  // =========================
  // TIMER STATE
  // =========================

  const [timeLeft, setTimeLeft] = useState(1800);

  // =========================
  // QUESTIONS
  // =========================

  const questions = [

    {
      id: 1,

      question:
        "HTML ka full form kya hai?",

      options: [
        "Hyper Text Markup Language",
        "High Text Machine Language",
        "Hyper Tool Multi Language",
        "None"
      ],

      correctAnswer:
        "Hyper Text Markup Language"
    },

    {
      id: 2,

      question:
        "CSS kis liye use hota hai?",

      options: [
        "Styling",
        "Database",
        "Backend",
        "Hosting"
      ],

      correctAnswer:
        "Styling"
    }

  ];

  // =========================
  // TIMER LOGIC
  // =========================

  useEffect(() => {

    if (timeLeft <= 0) {

      navigate("/result");

      return;

    }

    const timer = setInterval(() => {

      setTimeLeft((prev) => prev - 1);

    }, 1000);

    return () => clearInterval(timer);

  }, [timeLeft, navigate]);

  // =========================
  // FORMAT TIMER
  // =========================

  const formatTime = () => {

    const minutes = Math.floor(timeLeft / 60);

    const seconds = timeLeft % 60;

    return `${minutes}:${
      seconds < 10 ? "0" : ""
    }${seconds}`;

  };

  // =========================
  // HANDLE ANSWERS
  // =========================

  const handleAnswer = (
    questionId,
    answer
  ) => {

    setAnswers({

      ...answers,

      [questionId]: answer

    });

  };

  // =========================
  // JSX
  // =========================

  return (

    <div className="exam-page">

      {/* ========================= */}
      {/* TOP BAR */}
      {/* ========================= */}

      <div className="exam-topbar">

        <div>

          <h1>
            🚀 CyberNet Live Exam
          </h1>

          <p>
            Read all questions carefully before submitting.
          </p>

        </div>

        <div className="exam-timer">

          ⏰ {formatTime()}

        </div>

      </div>

      {/* ========================= */}
      {/* QUESTIONS */}
      {/* ========================= */}

      <div className="questions-container">

        {

          questions.map((q, index) => (

            <div
              className="question-card"
              key={q.id}
            >

              <div className="question-number">

                Question {index + 1}

              </div>

              <h2>
                {q.question}
              </h2>

              <div className="options-box">

                {

                  q.options.map((option, i) => (

                    <label
                      className="option"
                      key={i}
                    >

                      <input
                        type="radio"
                        name={`q${q.id}`}
                        checked={
                          answers[q.id] === option
                        }
                        onChange={() =>
                          handleAnswer(
                            q.id,
                            option
                          )
                        }
                      />

                      {option}

                    </label>

                  ))

                }

              </div>

            </div>

          ))

        }

      </div>

      {/* ========================= */}
      {/* SUBMIT BUTTON */}
      {/* ========================= */}

      <div className="submit-section">

        <button
          className="submit-exam-btn"
          onClick={() =>
            navigate("/result")
          }
        >

          Submit Exam

        </button>

      </div>

    </div>

  );

}

export default Exams;