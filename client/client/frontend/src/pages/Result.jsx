import React, {

  useContext

} from "react";

import {

  ExamContext

} from "../context/ExamContext";

import "../styles/cybernet.css";

function Result() {

  const {

    answers

  } = useContext(ExamContext);

  // QUESTIONS

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

  // SCORE

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

  return (

    <div className="result-page">

      <div className="result-card">

        <h1>
          🎉 Exam Result
        </h1>

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

        <div className="result-info">

          <h3>
            Correct Answers:
            {score}
            /
            {questions.length}
          </h3>

          <h2
            className={
              isPass
              ? "pass-text"
              : "fail-text"
            }
          >

            {
              isPass
              ? "PASS"
              : "FAIL"
            }

          </h2>

        </div>

      </div>

    </div>

  );

}

export default Result;