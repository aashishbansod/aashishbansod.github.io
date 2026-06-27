const passport = require("passport");
const crypto = require("crypto");

const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const GitHubStrategy = require("passport-github2").Strategy;
const LinkedInStrategy = require("passport-linkedin-oauth2").Strategy;

const Student = require("../models/Student");

/*
|--------------------------------------------------------------------------
| Config
|--------------------------------------------------------------------------
*/

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const SERVER_URL = process.env.SERVER_URL || "http://localhost:5000";

const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL ||
  `${SERVER_URL}/api/auth/google/callback`;

const GITHUB_CALLBACK_URL =
  process.env.GITHUB_CALLBACK_URL ||
  `${SERVER_URL}/api/auth/github/callback`;

const LINKEDIN_CALLBACK_URL =
  process.env.LINKEDIN_CALLBACK_URL ||
  `${SERVER_URL}/api/auth/linkedin/callback`;

const DEFAULT_COLLEGE = process.env.DEFAULT_OAUTH_COLLEGE || "Not Provided";
const DEFAULT_COURSE = process.env.DEFAULT_OAUTH_COURSE || "Not Provided";
const DEFAULT_YEAR = process.env.DEFAULT_OAUTH_YEAR || "1";
const DEFAULT_DOMAIN =
  process.env.DEFAULT_OAUTH_DOMAIN || "Web Development";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const safeValue = (value, fallback = "") =>
  normalizeText(value) || fallback;

const generateOAuthPassword = (provider) => {
  const secret = crypto.randomBytes(24).toString("hex");
  return `${provider.toUpperCase()}_${secret}`;
};

const extractGoogleProfile = (profile = {}) => {
  const email = normalizeEmail(profile?.emails?.[0]?.value);
  const firstName =
    safeValue(profile?.name?.givenName, "Google") ||
    "Google";
  const lastName =
    safeValue(profile?.name?.familyName, "User") || "User";
  const image =
    profile?.photos?.[0]?.value || "";

  return {
    email,
    firstName,
    lastName,
    image,
    providerId: profile?.id || "",
  };
};

const extractGitHubProfile = (profile = {}) => {
  const email =
    normalizeEmail(profile?.emails?.[0]?.value) ||
    normalizeEmail(`${profile?.username || profile?.id}@github.com`);

  const firstName =
    safeValue(profile?.displayName || profile?.username, "GitHub") ||
    "GitHub";
  const lastName = "User";
  const image =
    profile?.photos?.[0]?.value ||
    profile?._json?.avatar_url ||
    "";

  return {
    email,
    firstName,
    lastName,
    image,
    providerId: profile?.id || "",
  };
};

const extractLinkedInProfile = (profile = {}) => {
  const email =
    normalizeEmail(profile?.emails?.[0]?.value) ||
    normalizeEmail(profile?.email) ||
    normalizeEmail(`${profile?.id}@linkedin.com`);

  const firstName =
    safeValue(
      profile?.name?.givenName ||
        profile?.givenName ||
        profile?.displayName,
      "LinkedIn"
    ) || "LinkedIn";
  const lastName =
    safeValue(
      profile?.name?.familyName ||
        profile?.familyName ||
        "User",
      "User"
    ) || "User";
  const image =
    profile?.photos?.[0]?.value ||
    profile?._json?.profilePicture?.displayImageReference ||
    "";

  return {
    email,
    firstName,
    lastName,
    image,
    providerId: profile?.id || "",
  };
};

async function upsertOAuthStudent({
  email,
  firstName,
  lastName,
  image,
  provider,
}) {
  if (!email) {
    throw new Error("OAuth provider did not return an email address");
  }

  let student = await Student.findOne({ email });

  if (!student) {
    student = new Student({
      firstName: safeValue(firstName, "Student"),
      lastName: safeValue(lastName, "User"),
      email,
      mobile: "0000000000",
      college: DEFAULT_COLLEGE,
      course: DEFAULT_COURSE,
      year: DEFAULT_YEAR,
      internshipDomain: DEFAULT_DOMAIN,
      password: generateOAuthPassword(provider),
      role: "student",
      profileImage: image || "",
      isVerified: true,
      emailVerified: true,
      lastLogin: new Date(),
      loginCount: 1,
    });

    await student.save();
    return student;
  }

  let changed = false;

  if (!student.firstName && firstName) {
    student.firstName = safeValue(firstName, student.firstName || "Student");
    changed = true;
  }

  if (!student.lastName && lastName) {
    student.lastName = safeValue(lastName, student.lastName || "User");
    changed = true;
  }

  if (!student.profileImage && image) {
    student.profileImage = image;
    changed = true;
  }

  if (student.emailVerified === false) {
    student.emailVerified = true;
    changed = true;
  }

  if (student.isVerified === false) {
    student.isVerified = true;
    changed = true;
  }

  student.lastLogin = new Date();
  student.loginCount = Number(student.loginCount || 0) + 1;
  changed = true;

  if (changed) {
    await student.save();
  }

  return student;
}

/*
|--------------------------------------------------------------------------
| Passport Session
|--------------------------------------------------------------------------
*/

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await Student.findById(id);
    done(null, user || null);
  } catch (error) {
    done(error, null);
  }
});

/*
|--------------------------------------------------------------------------
| Google OAuth
|--------------------------------------------------------------------------
*/

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
        passReqToCallback: false,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const data = extractGoogleProfile(profile);

          if (!data.email) {
            return done(
              new Error("Google login failed: email not provided"),
              null
            );
          }

          const student = await upsertOAuthStudent({
            ...data,
            provider: "google",
          });

          return done(null, student);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
} else {
  console.warn(
    "[Passport] Google OAuth not configured. Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET."
  );
}

/*
|--------------------------------------------------------------------------
| GitHub OAuth
|--------------------------------------------------------------------------
*/

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: GITHUB_CALLBACK_URL,
        scope: ["user:email"],
        passReqToCallback: false,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const data = extractGitHubProfile(profile);

          const student = await upsertOAuthStudent({
            ...data,
            provider: "github",
          });

          return done(null, student);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
} else {
  console.warn(
    "[Passport] GitHub OAuth not configured. Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET."
  );
}

/*
|--------------------------------------------------------------------------
| LinkedIn OAuth
|--------------------------------------------------------------------------
*/

if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
  passport.use(
    new LinkedInStrategy(
      {
        clientID: process.env.LINKEDIN_CLIENT_ID,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
        callbackURL: LINKEDIN_CALLBACK_URL,
        scope: ["openid", "profile", "email"],
        state: true,
        passReqToCallback: false,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const data = extractLinkedInProfile(profile);

          const student = await upsertOAuthStudent({
            ...data,
            provider: "linkedin",
          });

          return done(null, student);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
} else {
  console.warn(
    "[Passport] LinkedIn OAuth not configured. Missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET."
  );
}

module.exports = passport;