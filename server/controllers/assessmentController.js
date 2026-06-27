const mongoose = require("mongoose");

const Question = require("../models/Question");
const Result = require("../models/Result");
const Student = require("../models/Student");

let Assessment = null;
try {
  Assessment = require("../models/Assessment");
} catch {
  Assessment = null;
}

let Leaderboard = null;
try {
  Leaderboard = require("../models/Leaderboard");
} catch {
  Leaderboard = null;
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(String(value || ""));

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) =>
  Math.min(Math.max(value, min), max);

const shuffleArray = (array) => {
  const copy = Array.isArray(array) ? [...array] : [];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const buildScholarship = (percentage) => {
  if (percentage >= 100) return 100;
  if (percentage >= 90) return 75;
  if (percentage >= 80) return 50;
  if (percentage >= 60) return 25;
  if (percentage >= 40) return 10;
  return 0;
};

const normalizeAnswerText = (value) =>
  typeof value === "string"
    ? value.replace(/\s+/g, "").trim().toLowerCase()
    : "";

const getStudentDisplayName = (student) =>
  `${student?.firstName || ""} ${student?.lastName || ""}`.trim() ||
  student?.email ||
  "Student";

const resolveAssessmentRef = async (assessmentId) => {
  if (assessmentId && isValidObjectId(assessmentId)) {
    return assessmentId;
  }

  if (Assessment) {
    const latestAssessment = await Assessment.findOne({
      isActive: true,
    }).sort({ createdAt: -1 });

    if (latestAssessment?._id) {
      return latestAssessment._id;
    }
  }

  return null;
};

const calculateRank = async (points, studentId) => {
  try {
    return (
      (await Student.countDocuments({
        _id: { $ne: studentId },
        leaderboardPoints: { $gt: points },
      })) + 1
    );
  } catch {
    return 0;
  }
};

const syncLeaderboardRecord = async ({
  student,
  rank,
  percentage,
  scholarshipPercentage,
}) => {
  if (!Leaderboard) return;

  await Leaderboard.findOneAndUpdate(
    { studentId: student._id },
    {
      $set: {
        studentId: student._id,
        studentName: getStudentDisplayName(student),
        email: student.email,
        points: Number(student.leaderboardPoints || 0),
        rank,
        assessmentScore: percentage,
        scholarshipPercentage,
        isActive: true,
        lastUpdated: new Date(),
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
};

const normalizeSubmittedAnswers = (answers) => {
  if (Array.isArray(answers)) {
    return answers
      .map((item, index) => {
        if (item && typeof item === "object") {
          return {
            questionId:
              item.questionId ||
              item.id ||
              item._id ||
              item.question ||
              "",
            selectedAnswer:
              item.selectedAnswer ??
              item.answer ??
              item.value ??
              "",
            codeAnswer:
              item.codeAnswer ??
              item.code ??
              item.response ??
              "",
            index,
          };
        }

        return {
          questionId: "",
          selectedAnswer: item,
          codeAnswer: "",
          index,
        };
      })
      .filter(
        (item) =>
          normalizeText(item.selectedAnswer) !== "" ||
          normalizeText(item.codeAnswer) !== ""
      );
  }

  if (answers && typeof answers === "object") {
    return Object.entries(answers).map(([key, value], index) => ({
      questionId: key,
      selectedAnswer:
        value && typeof value === "object"
          ? value.selectedAnswer ?? value.answer ?? value.value ?? ""
          : value,
      codeAnswer:
        value && typeof value === "object"
          ? value.codeAnswer ?? value.code ?? value.response ?? ""
          : "",
      index,
    }));
  }

  return [];
};

const evaluateCodingAnswer = (question, submittedCode) => {
  const expected = normalizeAnswerText(question.correctAnswer);
  const actual = normalizeAnswerText(submittedCode);
  const baseMarks = Math.max(toNumber(question.marks, 10), 1);

  if (!actual) {
    return { correct: false, marksObtained: 0 };
  }

  if (expected && actual === expected) {
    return { correct: true, marksObtained: baseMarks };
  }

  if (actual.length > 20) {
    return {
      correct: false,
      marksObtained: Math.round(baseMarks * 0.5),
    };
  }

  return { correct: false, marksObtained: 0 };
};

const getSafeQuestion = (q) => ({
  _id: q._id,
  questionType: q.questionType,
  domain: q.domain,
  difficulty: q.difficulty,
  question: q.question,
  options: Array.isArray(q.options) ? q.options : [],
  marks: q.marks,
  negativeMarks: q.negativeMarks,
  codingLanguage: Array.isArray(q.codingLanguage) ? q.codingLanguage : [],
  starterCode: q.starterCode || "",
  sampleInput: q.sampleInput || "",
  sampleOutput: q.sampleOutput || "",
  timeLimit: q.timeLimit || 2,
  memoryLimit: q.memoryLimit || 256,
});

/*
|--------------------------------------------------------------------------
| GET ASSESSMENT QUESTIONS
|--------------------------------------------------------------------------
*/

const getAssessmentQuestions = async (req, res) => {
  try {
    const {
      domain = "",
      questionType = "",
      limit = 30,
      assessmentId = "",
    } = req.query;

    const query = { isActive: true };

    if (questionType) {
      query.questionType = String(questionType).trim().toUpperCase();
    }

    if (domain) {
      query.domain = new RegExp(`^${normalizeText(domain)}$`, "i");
    }

    if (assessmentId && isValidObjectId(assessmentId)) {
      query.assessment = assessmentId;
    }

    const questionLimit = clamp(toNumber(limit, 30), 1, 100);

    const questions = await Question.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const selected = shuffleArray(questions).slice(
      0,
      Math.min(questionLimit, questions.length)
    );

    return res.status(200).json({
      success: true,
      count: selected.length,
      questions: selected.map(getSafeQuestion),
    });
  } catch (error) {
    console.error("GET QUESTIONS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load questions",
    });
  }
};

/*
|--------------------------------------------------------------------------
| SUBMIT ASSESSMENT
|--------------------------------------------------------------------------
*/

const submitAssessment = async (req, res) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const {
      assessmentId = "",
      answers = [],
      startedAt = null,
      finishedAt = null,
      timeSpentSeconds = 0,
    } = req.body;

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const assessmentRef = await resolveAssessmentRef(assessmentId);

    if (!assessmentRef) {
      return res.status(400).json({
        success: false,
        message:
          "Assessment ID is required. Create or select an active assessment first.",
      });
    }

    const submittedAnswers = normalizeSubmittedAnswers(answers);

    if (submittedAnswers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No answers submitted",
      });
    }

    const questionIds = submittedAnswers
      .map((item) => item.questionId)
      .filter((id) => isValidObjectId(id));

    if (questionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "questionId is required for each submitted answer",
      });
    }

    const questions = await Question.find({
      _id: { $in: questionIds },
      isActive: true,
    }).lean();

    if (questions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Assessment questions not found",
      });
    }

    const questionMap = new Map(
      questions.map((q) => [String(q._id), q])
    );

    let totalQuestions = 0;
    let attemptedQuestions = 0;
    let correctAnswers = 0;
    let wrongAnswers = 0;
    let mcqScore = 0;
    let codingScore = 0;
    let maxScore = 0;

    for (const item of submittedAnswers) {
      const question = questionMap.get(String(item.questionId));
      if (!question) continue;

      totalQuestions += 1;

      const questionMarks = Math.max(
        toNumber(
          question.marks,
          question.questionType === "CODING" ? 10 : 4
        ),
        1
      );

      const negativeMarks = Math.max(
        toNumber(question.negativeMarks, 0),
        0
      );

      maxScore += questionMarks;

      const selectedAnswer = normalizeText(item.selectedAnswer);
      const codeAnswer = normalizeText(item.codeAnswer);
      const hasSubmission =
        selectedAnswer !== "" || codeAnswer !== "";

      if (hasSubmission) {
        attemptedQuestions += 1;
      }

      if (question.questionType === "MCQ") {
        const isCorrect =
          normalizeAnswerText(selectedAnswer) ===
          normalizeAnswerText(question.correctAnswer);

        if (isCorrect) {
          correctAnswers += 1;
          mcqScore += questionMarks;
        } else if (hasSubmission) {
          wrongAnswers += 1;
          mcqScore = Math.max(mcqScore - negativeMarks, 0);
        }
      } else if (question.questionType === "CODING") {
        const result = evaluateCodingAnswer(
          question,
          codeAnswer || selectedAnswer
        );

        if (result.correct) {
          correctAnswers += 1;
        } else if (hasSubmission) {
          wrongAnswers += 1;
        }

        codingScore += result.marksObtained;
      } else if (hasSubmission) {
        wrongAnswers += 1;
      }
    }

    const totalScore = Math.max(mcqScore + codingScore, 0);
    const percentage =
      maxScore > 0
        ? clamp(Math.round((totalScore / maxScore) * 100), 0, 100)
        : 0;

    const scholarshipPercentage = buildScholarship(percentage);
    const pass = percentage >= 40;

    const xpEarned = percentage * 10;
    const leaderboardPointsBefore = Number(student.leaderboardPoints || 0);
    const leaderboardPointsAfter = leaderboardPointsBefore + xpEarned;

    student.assessmentCompleted = true;
    student.assessmentPassed = pass;
    student.assessmentAttemptCount =
      Number(student.assessmentAttemptCount || 0) + 1;
    student.assessmentCompletedAt = new Date();
    student.assessmentScore = percentage;
    student.scholarshipPercentage = scholarshipPercentage;
    student.scholarshipEligible = scholarshipPercentage > 0;
    student.internshipUnlocked = pass;
    student.certificateEligible = pass;
    student.leaderboardPoints = leaderboardPointsAfter;
    student.lastProfileUpdate = new Date();

    await student.save();

    const rank = await calculateRank(
      leaderboardPointsAfter,
      student._id
    );

    await syncLeaderboardRecord({
      student,
      rank,
      percentage,
      scholarshipPercentage,
    });

    const result = await Result.create({
      student: student._id,
      assessment: assessmentRef,
      totalQuestions,
      attemptedQuestions,
      correctAnswers,
      wrongAnswers,
      mcqScore,
      codingScore,
      totalScore,
      percentage,
      scholarshipPercentage,
      status: pass ? "PASS" : "FAIL",
      rank,
      certificateEligible: pass,
      emailSent: false,
      emailSentAt: null,
      resultPublished: false,
      startedAt: startedAt ? new Date(startedAt) : null,
      finishedAt: finishedAt ? new Date(finishedAt) : new Date(),
      timeSpentSeconds: Math.max(toNumber(timeSpentSeconds, 0), 0),
      submittedAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: pass ? "Assessment Passed" : "Assessment Failed",
      resultId: result._id,
      percentage,
      scholarshipPercentage,
      internshipUnlocked: pass,
      assessmentCompleted: true,
      assessmentPassed: pass,
      leaderboardPoints: leaderboardPointsAfter,
      rank,
      result,
    });
  } catch (error) {
    console.error("SUBMIT ASSESSMENT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to submit assessment",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET MY RESULT
|--------------------------------------------------------------------------
*/

const getMyResult = async (req, res) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const result = await Result.findOne({
      student: studentId,
    })
      .sort({ createdAt: -1 })
      .populate(
        "student",
        "firstName lastName email mobile college course year"
      );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Result not found",
      });
    }

    return res.status(200).json({
      success: true,
      result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load result",
    });
  }
};

/*
|--------------------------------------------------------------------------
| LEADERBOARD
|--------------------------------------------------------------------------
*/

const getLeaderboard = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = clamp(parseInt(req.query.limit || "100", 10), 1, 100);
    const skip = (page - 1) * limit;

    let leaderboard = [];
    let total = 0;

    if (Leaderboard) {
      total = await Leaderboard.countDocuments({ isActive: true });

      leaderboard = await Leaderboard.find({ isActive: true })
        .sort({ points: -1, rank: 1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
    } else {
      total = await Student.countDocuments({
        assessmentCompleted: true,
      });

      leaderboard = await Student.find({
        assessmentCompleted: true,
      })
        .select(
          "firstName lastName email profileImage assessmentScore scholarshipPercentage leaderboardPoints internshipStatus"
        )
        .sort({
          leaderboardPoints: -1,
          assessmentScore: -1,
          updatedAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean();

      leaderboard = leaderboard.map((item, index) => ({
        ...item,
        studentId: item._id,
        points: Number(item.leaderboardPoints || 0),
        rank: skip + index + 1,
      }));
    }

    return res.status(200).json({
      success: true,
      count: leaderboard.length,
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      leaderboard,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load leaderboard",
    });
  }
};

/*
|--------------------------------------------------------------------------
| HEALTH CHECK
|--------------------------------------------------------------------------
*/

const healthCheck = async (req, res) => {
  return res.status(200).json({
    success: true,
    service: "Assessment Controller",
    status: "Running",
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  getAssessmentQuestions,
  submitAssessment,
  getMyResult,
  getLeaderboard,
  healthCheck,
};