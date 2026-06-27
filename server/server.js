"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const connectDB = require("./config/db");
const routes = require("./routes");

const app = express();

/*
|--------------------------------------------------------------------------
| Config
|--------------------------------------------------------------------------
*/

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PROD = NODE_ENV === "production";
const CLIENT_URLS = (
  process.env.CLIENT_URLS ||
  process.env.CLIENT_URL ||
  "http://localhost:5173"
)
  .split(",")
  .map((url) => url.trim());

let server;

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const createRequestId = () => {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return crypto.randomBytes(16).toString("hex");
};

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {
      recursive: true,
    });
  }
};

/*
|--------------------------------------------------------------------------
| Security
|--------------------------------------------------------------------------
*/

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
  })
);

app.use(compression());

app.use((req, res, next) => {
  req.requestId = createRequestId();
  res.setHeader(
    "X-Request-Id",
    req.requestId
  );
  next();
});

app.use(
  morgan(
    NODE_ENV === "production"
      ? "combined"
      : "dev"
  )
);

/*
|--------------------------------------------------------------------------
| Rate Limit
|--------------------------------------------------------------------------
*/

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (
        CLIENT_URLS.includes(origin)
      ) {
        return callback(null, true);
      }

      return callback(
        new Error(
          `Blocked by CORS: ${origin}`
        )
      );
    },
    credentials: true,
  })
);

/*
|--------------------------------------------------------------------------
| Body Parser
|--------------------------------------------------------------------------
*/

app.use(
  express.json({
    limit: "50mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "50mb",
  })
);

app.use(cookieParser());

/*
|--------------------------------------------------------------------------
| Static Files
|--------------------------------------------------------------------------
*/

const uploadsDir = path.join(
  __dirname,
  "uploads"
);

const certificatesDir =
  path.join(
    __dirname,
    "certificates"
  );

const clientBuild = path.resolve(
  __dirname,
  "../client/dist"
);

ensureDir(uploadsDir);
ensureDir(certificatesDir);

app.use(
  "/uploads",
  express.static(uploadsDir)
);

app.use(
  "/certificates",
  express.static(
    certificatesDir
  )
);

/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    company:
      "CyberNet Technology Systems",
    project:
      "CyberNet Internship Portal",
    version: "1.0.0",
    environment: NODE_ENV,
    status: "Running",
    timestamp:
      new Date().toISOString(),
  });
});

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

app.use("/api", routes);

/*
|--------------------------------------------------------------------------
| React Build
|--------------------------------------------------------------------------
*/

if (
  IS_PROD &&
  fs.existsSync(clientBuild)
) {
  app.use(
    express.static(clientBuild)
  );

  app.get("*", (req, res) => {
    if (
      req.originalUrl.startsWith(
        "/api"
      )
    ) {
      return res
        .status(404)
        .json({
          success: false,
          message:
            "API Route Not Found",
        });
    }

    res.sendFile(
      path.join(
        clientBuild,
        "index.html"
      )
    );
  });
}

/*
|--------------------------------------------------------------------------
| 404
|--------------------------------------------------------------------------
*/

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route Not Found",
    path: req.originalUrl,
    method: req.method,
  });
});

/*
|--------------------------------------------------------------------------
| Error Handler
|--------------------------------------------------------------------------
*/

app.use(
  (
    err,
    req,
    res,
    next
  ) => {
    console.error(err);

    res.status(
      err.statusCode || 500
    );

    res.json({
      success: false,
      message:
        err.message ||
        "Internal Server Error",
      ...(NODE_ENV !==
      "production"
        ? {
            stack:
              err.stack,
          }
        : {}),
    });
  }
);

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

async function startServer() {
  try {
    await connectDB();

    server = app.listen(
      PORT,
      () => {
        console.log(
          "\n=================================="
        );
        console.log(
          "🚀 CyberNet Technology Systems"
        );
        console.log(
          `🌐 Server : http://localhost:${PORT}`
        );
        console.log(
          `📦 Environment : ${NODE_ENV}`
        );
        console.log(
          "✅ MongoDB Connected"
        );
        console.log(
          "==================================\n"
        );
      }
    );
  } catch (error) {
    console.error(
      "❌ Server Start Failed"
    );
    console.error(error);
    process.exit(1);
  }
}

process.on(
  "SIGINT",
  () => {
    if (server) {
      server.close(() =>
        process.exit(0)
      );
    }
  }
);

process.on(
  "SIGTERM",
  () => {
    if (server) {
      server.close(() =>
        process.exit(0)
      );
    }
  }
);

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
};