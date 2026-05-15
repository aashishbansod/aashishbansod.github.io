const express = require("express");

const router = express.Router();

const Result = require("../models/Result");

/* GET LEADERBOARD */

router.get("/", async (req, res) => {

  try {

    const leaderboard = await Result.find()

    .sort({ percentage: -1 })

    .limit(10);

    res.status(200).json({

      success: true,

      leaderboard,

    });

  } catch (error) {

    res.status(500).json({

      success: false,

      message: error.message,

    });

  }

});

module.exports = router;