const passport = require("passport");

const GoogleStrategy =
  require("passport-google-oauth20").Strategy;

const GitHubStrategy =
  require("passport-github2").Strategy;

const LinkedInStrategy =
  require("passport-linkedin-oauth2").Strategy;

const Student = require("../models/Student");

/*
|--------------------------------------------------------------------------
| Passport Session
|--------------------------------------------------------------------------
*/

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(
  async (id, done) => {
    try {
      const user =
        await Student.findById(id);

      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }
);

/*
|--------------------------------------------------------------------------
| Google OAuth
|--------------------------------------------------------------------------
*/

passport.use(
  new GoogleStrategy(
    {
      clientID:
        process.env.GOOGLE_CLIENT_ID,

      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET,

      callbackURL:
        "http://localhost:5000/api/auth/google/callback",
    },

    async (
      accessToken,
      refreshToken,
      profile,
      done
    ) => {
      try {
        let student =
          await Student.findOne({
            email:
              profile.emails?.[0]
                ?.value,
          });

        if (!student) {
          student =
            await Student.create({
              firstName:
                profile.name
                  ?.givenName ||
                "Google",

              lastName:
                profile.name
                  ?.familyName ||
                "User",

              email:
                profile.emails?.[0]
                  ?.value,

              mobile:
                "0000000000",

              college:
                "Not Provided",

              course:
                "Not Provided",

              year: "1",

              internshipDomain:
                "Web Development",

              password:
                "GOOGLE_AUTH",

              role: "student",
            });
        }

        return done(
          null,
          student
        );
      } catch (error) {
        return done(
          error,
          null
        );
      }
    }
  )
);

/*
|--------------------------------------------------------------------------
| GitHub OAuth
|--------------------------------------------------------------------------
*/

passport.use(
  new GitHubStrategy(
    {
      clientID:
        process.env.GITHUB_CLIENT_ID,

      clientSecret:
        process.env.GITHUB_CLIENT_SECRET,

      callbackURL:
        "http://localhost:5000/api/auth/github/callback",
    },

    async (
      accessToken,
      refreshToken,
      profile,
      done
    ) => {
      try {
        const email =
          profile.emails?.[0]
            ?.value ||
          `${profile.username}@github.com`;

        let student =
          await Student.findOne({
            email,
          });

        if (!student) {
          student =
            await Student.create({
              firstName:
                profile.displayName ||
                profile.username,

              lastName:
                "GitHub",

              email,

              mobile:
                "0000000000",

              college:
                "Not Provided",

              course:
                "Not Provided",

              year: "1",

              internshipDomain:
                "Web Development",

              password:
                "GITHUB_AUTH",

              role: "student",
            });
        }

        return done(
          null,
          student
        );
      } catch (error) {
        return done(
          error,
          null
        );
      }
    }
  )
);

/*
|--------------------------------------------------------------------------
| LinkedIn OAuth
|--------------------------------------------------------------------------
*/

passport.use(
  new LinkedInStrategy(
    {
      clientID:
        process.env.LINKEDIN_CLIENT_ID,

      clientSecret:
        process.env.LINKEDIN_CLIENT_SECRET,

      callbackURL:
        "http://localhost:5000/api/auth/linkedin/callback",

      scope: [
        "openid",
        "profile",
        "email",
      ],
    },

    async (
      accessToken,
      refreshToken,
      profile,
      done
    ) => {
      try {
        const email =
          profile.email ||
          `${profile.id}@linkedin.com`;

        let student =
          await Student.findOne({
            email,
          });

        if (!student) {
          student =
            await Student.create({
              firstName:
                profile.givenName ||
                "LinkedIn",

              lastName:
                profile.familyName ||
                "User",

              email,

              mobile:
                "0000000000",

              college:
                "Not Provided",

              course:
                "Not Provided",

              year: "1",

              internshipDomain:
                "Web Development",

              password:
                "LINKEDIN_AUTH",

              role: "student",
            });
        }

        return done(
          null,
          student
        );
      } catch (error) {
        return done(
          error,
          null
        );
      }
    }
  )
);

module.exports = passport;