const express = require("express");

const router = express.Router();

const {
  createExam,
  getAllExams,
  getSingleExam,
} = require("../controllers/examController");

/* ROUTES */

router.post("/create", createExam);

router.get("/", getAllExams);

router.get("/:id", getSingleExam);

module.exports = router;