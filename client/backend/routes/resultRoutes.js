const express = require("express");

const router = express.Router();

const {

  saveResult,
  getResults,

} = require("../controllers/resultController");

/* SAVE RESULT */

router.post("/", saveResult);

/* GET RESULTS */

router.get("/", getResults);

module.exports = router;