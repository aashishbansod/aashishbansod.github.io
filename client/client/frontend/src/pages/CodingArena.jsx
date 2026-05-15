import React from "react";

import "../styles/codingArena.css";

function CodingArena() {

  const tasks = [

    {
      title: "HTML Landing Page",
      difficulty: "Beginner",
      tech: "HTML + CSS",
      deadline: "2 Days"
    },

    {
      title: "React Login UI",
      difficulty: "Intermediate",
      tech: "React JS",
      deadline: "3 Days"
    },

    {
      title: "Node API Task",
      difficulty: "Advanced",
      tech: "Node + MongoDB",
      deadline: "5 Days"
    },

    {
      title: "Cyber Security Quiz",
      difficulty: "Beginner",
      tech: "Security Basics",
      deadline: "1 Day"
    }

  ];

  return (

    <div className="arena-page">

      {/* TOP */}

      <div className="arena-header">

        <h1>
          💻 Coding Arena
        </h1>

        <p>
          Practice coding, complete tasks and improve your skills.
        </p>

      </div>

      {/* TASK GRID */}

      <div className="task-grid">

        {

          tasks.map((task,index)=>(

            <div
              className="task-card"
              key={index}
            >

              <div className="task-top">

                <span className="difficulty">

                  {task.difficulty}

                </span>

              </div>

              <h2>
                {task.title}
              </h2>

              <p>
                Tech Stack:
                <strong> {task.tech}</strong>
              </p>

              <p>
                Deadline:
                <strong> {task.deadline}</strong>
              </p>

              <button className="start-task-btn">

                Start Task

              </button>

            </div>

          ))

        }

      </div>

    </div>

  );

}

export default CodingArena;