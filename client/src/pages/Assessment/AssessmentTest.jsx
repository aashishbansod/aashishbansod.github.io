import React, {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  FaClock,
  FaArrowLeft,
  FaArrowRight,
  FaCheckCircle,
} from "react-icons/fa";

function AssessmentTest() {
  const navigate = useNavigate();

  const { id } = useParams();

  const [currentQuestion, setCurrentQuestion] =
    useState(0);

  const [answers, setAnswers] =
    useState({});

  const [timeLeft, setTimeLeft] =
    useState(1800);

  const assessmentQuestions = [
    {
      question:
        "What does HTML stand for?",
      options: [
        "Hyper Text Markup Language",
        "High Transfer Machine Language",
        "Home Tool Markup Language",
        "Hyper Transfer Markup Language",
      ],
      correct: 0,
    },

    {
      question:
        "Which CSS property changes text color?",
      options: [
        "font-color",
        "text-color",
        "color",
        "background-color",
      ],
      correct: 2,
    },

    {
      question:
        "Which company developed React?",
      options: [
        "Google",
        "Microsoft",
        "Facebook",
        "Apple",
      ],
      correct: 2,
    },

    {
      question:
        "JavaScript is a ______ language.",
      options: [
        "Programming",
        "Database",
        "Operating System",
        "Browser",
      ],
      correct: 0,
    },

    {
      question:
        "Which symbol is used for JSX expressions?",
      options: [
        "()",
        "{}",
        "[]",
        "<>",
      ],
      correct: 1,
    },

    {
      question:
        "Which hook manages state in React?",
      options: [
        "useEffect",
        "useState",
        "useRouter",
        "useData",
      ],
      correct: 1,
    },

    {
      question:
        "Which database is NoSQL?",
      options: [
        "MySQL",
        "Oracle",
        "MongoDB",
        "PostgreSQL",
      ],
      correct: 2,
    },

    {
      question:
        "Node.js runs on which engine?",
      options: [
        "SpiderMonkey",
        "V8",
        "Java VM",
        "Core Engine",
      ],
      correct: 1,
    },

    {
      question:
        "Which HTTP method creates data?",
      options: [
        "GET",
        "POST",
        "DELETE",
        "PATCH",
      ],
      correct: 1,
    },

    {
      question:
        "Which company created Java?",
      options: [
        "Sun Microsystems",
        "Google",
        "IBM",
        "Meta",
      ],
      correct: 0,
    },
  ];

  const totalQuestions =
    assessmentQuestions.length;
      useEffect(() => {
    if (timeLeft <= 0) {
      handleSubmitTest();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(
      seconds / 60
    );

    const secs = seconds % 60;

    return `${mins}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const handleAnswerSelect = (
    optionIndex
  ) => {
    setAnswers({
      ...answers,
      [currentQuestion]:
        optionIndex,
    });
  };

  const nextQuestion = () => {
    if (
      currentQuestion <
      totalQuestions - 1
    ) {
      setCurrentQuestion(
        currentQuestion + 1
      );
    }
  };

  const previousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(
        currentQuestion - 1
      );
    }
  };

  const handleSubmitTest = () => {
    let score = 0;

    assessmentQuestions.forEach(
      (question, index) => {
        if (
          answers[index] ===
          question.correct
        ) {
          score++;
        }
      }
    );

    const percentage =
      Math.round(
        (score /
          totalQuestions) *
          100
      );

    let scholarship = 0;

    if (percentage >= 90) {
      scholarship = 30;
    } else if (
      percentage >= 80
    ) {
      scholarship = 20;
    } else if (
      percentage >= 70
    ) {
      scholarship = 10;
    }

    localStorage.setItem(
      "assessmentResult",
      JSON.stringify({
        assessmentId: id,
        score,
        totalQuestions,
        percentage,
        scholarship,
      })
    );

    navigate(
      "/student/assessment"
    );
  };

  const question =
    assessmentQuestions[
      currentQuestion
    ];

  return (
    <div className="min-h-screen bg-slate-100">

      {/* HEADER */}

      <div className="bg-slate-900 text-white px-10 py-6 flex items-center justify-between">

        <div>

          <h1 className="text-3xl font-black">
            CyberNet Assessment
          </h1>

          <p className="text-slate-300">
            Assessment ID : {id}
          </p>

        </div>

        <div className="flex items-center gap-3 bg-red-600 px-6 py-3 rounded-2xl">

          <FaClock />

          <span className="font-black text-xl">
            {formatTime(timeLeft)}
          </span>

        </div>

      </div>

      <div className="max-w-5xl mx-auto p-10">
                {/* PROGRESS */}

        <div className="bg-white rounded-[35px] shadow-xl p-8 mb-8">

          <div className="flex justify-between items-center mb-5">

            <h2 className="text-xl font-black">
              Question {currentQuestion + 1} of {totalQuestions}
            </h2>

            <span className="font-bold text-blue-600">
              {Math.round(
                ((currentQuestion + 1) /
                  totalQuestions) *
                  100
              )}
              %
            </span>

          </div>

          <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden">

            <div
              className="h-full bg-gradient-to-r from-blue-600 to-cyan-500"
              style={{
                width: `${
                  ((currentQuestion + 1) /
                    totalQuestions) *
                  100
                }%`,
              }}
            />

          </div>

        </div>

        {/* QUESTION CARD */}

        <div className="bg-white rounded-[40px] shadow-2xl p-10">

          <div className="mb-10">

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full font-bold mb-5">

              <FaCheckCircle />

              Assessment Question

            </div>

            <h2 className="text-3xl font-black text-slate-900 leading-relaxed">

              {question.question}

            </h2>

          </div>

          {/* OPTIONS */}

          <div className="space-y-5">

            {question.options.map(
              (option, index) => (

                <button
                  key={index}
                  onClick={() =>
                    handleAnswerSelect(
                      index
                    )
                  }
                  className={`
                  w-full
                  text-left
                  p-6
                  rounded-3xl
                  border-2
                  transition-all
                  duration-300

                  ${
                    answers[
                      currentQuestion
                    ] === index
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 hover:border-blue-300"
                  }
                  `}
                >

                  <div className="flex items-center gap-4">

                    <div
                      className={`
                      w-10
                      h-10
                      rounded-full
                      flex
                      items-center
                      justify-center
                      font-black

                      ${
                        answers[
                          currentQuestion
                        ] === index
                          ? "bg-blue-600 text-white"
                          : "bg-slate-200"
                      }
                      `}
                    >
                      {String.fromCharCode(
                        65 + index
                      )}
                    </div>

                    <span className="text-lg font-semibold">

                      {option}

                    </span>

                  </div>

                </button>
              )
            )}

          </div>

          {/* NAVIGATION */}

          <div className="flex justify-between mt-12">

            <button
              onClick={
                previousQuestion
              }
              disabled={
                currentQuestion === 0
              }
              className="
              px-8
              py-4
              rounded-2xl
              bg-slate-200
              font-black
              flex
              items-center
              gap-3
              disabled:opacity-50
              "
            >

              <FaArrowLeft />

              Previous

            </button>

            {currentQuestion ===
            totalQuestions - 1 ? (

              <button
                onClick={
                  handleSubmitTest
                }
                className="
                px-10
                py-4
                rounded-2xl
                bg-green-600
                text-white
                font-black
                shadow-xl
                "
              >
                Submit Test
              </button>

            ) : (

              <button
                onClick={
                  nextQuestion
                }
                className="
                px-8
                py-4
                rounded-2xl
                bg-gradient-to-r
                from-blue-600
                to-cyan-500
                text-white
                font-black
                flex
                items-center
                gap-3
                shadow-xl
                "
              >

                Next

                <FaArrowRight />

              </button>

            )}

          </div>

        </div>
                {/* QUICK NAVIGATION */}

        <div className="mt-10 bg-white rounded-[35px] shadow-xl p-8">

          <h3 className="text-2xl font-black mb-6">
            Question Navigator
          </h3>

          <div className="grid grid-cols-5 md:grid-cols-10 gap-3">

            {assessmentQuestions.map(
              (_, index) => (
                <button
                  key={index}
                  onClick={() =>
                    setCurrentQuestion(
                      index
                    )
                  }
                  className={`
                  h-12
                  rounded-xl
                  font-black
                  transition-all

                  ${
                    answers[index] !==
                    undefined
                      ? "bg-green-500 text-white"
                      : "bg-slate-200"
                  }

                  ${
                    currentQuestion ===
                    index
                      ? "ring-4 ring-blue-400"
                      : ""
                  }
                  `}
                >
                  {index + 1}
                </button>
              )
            )}

          </div>

        </div>

        {/* EXAM INFO */}

        <div className="mt-10 bg-white rounded-[35px] shadow-xl p-8">

          <h3 className="text-2xl font-black mb-6">
            Assessment Instructions
          </h3>

          <div className="space-y-3 text-slate-600">

            <p>
              • Read every question carefully.
            </p>

            <p>
              • Each question carries equal marks.
            </p>

            <p>
              • Scholarship depends on final score.
            </p>

            <p>
              • Assessment auto-submits when timer ends.
            </p>

            <p>
              • Complete assessment before internship application.
            </p>

          </div>

        </div>

        {/* STATUS */}

        <div className="mt-10 bg-green-50 border border-green-200 rounded-3xl p-6">

          <h3 className="font-black text-green-700 text-xl">
            Auto Save Active
          </h3>

          <p className="text-slate-600 mt-2">
            Your answers are being stored automatically during the assessment.
          </p>

        </div>

      </div>

    </div>
  );
}

export default AssessmentTest;