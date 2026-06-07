import React, { useState } from "react";
import {
  Briefcase,
  Search,
  MapPin,
  Clock,
  DollarSign,
  Star,
  Filter,
  Building2,
  Award,
} from "lucide-react";

function ApplyInternship() {
  const [search, setSearch] = useState("");

  const internships = [
    {
      id: 1,
      title: "Frontend Developer Intern",
      company: "CyberNet Technology Systems",
      location: "Remote",
      duration: "3 Months",
      stipend: "₹10,000/month",
      level: "Beginner",
      skills: ["HTML", "CSS", "JavaScript", "React"],
      featured: true,
    },
    {
      id: 2,
      title: "Full Stack Developer Intern",
      company: "CyberNet Technology Systems",
      location: "Remote",
      duration: "6 Months",
      stipend: "₹15,000/month",
      level: "Intermediate",
      skills: ["React", "Node.js", "MongoDB"],
      featured: false,
    },
    {
      id: 3,
      title: "AI Engineer Intern",
      company: "CyberNet Technology Systems",
      location: "Remote",
      duration: "4 Months",
      stipend: "₹20,000/month",
      level: "Advanced",
      skills: ["Python", "Machine Learning", "AI"],
      featured: true,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}

      <div className="bg-gradient-to-r from-blue-700 via-cyan-600 to-blue-900 text-white p-8 shadow-xl">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-4 rounded-2xl">
              <Briefcase size={40} />
            </div>

            <div>
              <h1 className="text-4xl font-bold">
                CyberNet Internship Portal
              </h1>

              <p className="text-blue-100 mt-2">
                Apply for premium internships and start your tech career
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid md:grid-cols-4 gap-6">
          <div className="bg-white rounded-3xl p-6 shadow">
            <h3 className="text-gray-500">Open Internships</h3>
            <p className="text-4xl font-bold text-blue-600 mt-2">25+</p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow">
            <h3 className="text-gray-500">Companies</h3>
            <p className="text-4xl font-bold text-green-600 mt-2">10+</p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow">
            <h3 className="text-gray-500">Students Placed</h3>
            <p className="text-4xl font-bold text-purple-600 mt-2">500+</p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow">
            <h3 className="text-gray-500">Success Rate</h3>
            <p className="text-4xl font-bold text-orange-600 mt-2">92%</p>
          </div>
        </div>

        {/* Search */}

        <div className="bg-white rounded-3xl p-5 mt-8 shadow">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search
                className="absolute left-4 top-4 text-gray-400"
                size={20}
              />

              <input
                type="text"
                placeholder="Search internship..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 p-4 border rounded-xl outline-none"
              />
            </div>

            <button className="bg-blue-600 text-white px-6 rounded-xl flex items-center gap-2">
              <Filter size={18} />
              Filter
            </button>
          </div>
        </div>
                {/* Featured Internship Banner */}

        <div className="mt-8 bg-gradient-to-r from-purple-700 to-pink-600 text-white rounded-3xl p-8 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-3xl font-bold">
                🚀 Premium Internship Program
              </h2>

              <p className="mt-2 text-purple-100">
                Complete tasks, earn XP, unlock certificates and get placement
                opportunities.
              </p>
            </div>

            <div className="bg-white/20 px-6 py-3 rounded-2xl">
              <span className="font-bold">Limited Seats Available</span>
            </div>
          </div>
        </div>

        {/* Internship Cards */}

        <div className="grid lg:grid-cols-2 gap-8 mt-10">
          {internships
            .filter((item) =>
              item.title.toLowerCase().includes(search.toLowerCase())
            )
            .map((internship) => (
              <div
                key={internship.id}
                className="bg-white rounded-3xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">
                      {internship.title}
                    </h2>

                    <div className="flex items-center gap-2 mt-2 text-gray-600">
                      <Building2 size={18} />
                      {internship.company}
                    </div>
                  </div>

                  {internship.featured && (
                    <div className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full flex items-center gap-1">
                      <Star size={16} />
                      Featured
                    </div>
                  )}
                </div>

                <div className="grid md:grid-cols-3 gap-4 mt-6">
                  <div className="bg-slate-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-blue-600">
                      <MapPin size={18} />
                      <span>{internship.location}</span>
                    </div>
                  </div>

                  <div className="bg-slate-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-green-600">
                      <Clock size={18} />
                      <span>{internship.duration}</span>
                    </div>
                  </div>

                  <div className="bg-slate-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-purple-600">
                      <DollarSign size={18} />
                      <span>{internship.stipend}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="font-semibold text-gray-700 mb-3">
                    Required Skills
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {internship.skills.map((skill, index) => (
                      <span
                        key={index}
                        className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-orange-600">
                    <Award size={18} />
                    <span>{internship.level}</span>
                  </div>

                  <button className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-6 py-3 rounded-xl font-semibold hover:scale-105 transition-all">
                    Apply Now
                  </button>
                </div>
              </div>
            ))}
        </div>
                {/* Application Tracker */}

        <div className="grid lg:grid-cols-2 gap-8 mt-12">
          <div className="bg-white rounded-3xl p-8 shadow-lg">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">
              Application Progress
            </h2>

            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <span>Profile Completion</span>
                  <span className="font-bold text-green-600">90%</span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="bg-green-500 h-3 rounded-full w-[90%]"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span>Assessment Score</span>
                  <span className="font-bold text-blue-600">85%</span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="bg-blue-500 h-3 rounded-full w-[85%]"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span>Technical Skills</span>
                  <span className="font-bold text-purple-600">75%</span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="bg-purple-500 h-3 rounded-full w-[75%]"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span>Interview Readiness</span>
                  <span className="font-bold text-orange-600">65%</span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="bg-orange-500 h-3 rounded-full w-[65%]"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Career Roadmap */}

          <div className="bg-white rounded-3xl p-8 shadow-lg">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">
              Internship Roadmap
            </h2>

            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">
                  ✓
                </div>

                <div>
                  <h3 className="font-semibold">
                    Registration Completed
                  </h3>
                  <p className="text-sm text-gray-500">
                    Account successfully created
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">
                  ✓
                </div>

                <div>
                  <h3 className="font-semibold">
                    Assessment Completed
                  </h3>
                  <p className="text-sm text-gray-500">
                    Technical evaluation passed
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                  3
                </div>

                <div>
                  <h3 className="font-semibold">
                    Internship Selection
                  </h3>
                  <p className="text-sm text-gray-500">
                    Choose your desired role
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center font-bold">
                  4
                </div>

                <div>
                  <h3 className="font-semibold">
                    Live Projects
                  </h3>
                  <p className="text-sm text-gray-500">
                    Work on real industry tasks
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center font-bold">
                  5
                </div>

                <div>
                  <h3 className="font-semibold">
                    Certification & Placement
                  </h3>
                  <p className="text-sm text-gray-500">
                    Get certified and placement ready
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Success Banner */}

        <div className="mt-12 bg-gradient-to-r from-green-600 to-emerald-500 rounded-3xl text-white p-8 shadow-xl">
          <h2 className="text-3xl font-bold">
            🎯 Placement Assistance Program
          </h2>

          <p className="mt-3 text-green-100">
            Complete internship tasks, earn certificates,
            improve coding skills and become placement ready.
          </p>

          <button className="mt-6 bg-white text-green-600 px-8 py-3 rounded-xl font-bold hover:scale-105 transition-all">
            Explore Opportunities
          </button>
        </div>
                {/* Top Recruiters */}

        <div className="mt-12 bg-white rounded-3xl p-8 shadow-lg">
          <h2 className="text-3xl font-bold text-slate-800 mb-8">
            Top Hiring Partners
          </h2>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              "Microsoft",
              "Google",
              "Amazon",
              "CyberNet",
              "Infosys",
              "TCS",
              "Wipro",
              "Accenture",
            ].map((company, index) => (
              <div
                key={index}
                className="bg-slate-100 rounded-2xl p-6 text-center font-bold text-slate-700 hover:bg-blue-50 transition"
              >
                {company}
              </div>
            ))}
          </div>
        </div>

        {/* Student Reviews */}

        <div className="mt-12">
          <h2 className="text-3xl font-bold text-slate-800 mb-8">
            Student Success Stories
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-3xl p-6 shadow-lg">
              <div className="text-yellow-500 text-xl mb-3">
                ⭐⭐⭐⭐⭐
              </div>

              <p className="text-gray-600">
                CyberNet internship helped me improve my React skills and
                secure my first internship opportunity.
              </p>

              <h3 className="font-bold mt-4">Rahul Sharma</h3>
              <p className="text-sm text-gray-500">
                Frontend Developer Intern
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-lg">
              <div className="text-yellow-500 text-xl mb-3">
                ⭐⭐⭐⭐⭐
              </div>

              <p className="text-gray-600">
                Real projects and assessments gave me confidence for
                interviews and coding rounds.
              </p>

              <h3 className="font-bold mt-4">Priya Verma</h3>
              <p className="text-sm text-gray-500">
                Full Stack Intern
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-lg">
              <div className="text-yellow-500 text-xl mb-3">
                ⭐⭐⭐⭐⭐
              </div>

              <p className="text-gray-600">
                Amazing learning experience. Certificates and practical
                tasks really boosted my profile.
              </p>

              <h3 className="font-bold mt-4">Aman Gupta</h3>
              <p className="text-sm text-gray-500">
                AI Engineering Intern
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}

        <div className="mt-12 bg-white rounded-3xl p-8 shadow-lg">
          <h2 className="text-3xl font-bold text-slate-800 mb-8">
            Frequently Asked Questions
          </h2>

          <div className="space-y-5">
            <div className="border rounded-2xl p-5">
              <h3 className="font-bold">
                Is this internship remote?
              </h3>

              <p className="text-gray-600 mt-2">
                Yes, all CyberNet internships are fully remote.
              </p>
            </div>

            <div className="border rounded-2xl p-5">
              <h3 className="font-bold">
                Will I receive a certificate?
              </h3>

              <p className="text-gray-600 mt-2">
                Yes, verified certificates are provided after successful
                completion.
              </p>
            </div>

            <div className="border rounded-2xl p-5">
              <h3 className="font-bold">
                Are there placement opportunities?
              </h3>

              <p className="text-gray-600 mt-2">
                Top-performing students may receive placement assistance
                and referrals.
              </p>
            </div>

            <div className="border rounded-2xl p-5">
              <h3 className="font-bold">
                Do I need prior experience?
              </h3>

              <p className="text-gray-600 mt-2">
                No. Beginner, Intermediate and Advanced internships are
                available.
              </p>
            </div>
          </div>
        </div>

        {/* Footer CTA */}

        <div className="mt-12 mb-10 bg-gradient-to-r from-blue-700 via-cyan-600 to-blue-900 text-white rounded-3xl p-10 text-center shadow-xl">
          <h2 className="text-4xl font-bold">
            Ready To Start Your Internship Journey?
          </h2>

          <p className="mt-4 text-blue-100">
            Apply now and become a part of the CyberNet Technology Systems
            Internship Program.
          </p>

          <button className="mt-6 bg-white text-blue-700 px-10 py-4 rounded-2xl font-bold hover:scale-105 transition-all">
            Apply For Internship
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApplyInternship;