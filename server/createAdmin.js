require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Student = require("./models/Student");

async function createAdmin() {
  await mongoose.connect(process.env.MONGO_URI);

  const exists = await Student.findOne({
    email: "admin@cybernet.com",
  });

  if (exists) {
    console.log("Admin already exists");
    process.exit();
  }

  const password = await bcrypt.hash(
    "Admin@123",
    10
  );

  await Student.create({
    firstName: "Ashish",
    lastName: "Admin",
    email: "admin@cybernet.com",
    password,
    role: "admin",
    isActive: true,
    accountStatus: "active",
  });

  console.log("Admin Created");
  process.exit();
}

createAdmin();