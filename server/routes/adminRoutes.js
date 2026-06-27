const express = require("express");

const {
  authMiddleware,
  adminMiddleware,
} = require("../middleware/authMiddleware");

const Student = require("../models/Student");
const Assessment = require("../models/Assessment");
const Internship = require("../models/Internship");
const Payment = require("../models/Payment");
const Result = require("../models/Result");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const escapeRegex = (value) =>
  String(value || "").replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const dayKey = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeAccountStatus = (value) => {
  const status = String(value || "").trim().toLowerCase();

  if (
    [
      "active",
      "blocked",
      "suspended",
      "disabled",
    ].includes(status)
  ) {
    return status;
  }

  return null;
};

const buildStudentQuery = (query) => {
  const {
    search = "",
    role = "",
    accountStatus = "",
    isActive,
    assessmentCompleted,
    internshipUnlocked,
    paymentCompleted,
  } = query;

  const mongoQuery = {};

  if (role) {
    mongoQuery.role = role;
  }

  const normalizedStatus = normalizeAccountStatus(accountStatus);
  if (normalizedStatus) {
    mongoQuery.accountStatus = normalizedStatus;
  }

  if (typeof isActive !== "undefined" && isActive !== "") {
    mongoQuery.isActive =
      String(isActive).toLowerCase() === "true";
  }

  if (
    typeof assessmentCompleted !== "undefined" &&
    assessmentCompleted !== ""
  ) {
    mongoQuery.assessmentCompleted =
      String(assessmentCompleted).toLowerCase() === "true";
  }

  if (
    typeof internshipUnlocked !== "undefined" &&
    internshipUnlocked !== ""
  ) {
    mongoQuery.internshipUnlocked =
      String(internshipUnlocked).toLowerCase() === "true";
  }

  if (
    typeof paymentCompleted !== "undefined" &&
    paymentCompleted !== ""
  ) {
    mongoQuery.paymentCompleted =
      String(paymentCompleted).toLowerCase() === "true";
  }

  const trimmedSearch = String(search || "").trim();
  if (trimmedSearch) {
    const regex = new RegExp(escapeRegex(trimmedSearch), "i");

    mongoQuery.$or = [
      { firstName: regex },
      { lastName: regex },
      { email: regex },
      { mobile: regex },
      { college: regex },
      { collegeName: regex },
      { course: regex },
      { internshipDomain: regex },
      { year: regex },
    ];
  }

  return mongoQuery;
};

const buildPagination = (query) => {
  const page = Math.max(1, toNumber(query.page, 1));
  const limit = Math.min(
    100,
    Math.max(1, toNumber(query.limit, 20))
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

const safeArray = (value) => {
  return Array.isArray(value)
    ? value
    : [];
};

const summarizeStudent = (student) => {
  if (!student) return null;

  const firstName = student.firstName || "";
  const lastName = student.lastName || "";
  const fullName =
    `${firstName} ${lastName}`.trim() ||
    student.fullName ||
    student.email ||
    "Student";

  return {
    ...student,
    fullName,
    college: student.college || student.collegeName || "",
    status: student.accountStatus || "active",
  };
};

const buildRecentActivity = ({
  students = [],
  results = [],
  payments = [],
  internships = [],
}) => {
  const activity = [];

  students.forEach((student) => {
    activity.push({
      type: "student",
      title: "New student registered",
      description:
        `${student.firstName || ""} ${student.lastName || ""}`.trim() ||
        student.email ||
        "Student joined",
      meta: student.email || "",
      createdAt: student.createdAt,
    });
  });

  results.forEach((result) => {
    const studentName =
      `${result?.student?.firstName || ""} ${result?.student?.lastName || ""}`.trim() ||
      result?.student?.email ||
      "Student";

    activity.push({
      type: "assessment",
      title: "Assessment submitted",
      description: `${studentName} scored ${result.percentage || 0}%`,
      meta: result.resultId || "",
      createdAt: result.createdAt,
    });
  });

  payments.forEach((payment) => {
    const studentName =
      `${payment?.student?.firstName || ""} ${payment?.student?.lastName || ""}`.trim() ||
      payment?.student?.email ||
      "Student";

    activity.push({
      type: "payment",
      title: "Payment received",
      description: `${studentName} paid ₹${payment.finalAmount || 0}`,
      meta: payment.paymentStatus || "",
      createdAt: payment.createdAt,
    });
  });

  internships.forEach((internship) => {
    activity.push({
      type: "internship",
      title: "Internship published",
      description:
        internship.title ||
        internship.companyName ||
        internship.internshipCode ||
        "New internship created",
      meta: internship.domain || "",
      createdAt: internship.createdAt,
    });
  });

  return activity
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    )
    .slice(0, 20);
};

/*
|--------------------------------------------------------------------------
| Public
|--------------------------------------------------------------------------
*/

router.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    service: "CyberNet Admin API",
    status: "Running",
    timestamp: new Date().toISOString(),
  });
});

router.get("/routes", (req, res) => {
  return res.status(200).json({
    success: true,
    routes: [
      "/api/admin/dashboard",
      "/api/admin/analytics",
      "/api/admin/activity",
      "/api/admin/students",
      "/api/admin/students/:id",
      "/api/admin/students/:id/status",
      "/api/admin/students/:id/assessment",
      "/api/admin/assessments",
      "/api/admin/assessments/:id",
      "/api/admin/internships",
      "/api/admin/internships/:id",
      "/api/admin/payments",
      "/api/admin/results",
    ],
  });
});

/*
|--------------------------------------------------------------------------
| Protect All Admin Routes
|--------------------------------------------------------------------------
*/

router.use(authMiddleware);
router.use(adminMiddleware);

/*
|--------------------------------------------------------------------------
| Dashboard
|--------------------------------------------------------------------------
*/

router.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const [
      totalStudents,
      activeStudents,
      blockedStudents,
      suspendedStudents,
      assessmentCompleted,
      assessmentPassed,
      totalAssessments,
      totalInternships,
      activeInternships,
      totalPayments,
      successfulPayments,
      totalResults,
      averageScoreData,
      revenueData,
      topStudents,
      recentStudents,
      recentPayments,
      recentResults,
      recentInternships,
    ] = await Promise.all([
      Student.countDocuments(),
      Student.countDocuments({
        isActive: true,
        accountStatus: "active",
      }),
      Student.countDocuments({
        accountStatus: "blocked",
      }),
      Student.countDocuments({
        accountStatus: "suspended",
      }),
      Student.countDocuments({
        assessmentCompleted: true,
      }),
      Student.countDocuments({
        assessmentPassed: true,
      }),
      Assessment.countDocuments(),
      Internship.countDocuments(),
      Internship.countDocuments({
        isActive: true,
      }),
      Payment.countDocuments(),
      Payment.countDocuments({
        paymentStatus: "SUCCESS",
      }),
      Result.countDocuments(),
      Result.aggregate([
        {
          $group: {
            _id: null,
            avgScore: { $avg: "$percentage" },
          },
        },
      ]),
      Payment.aggregate([
        {
          $match: {
            paymentStatus: "SUCCESS",
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$finalAmount" },
          },
        },
      ]),
      Student.find({
        assessmentCompleted: true,
      })
        .select(
          "firstName lastName email assessmentScore scholarshipPercentage leaderboardPoints accountStatus isActive internshipUnlocked createdAt"
        )
        .sort({
          assessmentScore: -1,
          leaderboardPoints: -1,
          createdAt: -1,
        })
        .limit(5)
        .lean(),
      Student.find()
        .select(
          "firstName lastName email assessmentScore scholarshipPercentage leaderboardPoints accountStatus isActive internshipUnlocked createdAt"
        )
        .sort({
          createdAt: -1,
        })
        .limit(5)
        .lean(),
      Payment.find()
        .populate(
          "student",
          "firstName lastName email"
        )
        .populate("internship", "title companyName internshipCode")
        .sort({
          createdAt: -1,
        })
        .limit(5)
        .lean(),
      Result.find()
        .populate(
          "student",
          "firstName lastName email"
        )
        .sort({
          createdAt: -1,
        })
        .limit(5)
        .lean(),
      Internship.find()
        .sort({
          createdAt: -1,
        })
        .limit(5)
        .lean(),
    ]);

    const averageScore =
      averageScoreData?.[0]?.avgScore || 0;

    const revenue =
      revenueData?.[0]?.revenue || 0;

    const passRate =
      assessmentCompleted > 0
        ? Number(
            (
              (assessmentPassed / assessmentCompleted) *
              100
            ).toFixed(2)
          )
        : 0;

    return res.status(200).json({
      success: true,
      dashboard: {
        totals: {
          students: totalStudents,
          activeStudents,
          blockedStudents,
          suspendedStudents,
          assessments: totalAssessments,
          internships: totalInternships,
          activeInternships,
          payments: totalPayments,
          successfulPayments,
          results: totalResults,
        },
        performance: {
          assessmentCompleted,
          assessmentPassed,
          passRate,
          averageScore: Number(averageScore.toFixed(2)),
        },
        revenue: {
          total: revenue,
        },
        topStudents: safeArray(topStudents).map(summarizeStudent),
        recentStudents: safeArray(recentStudents).map(summarizeStudent),
        recentPayments,
        recentResults,
        recentInternships,
      },
    });
  })
);

/*
|--------------------------------------------------------------------------
| Analytics
|--------------------------------------------------------------------------
*/

router.get(
  "/analytics",
  asyncHandler(async (req, res) => {
    const days = Math.min(30, Math.max(7, toNumber(req.query.days, 7)));
    const today = startOfDay(new Date());
    const startDate = addDays(today, -(days - 1));

    const [studentSeries, paymentSeries, resultSeries] =
      await Promise.all([
        Student.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$createdAt",
                },
              },
              count: { $sum: 1 },
            },
          },
          {
            $sort: {
              _id: 1,
            },
          },
        ]),
        Payment.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$createdAt",
                },
              },
              count: { $sum: 1 },
              revenue: {
                $sum: {
                  $cond: [
                    { $eq: ["$paymentStatus", "SUCCESS"] },
                    "$finalAmount",
                    0,
                  ],
                },
              },
            },
          },
          {
            $sort: {
              _id: 1,
            },
          },
        ]),
        Result.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$createdAt",
                },
              },
              count: { $sum: 1 },
              avgScore: { $avg: "$percentage" },
            },
          },
          {
            $sort: {
              _id: 1,
            },
          },
        ]),
      ]);

    const studentMap = new Map(
      studentSeries.map((item) => [item._id, item.count])
    );
    const paymentMap = new Map(
      paymentSeries.map((item) => [
        item._id,
        {
          count: item.count,
          revenue: item.revenue || 0,
        },
      ])
    );
    const resultMap = new Map(
      resultSeries.map((item) => [
        item._id,
        {
          count: item.count,
          avgScore: item.avgScore || 0,
        },
      ])
    );

    const timeline = [];
    let totalRevenue = 0;

    for (let i = 0; i < days; i += 1) {
      const current = addDays(startDate, i);
      const key = dayKey(current);

      const payment = paymentMap.get(key) || {
        count: 0,
        revenue: 0,
      };
      const result = resultMap.get(key) || {
        count: 0,
        avgScore: 0,
      };

      totalRevenue += payment.revenue || 0;

      timeline.push({
        date: key,
        students: studentMap.get(key) || 0,
        payments: payment.count,
        revenue: payment.revenue || 0,
        assessments: result.count,
        avgScore: Number((result.avgScore || 0).toFixed(2)),
      });
    }

    return res.status(200).json({
      success: true,
      analytics: {
        rangeDays: days,
        startDate,
        endDate: today,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        timeline,
      },
    });
  })
);

/*
|--------------------------------------------------------------------------
| Activity Feed
|--------------------------------------------------------------------------
*/

router.get(
  "/activity",
  asyncHandler(async (req, res) => {
    const [
      recentStudents,
      recentResults,
      recentPayments,
      recentInternships,
    ] = await Promise.all([
      Student.find()
        .select(
          "firstName lastName email createdAt"
        )
        .sort({
          createdAt: -1,
        })
        .limit(10)
        .lean(),
      Result.find()
        .populate(
          "student",
          "firstName lastName email"
        )
        .sort({
          createdAt: -1,
        })
        .limit(10)
        .lean(),
      Payment.find()
        .populate(
          "student",
          "firstName lastName email"
        )
        .sort({
          createdAt: -1,
        })
        .limit(10)
        .lean(),
      Internship.find()
        .sort({
          createdAt: -1,
        })
        .limit(10)
        .lean(),
    ]);

    const activity = buildRecentActivity({
      students: recentStudents,
      results: recentResults,
      payments: recentPayments,
      internships: recentInternships,
    });

    return res.status(200).json({
      success: true,
      count: activity.length,
      activity,
    });
  })
);

/*
|--------------------------------------------------------------------------
| Students
|--------------------------------------------------------------------------
*/

router.get(
  "/students",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const mongoQuery = buildStudentQuery(req.query);

    const [students, total] = await Promise.all([
      Student.find(mongoQuery)
        .select(
          "firstName lastName email mobile college collegeName course year internshipDomain role accountStatus isActive assessmentCompleted assessmentPassed assessmentScore scholarshipPercentage internshipUnlocked paymentCompleted certificateEligible leaderboardPoints loginCount lastLogin createdAt updatedAt"
        )
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),
      Student.countDocuments(mongoQuery),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.status(200).json({
      success: true,
      count: students.length,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      students: students.map(summarizeStudent),
    });
  })
);

router.get(
  "/students/:id",
  asyncHandler(async (req, res) => {
    const student = await Student.findById(req.params.id)
      .select("-password")
      .lean();

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      student: summarizeStudent(student),
    });
  })
);

router.patch(
  "/students/:id/status",
  asyncHandler(async (req, res) => {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const nextStatus =
      normalizeAccountStatus(req.body.accountStatus) ||
      normalizeAccountStatus(req.body.status);

    if (nextStatus) {
      student.accountStatus = nextStatus;
    }

    if (typeof req.body.isActive !== "undefined") {
      student.isActive =
        String(req.body.isActive).toLowerCase() === "true";
    }

    if (typeof req.body.role === "string" && req.body.role.trim()) {
      student.role = req.body.role.trim();
    }

    if (typeof req.body.reason === "string") {
      student.accountStatusReason = req.body.reason.trim();
    }

    student.updatedBy = "CyberNet Admin";
    student.updatedAt = new Date();

    await student.save();

    return res.status(200).json({
      success: true,
      message: "Student status updated successfully",
      student: summarizeStudent(
        await Student.findById(student._id).select("-password").lean()
      ),
    });
  })
);

router.patch(
  "/students/:id/assessment",
  asyncHandler(async (req, res) => {
    const studentId = req.params.id;
    const score = toNumber(req.body.assessmentScore, null);

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    if (score !== null) {
      const safeScore = Math.min(100, Math.max(0, score));
      const scholarship =
        safeScore >= 95
          ? 50
          : safeScore >= 90
          ? 30
          : safeScore >= 85
          ? 20
          : safeScore >= 80
          ? 10
          : safeScore >= 60
          ? 5
          : 0;

      const passed = safeScore >= 40;

      student.assessmentScore = safeScore;
      student.assessmentCompleted = true;
      student.assessmentPassed = passed;
      student.assessmentCompletedAt = new Date();
      student.scholarshipPercentage = scholarship;
      student.scholarshipEligible = scholarship > 0;
      student.internshipUnlocked = passed;
      student.certificateEligible = passed;
    }

    if (typeof req.body.leaderboardPoints !== "undefined") {
      student.leaderboardPoints = toNumber(
        req.body.leaderboardPoints,
        student.leaderboardPoints || 0
      );
    }

    student.updatedBy = "CyberNet Admin";
    student.updatedAt = new Date();

    await student.save();

    return res.status(200).json({
      success: true,
      message: "Assessment data updated successfully",
      student: summarizeStudent(
        await Student.findById(studentId).select("-password").lean()
      ),
    });
  })
);

router.delete(
  "/students/:id",
  asyncHandler(async (req, res) => {
    const student = await Student.findByIdAndDelete(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student deleted successfully",
    });
  })
);

/*
|--------------------------------------------------------------------------
| Assessments
|--------------------------------------------------------------------------
*/

router.get(
  "/assessments",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const search = String(req.query.search || "").trim();

    const mongoQuery = {};
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      mongoQuery.$or = [
        { assessmentName: regex },
        { title: regex },
        { assessmentCode: regex },
        { domain: regex },
      ];
    }

    const [assessments, total] = await Promise.all([
      Assessment.find(mongoQuery)
        .populate("questions")
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),
      Assessment.countDocuments(mongoQuery),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.status(200).json({
      success: true,
      count: assessments.length,
      total,
      page,
      limit,
      totalPages,
      assessments,
    });
  })
);

router.post(
  "/assessments",
  asyncHandler(async (req, res) => {
    const assessment = await Assessment.create(req.body);

    return res.status(201).json({
      success: true,
      message: "Assessment created successfully",
      assessment,
    });
  })
);

router.patch(
  "/assessments/:id",
  asyncHandler(async (req, res) => {
    const assessment = await Assessment.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedBy: "CyberNet Admin",
      },
      {
        new: true,
        runValidators: true,
      }
    ).lean();

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Assessment updated successfully",
      assessment,
    });
  })
);

router.delete(
  "/assessments/:id",
  asyncHandler(async (req, res) => {
    const assessment = await Assessment.findByIdAndDelete(
      req.params.id
    );

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Assessment deleted successfully",
    });
  })
);

/*
|--------------------------------------------------------------------------
| Internships
|--------------------------------------------------------------------------
*/

router.get(
  "/internships",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const search = String(req.query.search || "").trim();

    const mongoQuery = {};
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      mongoQuery.$or = [
        { title: regex },
        { internshipTitle: regex },
        { internshipCode: regex },
        { companyName: regex },
        { domain: regex },
      ];
    }

    if (typeof req.query.isActive !== "undefined" && req.query.isActive !== "") {
      mongoQuery.isActive =
        String(req.query.isActive).toLowerCase() === "true";
    }

    const [internships, total] = await Promise.all([
      Internship.find(mongoQuery)
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),
      Internship.countDocuments(mongoQuery),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.status(200).json({
      success: true,
      count: internships.length,
      total,
      page,
      limit,
      totalPages,
      internships,
    });
  })
);

router.post(
  "/internships",
  asyncHandler(async (req, res) => {
    const internship = await Internship.create(req.body);

    return res.status(201).json({
      success: true,
      message: "Internship created successfully",
      internship,
    });
  })
);

router.patch(
  "/internships/:id",
  asyncHandler(async (req, res) => {
    const internship = await Internship.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedBy: "CyberNet Admin",
      },
      {
        new: true,
        runValidators: true,
      }
    ).lean();

    if (!internship) {
      return res.status(404).json({
        success: false,
        message: "Internship not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Internship updated successfully",
      internship,
    });
  })
);

router.delete(
  "/internships/:id",
  asyncHandler(async (req, res) => {
    const internship = await Internship.findByIdAndDelete(
      req.params.id
    );

    if (!internship) {
      return res.status(404).json({
        success: false,
        message: "Internship not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Internship deleted successfully",
    });
  })
);

/*
|--------------------------------------------------------------------------
| Payments
|--------------------------------------------------------------------------
*/

router.get(
  "/payments",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const search = String(req.query.search || "").trim();

    const paymentsQuery = {};

    if (typeof req.query.paymentStatus !== "undefined" && req.query.paymentStatus !== "") {
      paymentsQuery.paymentStatus = req.query.paymentStatus;
    }

    const payments = await Payment.find(paymentsQuery)
      .populate(
        "student",
        "firstName lastName email"
      )
      .populate(
        "internship",
        "title companyName internshipCode"
      )
      .sort({
        createdAt: -1,
      })
      .lean();

    let filtered = payments;

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");

      filtered = payments.filter((payment) => {
        const studentName =
          `${payment?.student?.firstName || ""} ${payment?.student?.lastName || ""}`.trim();

        return (
          regex.test(payment?.razorpayOrderId || "") ||
          regex.test(payment?.razorpayPaymentId || "") ||
          regex.test(payment?.paymentId || "") ||
          regex.test(payment?.email || "") ||
          regex.test(studentName) ||
          regex.test(payment?.student?.email || "") ||
          regex.test(payment?.internship?.title || "") ||
          regex.test(payment?.internship?.companyName || "")
        );
      });
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const paged = filtered.slice(skip, skip + limit);

    return res.status(200).json({
      success: true,
      count: paged.length,
      total,
      page,
      limit,
      totalPages,
      payments: paged,
    });
  })
);

/*
|--------------------------------------------------------------------------
| Results
|--------------------------------------------------------------------------
*/

router.get(
  "/results",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const search = String(req.query.search || "").trim();

    const results = await Result.find()
      .populate(
        "student",
        "firstName lastName email"
      )
      .populate(
        "assessment",
        "assessmentName title domain assessmentCode"
      )
      .sort({
        createdAt: -1,
      })
      .lean();

    let filtered = results;

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");

      filtered = results.filter((result) => {
        const studentName =
          `${result?.student?.firstName || ""} ${result?.student?.lastName || ""}`.trim();

        return (
          regex.test(result?.resultId || "") ||
          regex.test(studentName) ||
          regex.test(result?.student?.email || "") ||
          regex.test(result?.assessment?.assessmentName || "") ||
          regex.test(result?.assessment?.title || "") ||
          regex.test(result?.assessment?.assessmentCode || "")
        );
      });
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const paged = filtered.slice(skip, skip + limit);

    return res.status(200).json({
      success: true,
      count: paged.length,
      total,
      page,
      limit,
      totalPages,
      results: paged,
    });
  })
);

/*
|--------------------------------------------------------------------------
| Recent Activity Alias
|--------------------------------------------------------------------------
*/

router.get(
  "/recent-activity",
  asyncHandler(async (req, res) => {
    const [recentStudents, recentResults, recentPayments, recentInternships] =
      await Promise.all([
        Student.find()
          .select(
            "firstName lastName email createdAt"
          )
          .sort({
            createdAt: -1,
          })
          .limit(10)
          .lean(),
        Result.find()
          .populate(
            "student",
            "firstName lastName email"
          )
          .sort({
            createdAt: -1,
          })
          .limit(10)
          .lean(),
        Payment.find()
          .populate(
            "student",
            "firstName lastName email"
          )
          .sort({
            createdAt: -1,
          })
          .limit(10)
          .lean(),
        Internship.find()
          .sort({
            createdAt: -1,
          })
          .limit(10)
          .lean(),
      ]);

    const activity = buildRecentActivity({
      students: recentStudents,
      results: recentResults,
      payments: recentPayments,
      internships: recentInternships,
    });

    return res.status(200).json({
      success: true,
      count: activity.length,
      activity,
    });
  })
);

module.exports = router;