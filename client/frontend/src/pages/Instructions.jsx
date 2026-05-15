import React, { useEffect } from "react";

import {
  useNavigate
} from "react-router-dom";

import "../styles/instructions.css";

function Instructions() {

  const navigate = useNavigate();

  useEffect(() => {

    // =========================
    // RIGHT CLICK DISABLE
    // =========================

    const disableRightClick = (e) => {
      e.preventDefault();
    };

    // =========================
    // COPY DISABLE
    // =========================

    const disableCopy = (e) => {
      e.preventDefault();
    };

    // =========================
    // TAB SWITCH DETECT
    // =========================

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

  // =========================
  // START EXAM
  // =========================

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

      {/* AI BACKGROUND */}

      <div className="ai-circle ai-circle-1"></div>
      <div className="ai-circle ai-circle-2"></div>
      <div className="ai-circle ai-circle-3"></div>

      <div className="instruction-box">

        {/* ========================= */}
        {/* TOP */}
        {/* ========================= */}

        <div className="instruction-top">

          <div className="instruction-left">

            <div className="ai-badge">

              🤖 AI Powered Exam Portal

            </div>

            <h1>

              🚀 CyberNet Online Exam

            </h1>

            <p>

              Advanced AI protected online examination system with secure fullscreen monitoring, camera verification and anti-cheat detection.

            </p>

          </div>

          <div className="exam-timer-box">

            <span>
              ⏱
            </span>

            <div>

              <h2>
                30
              </h2>

              <p>
                Minutes
              </p>

            </div>

          </div>

        </div>

        {/* ========================= */}
        {/* GRID */}
        {/* ========================= */}

        <div className="instruction-grid">

          <div className="instruction-card">

            <div className="card-icon blue">

              📚

            </div>

            <h3>

              Questions

            </h3>

            <p>

              20 MCQ Questions

            </p>

          </div>

          <div className="instruction-card">

            <div className="card-icon purple">

              🎯

            </div>

            <h3>

              Passing

            </h3>

            <p>

              Minimum 40%

            </p>

          </div>

          <div className="instruction-card">

            <div className="card-icon orange">

              ⚡

            </div>

            <h3>

              Negative Marking

            </h3>

            <p>

              No Negative Marking

            </p>

          </div>

          <div className="instruction-card">

            <div className="card-icon pink">

              🧠

            </div>

            <h3>

              Secure Mode

            </h3>

            <p>

              Fullscreen Protected

            </p>

          </div>

        </div>

        {/* ========================= */}
        {/* RULES */}
        {/* ========================= */}

        <div className="rules-box">

          <div className="rules-header">

            <h2>

              📌 Important Instructions

            </h2>

            <div className="security-status">

              🔒 Secure Mode Active

            </div>

          </div>

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

        {/* ========================= */}
        {/* WARNING */}
        {/* ========================= */}

        <div className="warning-box">

          ⚠ Once exam starts, timer cannot be paused.

        </div>

        {/* ========================= */}
        {/* BUTTON */}
        {/* ========================= */}

        <button
          className="start-exam-btn"
          onClick={startExam}
        >

          <span>

            Start Secure Exam

          </span>

          <span>

            →

          </span>

        </button>

      </div>

    </div>

  );

}

export default Instructions;