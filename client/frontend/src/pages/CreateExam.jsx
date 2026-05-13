import React from "react";

import "../styles/admin.css";

function CreateExam() {

  return (

    <div className="create-exam-page">

      <div className="create-exam-card">

        <h1>
          Create New Exam 📝
        </h1>

        <p>
          Add professional exam questions
        </p>

        <input
          type="text"
          placeholder="Exam Title"
        />

        <textarea
          placeholder="Question"
        ></textarea>

        <input
          type="text"
          placeholder="Option 1"
        />

        <input
          type="text"
          placeholder="Option 2"
        />

        <input
          type="text"
          placeholder="Option 3"
        />

        <input
          type="text"
          placeholder="Option 4"
        />

        <input
          type="text"
          placeholder="Correct Answer"
        />

        <button>
          Save Exam
        </button>

      </div>

    </div>

  );

}

export default CreateExam;