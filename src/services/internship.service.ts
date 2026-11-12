import StudentModel from "@/models/Student";
import connectDB from "@/lib/db";
import {
INTERNSHIP_PLANS,
selectInternship as selectStudentInternship,
type InternshipPlan,
type SelectInternshipInput,
type ServiceResult,
} from "@/services/student.service";
export type {
InternshipPlan,
};
export interface InternshipPlanDetails {
code: InternshipPlan;
name: string;
durationMonths: number;
durationDays: number;
amount: number;
currency: string;
amountInPaise: number;
}
export interface InternshipEligibility {
eligible: boolean;
applicationApproved: boolean;
assessmentPassed: boolean;
internshipApplicationAllowed: boolean;
internshipStatus: string;
selectedPlan: string;
selectedTrack: string;
paymentStatus: string;
paymentAmount: number;
paymentCurrency: string;
studentOpsApprovalStatus: string;
studentOpsStatus: string;
dashboardStatus: string;
dashboardLoginEnabled: boolean;
reasonCode: string;
reason: string;
}
export interface InternshipStatus {
studentId: string;
applicationId: string;
fullName: string;
email: string;
internshipTrack: string;
internshipPlan: string;
internshipPlanName: string;
durationMonths: number;
durationDays: number;
internshipStatus: string;
startPreference: string;
internshipSelectionAt: Date | null;
paymentStatus: string;
paymentAmount: number;
paymentCurrency: string;
paymentCompletedAt: Date | null;
studentOpsApprovalStatus: string;
studentOpsStatus: string;
dashboardStatus: string;
dashboardLoginEnabled: boolean;
internshipStartDate: Date | null;
internshipEndDate: Date | null;
}
export interface SelectInternshipServiceInput {
studentId: string;
plan: InternshipPlan;
track: string;
startPreference?: string;
}
const MAX_STUDENT_ID_LENGTH = 100;
const MAX_TRACK_LENGTH = 150;
const MAX_START_PREFERENCE_LENGTH = 100;
const MAX_APPLICATION_ID_LENGTH = 150;
const MAX_NAME_LENGTH = 150;
const MAX_EMAIL_LENGTH = 254;
const DEFAULT_CURRENCY = "INR";
const VALID_PAYMENT_STATUSES = new Set([
"unpaid",
"pending",
"paid",
"failed",
"refunded",
]);
const PAYMENT_PENDING_INTERNSHIP_STATUSES =
new Set([
"payment-pending",
]);
const TERMINAL_INTERNSHIP_STATUSES =
new Set([
"completed",
"expired",
"rejected",
]);
const DASHBOARD_ACTIVE_STATUSES =
new Set([
"active",
"completed",
]);
function cleanString(
value: unknown,
maxLength = 500,
): string {
if (typeof value !== "string") {
return "";
}
return value
.replace(/\u0000/g, "")
.trim()
.slice(0, maxLength);
}
function normalizeId(
value: unknown,
): string {
return cleanString(
value,
MAX_STUDENT_ID_LENGTH,
).toUpperCase();
}
function normalizeTrack(
value: unknown,
): string {
return cleanString(
value,
MAX_TRACK_LENGTH,
);
}
function normalizeStartPreference(
value: unknown,
): string {
return cleanString(
value,
MAX_START_PREFERENCE_LENGTH,
);
}
function normalizeCurrency(
value: unknown,
): string {
return (
cleanString(
value,
10,
).toUpperCase() ||
DEFAULT_CURRENCY
);
}
function normalizeStatus(
value: unknown,
): string {
return cleanString(
value,
80,
).toLowerCase();
}
function numberValue(
value: unknown,
fallback = 0,
): number {
const result = Number(value);
return Number.isFinite(result)
? result
: fallback;
}
function booleanValue(
value: unknown,
): boolean {
return value === true;
}
function safeDate(
value: unknown,
): Date | null {
if (
value instanceof Date &&
!Number.isNaN(
value.getTime(),
)
) {
return value;
}
if (
typeof value === "string" ||
typeof value === "number"
) {
const date = new Date(value);
if (
!Number.isNaN(
date.getTime(),
)
) {
return date;
}
}
return null;
}
function asRecord(
value: unknown,
): Record<string, unknown> {
if (
value === null ||
typeof value !== "object"
) {
return {};
}
return value as Record<
string,
unknown
>;
}
function normalizePlanCode(
value: unknown,
): string {
const normalized = cleanString(value, 50)
.toLowerCase()
.replace(/[_-]+/g, " ")
.replace(/\s+/g, " ");
const aliases: Record<string, string> = {
"1 month": "1 month",
"1month": "1 month",
"one month": "1 month",
"onemonth": "1 month",
"3 months": "3 months",
"3 month": "3 months",
"3months": "3 months",
"three months": "3 months",
"threemonths": "3 months",
"6 months": "6 months",
"6 month": "6 months",
"6months": "6 months",
"six months": "6 months",
"sixmonths": "6 months",
};
return aliases[normalized] ?? normalized;
}
function normalizeEmail(
value: unknown,
): string {
return cleanString(
value,
MAX_EMAIL_LENGTH,
).toLowerCase();
}
function isValidAmount(
amount: number,
): boolean {
return (
Number.isFinite(amount) &&
amount >= 0
);
}
async function ensureDatabase(): Promise<void> {
await connectDB();
}
export function getInternshipPlans(): InternshipPlanDetails[] {
return (
Object.entries(
INTERNSHIP_PLANS,
) as [
InternshipPlan,
(typeof INTERNSHIP_PLANS)[InternshipPlan],
][]
).map(
([code, plan]) => {
const amount =
numberValue(
plan.amount,
0,
);
const currency =
normalizeCurrency(
plan.currency,
);
return {
code,
name:
cleanString(
plan.name,
100,
),
durationMonths:
Math.max(
0,
Math.floor(
numberValue(
plan.durationMonths,
0,
),
),
),
durationDays:
Math.max(
0,
Math.floor(
numberValue(
plan.durationDays,
0,
),
),
),
amount,
currency,
amountInPaise:
Math.round(
amount * 100,
),
};
},
);
}
export function getInternshipPlan(
planCode: string,
): InternshipPlanDetails | null {
const code =
normalizePlanCode(
planCode,
) as InternshipPlan;
if (
!Object.prototype.hasOwnProperty.call(
INTERNSHIP_PLANS,
code,
)
) {
return null;
}
const plan =
INTERNSHIP_PLANS[code];
if (!plan) {
return null;
}
const amount =
numberValue(
plan.amount,
0,
);
return {
code,
name:
cleanString(
plan.name,
100,
),
durationMonths:
Math.max(
0,
Math.floor(
numberValue(
plan.durationMonths,
0,
),
),
),
durationDays:
Math.max(
0,
Math.floor(
numberValue(
plan.durationDays,
0,
),
),
),
amount,
currency:
normalizeCurrency(
plan.currency,
),
amountInPaise:
Math.round(
amount * 100,
),
};
}
export function isValidInternshipPlan(
planCode: unknown,
): planCode is InternshipPlan {
const plan =
normalizePlanCode(
planCode,
);
return (
plan.length > 0 &&
Object.prototype.hasOwnProperty.call(
INTERNSHIP_PLANS,
plan,
)
);
}
export function validateInternshipPlanPricing(
planCode: unknown,
expectedAmount?: unknown,
expectedCurrency?: unknown,
): {
valid: boolean;
plan: InternshipPlanDetails | null;
reasonCode: string;
reason: string;
} {
if (
!isValidInternshipPlan(
planCode,
)
) {
return {
valid: false,
plan: null,
reasonCode:
"INVALID_INTERNSHIP_PLAN",
reason:
"The selected internship plan is not valid.",
};
}
const plan =
getInternshipPlan(
String(planCode),
);
if (!plan) {
return {
valid: false,
plan: null,
reasonCode:
"PLAN_NOT_FOUND",
reason:
"The selected internship plan was not found.",
};
}
if (
expectedAmount !== undefined
) {
const suppliedAmount =
numberValue(
expectedAmount,
-1,
);
if (
!isValidAmount(
suppliedAmount,
) ||
suppliedAmount !==
plan.amount
) {
return {
valid: false,
plan,
reasonCode:
"PRICE_MISMATCH",
reason:
"The supplied internship price does not match the official server price.",
};
}
}
if (
expectedCurrency !== undefined
) {
const suppliedCurrency =
normalizeCurrency(
expectedCurrency,
);
if (
suppliedCurrency !==
plan.currency
) {
return {
valid: false,
plan,
reasonCode:
"CURRENCY_MISMATCH",
reason:
"The supplied currency does not match the official server currency.",
};
}
}
return {
valid: true,
plan,
reasonCode:
"PRICING_VALID",
reason:
"Internship plan pricing is valid.",
};
}
async function findStudent(
studentId: string,
): Promise<Record<string, unknown> | null> {
const id =
normalizeId(
studentId,
);
if (!id) {
return null;
}
const student =
await StudentModel
.findOne({
$or: [
{
studentId: id,
},
{
dashboardStudentId: id,
},
],
})
.lean()
.exec();
if (!student) {
return null;
}
return asRecord(
student,
);
}
function isApplicationApproved(
record: Record<string, unknown>,
): boolean {
const applicationStatus =
normalizeStatus(
record.applicationStatus,
);
const adminApprovalStatus =
normalizeStatus(
record.adminApprovalStatus,
);
return (
applicationStatus ===
"approved" ||
adminApprovalStatus ===
"approved"
);
}
function isAssessmentPassed(
record: Record<string, unknown>,
): boolean {
const assessmentStatus =
normalizeStatus(
record.assessmentStatus,
);
const resultStatus =
normalizeStatus(
record.resultStatus,
);
return (
assessmentStatus ===
"passed" &&
resultStatus ===
"passed"
);
}
export async function getInternshipEligibility(
studentId: string,
): Promise<
ServiceResult<InternshipEligibility>
> {
try {
await ensureDatabase();
const id =
normalizeId(
studentId,
);
if (!id) {
return {
success: false,
message:
"Student ID is required.",
code:
"INVALID_STUDENT_ID",
};
}
const record =
await findStudent(id);
if (!record) {
return {
success: false,
message:
"Student account was not found.",
code:
"STUDENT_NOT_FOUND",
};
}
const applicationApproved =
isApplicationApproved(
record,
);
const assessmentPassed =
isAssessmentPassed(
record,
);
const internshipAllowed =
booleanValue(
record.internshipApplicationAllowed,
);
const internshipStatus =
normalizeStatus(
record.internshipStatus,
) || "locked";
const paymentStatus =
normalizeStatus(
record.paymentStatus,
) || "unpaid";
const selectedPlan =
normalizePlanCode(
record.internshipPlan,
);
const selectedTrack =
normalizeTrack(
record.internshipTrack,
);
const paymentAmount =
numberValue(
record.paymentAmount,
0,
);
const paymentCurrency =
normalizeCurrency(
record.paymentCurrency,
);
const studentOpsApprovalStatus =
normalizeStatus(
record.studentOpsApprovalStatus,
) || "pending";
const studentOpsStatus =
normalizeStatus(
record.studentOpsStatus,
) || "not-ready";
const dashboardStatus =
normalizeStatus(
record.dashboardStatus,
) || "locked";
const dashboardLoginEnabled =
booleanValue(
record.dashboardLoginEnabled,
);
let eligible = true;
let reasonCode =
"ELIGIBLE";
let reason =
"Student is eligible to select an internship.";
if (!applicationApproved) {
eligible = false;
reasonCode =
"APPLICATION_NOT_APPROVED";
reason =
"Application approval is required before internship selection.";
} else if (!assessmentPassed) {
eligible = false;
reasonCode =
"ASSESSMENT_NOT_PASSED";
reason =
"Student must pass the assessment before internship selection.";
} else if (!internshipAllowed) {
eligible = false;
reasonCode =
"INTERNSHIP_NOT_AVAILABLE";
reason =
"Internship selection is not currently available.";
} else if (
(
PAYMENT_PENDING_INTERNSHIP_STATUSES.has(internshipStatus) ||
paymentStatus === "pending"
) &&
cleanString(record.razorpayOrderId, 200)
) {
eligible = false;
reasonCode =
"PAYMENT_ORDER_ALREADY_CREATED";
reason =
"A payment order already exists. Complete or resolve that payment before changing plans.";
} else if (
paymentStatus === "paid"
) {
eligible = false;
reasonCode =
"PAYMENT_ALREADY_COMPLETED";
reason =
"Payment has already been completed for this internship.";
} else if (
TERMINAL_INTERNSHIP_STATUSES.has(
internshipStatus,
)
) {
eligible = false;
reasonCode =
"INTERNSHIP_TERMINAL_STATE";
reason =
"The current internship lifecycle is already in a terminal state.";
}
return {
success: true,
message:
eligible
? "Internship selection is available."
: reason,
code:
reasonCode,
data: {
eligible,
applicationApproved,
assessmentPassed,
internshipApplicationAllowed:
internshipAllowed,
internshipStatus,
selectedPlan,
selectedTrack,
paymentStatus,
paymentAmount,
paymentCurrency,
studentOpsApprovalStatus,
studentOpsStatus,
dashboardStatus,
dashboardLoginEnabled,
reasonCode,
reason,
},
};
} catch (error) {
return handleInternshipError(
"[InternshipService] getInternshipEligibility",
error,
);
}
}
export async function selectInternship(
input: SelectInternshipServiceInput,
): Promise<ServiceResult> {
try {
await ensureDatabase();
const studentId =
normalizeId(
input?.studentId,
);
const plan =
normalizePlanCode(
input?.plan,
) as InternshipPlan;
const track =
normalizeTrack(
input?.track,
);
const startPreference =
normalizeStartPreference(
input?.startPreference,
);
if (!studentId) {
return {
success: false,
message:
"Student ID is required.",
code:
"INVALID_STUDENT_ID",
};
}
if (
!isValidInternshipPlan(
plan,
)
) {
return {
success: false,
message:
"Invalid internship plan.",
code:
"INVALID_INTERNSHIP_PLAN",
};
}
if (!track) {
return {
success: false,
message:
"Internship track is required.",
code:
"INTERNSHIP_TRACK_REQUIRED",
};
}
const selectedPlan =
getInternshipPlan(
plan,
);
if (!selectedPlan) {
return {
success: false,
message:
"Selected internship plan was not found.",
code:
"INVALID_INTERNSHIP_PLAN",
};
}
const pricing =
validateInternshipPlanPricing(
plan,
);
if (
!pricing.valid ||
!pricing.plan
) {
return {
success: false,
message:
pricing.reason,
code:
pricing.reasonCode,
};
}
const eligibility =
await getInternshipEligibility(
studentId,
);
if (!eligibility.success) {
return eligibility;
}
if (
eligibility.data &&
!eligibility.data.eligible
) {
return {
success: false,
message:
eligibility.data.reason,
code:
eligibility.data.reasonCode,
};
}
const result =
await selectStudentInternship({
studentId,
plan,
track,
startPreference,
} as SelectInternshipInput);
if (!result.success) {
return result;
}
return {
success: true,
message:
"Internship selected successfully. Payment is now pending.",
code:
"INTERNSHIP_SELECTED",
data: {
...(result.data &&
typeof result.data ===
"object"
? result.data
: {}),
studentId,
planCode:
selectedPlan.code,
internshipPlan:
selectedPlan.name,
durationMonths:
selectedPlan.durationMonths,
durationDays:
selectedPlan.durationDays,
amount:
selectedPlan.amount,
currency:
selectedPlan.currency,
amountInPaise:
selectedPlan.amountInPaise,
internshipTrack:
track,
startPreference,
internshipStatus:
"payment-pending",
paymentStatus:
"pending",
dashboardActivation:
"NOT_ACTIVE",
dashboardLogin:
"LOCKED",
pricingAuthoritative:
true,
},
};
} catch (error) {
return handleInternshipError(
"[InternshipService] selectInternship",
error,
);
}
}
export async function getInternshipStatus(
studentId: string,
): Promise<
ServiceResult<InternshipStatus>
> {
try {
await ensureDatabase();
const id =
normalizeId(
studentId,
);
if (!id) {
return {
success: false,
message:
"Student ID is required.",
code:
"INVALID_STUDENT_ID",
};
}
const record =
await findStudent(id);
if (!record) {
return {
success: false,
message:
"Student account was not found.",
code:
"STUDENT_NOT_FOUND",
};
}
const planCode =
normalizePlanCode(
record.internshipPlan,
) as InternshipPlan;
const plan =
getInternshipPlan(
planCode,
);
const durationDays =
plan?.durationDays ??
Math.max(
0,
Math.floor(
numberValue(
record.internshipDurationDays,
0,
),
),
);
const durationMonths =
plan?.durationMonths ??
(
durationDays > 0
? Math.max(
1,
Math.round(
durationDays / 30,
),
)
: 0
);
const status: InternshipStatus =
{
studentId:
cleanString(
record.studentId,
MAX_STUDENT_ID_LENGTH,
),
applicationId:
cleanString(
record.applicationId,
MAX_APPLICATION_ID_LENGTH,
),
fullName:
cleanString(
record.fullName,
MAX_NAME_LENGTH,
),
email:
normalizeEmail(
record.email,
),
internshipTrack:
normalizeTrack(
record.internshipTrack,
),
internshipPlan:
planCode,
internshipPlanName:
plan?.name || "",
durationMonths,
durationDays,
internshipStatus:
normalizeStatus(
record.internshipStatus,
) || "locked",
startPreference:
normalizeStartPreference(
record.startPreference,
),
internshipSelectionAt:
safeDate(
record.internshipSelectionAt,
),
paymentStatus:
normalizeStatus(
record.paymentStatus,
) || "unpaid",
paymentAmount:
numberValue(
record.paymentAmount,
0,
),
paymentCurrency:
normalizeCurrency(
record.paymentCurrency,
),
paymentCompletedAt:
safeDate(
record.paymentCompletedAt,
),
studentOpsApprovalStatus:
normalizeStatus(
record.studentOpsApprovalStatus,
) || "pending",
studentOpsStatus:
normalizeStatus(
record.studentOpsStatus,
) || "not-ready",
dashboardStatus:
normalizeStatus(
record.dashboardStatus,
) || "locked",
dashboardLoginEnabled:
booleanValue(
record.dashboardLoginEnabled,
),
internshipStartDate:
safeDate(
record.internshipStartDate,
),
internshipEndDate:
safeDate(
record.internshipEndDate,
),
};
return {
success: true,
message:
"Internship status loaded successfully.",
code:
"INTERNSHIP_STATUS_LOADED",
data: status,
};
} catch (error) {
return handleInternshipError<InternshipStatus>(
"[InternshipService] getInternshipStatus",
error,
);
}
}
export async function getInternshipSummary(
studentId: string,
): Promise<
ServiceResult<{
status: InternshipStatus;
eligibility: InternshipEligibility;
plans: InternshipPlanDetails[];
}>
> {
try {
const [
statusResult,
eligibilityResult,
] = await Promise.all([
getInternshipStatus(
studentId,
),
getInternshipEligibility(
studentId,
),
]);
if (
!statusResult.success
) {
return {
success: false,
message:
statusResult.message,
code:
statusResult.code,
};
}
if (
!eligibilityResult.success
) {
return {
success: false,
message:
eligibilityResult.message,
code:
eligibilityResult.code,
};
}
if (
!statusResult.data ||
!eligibilityResult.data
) {
return {
success: false,
message:
"Internship summary could not be generated.",
code:
"INTERNSHIP_SUMMARY_UNAVAILABLE",
};
}
return {
success: true,
message:
"Internship summary loaded successfully.",
code:
"INTERNSHIP_SUMMARY_LOADED",
data: {
status:
statusResult.data,
eligibility:
eligibilityResult.data,
plans:
getInternshipPlans(),
},
};
} catch (error) {
return handleInternshipError(
"[InternshipService] getInternshipSummary",
error,
);
}
}
export async function getInternshipPaymentReadiness(
studentId: string,
): Promise<
ServiceResult<{
ready: boolean;
reasonCode: string;
reason: string;
studentId: string;
planCode: string;
planName: string;
amount: number;
amountInPaise: number;
currency: string;
paymentStatus: string;
internshipStatus: string;
pricingAuthoritative: true;
}>
> {
try {
const statusResult =
await getInternshipStatus(
studentId,
);
if (
!statusResult.success
) {
return {
success: false,
message:
statusResult.message,
code:
statusResult.code,
};
}
const status =
statusResult.data;
if (!status) {
return {
success: false,
message:
"Internship status is unavailable.",
code:
"INTERNSHIP_STATUS_UNAVAILABLE",
};
}
const plan =
getInternshipPlan(
status.internshipPlan,
);
if (!plan) {
return {
success: true,
message:
"Select an internship plan before payment.",
code:
"PAYMENT_NOT_READY",
data: {
ready: false,
reasonCode:
"PLAN_NOT_SELECTED",
reason:
"No valid internship plan has been selected.",
studentId:
status.studentId,
planCode:
"",
planName:
"",
amount:
0,
amountInPaise:
0,
currency:
DEFAULT_CURRENCY,
paymentStatus:
status.paymentStatus,
internshipStatus:
status.internshipStatus,
pricingAuthoritative:
true,
},
};
}
if (
status.paymentAmount > 0 &&
status.paymentAmount !==
plan.amount
) {
return {
success: false,
message:
"Stored internship payment amount does not match the official plan price.",
code:
"STORED_PRICE_MISMATCH",
};
}
if (
status.paymentCurrency &&
status.paymentCurrency !==
plan.currency
) {
return {
success: false,
message:
"Stored internship payment currency does not match the official plan currency.",
code:
"STORED_CURRENCY_MISMATCH",
};
}
if (
status.paymentStatus ===
"paid"
) {
return {
success: true,
message:
"Payment has already been completed.",
code:
"PAYMENT_ALREADY_COMPLETED",
data: {
ready: false,
reasonCode:
"PAYMENT_ALREADY_COMPLETED",
reason:
"Payment has already been completed for this internship.",
studentId:
status.studentId,
planCode:
plan.code,
planName:
plan.name,
amount:
plan.amount,
amountInPaise:
plan.amountInPaise,
currency:
plan.currency,
paymentStatus:
status.paymentStatus,
internshipStatus:
status.internshipStatus,
pricingAuthoritative:
true,
},
};
}
if (
status.internshipStatus !==
"payment-pending"
) {
return {
success: true,
message:
"Internship is not currently ready for payment.",
code:
"PAYMENT_NOT_READY",
data: {
ready: false,
reasonCode:
"INTERNSHIP_NOT_PAYMENT_PENDING",
reason:
"Internship must be selected before payment can be initiated.",
studentId:
status.studentId,
planCode:
plan.code,
planName:
plan.name,
amount:
plan.amount,
amountInPaise:
plan.amountInPaise,
currency:
plan.currency,
paymentStatus:
status.paymentStatus,
internshipStatus:
status.internshipStatus,
pricingAuthoritative:
true,
},
};
}
if (
status.paymentStatus !==
"pending"
) {
return {
success: true,
message:
"Internship payment state is not ready for payment creation.",
code:
"PAYMENT_STATE_INVALID",
data: {
ready: false,
reasonCode:
"INVALID_PAYMENT_STATE",
reason:
"Payment must be in pending state before a payment order can be created.",
studentId:
status.studentId,
planCode:
plan.code,
planName:
plan.name,
amount:
plan.amount,
amountInPaise:
plan.amountInPaise,
currency:
plan.currency,
paymentStatus:
status.paymentStatus,
internshipStatus:
status.internshipStatus,
pricingAuthoritative:
true,
},
};
}
return {
success: true,
message:
"Internship is ready for server-side payment order creation.",
code:
"PAYMENT_READY",
data: {
ready: true,
reasonCode:
"PAYMENT_READY",
reason:
"Selected internship plan is ready for payment.",
studentId:
status.studentId,
planCode:
plan.code,
planName:
plan.name,
amount:
plan.amount,
amountInPaise:
plan.amountInPaise,
currency:
plan.currency,
paymentStatus:
status.paymentStatus,
internshipStatus:
status.internshipStatus,
pricingAuthoritative:
true,
},
};
} catch (error) {
return handleInternshipError(
"[InternshipService] getInternshipPaymentReadiness",
error,
);
}
}
export async function getInternshipOperationsStatus(
studentId: string,
): Promise<
ServiceResult<{
studentId: string;
paymentCompleted: boolean;
paymentStatus: string;
internshipStatus: string;
studentOpsApprovalStatus: string;
studentOpsStatus: string;
readyForOperationsReview: boolean;
dashboardStatus: string;
dashboardLoginEnabled: boolean;
dashboardActivationAllowed: boolean;
reasonCode: string;
reason: string;
}>
> {
try {
const statusResult =
await getInternshipStatus(
studentId,
);
if (
!statusResult.success
) {
return {
success: false,
message:
statusResult.message,
code:
statusResult.code,
};
}
const status =
statusResult.data;
if (!status) {
return {
success: false,
message:
"Internship status is unavailable.",
code:
"INTERNSHIP_STATUS_UNAVAILABLE",
};
}
const paymentCompleted =
status.paymentStatus ===
"paid";
const readyForOperationsReview =
paymentCompleted &&
(
status.internshipStatus ===
"approved" ||
status.studentOpsStatus ===
"pending-review"
) &&
(
status.studentOpsApprovalStatus ===
"pending"
);
const dashboardActivationAllowed =
paymentCompleted &&
status.studentOpsApprovalStatus ===
"approved" &&
(
status.studentOpsStatus ===
"approved" ||
status.studentOpsStatus ===
"active" ||
status.studentOpsStatus ===
"completed"
);
let reasonCode =
"OPERATIONS_STATUS";
let reason =
"Internship Operations status loaded.";
if (!paymentCompleted) {
reasonCode =
"PAYMENT_NOT_COMPLETED";
reason =
"Payment must be verified before Student Operations review.";
} else if (
status.studentOpsApprovalStatus ===
"pending"
) {
reasonCode =
"OPERATIONS_REVIEW_PENDING";
reason =
"Payment is completed and the internship is waiting for Student Operations approval.";
} else if (
dashboardActivationAllowed
) {
reasonCode =
"DASHBOARD_ACTIVATION_ALLOWED";
reason =
"Student Operations approval is complete and dashboard activation is allowed.";
}
return {
success: true,
message:
reason,
code:
reasonCode,
data: {
studentId:
status.studentId,
paymentCompleted,
paymentStatus:
status.paymentStatus,
internshipStatus:
status.internshipStatus,
studentOpsApprovalStatus:
status.studentOpsApprovalStatus,
studentOpsStatus:
status.studentOpsStatus,
readyForOperationsReview,
dashboardStatus:
status.dashboardStatus,
dashboardLoginEnabled:
status.dashboardLoginEnabled,
dashboardActivationAllowed,
reasonCode,
reason,
},
};
} catch (error) {
return handleInternshipError(
"[InternshipService] getInternshipOperationsStatus",
error,
);
}
}
export async function getInternshipDashboardState(
studentId: string,
): Promise<
ServiceResult<{
studentId: string;
paymentCompleted: boolean;
operationsApproved: boolean;
dashboardStatus: string;
dashboardLoginEnabled: boolean;
internshipActive: boolean;
allowed: boolean;
reasonCode: string;
reason: string;
}>
> {
try {
const statusResult =
await getInternshipStatus(
studentId,
);
if (
!statusResult.success
) {
return {
success: false,
message:
statusResult.message,
code:
statusResult.code,
};
}
const status =
statusResult.data;
if (!status) {
return {
success: false,
message:
"Internship status is unavailable.",
code:
"INTERNSHIP_STATUS_UNAVAILABLE",
};
}
const paymentCompleted =
status.paymentStatus ===
"paid";
const operationsApproved =
status.studentOpsApprovalStatus ===
"approved";
const internshipActive =
status.internshipStatus ===
"active";
const dashboardActive =
status.dashboardStatus ===
"active";
const dashboardLoginEnabled =
status.dashboardLoginEnabled;
const allowed =
paymentCompleted &&
operationsApproved &&
dashboardActive &&
dashboardLoginEnabled;
let reasonCode =
"DASHBOARD_LOCKED";
let reason =
"Student dashboard is not active.";
if (!paymentCompleted) {
reasonCode =
"PAYMENT_NOT_COMPLETED";
reason =
"Payment must be verified before dashboard activation.";
} else if (
!operationsApproved
) {
reasonCode =
"STUDENT_OPERATIONS_APPROVAL_REQUIRED";
reason =
"Student Operations approval is required before dashboard activation.";
} else if (
!dashboardActive
) {
reasonCode =
"DASHBOARD_NOT_ACTIVE";
reason =
"Dashboard has not been activated yet.";
} else if (
!dashboardLoginEnabled
) {
reasonCode =
"DASHBOARD_LOGIN_DISABLED";
reason =
"Dashboard login is currently disabled.";
} else {
reasonCode =
"DASHBOARD_ACTIVE";
reason =
"Student dashboard is active.";
}
return {
success: true,
message:
reason,
code:
reasonCode,
data: {
studentId:
status.studentId,
paymentCompleted,
operationsApproved,
dashboardStatus:
status.dashboardStatus,
dashboardLoginEnabled,
internshipActive,
allowed,
reasonCode,
reason,
},
};
} catch (error) {
return handleInternshipError(
"[InternshipService] getInternshipDashboardState",
error,
);
}
}
export function getPublicInternshipPlans(): {
plans: InternshipPlanDetails[];
currency: string;
pricingAuthoritative: true;
} {
return {
plans:
getInternshipPlans(),
currency:
DEFAULT_CURRENCY,
pricingAuthoritative:
true,
};
}
export function verifySelectedPlanAmount(
planCode: unknown,
amount: unknown,
currency: unknown,
): {
valid: boolean;
plan: InternshipPlanDetails | null;
expectedAmount: number;
receivedAmount: number;
expectedCurrency: string;
receivedCurrency: string;
reasonCode: string;
reason: string;
} {
const plan =
isValidInternshipPlan(
planCode,
)
? getInternshipPlan(
String(planCode),
)
: null;
const receivedAmount =
numberValue(
amount,
-1,
);
const receivedCurrency =
normalizeCurrency(
currency,
);
if (!plan) {
return {
valid: false,
plan: null,
expectedAmount: 0,
receivedAmount,
expectedCurrency:
DEFAULT_CURRENCY,
receivedCurrency,
reasonCode:
"INVALID_INTERNSHIP_PLAN",
reason:
"The selected internship plan is invalid.",
};
}
const amountMatches =
receivedAmount ===
plan.amount;
const currencyMatches =
receivedCurrency ===
plan.currency;
if (
!amountMatches
) {
return {
valid: false,
plan,
expectedAmount:
plan.amount,
receivedAmount,
expectedCurrency:
plan.currency,
receivedCurrency,
reasonCode:
"PRICE_MISMATCH",
reason:
"Payment amount does not match the official internship plan price.",
};
}
if (
!currencyMatches
) {
return {
valid: false,
plan,
expectedAmount:
plan.amount,
receivedAmount,
expectedCurrency:
plan.currency,
receivedCurrency,
reasonCode:
"CURRENCY_MISMATCH",
reason:
"Payment currency does not match the official internship plan currency.",
};
}
return {
valid: true,
plan,
expectedAmount:
plan.amount,
receivedAmount,
expectedCurrency:
plan.currency,
receivedCurrency,
reasonCode:
"PAYMENT_AMOUNT_VALID",
reason:
"Payment amount and currency match the official internship plan.",
};
}
export function getInternshipLifecycleState(
status: Pick<
InternshipStatus,
| "internshipStatus"
| "paymentStatus"
| "studentOpsApprovalStatus"
| "studentOpsStatus"
| "dashboardStatus"
| "dashboardLoginEnabled"
>,
): {
paymentVerified: boolean;
operationsPending: boolean;
operationsApproved: boolean;
dashboardActive: boolean;
internshipActive: boolean;
} {
const paymentVerified =
status.paymentStatus ===
"paid";
const operationsPending =
paymentVerified &&
status.studentOpsApprovalStatus ===
"pending";
const operationsApproved =
paymentVerified &&
status.studentOpsApprovalStatus ===
"approved";
const dashboardActive =
operationsApproved &&
DASHBOARD_ACTIVE_STATUSES.has(
status.dashboardStatus,
) &&
status.dashboardLoginEnabled;
const internshipActive =
status.internshipStatus ===
"active";
return {
paymentVerified,
operationsPending,
operationsApproved,
dashboardActive,
internshipActive,
};
}
function handleInternshipError<
T = unknown,
>(
context: string,
error: unknown,
): ServiceResult<T> {
console.error(
context,
error,
);
return {
success: false,
message:
"Unable to process internship request right now. Please try again later.",
code:
"INTERNAL_SERVER_ERROR",
};
}
const internshipService = {
getInternshipPlans,
getPublicInternshipPlans,
getInternshipPlan,
isValidInternshipPlan,
validateInternshipPlanPricing,
verifySelectedPlanAmount,
getInternshipEligibility,
selectInternship,
getInternshipStatus,
getInternshipSummary,
getInternshipPaymentReadiness,
getInternshipOperationsStatus,
getInternshipDashboardState,
getInternshipLifecycleState,
};
export default internshipService;
