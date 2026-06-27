"use strict";

require("dotenv").config();

const mongoose = require("mongoose");

let isConnected = false;
let listenersAttached = false;

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function validateMongoUri(uri) {
  if (!uri || typeof uri !== "string") {
    throw new Error("MONGO_URI environment variable not found");
  }

  const trimmed = uri.trim();

  if (!trimmed) {
    throw new Error("MONGO_URI environment variable is empty");
  }

  if (
    trimmed.includes("<username>") ||
    trimmed.includes("<password>") ||
    trimmed.includes("<cluster>") ||
    trimmed.includes("<dbname>")
  ) {
    throw new Error(
      "MONGO_URI still contains placeholder values. Paste your real MongoDB Atlas connection string."
    );
  }

  return trimmed;
}

function setupMongoEvents() {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on("connected", () => {
    isConnected = true;
    console.log("✅ MongoDB Connection Established");
  });

  mongoose.connection.on("error", (err) => {
    isConnected = false;
    console.error("❌ MongoDB Error:", err.message);
  });

  mongoose.connection.on("disconnected", () => {
    isConnected = false;
    console.warn("⚠️ MongoDB Disconnected");
  });

  mongoose.connection.on("reconnected", () => {
    isConnected = true;
    console.log("🔄 MongoDB Reconnected");
  });

  mongoose.connection.on("close", () => {
    isConnected = false;
    console.log("🛑 MongoDB Connection Closed");
  });
}

/*
|--------------------------------------------------------------------------
| CONNECT DATABASE
|--------------------------------------------------------------------------
*/

async function connectDB() {
  try {
    if (isConnected && mongoose.connection.readyState === 1) {
      console.log("✅ MongoDB Already Connected");
      return mongoose.connection;
    }

    const mongoUri = validateMongoUri(process.env.MONGO_URI);

    mongoose.set("strictQuery", true);

    const conn = await mongoose.connect(mongoUri, {
      maxPoolSize: 20,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      family: 4,
      autoIndex: !process.env.NODE_ENV || process.env.NODE_ENV !== "production",
    });

    isConnected = true;
    setupMongoEvents();

    console.log("\n==================================");
    console.log("✅ MongoDB Connected Successfully");
    console.log(`📦 Database : ${conn.connection.name}`);
    console.log(`🌐 Host     : ${conn.connection.host}`);
    console.log("==================================\n");

    return conn;
  } catch (error) {
    isConnected = false;

    console.error("\n❌ MongoDB Connection Failed");
    console.error("Message:", error.message);
    console.error("Name:", error.name);

    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| CONNECTION STATUS
|--------------------------------------------------------------------------
*/

function getConnectionStatus() {
  return {
    connected: isConnected,
    readyState: mongoose.connection.readyState,
    database: mongoose.connection.name || "Not Connected",
    host: mongoose.connection.host || "Not Connected",
  };
}

/*
|--------------------------------------------------------------------------
| GRACEFUL SHUTDOWN
|--------------------------------------------------------------------------
*/

let shuttingDown = false;

async function closeDatabaseConnection(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  try {
    console.log(`\n🛑 ${signal} received. Closing MongoDB connection...`);

    await mongoose.connection.close(false);

    console.log("✅ MongoDB Connection Closed Successfully");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error closing MongoDB connection");
    console.error(error);
    process.exit(1);
  }
}

/*
|--------------------------------------------------------------------------
| PROCESS HANDLERS
|--------------------------------------------------------------------------
*/

process.on("SIGINT", () => {
  closeDatabaseConnection("SIGINT");
});

process.on("SIGTERM", () => {
  closeDatabaseConnection("SIGTERM");
});

process.on("unhandledRejection", (reason) => {
  console.error("❌ UNHANDLED REJECTION");
  console.error(reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ UNCAUGHT EXCEPTION");
  console.error(error);
  process.exit(1);
});

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = connectDB;
module.exports.getConnectionStatus = getConnectionStatus;
module.exports.closeDatabaseConnection = closeDatabaseConnection;