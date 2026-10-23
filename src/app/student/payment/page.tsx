"use client";

import Script from "next/script";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  CreditCard,
  Loader2,
  Lock,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

/* ============================================================
   CYBERNET CAREERS
   STUDENT PAYMENT PAGE
   PRODUCTION RAZORPAY CHECKOUT
   ============================================================

   FLOW

   Student
      ↓
   Internship selected
      ↓
   Payment page
      ↓
   Backend creates Razorpay order
      ↓
   Razorpay Checkout
      ↓
   Razorpay response
      ↓
   Backend verification
      ↓
   Payment = PAID
      ↓
   Student Operations = PENDING REVIEW
      ↓
   Dashboard remains LOCKED
      ↓
   Student Operations approval
      ↓
   Dashboard credentials
      ↓
   Student Dashboard

   IMPORTANT

   - Client never decides the final payment amount.
   - Client never marks payment as paid.
   - Client never activates dashboard.
   - Client never generates dashboard credentials.
   - Razorpay signature is verified server-side.
   - Backend is authoritative.
   ============================================================ */

/* ============================================================
   TYPES
   ============================================================ */

type PlanCode =
  | "ONE_MONTH"
  | "THREE_MONTHS"
  | "SIX_MONTHS";

type PaymentState =
  | "initializing"
  | "ready"
  | "processing"
  | "verification"
  | "pending"
  | "failed";

type JsonObject =
  Record<string, unknown>;

type PlanInfo = {
  code: PlanCode;
  duration: string;
  months: 1 | 3 | 6;
  displayAmountInPaise: number;
};

type RazorpayPaymentResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayFailedResponse = {
  error?: {
    code?: string;
    description?: string;
    reason?: string;
    source?: string;
    step?: string;
    metadata?: {
      order_id?: string;
      payment_id?: string;
    };
  };
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;

  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };

  notes?: Record<string, string>;

  theme?: {
    color?: string;
  };

  modal?: {
    escape?: boolean;
    backdropclose?: boolean;
    ondismiss?: () => void;
  };

  handler: (
    response: RazorpayPaymentResponse,
  ) => void | Promise<void>;
};

type RazorpayInstance = {
  open: () => void;
  close?: () => void;

  on?: (
    event: string,
    handler: (
      response: RazorpayFailedResponse,
    ) => void,
  ) => void;
};

type RazorpayConstructor = new (
  options: RazorpayOptions,
) => RazorpayInstance;

type PaymentOrder = {
  internshipId: string;
  planCode: PlanCode;

  orderId: string;
  keyId: string;

  amountInPaise: number;
  currency: string;

  title: string;
  duration: string;

  applicationId: string;

  receiptEmail?: string;
};

type VerificationResult = {
  paymentStatus: string;

  internshipStatus: string;

  studentOpsApprovalStatus: string;

  studentOpsStatus: string;

  dashboardStatus: string;

  receiptEmail?: string;

  receiptEmailSent: boolean;

  receiptMessage?: string;
};

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

/* ============================================================
   CONSTANTS
   ============================================================ */

const RAZORPAY_SCRIPT =
  "https://checkout.razorpay.com/v1/checkout.js";

const CREATE_ORDER_API =
  "/api/payment/create-order";

const VERIFY_PAYMENT_API =
  "/api/payment/verify";

const INTERNSHIPS_URL =
  "/student/internships";

const DASHBOARD_URL =
  "/student/dashboard";

const RAZORPAY_CURRENCY =
  "INR";

const REQUEST_TIMEOUT_MS =
  30_000;

/* ============================================================
   PLAN CATALOG
   ============================================================

   These are display values only.

   Backend remains authoritative for actual amount.
   ============================================================ */

const PLAN_CONFIG: Record<
  PlanCode,
  PlanInfo
> = {
  ONE_MONTH: {
    code: "ONE_MONTH",
    duration: "1 Month",
    months: 1,
    displayAmountInPaise: 49_900,
  },

  THREE_MONTHS: {
    code: "THREE_MONTHS",
    duration: "3 Months",
    months: 3,
    displayAmountInPaise: 99_900,
  },

  SIX_MONTHS: {
    code: "SIX_MONTHS",
    duration: "6 Months",
    months: 6,
    displayAmountInPaise: 169_900,
  },
};

/* ============================================================
   GENERIC HELPERS
   ============================================================ */

function isObject(
  value: unknown,
): value is JsonObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function stringValue(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function numberValue(
  value: unknown,
): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim()
  ) {
    const parsed = Number(
      value.trim(),
    );

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  return 0;
}

function getData(
  payload: unknown,
): JsonObject {
  if (!isObject(payload)) {
    return {};
  }

  return isObject(payload.data)
    ? payload.data
    : payload;
}

function getString(
  object: JsonObject,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = stringValue(
      object[key],
    );

    if (value) {
      return value;
    }
  }

  return "";
}

function getNumber(
  object: JsonObject,
  ...keys: string[]
): number {
  for (const key of keys) {
    const value = numberValue(
      object[key],
    );

    if (value > 0) {
      return value;
    }
  }

  return 0;
}

function getNestedObject(
  object: JsonObject,
  ...keys: string[]
): JsonObject {
  for (const key of keys) {
    if (
      isObject(
        object[key],
      )
    ) {
      return object[key] as JsonObject;
    }
  }

  return {};
}

/* ============================================================
   PLAN NORMALIZATION
   ============================================================ */

function normalizePlanCode(
  value: string | null,
): PlanCode | null {
  const normalized = (
    value || ""
  )
    .trim()
    .toUpperCase()
    .replace(
      /[\s-]+/g,
      "_",
    );

  switch (normalized) {
    case "ONE_MONTH":
    case "1_MONTH":
    case "1M":
      return "ONE_MONTH";

    case "THREE_MONTHS":
    case "3_MONTHS":
    case "3M":
      return "THREE_MONTHS";

    case "SIX_MONTHS":
    case "6_MONTHS":
    case "6M":
      return "SIX_MONTHS";

    default:
      return null;
  }
}

/* ============================================================
   API HELPERS
   ============================================================ */

function isApiSuccess(
  payload: unknown,
): boolean {
  return (
    isObject(payload) &&
    payload.success === true
  );
}

function getApiMessage(
  payload: unknown,
  fallback: string,
): string {
  if (!isObject(payload)) {
    return fallback;
  }

  return (
    stringValue(
      payload.message,
    ) ||
    stringValue(
      payload.error,
    ) ||
    fallback
  );
}

function extractOrderId(
  payload: unknown,
): string {
  const root =
    isObject(payload)
      ? payload
      : {};

  const data =
    getData(payload);

  const order =
    getNestedObject(
      data,
      "order",
      "razorpayOrder",
    );

  const rootOrder =
    getNestedObject(
      root,
      "order",
      "razorpayOrder",
    );

  return (
    getString(
      data,
      "orderId",
      "razorpayOrderId",
    ) ||
    getString(
      root,
      "orderId",
      "razorpayOrderId",
    ) ||
    getString(
      order,
      "id",
      "orderId",
    ) ||
    getString(
      rootOrder,
      "id",
      "orderId",
    )
  );
}

function extractKeyId(
  payload: unknown,
): string {
  const root =
    isObject(payload)
      ? payload
      : {};

  const data =
    getData(payload);

  return (
    getString(
      data,
      "keyId",
      "key",
      "razorpayKeyId",
    ) ||
    getString(
      root,
      "keyId",
      "key",
      "razorpayKeyId",
    )
  );
}

function extractAmount(
  payload: unknown,
): number {
  const root =
    isObject(payload)
      ? payload
      : {};

  const data =
    getData(payload);

  const order =
    getNestedObject(
      data,
      "order",
      "razorpayOrder",
    );

  const rootOrder =
    getNestedObject(
      root,
      "order",
      "razorpayOrder",
    );

  return Math.round(
    getNumber(
      data,
      "amountInPaise",
    ) ||
      getNumber(
        root,
        "amountInPaise",
      ) ||
      getNumber(
        order,
        "amount",
      ) ||
      getNumber(
        rootOrder,
        "amount",
      ),
  );
}

function extractCurrency(
  payload: unknown,
): string {
  const root =
    isObject(payload)
      ? payload
      : {};

  const data =
    getData(payload);

  const order =
    getNestedObject(
      data,
      "order",
      "razorpayOrder",
    );

  return (
    getString(
      data,
      "currency",
    ).toUpperCase() ||
    getString(
      root,
      "currency",
    ).toUpperCase() ||
    getString(
      order,
      "currency",
    ).toUpperCase() ||
    RAZORPAY_CURRENCY
  );
}

function extractTitle(
  payload: unknown,
): string {
  const root =
    isObject(payload)
      ? payload
      : {};

  const data =
    getData(payload);

  return (
    getString(
      data,
      "title",
      "internshipTitle",
      "programName",
      "internshipName",
    ) ||
    getString(
      root,
      "title",
      "internshipTitle",
      "programName",
      "internshipName",
    ) ||
    "CyberNet Internship Program"
  );
}

function extractDuration(
  payload: unknown,
  planCode: PlanCode,
): string {
  const root =
    isObject(payload)
      ? payload
      : {};

  const data =
    getData(payload);

  return (
    getString(
      data,
      "duration",
      "planDuration",
    ) ||
    getString(
      root,
      "duration",
      "planDuration",
    ) ||
    PLAN_CONFIG[
      planCode
    ].duration
  );
}

function extractApplicationId(
  payload: unknown,
): string {
  const root =
    isObject(payload)
      ? payload
      : {};

  const data =
    getData(payload);

  return (
    getString(
      data,
      "applicationId",
    ) ||
    getString(
      root,
      "applicationId",
    )
  );
}

function extractReceiptEmail(
  payload: unknown,
): string {
  const root =
    isObject(payload)
      ? payload
      : {};

  const data =
    getData(payload);

  const receipt =
    getNestedObject(
      data,
      "receipt",
      "emailReceipt",
    );

  return (
    getString(
      data,
      "receiptEmail",
      "email",
      "studentEmail",
    ) ||
    getString(
      receipt,
      "email",
      "receiptEmail",
    ) ||
    getString(
      root,
      "receiptEmail",
      "email",
      "studentEmail",
    )
  );
}

/* ============================================================
   VERIFICATION RESPONSE EXTRACTION
   ============================================================ */

function extractVerification(
  payload: unknown,
): VerificationResult {
  const root =
    isObject(payload)
      ? payload
      : {};

  const data =
    getData(payload);

  const receipt =
    getNestedObject(
      data,
      "receipt",
      "emailReceipt",
    );

  const paymentStatus =
    getString(
      data,
      "paymentStatus",
      "status",
    ).toLowerCase();

  const internshipStatus =
    getString(
      data,
      "internshipStatus",
    ).toLowerCase();

  const studentOpsApprovalStatus =
    getString(
      data,
      "studentOpsApprovalStatus",
      "operationsApprovalStatus",
      "adminApprovalStatus",
    ).toLowerCase();

  const studentOpsStatus =
    getString(
      data,
      "studentOpsStatus",
      "operationsStatus",
    ).toLowerCase();

  const dashboardStatus =
    getString(
      data,
      "dashboardStatus",
    ).toLowerCase();

  const receiptEmail =
    extractReceiptEmail(
      payload,
    ) ||
    getString(
      receipt,
      "email",
      "receiptEmail",
    );

  const receiptEmailSent =
    data.receiptEmailSent ===
      true ||
    data.emailSent ===
      true ||
    data.receiptSent ===
      true ||
    receipt.receiptEmailSent ===
      true ||
    receipt.emailSent ===
      true ||
    root.receiptEmailSent ===
      true;

  return {
    paymentStatus,

    internshipStatus,

    studentOpsApprovalStatus,

    studentOpsStatus,

    dashboardStatus,

    receiptEmail,

    receiptEmailSent,

    receiptMessage:
      getString(
        data,
        "receiptMessage",
        "emailMessage",
      ) ||
      getString(
        receipt,
        "message",
        "receiptMessage",
      ),
  };
}

/* ============================================================
   FORMATTING
   ============================================================ */

function formatMoney(
  amountInPaise: number,
  currency: string,
): string {
  const amount =
    amountInPaise / 100;

  try {
    return new Intl.NumberFormat(
      "en-IN",
      {
        style: "currency",
        currency:
          currency ||
          "INR",
        maximumFractionDigits: 0,
      },
    ).format(amount);
  } catch {
    return `₹${Math.round(
      amount,
    ).toLocaleString(
      "en-IN",
    )}`;
  }
}

function safeErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  return fallback;
}

/* ============================================================
   MAIN PAGE CONTENT
   ============================================================ */

function PaymentPageContent() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const internshipId =
    stringValue(
      searchParams.get(
        "internshipId",
      ),
    );

  const planCode =
    normalizePlanCode(
      searchParams.get(
        "planCode",
      ),
    );

  const selectedPlan =
    planCode
      ? PLAN_CONFIG[
          planCode
        ]
      : null;

  /* ----------------------------------------------------------
     STATE
     ---------------------------------------------------------- */

  const [
    paymentState,
    setPaymentState,
  ] =
    useState<PaymentState>(
      "initializing",
    );

  const [
    razorpayLoaded,
    setRazorpayLoaded,
  ] =
    useState(false);

  const [
    order,
    setOrder,
  ] =
    useState<PaymentOrder | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    infoMessage,
    setInfoMessage,
  ] =
    useState("");

  const [
    verificationDone,
    setVerificationDone,
  ] =
    useState(false);

  const [
    receiptEmail,
    setReceiptEmail,
  ] =
    useState("");

  const [
    receiptEmailSent,
    setReceiptEmailSent,
  ] =
    useState(false);

  /* ----------------------------------------------------------
     REFS
     ---------------------------------------------------------- */

  const mountedRef =
    useRef(true);

  const checkoutRef =
    useRef<RazorpayInstance | null>(
      null,
    );

  const paymentStartedRef =
    useRef(false);

  const verificationRequestRef =
    useRef(false);

  /* ----------------------------------------------------------
     CLEANUP
     ---------------------------------------------------------- */

  useEffect(() => {
    mountedRef.current =
      true;

    return () => {
      mountedRef.current =
        false;

      try {
        checkoutRef.current?.close?.();
      } catch {
        // Ignore checkout cleanup errors.
      }

      checkoutRef.current =
        null;
    };
  }, []);

  /* ----------------------------------------------------------
     VALIDATE URL PARAMETERS
     ---------------------------------------------------------- */

  useEffect(() => {
    if (
      !internshipId ||
      !planCode
    ) {
      setPaymentState(
        "failed",
      );

      setError(
        !internshipId
          ? "Internship information is missing. Please select an internship again."
          : "Invalid internship plan. Please select a valid 1, 3, or 6 month plan.",
      );

      return;
    }

    setError("");

    if (typeof window !== "undefined" && window.Razorpay) {
      setRazorpayLoaded(true);
      setPaymentState("ready");
    } else {
      setPaymentState("initializing");
    }
  }, [
    internshipId,
    planCode,
  ]);

  /* ----------------------------------------------------------
     RAZORPAY SCRIPT LOAD
     ---------------------------------------------------------- */

  const handleRazorpayLoad =
    useCallback(() => {
      if (
        typeof window !==
          "undefined" &&
        window.Razorpay
      ) {
        setRazorpayLoaded(
          true,
        );

        if (
          internshipId &&
          planCode &&
          paymentState ===
            "initializing"
        ) {
          setPaymentState(
            "ready",
          );
        }

        return;
      }

      setRazorpayLoaded(
        false,
      );

      setPaymentState(
        "failed",
      );

      setError(
        "Razorpay Checkout could not be initialized. Please refresh and try again.",
      );
    }, [
      internshipId,
      paymentState,
      planCode,
    ]);

  const handleRazorpayError =
    useCallback(() => {
      setRazorpayLoaded(
        false,
      );

      setPaymentState(
        "failed",
      );

      setError(
        "Unable to load Razorpay Checkout. Please check your internet connection and try again.",
      );
    }, []);

  /* ----------------------------------------------------------
     CREATE ORDER
     ---------------------------------------------------------- */

  const createOrder =
    useCallback(
      async (): Promise<PaymentOrder> => {
        if (
          !internshipId ||
          !planCode
        ) {
          throw new Error(
            "Internship or plan information is missing.",
          );
        }

        const controller =
          new AbortController();

        const timeout =
          window.setTimeout(
            () =>
              controller.abort(),
            REQUEST_TIMEOUT_MS,
          );

        try {
          const response =
            await fetch(
              CREATE_ORDER_API,
              {
                method:
                  "POST",

                credentials:
                  "include",

                cache:
                  "no-store",

                signal:
                  controller.signal,

                headers: {
                  "Content-Type":
                    "application/json",

                  Accept:
                    "application/json",

                  "X-Requested-With":
                    "XMLHttpRequest",
                },

                body:
                  JSON.stringify({
                    internshipId,
                    planCode,
                  }),
              },
            );

          const payload: unknown =
            await response
              .json()
              .catch(
                () => null,
              );

          if (
            !response.ok ||
            !isApiSuccess(
              payload,
            )
          ) {
            throw new Error(
              getApiMessage(
                payload,
                `Unable to create payment order. Server returned HTTP ${response.status}.`,
              ),
            );
          }

          const orderId =
            extractOrderId(
              payload,
            );

          const keyId =
            extractKeyId(
              payload,
            );

          const amountInPaise =
            extractAmount(
              payload,
            );

          const currency =
            extractCurrency(
              payload,
            );

          const title =
            extractTitle(
              payload,
            );

          const duration =
            extractDuration(
              payload,
              planCode,
            );

          const applicationId =
            extractApplicationId(
              payload,
            );

          const email =
            extractReceiptEmail(
              payload,
            );

          if (!orderId) {
            throw new Error(
              "Payment order was not created correctly. Razorpay order ID is missing.",
            );
          }

          if (!keyId) {
            throw new Error(
              "Razorpay public key was not returned by the payment server.",
            );
          }

          if (
            !Number.isInteger(
              amountInPaise,
            ) ||
            amountInPaise <= 0
          ) {
            throw new Error(
              "Payment server returned an invalid payment amount.",
            );
          }

          if (
            currency !==
            RAZORPAY_CURRENCY
          ) {
            throw new Error(
              "Unsupported payment currency returned by the payment server.",
            );
          }

          /*
           * The backend is authoritative.
           *
           * This comparison is only a client integrity check.
           * The client never sends the amount to Razorpay directly.
           */
          if (
            selectedPlan &&
            amountInPaise !==
              selectedPlan.displayAmountInPaise
          ) {
            throw new Error(
              "The selected internship plan price does not match the payment server. Please return to internship selection and try again.",
            );
          }

          return {
            internshipId,

            planCode,

            orderId,

            keyId,

            amountInPaise,

            currency,

            title,

            duration,

            applicationId,

            receiptEmail:
              email ||
              undefined,
          };
        } finally {
          window.clearTimeout(
            timeout,
          );
        }
      },
      [
        internshipId,
        planCode,
        selectedPlan,
      ],
    );

  /* ----------------------------------------------------------
     VERIFY PAYMENT
     ---------------------------------------------------------- */

  const verifyPayment =
    useCallback(
      async (
        createdOrder: PaymentOrder,
        razorpayResponse: RazorpayPaymentResponse,
      ) => {
        if (
          verificationRequestRef.current
        ) {
          return;
        }

        verificationRequestRef.current =
          true;

        try {
          if (
            !razorpayResponse
              ?.razorpay_payment_id ||
            !razorpayResponse
              ?.razorpay_order_id ||
            !razorpayResponse
              ?.razorpay_signature
          ) {
            throw new Error(
              "Razorpay returned an incomplete payment response.",
            );
          }

          /*
           * Client-side order match.
           *
           * Server performs the authoritative validation again.
           */
          if (
            razorpayResponse.razorpay_order_id !==
            createdOrder.orderId
          ) {
            throw new Error(
              "Payment order mismatch detected. The payment was not accepted.",
            );
          }

          const controller =
            new AbortController();

          const timeout =
            window.setTimeout(
              () =>
                controller.abort(),
              REQUEST_TIMEOUT_MS,
            );

          try {
            const response =
              await fetch(
                VERIFY_PAYMENT_API,
                {
                  method:
                    "POST",

                  credentials:
                    "include",

                  cache:
                    "no-store",

                  signal:
                    controller.signal,

                  headers: {
                    "Content-Type":
                      "application/json",

                    Accept:
                      "application/json",

                    "X-Requested-With":
                      "XMLHttpRequest",
                  },

                  body:
                    JSON.stringify({
                      internshipId:
                        createdOrder.internshipId,

                      planCode:
                        createdOrder.planCode,

                      razorpayOrderId:
                        razorpayResponse.razorpay_order_id,

                      razorpayPaymentId:
                        razorpayResponse.razorpay_payment_id,

                      razorpaySignature:
                        razorpayResponse.razorpay_signature,
                    }),
                },
              );

            const payload: unknown =
              await response
                .json()
                .catch(
                  () => null,
                );

            if (
              !response.ok ||
              !isApiSuccess(
                payload,
              )
            ) {
              throw new Error(
                getApiMessage(
                  payload,
                  `Payment verification failed. Server returned HTTP ${response.status}.`,
                ),
              );
            }

            const root =
              isObject(
                payload,
              )
                ? payload
                : {};

            const data =
              getData(
                payload,
              );

            if (
              root.verified ===
                false ||
              data.verified ===
                false
            ) {
              throw new Error(
                "Payment signature verification failed. Payment was not accepted.",
              );
            }

            const verification =
              extractVerification(
                payload,
              );

            if (
              !mountedRef.current
            ) {
              return;
            }

            setVerificationDone(
              true,
            );

            const verifiedEmail =
              verification.receiptEmail ||
              createdOrder.receiptEmail ||
              "";

            if (
              verifiedEmail
            ) {
              setReceiptEmail(
                verifiedEmail,
              );
            }

            setReceiptEmailSent(
              verification.receiptEmailSent,
            );

            const paymentStatus =
              verification.paymentStatus;

            /*
             * FINAL LIFECYCLE RULE
             *
             * Payment success does NOT mean dashboard access.
             *
             * Expected:
             *
             * paymentStatus = paid
             * studentOpsApprovalStatus = pending
             * studentOpsStatus = pending-review
             * dashboardStatus = locked
             */
            if (
              paymentStatus ===
                "paid" ||
              paymentStatus ===
                "success" ||
              paymentStatus ===
                "completed"
            ) {
              const receiptText =
                verification.receiptEmailSent
                  ? " A payment receipt has been sent to your registered email."
                  : verifiedEmail
                    ? ` Your receipt is being processed for ${verifiedEmail}.`
                    : "";

              setInfoMessage(
                `Payment verified successfully. Your payment is now under Student Operations review.${receiptText}`,
              );

              setPaymentState(
                "pending",
              );

              return;
            }

            /*
             * Do not move an application to Operations Review unless
             * the server explicitly confirms a paid/captured state.
             * An HTTP 200 by itself is not proof of successful payment.
             */
            setVerificationDone(false);
            setError(
              "The server has not confirmed a completed payment yet. Do not pay again if your bank or UPI app shows a debit. Refresh the status or contact support so the payment can be reconciled.",
            );
            setInfoMessage("");
            setPaymentState("failed");
          } finally {
            window.clearTimeout(
              timeout,
            );
          }
        } finally {
          verificationRequestRef.current =
            false;
        }
      },
      [],
    );

  /* ----------------------------------------------------------
     START PAYMENT
     ---------------------------------------------------------- */

  const startPayment =
    useCallback(
      async () => {
        if (
          paymentStartedRef.current ||
          paymentState ===
            "processing" ||
          paymentState ===
            "verification"
        ) {
          return;
        }

        if (
          !internshipId ||
          !planCode
        ) {
          setPaymentState(
            "failed",
          );

          setError(
            "Invalid internship payment details.",
          );

          return;
        }

        if (
          !razorpayLoaded ||
          typeof window ===
            "undefined" ||
          !window.Razorpay
        ) {
          setError(
            "Razorpay Checkout is still loading. Please wait a moment and try again.",
          );

          return;
        }

        paymentStartedRef.current =
          true;

        setError("");

        setInfoMessage("");

        setPaymentState(
          "processing",
        );

        try {
          const createdOrder =
            await createOrder();

          if (
            !mountedRef.current
          ) {
            return;
          }

          setOrder(
            createdOrder,
          );

          setReceiptEmail(
            createdOrder.receiptEmail ||
              "",
          );

          const Razorpay =
            window.Razorpay;

          if (!Razorpay) {
            throw new Error(
              "Razorpay Checkout is unavailable.",
            );
          }

          const checkout =
            new Razorpay({
              key:
                createdOrder.keyId,

              amount:
                createdOrder.amountInPaise,

              currency:
                createdOrder.currency,

              name:
                "CyberNet Careers",

              description:
                `${createdOrder.title} - ${createdOrder.duration}`,

              order_id:
                createdOrder.orderId,

              prefill: {
                email:
                  createdOrder.receiptEmail,
              },

              notes: {
                internshipId:
                  createdOrder.internshipId,

                planCode:
                  createdOrder.planCode,
              },

              theme: {
                color:
                  "#2563eb",
              },

              modal: {
                escape:
                  true,

                backdropclose:
                  false,

                ondismiss:
                  () => {
                    paymentStartedRef.current =
                      false;

                    if (
                      !mountedRef.current
                    ) {
                      return;
                    }

                    setPaymentState(
                      "ready",
                    );

                    setInfoMessage(
                      "Payment window closed. No successful payment was verified.",
                    );
                  },
              },

              handler:
                async (
                  razorpayResponse,
                ) => {
                  if (
                    !mountedRef.current
                  ) {
                    return;
                  }

                  setPaymentState(
                    "verification",
                  );

                  setError("");

                  setInfoMessage(
                    "Payment received. Verifying securely on the server...",
                  );

                  try {
                    await verifyPayment(
                      createdOrder,
                      razorpayResponse,
                    );
                  } catch (
                    verificationError
                  ) {
                    if (
                      !mountedRef.current
                    ) {
                      return;
                    }

                    setError(
                      safeErrorMessage(
                        verificationError,
                        "Payment verification failed. If your bank account was charged, do not pay again immediately. Contact support so the payment can be reconciled.",
                      ),
                    );

                    setInfoMessage("");

                    setPaymentState(
                      "failed",
                    );
                  } finally {
                    paymentStartedRef.current =
                      false;
                  }
                },
            });

          checkout.on?.(
            "payment.failed",
            (
              failedResponse,
            ) => {
              paymentStartedRef.current =
                false;

              if (
                !mountedRef.current
              ) {
                return;
              }

              const description =
                failedResponse
                  .error
                  ?.description ||
                failedResponse
                  .error
                  ?.reason ||
                "Payment failed. No successful payment was recorded.";

              setError(
                description,
              );

              setInfoMessage("");

              setPaymentState(
                "failed",
              );
            },
          );

          checkoutRef.current =
            checkout;

          checkout.open();
        } catch (
          paymentError
        ) {
          paymentStartedRef.current =
            false;

          if (
            !mountedRef.current
          ) {
            return;
          }

          setError(
            safeErrorMessage(
              paymentError,
              "Unable to start payment. Please try again.",
            ),
          );

          setPaymentState(
            "failed",
          );
        }
      },
      [
        createOrder,
        internshipId,
        paymentState,
        planCode,
        razorpayLoaded,
        verifyPayment,
      ],
    );

  /* ----------------------------------------------------------
     RETRY
     ---------------------------------------------------------- */

  const retryPayment =
    useCallback(() => {
      paymentStartedRef.current =
        false;

      verificationRequestRef.current =
        false;

      setError("");

      setInfoMessage("");

      setOrder(
        null,
      );

      setVerificationDone(
        false,
      );

      setReceiptEmail(
        "",
      );

      setReceiptEmailSent(
        false,
      );

      if (
        internshipId &&
        planCode
      ) {
        setPaymentState(
          razorpayLoaded
            ? "ready"
            : "initializing",
        );
      } else {
        setPaymentState(
          "failed",
        );
      }
    }, [
      internshipId,
      planCode,
      razorpayLoaded,
    ]);

  /* ----------------------------------------------------------
     NAVIGATION
     ---------------------------------------------------------- */

  const goBack =
    useCallback(() => {
      if (
        paymentState ===
          "processing" ||
        paymentState ===
          "verification"
      ) {
        return;
      }

      router.push(
        INTERNSHIPS_URL,
      );
    }, [
      paymentState,
      router,
    ]);

  const goDashboard =
    useCallback(() => {
      /*
       * This does NOT activate the dashboard.
       *
       * Server-side dashboard authorization remains authoritative.
       * If Student Operations has not approved the student, the
       * dashboard route must show the locked/pending state.
       */
      router.replace(
        DASHBOARD_URL,
      );
    }, [router]);

  /* ----------------------------------------------------------
     DISPLAY VALUES
     ---------------------------------------------------------- */

  const displayTitle =
    order?.title ||
    "CyberNet Internship Program";

  const displayDuration =
    order?.duration ||
    selectedPlan?.duration ||
    "Internship";

  const displayCurrency =
    order?.currency ||
    RAZORPAY_CURRENCY;

  const displayAmount =
    order?.amountInPaise ||
    selectedPlan?.displayAmountInPaise ||
    0;

  const displayAmountText =
    formatMoney(
      displayAmount,
      displayCurrency,
    );

  const isBusy =
    paymentState ===
      "processing" ||
    paymentState ===
      "verification";

  const canPay =
    paymentState ===
      "ready" &&
    razorpayLoaded &&
    Boolean(
      internshipId &&
        planCode,
    ) &&
    !paymentStartedRef.current;

  const paymentButtonLabel =
    useMemo(() => {
      if (
        !razorpayLoaded
      ) {
        return "Loading secure checkout";
      }

      return "Pay Securely";
    }, [
      razorpayLoaded,
    ]);

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <>
      <Script
        src={
          RAZORPAY_SCRIPT
        }
        strategy="afterInteractive"
        onLoad={
          handleRazorpayLoad
        }
        onError={
          handleRazorpayError
        }
      />

      <main className="min-h-screen bg-slate-50 text-slate-950">
        {/* ==================================================
            HEADER
            ================================================== */}

        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
          <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-blue-600 sm:text-xs">
                CyberNet Careers
              </p>

              <h1 className="truncate text-lg font-extrabold tracking-tight sm:text-xl">
                Internship Payment
              </h1>
            </div>

            <button
              type="button"
              onClick={
                goBack
              }
              disabled={
                isBusy
              }
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
            >
              <ArrowLeft className="h-4 w-4" />

              <span className="hidden sm:inline">
                Back
              </span>
            </button>
          </div>
        </header>

        {/* ==================================================
            STEPS
            ================================================== */}

        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-3xl items-center">
              <StepItem
                number="1"
                label="Internship"
                state="complete"
              />

              <StepLine />

              <StepItem
                number="2"
                label="Payment"
                state={
                  paymentState ===
                  "pending"
                    ? "complete"
                    : "active"
                }
              />

              <StepLine />

              <StepItem
                number="3"
                label="Operations Review"
                state={
                  paymentState ===
                  "pending"
                    ? "active"
                    : "waiting"
                }
              />
            </div>
          </div>
        </section>

        {/* ==================================================
            MAIN
            ================================================== */}

        <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          {!internshipId ||
          !planCode ? (
            <InvalidPayment
              onBack={
                goBack
              }
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
              {/* ============================================
                  LEFT
                  ============================================ */}

              <div className="space-y-6">
                {/* --------------------------------------------
                    INTERNSHIP
                    -------------------------------------------- */}

                <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6 sm:p-8">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-xl font-black text-white shadow-lg shadow-blue-600/20">
                        CN
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-600">
                          Selected Internship
                        </p>

                        <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                          {
                            displayTitle
                          }
                        </h2>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
                          <span>
                            {
                              displayDuration
                            }
                          </span>

                          <span className="h-1 w-1 rounded-full bg-slate-300" />

                          <span>
                            {
                              displayCurrency
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 sm:p-8">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Feature
                        icon={
                          ShieldCheck
                        }
                        title="Secure"
                        text="Server verified"
                      />

                      <Feature
                        icon={
                          CreditCard
                        }
                        title="Razorpay"
                        text="Secure checkout"
                      />

                      <Feature
                        icon={
                          Lock
                        }
                        title="Protected"
                        text="Backend verified"
                      />
                    </div>
                  </div>
                </section>

                {/* --------------------------------------------
                    SECURITY
                    -------------------------------------------- */}

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <ShieldCheck className="h-5 w-5" />
                    </div>

                    <div>
                      <h3 className="text-lg font-extrabold">
                        Secure payment process
                      </h3>

                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        The browser sends only the
                        internship and plan
                        identifiers. The backend
                        validates eligibility,
                        determines the payable amount,
                        creates the Razorpay order,
                        and verifies the payment
                        response.
                      </p>
                    </div>
                  </div>

                  <div className="mt-7 grid gap-4 md:grid-cols-3">
                    <ProcessCard
                      number="01"
                      title="Create Order"
                      text="The backend creates and validates the Razorpay order."
                    />

                    <ProcessCard
                      number="02"
                      title="Pay Securely"
                      text="Complete payment inside the official Razorpay Checkout."
                    />

                    <ProcessCard
                      number="03"
                      title="Verify"
                      text="The backend verifies the payment before changing account state."
                    />
                  </div>
                </section>

                {/* --------------------------------------------
                    AFTER PAYMENT
                    -------------------------------------------- */}

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                  <h3 className="text-lg font-extrabold">
                    What happens after payment?
                  </h3>

                  <div className="mt-6 space-y-5">
                    <TimelineItem
                      number="01"
                      title="Payment verification"
                      text="Your Razorpay payment response is verified securely by the backend."
                      completed={
                        verificationDone
                      }
                    />

                    <TimelineItem
                      number="02"
                      title="Payment receipt"
                      text="After successful server verification, the payment receipt is processed for your registered email."
                      completed={
                        receiptEmailSent
                      }
                    />

                    <TimelineItem
                      number="03"
                      title="Student Operations review"
                      text="Your verified payment moves the application to Student Operations review. Dashboard access remains locked until approval."
                      completed={
                        paymentState ===
                        "pending"
                      }
                    />

                    <TimelineItem
                      number="04"
                      title="Dashboard activation"
                      text="After Student Operations approval, new dashboard credentials are generated and sent to you."
                      completed={false}
                    />
                  </div>
                </section>
              </div>

              {/* ============================================
                  RIGHT
                  ============================================ */}

              <aside className="h-fit lg:sticky lg:top-24">
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40">
                  <div className="border-b border-slate-100 p-6 sm:p-7">
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">
                      Payment Summary
                    </p>

                    <h3 className="mt-2 text-xl font-black">
                      Review your plan
                    </h3>
                  </div>

                  <div className="space-y-5 p-6 sm:p-7">
                    <SummaryRow
                      label="Internship"
                      value={
                        displayTitle
                      }
                    />

                    <SummaryRow
                      label="Duration"
                      value={
                        displayDuration
                      }
                    />

                    <SummaryRow
                      label="Currency"
                      value={
                        displayCurrency
                      }
                    />

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm font-bold text-slate-500">
                          Total
                        </span>

                        <span className="text-2xl font-black tracking-tight">
                          {
                            displayAmountText
                          }
                        </span>
                      </div>
                    </div>

                    {/* ======================================
                        READY
                        ====================================== */}

                    {paymentState ===
                      "ready" && (
                      <>
                        <button
                          type="button"
                          onClick={
                            startPayment
                          }
                          disabled={
                            !canPay
                          }
                          className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-4 text-sm font-extrabold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                        >
                          {!razorpayLoaded ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin" />

                              {
                                paymentButtonLabel
                              }
                            </>
                          ) : (
                            <>
                              <CreditCard className="h-5 w-5" />

                              Pay Securely

                              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                            </>
                          )}
                        </button>

                        <div className="flex items-center justify-center gap-2 text-center text-xs font-semibold text-slate-400">
                          <Lock className="h-3.5 w-3.5" />

                          Secure Razorpay checkout
                        </div>
                      </>
                    )}

                    {/* ======================================
                        INITIALIZING
                        ====================================== */}

                    {paymentState ===
                      "initializing" && (
                      <StatusBox
                        icon={
                          Loader2
                        }
                        title="Preparing secure checkout"
                        text="Loading Razorpay Checkout..."
                        spinning
                      />
                    )}

                    {/* ======================================
                        PROCESSING
                        ====================================== */}

                    {paymentState ===
                      "processing" && (
                      <StatusBox
                        icon={
                          Loader2
                        }
                        title="Preparing payment"
                        text="Creating your secure Razorpay order..."
                        spinning
                      />
                    )}

                    {/* ======================================
                        VERIFICATION
                        ====================================== */}

                    {paymentState ===
                      "verification" && (
                      <StatusBox
                        icon={
                          Loader2
                        }
                        title="Verifying payment"
                        text="Please wait while the server verifies your Razorpay payment."
                        spinning
                      />
                    )}

                    {/* ======================================
                        PENDING REVIEW
                        ====================================== */}

                    {paymentState ===
                      "pending" && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                            <Clock3 className="h-5 w-5" />
                          </div>

                          <div>
                            <h4 className="font-extrabold text-amber-900">
                              Payment verified
                            </h4>

                            <p className="mt-1 text-sm leading-6 text-amber-800">
                              Your payment has
                              been verified
                              successfully.
                              Your application
                              has now moved to
                              Student
                              Operations review.
                              Dashboard access
                              will remain locked
                              until approval.
                            </p>
                          </div>
                        </div>

                        {receiptEmail && (
                          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-white/70 p-3 text-xs font-semibold text-amber-900">
                            <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />

                            <span>
                              Receipt email:
                              {" "}
                              {
                                receiptEmail
                              }
                            </span>
                          </div>
                        )}

                        {infoMessage && (
                          <div className="mt-4 rounded-xl border border-amber-200 bg-white/70 px-4 py-3 text-xs font-semibold leading-5 text-amber-900">
                            {
                              infoMessage
                            }
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={
                            goDashboard
                          }
                          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-extrabold text-amber-900 transition hover:bg-amber-100"
                        >
                          View Dashboard Status

                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {/* ======================================
                        FAILED
                        ====================================== */}

                    {paymentState ===
                      "failed" && (
                      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                            <XCircle className="h-5 w-5" />
                          </div>

                          <div>
                            <h4 className="font-extrabold text-red-900">
                              Payment could not be completed
                            </h4>

                            <p className="mt-1 text-sm leading-6 text-red-800">
                              {error ||
                                "Please try again or return to internship selection."}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                          <button
                            type="button"
                            onClick={
                              retryPayment
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-blue-700"
                          >
                            <RefreshCw className="h-4 w-4" />

                            Retry
                          </button>

                          <button
                            type="button"
                            onClick={
                              goBack
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50"
                          >
                            <ArrowLeft className="h-4 w-4" />

                            Back
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ======================================
                        INFO
                        ====================================== */}

                    {infoMessage &&
                      paymentState !==
                        "pending" &&
                      paymentState !==
                        "failed" && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold leading-6 text-blue-800">
                          {
                            infoMessage
                          }
                        </div>
                      )}

                    {/* ======================================
                        ERROR
                        ====================================== */}

                    {error &&
                      paymentState !==
                        "failed" && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700">
                          {error}
                        </div>
                      )}

                    {/* ======================================
                        ORDER ID
                        ====================================== */}

                    {order?.orderId && (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-slate-400">
                            Razorpay Order
                          </span>

                          <span className="max-w-[190px] truncate font-mono text-[11px] font-bold text-slate-600">
                            {
                              order.orderId
                            }
                          </span>
                        </div>
                      </div>
                    )}

                    <p className="text-center text-[11px] leading-5 text-slate-400">
                      The payable amount is
                      determined by the server.
                      Client-side values are only
                      used for display and
                      validation.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </section>

        {/* ==================================================
            FOOTER
            ================================================== */}

        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-center px-4 text-center text-xs font-medium text-slate-400 sm:px-6 lg:px-8">
            CyberNet Careers · Secure
            internship payment
          </div>
        </footer>
      </main>
    </>
  );
}

/* ============================================================
   PAGE EXPORT
   ============================================================ */

export default function StudentPaymentPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-600" />

            <h1 className="mt-5 text-xl font-black">
              Loading payment
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Preparing your secure
              internship payment page.
            </p>
          </div>
        </main>
      }
    >
      <PaymentPageContent />
    </Suspense>
  );
}

/* ============================================================
   STEP ITEM
   ============================================================ */

function StepItem({
  number,
  label,
  state,
}: {
  number: string;
  label: string;
  state:
    | "complete"
    | "active"
    | "waiting";
}) {
  const completed =
    state === "complete";

  const active =
    state === "active";

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black",
          completed
            ? "bg-emerald-500 text-white"
            : active
              ? "bg-blue-600 text-white"
              : "bg-slate-100 text-slate-400",
        ].join(" ")}
      >
        {completed ? (
          <Check className="h-4 w-4" />
        ) : (
          number
        )}
      </div>

      <span
        className={[
          "hidden truncate text-xs font-extrabold sm:block",
          active ||
          completed
            ? "text-slate-900"
            : "text-slate-400",
        ].join(" ")}
      >
        {label}
      </span>
    </div>
  );
}

/* ============================================================
   STEP LINE
   ============================================================ */

function StepLine() {
  return (
    <div className="mx-2 h-px flex-1 bg-slate-200 sm:mx-4" />
  );
}

/* ============================================================
   FEATURE
   ============================================================ */

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof ShieldCheck;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
          <Icon className="h-4 w-4" />
        </div>

        <div>
          <p className="text-sm font-extrabold text-slate-900">
            {title}
          </p>

          <p className="mt-0.5 text-xs font-medium text-slate-500">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PROCESS CARD
   ============================================================ */

function ProcessCard({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-[11px] font-black text-white">
        {number}
      </div>

      <h4 className="mt-4 font-extrabold">
        {title}
      </h4>

      <p className="mt-1 text-sm leading-6 text-slate-500">
        {text}
      </p>
    </div>
  );
}

/* ============================================================
   TIMELINE ITEM
   ============================================================ */

function TimelineItem({
  number,
  title,
  text,
  completed,
}: {
  number: string;
  title: string;
  text: string;
  completed?: boolean;
}) {
  return (
    <div className="flex gap-4">
      <div
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black",
          completed
            ? "bg-emerald-500 text-white"
            : "bg-blue-50 text-blue-600",
        ].join(" ")}
      >
        {completed ? (
          <Check className="h-4 w-4" />
        ) : (
          number
        )}
      </div>

      <div className="min-w-0">
        <h4 className="font-extrabold">
          {title}
        </h4>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          {text}
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   SUMMARY ROW
   ============================================================ */

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-5">
      <span className="shrink-0 text-sm font-semibold text-slate-500">
        {label}
      </span>

      <span className="max-w-[62%] text-right text-sm font-extrabold text-slate-900">
        {value}
      </span>
    </div>
  );
}

/* ============================================================
   STATUS BOX
   ============================================================ */

function StatusBox({
  icon: Icon,
  title,
  text,
  spinning,
}: {
  icon: typeof Loader2;
  title: string;
  text: string;
  spinning?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <Icon
            className={[
              "h-5 w-5",
              spinning
                ? "animate-spin"
                : "",
            ].join(" ")}
          />
        </div>

        <div>
          <h4 className="font-extrabold text-blue-900">
            {title}
          </h4>

          <p className="mt-1 text-sm leading-6 text-blue-800">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   INVALID PAYMENT
   ============================================================ */

function InvalidPayment({
  onBack,
}: {
  onBack: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm sm:p-10">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
        <XCircle className="h-8 w-8" />
      </div>

      <h2 className="mt-5 text-2xl font-black">
        Invalid payment link
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        The internship or selected
        plan information is missing.
        Please return to internship
        selection and choose a plan
        again.
      </p>

      <button
        type="button"
        onClick={onBack}
        className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-blue-700"
      >
        <ArrowLeft className="h-4 w-4" />

        Back to Internships
      </button>
    </div>
  );
}