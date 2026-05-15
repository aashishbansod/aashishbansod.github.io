import React, {
  useEffect,
  useState
} from "react";

import axios from "axios";

import {
  FaTrophy,
  FaMedal,
  FaCrown,
  FaRocket,
  FaBrain,
  FaCode,
  FaFire,
  FaStar
} from "react-icons/fa";

import "../styles/leaderboard.css";

function Leaderboard() {

  const [students, setStudents] =
    useState([]);

  /* FETCH LEADERBOARD */

  useEffect(() => {

    fetchLeaderboard();

  }, []);

  const fetchLeaderboard =
    async () => {

      try {

        const response =
          await axios.get(

            "http://localhost:5000/api/leaderboard"

          );

        setStudents(

          response.data.leaderboard

        );

      } catch (error) {

        console.log(error);

      }

    };

  return (

    <div className="leaderboard-page">

      {/* AI GLOW */}

      <div className="leader-glow glow1"></div>

      <div className="leader-glow glow2"></div>

      {/* HEADER */}

      <div className="leaderboard-header">

        <div>

          <h1>

            🏆 CyberNet Leaderboard

          </h1>

          <p>

            Top AI Students & Exam Performers

          </p>

        </div>

        <div className="leaderboard-badge">

          <FaBrain />

          AI Ranking System

        </div>

      </div>

      {/* STATS */}

      <div className="leader-stats-grid">

        <div className="leader-stat-card">

          <FaRocket />

          <h2>

            {students.length}+

          </h2>

          <p>

            Active Students

          </p>

        </div>

        <div className="leader-stat-card">

          <FaCode />

          <h2>

            120+

          </h2>

          <p>

            Coding Exams

          </p>

        </div>

        <div className="leader-stat-card">

          <FaFire />

          <h2>

            {
              students[0]?.percentage || 0
            }%

          </h2>

          <p>

            Highest Score

          </p>

        </div>

        <div className="leader-stat-card">

          <FaStar />

          <h2>

            540+

          </h2>

          <p>

            AI Interns

          </p>

        </div>

      </div>

      {/* TOP 3 */}

      {

        students.length >= 3 && (

          <div className="top-three-section">

            {/* SECOND */}

            <div className="top-card silver">

              <div className="top-rank">

                🥈

              </div>

              <img
                src="https://i.pravatar.cc/150?img=15"
                alt=""
              />

              <h2>

                {
                  students[1]
                    ?.studentName
                }

              </h2>

              <span>

                {
                  students[1]
                    ?.examTitle
                }

              </span>

              <h1>

                {
                  students[1]
                    ?.percentage
                }%

              </h1>

            </div>

            {/* FIRST */}

            <div className="top-card gold">

              <div className="crown">

                <FaCrown />

              </div>

              <div className="top-rank">

                🥇

              </div>

              <img
                src="https://i.pravatar.cc/150?img=12"
                alt=""
              />

              <h2>

                {
                  students[0]
                    ?.studentName
                }

              </h2>

              <span>

                {
                  students[0]
                    ?.examTitle
                }

              </span>

              <h1>

                {
                  students[0]
                    ?.percentage
                }%

              </h1>

            </div>

            {/* THIRD */}

            <div className="top-card bronze">

              <div className="top-rank">

                🥉

              </div>

              <img
                src="https://i.pravatar.cc/150?img=32"
                alt=""
              />

              <h2>

                {
                  students[2]
                    ?.studentName
                }

              </h2>

              <span>

                {
                  students[2]
                    ?.examTitle
                }

              </span>

              <h1>

                {
                  students[2]
                    ?.percentage
                }%

              </h1>

            </div>

          </div>

        )

      }

      {/* TABLE */}

      <div className="leaderboard-table">

        <div className="table-header">

          <h2>

            🚀 Global Student Rankings

          </h2>

        </div>

        {

          students.map(

            (student, index) => (

              <div
                className="leader-row"
                key={index}
              >

                <div className="leader-rank">

                  #{index + 1}

                </div>

                <div className="leader-user">

                  <img
                    src={`https://i.pravatar.cc/150?img=${index + 10}`}
                    alt=""
                  />

                  <div>

                    <h3>

                      {
                        student.studentName
                      }

                    </h3>

                    <p>

                      {
                        student.examTitle
                      }

                    </p>

                  </div>

                </div>

                <div className="leader-score">

                  <FaTrophy />

                  {
                    student.percentage
                  }%

                </div>

                <div className="leader-exams">

                  <FaMedal />

                  {
                    student.score
                  } Correct

                </div>

                <div className="leader-badge">

                  {

                    index === 0
                    ? "👑 AI Master"

                    : index === 1
                    ? "🚀 Top Coder"

                    : index === 2
                    ? "🔥 Fast Learner"

                    : "💎 Rising Star"

                  }

                </div>

              </div>

            )

          )

        }

      </div>

      {/* AI INSIGHT */}

      <div className="ai-insight-box">

        <h2>

          🤖 AI Performance Insight

        </h2>

        <p>

          CyberNet AI system automatically
          tracks student performance,
          coding skills and exam scores
          in real-time leaderboard rankings.

        </p>

      </div>

    </div>

  );

}

export default Leaderboard;