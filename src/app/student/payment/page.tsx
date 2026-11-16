"use client";
import Script from "next/script";
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
export const PAYMENT_PAGE_VERSION = "2026-11-11";
type PlanCode = "ONE_MONTH" | "THREE_MONTHS" | "SIX_MONTHS";
type PaymentState = "loading" | "ready" | "processing" | "verifying" | "pending" | "failed";
type JsonObject = Record<string, unknown>;
type RazorpayResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};
type RazorpayFailure = {
  error?: { description?: string; reason?: string; code?: string };
};
type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  modal?: { escape?: boolean; backdropclose?: boolean; ondismiss?: () => void };
  handler: (response: RazorpayResponse) => void | Promise<void>;
};
type RazorpayInstance = {
  open: () => void;
  close?: () => void;
  on?: (event: string, handler: (response: RazorpayFailure) => void) => void;
};
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}
type Plan = { duration: string; amountPaise: number };
const PLANS: Record<PlanCode, Plan> = {
  ONE_MONTH: { duration: "1 Month", amountPaise: 49900 },
  THREE_MONTHS: { duration: "3 Months", amountPaise: 99900 },
  SIX_MONTHS: { duration: "6 Months", amountPaise: 169900 },
};
const CREATE_ORDER_API = "/api/payment/create-order";
const VERIFY_API = "/api/payment/verify";
const RAZORPAY_SCRIPT = "https\://checkout.razorpay.com/v1/checkout.js";
const INR = "INR";
const TIMEOUT_MS = 30000;
function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function num(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return 0;
}
function obj(value: unknown): JsonObject {
  return isObject(value) ? value : {};
}
function firstString(source: JsonObject, keys: string[]): string {
  for (const key of keys) {
    const value = str(source[key]);
    if (value) return value;
  }
  return "";
}
function firstNumber(source: JsonObject, keys: string[]): number {
  for (const key of keys) {
    const value = num(source[key]);
    if (value > 0) return value;
  }
  return 0;
}
function dataOf(payload: unknown): JsonObject {
  const root = obj(payload);
  const data = obj(root.data);
  return Object.keys(data).length > 0 ? data : root;
}
function money(paise: number, currency = INR): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(paise / 100);
  } catch {
    return `₹${(paise / 100).toFixed(2)}`;
  }
}
function normalizePlan(value: string | null): PlanCode | null {
  const normalized = (value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (["ONE_MONTH", "1_MONTH", "1M"].includes(normalized)) return "ONE_MONTH";
  if (["THREE_MONTHS", "3_MONTHS", "3M"].includes(normalized)) return "THREE_MONTHS";
  if (["SIX_MONTHS", "6_MONTHS", "6M"].includes(normalized)) return "SIX_MONTHS";
  return null;
}
function apiMessage(payload: unknown, fallback: string): string {
  const root = obj(payload);
  return firstString(root, ["message", "error"]) || fallback;
}
function isSuccess(payload: unknown): boolean {
  return obj(payload).success === true;
}
function abortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
function PaymentPageContent() {
  const router = useRouter();
  const search = useSearchParams();
  const internshipId = str(search.get("internshipId"));
  const planCode = normalizePlan(search.get("planCode"));
  const selectedPlan = planCode ? PLANS[planCode] : null;
  const [state, setState] = useState<PaymentState>("loading");
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [title, setTitle] = useState("Selected internship");
  const [duration, setDuration] = useState(selectedPlan?.duration || "—");
  const [currency, setCurrency] = useState(INR);
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [checkoutExpiresAt, setCheckoutExpiresAt] = useState<number | null>(null);
  const [checkoutSecondsLeft, setCheckoutSecondsLeft] = useState<number | null>(null);
  const [baseAmountPaise, setBaseAmountPaise] = useState(selectedPlan?.amountPaise || 0);
  const [taxAmountPaise, setTaxAmountPaise] = useState(0);
  const [feeAmountPaise, setFeeAmountPaise] = useState(0);
  const [totalAmountPaise, setTotalAmountPaise] = useState(selectedPlan?.amountPaise || 0);
  const [taxLabel, setTaxLabel] = useState("Tax");
  const [feeLabel, setFeeLabel] = useState("Payment processing fee");
  const [receiptEmailSent, setReceiptEmailSent] = useState(false);
  const [paymentUncertain, setPaymentUncertain] = useState(false);
  const mounted = useRef(false);
  const checkout = useRef<RazorpayInstance | null>(null);
  const paymentStarted = useRef(false);
  const verifyStarted = useRef(false);
  const countdownInterval = useRef<number | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      try { checkout.current?.close?.(); } catch {}
      checkout.current = null;
      if (countdownInterval.current !== null) window.clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    };
  }, []);
  useEffect(() => {
    if (countdownInterval.current !== null) {
      window.clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
    if (!checkoutExpiresAt) {
      setCheckoutSecondsLeft(null);
      return;
    }
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((checkoutExpiresAt - Date.now()) / 1000));
      setCheckoutSecondsLeft(remaining);
      if (remaining === 0 && countdownInterval.current !== null) {
        window.clearInterval(countdownInterval.current);
        countdownInterval.current = null;
      }
    };
    updateCountdown();
    countdownInterval.current = window.setInterval(updateCountdown, 1000);
    return () => {
      if (countdownInterval.current !== null) window.clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    };
  }, [checkoutExpiresAt]);
  useEffect(() => {
    if (!internshipId || !planCode) {
      setState("failed");
      setError(!internshipId
        ? "Internship details are missing. Please return to the internship list and select a plan."
        : "The selected plan is invalid. Please select a valid plan again.");
      return;
    }
    setDuration(PLANS[planCode].duration);
    setBaseAmountPaise(PLANS[planCode].amountPaise);
    setTotalAmountPaise(PLANS[planCode].amountPaise);
    if (typeof window !== "undefined" && window.Razorpay) {
      setRazorpayLoaded(true);
      setState("ready");
    } else {
      setState("loading");
    }
    setError("");
    setPaymentUncertain(false);
    setCheckoutExpiresAt(null);
    setCheckoutSecondsLeft(null);
  }, [internshipId, planCode]);
  const goBack = useCallback(() => {
    if (state === "processing" || state === "verifying" || paymentUncertain) return;
    router.push("/student/internships");
  }, [paymentUncertain, router, state]);
  const createOrder = useCallback(async () => {
    if (!internshipId || !planCode) throw new Error("Select an internship plan before continuing.");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(CREATE_ORDER_API, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ internshipId, planCode }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !isSuccess(payload)) {
        throw new Error(apiMessage(payload, `Unable to prepare payment (HTTP ${response.status}).`));
      }
      const root = obj(payload);
      const data = dataOf(payload);
      const order = obj(data.order);
      const razorpayOrder = obj(data.razorpayOrder);
      const orderIdValue =
        firstString(data, ["orderId", "razorpayOrderId"]) ||
        firstString(order, ["id", "orderId"]) ||
        firstString(razorpayOrder, ["id", "orderId"]) ||
        firstString(root, ["orderId", "razorpayOrderId"]);
      const keyId =
        firstString(data, ["keyId", "key", "razorpayKeyId"]) ||
        firstString(root, ["keyId", "key", "razorpayKeyId"]);
      const amountPaise =
        firstNumber(data, ["totalAmountInPaise", "amountInPaise", "payableAmountInPaise", "amount"]) ||
        firstNumber(order, ["amount"]) ||
        firstNumber(razorpayOrder, ["amount"]);
      const currencyValue =
        (firstString(data, ["currency"]) || firstString(order, ["currency"]) || INR).toUpperCase();
      if (!orderIdValue || !keyId || !Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
        throw new Error("The payment service returned incomplete order details. Please try again.");
      }
      if (currencyValue !== INR) throw new Error("The selected payment currency is not supported.");
      const internship = obj(data.internship);
      const student = obj(data.student);
      const pricing = obj(data.pricing);
      const checkoutSession = obj(data.checkoutSession);
      const checkoutExpiryValue = firstString(data, ["checkoutSessionExpiresAt", "checkoutExpiresAt"]) || firstString(checkoutSession, ["expiresAt"]);
      const checkoutExpiryTimestamp = checkoutExpiryValue ? Date.parse(checkoutExpiryValue) : Number.NaN;
      const taxes = obj(data.tax);
      const fees = obj(data.fees);
      const titleValue =
        firstString(data, ["title", "internshipTitle", "programName", "internshipName"]) ||
        firstString(internship, ["title", "name", "internshipTitle"]) ||
        "CyberNet Internship Program";
      const durationValue =
        firstString(data, ["duration", "planDuration"]) ||
        firstString(pricing, ["duration", "planDuration"]) ||
        PLANS[planCode].duration;
      const baseValue =
        firstNumber(data, ["baseAmountInPaise", "subtotalInPaise", "planAmountInPaise"]) ||
        firstNumber(pricing, ["baseAmountInPaise", "subtotalInPaise", "amountInPaise"]) ||
        PLANS[planCode].amountPaise;
      const taxValue =
        num(data.taxAmountInPaise) ||
        num(data.gstAmountInPaise) ||
        num(taxes.amountInPaise) ||
        num(taxes.amount);
      const feeValue =
        num(data.processingFeeInPaise) ||
        num(data.razorpayFeeInPaise) ||
        num(fees.amountInPaise) ||
        num(fees.amount);
      const email =
        firstString(data, ["receiptEmail", "email", "studentEmail"]) ||
        firstString(student, ["email", "receiptEmail"]);
      const name =
        firstString(data, ["studentName", "fullName", "name"]) ||
        firstString(student, ["fullName", "name"]);
      const appId =
        firstString(data, ["applicationId"]) ||
        firstString(student, ["applicationId"]);
      if (mounted.current) {
        setTitle(titleValue);
        setDuration(durationValue);
        setCurrency(currencyValue);
        setStudentName(name);
        setStudentEmail(email);
        setApplicationId(appId);
        setOrderId(orderIdValue);
        setBaseAmountPaise(baseValue);
        setTaxAmountPaise(Math.max(0, taxValue));
        setFeeAmountPaise(Math.max(0, feeValue));
        setTaxLabel(firstString(data, ["taxLabel"]) || firstString(taxes, ["label", "name"]) || "GST / applicable tax");
        setFeeLabel(firstString(data, ["feeLabel"]) || firstString(fees, ["label", "name"]) || "Payment processing fee");
        setTotalAmountPaise(amountPaise);
        setCheckoutExpiresAt(Number.isFinite(checkoutExpiryTimestamp) ? checkoutExpiryTimestamp : null);
      }
      return {
        orderId: orderIdValue,
        keyId,
        amountPaise,
        currency: currencyValue,
        title: titleValue,
        duration: durationValue,
        email,
        name,
        appId,
        checkoutExpiresAt: Number.isFinite(checkoutExpiryTimestamp) ? checkoutExpiryTimestamp : null,
      };
    } finally {
      window.clearTimeout(timer);
    }
  }, [internshipId, planCode]);
  const verifyPayment = useCallback(async (
    createdOrder: {
      orderId: string;
      amountPaise: number;
      title: string;
      duration: string;
      email: string;
    },
    responseData: RazorpayResponse,
  ) => {
    if (verifyStarted.current) return;
    verifyStarted.current = true;
    try {
      if (!responseData?.razorpay_payment_id || !responseData?.razorpay_order_id || !responseData?.razorpay_signature) {
        throw new Error("The payment provider returned an incomplete confirmation.");
      }
      if (responseData.razorpay_order_id !== createdOrder.orderId) {
        throw new Error("The payment order could not be matched. Please contact support before trying again.");
      }
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(VERIFY_API, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify({
            internshipId,
            planCode,
            razorpayOrderId: responseData.razorpay_order_id,
            razorpayPaymentId: responseData.razorpay_payment_id,
            razorpaySignature: responseData.razorpay_signature,
          }),
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok || !isSuccess(payload)) {
          throw new Error(apiMessage(payload, `Payment confirmation is not complete (HTTP ${response.status}).`));
        }
        const root = obj(payload);
        const data = dataOf(payload);
        if (root.verified === false || data.verified === false) {
          throw new Error("Payment confirmation could not be verified.");
        }
        const paymentStatus = firstString(data, ["paymentStatus", "status"]).toLowerCase();
        if (!["paid", "success", "completed", "captured"].includes(paymentStatus)) {
          throw new Error("Your payment is not yet confirmed. If your bank shows a debit, do not pay again; contact support to check the transaction.");
        }
        const ops = firstString(data, ["studentOpsApprovalStatus", "operationsApprovalStatus"]).toLowerCase();
        const dashboard = firstString(data, ["dashboardStatus"]).toLowerCase();
        const receipt = obj(data.receipt);
        const emailSent =
          data.receiptEmailSent === true ||
          data.emailSent === true ||
          data.receiptSent === true ||
          receipt.emailSent === true ||
          receipt.receiptEmailSent === true;
        if (!mounted.current) return;
        setReceiptEmailSent(emailSent);
        setNotice(
          emailSent
            ? "Payment confirmed. Your receipt has been sent to your registered email."
            : "Payment confirmed. Your receipt may take a little time to arrive."
        );
        setState("pending");
        checkout.current = null;
        void ops;
        void dashboard;
      } finally {
        window.clearTimeout(timer);
      }
    } finally {
      verifyStarted.current = false;
    }
  }, [internshipId, planCode]);
  const startPayment = useCallback(async () => {
    if (paymentStarted.current || state === "processing" || state === "verifying") return;
    if (!internshipId || !planCode) {
      setState("failed");
      setError("Internship details are missing. Please select a plan again.");
      return;
    }
    if (!razorpayLoaded || !window.Razorpay) {
      setError("Secure checkout is still loading. Please wait a moment and try again.");
      return;
    }
    paymentStarted.current = true;
    setState("processing");
    setError("");
    setNotice("");
    try {
      const created = await createOrder();
      if (!mounted.current) return;
      const Razorpay = window.Razorpay;
      if (!Razorpay) throw new Error("Secure checkout is unavailable. Please refresh the page.");
      try {
        checkout.current?.close?.();
      } catch {}
      checkout.current = null;
      const instance = new Razorpay({
        key: created.keyId,
        amount: created.amountPaise,
        currency: created.currency,
        name: "CyberNet",
        description: `${created.title} - ${created.duration}`,
        order_id: created.orderId,
        prefill: {
          name: created.name || undefined,
          email: created.email || undefined,
        },
        notes: {
          internshipId,
          planCode,
          ...(created.appId ? { applicationId: created.appId } : {}),
        },
        theme: { color: "#155eef" },
        modal: {
          escape: true,
          backdropclose: false,
          ondismiss: () => {
            paymentStarted.current = false;
            if (!mounted.current) return;
            setState("ready");
            setNotice("Checkout closed. No successful payment has been confirmed.");
          },
        },
        handler: async (razorpayResponse) => {
          if (!mounted.current) return;
          setState("verifying");
          setError("");
          setNotice("Payment received. Confirming your payment...");
          try {
            await verifyPayment(created, razorpayResponse);
          } catch (verificationError) {
            if (!mounted.current) return;
            setPaymentUncertain(true);
            setError(
              abortError(verificationError)
                ? "Payment was returned by checkout, but server confirmation timed out. Do not pay again. Contact CyberNet support and share your order reference."
                : verificationError instanceof Error
                  ? `${verificationError.message} Do not make another payment until this transaction is checked.`
                  : "Payment confirmation is pending. Do not pay again until CyberNet support checks the transaction."
            );
            setNotice("");
            setState("failed");
          } finally {
            paymentStarted.current = false;
          }
        },
      });
      instance.on?.("payment.failed", (failure) => {
        paymentStarted.current = false;
        checkout.current = null;
        if (!mounted.current) return;
        const detail = failure.error?.description || failure.error?.reason;
        setError(
          `${detail || "The payment attempt was not completed."} If your bank or UPI app shows a debit, do not pay again immediately; contact support to check the transaction.`
        );
        setNotice("");
        setState("failed");
      });
      checkout.current = instance;
      instance.open();
    } catch (paymentError) {
      paymentStarted.current = false;
      if (!mounted.current) return;
      setError(
        abortError(paymentError)
          ? "The request timed out. If your bank or UPI app shows a debit, do not pay again before checking the transaction."
          : paymentError instanceof Error
            ? paymentError.message
            : "Unable to start payment. Please try again."
      );
      setState("failed");
    }
  }, [createOrder, internshipId, planCode, razorpayLoaded, state, verifyPayment]);
  const retry = useCallback(() => {
    if (paymentUncertain) return;
    try {
      checkout.current?.close?.();
    } catch {}
    checkout.current = null;
    paymentStarted.current = false;
    verifyStarted.current = false;
    setError("");
    setNotice("");
    setOrderId("");
    setCheckoutExpiresAt(null);
    setCheckoutSecondsLeft(null);
    setReceiptEmailSent(false);
    setPaymentUncertain(false);
    setState(razorpayLoaded ? "ready" : "loading");
  }, [paymentUncertain, razorpayLoaded]);
  const busy = state === "processing" || state === "verifying";
  const canPay = state === "ready" && razorpayLoaded && Boolean(internshipId && planCode);
  return (
    <>
      <Script
        src={RAZORPAY_SCRIPT}
        strategy="afterInteractive"
        onLoad={() => {
          if (!mounted.current) return;
          if (window.Razorpay) {
            setRazorpayLoaded(true);
            if (internshipId && planCode) setState((current) => current === "loading" ? "ready" : current);
          } else {
            setError("Secure checkout could not be initialized. Please refresh and try again.");
            setState("failed");
          }
        }}
        onError={() => {
          setRazorpayLoaded(false);
          setError("Unable to load secure checkout. Check your internet connection and refresh the page.");
          setState("failed");
        }}
      />
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex min-h-[68px] w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
            <div>
              <h1 className="text-xl font-black tracking-tight sm:text-2xl">Internship Fee Payment</h1>
              <p className="mt-1 text-xs text-slate-500">Review your selected program before paying</p>
            </div>
            <button
              type="button"
              onClick={goBack}
              disabled={busy || state === "pending"}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          </div>
        </header>
        <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
          {!internshipId || !planCode ? (
            <div className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
              <XCircle className="mx-auto h-12 w-12 text-red-500" />
              <h2 className="mt-4 text-xl font-black">Select an internship plan</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">The payment link is missing a valid internship or plan. Return to the internship list and select your plan again.</p>
              <button onClick={goBack} className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700">Back to internships</button>
            </div>
          ) : (
            <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-5">
                <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="bg-gradient-to-r from-blue-700 to-indigo-600 px-6 py-6 text-white sm:px-8">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                        <CreditCard className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-100">Selected internship</p>
                        <h2 className="mt-2 text-xl font-black leading-tight sm:text-2xl">{title}</h2>
                        <p className="mt-2 text-sm font-medium text-blue-100">{duration} · INR</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
                    <InfoTile icon={<ShieldCheck className="h-5 w-5" />} label="Secure checkout" value="Razorpay" />
                    <InfoTile icon={<Clock3 className="h-5 w-5" />} label="After payment" value="Operations review" />
                    {studentName ? <InfoTile icon={<CheckCircle2 className="h-5 w-5" />} label="Student" value={studentName} /> : null}
                    {studentEmail ? <InfoTile icon={<Mail className="h-5 w-5" />} label="Receipt email" value={studentEmail} /> : null}
                    {applicationId ? <InfoTile icon={<CheckCircle2 className="h-5 w-5" />} label="Application ID" value={applicationId} /> : null}
                  </div>
                </section>
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><ShieldCheck className="h-5 w-5" /></div>
                    <div>
                      <h3 className="font-extrabold">What happens next?</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        After payment is confirmed, your payment receipt will be processed and your application will go to Student Operations for review. Dashboard access stays locked until approval.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <ProcessStep number="1" title="Pay securely" text="Complete the payment in Razorpay Checkout." />
                    <ProcessStep number="2" title="Payment confirmation" text="Your payment is checked before the status is updated." />
                    <ProcessStep number="3" title="Review" text="Student Operations reviews your application." />
                  </div>
                </section>
              </div>
              <aside className="h-fit">
                <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
                  <div className="border-b border-slate-100 px-6 py-5">
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-400">Payment summary</p>
                    <h2 className="mt-1 text-xl font-black">Review your plan</h2>
                  </div>
                  <div className="space-y-5 p-6">
                    <SummaryRow label="Internship" value={title} />
                    <SummaryRow label="Duration" value={duration} />
                    <SummaryRow label="Currency" value={currency} />
                    <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
                      <SummaryRow label="Plan fee" value={money(baseAmountPaise, currency)} />
                      {taxAmountPaise > 0 ? <SummaryRow label={taxLabel} value={money(taxAmountPaise, currency)} /> : null}
                      {feeAmountPaise > 0 ? <SummaryRow label={feeLabel} value={money(feeAmountPaise, currency)} /> : null}
                      <div className="border-t border-slate-200 pt-3">
                        <div className="flex items-end justify-between gap-3">
                          <span className="text-sm font-bold text-slate-600">Total payable</span>
                          <span className="text-2xl font-black tracking-tight">{money(totalAmountPaise, currency)}</span>
                        </div>
                      </div>
                    </div>
                    {checkoutSecondsLeft !== null && state !== "pending" ? (
                      <div className={`rounded-xl border p-3 ${checkoutSecondsLeft > 0 ? "border-blue-100 bg-blue-50" : "border-amber-200 bg-amber-50"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <span className={`text-xs font-semibold ${checkoutSecondsLeft > 0 ? "text-blue-800" : "text-amber-800"}`}>
                            {checkoutSecondsLeft > 0 ? "Checkout session time remaining" : "Website checkout session ended"}
                          </span>
                          <span className={`font-mono text-sm font-black tabular-nums ${checkoutSecondsLeft > 0 ? "text-blue-900" : "text-amber-900"}`}>
                            {Math.floor(checkoutSecondsLeft / 60).toString().padStart(2, "0")}:{(checkoutSecondsLeft % 60).toString().padStart(2, "0")}
                          </span>
                        </div>
                        <p className={`mt-1 text-[11px] leading-5 ${checkoutSecondsLeft > 0 ? "text-blue-700" : "text-amber-800"}`}>
                          {checkoutSecondsLeft > 0
                            ? "This is the website session timer. Razorpay may still process an already-open checkout; payment verification remains authoritative."
                            : "The website session timer has ended. You can reopen checkout to obtain a fresh session using the same eligible order. Do not pay again if a previous attempt may have debited your account."}
                        </p>
                      </div>
                    ) : null}
                    {state === "ready" || state === "loading" ? (
                      <button
                        type="button"
                        onClick={startPayment}
                        disabled={!canPay}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-sm font-extrabold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {!razorpayLoaded ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <LockKeyhole className="h-5 w-5" />}
                        {razorpayLoaded ? "Continue to secure payment" : "Preparing secure checkout"}
                        {razorpayLoaded ? <ArrowRight className="h-4 w-4" /> : null}
                      </button>
                    ) : null}
                    {busy ? <StatusPanel title={state === "processing" ? "Preparing payment" : "Confirming payment"} text={state === "processing" ? "Please wait while your payment is prepared." : "Please wait while your payment is confirmed."} /> : null}
                    {state === "pending" ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex gap-3">
                          <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                          <div>
                            <h3 className="font-extrabold text-amber-900">Payment confirmed</h3>
                            <p className="mt-1 text-sm leading-6 text-amber-800">Your payment is confirmed. Student Operations review is the next step; your dashboard is not active until approval.</p>
                          </div>
                        </div>
                        {studentEmail ? <p className="mt-3 text-xs text-amber-900">Receipt email: {studentEmail}{receiptEmailSent ? " · sent" : " · processing"}</p> : null}
                        <button type="button" onClick={() => router.replace("/student/dashboard")} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-bold text-amber-900 hover:bg-amber-100">
                          View dashboard status <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}
                    {notice && state !== "pending" ? <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-800">{notice}</p> : null}
                    {state === "failed" ? (
                      <div className={`rounded-2xl border p-4 ${paymentUncertain ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
                        <div className="flex gap-3">
                          {paymentUncertain ? <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />}
                          <div>
                            <h3 className={`font-extrabold ${paymentUncertain ? "text-amber-900" : "text-red-900"}`}>{paymentUncertain ? "Payment confirmation needs review" : "Payment could not be completed"}</h3>
                            <p role="alert" className={`mt-1 text-sm leading-6 ${paymentUncertain ? "text-amber-800" : "text-red-800"}`}>{error || "Please try again or return to internship selection."}</p>
                          </div>
                        </div>
                        <div className={`mt-4 grid gap-3 ${paymentUncertain ? "grid-cols-1" : "grid-cols-2"}`}>
                          {!paymentUncertain ? <button type="button" onClick={retry} className="rounded-xl bg-blue-600 px-3 py-3 text-sm font-bold text-white hover:bg-blue-700">Try again</button> : null}
                          <button type="button" onClick={goBack} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">{paymentUncertain ? "Return to internships" : "Back"}</button>
                        </div>
                      </div>
                    ) : null}
                    {orderId ? <p className="break-all text-center text-[11px] text-slate-400">Order reference: {orderId}</p> : null}
                    <p className="flex items-center justify-center gap-2 text-center text-xs leading-5 text-slate-400">
                      <LockKeyhole className="h-3.5 w-3.5 shrink-0" /> Secure payment powered by Razorpay
                    </p>
                    <p className="text-center text-[11px] leading-5 text-slate-400">
                      Taxes or processing charges are shown only when returned by the payment service. The final amount is confirmed by the server.
                    </p>
                  </div>
                </section>
              </aside>
            </div>
          )}
        </section>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-5 text-center text-xs text-slate-400 sm:px-6">
            Secure internship fee payment
          </div>
        </footer>
      </main>
    </>
  );
}
export default function StudentPaymentPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-4 font-bold">Loading payment page…</p>
        </div>
      </main>
    }>
      <PaymentPageContent />
    </Suspense>
  );
}
function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <span className="shrink-0 text-blue-600">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="mt-1 break-words text-sm font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
function ProcessStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white">{number}</span>
      <h3 className="mt-3 text-sm font-extrabold">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
    </div>
  );
}
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-sm font-medium text-slate-500">{label}</span>
      <span className="max-w-[65%] break-words text-right text-sm font-bold text-slate-900">{value}</span>
    </div>
  );
}
function StatusPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start gap-3">
        <LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-blue-700" />
        <div>
          <h3 className="font-extrabold text-blue-900">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-blue-800">{text}</p>
        </div>
      </div>
    </div>
  );
}
