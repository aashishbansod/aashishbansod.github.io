const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("❌ MONGO_URI not found in .env");
      process.exit(1);
    }

    const conn = await mongoose.connect(
      process.env.MONGO_URI,
      {
        serverSelectionTimeoutMS: 10000,
      }
    );

    console.log(
      `✅ MongoDB Connected: ${conn.connection.host}`
    );

    mongoose.connection.on(
      "connected",
      () => {
        console.log(
          "📦 MongoDB Connection Established"
        );
      }
    );

    mongoose.connection.on(
      "error",
      (err) => {
        console.error(
          "❌ MongoDB Error:",
          err.message
        );
      }
    );

    mongoose.connection.on(
      "disconnected",
      () => {
        console.warn(
          "⚠️ MongoDB Disconnected"
        );
      }
    );

  } catch (error) {

    console.error(
      "❌ Database Connection Failed"
    );

    console.error(
      "Reason:",
      error.message
    );

    process.exit(1);
  }
};

module.exports = connectDB;