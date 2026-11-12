import { loadEnvConfig } from "@next/env";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

loadEnvConfig(process.cwd());

async function main() {
  const rl = readline.createInterface({ input, output });

  try {
    const { getStudentAdminModel } = await import("@/models/StudentAdmin");
    const { hashPassword } = await import("@/lib/auth");

    const fullName = (await rl.question("Full name: ")).trim();
    const email = (await rl.question("Email: ")).trim().toLowerCase();
    const username = (await rl.question("Username: ")).trim().toLowerCase();
    const adminId = (await rl.question("Admin ID (CN-OPS-ADMIN-XXXX): "))
      .trim()
      .toUpperCase();
    const phone = (await rl.question("Phone (optional): ")).trim();
    const password = await rl.question("Temporary password (min 8 chars): ");

    if (!fullName || !email || !username || !adminId) {
      throw new Error("Name, email, username and Admin ID are required.");
    }

    if (!/^CN-OPS-ADMIN-[A-Z0-9-]{4,20}$/.test(adminId)) {
      throw new Error("Invalid Admin ID format.");
    }

    if (password.length < 8 || password.length > 128) {
      throw new Error("Password must be 8–128 characters.");
    }

    const StudentAdmin = await getStudentAdminModel();

    const existing = await StudentAdmin.findOne({
      $or: [{ email }, { username }, { adminId }],
    }).select("+password").lean().exec();

    if (existing) {
      throw new Error("An account with this email, username or Admin ID already exists. No changes made.");
    }

    const passwordHash = await hashPassword(password);

    const admin = await StudentAdmin.create({
      adminId,
      username,
      fullName,
      email,
      phone,
      password: passwordHash,
      role: "Student Operations Admin",
      registrationStatus: "active",
      isActive: true,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      registrationCompletedAt: new Date(),
      emailOtpHash: null,
      emailOtpExpiresAt: null,
      emailOtpAttempts: 0,
      emailOtpSentAt: null,
      emailOtpResendCount: 0,
      createdBy: "manual-temporary-setup",
      updatedBy: "manual-temporary-setup",
    });

    console.log("\nStudent Admin created successfully.");
    console.log("Admin ID:", admin.adminId);
    console.log("Username:", admin.username);
    console.log("Email:", admin.email);
    console.log("Role:", admin.role);
    console.log("Status:", admin.registrationStatus);
    console.log("Password: saved as secure hash; not displayed.");
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error("\nSetup failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});