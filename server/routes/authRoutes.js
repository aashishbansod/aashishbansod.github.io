"use strict";

const express = require("express");
const passport = require("passport");

const {
  registerStudent,
  loginStudent,
  getStudentProfile,
  updateAssessmentScore,
  logoutUser,
  getCurrentUser,
} = require("../controllers/authController");

const { authMiddleware } = require("../middleware/authMiddleware");

const router = express.Router();

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const OAUTH_FAILURE_REDIRECT = `${CLIENT_URL}/login`;

function isStrategyAvailable(strategyName) {
  try {
    return typeof passport._strategy === "function" && !!passport._strategy(strategyName);
  } catch {
    return false;
  }
}

function buildOAuthSuccessRedirect(token) {
  return `${CLIENT_URL}/oauth-success?token=${encodeURIComponent(token || "")}`;
}

function handleOAuthCallback(providerName) {
  return async (req, res) => {
    try {
      const token =
        req.user?.token ||
        req.user?.jwt ||
        req.user?.accessToken ||
        req.user?.access_token ||
        "";

      if (!token) {
        console.error(`${providerName} OAuth Error: token missing`);
        return res.redirect(OAUTH_FAILURE_REDIRECT);
      }

      return res.redirect(buildOAuthSuccessRedirect(token));
    } catch (error) {
      console.error(`${providerName} OAuth Callback Error:`, error);
      return res.redirect(OAUTH_FAILURE_REDIRECT);
    }
  };
}

function optionalPassportAuth(strategyName, scope = []) {
  return (req, res, next) => {
    if (!isStrategyAvailable(strategyName)) {
      return res.status(503).json({
        success: false,
        message: `${strategyName} authentication is not configured`,
      });
    }

    return passport.authenticate(strategyName, {
      scope,
      session: false,
    })(req, res, next);
  };
}

function optionalPassportCallback(strategyName) {
  return (req, res, next) => {
    if (!isStrategyAvailable(strategyName)) {
      return res.redirect(OAUTH_FAILURE_REDIRECT);
    }

    return passport.authenticate(strategyName, {
      failureRedirect: OAUTH_FAILURE_REDIRECT,
      session: false,
    })(req, res, next);
  };
}

/*
|--------------------------------------------------------------------------
| AUTH
|--------------------------------------------------------------------------
*/

router.post("/register", registerStudent);
router.post("/login", loginStudent);
router.post("/logout", authMiddleware, logoutUser);

/*
|--------------------------------------------------------------------------
| PROFILE
|--------------------------------------------------------------------------
*/

router.get("/profile", authMiddleware, getStudentProfile);
router.get("/me", authMiddleware, getCurrentUser);
router.put("/assessment", authMiddleware, updateAssessmentScore);

/*
|--------------------------------------------------------------------------
| OAUTH - GOOGLE
|--------------------------------------------------------------------------
*/

router.get("/google", optionalPassportAuth("google", ["profile", "email"]));
router.get(
  "/google/callback",
  optionalPassportCallback("google"),
  handleOAuthCallback("Google")
);

/*
|--------------------------------------------------------------------------
| OAUTH - GITHUB
|--------------------------------------------------------------------------
*/

router.get("/github", optionalPassportAuth("github", ["user:email"]));
router.get(
  "/github/callback",
  optionalPassportCallback("github"),
  handleOAuthCallback("GitHub")
);

/*
|--------------------------------------------------------------------------
| OAUTH - LINKEDIN
|--------------------------------------------------------------------------
*/

router.get("/linkedin", optionalPassportAuth("linkedin", ["openid", "profile", "email"]));
router.get(
  "/linkedin/callback",
  optionalPassportCallback("linkedin"),
  handleOAuthCallback("LinkedIn")
);

/*
|--------------------------------------------------------------------------
| STATUS
|--------------------------------------------------------------------------
*/

router.get("/status", (req, res) => {
  res.status(200).json({
    success: true,
    auth: "working",
    timestamp: new Date().toISOString(),
    routes: {
      register: "/api/auth/register",
      login: "/api/auth/login",
      logout: "/api/auth/logout",
      profile: "/api/auth/profile",
      me: "/api/auth/me",
      assessment: "/api/auth/assessment",
      google: "/api/auth/google",
      github: "/api/auth/github",
      linkedin: "/api/auth/linkedin",
    },
  });
});

module.exports = router;