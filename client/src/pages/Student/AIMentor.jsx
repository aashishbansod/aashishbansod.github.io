import React, { useState } from "react";
import {
  Bot,
  Send,
  Sparkles,
  Rocket,
  Brain,
  BookOpen,
  Code,
  Briefcase,
  GraduationCap,
  MessageSquare,
  Star,
} from "lucide-react";

function StudentAIMentor() {
  const [question, setQuestion] = useState("");

  const suggestions = [
    "Create React Internship Project",
    "Prepare for Java Interview",
    "Explain DBMS Normalization",
    "Build Full Stack Project",
    "Resume Review Tips",
    "Placement Preparation",
  ];

  const chatHistory = [
    {
      role: "ai",
      text: "Welcome to CyberNet AI Mentor. Ask me anything about coding, projects, interviews, internships, resume building and career growth."
    },
    {
      role: "student",
      text: "How can I become a Full Stack Developer?"
    },
    {
      role: "ai",
      text: "Learn HTML, CSS, JavaScript, React, Node.js, Express and MongoDB. Build projects consistently and practice coding daily."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-8">

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 via-cyan-600 to-blue-900 rounded-3xl p-8 text-white shadow-xl">

        <div className="flex justify-between items-center">

          <div>
            <h1 className="text-5xl font-black flex items-center gap-3">
              <Bot size={48} />
              CyberNet AI Mentor
            </h1>

            <p className="mt-4 text-blue-100 text-lg">
              Personal AI Mentor for Coding, Internship,
              Resume Building, Interview Preparation and Career Growth
            </p>
          </div>

          <Rocket size={60} />
        </div>

      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mt-8">

        <div className="bg-white rounded-3xl p-6 shadow-lg">
          <Brain className="text-purple-600" size={40} />
          <h2 className="text-4xl font-black mt-3">24/7</h2>
          <p className="text-slate-500">AI Availability</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg">
          <Code className="text-green-600" size={40} />
          <h2 className="text-4xl font-black mt-3">500+</h2>
          <p className="text-slate-500">Coding Solutions</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg">
          <Briefcase className="text-orange-500" size={40} />
          <h2 className="text-4xl font-black mt-3">100+</h2>
          <p className="text-slate-500">Career Roadmaps</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg">
          <Star className="text-yellow-500" size={40} />
          <h2 className="text-4xl font-black mt-3">4.9</h2>
          <p className="text-slate-500">Student Rating</p>
        </div>

      </div>
            {/* AI Suggestions */}
      <div className="bg-white rounded-3xl p-8 shadow-lg mt-8">

        <div className="flex items-center gap-3 mb-6">
          <Sparkles className="text-yellow-500" size={28} />
          <h2 className="text-3xl font-black">
            Popular AI Suggestions
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

          {suggestions.map((item, index) => (
            <button
              key={index}
              className="bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-500 transition rounded-2xl p-5 text-left"
            >
              <div className="flex items-center gap-3">
                <MessageSquare
                  size={20}
                  className="text-blue-600"
                />

                <span className="font-semibold">
                  {item}
                </span>
              </div>
            </button>
          ))}

        </div>

      </div>

      {/* AI Chat Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mt-8">

        {/* Chat Window */}
        <div className="xl:col-span-2 bg-white rounded-3xl shadow-lg p-8">

          <div className="flex items-center gap-3 mb-8">
            <Bot
              className="text-blue-600"
              size={32}
            />

            <h2 className="text-3xl font-black">
              AI Conversation
            </h2>
          </div>

          <div className="space-y-6 h-[500px] overflow-y-auto pr-2">

            {chatHistory.map((chat, index) => (

              <div
                key={index}
                className={`flex ${
                  chat.role === "student"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >

                <div
                  className={`max-w-[80%] p-5 rounded-3xl ${
                    chat.role === "student"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100"
                  }`}
                >
                  {chat.text}
                </div>

              </div>

            ))}

          </div>

          {/* Input Box */}
          <div className="mt-8 flex gap-4">

            <input
              type="text"
              value={question}
              onChange={(e) =>
                setQuestion(e.target.value)
              }
              placeholder="Ask CyberNet AI Mentor..."
              className="flex-1 border border-slate-300 rounded-2xl px-5 py-4 outline-none focus:border-blue-500"
            />

            <button className="bg-blue-600 hover:bg-blue-700 transition text-white px-8 rounded-2xl flex items-center gap-2">
              <Send size={20} />
              Send
            </button>

          </div>

        </div>
                {/* AI Features Panel */}
        <div className="space-y-6">

          <div className="bg-white rounded-3xl shadow-lg p-6">

            <h2 className="text-2xl font-black mb-5">
              AI Services
            </h2>

            <div className="space-y-4">

              <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-2xl">
                <Code className="text-blue-600" />
                <div>
                  <h3 className="font-bold">
                    Coding Mentor
                  </h3>
                  <p className="text-sm text-slate-500">
                    Solve coding problems instantly
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-green-50 rounded-2xl">
                <GraduationCap className="text-green-600" />
                <div>
                  <h3 className="font-bold">
                    Interview Preparation
                  </h3>
                  <p className="text-sm text-slate-500">
                    HR + Technical Interview Help
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-orange-50 rounded-2xl">
                <Briefcase className="text-orange-600" />
                <div>
                  <h3 className="font-bold">
                    Career Guidance
                  </h3>
                  <p className="text-sm text-slate-500">
                    Personalized Career Roadmaps
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-2xl">
                <BookOpen className="text-purple-600" />
                <div>
                  <h3 className="font-bold">
                    Study Assistant
                  </h3>
                  <p className="text-sm text-slate-500">
                    Notes, Concepts & Explanations
                  </p>
                </div>
              </div>

            </div>

          </div>

          {/* XP Card */}

          <div className="bg-gradient-to-r from-blue-700 to-cyan-600 text-white rounded-3xl p-6 shadow-xl">

            <h2 className="text-2xl font-black">
              AI Learning Progress
            </h2>

            <div className="mt-5">
              <h1 className="text-5xl font-black">
                5200 XP
              </h1>

              <p className="text-blue-100 mt-2">
                Earned through AI Learning
              </p>
            </div>

            <div className="mt-6">

              <div className="flex justify-between text-sm">
                <span>Next Badge</span>
                <span>6000 XP</span>
              </div>

              <div className="w-full bg-white/20 h-3 rounded-full mt-2">
                <div className="bg-white h-3 rounded-full w-[86%]"></div>
              </div>

              <p className="mt-3 text-sm">
                Need 800 XP More
              </p>

            </div>

          </div>

        </div>

      </div>
            {/* Premium AI Tools */}
      <div className="bg-white rounded-3xl p-8 shadow-lg mt-8">

        <h2 className="text-3xl font-black mb-6">
          Premium AI Tools
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

          <div className="bg-slate-50 rounded-2xl p-6 border">
            <Code className="text-blue-600 mb-4" size={40} />
            <h3 className="font-black text-xl">
              Code Generator
            </h3>
            <p className="text-slate-500 mt-2">
              Generate React, Node.js and Python projects.
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-6 border">
            <GraduationCap
              className="text-green-600 mb-4"
              size={40}
            />
            <h3 className="font-black text-xl">
              Exam Assistant
            </h3>
            <p className="text-slate-500 mt-2">
              Prepare university exams and notes.
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-6 border">
            <Briefcase
              className="text-orange-500 mb-4"
              size={40}
            />
            <h3 className="font-black text-xl">
              Resume Builder
            </h3>
            <p className="text-slate-500 mt-2">
              Create professional ATS-friendly resumes.
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-6 border">
            <Brain
              className="text-purple-600 mb-4"
              size={40}
            />
            <h3 className="font-black text-xl">
              AI Career Coach
            </h3>
            <p className="text-slate-500 mt-2">
              Personalized roadmap for software careers.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}

export default StudentAIMentor;