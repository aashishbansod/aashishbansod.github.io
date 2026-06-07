import React, { useState } from "react";
import {
  User,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  Trophy,
  Award,
  Star,
  Edit,
  Camera,
} from "lucide-react";

function StudentProfile() {

  const [student] = useState({
    name: "ASHISH",
    email: "ashish@example.com",
    phone: "+91 9876543210",
    location: "Amravati, Maharashtra",
    course: "Full Stack Development",
    level: 12,
    xp: 5200,
    rank: "#7",
    certificates: 12,
    tasksCompleted: 148,
  });

  return (
    <div className="min-h-screen bg-slate-100 p-8">

      {/* Profile Banner */}

      <div className="bg-gradient-to-r from-blue-700 via-cyan-600 to-blue-500 rounded-3xl p-10 shadow-2xl text-white">

        <div className="flex flex-col md:flex-row items-center justify-between">

          <div className="flex items-center gap-6">

            <div className="relative">

              <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md border-4 border-white">

                <User size={60} />

              </div>

              <button className="absolute bottom-0 right-0 bg-white text-blue-600 p-2 rounded-full shadow-lg">

                <Camera size={18} />

              </button>

            </div>

            <div>

              <h1 className="text-5xl font-black">
                {student.name}
              </h1>

              <p className="text-lg opacity-90 mt-2">
                {student.course}
              </p>

              <div className="flex gap-3 mt-4">

                <span className="bg-white/20 px-4 py-2 rounded-full">
                  Level {student.level}
                </span>

                <span className="bg-white/20 px-4 py-2 rounded-full">
                  Rank {student.rank}
                </span>

              </div>

            </div>

          </div>

          <button className="bg-white text-blue-700 px-6 py-3 rounded-xl font-bold flex items-center gap-2 mt-6 md:mt-0">

            <Edit size={18} />
            Edit Profile

          </button>

        </div>

      </div>

      {/* Statistics */}

      <div className="grid md:grid-cols-4 gap-6 mt-8">

        <div className="bg-white rounded-3xl p-6 shadow-lg">

          <Trophy className="text-yellow-500" size={35} />

          <h2 className="text-4xl font-black mt-3">
            {student.xp}
          </h2>

          <p className="text-slate-500">
            Total XP
          </p>

        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg">

          <Award className="text-purple-600" size={35} />

          <h2 className="text-4xl font-black mt-3">
            {student.certificates}
          </h2>

          <p className="text-slate-500">
            Certificates
          </p>

        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg">

          <Star className="text-green-600" size={35} />

          <h2 className="text-4xl font-black mt-3">
            {student.tasksCompleted}
          </h2>

          <p className="text-slate-500">
            Tasks Completed
          </p>

        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg">

          <GraduationCap
            className="text-blue-600"
            size={35}
          />

          <h2 className="text-4xl font-black mt-3">
            {student.level}
          </h2>

          <p className="text-slate-500">
            Current Level
          </p>

        </div>

      </div>
            {/* Personal Information */}

      <div className="grid lg:grid-cols-3 gap-8 mt-8">

        <div className="lg:col-span-2 bg-white rounded-3xl shadow-lg p-8">

          <h2 className="text-2xl font-bold mb-6">
            Personal Information
          </h2>

          <div className="grid md:grid-cols-2 gap-6">

            <div className="border rounded-2xl p-4">

              <div className="flex items-center gap-3">

                <User className="text-blue-600" />

                <div>

                  <p className="text-slate-500 text-sm">
                    Full Name
                  </p>

                  <h3 className="font-bold text-lg">
                    {student.name}
                  </h3>

                </div>

              </div>

            </div>

            <div className="border rounded-2xl p-4">

              <div className="flex items-center gap-3">

                <Mail className="text-green-600" />

                <div>

                  <p className="text-slate-500 text-sm">
                    Email
                  </p>

                  <h3 className="font-bold text-lg">
                    {student.email}
                  </h3>

                </div>

              </div>

            </div>

            <div className="border rounded-2xl p-4">

              <div className="flex items-center gap-3">

                <Phone className="text-orange-500" />

                <div>

                  <p className="text-slate-500 text-sm">
                    Phone
                  </p>

                  <h3 className="font-bold text-lg">
                    {student.phone}
                  </h3>

                </div>

              </div>

            </div>

            <div className="border rounded-2xl p-4">

              <div className="flex items-center gap-3">

                <MapPin className="text-red-500" />

                <div>

                  <p className="text-slate-500 text-sm">
                    Location
                  </p>

                  <h3 className="font-bold text-lg">
                    {student.location}
                  </h3>

                </div>

              </div>

            </div>

          </div>

        </div>

        {/* XP Progress */}

        <div className="bg-white rounded-3xl shadow-lg p-8">

          <h2 className="text-2xl font-bold mb-6">
            Level Progress
          </h2>

          <div className="flex justify-center">

            <div className="relative w-44 h-44">

              <div className="absolute inset-0 rounded-full border-[14px] border-slate-200"></div>

              <div
                className="absolute inset-0 rounded-full border-[14px] border-blue-600"
                style={{
                  clipPath:
                    "polygon(0 0,100% 0,100% 100%,50% 100%,50% 50%,0 50%)",
                }}
              ></div>

              <div className="absolute inset-0 flex flex-col items-center justify-center">

                <h2 className="text-4xl font-black">
                  78%
                </h2>

                <p className="text-slate-500">
                  Completed
                </p>

              </div>

            </div>

          </div>

          <div className="mt-8">

            <div className="flex justify-between mb-2">

              <span>Current XP</span>

              <span>5200 / 7000</span>

            </div>

            <div className="h-4 bg-slate-200 rounded-full overflow-hidden">

              <div className="h-full w-[78%] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full"></div>

            </div>

          </div>

        </div>

      </div>
            {/* Skills & Achievements */}

      <div className="grid lg:grid-cols-2 gap-8 mt-8">

        {/* Skills */}

        <div className="bg-white rounded-3xl shadow-lg p-8">

          <h2 className="text-2xl font-bold mb-6">
            Technical Skills
          </h2>

          <div className="space-y-5">

            {[
              { name: "HTML & CSS", value: 95 },
              { name: "JavaScript", value: 88 },
              { name: "React JS", value: 82 },
              { name: "Node JS", value: 75 },
              { name: "MongoDB", value: 70 },
            ].map((skill, index) => (
              <div key={index}>

                <div className="flex justify-between mb-2">

                  <span className="font-medium">
                    {skill.name}
                  </span>

                  <span className="font-bold text-blue-600">
                    {skill.value}%
                  </span>

                </div>

                <div className="h-3 bg-slate-200 rounded-full overflow-hidden">

                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full"
                    style={{
                      width: `${skill.value}%`,
                    }}
                  ></div>

                </div>

              </div>
            ))}

          </div>

        </div>

        {/* Achievements */}

        <div className="bg-white rounded-3xl shadow-lg p-8">

          <h2 className="text-2xl font-bold mb-6">
            Achievements
          </h2>

          <div className="space-y-4">

            {[
              {
                title: "Top Performer",
                desc: "Completed 50+ tasks successfully",
              },
              {
                title: "React Expert",
                desc: "Scored 95% in React Assessment",
              },
              {
                title: "Coding Champion",
                desc: "Solved 300+ coding problems",
              },
              {
                title: "Internship Star",
                desc: "Completed all internship milestones",
              },
            ].map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-4 border rounded-2xl p-4 hover:bg-slate-50 transition"
              >

                <Award className="text-yellow-500 mt-1" />

                <div>

                  <h3 className="font-bold text-lg">
                    {item.title}
                  </h3>

                  <p className="text-slate-500">
                    {item.desc}
                  </p>

                </div>

              </div>
            ))}

          </div>

        </div>

      </div>
            {/* Recent Activity */}

      <div className="bg-white rounded-3xl shadow-lg p-8 mt-8">

        <h2 className="text-2xl font-bold mb-6">
          Recent Activity
        </h2>

        <div className="space-y-5">

          {[
            "Completed React Internship Task",
            "Earned JavaScript Mastery Certificate",
            "Solved 25 Coding Challenges",
            "Passed AI Assessment Test",
            "Updated Profile Information",
          ].map((activity, index) => (
            <div
              key={index}
              className="flex items-center gap-4 border-b pb-4"
            >

              <div className="w-3 h-3 rounded-full bg-blue-600"></div>

              <p className="text-slate-700">
                {activity}
              </p>

            </div>
          ))}

        </div>

      </div>

    </div>
  );
}

export default StudentProfile;