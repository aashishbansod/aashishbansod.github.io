import React, {
  useEffect,
  useState
} from "react";

import axios from "axios";

import {
  FaClock,
  FaShieldAlt,
  FaCheckCircle,
  FaTimesCircle,
  FaAward
} from "react-icons/fa";

import "../styles/exams.css";

function Exams() {

  const [exams, setExams] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [selectedExam, setSelectedExam] =
    useState(null);

  const [answers, setAnswers] =
    useState({});

  const [score, setScore] =
    useState(null);

  const [correctAnswers, setCorrectAnswers] =
    useState(0);

  const [timeLeft, setTimeLeft] =
    useState(0);

  const [fullscreenWarning,
    setFullscreenWarning] =
    useState(false);

  const [fullscreenCount,
    setFullscreenCount] =
    useState(0);

  const [submitted,
    setSubmitted] =
    useState(false);

  const [certificateGenerated,
    setCertificateGenerated] =
    useState(false);

  /* FETCH EXAMS */

  useEffect(() => {

    fetchExams();

  }, []);

  const fetchExams = async () => {

    try {

      const response =
        await axios.get(

          "http://localhost:5000/api/exams"

        );

      setExams(
        response.data.exams
      );

      setLoading(false);

    }

    catch(error){

      console.log(error);

      setLoading(false);

    }

  };

  /* FULLSCREEN DETECT */

  useEffect(() => {

    const handleFullscreenChange =
    async () => {

      if(
        selectedExam &&
        !document.fullscreenElement &&
        score === null
      ){

        setFullscreenWarning(true);

        setFullscreenCount(
          (prev)=> prev + 1
        );

        /* AUTO SUBMIT */

        if(fullscreenCount >= 2){

          submitExam();

        }

        setTimeout(async()=>{

          if(
            document.documentElement
            .requestFullscreen
          ){

            await document
            .documentElement
            .requestFullscreen();

          }

        },1500);

      }

    };

    document.addEventListener(
      "fullscreenchange",
      handleFullscreenChange
    );

    return ()=>{

      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );

    };

  },[
    selectedExam,
    score,
    fullscreenCount
  ]);

  /* TIMER */

  useEffect(()=>{

    let timer;

    if(
      selectedExam &&
      score === null &&
      timeLeft > 0
    ){

      timer = setInterval(()=>{

        setTimeLeft(
          (prev)=> prev - 1
        );

      },1000);

    }

    if(
      timeLeft === 0 &&
      selectedExam &&
      score === null
    ){

      submitExam();

    }

    return ()=> clearInterval(timer);

  },[
    timeLeft,
    selectedExam
  ]);

  /* START EXAM */

  const startExam = async(exam)=>{

    setSelectedExam(exam);

    setAnswers({});

    setScore(null);

    setCorrectAnswers(0);

    setSubmitted(false);

    setCertificateGenerated(false);

    setTimeLeft(
      exam.duration * 60
    );

    if(
      document.documentElement
      .requestFullscreen
    ){

      await document
      .documentElement
      .requestFullscreen();

    }

  };

  /* OPTIONS */

  const handleOption = (
    questionIndex,
    option
  ) => {

    setAnswers({

      ...answers,

      [questionIndex]: option

    });

  };

  /* SUBMIT */

  const submitExam =
  async()=>{

    if(submitted) return;

    setSubmitted(true);

    let correct = 0;

    selectedExam.questions.forEach(
      (q,index)=>{

        if(
          answers[index]
          === q.correctAnswer
        ){

          correct++;

        }

      }
    );

    setCorrectAnswers(correct);

    const finalScore =
    Math.floor(

      (
        correct /
        selectedExam.questions.length
      ) * 100

    );

    setScore(finalScore);

    /* SAVE RESULT */

    try{

      await axios.post(

        "http://localhost:5000/api/results",

        {

          studentName:"Ashish",

          examTitle:
          selectedExam.title,

          score:correct,

          percentage:finalScore

        }

      );

      console.log(
        "Result Saved"
      );

    }

    catch(error){

      console.log(error);

    }

    /* CERTIFICATE */

    if(finalScore >= 40){

      try{

        await axios.post(

          "http://localhost:5000/api/certificates",

          {

            studentName:"Ashish",

            examTitle:
            selectedExam.title,

            percentage:
            finalScore

          }

        );

        setCertificateGenerated(true);

      }

      catch(error){

        console.log(error);

      }

    }

    /* EXIT FULLSCREEN */

    if(
      document.fullscreenElement
    ){

      document.exitFullscreen();

    }

  };

  /* FORMAT TIME */

  const formatTime = ()=>{

    const minutes =
    Math.floor(timeLeft / 60);

    const seconds =
    timeLeft % 60;

    return `${minutes}:${
      seconds < 10
      ? "0" + seconds
      : seconds
    }`;

  };

  /* LOADING */

  if(loading){

    return(

      <div className="exam-loading">

        <h1>

          Loading CyberNet Exams...

        </h1>

      </div>

    );

  }

  return(

    <div className="exam-page">

      {/* EXAM LIST */}

      {
        !selectedExam && (

          <div className="exam-list">

            <div className="exam-header">

              <div>

                <h1>

                  🚀 Live Exams

                </h1>

                <p>

                  AI Powered Secure Examination System

                </p>

              </div>

              <div className="secure-badge">

                <FaShieldAlt />

                Secure Mode

              </div>

            </div>

            <div className="exam-grid">

              {

                exams.map((exam)=>(

                  <div
                    className="exam-card"
                    key={exam._id}
                  >

                    <div className="exam-subject">

                      {exam.subject}

                    </div>

                    <h2>

                      {exam.title}

                    </h2>

                    <div className="exam-details">

                      <div className="exam-detail-box">

                        <FaClock />

                        <h3>

                          {exam.duration}

                        </h3>

                        <p>

                          Minutes

                        </p>

                      </div>

                      <div className="exam-detail-box">

                        <FaAward />

                        <h3>

                          {
                            exam.questions.length
                          }

                        </h3>

                        <p>

                          Questions

                        </p>

                      </div>

                    </div>

                    <button
                      onClick={()=>
                        startExam(exam)
                      }
                    >

                      Start Exam

                    </button>

                  </div>

                ))

              }

            </div>

          </div>

        )

      }

      {/* LIVE EXAM */}

      {

        selectedExam &&
        score === null && (

          <div className="live-exam">

            <div className="live-top">

              <div>

                <h1>

                  {selectedExam.title}

                </h1>

                <p>

                  CyberNet AI Exam System

                </p>

              </div>

              <div className="timer-box">

                ⏳ {formatTime()}

              </div>

            </div>

            {

              selectedExam.questions.map(
                (q,index)=>(

                  <div
                    className="question-box"
                    key={index}
                  >

                    <div className="question-number">

                      Question {index + 1}

                    </div>

                    <h2>

                      {q.question}

                    </h2>

                    <div className="options">

                      {

                        q.options.map(
                          (option,i)=>(

                            <button
                              key={i}
                              className={
                                answers[index]
                                === option
                                ? "selected-option"
                                : ""
                              }

                              onClick={()=>
                                handleOption(
                                  index,
                                  option
                                )
                              }
                            >

                              {option}

                            </button>

                          )
                        )

                      }

                    </div>

                  </div>

                )
              )

            }

            <button
              className="submit-btn"
              onClick={submitExam}
            >

              Submit Exam

            </button>

          </div>

        )

      }

      {/* RESULT */}

      {

        score !== null && (

          <div className="result-box">

            <div className="result-icon">

              {

                score >= 40
                ? <FaCheckCircle />
                : <FaTimesCircle />

              }

            </div>

            <h1>

              Exam Submitted

            </h1>

            <h2>

              {score}%

            </h2>

            <p>

              Correct Answers:
              {" "}
              {correctAnswers}

            </p>

            <div className={
              score >= 40
              ? "pass-badge"
              : "fail-badge"
            }>

              {

                score >= 40
                ? "PASS"
                : "FAIL"

              }

            </div>

            {

              certificateGenerated && (

                <div className="certificate-alert">

                  🏆 Certificate Generated Successfully

                </div>

              )

            }

            <button
              onClick={()=>{

                setSelectedExam(null);

                setAnswers({});

                setScore(null);

              }}
            >

              Back To Exams

            </button>

          </div>

        )

      }

      {/* WARNING */}

      {

        fullscreenWarning && (

          <div className="fullscreen-warning">

            <div className="warning-box">

              <h1>

                ⚠ Fullscreen Required

              </h1>

              <p>

                Please stay in fullscreen mode during the exam.

              </p>

              <h3>

                Warning Count:
                {" "}
                {fullscreenCount}

              </h3>

              <button
                onClick={()=>
                  setFullscreenWarning(false)
                }
              >

                Continue Exam

              </button>

            </div>

          </div>

        )

      }

    </div>

  );

}

export default Exams;