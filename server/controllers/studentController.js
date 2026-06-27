const mongoose = require("mongoose");
const Student = require("../models/Student");
const Task = require("../models/Task");
const Notification = require("../models/Notification");
const Leaderboard = require("../models/Leaderboard");

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

const safeArray = (value) => (Array.isArray(value) ? value : []);

const isFilled = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return true;
  if (typeof value === "boolean") return true;
  return Boolean(value);
};

const calculatePercentage = (completed, total) => {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
};

const createResponse = (success, message, data = {}) => ({
  success,
  message,
  ...data,
});

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : value;

const buildFullName = (student) =>
  `${student?.firstName || ""} ${student?.lastName || ""}`.trim();

const getLeaderboardRank = async (studentId) => {
  const record = await Leaderboard.findOne({ studentId }).lean();
  return record?.rank || 0;
};

/*
|--------------------------------------------------------------------------
| GET DASHBOARD
|--------------------------------------------------------------------------
*/

const getDashboard = async (req, res) => {
  try {
    const studentId = req.user?.id || req.user?._id;

    if (!studentId) {
      return res.status(401).json(
        createResponse(false, "Authentication required")
      );
    }

    const student = await Student.findById(studentId)
      .populate("currentInternship")
      .lean();

    if (!student) {
      return res
        .status(404)
        .json(createResponse(false, "Student not found"));
    }

    const [unreadNotifications, taskCollection, leaderboardRecord] =
      await Promise.all([
        Notification.countDocuments({
          studentId,
          isRead: false,
        }),
        Task.find({ studentId }).sort({ createdAt: -1 }).lean(),
        Leaderboard.findOne({ studentId }).lean(),
      ]);

    const weeklyTasks =
      taskCollection.length > 0 ? taskCollection : safeArray(student.weeklyTasks);

    const profileFields = [
      student.firstName,
      student.lastName,
      student.email,
      student.mobile,
      student.college,
      student.course,
      student.year,
      student.city,
      student.githubLink,
      student.linkedinLink,
      student.profileImage,
      student.internshipDomain,
      student.resumeUrl,
      student.portfolioUrl,
      student.bio,
    ];

    const profileCompletion = calculatePercentage(
      profileFields.filter(isFilled).length,
      profileFields.length
    );

    const completedTasks = weeklyTasks.filter(
      (task) => task.status === "Completed"
    );

    const pendingTasks = weeklyTasks.filter(
      (task) => task.status !== "Completed"
    );

    const internshipProgress = calculatePercentage(
      completedTasks.length,
      weeklyTasks.length
    );

    const currentRank = leaderboardRecord?.rank || 0;

    const dashboard = {
      profile: {
        id: student._id,
        firstName: student.firstName || "",
        lastName: student.lastName || "",
        fullName: buildFullName(student),
        email: student.email || "",
        mobile: student.mobile || "",
        college: student.college || "",
        course: student.course || "",
        year: student.year || "",
        city: student.city || "",
        internshipDomain: student.internshipDomain || "",
        profileImage: student.profileImage || "",
        githubLink: student.githubLink || "",
        linkedinLink: student.linkedinLink || "",
        resumeUrl: student.resumeUrl || "",
        portfolioUrl: student.portfolioUrl || "",
        bio: student.bio || "",
        skills: safeArray(student.skills),
        profileCompletion,
      },

      performance: {
        assessmentScore: Number(student.assessmentScore || 0),
        scholarshipPercentage: Number(student.scholarshipPercentage || 0),
        leaderboardPoints: Number(student.leaderboardPoints || 0),
        aiMentorChats: Number(student.aiMentorChats || 0),
        rank: currentRank,
      },

      internship: {
        status: student.internshipStatus || "Not Applied",
        startDate: student.internshipStartDate || null,
        endDate: student.internshipEndDate || null,
        progress: internshipProgress,
        totalTasks: weeklyTasks.length,
        completedTasks: completedTasks.length,
        pendingTasks: pendingTasks.length,
        currentInternship: student.currentInternship || null,
        internshipApplicationsCount: Number(
          student.internshipApplicationsCount || 0
        ),
      },

      project: {
        submitted: Boolean(student.projectSubmitted),
        github: student.projectGithubLink || "",
        live: student.projectLiveLink || "",
        reviewStatus: student.projectReviewStatus || "Pending",
      },

      certificates: {
        certificateIssued: Boolean(student.certificateIssued),
        certificateId: student.certificateId || "",
        certificateIssuedDate: student.certificateIssuedDate || null,
        offerLetterIssued: Boolean(student.offerLetterIssued),
        offerLetterIssuedDate: student.offerLetterIssuedDate || null,
        experienceLetterIssued: Boolean(student.experienceLetterIssued),
        experienceLetterIssuedDate: student.experienceLetterIssuedDate || null,
      },

      placement: {
        status: student.placementStatus || "Not Eligible",
        company: student.placementCompany || "",
        package: Number(student.placementPackage || 0),
        placementDate: student.placementDate || null,
      },

      tasks: {
        total: weeklyTasks.length,
        pending: pendingTasks.length,
        completed: completedTasks.length,
        items: weeklyTasks.map((task) => ({
          id: task._id || null,
          title: task.title || "",
          description: task.description || "",
          status: task.status || "Pending",
          points: Number(task.points || 0),
          dueDate: task.dueDate || null,
          assignedDate: task.assignedDate || null,
          completedDate: task.completedDate || null,
        })),
      },

      account: {
        verified: Boolean(student.isVerified),
        emailVerified: Boolean(student.emailVerified),
        mobileVerified: Boolean(student.mobileVerified),
        status: student.accountStatus || "active",
        loginCount: Number(student.loginCount || 0),
        lastLogin: student.lastLogin || null,
      },

      timeline: {
        recentTaskCompletions: completedTasks.slice(0, 5).map((task) => ({
          title: task.title || "",
          completedDate: task.completedDate || null,
        })),
        recentPendingTasks: pendingTasks.slice(0, 5).map((task) => ({
          title: task.title || "",
          dueDate: task.dueDate || null,
        })),
      },

      meta: {
        unreadNotifications,
        rank: currentRank,
        profileCompletion,
        internshipProgress,
        taskCompletionRate: calculatePercentage(
          completedTasks.length,
          weeklyTasks.length
        ),
        totalTasks: weeklyTasks.length,
        completedTasks: completedTasks.length,
        pendingTasks: pendingTasks.length,
        generatedAt: new Date().toISOString(),
      },
    };

    return res.status(200).json(
      createResponse(true, "Dashboard loaded successfully", {
        dashboard,
      })
    );
  } catch (error) {
    console.error("Dashboard Error:", error);
    return res
      .status(500)
      .json(createResponse(false, "Failed to load dashboard"));
  }
};

/*
|--------------------------------------------------------------------------
| GET PROFILE
|--------------------------------------------------------------------------
*/

const getProfile = async (req, res) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json(
        createResponse(false, "Authentication required")
      );
    }

    const student = await Student.findById(studentId).select("-password");

    if (!student) {
      return res
        .status(404)
        .json(createResponse(false, "Student not found"));
    }

    return res.status(200).json(
      createResponse(true, "Profile loaded successfully", {
        profile: student,
      })
    );
  } catch (error) {
    console.error("Profile Error:", error);
    return res.status(500).json(createResponse(false, "Profile load failed"));
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE PROFILE
|--------------------------------------------------------------------------
*/

const updateProfile = async (req, res) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json(
        createResponse(false, "Authentication required")
      );
    }

    const student = await Student.findById(studentId);

    if (!student) {
      return res
        .status(404)
        .json(createResponse(false, "Student not found"));
    }

    const allowedFields = [
      "firstName",
      "lastName",
      "mobile",
      "city",
      "college",
      "course",
      "year",
      "githubLink",
      "linkedinLink",
      "profileImage",
      "internshipDomain",
      "bio",
      "resumeUrl",
      "portfolioUrl",
      "skills",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === "skills") {
          student.skills = Array.isArray(req.body.skills)
            ? req.body.skills
                .map((skill) => normalizeString(skill))
                .filter(Boolean)
            : student.skills;
        } else {
          student[field] = normalizeString(req.body[field]);
        }
      }
    }

    await student.save();

    const updatedProfile = await Student.findById(studentId).select("-password");

    return res.status(200).json(
      createResponse(true, "Profile updated successfully", {
        profile: updatedProfile,
      })
    );
  } catch (error) {
    console.error("Update Profile Error:", error);
    return res.status(500).json(createResponse(false, "Profile update failed"));
  }
};

/*
|--------------------------------------------------------------------------
| SUBMIT PROJECT
|--------------------------------------------------------------------------
*/

const submitProject = async (req, res) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json(
        createResponse(false, "Authentication required")
      );
    }

    const { githubLink, liveLink } = req.body;

    const student = await Student.findById(studentId);

    if (!student) {
      return res
        .status(404)
        .json(createResponse(false, "Student not found"));
    }

    student.projectSubmitted = true;
    student.projectGithubLink = normalizeString(githubLink || "");
    student.projectLiveLink = normalizeString(liveLink || "");
    student.projectReviewStatus = "Pending";

    await student.save();

    return res
      .status(200)
      .json(createResponse(true, "Project submitted successfully"));
  } catch (error) {
    console.error("Submit Project Error:", error);
    return res
      .status(500)
      .json(createResponse(false, "Project submission failed"));
  }
};

/*
|--------------------------------------------------------------------------
| COMPLETE TASK
|--------------------------------------------------------------------------
*/

const completeTask = async (req, res) => {
  try {
    const studentId = req.user?.id;
    const { taskId } = req.params;

    if (!studentId) {
      return res.status(401).json(
        createResponse(false, "Authentication required")
      );
    }

    if (!isValidObjectId(taskId)) {
      return res
        .status(400)
        .json(createResponse(false, "Invalid task id"));
    }

    const task = await Task.findOne({
      _id: taskId,
      studentId,
    });

    if (!task) {
      return res
        .status(404)
        .json(createResponse(false, "Task not found"));
    }

    if (task.status === "Completed") {
      return res.status(200).json(
        createResponse(true, "Task already completed", {
          task,
        })
      );
    }

    task.status = "Completed";
    task.completedDate = new Date();

    await task.save();

    const pointsToAdd = Number(task.points || 10);

    const [updatedStudent] = await Promise.all([
      Student.findByIdAndUpdate(
        studentId,
        {
          $inc: {
            completedTasks: 1,
            leaderboardPoints: pointsToAdd,
          },
        },
        {
          new: true,
          runValidators: true,
        }
      ).select("-password"),

      Leaderboard.findOneAndUpdate(
        { studentId },
        {
          $inc: {
            points: pointsToAdd,
            completedTasks: 1,
          },
          $set: {
            lastUpdated: new Date(),
            isActive: true,
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      ),
    ]);

    return res.status(200).json(
      createResponse(true, "Task completed successfully", {
        task,
        student: updatedStudent,
      })
    );
  } catch (error) {
    console.error("Complete Task Error:", error);
    return res
      .status(500)
      .json(createResponse(false, "Task completion failed"));
  }
};

/*
|--------------------------------------------------------------------------
| TASK APIs
|--------------------------------------------------------------------------
*/

const getTasks = async (req, res) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json(
        createResponse(false, "Authentication required")
      );
    }

    const tasks = await Task.find({ studentId }).sort({
      createdAt: -1,
    });

    return res.status(200).json(
      createResponse(true, "Tasks loaded successfully", {
        tasks,
      })
    );
  } catch (error) {
    console.error("Get Tasks Error:", error);
    return res.status(500).json(createResponse(false, "Task load failed"));
  }
};

/*
|--------------------------------------------------------------------------
| GET NOTIFICATIONS
|--------------------------------------------------------------------------
*/

const getNotifications = async (req, res) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json(
        createResponse(false, "Authentication required")
      );
    }

    const notifications = await Notification.find({
      studentId,
    }).sort({ createdAt: -1 });

    return res.status(200).json(
      createResponse(true, "Notifications loaded successfully", {
        notifications,
      })
    );
  } catch (error) {
    console.error("Notification Error:", error);
    return res
      .status(500)
      .json(createResponse(false, "Notification load failed"));
  }
};

/*
|--------------------------------------------------------------------------
| MARK NOTIFICATION AS READ
|--------------------------------------------------------------------------
*/

const markNotificationRead = async (req, res) => {
  try {
    const studentId = req.user?.id;
    const { id } = req.params;

    if (!studentId) {
      return res.status(401).json(
        createResponse(false, "Authentication required")
      );
    }

    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json(createResponse(false, "Invalid notification id"));
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        studentId,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
      {
        new: true,
      }
    );

    if (!notification) {
      return res
        .status(404)
        .json(createResponse(false, "Notification not found"));
    }

    return res.status(200).json(
      createResponse(true, "Notification marked as read", {
        notification,
      })
    );
  } catch (error) {
    console.error("Mark Notification Error:", error);
    return res
      .status(500)
      .json(createResponse(false, "Failed to update notification"));
  }
};

/*
|--------------------------------------------------------------------------
| LEADERBOARD
|--------------------------------------------------------------------------
*/

const getLeaderboard = async (req, res) => {
  try {
    const studentId = req.user?.id;
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "50", 10), 1),
      100
    );
    const skip = (page - 1) * limit;

    const [leaderboard, total] = await Promise.all([
      Leaderboard.find({ isActive: true })
        .sort({ points: -1, rank: 1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Leaderboard.countDocuments({ isActive: true }),
    ]);

    let myRecord = null;
    if (studentId) {
      myRecord = await Leaderboard.findOne({ studentId }).lean();
    }

    return res.status(200).json(
      createResponse(true, "Leaderboard loaded successfully", {
        leaderboard,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.max(Math.ceil(total / limit), 1),
          myRank: myRecord?.rank || 0,
          myPoints: myRecord?.points || 0,
        },
      })
    );
  } catch (error) {
    console.error("Leaderboard Error:", error);
    return res
      .status(500)
      .json(createResponse(false, "Leaderboard load failed"));
  }
};

/*
|--------------------------------------------------------------------------
| STUDENT STATS
|--------------------------------------------------------------------------
*/

const getStats = async (req, res) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json(
        createResponse(false, "Authentication required")
      );
    }

    const student = await Student.findById(studentId);

    if (!student) {
      return res
        .status(404)
        .json(createResponse(false, "Student not found"));
    }

    const [totalTasks, completedTasks, pendingNotifications, rank] =
      await Promise.all([
        Task.countDocuments({ studentId }),
        Task.countDocuments({ studentId, status: "Completed" }),
        Notification.countDocuments({ studentId, isRead: false }),
        getLeaderboardRank(studentId),
      ]);

    const pendingTasks = Math.max(totalTasks - completedTasks, 0);

    return res.status(200).json(
      createResponse(true, "Stats loaded successfully", {
        stats: {
          totalTasks,
          completedTasks,
          pendingTasks,
          unreadNotifications: pendingNotifications,
          leaderboardPoints: student.leaderboardPoints || 0,
          assessmentScore: student.assessmentScore || 0,
          scholarshipPercentage: student.scholarshipPercentage || 0,
          aiMentorChats: student.aiMentorChats || 0,
          internshipStatus: student.internshipStatus,
          internshipProgress: calculatePercentage(
            completedTasks,
            totalTasks
          ),
          rank,
        },
      })
    );
  } catch (error) {
    console.error("Stats Error:", error);
    return res.status(500).json(createResponse(false, "Stats load failed"));
  }
};

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  getDashboard,
  getProfile,
  updateProfile,
  submitProject,
  getTasks,
  completeTask,
  getNotifications,
  markNotificationRead,
  getLeaderboard,
  getStats,
};