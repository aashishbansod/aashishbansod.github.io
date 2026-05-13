import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import "../styles/cybernet.css";

function Instructions() {

  const navigate = useNavigate();

  useEffect(() => {

    // RIGHT CLICK DISABLE

    const disableRightClick = (e) => {
      e.preventDefault();
    };

    // COPY DISABLE

    const disableCopy = (e) => {
      e.preventDefault();
    };

    // TAB SWITCH DETECT

    const tabSwitch = () => {

      if(document.hidden){

        alert(
          "⚠ Tab Switching Detected!"
        );

      }

    };

    document.addEventListener(
      "contextmenu",
      disableRightClick
    );

    document.addEventListener(
      "copy",
      disableCopy
    );

    document.addEventListener(
      "visibilitychange",
      tabSwitch
    );

    return () => {

      document.removeEventListener(
        "contextmenu",
        disableRightClick
      );

      document.removeEventListener(
        "copy",
        disableCopy
      );

      document.removeEventListener(
        "visibilitychange",
        tabSwitch
      );

    };

  }, []);

  // START EXAM

  const startExam = async () => {

    // FULLSCREEN

    if(
      document.documentElement.requestFullscreen
    ){

      await document.documentElement.requestFullscreen();

    }

    // CAMERA ACCESS

    try{

      await navigator.mediaDevices.getUserMedia({
        video:true
      });

    }

    catch(error){

      alert(
        "Camera Permission Required"
      );

      return;

    }

    navigate("/exams");

  };

  return (

    <div className="instruction-page">

      <div className="instruction-box">

        {/* TOP */}

        <div className="instruction-top">

          <div>

            <h1>
              🚀 CyberNet Online Exam
            </h1>

            <p>
              Read all instructions carefully before starting the exam.
            </p>

          </div>

          <div className="exam-timer-box">

            ⏱ 30 Minutes

          </div>

        </div>

        {/* GRID */}

        <div className="instruction-grid">

          <div className="instruction-card">

            <h3>
              📚 Questions
            </h3>

            <p>
              20 MCQ Questions
            </p>

          </div>

          <div className="instruction-card">

            <h3>
              🎯 Passing
            </h3>

            <p>
              Minimum 40%
            </p>

          </div>

          <div className="instruction-card">

            <h3>
              ⚡ Negative Marking
            </h3>

            <p>
              No Negative Marking
            </p>

          </div>

          <div className="instruction-card">

            <h3>
              🧠 Secure Mode
            </h3>

            <p>
              Fullscreen Protected
            </p>

          </div>

        </div>

        {/* RULES */}

        <div className="rules-box">

          <h2>
            📌 Important Instructions
          </h2>

          <ul>

            <li>
              Do not switch browser tabs during exam.
            </li>

            <li>
              Fullscreen mode is compulsory.
            </li>

            <li>
              Camera permission is required.
            </li>

            <li>
              Copy paste and right click are disabled.
            </li>

            <li>
              Exam will auto submit after timer ends.
            </li>

            <li>
              Stable internet connection required.
            </li>

            <li>
              Any suspicious activity may terminate exam.
            </li>

          </ul>

        </div>

        {/* WARNING */}

        <div className="warning-box">

          ⚠ Once exam starts, timer cannot be paused.

        </div>

        {/* BUTTON */}

        <button
          className="start-exam-btn"
          onClick={startExam}
        >

          Start Secure Exam →

        </button>

      </div>

    </div>

  );

}

export default Instructions;