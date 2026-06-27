const mongoose = require("mongoose");
const crypto = require("crypto");

const Internship = require("../models/Internship");
const Student = require("../models/Student");

let Assessment = null;
try {
  Assessment = require("../models/Assessment");
} catch (error) {
  Assessment = null;
}

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : value;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value);

const normalizeArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeText(item))
    .filter(Boolean);
};

const getScholarshipDiscount = (
  amount,
  percentage
) => {
  const base = Math.max(toNumber(amount, 0), 0);
  const pct = Math.max(
    Math.min(toNumber(percentage, 0), 100),
    0
  );

  const discount = Math.round(
    (base * pct) / 100
  );

  return Math.min(discount, base);
};

const generateStudentInternshipId = () => {
  const year = new Date().getFullYear();
  const random = crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase();

  return `CNT-INT-${year}-${random}`;
};

const populateInternship = async (
  internship,
  studentId = null
) => {
  const doc = await internship.populate([
    {
      path: "assessmentId",
      select: "assessmentName domain duration",
    },
    {
      path: "applications.student",
      select: `
        firstName
        lastName
        email
        mobile
        college
        course
        year
        internshipDomain
        profileImage
        assessmentScore
        scholarshipPercentage
        internshipStatus
        paymentStatus
      `,
    },
  ]);

  const obj = doc.toObject({
    virtuals: true,
  });

  if (studentId) {
    obj.myApplication =
      obj.applications.find(
        (app) =>
          String(
            app.student?._id ||
              app.student
          ) === String(studentId)
      ) || null;
  }

  return obj;
};

const getApplicationByStudentId = (
  internship,
  studentId
) => {
  return internship.applications.find(
    (app) =>
      String(app.student) ===
      String(studentId)
  );
};

const ensureAssessmentEligibility =
  async (student, internship) => {
    if (!internship.assessmentRequired) {
      return {
        ok: true,
      };
    }

    if (
      !student.assessmentCompleted ||
      !student.assessmentPassed ||
      !student.internshipUnlocked
    ) {
      return {
        ok: false,
        message:
          "Complete and pass the assessment first.",
      };
    }

    if (
      toNumber(student.assessmentScore, 0) <
      toNumber(
        internship.minimumScoreRequired,
        60
      )
    ) {
      return {
        ok: false,
        message:
          "Your assessment score is below the minimum required score for this internship.",
      };
    }

    return {
      ok: true,
    };
  };

const getSortObject = (
  sortBy = "createdAt",
  sortOrder = "desc"
) => {
  const order =
    String(sortOrder).toLowerCase() ===
    "asc"
      ? 1
      : -1;

  const sort = {};

  sort[sortBy] = order;

  return sort;
};

/*
|--------------------------------------------------------------------------
| CREATE INTERNSHIP
|--------------------------------------------------------------------------
*/

const createInternship = async (
  req,
  res
) => {
  try {
    const {
      title,
      internshipCode,
      domain,
      subDomain,
      description,
      shortDescription,
      companyName,
      companyWebsite,
      companyLogo,
      skillsRequired,
      technologies,
      duration,
      internshipFee,
      stipend,
      scholarshipEnabled,
      internshipType,
      location,
      seats,
      applicationDeadline,
      startDate,
      endDate,
      assessmentRequired,
      assessmentId,
      minimumScoreRequired,
      mentorName,
      mentorEmail,
      certificateProvided,
      offerLetterProvided,
      experienceLetterProvided,
      completionCertificate,
      projectRequired,
      finalProjectTitle,
      liveClasses,
      aiMentorEnabled,
      codingPracticeEnabled,
      leaderboardEnabled,
      isFeatured,
      status,
      isActive,
      createdBy,
    } = req.body;

    if (
      !title ||
      !domain ||
      !description ||
      !applicationDeadline
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Required fields missing",
      });
    }

    const seatsCount = Math.max(
      toNumber(seats, 100),
      1
    );

    const deadline = new Date(
      applicationDeadline
    );

    if (
      Number.isNaN(deadline.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid application deadline",
      });
    }

    const normalizedCode = internshipCode
      ? String(internshipCode)
          .trim()
          .toUpperCase()
      : "";

    if (normalizedCode) {
      const existingInternship =
        await Internship.findOne({
          internshipCode:
            normalizedCode,
        });

      if (existingInternship) {
        return res.status(400).json({
          success: false,
          message:
            "Internship code already exists",
        });
      }
    }

    if (
      assessmentRequired &&
      assessmentId &&
      Assessment
    ) {
      if (
        !isValidObjectId(assessmentId)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid assessment ID",
        });
      }

      const assessment =
        await Assessment.findById(
          assessmentId
        );

      if (!assessment) {
        return res.status(404).json({
          success: false,
          message:
            "Assessment not found",
        });
      }
    }

    const internship =
      await Internship.create({
        title: normalizeText(title),
        internshipCode:
          normalizedCode || undefined,
        domain: normalizeText(domain),
        subDomain: normalizeText(
          subDomain
        ),
        description:
          normalizeText(description),
        shortDescription:
          normalizeText(shortDescription),
        companyName: normalizeText(
          companyName
        ),
        companyWebsite: normalizeText(
          companyWebsite
        ),
        companyLogo: normalizeText(
          companyLogo
        ),
        skillsRequired:
          normalizeArray(
            skillsRequired
          ),
        technologies:
          normalizeArray(
            technologies
          ),
        duration: normalizeText(
          duration || "1 Month"
        ),
        internshipFee: Math.max(
          toNumber(
            internshipFee,
            0
          ),
          0
        ),
        stipend: Math.max(
          toNumber(stipend, 0),
          0
        ),
        scholarshipEnabled:
          typeof scholarshipEnabled ===
          "boolean"
            ? scholarshipEnabled
            : scholarshipEnabled !==
              "false",
        internshipType:
          normalizeText(
            internshipType || "Remote"
          ),
        location: normalizeText(
          location || "Remote"
        ),
        seats: seatsCount,
        availableSeats: seatsCount,
        applicationDeadline: deadline,
        startDate: startDate
          ? new Date(startDate)
          : null,
        endDate: endDate
          ? new Date(endDate)
          : null,
        assessmentRequired:
          typeof assessmentRequired ===
          "boolean"
            ? assessmentRequired
            : assessmentRequired !==
              "false",
        assessmentId:
          assessmentId || null,
        minimumScoreRequired: Math.min(
          Math.max(
            toNumber(
              minimumScoreRequired,
              60
            ),
            0
          ),
          100
        ),
        mentorName: normalizeText(
          mentorName
        ),
        mentorEmail: normalizeText(
          mentorEmail
        ),
        certificateProvided:
          typeof certificateProvided ===
          "boolean"
            ? certificateProvided
            : certificateProvided !==
              "false",
        offerLetterProvided:
          typeof offerLetterProvided ===
          "boolean"
            ? offerLetterProvided
            : offerLetterProvided !==
              "false",
        experienceLetterProvided:
          typeof experienceLetterProvided ===
          "boolean"
            ? experienceLetterProvided
            : experienceLetterProvided !==
              "false",
        completionCertificate:
          typeof completionCertificate ===
          "boolean"
            ? completionCertificate
            : completionCertificate !==
              "false",
        projectRequired:
          typeof projectRequired ===
          "boolean"
            ? projectRequired
            : projectRequired !==
              "false",
        finalProjectTitle:
          normalizeText(
            finalProjectTitle
          ),
        liveClasses:
          typeof liveClasses ===
          "boolean"
            ? liveClasses
            : liveClasses === "true",
        aiMentorEnabled:
          typeof aiMentorEnabled ===
          "boolean"
            ? aiMentorEnabled
            : aiMentorEnabled !==
              "false",
        codingPracticeEnabled:
          typeof codingPracticeEnabled ===
          "boolean"
            ? codingPracticeEnabled
            : codingPracticeEnabled !==
              "false",
        leaderboardEnabled:
          typeof leaderboardEnabled ===
          "boolean"
            ? leaderboardEnabled
            : leaderboardEnabled !==
              "false",
        isFeatured:
          typeof isFeatured === "boolean"
            ? isFeatured
            : isFeatured === "true",
        status: status || "ACTIVE",
        isActive:
          typeof isActive === "boolean"
            ? isActive
            : isActive !== "false",
        createdBy:
          normalizeText(
            createdBy ||
              req.user?.email ||
              "CyberNet Admin"
          ),
        updatedBy:
          normalizeText(
            req.user?.email ||
              createdBy ||
              "CyberNet Admin"
          ),
      });

    return res.status(201).json({
      success: true,
      message:
        "Internship created successfully",
      internship,
    });
  } catch (error) {
    console.error(
      "CREATE INTERNSHIP ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET ALL INTERNSHIPS
|--------------------------------------------------------------------------
*/

const getAllInternships = async (
  req,
  res
) => {
  try {
    const {
      q,
      domain,
      internshipType,
      status,
      isFeatured,
      scholarshipEnabled,
      assessmentRequired,
      includeInactive,
      companyName,
      page = 1,
      limit = 12,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {};

    const isAdmin =
      req.user?.role === "admin";

    if (
      includeInactive !== "true" ||
      !isAdmin
    ) {
      query.isActive = true;
    }

    if (q) {
      const search = new RegExp(
        String(q).trim(),
        "i"
      );

      query.$or = [
        { title: search },
        { internshipCode: search },
        { domain: search },
        { subDomain: search },
        { companyName: search },
        { shortDescription: search },
      ];
    }

    if (domain) {
      query.domain = new RegExp(
        `^${String(domain).trim()}$`,
        "i"
      );
    }

    if (internshipType) {
      query.internshipType =
        new RegExp(
          `^${String(
            internshipType
          ).trim()}$`,
          "i"
        );
    }

    if (status) {
      query.status =
        new RegExp(
          `^${String(status).trim()}$`,
          "i"
        );
    }

    if (
      isFeatured === "true" ||
      isFeatured === true
    ) {
      query.isFeatured = true;
    }

    if (
      scholarshipEnabled === "true" ||
      scholarshipEnabled === false
    ) {
      query.scholarshipEnabled =
        scholarshipEnabled === "true";
    }

    if (
      assessmentRequired === "true" ||
      assessmentRequired === false
    ) {
      query.assessmentRequired =
        assessmentRequired === "true";
    }

    if (companyName) {
      query.companyName = new RegExp(
        String(companyName).trim(),
        "i"
      );
    }

    const pageNumber = Math.max(
      parseInt(page, 10) || 1,
      1
    );
    const pageSize = Math.min(
      Math.max(
        parseInt(limit, 10) || 12,
        1
      ),
      100
    );
    const skip = (pageNumber - 1) * pageSize;

    const total = await Internship.countDocuments(
      query
    );

    const internships =
      await Internship.find(query)
        .populate(
          "assessmentId",
          "assessmentName domain duration"
        )
        .sort(
          getSortObject(
            sortBy,
            sortOrder
          )
        )
        .skip(skip)
        .limit(pageSize);

    const items =
      await Promise.all(
        internships.map(async (doc) =>
          populateInternship(
            doc,
            req.user?.id || null
          )
        )
      );

    return res.status(200).json({
      success: true,
      count: items.length,
      total,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.max(
        Math.ceil(total / pageSize),
        1
      ),
      internships: items,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET INTERNSHIP BY ID
|--------------------------------------------------------------------------
*/

const getInternshipById = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid internship ID",
      });
    }

    const internship =
      await Internship.findById(id);

    if (!internship) {
      return res.status(404).json({
        success: false,
        message:
          "Internship not found",
      });
    }

    if (
      !internship.isActive &&
      req.user?.role !== "admin"
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Internship not found",
      });
    }

    const detailed =
      await populateInternship(
        internship,
        req.user?.id || null
      );

    return res.status(200).json({
      success: true,
      internship: detailed,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| APPLY INTERNSHIP
|--------------------------------------------------------------------------
*/

const applyInternship = async (
  req,
  res
) => {
  try {
    const studentId = req.user?.id;
    const { id } = req.params;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid internship ID",
      });
    }

    const [internship, student] =
      await Promise.all([
        Internship.findById(id),
        Student.findById(studentId),
      ]);

    if (!internship) {
      return res.status(404).json({
        success: false,
        message:
          "Internship not found",
      });
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found",
      });
    }

    if (
      !internship.isActive ||
      internship.status !== "ACTIVE"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Internship is not active",
      });
    }

    const deadline =
      internship.applicationDeadline
        ? new Date(
            internship.applicationDeadline
          )
        : null;

    if (
      deadline &&
      new Date() > deadline
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Application deadline has passed",
      });
    }

    if (
      internship.availableSeats <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "No seats available",
      });
    }

    const eligibility =
      await ensureAssessmentEligibility(
        student,
        internship
      );

    if (!eligibility.ok) {
      return res.status(403).json({
        success: false,
        message:
          eligibility.message,
      });
    }

    if (
      student.currentInternship &&
      [
        "Applied",
        "Selected",
        "In Progress",
      ].includes(student.internshipStatus)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You already have an active internship flow.",
      });
    }

    const existingApplication =
      getApplicationByStudentId(
        internship,
        studentId
      );

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message:
          "Already applied for this internship",
      });
    }

    const originalFee = Math.max(
      toNumber(
        internship.internshipFee,
        0
      ),
      0
    );

    const scholarshipPercentage =
      internship.scholarshipEnabled
        ? Math.max(
            Math.min(
              toNumber(
                student.scholarshipPercentage,
                0
              ),
              100
            ),
            0
          )
        : 0;

    const discountAmount =
      getScholarshipDiscount(
        originalFee,
        scholarshipPercentage
      );

    const finalFee = Math.max(
      originalFee - discountAmount,
      0
    );

    internship.applications.push({
      student: student._id,
      internshipId:
        student.internshipId || "",
      assessmentScore:
        toNumber(
          student.assessmentScore,
          0
        ),
      scholarshipPercentage,
      originalFee,
      discountAmount,
      finalFee,
      paymentCompleted: false,
      paymentStatus: "PENDING",
      status: "Applied",
      appliedAt: new Date(),
    });

    internship.availableSeats = Math.max(
      internship.availableSeats - 1,
      0
    );

    student.internshipApplicationsCount =
      toNumber(
        student.internshipApplicationsCount,
        0
      ) + 1;

    student.internshipStatus = "Applied";
    student.internshipUnlocked = true;
    student.scholarshipEligible =
      scholarshipPercentage > 0;
    student.appliedInternshipAt =
      new Date();
    student.paymentCompleted = false;
    student.paymentStatus = "PENDING";
    student.paidAmount = 0;

    await Promise.all([
      internship.save(),
      student.save(),
    ]);

    const updated =
      await Internship.findById(
        internship._id
      );

    const responseInternship =
      await populateInternship(
        updated,
        studentId
      );

    const application =
      getApplicationByStudentId(
        updated,
        studentId
      );

    return res.status(201).json({
      success: true,
      message:
        "Application submitted successfully",
      internship: responseInternship,
      application,
      feeBreakdown: {
        originalFee,
        scholarshipPercentage,
        discountAmount,
        finalFee,
      },
    });
  } catch (error) {
    console.error(
      "APPLY INTERNSHIP ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| STUDENT INTERNSHIPS
|--------------------------------------------------------------------------
*/

const getStudentInternships = async (
  req,
  res
) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    const internships =
      await Internship.find({
        "applications.student":
          studentId,
      })
        .sort({
          createdAt: -1,
        })
        .populate(
          "assessmentId",
          "assessmentName domain duration"
        )
        .populate(
          "applications.student",
          "firstName lastName email mobile college course year internshipDomain profileImage"
        );

    const items =
      internships.map((doc) => {
        const obj = doc.toObject({
          virtuals: true,
        });

        obj.myApplication =
          obj.applications.find(
            (app) =>
              String(
                app.student?._id ||
                  app.student
              ) === String(studentId)
          ) || null;

        return obj;
      });

    return res.status(200).json({
      success: true,
      count: items.length,
      internships: items,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET MY APPLICATIONS
|--------------------------------------------------------------------------
*/

const getMyApplications =
  getStudentInternships;

/*
|--------------------------------------------------------------------------
| GET INTERNSHIP APPLICANTS
|--------------------------------------------------------------------------
*/

const getInternshipApplicants = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid internship ID",
      });
    }

    const internship =
      await Internship.findById(id)
        .populate(
          "applications.student",
          `
          firstName
          lastName
          email
          mobile
          college
          course
          year
          internshipDomain
          profileImage
          assessmentScore
          scholarshipPercentage
          internshipStatus
          paymentStatus
          internshipId
          `
        )
        .populate(
          "assessmentId",
          "assessmentName domain duration"
        );

    if (!internship) {
      return res.status(404).json({
        success: false,
        message:
          "Internship not found",
      });
    }

    const applicants =
      internship.applications
        .slice()
        .sort((a, b) => {
          const aDate =
            new Date(a.appliedAt || 0)
              .getTime();
          const bDate =
            new Date(b.appliedAt || 0)
              .getTime();
          return bDate - aDate;
        });

    return res.status(200).json({
      success: true,
      totalApplicants:
        applicants.length,
      selectedStudents:
        internship.selectedStudents,
      completedStudents:
        internship.completedStudents,
      applicants,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE INTERNSHIP
|--------------------------------------------------------------------------
*/

const updateInternship = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid internship ID",
      });
    }

    const internship =
      await Internship.findById(id);

    if (!internship) {
      return res.status(404).json({
        success: false,
        message:
          "Internship not found",
      });
    }

    const allowedFields = [
      "title",
      "domain",
      "subDomain",
      "description",
      "shortDescription",
      "companyName",
      "companyWebsite",
      "companyLogo",
      "skillsRequired",
      "technologies",
      "duration",
      "internshipFee",
      "stipend",
      "scholarshipEnabled",
      "internshipType",
      "location",
      "seats",
      "availableSeats",
      "applicationDeadline",
      "startDate",
      "endDate",
      "assessmentRequired",
      "assessmentId",
      "minimumScoreRequired",
      "mentorName",
      "mentorEmail",
      "certificateProvided",
      "offerLetterProvided",
      "experienceLetterProvided",
      "completionCertificate",
      "projectRequired",
      "finalProjectTitle",
      "liveClasses",
      "aiMentorEnabled",
      "codingPracticeEnabled",
      "leaderboardEnabled",
      "isFeatured",
      "status",
      "isActive",
      "updatedBy",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (updates.seats !== undefined) {
      const newSeats = Math.max(
        toNumber(updates.seats, 0),
        1
      );

      const filledSeats =
        internship.seats -
        internship.availableSeats;

      if (newSeats < filledSeats) {
        return res.status(400).json({
          success: false,
          message:
            "Seats cannot be less than the number of already filled seats",
        });
      }

      internship.seats = newSeats;
      internship.availableSeats = Math.max(
        newSeats - filledSeats,
        0
      );

      delete updates.seats;
    }

    if (
      updates.availableSeats !== undefined
    ) {
      const seatCount = Math.max(
        toNumber(
          updates.availableSeats,
          0
        ),
        0
      );

      internship.availableSeats = Math.min(
        seatCount,
        internship.seats
      );

      delete updates.availableSeats;
    }

    if (
      updates.applicationDeadline !==
      undefined
    ) {
      const deadline = new Date(
        updates.applicationDeadline
      );

      if (
        Number.isNaN(
          deadline.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid application deadline",
        });
      }

      internship.applicationDeadline =
        deadline;

      delete updates.applicationDeadline;
    }

    if (updates.startDate !== undefined) {
      internship.startDate = updates.startDate
        ? new Date(updates.startDate)
        : null;
      delete updates.startDate;
    }

    if (updates.endDate !== undefined) {
      internship.endDate = updates.endDate
        ? new Date(updates.endDate)
        : null;
      delete updates.endDate;
    }

    if (
      updates.assessmentId !== undefined &&
      updates.assessmentId !== null &&
      updates.assessmentId !== ""
    ) {
      if (
        !isValidObjectId(
          updates.assessmentId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid assessment ID",
        });
      }
    }

    const scalarFields = [
      "title",
      "domain",
      "subDomain",
      "description",
      "shortDescription",
      "companyName",
      "companyWebsite",
      "companyLogo",
      "duration",
      "internshipFee",
      "stipend",
      "internshipType",
      "location",
      "minimumScoreRequired",
      "mentorName",
      "mentorEmail",
      "finalProjectTitle",
      "status",
      "createdBy",
      "updatedBy",
    ];

    for (const field of scalarFields) {
      if (updates[field] !== undefined) {
        internship[field] = updates[field];
      }
    }

    if (updates.skillsRequired !== undefined) {
      internship.skillsRequired =
        normalizeArray(
          updates.skillsRequired
        );
    }

    if (updates.technologies !== undefined) {
      internship.technologies =
        normalizeArray(
          updates.technologies
        );
    }

    if (
      updates.scholarshipEnabled !==
      undefined
    ) {
      internship.scholarshipEnabled =
        updates.scholarshipEnabled ===
          true ||
        updates.scholarshipEnabled ===
          "true";
    }

    if (
      updates.assessmentRequired !==
      undefined
    ) {
      internship.assessmentRequired =
        updates.assessmentRequired ===
          true ||
        updates.assessmentRequired ===
          "true";
    }

    if (
      updates.certificateProvided !==
      undefined
    ) {
      internship.certificateProvided =
        updates.certificateProvided ===
          true ||
        updates.certificateProvided ===
          "true";
    }

    if (
      updates.offerLetterProvided !==
      undefined
    ) {
      internship.offerLetterProvided =
        updates.offerLetterProvided ===
          true ||
        updates.offerLetterProvided ===
          "true";
    }

    if (
      updates.experienceLetterProvided !==
      undefined
    ) {
      internship.experienceLetterProvided =
        updates.experienceLetterProvided ===
          true ||
        updates.experienceLetterProvided ===
          "true";
    }

    if (
      updates.completionCertificate !==
      undefined
    ) {
      internship.completionCertificate =
        updates.completionCertificate ===
          true ||
        updates.completionCertificate ===
          "true";
    }

    if (
      updates.projectRequired !==
      undefined
    ) {
      internship.projectRequired =
        updates.projectRequired ===
          true ||
        updates.projectRequired ===
          "true";
    }

    if (updates.liveClasses !== undefined) {
      internship.liveClasses =
        updates.liveClasses === true ||
        updates.liveClasses === "true";
    }

    if (
      updates.aiMentorEnabled !== undefined
    ) {
      internship.aiMentorEnabled =
        updates.aiMentorEnabled ===
          true ||
        updates.aiMentorEnabled ===
          "true";
    }

    if (
      updates.codingPracticeEnabled !==
      undefined
    ) {
      internship.codingPracticeEnabled =
        updates.codingPracticeEnabled ===
          true ||
        updates.codingPracticeEnabled ===
          "true";
    }

    if (
      updates.leaderboardEnabled !==
      undefined
    ) {
      internship.leaderboardEnabled =
        updates.leaderboardEnabled ===
          true ||
        updates.leaderboardEnabled ===
          "true";
    }

    if (
      updates.isFeatured !== undefined
    ) {
      internship.isFeatured =
        updates.isFeatured === true ||
        updates.isFeatured === "true";
    }

    if (updates.isActive !== undefined) {
      internship.isActive =
        updates.isActive === true ||
        updates.isActive === "true";
    }

    if (
      updates.assessmentId !== undefined
    ) {
      internship.assessmentId =
        updates.assessmentId || null;
    }

    await internship.save();

    return res.status(200).json({
      success: true,
      message:
        "Internship updated successfully",
      internship,
    });
  } catch (error) {
    console.error(
      "UPDATE INTERNSHIP ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| DELETE / ARCHIVE INTERNSHIP
|--------------------------------------------------------------------------
*/

const deleteInternship = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid internship ID",
      });
    }

    const internship =
      await Internship.findById(id);

    if (!internship) {
      return res.status(404).json({
        success: false,
        message:
          "Internship not found",
      });
    }

    const forceDelete =
      req.query.force === "true";

    if (forceDelete) {
      await Internship.deleteOne({
        _id: id,
      });

      return res.status(200).json({
        success: true,
        message:
          "Internship deleted successfully",
      });
    }

    internship.isActive = false;
    internship.status = "CLOSED";
    internship.availableSeats = 0;
    internship.updatedBy =
      req.user?.email ||
      internship.updatedBy;

    await internship.save();

    return res.status(200).json({
      success: true,
      message:
        "Internship archived successfully",
      internship,
    });
  } catch (error) {
    console.error(
      "DELETE INTERNSHIP ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| SELECT STUDENT
|--------------------------------------------------------------------------
*/

const selectStudent = async (
  req,
  res
) => {
  try {
    const { id, studentId } = req.params;
    const { remark = "" } = req.body || {};

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid internship ID",
      });
    }

    if (
      !isValidObjectId(studentId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid student ID",
      });
    }

    const [internship, student] =
      await Promise.all([
        Internship.findById(id),
        Student.findById(studentId),
      ]);

    if (!internship) {
      return res.status(404).json({
        success: false,
        message:
          "Internship not found",
      });
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found",
      });
    }

    const application =
      getApplicationByStudentId(
        internship,
        studentId
      );

    if (!application) {
      return res.status(404).json({
        success: false,
        message:
          "Application not found",
      });
    }

    if (
      application.status === "Selected"
    ) {
      return res.status(200).json({
        success: true,
        message:
          "Student already selected",
      });
    }

    if (
      application.status === "Rejected"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Rejected applications cannot be selected again",
      });
    }

    application.status = "Selected";
    application.selectedAt = new Date();
    application.rejectedAt = null;
    application.adminRemark =
      normalizeText(remark);

    student.internshipStatus = "Selected";
    student.internshipApproved = true;
    student.internshipApprovedAt =
      new Date();
    student.currentInternship =
      internship._id;
    student.internshipUnlocked = true;

    await Promise.all([
      internship.save(),
      student.save(),
    ]);

    const refreshed =
      await Internship.findById(id);

    return res.status(200).json({
      success: true,
      message:
        "Student selected successfully",
      internship:
        await populateInternship(
          refreshed,
          studentId
        ),
      application:
        getApplicationByStudentId(
          refreshed,
          studentId
        ),
    });
  } catch (error) {
    console.error(
      "SELECT STUDENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| REJECT STUDENT
|--------------------------------------------------------------------------
*/

const rejectStudent = async (
  req,
  res
) => {
  try {
    const { id, studentId } = req.params;
    const { remark = "" } = req.body || {};

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid internship ID",
      });
    }

    if (
      !isValidObjectId(studentId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid student ID",
      });
    }

    const [internship, student] =
      await Promise.all([
        Internship.findById(id),
        Student.findById(studentId),
      ]);

    if (!internship) {
      return res.status(404).json({
        success: false,
        message:
          "Internship not found",
      });
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found",
      });
    }

    const application =
      getApplicationByStudentId(
        internship,
        studentId
      );

    if (!application) {
      return res.status(404).json({
        success: false,
        message:
          "Application not found",
      });
    }

    const shouldRestoreSeat =
      application.status !== "Rejected" &&
      internship.availableSeats <
        internship.seats;

    application.status = "Rejected";
    application.rejectedAt = new Date();
    application.selectedAt = null;
    application.adminRemark =
      normalizeText(remark);

    if (shouldRestoreSeat) {
      internship.availableSeats += 1;
    }

    student.internshipStatus =
      "Rejected";
    student.internshipApproved = false;
    student.internshipApprovedAt = null;

    if (
      String(student.currentInternship) ===
      String(internship._id)
    ) {
      student.currentInternship = null;
    }

    await Promise.all([
      internship.save(),
      student.save(),
    ]);

    const refreshed =
      await Internship.findById(id);

    return res.status(200).json({
      success: true,
      message:
        "Student rejected successfully",
      internship:
        await populateInternship(
          refreshed,
          studentId
        ),
      application:
        getApplicationByStudentId(
          refreshed,
          studentId
        ),
    });
  } catch (error) {
    console.error(
      "REJECT STUDENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| COMPLETE INTERNSHIP
|--------------------------------------------------------------------------
*/

const completeInternship = async (
  req,
  res
) => {
  try {
    const { id, studentId } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid internship ID",
      });
    }

    if (
      !isValidObjectId(studentId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid student ID",
      });
    }

    const [internship, student] =
      await Promise.all([
        Internship.findById(id),
        Student.findById(studentId),
      ]);

    if (!internship) {
      return res.status(404).json({
        success: false,
        message:
          "Internship not found",
      });
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found",
      });
    }

    const application =
      getApplicationByStudentId(
        internship,
        studentId
      );

    if (!application) {
      return res.status(404).json({
        success: false,
        message:
          "Application not found",
      });
    }

    if (!application.paymentCompleted) {
      return res.status(403).json({
        success: false,
        message:
          "Payment must be completed before marking internship as completed",
      });
    }

    const alreadyCompleted =
      application.status === "Completed";

    application.status = "Completed";
    application.completedAt = new Date();

    if (!alreadyCompleted) {
      internship.completedStudents += 1;
    }

    student.internshipStatus =
      "Completed";
    student.internshipEndDate =
      new Date();
    student.certificateEligible = true;

    if (
      String(student.currentInternship) ===
      String(internship._id)
    ) {
      student.currentInternship = null;
    }

    await Promise.all([
      internship.save(),
      student.save(),
    ]);

    const refreshed =
      await Internship.findById(id);

    return res.status(200).json({
      success: true,
      message:
        "Internship completed successfully",
      internship:
        await populateInternship(
          refreshed,
          studentId
        ),
      application:
        getApplicationByStudentId(
          refreshed,
          studentId
        ),
    });
  } catch (error) {
    console.error(
      "COMPLETE INTERNSHIP ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| FINALIZE AFTER PAYMENT
|--------------------------------------------------------------------------
*/

const finalizeInternshipAfterPayment =
  async ({
    studentId,
    internshipId,
    paymentId,
    orderId,
    gatewayTransactionId,
    finalAmount,
    gatewayResponse = {},
  }) => {
    if (
      !isValidObjectId(studentId) ||
      !isValidObjectId(internshipId)
    ) {
      throw new Error(
        "Invalid student or internship ID"
      );
    }

    const [internship, student] =
      await Promise.all([
        Internship.findById(internshipId),
        Student.findById(studentId),
      ]);

    if (!internship) {
      throw new Error(
        "Internship not found"
      );
    }

    if (!student) {
      throw new Error(
        "Student not found"
      );
    }

    const application =
      getApplicationByStudentId(
        internship,
        studentId
      );

    if (!application) {
      throw new Error(
        "Application not found"
      );
    }

    if (
      application.status ===
        "Rejected" ||
      student.accountStatus ===
        "blocked" ||
      student.accountStatus ===
        "suspended"
    ) {
      throw new Error(
        "Unable to finalize payment for this application"
      );
    }

    if (
      application.status === "Applied"
    ) {
      application.status = "In Progress";
    } else if (
      application.status === "Selected"
    ) {
      application.status = "In Progress";
    }

    if (
      internship.availableSeats > 0 &&
      application.status === "Applied"
    ) {
      internship.availableSeats -= 1;
    }

    application.paymentCompleted = true;
    application.paymentStatus = "SUCCESS";
    application.paymentId =
      paymentId || application.paymentId;
    application.orderId =
      orderId || application.orderId;
    application.finalFee =
      Math.max(
        toNumber(finalAmount, 0),
        0
      );

    application.studentRemark =
      normalizeText(
        application.studentRemark
      );

    application.selectedAt =
      application.selectedAt ||
      new Date();

    student.paymentCompleted = true;
    student.paymentStatus = "SUCCESS";
    student.paymentId =
      paymentId || student.paymentId;
    student.paymentDate = new Date();
    student.paidAmount = Math.max(
      toNumber(finalAmount, 0),
      0
    );
    student.internshipStatus =
      "In Progress";
    student.internshipApproved = true;
    student.internshipApprovedAt =
      new Date();
    student.currentInternship =
      internship._id;
    student.internshipUnlocked = true;
    student.internshipId =
      student.internshipId ||
      generateStudentInternshipId();
    student.scholarshipEligible =
      toNumber(
        student.scholarshipPercentage,
        0
      ) > 0;
    student.appliedInternshipAt =
      student.appliedInternshipAt ||
      new Date();
    student.lastProfileUpdate =
      new Date();

    application.gatewayResponse =
      gatewayResponse || {};
    application.gatewayTransactionId =
      gatewayTransactionId || "";

    await Promise.all([
      internship.save(),
      student.save(),
    ]);

    const refreshed =
      await Internship.findById(
        internshipId
      );

    return {
      student: await Student.findById(
        studentId
      ).select("-password"),
      internship:
        await populateInternship(
          refreshed,
          studentId
        ),
      application:
        getApplicationByStudentId(
          refreshed,
          studentId
        ),
    };
  };

/*
|--------------------------------------------------------------------------
| FEATURED INTERNSHIPS
|--------------------------------------------------------------------------
*/

const getFeaturedInternships =
  async (req, res) => {
    try {
      const internships =
        await Internship.find({
          isFeatured: true,
          isActive: true,
          status: "ACTIVE",
        })
          .sort({
            createdAt: -1,
          })
          .limit(10)
          .populate(
            "assessmentId",
            "assessmentName domain duration"
          );

      const items =
        await Promise.all(
          internships.map(async (doc) =>
            populateInternship(
              doc,
              req.user?.id || null
            )
          )
        );

      return res.status(200).json({
        success: true,
        count: items.length,
        internships: items,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

/*
|--------------------------------------------------------------------------
| INTERNSHIP STATS
|--------------------------------------------------------------------------
*/

const getInternshipStats =
  async (req, res) => {
    try {
      const [
        totalInternships,
        activeInternships,
        closedInternships,
        draftInternships,
        totalApplications,
        totalRevenue,
        averageAssessmentScore,
      ] = await Promise.all([
        Internship.countDocuments({}),
        Internship.countDocuments({
          status: "ACTIVE",
          isActive: true,
        }),
        Internship.countDocuments({
          status: "CLOSED",
        }),
        Internship.countDocuments({
          status: "DRAFT",
        }),
        Internship.aggregate([
          {
            $group: {
              _id: null,
              total: {
                $sum:
                  "$totalApplications",
              },
            },
          },
        ]),
        Internship.aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum:
                  "$totalRevenue",
              },
            },
          },
        ]),
        Internship.aggregate([
          {
            $group: {
              _id: null,
              averageScore: {
                $avg:
                  "$averageAssessmentScore",
              },
            },
          },
        ]),
      ]);

      return res.status(200).json({
        success: true,
        stats: {
          totalInternships,
          activeInternships,
          closedInternships,
          draftInternships,
          totalApplications:
            totalApplications[0]
              ?.total || 0,
          totalRevenue:
            totalRevenue[0]
              ?.totalRevenue || 0,
          averageAssessmentScore: Number(
            (
              averageAssessmentScore[0]
                ?.averageScore || 0
            ).toFixed(2)
          ),
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

/*
|--------------------------------------------------------------------------
| DASHBOARD ANALYTICS
|--------------------------------------------------------------------------
*/

const getDashboardAnalytics =
  async (req, res) => {
    try {
      const [
        totalStudents,
        assessmentCompletedStudents,
        internshipUnlockedStudents,
        paymentCompletedStudents,
        totalInternships,
        activeInternships,
        totalApplications,
        totalRevenue,
      ] = await Promise.all([
        Student.countDocuments({}),
        Student.countDocuments({
          assessmentCompleted: true,
        }),
        Student.countDocuments({
          internshipUnlocked: true,
        }),
        Student.countDocuments({
          paymentCompleted: true,
        }),
        Internship.countDocuments({}),
        Internship.countDocuments({
          status: "ACTIVE",
          isActive: true,
        }),
        Internship.aggregate([
          {
            $group: {
              _id: null,
              total: {
                $sum:
                  "$totalApplications",
              },
            },
          },
        ]),
        Internship.aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum:
                  "$totalRevenue",
              },
            },
          },
        ]),
      ]);

      return res.status(200).json({
        success: true,
        analytics: {
          totalStudents,
          assessmentCompletedStudents,
          internshipUnlockedStudents,
          paymentCompletedStudents,
          totalInternships,
          activeInternships,
          totalApplications:
            totalApplications[0]
              ?.total || 0,
          totalRevenue:
            totalRevenue[0]
              ?.totalRevenue || 0,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  createInternship,
  getAllInternships,
  getInternshipById,
  applyInternship,
  getStudentInternships,
  getMyApplications,
  getInternshipApplicants,
  updateInternship,
  deleteInternship,
  selectStudent,
  rejectStudent,
  completeInternship,
  finalizeInternshipAfterPayment,
  getFeaturedInternships,
  getInternshipStats,
  getDashboardAnalytics,
  updateApplicantStatus: selectStudent,
};