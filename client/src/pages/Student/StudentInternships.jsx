import React, { useState } from "react";
import {
  Briefcase,
  MapPin,
  Clock,
  DollarSign,
  Search,
  Filter,
  Building2,
  Star,
} from "lucide-react";

function StudentInternships() {

  const [search, setSearch] = useState("");

  const internships = [
    {
      id: 1,
      title: "Frontend Developer Intern",
      company: "CyberNet Technology Systems",
      location: "Remote",
      duration: "3 Months",
      stipend: "₹15,000",
      rating: 4.9,
      skills: ["React", "JavaScript", "Tailwind"],
    },
    {
      id: 2,
      title: "Full Stack Developer Intern",
      company: "TechNova Solutions",
      location: "Hyderabad",
      duration: "6 Months",
      stipend: "₹25,000",
      rating: 4.8,
      skills: ["MERN", "Node.js", "MongoDB"],
    },
    {
      id: 3,
      title: "AI Engineer Intern",
      company: "Future AI Labs",
      location: "Remote",
      duration: "4 Months",
      stipend: "₹30,000",
      rating: 5.0,
      skills: ["Python", "Machine Learning", "AI"],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-8">

      {/* Hero Section */}

      <div className="bg-gradient-to-r from-blue-700 via-cyan-600 to-blue-500 rounded-3xl p-10 text-white shadow-xl">

        <div className="flex justify-between items-center">

          <div>

            <h1 className="text-5xl font-black">
              Internship Portal
            </h1>

            <p className="mt-3 text-lg opacity-90">
              Discover and apply for top internships
            </p>

          </div>

          <Briefcase size={80} />

        </div>

      </div>

      {/* Stats */}

      <div className="grid md:grid-cols-4 gap-6 mt-8">

        <div className="bg-white p-6 rounded-3xl shadow-lg">
          <h2 className="text-4xl font-black text-blue-600">
            150+
          </h2>
          <p className="text-slate-500">
            Active Internships
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-lg">
          <h2 className="text-4xl font-black text-green-600">
            50+
          </h2>
          <p className="text-slate-500">
            Hiring Companies
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-lg">
          <h2 className="text-4xl font-black text-purple-600">
            95%
          </h2>
          <p className="text-slate-500">
            Placement Rate
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-lg">
          <h2 className="text-4xl font-black text-orange-500">
            ₹30K
          </h2>
          <p className="text-slate-500">
            Highest Stipend
          </p>
        </div>

      </div>

      {/* Search Section */}

      <div className="bg-white rounded-3xl shadow-lg p-6 mt-8">

        <div className="flex gap-4">

          <div className="flex-1 relative">

            <Search
              className="absolute left-4 top-4 text-slate-400"
              size={20}
            />

            <input
              type="text"
              placeholder="Search internships..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-slate-200 rounded-xl pl-12 py-3 outline-none"
            />

          </div>

          <button className="bg-blue-600 text-white px-6 rounded-xl flex items-center gap-2">
            <Filter size={18} />
            Filter
          </button>

        </div>

      </div>
            {/* Internship Cards */}

      <div className="grid md:grid-cols-2 gap-8 mt-8">

        {internships
          .filter((item) =>
            item.title
              .toLowerCase()
              .includes(search.toLowerCase())
          )
          .map((internship) => (

            <div
              key={internship.id}
              className="bg-white rounded-3xl shadow-lg p-6 hover:shadow-2xl transition-all"
            >

              <div className="flex justify-between items-start">

                <div>

                  <h2 className="text-2xl font-bold">
                    {internship.title}
                  </h2>

                  <div className="flex items-center gap-2 mt-2 text-slate-600">

                    <Building2 size={18} />

                    <span>
                      {internship.company}
                    </span>

                  </div>

                </div>

                <div className="flex items-center gap-1 text-yellow-500">

                  <Star size={18} fill="currentColor" />

                  <span className="font-bold">
                    {internship.rating}
                  </span>

                </div>

              </div>

              <div className="grid grid-cols-3 gap-4 mt-6">

                <div className="flex items-center gap-2 text-slate-600">

                  <MapPin size={18} />

                  <span>
                    {internship.location}
                  </span>

                </div>

                <div className="flex items-center gap-2 text-slate-600">

                  <Clock size={18} />

                  <span>
                    {internship.duration}
                  </span>

                </div>

                <div className="flex items-center gap-2 text-green-600">

                  <DollarSign size={18} />

                  <span>
                    {internship.stipend}
                  </span>

                </div>

              </div>

              <div className="flex flex-wrap gap-2 mt-6">

                {internship.skills.map((skill, index) => (

                  <span
                    key={index}
                    className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold"
                  >
                    {skill}
                  </span>

                ))}

              </div>
                            <div className="mt-6 flex gap-3">

                <button className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 text-white py-3 rounded-xl font-semibold hover:scale-105 transition">

                  Apply Now

                </button>

                <button className="px-5 py-3 border border-slate-300 rounded-xl hover:bg-slate-100 transition">

                  Details

                </button>

              </div>

            </div>

          ))}

      </div>

      {/* Featured Companies */}

      <div className="bg-white rounded-3xl shadow-lg p-8 mt-10">

        <h2 className="text-3xl font-bold mb-6">
          Featured Companies
        </h2>

        <div className="grid md:grid-cols-4 gap-6">

          <div className="bg-slate-50 rounded-2xl p-6 text-center">

            <Building2
              size={40}
              className="mx-auto text-blue-600"
            />

            <h3 className="font-bold mt-3">
              Microsoft
            </h3>

            <p className="text-slate-500 text-sm">
              Software Internships
            </p>

          </div>

          <div className="bg-slate-50 rounded-2xl p-6 text-center">

            <Building2
              size={40}
              className="mx-auto text-green-600"
            />

            <h3 className="font-bold mt-3">
              Google
            </h3>

            <p className="text-slate-500 text-sm">
              Engineering Roles
            </p>

          </div>

          <div className="bg-slate-50 rounded-2xl p-6 text-center">

            <Building2
              size={40}
              className="mx-auto text-purple-600"
            />

            <h3 className="font-bold mt-3">
              Amazon
            </h3>

            <p className="text-slate-500 text-sm">
              Cloud & DevOps
            </p>

          </div>

          <div className="bg-slate-50 rounded-2xl p-6 text-center">

            <Building2
              size={40}
              className="mx-auto text-orange-500"
            />

            <h3 className="font-bold mt-3">
              CyberNet
            </h3>

            <p className="text-slate-500 text-sm">
              Full Stack Program
            </p>

          </div>

        </div>

      </div>
     </div>
  );
}

export default StudentInternships;