const express = require("express");
const passport = require("passport");

const {
  registerStudent,
  loginStudent,
  getStudentProfile,
} = require("../controllers/authController");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| EMAIL / PASSWORD AUTH
|--------------------------------------------------------------------------
*/

router.post(
  "/register",
  registerStudent
);

router.post(
  "/login",
  loginStudent
);

router.get(
  "/profile",
  getStudentProfile
);

/*
|--------------------------------------------------------------------------
| GOOGLE LOGIN
|--------------------------------------------------------------------------
*/

router.get(
  "/google",
  passport.authenticate(
    "google",
    {
      scope: [
        "profile",
        "email",
      ],
    }
  )
);

router.get(
  "/google/callback",
  passport.authenticate(
    "google",
    {
      failureRedirect:
        "http://localhost:5173/login",
      session: false,
    }
  ),
  async (req, res) => {
    try {
      return res.redirect(
        "http://localhost:5173/student/dashboard"
      );
    } catch (error) {
      console.log(error);

      return res.redirect(
        "http://localhost:5173/login"
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| GITHUB LOGIN
|--------------------------------------------------------------------------
*/

router.get(
  "/github",
  passport.authenticate(
    "github",
    {
      scope: [
        "user:email",
      ],
    }
  )
);

router.get(
  "/github/callback",
  passport.authenticate(
    "github",
    {
      failureRedirect:
        "http://localhost:5173/login",
      session: false,
    }
  ),
  async (req, res) => {
    try {
      return res.redirect(
        "http://localhost:5173/student/dashboard"
      );
    } catch (error) {
      console.log(error);

      return res.redirect(
        "http://localhost:5173/login"
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| LINKEDIN LOGIN
|--------------------------------------------------------------------------
*/

router.get(
  "/linkedin",
  passport.authenticate(
    "linkedin",
    {
      scope: [
        "openid",
        "profile",
        "email",
      ],
    }
  )
);

router.get(
  "/linkedin/callback",
  passport.authenticate(
    "linkedin",
    {
      failureRedirect:
        "http://localhost:5173/login",
      session: false,
    }
  ),
  async (req, res) => {
    try {
      return res.redirect(
        "http://localhost:5173/student/dashboard"
      );
    } catch (error) {
      console.log(error);

      return res.redirect(
        "http://localhost:5173/login"
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| CURRENT USER
|--------------------------------------------------------------------------
*/

router.get(
  "/me",
  (req, res) => {
    res.status(200).json({
      success: true,
      user:
        req.user || null,
    });
  }
);

module.exports = router;