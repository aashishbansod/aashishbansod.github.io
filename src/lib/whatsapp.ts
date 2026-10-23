/**
 * ============================================================
 * CyberNet Careers
 * WhatsApp Utility
 * ============================================================
 * Current Version:
 * Logs messages locally.
 *
 * Future Ready:
 * - WhatsApp Cloud API
 * - Twilio
 * - Gupshup
 * - MSG91
 * ============================================================
 */

export interface WhatsAppMessage {
  to: string;
  message: string;
}

function formatPhone(phone: string): string {
  let number = phone.replace(/\D/g, "");

  if (!number.startsWith("91")) {
    number = "91" + number;
  }

  return number;
}

async function sendWhatsApp(
  phone: string,
  message: string
): Promise<boolean> {
  try {
    const formattedPhone = formatPhone(phone);

    console.log("\n==============================");
    console.log("📲 WhatsApp Message");
    console.log("==============================");
    console.log("To :", formattedPhone);
    console.log("------------------------------");
    console.log(message);
    console.log("==============================\n");

    /**
     * Future Integration
     *
     * fetch("https://graph.facebook.com/v20.0/PHONE_NUMBER_ID/messages", {
     *   method: "POST",
     *   headers: {
     *      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
     *      "Content-Type":"application/json"
     *   },
     *   body: JSON.stringify(...)
     * })
     */

    return true;
  } catch (error) {
    console.error("WhatsApp Error:", error);
    return false;
  }
}

/* ============================================================
   OTP
============================================================ */

export async function sendOTPWhatsApp(
  phone: string,
  otp: string
) {
  return sendWhatsApp(
    phone,
`🔐 CyberNet Careers

Your OTP is:

${otp}

Valid for ${process.env.OTP_EXPIRE_MINUTES || 10} minutes.

Do not share this OTP with anyone.`
  );
}

/* ============================================================
   Login
============================================================ */

export async function sendLoginAlert(
  phone: string,
  name: string
) {
  return sendWhatsApp(
    phone,
`👋 Hello ${name},

You have successfully logged into your CyberNet Careers account.

If this wasn't you, change your password immediately.`
  );
}

/* ============================================================
   Application Submitted
============================================================ */

export async function sendApplicationConfirmation(
  phone: string,
  name: string
) {
  return sendWhatsApp(
    phone,
`🎉 Hello ${name},

Your internship application has been submitted successfully.

Please wait while our team reviews it.

CyberNet Careers`
  );
}

/* ============================================================
   Assessment Approved
============================================================ */

export async function sendAssessmentSelected(
  phone: string,
  name: string
) {
  return sendWhatsApp(
    phone,
`🎯 Congratulations ${name}!

You have been selected for the assessment round.

Login to your dashboard to start your assessment.

CyberNet Careers`
  );
}

/* ============================================================
   Internship Selected
============================================================ */

export async function sendInternshipSelection(
  phone: string,
  name: string
) {
  return sendWhatsApp(
    phone,
`🎉 Congratulations ${name}!

You have been selected for the internship.

Login to your dashboard for further instructions.

CyberNet Careers`
  );
}

/* ============================================================
   Certificate Ready
============================================================ */

export async function sendCertificateReady(
  phone: string,
  name: string,
  url: string
) {
  return sendWhatsApp(
    phone,
`🏆 Congratulations ${name}!

Your internship certificate is ready.

Download:

${url}

CyberNet Careers`
  );
}

/* ============================================================
   Interview Scheduled
============================================================ */

export async function sendInterviewSchedule(
  phone: string,
  name: string,
  date: string,
  time: string
) {
  return sendWhatsApp(
    phone,
`📅 Hello ${name}

Your interview has been scheduled.

Date : ${date}
Time : ${time}

Best of luck!

CyberNet Careers`
  );
}

/* ============================================================
   Rejection
============================================================ */

export async function sendRejectionMessage(
  phone: string,
  name: string
) {
  return sendWhatsApp(
    phone,
`Hello ${name},

Thank you for applying.

Unfortunately, you were not selected this time.

Keep learning and apply again.

CyberNet Careers`
  );
}

/* ============================================================
   Generic
============================================================ */

export async function sendCustomWhatsApp(
  phone: string,
  message: string
) {
  return sendWhatsApp(phone, message);
}