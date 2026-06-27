import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Briefcase,
  MapPin,
  Clock,
  Search,
  Filter,
  Building2,
  Star,
  ShieldAlert,
  BadgeCheck,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Rocket,
  IndianRupee,
  Users,
  CalendarDays,
  Lock,
  ExternalLink,
  ClipboardList,
  BadgePercent,
  CreditCard,
} from "lucide-react";
import api from "../../services/api";

function formatCurrency(amount) {
  const value = Number(amount || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateValue) {
  if (!dateValue) return "—";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateValue) {
  if (!dateValue) return "—";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeText(value, fallback = "—") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function getStatusBadge(application) {
  if (!application) {
    return {
      label: "Not Applied",
      className: "bg-slate-100 text-slate-700",
    };
  }

  if (application.paymentCompleted) {
    return {
      label: "Paid",
      className: "bg-emerald-100 text-emerald-700",
    };
  }

  if (application.status === "Selected") {
    return {
      label: "Selected",
      className: "bg-blue-100 text-blue-700",
    };
  }

  if (application.status === "Rejected") {
    return {
      label: "Rejected",
      className: "bg-rose-100 text-rose-700",
    };
  }

  if (application.status === "In Progress") {
    return {
      label: "In Progress",
      className: "bg-violet-100 text-violet-700",
    };
  }

  return {
    label: safeText(application.status, "Applied"),
    className: "bg-amber-100 text-amber-700",
  };
}

function resolveApplicationForInternship(internship, profileId, appMap) {
  if (!internship?._id) return null;

  const mapped = appMap.get(String(internship._id));
  if (mapped) return mapped;

  if (Array.isArray(internship.applications)) {
    const match = internship.applications.find(
      (item) =>
        String(item.student?._id || item.student) === String(profileId)
    );
    if (match) return match;
  }

  return internship.myApplication || null;
}

function StatCard({ icon: Icon, label, value, hint, tone = "blue" }) {
  const tones = {
    blue: "from-blue-50 to-blue-100 text-blue-700",
    emerald: "from-emerald-50 to-emerald-100 text-emerald-700",
    amber: "from-amber-50 to-amber-100 text-amber-700",
    purple: "from-purple-50 to-purple-100 text-purple-700",
    cyan: "from-cyan-50 to-cyan-100 text-cyan-700",
    red: "from-red-50 to-red-100 text-red-700",
    slate: "from-slate-50 to-slate-100 text-slate-700",
  };

  return (
    <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/50">
      <div
        className={[
          "mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br",
          tones[tone] || tones.blue,
        ].join(" ")}
      >
        <Icon className="text-xl" />
      </div>

      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
      <p className="mt-2 text-xs font-medium text-slate-500">{hint}</p>
    </div>
  );
}

function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
          <Sparkles size={14} />
          CyberNet Student Portal
        </div>
        <h2 className="mt-4 text-2xl font-black text-slate-900 sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          {subtitle}
        </p>
      </div>
      {action}
    </div>
  );
}

export default function StudentInternships() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [applyingId, setApplyingId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [profile, setProfile] = useState(null);
  const [internships, setInternships] = useState([]);
  const [myApplications, setMyApplications] = useState([]);

  const isAssessmentLocked = !(
    profile?.assessmentCompleted &&
    profile?.assessmentPassed &&
    profile?.internshipUnlocked
  );

  const fetchData = async () => {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const [profileRes, internshipsRes, applicationsRes] = await Promise.all([
        api.get("/student/profile"),
        api.get("/internships"),
        api.get("/internships/my/applications"),
      ]);

      const profileData =
        profileRes?.data?.student ||
        profileRes?.data?.user ||
        profileRes?.data?.profile ||
        null;

      const internshipList =
        internshipsRes?.data?.internships ||
        internshipsRes?.data?.data ||
        internshipsRes?.data?.results ||
        internshipsRes?.data ||
        [];

      const applicationList =
        applicationsRes?.data?.applications ||
        applicationsRes?.data?.internships ||
        applicationsRes?.data?.data ||
        applicationsRes?.data ||
        [];

      setProfile(profileData);
      setInternships(safeArray(internshipList));
      setMyApplications(safeArray(applicationList));

      if (!selectedId && safeArray(internshipList).length > 0) {
        setSelectedId(String(safeArray(internshipList)[0]?._id || ""));
      }
    } catch (err) {
      console.error("Internships load error:", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load internships"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applicationMap = useMemo(() => {
    const map = new Map();

    safeArray(myApplications).forEach((item) => {
      const internshipId =
        item?.internship?._id ||
        item?.internship ||
        item?._id ||
        item?.internshipId ||
        null;

      if (!internshipId) return;

      const application =
        item?.myApplication ||
        item?.application ||
        item?.applicationDetails ||
        (Array.isArray(item?.applications) ? item.applications[0] : null) ||
        item;

      if (application) {
        map.set(String(internshipId), application);
      }
    });

    return map;
  }, [myApplications]);

  const mergedInternships = useMemo(() => {
    return safeArray(internships).map((internship) => ({
      ...internship,
      myApplication: resolveApplicationForInternship(
        internship,
        profile?._id,
        applicationMap
      ),
    }));
  }, [internships, profile?._id, applicationMap]);

  const domains = useMemo(() => {
    const unique = new Set();
    mergedInternships.forEach((item) => {
      if (item?.domain) unique.add(item.domain);
    });
    return ["All", ...Array.from(unique)];
  }, [mergedInternships]);

  const filteredInternships = useMemo(() => {
    const query = search.trim().toLowerCase();

    return mergedInternships.filter((item) => {
      const matchesSearch =
        !query ||
        item.title?.toLowerCase().includes(query) ||
        item.companyName?.toLowerCase().includes(query) ||
        item.domain?.toLowerCase().includes(query) ||
        item.subDomain?.toLowerCase().includes(query) ||
        item.internshipCode?.toLowerCase().includes(query);

      const matchesDomain =
        domainFilter === "All" || item.domain === domainFilter;

      const matchesType =
        typeFilter === "All" || item.internshipType === typeFilter;

      return matchesSearch && matchesDomain && matchesType;
    });
  }, [mergedInternships, search, domainFilter, typeFilter]);

  useEffect(() => {
    if (!selectedId && filteredInternships.length > 0) {
      setSelectedId(String(filteredInternships[0]._id));
    }

    if (
      selectedId &&
      !filteredInternships.find(
        (item) => String(item._id) === String(selectedId)
      ) &&
      filteredInternships.length > 0
    ) {
      setSelectedId(String(filteredInternships[0]._id));
    }
  }, [filteredInternships, selectedId]);

  const selectedInternship = useMemo(() => {
    return (
      filteredInternships.find(
        (item) => String(item._id) === String(selectedId)
      ) || filteredInternships[0] || null
    );
  }, [filteredInternships, selectedId]);

  const selectedApplication = selectedInternship?.myApplication || null;
  const scholarshipPercentage = Number(profile?.scholarshipPercentage || 0);

  const stats = useMemo(() => {
    const appliedCount = safeArray(myApplications).length;
    const paidCount = safeArray(myApplications).filter((item) => {
      const app = item?.myApplication || item?.application || item;
      return Boolean(app?.paymentCompleted);
    }).length;
    const selectedCount = safeArray(myApplications).filter((item) => {
      const app = item?.myApplication || item?.application || item;
      return app?.status === "Selected";
    }).length;

    return {
      totalInternships: filteredInternships.length,
      applications: appliedCount,
      paid: paidCount,
      selected: selectedCount,
    };
  }, [filteredInternships.length, myApplications]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  const handleGoToAssessment = () => {
    navigate("/student/assessment");
  };

  const openRazorpayCheckout = async ({
    order,
    payment,
    internship,
    keyId,
  }) => {
    const loaded = await loadRazorpayScript();

    if (!loaded) {
      throw new Error("Razorpay SDK could not be loaded");
    }

    if (!window.Razorpay) {
      throw new Error("Razorpay checkout unavailable");
    }

    const options = {
      key: keyId,
      amount: order.amount,
      currency: order.currency || "INR",
      name: "CyberNet Technology Systems",
      description: internship?.title || "Internship Payment",
      image: internship?.companyLogo || undefined,
      order_id: order.id,
      prefill: {
        name:
          profile?.fullName ||
          `${safeText(profile?.firstName, "")} ${safeText(
            profile?.lastName,
            ""
          )}`.trim(),
        email: profile?.email || "",
        contact: profile?.mobile || "",
      },
      notes: {
        paymentId: payment?.paymentId || "",
        internshipId: internship?._id || "",
        internshipCode: internship?.internshipCode || "",
      },
      theme: {
        color: "#2563eb",
      },
      modal: {
        ondismiss: () => setApplyingId(""),
      },
      handler: async (response) => {
        try {
          await api.post("/payments/verify", {
            paymentId: payment?.paymentId,
            orderId: payment?.orderId || order?.id,
            paymentGateway: "RAZORPAY",
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            gatewayTransactionId: response.razorpay_payment_id,
            gatewayResponse: response,
          });

          setSuccess("Payment successful. Your internship has been activated.");
          await fetchData();
          navigate("/student/dashboard");
        } catch (verifyErr) {
          console.error(verifyErr);
          setError(
            verifyErr?.response?.data?.message ||
              verifyErr?.message ||
              "Payment verification failed"
          );
        } finally {
          setApplyingId("");
        }
      },
    };

    const razorpay = new window.Razorpay(options);
    razorpay.open();
  };

  const handleApplyAndPay = async (internship) => {
    if (!internship?._id) return;

    setApplyingId(String(internship._id));
    setError("");
    setSuccess("");

    try {
      if (isAssessmentLocked) {
        setError("Complete the assessment first to unlock internships.");
        navigate("/student/assessment");
        return;
      }

      try {
        await api.post(`/internships/${internship._id}/apply`);
      } catch (applyErr) {
        const message =
          applyErr?.response?.data?.message || applyErr?.message || "";

        if (!/already applied/i.test(message) && !/application/i.test(message)) {
          throw applyErr;
        }
      }

      const createOrderRes = await api.post("/payments/create-order", {
        internshipId: internship._id,
      });

      const {
        keyId = "",
        order = null,
        payment = null,
        gateway = "RAZORPAY",
      } = createOrderRes?.data || {};

      if (!payment) {
        throw new Error("Payment order not created");
      }

      if (gateway !== "RAZORPAY" || !keyId || !order?.id) {
        setSuccess("Application submitted successfully. Payment order is ready.");
        await fetchData();
        return;
      }

      await openRazorpayCheckout({
        order,
        payment,
        internship,
        keyId,
      });
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to apply for this internship"
      );
    } finally {
      setApplyingId("");
    }
  };

  const selectedBadge = getStatusBadge(selectedApplication);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex min-h-[70vh] items-center justify-center rounded-[32px] bg-white shadow-lg">
          <div className="text-center">
            <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <h2 className="mt-5 text-2xl font-black text-slate-900">
              Loading internships...
            </h2>
            <p className="mt-2 text-slate-500">
              Fetching admin-approved internships and your application status.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="w-full">
        <SectionTitle
          title="Internships"
          subtitle="Browse admin-approved internship programs, lock status, scholarship discounts, and apply securely with payment flow."
          action={
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 font-bold text-white shadow-lg transition hover:scale-[1.01]"
            >
              <RefreshCw className={refreshing ? "animate-spin" : ""} size={18} />
              Refresh
            </button>
          }
        />

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Briefcase}
            label="Active Internships"
            value={stats.totalInternships}
            hint="Programs matching current filters"
            tone="blue"
          />
          <StatCard
            icon={ClipboardList}
            label="Applications"
            value={stats.applications}
            hint="Your internship applications"
            tone="emerald"
          />
          <StatCard
            icon={CreditCard}
            label="Paid Applications"
            value={stats.paid}
            hint="Completed payment records"
            tone="purple"
          />
          <StatCard
            icon={BadgePercent}
            label="Scholarship"
            value={`${scholarshipPercentage}%`}
            hint="Discount applied on payable fee"
            tone="amber"
          />
        </div>

        {(error || success) && (
          <div
            className={[
              "mb-6 rounded-2xl border p-4",
              error
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700",
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              {error ? (
                <AlertCircle className="mt-0.5" size={20} />
              ) : (
                <BadgeCheck className="mt-0.5" size={20} />
              )}
              <div className="flex-1">
                <p className="font-bold">{error ? "Action failed" : "Success"}</p>
                <p className="mt-1 text-sm">{error || success}</p>
              </div>
            </div>
          </div>
        )}

        {isAssessmentLocked && (
          <div className="mb-8 rounded-[30px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                  <Lock size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    Internships are locked
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    Complete and pass the assessment to unlock internship
                    applications, scholarship discounts, payment flow, and your
                    internship ID generation.
                  </p>
                </div>
              </div>

              <button
                onClick={handleGoToAssessment}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 font-bold text-white shadow-lg transition hover:bg-amber-600"
              >
                Go to Assessment
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.6fr)]">
          <div className="space-y-6">
            <div className="rounded-[32px] bg-white p-5 shadow-lg sm:p-6">
              <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px_160px]">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder="Search internships..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 outline-none transition focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div className="relative">
                  <Filter
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <select
                    value={domainFilter}
                    onChange={(e) => setDomainFilter(e.target.value)}
                    className="h-14 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 outline-none transition focus:border-blue-500 focus:bg-white"
                  >
                    {domains.map((domain) => (
                      <option key={domain} value={domain}>
                        {domain}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <Building2
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="h-14 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 outline-none transition focus:border-blue-500 focus:bg-white"
                  >
                    <option value="All">All Types</option>
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Onsite">Onsite</option>
                  </select>
                </div>

                <button
                  onClick={handleRefresh}
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 font-bold text-white shadow-lg transition hover:scale-[1.01]"
                >
                  <RefreshCw
                    size={18}
                    className={refreshing ? "animate-spin" : ""}
                  />
                  Refresh
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {filteredInternships.length === 0 ? (
                <div className="rounded-[30px] border border-dashed border-slate-300 bg-white p-10 text-center shadow-lg">
                  <Briefcase className="mx-auto text-slate-400" size={42} />
                  <h3 className="mt-4 text-2xl font-black text-slate-900">
                    No internships found
                  </h3>
                  <p className="mt-2 text-slate-600">
                    Try changing your search or filters.
                  </p>
                </div>
              ) : (
                filteredInternships.map((internship) => {
                  const app = internship.myApplication;
                  const badge = getStatusBadge(app);
                  const isSelected =
                    String(selectedId) === String(internship._id);

                  return (
                    <button
                      key={internship._id}
                      onClick={() => setSelectedId(String(internship._id))}
                      className={[
                        "text-left rounded-[30px] border p-6 shadow-lg transition hover:-translate-y-1 hover:shadow-2xl",
                        isSelected
                          ? "border-blue-500 bg-blue-50/60"
                          : "border-slate-100 bg-white",
                      ].join(" ")}
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                              <Building2 size={14} />
                              {safeText(internship.companyName, "CyberNet")}
                            </span>

                            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                              {safeText(internship.internshipType, "Remote")}
                            </span>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </div>

                          <h2 className="mt-4 text-2xl font-black text-slate-900">
                            {safeText(internship.title, "Internship")}
                          </h2>

                          <p className="mt-3 line-clamp-2 max-w-4xl text-sm leading-6 text-slate-600">
                            {safeText(
                              internship.shortDescription || internship.description
                            )}
                          </p>

                          <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-600">
                            <span className="inline-flex items-center gap-2">
                              <MapPin size={16} />
                              {safeText(internship.location, "Remote")}
                            </span>
                            <span className="inline-flex items-center gap-2">
                              <Clock size={16} />
                              {safeText(internship.duration, "1 Month")}
                            </span>
                            <span className="inline-flex items-center gap-2">
                              <Users size={16} />
                              Seats: {internship.availableSeats ?? 0}
                            </span>
                            <span className="inline-flex items-center gap-2">
                              <CalendarDays size={16} />
                              Deadline: {formatDate(internship.applicationDeadline)}
                            </span>
                          </div>

                          <div className="mt-5 flex flex-wrap gap-2">
                            {(internship.skillsRequired || [])
                              .slice(0, 5)
                              .map((skill) => (
                                <span
                                  key={skill}
                                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                                >
                                  {skill}
                                </span>
                              ))}
                          </div>
                        </div>

                        <div className="shrink-0 lg:text-right">
                          <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-700">
                            <IndianRupee size={18} />
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                                Fee after discount
                              </p>
                              <p className="text-2xl font-black">
                                {app?.finalFee
                                  ? formatCurrency(app.finalFee)
                                  : formatCurrency(
                                      internship.internshipFee || 0
                                    )}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-start gap-2 lg:justify-end">
                            <Star
                              size={16}
                              className="fill-yellow-400 text-yellow-400"
                            />
                            <span className="text-sm font-semibold text-slate-600">
                              Scholarship {scholarshipPercentage}%
                            </span>
                          </div>

                          <div className="mt-4 flex items-center justify-start gap-2 lg:justify-end">
                            {app?.paymentCompleted ? (
                              <CheckCircle2
                                className="text-emerald-600"
                                size={16}
                              />
                            ) : (
                              <Rocket className="text-blue-600" size={16} />
                            )}
                            <span className="text-sm font-semibold text-slate-600">
                              {app?.paymentCompleted
                                ? "Payment completed"
                                : "Payment pending"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[32px] bg-white p-6 shadow-lg">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                    <Sparkles size={14} />
                    Selected Internship
                  </div>
                  <h3 className="mt-4 text-2xl font-black text-slate-900">
                    {selectedInternship
                      ? safeText(selectedInternship.title, "No internship selected")
                      : "No internship selected"}
                  </h3>
                </div>

                <button
                  onClick={() => {
                    if (selectedInternship?._id) {
                      setSelectedId(String(selectedInternship._id));
                    }
                  }}
                  className="rounded-2xl border border-slate-200 p-3 text-slate-600 transition hover:bg-slate-50"
                  title="Refresh selected internship"
                >
                  <RefreshCw size={18} />
                </button>
              </div>

              {selectedInternship ? (
                <div className="mt-6 space-y-5">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Company
                    </p>
                    <p className="mt-1 font-bold text-slate-900">
                      {safeText(selectedInternship.companyName, "CyberNet")}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Internship ID
                      </p>
                      <p className="mt-1 font-bold text-slate-900">
                        {safeText(selectedInternship.internshipCode, "—")}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Domain
                      </p>
                      <p className="mt-1 font-bold text-slate-900">
                        {safeText(selectedInternship.domain, "—")}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Duration
                      </p>
                      <p className="mt-1 font-bold text-slate-900">
                        {safeText(selectedInternship.duration, "—")}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Seats
                      </p>
                      <p className="mt-1 font-bold text-slate-900">
                        {selectedInternship.availableSeats ?? 0}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-blue-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                      Fee Breakdown
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <div className="flex items-center justify-between">
                        <span>Original Fee</span>
                        <span className="font-semibold">
                          {formatCurrency(selectedInternship.internshipFee || 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Scholarship</span>
                        <span className="font-semibold">
                          {scholarshipPercentage}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Discounted Amount</span>
                        <span className="font-semibold">
                          {formatCurrency(selectedApplication?.discountAmount || 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-blue-100 pt-2 text-base">
                        <span className="font-bold">Payable</span>
                        <span className="font-black text-blue-700">
                          {formatCurrency(
                            selectedApplication?.finalFee ??
                              selectedInternship.internshipFee ??
                              0
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Eligibility
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                        {isAssessmentLocked ? (
                          <Lock size={16} className="text-amber-600" />
                        ) : (
                          <CheckCircle2 size={16} className="text-emerald-600" />
                        )}
                        <span>
                          Assessment: {isAssessmentLocked ? "Locked" : "Passed"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedApplication?.paymentCompleted ? (
                          <CheckCircle2 size={16} className="text-emerald-600" />
                        ) : (
                          <Lock size={16} className="text-amber-600" />
                        )}
                        <span>
                          Payment:{" "}
                          {selectedApplication?.paymentCompleted
                            ? "Completed"
                            : "Pending"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                        <span>Admin-created internship only</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => handleApplyAndPay(selectedInternship)}
                      disabled={applyingId === String(selectedInternship._id)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-4 font-bold text-white shadow-lg transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {applyingId === String(selectedInternship._id) ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          Processing...
                        </>
                      ) : selectedApplication?.paymentCompleted ? (
                        <>
                          <BadgeCheck size={18} />
                          Paid
                        </>
                      ) : selectedApplication ? (
                        <>
                          <ExternalLink size={18} />
                          Resume Payment
                        </>
                      ) : (
                        <>
                          <Rocket size={18} />
                          Apply & Pay Now
                        </>
                      )}
                    </button>

                    {isAssessmentLocked && (
                      <button
                        onClick={handleGoToAssessment}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 font-bold text-amber-700 transition hover:bg-amber-100"
                      >
                        <ShieldAlert size={18} />
                        Complete Assessment First
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-6 text-center">
                  <Briefcase className="mx-auto text-slate-400" size={36} />
                  <p className="mt-3 font-semibold text-slate-700">
                    Select an internship to see details
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-[32px] bg-white p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900">
                  My Applications
                </h3>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {myApplications.length}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {myApplications.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                    No applications yet.
                  </div>
                ) : (
                  myApplications.slice(0, 5).map((item, index) => {
                    const internshipId =
                      item?.internship?._id ||
                      item?.internship ||
                      item?.internshipId ||
                      item?._id ||
                      index;

                    const app = item?.myApplication || item?.application || item;
                    const badge = getStatusBadge(app);

                    return (
                      <div
                        key={String(internshipId)}
                        className="rounded-2xl border border-slate-100 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-900">
                              {safeText(item.title || item.internship?.title, "Internship")}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {safeText(
                                item.companyName || item.internship?.companyName,
                                "CyberNet"
                              )}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-500">
                          <div>
                            Applied: {formatDate(app?.appliedAt || item.createdAt)}
                          </div>
                          <div>
                            Fee:{" "}
                            {formatCurrency(
                              app?.finalFee ||
                                item.finalFee ||
                                item.internshipFee ||
                                0
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-4">
          <div className="rounded-[28px] bg-white p-6 shadow-lg">
            <Briefcase className="text-blue-600" size={34} />
            <h3 className="mt-4 text-3xl font-black text-slate-900">
              {stats.totalInternships}
            </h3>
            <p className="mt-1 text-slate-500">Active internships</p>
          </div>

          <div className="rounded-[28px] bg-white p-6 shadow-lg">
            <Users className="text-emerald-600" size={34} />
            <h3 className="mt-4 text-3xl font-black text-slate-900">
              {stats.applications}
            </h3>
            <p className="mt-1 text-slate-500">Applications</p>
          </div>

          <div className="rounded-[28px] bg-white p-6 shadow-lg">
            <ShieldAlert className="text-amber-600" size={34} />
            <h3 className="mt-4 text-3xl font-black text-slate-900">
              {isAssessmentLocked ? "Locked" : "Open"}
            </h3>
            <p className="mt-1 text-slate-500">Access status</p>
          </div>

          <div className="rounded-[28px] bg-white p-6 shadow-lg">
            <BadgePercent className="text-violet-600" size={34} />
            <h3 className="mt-4 text-3xl font-black text-slate-900">
              {scholarshipPercentage}%
            </h3>
            <p className="mt-1 text-slate-500">Scholarship discount</p>
          </div>
        </div>

        <footer className="py-10 text-center text-sm text-slate-500">
          <p className="font-semibold text-slate-700">
            CyberNet Technology Systems
          </p>
          <p className="mt-1">
            Admin creates internships. Students can only view, apply, and pay after assessment.
          </p>
        </footer>
      </div>
    </div>
  );
}