import { NextResponse } from "next/server";



import crypto from "node:crypto";



import nodemailer from "nodemailer";



import connectDB from "@/lib/mongodb";



import Application from "@/models/Application";



import EmailVerification from "@/models/EmailVerification";



import Internship from "@/models/Internship";



export const runtime = "nodejs";



export const dynamic = "force-dynamic";



export const revalidate = 0;



const OTP_LENGTH = readIntegerEnv("OTP_LENGTH", 6, 4, 8);



const OTP_EXPIRE_MINUTES = readIntegerEnv("OTP_EXPIRE_MINUTES", 10, 1, 60);



const OTP_RESEND_COOLDOWN_SECONDS = 60;



const OTP_MAX_RESENDS = 5;



const OTP_MAX_ATTEMPTS = 5;



const MAX_BODY_SIZE_BYTES = 32_000;



const MAX_SKILLS = 20;



const MAX_SKILL_LENGTH = 50;



const MAX_NAME_LENGTH = 120;



const MAX_EMAIL_LENGTH = 254;



const MAX_PHONE_LENGTH = 16;



const MAX_COLLEGE_LENGTH = 200;



const MAX_COURSE_LENGTH = 120;



const MAX_BRANCH_LENGTH = 120;



const MAX_TRACK_LENGTH = 150;



const NO_CACHE_HEADERS = {



  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",



  Pragma: "no-cache",



  Expires: "0",



  "X-Content-Type-Options": "nosniff",



  "X-Frame-Options": "DENY",



  "Referrer-Policy": "strict-origin-when-cross-origin",



};



type ApplyRequestBody = {



  fullName?: unknown;



  email?: unknown;



  phone?: unknown;



  collegeUniversity?: unknown;



  course?: unknown;



  branchStream?: unknown;



  graduationYear?: unknown;



  internshipTrack?: unknown;



  skills?: unknown;



  consentTerms?: unknown;



  consentPrivacy?: unknown;



  consentDeclaration?: unknown;



  // Legacy plan and price fields are intentionally ignored.



  internshipId?: unknown;



  planCode?: unknown;



  duration?: unknown;



  selectedDuration?: unknown;



  price?: unknown;



  priceInPaise?: unknown;



};



type PendingApplicationPayload = {



  fullName: string;



  email: string;



  phone: string;



  collegeUniversity: string;



  course: string;



  branchStream: string;



  graduationYear: string;



  internshipTrack: string;



  skills: string[];



  consentTerms: true;



  consentPrivacy: true;



  consentDeclaration: true;



};



type PublicInternship = {



  id: string;



  title: string;



  domain: string;



  assessmentDomain: string;



  assessmentRequired: boolean;



};



function readIntegerEnv(name: string, fallback: number, min: number, max: number): number {



  const raw = process.env[name];



  if (raw === undefined || raw.trim() === "") return fallback;



  const value = Number(raw);



  if (!Number.isInteger(value) || value < min || value > max) {



    throw new Error(`${name} must be an integer between ${min} and ${max}.`);



  }



  return value;



}



function jsonResponse(



  body: Record<string, unknown>,



  status = 200,



  extraHeaders?: HeadersInit,



): NextResponse {



  return NextResponse.json(body, {



    status,



    headers: { ...NO_CACHE_HEADERS, ...extraHeaders },



  });



}



function fail(message: string, code: string, status: number, extra: Record<string, unknown> = {}) {



  return jsonResponse({ success: false, message, error: message, code, ...extra }, status);



}



function cleanString(value: unknown): string {



  return typeof value === "string" ? value.trim() : "";



}



function normalizeText(value: unknown): string {



  return cleanString(value).replace(/\s+/g, " ");



}



function normalizeEmail(value: unknown): string {



  return normalizeText(value).toLowerCase();



}



function normalizePhone(value: unknown): string {



  const raw = cleanString(value);



  const digits = raw.replace(/\D/g, "");

  if (raw.startsWith("+")) return `+${digits}`;
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return digits;



}



function escapeHtml(value: string): string {



  return value



    .replaceAll("&", "&amp;")



    .replaceAll("<", "&lt;")



    .replaceAll(">", "&gt;")



    .replaceAll('"', "&quot;")



    .replaceAll("'", "&#039;");



}



function validEmail(email: string): boolean {



  return email.length <= MAX_EMAIL_LENGTH && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);



}



function validName(name: string): boolean {



  return name.length >= 2 && name.length <= MAX_NAME_LENGTH && /^[\p{L}][\p{L}\p{M}.'’ -]*$/u.test(name);



}



function parseYear(value: unknown): number | null {



  if (typeof value !== "string" && typeof value !== "number") return null;



  const year = Number(value);



  return Number.isInteger(year) ? year : null;



}



function normalizeSkills(value: unknown): string[] {



  if (!Array.isArray(value)) return [];



  const unique = new Set<string>();



  for (const item of value) {



    if (typeof item !== "string") continue;



    const skill = normalizeText(item);



    if (skill && skill.length <= MAX_SKILL_LENGTH) unique.add(skill);



  }



  return [...unique];



}



async function readJsonBody(request: Request): Promise<ApplyRequestBody | NextResponse> {



  const contentType = request.headers.get("content-type") ?? "";



  if (!contentType.toLowerCase().includes("application/json")) {



    return fail("Content-Type must be application/json.", "UNSUPPORTED_CONTENT_TYPE", 415);



  }



  const contentLength = Number(request.headers.get("content-length") ?? 0);



  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_SIZE_BYTES) {



    return fail("Request body is too large.", "REQUEST_TOO_LARGE", 413);



  }



  try {



    const raw = await request.text();



    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_SIZE_BYTES) {



      return fail("Request body is too large.", "REQUEST_TOO_LARGE", 413);



    }



    const parsed: unknown = JSON.parse(raw);



    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {



      return fail("Request body must be a JSON object.", "INVALID_REQUEST_BODY", 400);



    }



    return parsed as ApplyRequestBody;



  } catch {



    return fail("Invalid JSON request body.", "INVALID_JSON", 400);



  }



}



function isNextResponse(value: ApplyRequestBody | NextResponse): value is NextResponse {



  return value instanceof NextResponse;



}



function generateOtp(): string {



  return crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");



}



function hashOtp(otp: string): string {



  return crypto.createHash("sha256").update(otp, "utf8").digest("hex");



}



function safeErrorMetadata(error: unknown): Record<string, unknown> {



  if (!error || typeof error !== "object") return { message: "Unknown error" };



  const e = error as { code?: unknown; command?: unknown; responseCode?: unknown; message?: unknown };



  return {



    code: typeof e.code === "string" ? e.code : undefined,



    command: typeof e.command === "string" ? e.command : undefined,



    responseCode: typeof e.responseCode === "number" ? e.responseCode : undefined,



    message: typeof e.message === "string" ? e.message.slice(0, 300) : undefined,



  };



}



function createTransporter() {



  const host = cleanString(process.env.SMTP_HOST);



  const user = cleanString(process.env.SMTP_USER);



  const pass = process.env.SMTP_PASS ?? "";



  const port = Number(process.env.SMTP_PORT ?? 465);



  if (!host || !user || !pass.trim()) {



    throw new Error("SMTP_HOST, SMTP_USER, and SMTP_PASS must be configured in the production environment.");



  }



  if (!Number.isInteger(port) || port < 1 || port > 65535) {



    throw new Error("SMTP_PORT must be a valid port number.");



  }



  return nodemailer.createTransport({



    host,



    port,



    secure: port === 465,



    auth: { user, pass },



    connectionTimeout: 12_000,



    greetingTimeout: 12_000,



    socketTimeout: 20_000,



    tls: { minVersion: "TLSv1.2" },



  });



}



async function sendOtpEmail(



  email: string,



  fullName: string,



  otp: string,



  internship: PublicInternship,



): Promise<void> {



  const transporter = createTransporter();



  const smtpUser = cleanString(process.env.SMTP_USER);



  const from = cleanString(process.env.EMAIL_FROM) || `CyberNet Careers <${smtpUser}>`;



  const safeName = escapeHtml(fullName);



  const safeOtp = escapeHtml(otp);



  const safeTitle = escapeHtml(internship.title);



  const safeDomain = escapeHtml(internship.domain);



  const expiry = `${OTP_EXPIRE_MINUTES} minutes`;



  try {



    await transporter.sendMail({



      from,



      to: email,



      subject: "CyberNet Careers | Email Verification OTP",



      text: [



        `Hello ${fullName},`,



        "",



        "Your CyberNet Careers email verification code is:",



        "",



        otp,



        "",



        `Internship domain: ${internship.domain}`,



        `Program: ${internship.title}`,



        `This OTP expires in ${expiry}.`,



        "Never share this OTP with anyone.",



        "Your application is registered only after successful email verification.",



        "No payment is required at the application stage.",



        "CyberNet Careers",



      ].join("\n"),



      html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CyberNet Careers Email Verification</title></head><body style="margin:0;padding:24px 12px;background:#f4f8ff;font-family:Arial,Helvetica,sans-serif;color:#0f172a"><main style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #dbe7ff;border-radius:16px;overflow:hidden"><header style="padding:24px;text-align:center;background:#2563eb;color:#fff;font-size:22px;font-weight:800">CyberNet Careers</header><section style="padding:28px 24px"><h1 style="margin:0;text-align:center;font-size:25px">Verify Your Email</h1><p style="color:#475569;line-height:1.6">Hello ${safeName}, use this verification code to continue your application.</p><div style="margin:24px 0;padding:24px;text-align:center;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px"><div style="font-size:11px;letter-spacing:2px;color:#64748b;font-weight:700">VERIFICATION CODE</div><div style="margin-top:12px;color:#2563eb;font-size:34px;font-weight:800;letter-spacing:8px">${safeOtp}</div></div><p style="color:#475569">This OTP expires in <strong>${expiry}</strong>.</p><p style="padding:14px;background:#f8fafc;border-radius:10px;color:#334155;line-height:1.6"><strong>Internship domain:</strong><br>${safeDomain}<br><br><strong>Program:</strong><br>${safeTitle}</p><p style="color:#9a3412;background:#fff7ed;padding:12px;border-radius:8px">Never share this OTP. No payment is required at the application stage.</p></section><footer style="padding:18px;text-align:center;background:#f8fafc;color:#64748b;font-size:12px">Automated email — please do not reply.</footer></main></body></html>`,



    });



  } finally {



    transporter.close();



  }



}



function duplicateKey(error: unknown): boolean {



  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === 11000);



}



async function findAvailableInternship(track: string): Promise<PublicInternship | null> {



  // Exact, case-insensitive match. Do not accept a plan or price from the browser.



  const escaped = track.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");



  const exactTrack = new RegExp(`^${escaped}$`, "i");



  const internship = await Internship.findOne(



    {



      $or: [{ domain: exactTrack }, { assessmentDomain: exactTrack }],



      status: "active",



      isPublic: true,



      isSelectable: true,



      applicationRequired: true,



    },



    { _id: 1, title: 1, name: 1, domain: 1, assessmentDomain: 1, assessmentRequired: 1 },



  )



    .sort({ sortOrder: 1, createdAt: -1, _id: -1 })



    .lean()



    .exec();



  if (!internship) return null;



  const record = internship as unknown as {



    _id: unknown;



    title?: unknown;



    name?: unknown;



    domain?: unknown;



    assessmentDomain?: unknown;



    assessmentRequired?: unknown;



  };



  const domain = normalizeText(record.domain) || track;



  return {



    id: String(record._id),



    title: normalizeText(record.title) || normalizeText(record.name) || "Internship Program",



    domain,



    assessmentDomain: normalizeText(record.assessmentDomain) || domain,



    assessmentRequired: record.assessmentRequired !== false,



  };



}



export async function POST(request: Request): Promise<NextResponse> {



  const requestId = crypto.randomUUID();



  try {



    if (request.signal.aborted) {



      return fail("Request was cancelled. Please try again.", "REQUEST_ABORTED", 400);



    }



    const parsed = await readJsonBody(request);



    if (isNextResponse(parsed)) return parsed;



    const body = parsed;



    const fullName = normalizeText(body.fullName);



    const email = normalizeEmail(body.email);



    const phone = normalizePhone(body.phone);



    const collegeUniversity = normalizeText(body.collegeUniversity);



    const course = normalizeText(body.course);



    const branchStream = normalizeText(body.branchStream);



    const internshipTrack = normalizeText(body.internshipTrack);



    const graduationYear = parseYear(body.graduationYear);



    const skills = normalizeSkills(body.skills);



    if (!validName(fullName)) return fail("Enter a valid full name.", "INVALID_NAME", 400);



    if (!validEmail(email)) return fail("Enter a valid email address.", "INVALID_EMAIL", 400);



    if (phone.length > MAX_PHONE_LENGTH || !/^\+[1-9]\d{6,14}$/.test(phone)) {



      return fail("Enter a valid international phone number with country code.", "INVALID_PHONE", 400);



    }



    if (!collegeUniversity || collegeUniversity.length > MAX_COLLEGE_LENGTH) {



      return fail("Enter a valid College / University name.", "INVALID_COLLEGE", 400);



    }



    if (!course || course.length > MAX_COURSE_LENGTH) return fail("Select a valid course.", "INVALID_COURSE", 400);



    if (!branchStream || branchStream.length > MAX_BRANCH_LENGTH) return fail("Select a valid branch / stream.", "INVALID_BRANCH", 400);



    if (graduationYear === null || graduationYear < 2020 || graduationYear > 2050) {



      return fail("Graduation year must be between 2020 and 2050.", "INVALID_GRADUATION_YEAR", 400);



    }



    if (!internshipTrack || internshipTrack.length > MAX_TRACK_LENGTH) {



      return fail("Select a valid internship domain.", "INVALID_INTERNSHIP_TRACK", 400);



    }



    if (skills.length === 0) return fail("Select at least one relevant skill.", "SKILLS_REQUIRED", 400);



    if (skills.length > MAX_SKILLS) return fail(`You can select a maximum of ${MAX_SKILLS} skills.`, "SKILLS_TOO_MANY", 400);



    if (body.skills instanceof Array && body.skills.some((skill) => typeof skill === "string" && skill.trim().length > MAX_SKILL_LENGTH)) {



      return fail("One or more skills are too long.", "INVALID_SKILL", 400);



    }



    if (body.consentTerms !== true || body.consentPrivacy !== true || body.consentDeclaration !== true) {



      return fail("Please accept all required confirmations before submitting.", "CONSENT_REQUIRED", 400);



    }



    try {



      await connectDB();



    } catch (error) {



      console.error("[APPLY] MongoDB connection failed", { requestId, error: safeErrorMetadata(error) });



      return fail("The application service is temporarily unavailable. Please try again later.", "DATABASE_UNAVAILABLE", 503, { requestId });



    }



    const existingApplication = await Application.findOne({ email }, { _id: 1, applicationId: 1, status: 1, emailVerified: 1 }).lean().exec();



    if (existingApplication) {



      return fail("An application already exists for this email address.", "APPLICATION_ALREADY_EXISTS", 409, {



        applicationId: existingApplication.applicationId ? String(existingApplication.applicationId) : "",



        status: existingApplication.status ? String(existingApplication.status) : "",



        emailVerified: existingApplication.emailVerified === true,



      });



    }



    let internship: PublicInternship | null;



    try {



      internship = await findAvailableInternship(internshipTrack);



    } catch (error) {



      console.error("[APPLY] Internship lookup failed", { requestId, error: safeErrorMetadata(error) });



      return fail("Unable to verify internship availability right now. Please try again.", "INTERNSHIP_LOOKUP_FAILED", 503, { requestId });



    }



    if (!internship) {



      return fail("Applications are not currently available for the selected internship domain.", "INTERNSHIP_UNAVAILABLE", 409);



    }



    const now = new Date();



    let existingVerification;



    try {



      existingVerification = await EmailVerification.findOne({ email }).exec();



    } catch (error) {



      console.error("[APPLY] Verification session lookup failed", { requestId, error: safeErrorMetadata(error) });



      return fail("Unable to start email verification right now. Please try again.", "OTP_SESSION_LOOKUP_FAILED", 503, { requestId });



    }



    if (existingVerification) {



      const lastSentAt = existingVerification.lastSentAt instanceof Date



        ? existingVerification.lastSentAt



        : new Date(existingVerification.lastSentAt);



      const elapsedSeconds = Math.floor((now.getTime() - lastSentAt.getTime()) / 1000);



      if (Number.isFinite(elapsedSeconds) && elapsedSeconds < OTP_RESEND_COOLDOWN_SECONDS) {



        const retryAfter = Math.max(1, OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds);



        return fail(`Please wait ${retryAfter} seconds before requesting another OTP.`, "OTP_COOLDOWN", 429, { retryAfter, cooldown: retryAfter });



      }



      if (Number(existingVerification.resendCount ?? 0) >= OTP_MAX_RESENDS) {



        return fail("OTP resend limit reached. Please try again later.", "OTP_RESEND_LIMIT", 429);



      }



    }



    const pendingApplication: PendingApplicationPayload = {



      fullName,



      email,



      phone,



      collegeUniversity,



      course,



      branchStream,



      graduationYear: String(graduationYear),



      internshipTrack,



      skills,



      consentTerms: true,



      consentPrivacy: true,



      consentDeclaration: true,



    };



    const otp = generateOtp();



    const otpHash = hashOtp(otp);



    const expiresAt = new Date(now.getTime() + OTP_EXPIRE_MINUTES * 60 * 1000);



    // Send before replacing a previous OTP so SMTP failure does not invalidate it.



    try {



      await sendOtpEmail(email, fullName, otp, internship);



    } catch (error) {



      console.error("[APPLY] OTP email delivery failed", { requestId, error: safeErrorMetadata(error) });



      return fail(



        "Unable to send verification email. Please try again later.",



        "OTP_EMAIL_FAILED",



        503,



        { requestId },



      );



    }



    try {



      if (existingVerification) {



        existingVerification.set({



          otpHash,



          attempts: 0,



          maxAttempts: OTP_MAX_ATTEMPTS,



          expiresAt,



          lastSentAt: now,



          pendingApplication,



          resendCount: Number(existingVerification.resendCount ?? 0) + 1,



          verifiedAt: undefined,



        });



        await existingVerification.save();



      } else {



        await EmailVerification.create({



          email,



          otpHash,



          attempts: 0,



          maxAttempts: OTP_MAX_ATTEMPTS,



          expiresAt,



          lastSentAt: now,



          resendCount: 0,



          pendingApplication,



        });



      }



    } catch (error) {



      console.error("[APPLY] OTP session save failed after email send", { requestId, error: safeErrorMetadata(error) });



      // Do not expose the OTP or internal database error to the client.



      return fail("We sent the email but could not finish setting up verification. Please contact support before retrying.", "OTP_SESSION_SAVE_FAILED", 503, { requestId });



    }



    return jsonResponse({



      success: true,



      message: "A verification OTP has been sent to your email address.",



      otpRequired: true,



      requiresOtp: true,



      emailVerified: false,



      applicationCreated: false,



      email,



      internship: {



        id: internship.id,



        title: internship.title,



        domain: internship.domain,



        assessmentDomain: internship.assessmentDomain,



        assessmentRequired: internship.assessmentRequired,



      },



      planSelected: false,



      paymentRequired: false,



      expiresInSeconds: OTP_EXPIRE_MINUTES * 60,



      otpExpiresInMinutes: OTP_EXPIRE_MINUTES,



      resendAvailableIn: OTP_RESEND_COOLDOWN_SECONDS,



      cooldown: OTP_RESEND_COOLDOWN_SECONDS,



    });



  } catch (error) {



    if (duplicateKey(error)) {



      return fail("An application or verification session already exists for this email address.", "APPLICATION_ALREADY_EXISTS", 409);



    }



    console.error("[POST /api/apply] Unexpected failure", { requestId, error: safeErrorMetadata(error) });



    return fail("Unable to process your application right now. Please try again later.", "APPLICATION_PROCESSING_FAILED", 500, { requestId });



  }



}



export async function GET(): Promise<NextResponse> {



  return fail("Use POST /api/apply to start an internship application.", "METHOD_NOT_ALLOWED", 405, { allow: "POST, OPTIONS" });



}



export async function PUT(): Promise<NextResponse> {



  return fail("PUT is not supported for applications.", "METHOD_NOT_ALLOWED", 405, { allow: "POST, OPTIONS" });



}



export async function PATCH(): Promise<NextResponse> {



  return fail("PATCH is not supported for applications.", "METHOD_NOT_ALLOWED", 405, { allow: "POST, OPTIONS" });



}



export async function DELETE(): Promise<NextResponse> {



  return fail("DELETE is not supported for applications.", "METHOD_NOT_ALLOWED", 405, { allow: "POST, OPTIONS" });



}



export async function OPTIONS(): Promise<NextResponse> {



  return jsonResponse({ success: true, message: "API methods available.", methods: ["POST", "OPTIONS"] }, 200, { Allow: "POST, OPTIONS" });



}