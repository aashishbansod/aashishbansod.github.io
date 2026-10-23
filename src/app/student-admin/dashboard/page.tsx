"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/* ============================================================================
   CYBERNET TECHNOLOGY
   STUDENT OPERATIONS
   BLUE / WHITE ENTERPRISE DASHBOARD
   ============================================================================ */

type LifecycleStatus =
  | "active"
  | "pending"
  | "inactive"
  | "completed"
  | "rejected"
  | "suspended"
  | "unknown";

type OperationsStatus =
  | "not-ready"
  | "payment-pending"
  | "pending-review"
  | "approved"
  | "active"
  | "suspended"
  | "completed"
  | "expired"
  | "unknown";

type PaymentStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "unknown";

type AssessmentStatus =
  | "not-started"
  | "scheduled"
  | "in-progress"
  | "submitted"
  | "evaluated"
  | "passed"
  | "failed"
  | "unknown";

type DashboardStatus =
  | "locked"
  | "pending"
  | "active"
  | "suspended"
  | "completed"
  | "unknown";

type StudentRecord = {
  id: string;
  name: string;
  email?: string;
  studentId?: string;

  domain?: string;
  internshipTrack?: string;
  internshipPlan?: string;

  applicationStatus?: string;
  adminApprovalStatus?: string;

  assessmentStatus?: string;
  resultStatus?: string;

  internshipStatus?: string;

  paymentStatus?: string;
  paymentAmount?: number;
  paymentCurrency?: string;

  studentOpsApprovalStatus?: string;
  studentOpsStatus?: string;

  dashboardStatus?: string;
  dashboardLoginEnabled?: boolean;
  dashboardCredentialsGenerated?: boolean;

  loginEnabled?: boolean;
  credentialsGenerated?: boolean;

  progress?: number;

  tasksTotal?: number;
  tasksCompleted?: number;

  assessmentsTotal?: number;
  assessmentsCompleted?: number;

  projectStatus?: string;
  certificateStatus?: string;

  joinedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type DashboardStats = {
  students: {
    total: number;
    active: number;
    pending: number;
    inactive: number;
    completed: number;
    rejected: number;
    suspended: number;
  };

  operations: {
    pendingReview: number;
    approved: number;
    active: number;
    suspended: number;
    completed: number;
  };

  payment: {
    paid: number;
    pending: number;
    failed: number;
    refunded: number;
  };

  assessments: {
    total: number;
    pending: number;
    completed: number;
    passed: number;
    failed: number;
  };

  internships: {
    total: number;
    active: number;
    completed: number;
  };

  dashboards: {
    active: number;
    locked: number;
    pending: number;
    suspended: number;
    completed: number;
  };

  tasks: {
    total: number;
    completed: number;
    pending: number;
    submitted: number;
  };

  certificates: {
    total: number;
    issued: number;
    pending: number;
  };

  domains: {
    total: number;
    active: number;
  };
};

type RecentActivity = {
  id: string;
  type:
    | "student"
    | "payment"
    | "assessment"
    | "internship"
    | "dashboard"
    | "task"
    | "certificate"
    | "operations"
    | "domain"
    | "unknown";
  title: string;
  description?: string;
  createdAt?: string;
};

type DashboardPayload = {
  success?: boolean;
  message?: string;
  error?: string;

  stats?: Partial<DashboardStats>;

  students?: unknown[];
  recentStudents?: unknown[];
  recentActivity?: RecentActivity[];

  data?: {
    stats?: Partial<DashboardStats>;
    statistics?: Record<string, unknown>;
    students?: unknown[];
    recentStudents?: unknown[];
    recentActivity?: RecentActivity[];
    [key: string]: unknown;
  };
};

/* ============================================================================
   CONSTANTS
   ============================================================================ */

const EMPTY_STATS: DashboardStats = {
  students: {
    total: 0,
    active: 0,
    pending: 0,
    inactive: 0,
    completed: 0,
    rejected: 0,
    suspended: 0,
  },

  operations: {
    pendingReview: 0,
    approved: 0,
    active: 0,
    suspended: 0,
    completed: 0,
  },

  payment: {
    paid: 0,
    pending: 0,
    failed: 0,
    refunded: 0,
  },

  assessments: {
    total: 0,
    pending: 0,
    completed: 0,
    passed: 0,
    failed: 0,
  },

  internships: {
    total: 0,
    active: 0,
    completed: 0,
  },

  dashboards: {
    active: 0,
    locked: 0,
    pending: 0,
    suspended: 0,
    completed: 0,
  },

  tasks: {
    total: 0,
    completed: 0,
    pending: 0,
    submitted: 0,
  },

  certificates: {
    total: 0,
    issued: 0,
    pending: 0,
  },

  domains: {
    total: 0,
    active: 0,
  },
};

/* ============================================================================
   HELPERS
   ============================================================================ */

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.round(parsed));
    }
  }

  return 0;
}

function percentageValue(value: unknown): number {
  return Math.max(0, Math.min(100, numberValue(value)));
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstValue(...values: unknown[]): string {
  for (const value of values) {
    const result = stringValue(value);

    if (result) {
      return result;
    }
  }

  return "";
}

function normalize(value: unknown): string {
  return stringValue(value).toLowerCase();
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-IN");
}

function formatDate(value?: string): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function relativeDate(value?: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const difference = Date.now() - date.getTime();

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (difference < minute) {
    return "Just now";
  }

  if (difference < hour) {
    return `${Math.max(1, Math.floor(difference / minute))}m ago`;
  }

  if (difference < day) {
    return `${Math.max(1, Math.floor(difference / hour))}h ago`;
  }

  if (difference < 7 * day) {
    return `${Math.max(1, Math.floor(difference / day))}d ago`;
  }

  return formatDate(value);
}

function initials(name?: string): string {
  const value = stringValue(name);

  if (!value) {
    return "ST";
  }

  const parts = value.split(/\s+/);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0]?.[0] ?? ""}${
    parts[parts.length - 1]?.[0] ?? ""
  }`.toUpperCase();
}

function planLabel(value?: string): string {
  const text = stringValue(value);

  if (!text) {
    return "Not selected";
  }

  return text
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function domainLabel(student: StudentRecord): string {
  return (
    firstValue(
      student.domain,
      student.internshipTrack,
    ) || "Not assigned"
  );
}

function safePercentage(
  value: number,
  total: number,
): number {
  if (total <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, Math.round((value / total) * 100)),
  );
}

/* ============================================================================
   STUDENT NORMALIZATION
   ============================================================================ */

function normalizeStudent(
  value: unknown,
  index: number,
): StudentRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;

  const id = firstValue(
    source.id,
    source._id,
    source.userId,
    source.identifier,
    source.studentId,
  );

  const name = firstValue(
    source.name,
    source.fullName,
    source.studentName,
  );

  const email = firstValue(
    source.email,
    source.studentEmail,
  );

  if (!id && !name && !email) {
    return null;
  }

  return {
    id: id || `student-${index}`,
    name: name || "Unnamed Student",
    email: email || undefined,

    studentId:
      firstValue(
        source.studentId,
        source.dashboardStudentId,
      ) || undefined,

    domain:
      firstValue(
        source.domain,
        source.internshipDomain,
      ) || undefined,

    internshipTrack:
      stringValue(source.internshipTrack) || undefined,

    internshipPlan:
      firstValue(
        source.internshipPlan,
        source.selectedPlan,
        source.plan,
      ) || undefined,

    applicationStatus:
      stringValue(source.applicationStatus) || undefined,

    adminApprovalStatus:
      stringValue(source.adminApprovalStatus) || undefined,

    assessmentStatus:
      stringValue(source.assessmentStatus) || undefined,

    resultStatus:
      stringValue(source.resultStatus) || undefined,

    internshipStatus:
      stringValue(source.internshipStatus) || undefined,

    paymentStatus:
      stringValue(source.paymentStatus) || undefined,

    paymentAmount: numberValue(
      source.paymentAmount,
    ),

    paymentCurrency:
      firstValue(
        source.paymentCurrency,
        "INR",
      ),

    studentOpsApprovalStatus:
      stringValue(
        source.studentOpsApprovalStatus,
      ) || undefined,

    studentOpsStatus:
      stringValue(source.studentOpsStatus) || undefined,

    dashboardStatus:
      stringValue(source.dashboardStatus) || undefined,

    dashboardLoginEnabled:
      source.dashboardLoginEnabled === true,

    dashboardCredentialsGenerated:
      source.dashboardCredentialsGenerated ===
        true ||
      source.credentialsGenerated === true,

    loginEnabled:
      source.loginEnabled === true,

    credentialsGenerated:
      source.credentialsGenerated === true,

    progress: percentageValue(
      source.progress ??
        source.overallProgress ??
        source.internshipProgress,
    ),

    tasksTotal: numberValue(
      source.tasksTotal ??
        source.totalTasks ??
        source.tasks,
    ),

    tasksCompleted: numberValue(
      source.tasksCompleted ??
        source.completedTasks,
    ),

    assessmentsTotal: numberValue(
      source.assessmentsTotal ??
        source.totalAssessments,
    ),

    assessmentsCompleted: numberValue(
      source.assessmentsCompleted ??
        source.completedAssessments,
    ),

    projectStatus:
      stringValue(source.projectStatus) || undefined,

    certificateStatus:
      stringValue(source.certificateStatus) || undefined,

    joinedAt:
      firstValue(
        source.joinedAt,
        source.createdAt,
      ) || undefined,

    createdAt:
      stringValue(source.createdAt) || undefined,

    updatedAt:
      stringValue(source.updatedAt) || undefined,
  };
}

/* ============================================================================
   STATUS
   ============================================================================ */

function lifecycleStatus(
  student: StudentRecord,
): LifecycleStatus {
  const dashboard = normalize(student.dashboardStatus);
  const operations = normalize(student.studentOpsStatus);
  const internship = normalize(student.internshipStatus);
  const application = normalize(student.applicationStatus);

  if (
    dashboard === "completed" ||
    operations === "completed" ||
    internship === "completed"
  ) {
    return "completed";
  }

  if (
    dashboard === "suspended" ||
    operations === "suspended"
  ) {
    return "suspended";
  }

  if (
    application === "rejected" ||
    normalize(student.studentOpsApprovalStatus) ===
      "rejected"
  ) {
    return "rejected";
  }

  if (
    dashboard === "active" ||
    operations === "active" ||
    internship === "active"
  ) {
    return "active";
  }

  if (
    operations === "pending-review" ||
    operations === "payment-pending" ||
    operations === "not-ready" ||
    application === "pending"
  ) {
    return "pending";
  }

  if (
    dashboard === "locked" ||
    dashboard === "pending"
  ) {
    return "inactive";
  }

  return "unknown";
}

function operationsStatus(
  student: StudentRecord,
): OperationsStatus {
  const value = normalize(student.studentOpsStatus);

  if (
    [
      "not-ready",
      "payment-pending",
      "pending-review",
      "approved",
      "active",
      "suspended",
      "completed",
      "expired",
    ].includes(value)
  ) {
    return value as OperationsStatus;
  }

  if (
    normalize(student.paymentStatus) === "paid" &&
    !student.dashboardLoginEnabled
  ) {
    return "pending-review";
  }

  return "unknown";
}

function paymentStatus(
  student: StudentRecord,
): PaymentStatus {
  const value = normalize(student.paymentStatus);

  if (
    [
      "unpaid",
      "pending",
      "paid",
      "failed",
      "refunded",
    ].includes(value)
  ) {
    return value as PaymentStatus;
  }

  return "unknown";
}

function assessmentStatus(
  student: StudentRecord,
): AssessmentStatus {
  const value = normalize(
    firstValue(
      student.assessmentStatus,
      student.resultStatus,
    ),
  );

  if (
    [
      "not-started",
      "scheduled",
      "in-progress",
      "submitted",
      "evaluated",
      "passed",
      "failed",
    ].includes(value)
  ) {
    return value as AssessmentStatus;
  }

  return "unknown";
}

function dashboardStatus(
  student: StudentRecord,
): DashboardStatus {
  const value = normalize(student.dashboardStatus);

  if (
    [
      "locked",
      "pending",
      "active",
      "suspended",
      "completed",
    ].includes(value)
  ) {
    return value as DashboardStatus;
  }

  return "unknown";
}

/* ============================================================================
   STATS
   ============================================================================ */

function calculateStats(
  students: StudentRecord[],
): DashboardStats {
  const result: DashboardStats = {
    ...EMPTY_STATS,
    students: { ...EMPTY_STATS.students },
    operations: { ...EMPTY_STATS.operations },
    payment: { ...EMPTY_STATS.payment },
    assessments: { ...EMPTY_STATS.assessments },
    internships: { ...EMPTY_STATS.internships },
    dashboards: { ...EMPTY_STATS.dashboards },
    tasks: { ...EMPTY_STATS.tasks },
    certificates: { ...EMPTY_STATS.certificates },
    domains: { ...EMPTY_STATS.domains },
  };

  const domains = new Set<string>();

  for (const student of students) {
    const lifecycle = lifecycleStatus(student);

    if (lifecycle === "active") {
      result.students.active++;
    }

    if (lifecycle === "pending") {
      result.students.pending++;
    }

    if (lifecycle === "inactive") {
      result.students.inactive++;
    }

    if (lifecycle === "completed") {
      result.students.completed++;
    }

    if (lifecycle === "rejected") {
      result.students.rejected++;
    }

    if (lifecycle === "suspended") {
      result.students.suspended++;
    }

    const operation = operationsStatus(student);

    if (operation === "pending-review") {
      result.operations.pendingReview++;
    }

    if (operation === "approved") {
      result.operations.approved++;
    }

    if (operation === "active") {
      result.operations.active++;
    }

    if (operation === "suspended") {
      result.operations.suspended++;
    }

    if (operation === "completed") {
      result.operations.completed++;
    }

    const payment = paymentStatus(student);

    if (payment === "paid") {
      result.payment.paid++;
    }

    if (payment === "pending") {
      result.payment.pending++;
    }

    if (payment === "failed") {
      result.payment.failed++;
    }

    if (payment === "refunded") {
      result.payment.refunded++;
    }

    const assessment = assessmentStatus(student);

    if (assessment !== "unknown") {
      result.assessments.total++;
    }

    if (
      [
        "not-started",
        "scheduled",
        "in-progress",
        "submitted",
        "evaluated",
      ].includes(assessment)
    ) {
      result.assessments.pending++;
    }

    if (assessment === "passed") {
      result.assessments.passed++;
    }

    if (assessment === "failed") {
      result.assessments.failed++;
    }

    result.assessments.completed =
      result.assessments.passed +
      result.assessments.failed;

    const internship = normalize(
      student.internshipStatus,
    );

    if (internship) {
      result.internships.total++;
    }

    if (internship === "active") {
      result.internships.active++;
    }

    if (internship === "completed") {
      result.internships.completed++;
    }

    const dashboard = dashboardStatus(student);

    if (dashboard === "active") {
      result.dashboards.active++;
    }

    if (dashboard === "locked") {
      result.dashboards.locked++;
    }

    if (dashboard === "pending") {
      result.dashboards.pending++;
    }

    if (dashboard === "suspended") {
      result.dashboards.suspended++;
    }

    if (dashboard === "completed") {
      result.dashboards.completed++;
    }

    result.tasks.total += numberValue(
      student.tasksTotal,
    );

    result.tasks.completed += numberValue(
      student.tasksCompleted,
    );

    if (numberValue(student.tasksCompleted) > 0) {
      result.tasks.submitted += numberValue(
        student.tasksCompleted,
      );
    }

    const domain = domainLabel(student);

    if (domain !== "Not assigned") {
      domains.add(domain);
    }

    if (student.certificateStatus) {
      result.certificates.total++;

      const certificate = normalize(
        student.certificateStatus,
      );

      if (
        certificate === "issued" ||
        certificate === "completed"
      ) {
        result.certificates.issued++;
      }
    }
  }

  result.tasks.pending = Math.max(
    0,
    result.tasks.total -
      result.tasks.completed,
  );

  result.certificates.pending = Math.max(
    0,
    result.certificates.total -
      result.certificates.issued,
  );

  result.domains.total = domains.size;
  result.domains.active = domains.size;

  return result;
}

function mergeStats(
  incoming: unknown,
  students: StudentRecord[],
): DashboardStats {
  const calculated = calculateStats(students);

  if (
    !incoming ||
    typeof incoming !== "object"
  ) {
    return calculated;
  }

  const source =
    incoming as Record<string, unknown>;

  const objectValue = (
    value: unknown,
  ): Record<string, unknown> => {
    if (
      value &&
      typeof value === "object"
    ) {
      return value as Record<string, unknown>;
    }

    return {};
  };

  const studentsStats = objectValue(
    source.students,
  );

  const operationsStats = objectValue(
    source.operations,
  );

  const paymentStats = objectValue(
    source.payment,
  );

  const assessmentStats = objectValue(
    source.assessments,
  );

  const internshipStats = objectValue(
    source.internships,
  );

  const dashboardStats = objectValue(
    source.dashboards,
  );

  const taskStats = objectValue(source.tasks);

  const certificateStats = objectValue(
    source.certificates,
  );

  const domainStats = objectValue(
    source.domains,
  );

  return {
    students: {
      total: numberValue(
        studentsStats.total ??
          source.totalStudents ??
          calculated.students.total,
      ),
      active: numberValue(
        studentsStats.active ??
          source.activeStudents ??
          calculated.students.active,
      ),
      pending: numberValue(
        studentsStats.pending ??
          source.pendingStudents ??
          source.pending ??
          calculated.students.pending,
      ),
      inactive: numberValue(
        studentsStats.inactive ??
          calculated.students.inactive,
      ),
      completed: numberValue(
        studentsStats.completed ??
          calculated.students.completed,
      ),
      rejected: numberValue(
        studentsStats.rejected ??
          source.rejectedStudents ??
          calculated.students.rejected,
      ),
      suspended: numberValue(
        studentsStats.suspended ??
          calculated.students.suspended,
      ),
    },

    operations: {
      pendingReview: numberValue(
        operationsStats.pendingReview ??
          source.pendingReview ??
          calculated.operations.pendingReview,
      ),
      approved: numberValue(
        operationsStats.approved ??
          calculated.operations.approved,
      ),
      active: numberValue(
        operationsStats.active ??
          calculated.operations.active,
      ),
      suspended: numberValue(
        operationsStats.suspended ??
          calculated.operations.suspended,
      ),
      completed: numberValue(
        operationsStats.completed ??
          calculated.operations.completed,
      ),
    },

    payment: {
      paid: numberValue(
        paymentStats.paid ??
          source.paidStudents ??
          calculated.payment.paid,
      ),
      pending: numberValue(
        paymentStats.pending ??
          calculated.payment.pending,
      ),
      failed: numberValue(
        paymentStats.failed ??
          calculated.payment.failed,
      ),
      refunded: numberValue(
        paymentStats.refunded ??
          calculated.payment.refunded,
      ),
    },

    assessments: {
      total: numberValue(
        assessmentStats.total ??
          calculated.assessments.total,
      ),
      pending: numberValue(
        assessmentStats.pending ??
          calculated.assessments.pending,
      ),
      completed: numberValue(
        assessmentStats.completed ??
          calculated.assessments.completed,
      ),
      passed: numberValue(
        assessmentStats.passed ??
          source.assessmentPassed ??
          calculated.assessments.passed,
      ),
      failed: numberValue(
        assessmentStats.failed ??
          source.assessmentFailed ??
          calculated.assessments.failed,
      ),
    },

    internships: {
      total: numberValue(
        internshipStats.total ??
          calculated.internships.total,
      ),
      active: numberValue(
        internshipStats.active ??
          calculated.internships.active,
      ),
      completed: numberValue(
        internshipStats.completed ??
          calculated.internships.completed,
      ),
    },

    dashboards: {
      active: numberValue(
        dashboardStats.active ??
          calculated.dashboards.active,
      ),
      locked: numberValue(
        dashboardStats.locked ??
          calculated.dashboards.locked,
      ),
      pending: numberValue(
        dashboardStats.pending ??
          calculated.dashboards.pending,
      ),
      suspended: numberValue(
        dashboardStats.suspended ??
          calculated.dashboards.suspended,
      ),
      completed: numberValue(
        dashboardStats.completed ??
          calculated.dashboards.completed,
      ),
    },

    tasks: {
      total: numberValue(
        taskStats.total ??
          calculated.tasks.total,
      ),
      completed: numberValue(
        taskStats.completed ??
          calculated.tasks.completed,
      ),
      pending: numberValue(
        taskStats.pending ??
          calculated.tasks.pending,
      ),
      submitted: numberValue(
        taskStats.submitted ??
          calculated.tasks.submitted,
      ),
    },

    certificates: {
      total: numberValue(
        certificateStats.total ??
          calculated.certificates.total,
      ),
      issued: numberValue(
        certificateStats.issued ??
          calculated.certificates.issued,
      ),
      pending: numberValue(
        certificateStats.pending ??
          calculated.certificates.pending,
      ),
    },

    domains: {
      total: numberValue(
        domainStats.total ??
          calculated.domains.total,
      ),
      active: numberValue(
        domainStats.active ??
          calculated.domains.active,
      ),
    },
  };
}

/* ============================================================================
   API NORMALIZATION
   ============================================================================ */

function normalizeResponse(
  payload: DashboardPayload,
) {
  const data =
    payload.data &&
    typeof payload.data === "object"
      ? payload.data
      : {};

  const rawStudents: unknown[] = [
    ...(Array.isArray(payload.students)
      ? payload.students
      : []),

    ...(Array.isArray(payload.recentStudents)
      ? payload.recentStudents
      : []),

    ...(Array.isArray(data.students)
      ? data.students
      : []),

    ...(Array.isArray(data.recentStudents)
      ? data.recentStudents
      : []),
  ];

  const studentMap =
    new Map<string, StudentRecord>();

  rawStudents.forEach(
    (value, index) => {
      const student =
        normalizeStudent(value, index);

      if (!student) {
        return;
      }

      studentMap.set(student.id, student);
    },
  );

  const students =
    Array.from(studentMap.values());

  const rawStats =
    payload.stats ??
    data.stats ??
    data.statistics;

  const stats = mergeStats(
    rawStats,
    students,
  );

  const rawActivity: RecentActivity[] = [
    ...(Array.isArray(
      payload.recentActivity,
    )
      ? payload.recentActivity
      : []),

    ...(Array.isArray(
      data.recentActivity,
    )
      ? data.recentActivity
      : []),
  ];

  const activityMap =
    new Map<string, RecentActivity>();

  rawActivity.forEach(
    (item, index) => {
      if (
        !item ||
        typeof item !== "object"
      ) {
        return;
      }

      const activity =
        item as RecentActivity;

      if (!activity.title) {
        return;
      }

      const id =
        stringValue(activity.id) ||
        `${activity.type}-${index}`;

      activityMap.set(id, {
        ...activity,
        id,
      });
    },
  );

  return {
    stats,
    students,
    activity:
      Array.from(activityMap.values()).slice(
        0,
        20,
      ),
  };
}

/* ============================================================================
   ICONS
   ============================================================================ */

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name:
    | "grid"
    | "users"
    | "payment"
    | "assessment"
    | "dashboard"
    | "briefcase"
    | "task"
    | "certificate"
    | "search"
    | "refresh"
    | "menu"
    | "close"
    | "bell"
    | "arrow"
    | "check"
    | "clock"
    | "shield"
    | "chevron"
    | "logout"
    | "filter"
    | "activity"
    | "external";
  className?: string;
}) {
  const props = {
    viewBox: "0 0 24 24",
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "grid":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );

    case "users":
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );

    case "payment":
      return (
        <svg {...props}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
          <path d="M6 15h4" />
        </svg>
      );

    case "assessment":
      return (
        <svg {...props}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      );

    case "dashboard":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
      );

    case "briefcase":
      return (
        <svg {...props}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M3 12h18" />
        </svg>
      );

    case "task":
      return (
        <svg {...props}>
          <path d="m9 11 3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );

    case "certificate":
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="4" />
          <path d="M9 12.5 7 22l5-3 5 3-2-9.5" />
        </svg>
      );

    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      );

    case "refresh":
      return (
        <svg {...props}>
          <path d="M20 11a8 8 0 0 0-14.9-4L3 9" />
          <path d="M3 4v5h5" />
          <path d="M4 13a8 8 0 0 0 14.9 4L21 15" />
          <path d="M21 20v-5h-5" />
        </svg>
      );

    case "menu":
      return (
        <svg {...props}>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );

    case "close":
      return (
        <svg {...props}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      );

    case "bell":
      return (
        <svg {...props}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
      );

    case "arrow":
      return (
        <svg {...props}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );

    case "check":
      return (
        <svg {...props}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );

    case "clock":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );

    case "shield":
      return (
        <svg {...props}>
          <path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );

    case "chevron":
      return (
        <svg {...props}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );

    case "logout":
      return (
        <svg {...props}>
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
          <path d="M21 19V5a2 2 0 0 0-2-2h-6" />
        </svg>
      );

    case "filter":
      return (
        <svg {...props}>
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
      );

    case "activity":
      return (
        <svg {...props}>
          <path d="M3 12h4l3-8 4 16 3-8h4" />
        </svg>
      );

    case "external":
      return (
        <svg {...props}>
          <path d="M14 5h5v5" />
          <path d="M10 14 19 5" />
          <path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" />
        </svg>
      );

    default:
      return null;
  }
}

/* ============================================================================
   UI COMPONENTS
   ============================================================================ */

function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?:
    | "blue"
    | "green"
    | "amber"
    | "red"
    | "violet"
    | "slate";
}) {
  const styles = {
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    red: "bg-rose-50 text-rose-700 ring-rose-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
    slate: "bg-slate-100 text-slate-600 ring-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ring-1 ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

function lifecycleTone(
  status: LifecycleStatus,
) {
  switch (status) {
    case "active":
      return "green" as const;

    case "pending":
      return "amber" as const;

    case "completed":
      return "blue" as const;

    case "rejected":
    case "suspended":
      return "red" as const;

    default:
      return "slate" as const;
  }
}

function paymentTone(
  status: PaymentStatus,
) {
  switch (status) {
    case "paid":
      return "green" as const;

    case "pending":
      return "amber" as const;

    case "failed":
      return "red" as const;

    case "refunded":
      return "violet" as const;

    default:
      return "slate" as const;
  }
}

function operationsTone(
  status: OperationsStatus,
) {
  switch (status) {
    case "active":
    case "approved":
      return "green" as const;

    case "pending-review":
      return "amber" as const;

    case "payment-pending":
      return "blue" as const;

    case "completed":
      return "violet" as const;

    case "suspended":
      return "red" as const;

    default:
      return "slate" as const;
  }
}

function dashboardTone(
  status: DashboardStatus,
) {
  switch (status) {
    case "active":
    case "completed":
      return "green" as const;

    case "pending":
      return "amber" as const;

    case "suspended":
      return "red" as const;

    default:
      return "slate" as const;
  }
}

function ProgressBar({
  value,
}: {
  value: number;
}) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-blue-50">
      <div
        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-700 transition-all duration-500"
        style={{
          width: `${percentageValue(value)}%`,
        }}
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  detail,
  icon,
  loading,
  accent = "blue",
}: {
  title: string;
  value: number;
  detail: string;
  icon: ReactNode;
  loading: boolean;
  accent?: "blue" | "green" | "amber" | "violet";
}) {
  const iconStyles = {
    blue: "bg-blue-50 text-blue-600 group-hover:bg-blue-600",
    green:
      "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600",
    amber:
      "bg-amber-50 text-amber-600 group-hover:bg-amber-600",
    violet:
      "bg-violet-50 text-violet-600 group-hover:bg-violet-600",
  };

  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_12px_30px_rgba(37,99,235,0.10)]">
      <div className="flex items-start justify-between">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl transition group-hover:text-white ${iconStyles[accent]}`}
        >
          {icon}
        </div>

        <span className="text-blue-200 transition group-hover:text-blue-500">
          <Icon
            name="arrow"
            className="h-4 w-4"
          />
        </span>
      </div>

      <p className="mt-5 text-xs font-semibold text-slate-500">
        {title}
      </p>

      {loading ? (
        <div className="mt-2 h-9 w-20 animate-pulse rounded-lg bg-slate-100" />
      ) : (
        <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">
          {formatNumber(value)}
        </p>
      )}

      <p className="mt-1 text-xs text-slate-400">
        {detail}
      </p>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
        <Icon
          name="users"
          className="h-6 w-6"
        />
      </div>

      <h3 className="mt-4 text-sm font-bold text-slate-900">
        {title}
      </h3>

      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percentage = safePercentage(
    value,
    total,
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600">
          {label}
        </span>

        <span className="text-xs font-black text-blue-700">
          {percentage}%
        </span>
      </div>

      <ProgressBar value={percentage} />

      <p className="mt-1 text-[11px] text-slate-400">
        {formatNumber(value)} of{" "}
        {formatNumber(total)}
      </p>
    </div>
  );
}

function ActivityIcon({
  type,
}: {
  type: RecentActivity["type"];
}) {
  switch (type) {
    case "payment":
      return <Icon name="payment" />;

    case "assessment":
      return <Icon name="assessment" />;

    case "internship":
      return <Icon name="briefcase" />;

    case "dashboard":
      return <Icon name="dashboard" />;

    case "task":
      return <Icon name="task" />;

    case "certificate":
      return <Icon name="certificate" />;

    case "operations":
      return <Icon name="shield" />;

    case "student":
      return <Icon name="users" />;

    default:
      return <Icon name="activity" />;
  }
}

/* ============================================================================
   PAGE
   ============================================================================ */

export default function StudentAdminDashboardPage() {
  const [stats, setStats] =
    useState<DashboardStats>(EMPTY_STATS);

  const [students, setStudents] =
    useState<StudentRecord[]>([]);

  const [activity, setActivity] =
    useState<RecentActivity[]>([]);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<"all" | LifecycleStatus>(
      "all",
    );

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  /* --------------------------------------------------------------------------
     LOAD DASHBOARD
     -------------------------------------------------------------------------- */

  const loadDashboard = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await fetch(
          "/api/student-admin/dashboard",
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              "Cache-Control": "no-cache",
            },
            cache: "no-store",
            credentials: "include",
          },
        );

        const payload =
          (await response.json().catch(
            () => ({}) as DashboardPayload,
          )) as DashboardPayload;

        if (!response.ok) {
          throw new Error(
            payload.message ||
              payload.error ||
              "Unable to load Student Operations dashboard.",
          );
        }

        if (payload.success === false) {
          throw new Error(
            payload.message ||
              payload.error ||
              "Dashboard request failed.",
          );
        }

        const normalized =
          normalizeResponse(payload);

        setStats(normalized.stats);
        setStudents(normalized.students);
        setActivity(normalized.activity);
        setLastUpdated(new Date());
      } catch (errorValue) {
        setError(
          errorValue instanceof Error
            ? errorValue.message
            : "Unable to load dashboard data.",
        );

        setStats(EMPTY_STATS);
        setStudents([]);
        setActivity([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  /* --------------------------------------------------------------------------
     FILTER
     -------------------------------------------------------------------------- */

  const filteredStudents = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return students.filter((student) => {
      const lifecycle =
        lifecycleStatus(student);

      if (
        statusFilter !== "all" &&
        lifecycle !== statusFilter
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        student.name,
        student.email,
        student.studentId,
        student.domain,
        student.internshipTrack,
        student.internshipPlan,
        student.paymentStatus,
        student.studentOpsStatus,
        student.dashboardStatus,
        student.applicationStatus,
        student.assessmentStatus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [
    students,
    search,
    statusFilter,
  ]);

  const pendingReviews = useMemo(
    () =>
      students.filter(
        (student) =>
          operationsStatus(student) ===
          "pending-review",
      ),
    [students],
  );

  const averageProgress = useMemo(() => {
    if (!students.length) {
      return 0;
    }

    return Math.round(
      students.reduce(
        (total, student) =>
          total +
          percentageValue(student.progress),
        0,
      ) / students.length,
    );
  }, [students]);

  /* --------------------------------------------------------------------------
     SIDEBAR
     -------------------------------------------------------------------------- */

  const Sidebar = () => (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-[282px] flex-col border-r border-blue-100 bg-white shadow-xl shadow-blue-950/5 transition-transform lg:static lg:translate-x-0 lg:shadow-none ${
        sidebarOpen
          ? "translate-x-0"
          : "-translate-x-full"
      }`}
    >
      {/* BRAND */}
      <div className="flex h-[82px] items-center justify-between border-b border-blue-100 px-5">
        <Link
          href="/student-admin/dashboard"
          className="flex items-center gap-3"
          onClick={() =>
            setSidebarOpen(false)
          }
        >
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-sm font-black text-white shadow-lg shadow-blue-600/20">
            CN
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
          </div>

          <div>
            <div className="text-[15px] font-black tracking-tight text-slate-950">
              CyberNet
            </div>

            <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-blue-600">
              Student Operations
            </div>
          </div>
        </Link>

        <button
          type="button"
          className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700 lg:hidden"
          onClick={() =>
            setSidebarOpen(false)
          }
          aria-label="Close navigation"
        >
          <Icon name="close" />
        </button>
      </div>

      {/* NAVIGATION */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <p className="mb-3 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          Operations
        </p>

        <Link
          href="/student-admin/dashboard"
          className="flex items-center gap-3 rounded-xl bg-blue-600 px-3 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/15"
          onClick={() =>
            setSidebarOpen(false)
          }
        >
          <Icon name="grid" />
          <span>Operations Dashboard</span>
        </Link>

        <Link
          href="/student-admin/students"
          className="mt-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
          onClick={() =>
            setSidebarOpen(false)
          }
        >
          <Icon name="users" />
          <span>Students</span>
        </Link>

        <div className="my-7 h-px bg-blue-100" />

        <p className="mb-3 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          System
        </p>

        <Link
          href="/admin/dashboard"
          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
          onClick={() =>
            setSidebarOpen(false)
          }
        >
          <Icon name="shield" />
          <span>Main Admin</span>
        </Link>

        <div className="mt-7 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xs font-black text-white">
              SO
            </div>

            <div className="min-w-0">
              <p className="truncate text-xs font-black text-slate-900">
                Student Operations
              </p>

              <p className="mt-0.5 truncate text-[10px] text-blue-600">
                Secure Management Portal
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="border-t border-blue-100 p-4">
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-bold text-slate-600">
              System Online
            </span>
          </div>

          <span className="text-[9px] font-semibold text-slate-400">
            v1.0
          </span>
        </div>
      </div>
    </aside>
  );

  /* --------------------------------------------------------------------------
     RETURN
     -------------------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-[#f6f9ff] text-slate-950">
      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[1px] lg:hidden"
          onClick={() =>
            setSidebarOpen(false)
          }
          aria-label="Close navigation overlay"
        />
      )}

      <div className="flex min-h-screen">
        <Sidebar />

        <main className="min-w-0 flex-1">
          {/* HEADER */}
          <header className="sticky top-0 z-30 border-b border-blue-100 bg-white/95 backdrop-blur-xl">
            <div className="flex min-h-[82px] items-center gap-3 px-4 sm:px-6 lg:px-8">
              <button
                type="button"
                className="rounded-xl border border-blue-100 bg-white p-2.5 text-slate-600 hover:bg-blue-50 hover:text-blue-700 lg:hidden"
                onClick={() =>
                  setSidebarOpen(true)
                }
                aria-label="Open navigation"
              >
                <Icon name="menu" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-lg font-black tracking-tight text-slate-950 sm:text-xl">
                    Student Operations
                  </h1>

                  <span className="hidden rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-blue-600 sm:inline-flex">
                    Control Center
                  </span>
                </div>

                <p className="hidden text-xs text-slate-500 sm:block">
                  Manage verified payments, approvals,
                  dashboards and internship lifecycle.
                </p>
              </div>

              <div className="hidden items-center gap-2 md:flex">
                <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" />
                  <span className="text-[11px] font-bold text-emerald-700">
                    Live Operations
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  void loadDashboard(true)
                }
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Icon
                  name="refresh"
                  className={
                    refreshing
                      ? "h-4 w-4 animate-spin"
                      : "h-4 w-4"
                  }
                />

                <span className="hidden sm:inline">
                  {refreshing
                    ? "Refreshing"
                    : "Refresh"}
                </span>
              </button>
            </div>
          </header>

          {/* CONTENT */}
          <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {/* ERROR */}
            {error && (
              <div className="mb-6 overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-sm">
                <div className="flex flex-col gap-4 border-l-4 border-rose-500 bg-rose-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-rose-900">
                      Dashboard data unavailable
                    </p>

                    <p className="mt-1 text-xs text-rose-700">
                      {error}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void loadDashboard(true)
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700"
                  >
                    <Icon
                      name="refresh"
                      className="h-3.5 w-3.5"
                    />
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* HERO */}
            <section className="relative mb-7 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-blue-800 p-6 text-white shadow-[0_18px_50px_rgba(37,99,235,0.18)] sm:p-8 lg:p-9">
              <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl" />

              <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-50 backdrop-blur">
                    <span className="h-2 w-2 rounded-full bg-emerald-300" />
                    Student Operations Control
                  </div>

                  <h2 className="text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
                    Complete internship lifecycle,
                    controlled from one place.
                  </h2>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">
                    Review verified payments, approve
                    eligible students, monitor dashboard
                    activation and track internship progress
                    from one secure operations center.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold text-white">
                      Payment Verification
                    </span>

                    <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold text-white">
                      Operations Approval
                    </span>

                    <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold text-white">
                      Dashboard Control
                    </span>
                  </div>
                </div>

                <Link
                  href="/student-admin/students"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-blue-700 shadow-lg shadow-blue-950/10 transition hover:-translate-y-0.5 hover:bg-blue-50"
                >
                  Manage Students
                  <Icon
                    name="arrow"
                    className="h-4 w-4"
                  />
                </Link>
              </div>
            </section>

            {/* TOP STATS */}
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                loading={loading}
                title="Total Students"
                value={stats.students.total}
                detail={`${formatNumber(
                  stats.students.active,
                )} active`}
                icon={<Icon name="users" />}
                accent="blue"
              />

              <StatCard
                loading={loading}
                title="Pending Operations"
                value={
                  stats.operations.pendingReview
                }
                detail="Paid students awaiting review"
                icon={<Icon name="clock" />}
                accent="amber"
              />

              <StatCard
                loading={loading}
                title="Verified Payments"
                value={stats.payment.paid}
                detail={`${formatNumber(
                  stats.payment.pending,
                )} pending`}
                icon={<Icon name="payment" />}
                accent="green"
              />

              <StatCard
                loading={loading}
                title="Active Dashboards"
                value={stats.dashboards.active}
                detail={`${formatNumber(
                  stats.dashboards.locked,
                )} locked`}
                icon={<Icon name="dashboard" />}
                accent="violet"
              />
            </section>

            {/* SECONDARY STATS */}
            <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                loading={loading}
                title="Assessment Passed"
                value={stats.assessments.passed}
                detail={`${formatNumber(
                  stats.assessments.failed,
                )} failed`}
                icon={<Icon name="assessment" />}
                accent="blue"
              />

              <StatCard
                loading={loading}
                title="Active Internships"
                value={stats.internships.active}
                detail={`${formatNumber(
                  stats.internships.completed,
                )} completed`}
                icon={<Icon name="briefcase" />}
                accent="green"
              />

              <StatCard
                loading={loading}
                title="Pending Tasks"
                value={stats.tasks.pending}
                detail={`${formatNumber(
                  stats.tasks.completed,
                )} completed`}
                icon={<Icon name="task" />}
                accent="amber"
              />

              <StatCard
                loading={loading}
                title="Certificates Issued"
                value={stats.certificates.issued}
                detail={`${formatNumber(
                  stats.certificates.pending,
                )} pending`}
                icon={<Icon name="certificate" />}
                accent="violet"
              />
            </section>

            {/* MAIN QUEUE */}
            <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.75fr)]">
              <div className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-[0_6px_30px_rgba(15,23,42,0.04)]">
                {/* QUEUE HEADER */}
                <div className="border-b border-blue-100 p-5 sm:p-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-slate-950">
                          Student Operations Queue
                        </h3>

                        <span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-600">
                          {formatNumber(
                            filteredStudents.length,
                          )}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        Live student lifecycle records
                        available to Student Operations.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative">
                        <Icon
                          name="search"
                          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-400"
                        />

                        <input
                          value={search}
                          onChange={(event) =>
                            setSearch(
                              event.target.value,
                            )
                          }
                          placeholder="Search students..."
                          className="h-10 w-full rounded-xl border border-blue-100 bg-blue-50/40 pl-9 pr-3 text-sm font-medium outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 sm:w-64"
                        />
                      </div>

                      <div className="relative">
                        <Icon
                          name="filter"
                          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-blue-500"
                        />

                        <select
                          value={statusFilter}
                          onChange={(event) =>
                            setStatusFilter(
                              event.target.value as
                                | "all"
                                | LifecycleStatus,
                            )
                          }
                          className="h-10 w-full appearance-none rounded-xl border border-blue-100 bg-white pl-9 pr-8 text-xs font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 sm:w-40"
                        >
                          <option value="all">
                            All statuses
                          </option>
                          <option value="pending">
                            Pending
                          </option>
                          <option value="active">
                            Active
                          </option>
                          <option value="completed">
                            Completed
                          </option>
                          <option value="suspended">
                            Suspended
                          </option>
                          <option value="rejected">
                            Rejected
                          </option>
                          <option value="inactive">
                            Inactive
                          </option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* TABLE */}
                {loading ? (
                  <div className="space-y-5 p-6">
                    {[
                      1, 2, 3, 4, 5,
                    ].map((item) => (
                      <div
                        key={item}
                        className="flex animate-pulse items-center gap-4"
                      >
                        <div className="h-11 w-11 rounded-xl bg-blue-50" />

                        <div className="flex-1">
                          <div className="h-3 w-40 rounded bg-slate-200" />
                          <div className="mt-2 h-2.5 w-64 rounded bg-slate-100" />
                        </div>

                        <div className="hidden h-8 w-20 rounded bg-slate-100 sm:block" />
                      </div>
                    ))}
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <EmptyState
                    title={
                      search ||
                      statusFilter !== "all"
                        ? "No matching students"
                        : "No student records available"
                    }
                    description={
                      search ||
                      statusFilter !== "all"
                        ? "Try another search term or lifecycle filter."
                        : "Student records will appear here when the Student Operations API returns data."
                    }
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1080px]">
                      <thead>
                        <tr className="border-b border-blue-100 bg-[#f7faff] text-left">
                          <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                            Student
                          </th>

                          <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                            Internship
                          </th>

                          <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                            Payment
                          </th>

                          <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                            Operations
                          </th>

                          <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                            Dashboard
                          </th>

                          <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                            Progress
                          </th>

                          <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredStudents
                          .slice(0, 12)
                          .map((student) => {
                            const lifecycle =
                              lifecycleStatus(
                                student,
                              );

                            const operations =
                              operationsStatus(
                                student,
                              );

                            const payment =
                              paymentStatus(
                                student,
                              );

                            const dashboard =
                              dashboardStatus(
                                student,
                              );

                            const progress =
                              percentageValue(
                                student.progress,
                              );

                            return (
                              <tr
                                key={student.id}
                                className="border-b border-blue-50 transition last:border-0 hover:bg-blue-50/40"
                              >
                                {/* STUDENT */}
                                <td className="px-5 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-xs font-black text-blue-700 ring-1 ring-blue-100">
                                      {initials(
                                        student.name,
                                      )}
                                    </div>

                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-black text-slate-900">
                                        {student.name}
                                      </p>

                                      <p className="mt-0.5 max-w-[180px] truncate text-[11px] text-slate-500">
                                        {student.studentId ||
                                          student.email ||
                                          "ID unavailable"}
                                      </p>

                                      <div className="mt-1.5">
                                        <Badge
                                          tone={lifecycleTone(
                                            lifecycle,
                                          )}
                                        >
                                          {lifecycle}
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* INTERNSHIP */}
                                <td className="px-5 py-4">
                                  <p className="text-xs font-black text-slate-800">
                                    {domainLabel(
                                      student,
                                    )}
                                  </p>

                                  <p className="mt-1 text-[11px] text-slate-400">
                                    {planLabel(
                                      student.internshipPlan,
                                    )}
                                  </p>
                                </td>

                                {/* PAYMENT */}
                                <td className="px-5 py-4">
                                  <Badge
                                    tone={paymentTone(
                                      payment,
                                    )}
                                  >
                                    {payment}
                                  </Badge>

                                  {payment === "paid" &&
                                  student.paymentAmount ? (
                                    <p className="mt-1 text-[11px] font-bold text-emerald-600">
                                      ₹
                                      {formatNumber(
                                        student.paymentAmount,
                                      )}
                                    </p>
                                  ) : null}
                                </td>

                                {/* OPERATIONS */}
                                <td className="px-5 py-4">
                                  <Badge
                                    tone={operationsTone(
                                      operations,
                                    )}
                                  >
                                    {operations.replace(
                                      /-/g,
                                      " ",
                                    )}
                                  </Badge>
                                </td>

                                {/* DASHBOARD */}
                                <td className="px-5 py-4">
                                  <Badge
                                    tone={dashboardTone(
                                      dashboard,
                                    )}
                                  >
                                    {dashboard}
                                  </Badge>
                                </td>

                                {/* PROGRESS */}
                                <td className="px-5 py-4">
                                  <div className="w-28">
                                    <div className="mb-1.5 flex items-center justify-between">
                                      <span className="text-[11px] font-black text-blue-700">
                                        {progress}%
                                      </span>

                                      <span className="text-[9px] font-semibold text-slate-400">
                                        Progress
                                      </span>
                                    </div>

                                    <ProgressBar
                                      value={progress}
                                    />
                                  </div>
                                </td>

                                {/* ACTION */}
                                <td className="px-5 py-4 text-right">
                                  <Link
                                    href={`/student-admin/students/${encodeURIComponent(
                                      student.id,
                                    )}`}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs font-black text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
                                  >
                                    View
                                    <Icon
                                      name="arrow"
                                      className="h-3.5 w-3.5"
                                    />
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}

                {!loading &&
                  filteredStudents.length >
                    12 && (
                    <div className="flex items-center justify-between border-t border-blue-100 bg-blue-50/30 px-5 py-4">
                      <p className="text-xs text-slate-500">
                        Showing first 12 of{" "}
                        <span className="font-black text-slate-700">
                          {formatNumber(
                            filteredStudents.length,
                          )}
                        </span>{" "}
                        students
                      </p>

                      <Link
                        href="/student-admin/students"
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
                      >
                        View all
                        <Icon
                          name="arrow"
                          className="h-3.5 w-3.5"
                        />
                      </Link>
                    </div>
                  )}
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-6">
                {/* HEALTH */}
                <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-[0_6px_30px_rgba(15,23,42,0.04)] sm:p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-slate-950">
                          Operations Health
                        </h3>

                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        Current lifecycle distribution.
                      </p>
                    </div>

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Icon name="shield" />
                    </div>
                  </div>

                  <div className="mt-6 space-y-5">
                    <Metric
                      label="Active students"
                      value={
                        stats.students.active
                      }
                      total={
                        stats.students.total
                      }
                    />

                    <Metric
                      label="Paid students"
                      value={stats.payment.paid}
                      total={
                        stats.students.total
                      }
                    />

                    <Metric
                      label="Active dashboards"
                      value={
                        stats.dashboards.active
                      }
                      total={
                        stats.students.total
                      }
                    />

                    <Metric
                      label="Assessment passed"
                      value={
                        stats.assessments.passed
                      }
                      total={Math.max(
                        1,
                        stats.assessments.total,
                      )}
                    />
                  </div>
                </div>

                {/* REVIEW QUEUE */}
                <div className="overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-[0_6px_30px_rgba(15,23,42,0.04)]">
                  <div className="border-l-4 border-amber-500 bg-amber-50 p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm">
                        <Icon name="clock" />
                      </div>

                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-600">
                          Attention Required
                        </p>

                        <h3 className="mt-1 text-sm font-black text-amber-950">
                          Operations Review Queue
                        </h3>

                        <p className="mt-1 text-xs leading-5 text-amber-800">
                          {pendingReviews.length
                            ? `${formatNumber(
                                pendingReviews.length,
                              )} paid student(s) require Student Operations review.`
                            : "No pending Student Operations reviews."}
                        </p>
                      </div>
                    </div>

                    <Link
                      href="/student-admin/students"
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-amber-700"
                    >
                      Open Review Queue
                      <Icon
                        name="arrow"
                        className="h-3.5 w-3.5"
                      />
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            {/* ACTIVITY + PROGRESS */}
            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              {/* ACTIVITY */}
              <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-[0_6px_30px_rgba(15,23,42,0.04)] sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black">
                        Recent Activity
                      </h3>

                      <span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-600">
                        LIVE
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      Latest operational events.
                    </p>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Icon name="bell" />
                  </div>
                </div>

                {activity.length === 0 ? (
                  <EmptyState
                    title="No recent activity"
                    description="New operational events will appear here when available."
                  />
                ) : (
                  <div className="mt-5 space-y-1">
                    {activity
                      .slice(0, 8)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex gap-3 rounded-2xl p-3 transition hover:bg-blue-50/60"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <ActivityIcon
                              type={item.type}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black text-slate-900">
                              {item.title}
                            </p>

                            {item.description && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                                {item.description}
                              </p>
                            )}

                            <p className="mt-1 text-[10px] font-semibold text-slate-400">
                              {relativeDate(
                                item.createdAt,
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* PROGRESS */}
              <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-[0_6px_30px_rgba(15,23,42,0.04)] sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black">
                      Internship Progress
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      Average progress across returned students.
                    </p>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Icon name="briefcase" />
                  </div>
                </div>

                <div className="mt-7">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">
                        Average progress
                      </p>

                      <p className="mt-1 text-5xl font-black tracking-tight text-slate-950">
                        {averageProgress}%
                      </p>
                    </div>

                    <span className="rounded-full bg-emerald-50 px-2.5 py-1.5 text-[10px] font-black text-emerald-700">
                      Live
                    </span>
                  </div>

                  <div className="mt-5">
                    <ProgressBar
                      value={averageProgress}
                    />
                  </div>
                </div>

                <div className="mt-7 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                    <p className="text-[10px] font-bold text-slate-500">
                      Active
                    </p>

                    <p className="mt-1 text-xl font-black text-slate-950">
                      {formatNumber(
                        stats.internships.active,
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                    <p className="text-[10px] font-bold text-slate-500">
                      Completed
                    </p>

                    <p className="mt-1 text-xl font-black text-slate-950">
                      {formatNumber(
                        stats.internships.completed,
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                    <p className="text-[10px] font-bold text-slate-500">
                      Pending Tasks
                    </p>

                    <p className="mt-1 text-xl font-black text-slate-950">
                      {formatNumber(
                        stats.tasks.pending,
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                    <p className="text-[10px] font-bold text-slate-500">
                      Certificates
                    </p>

                    <p className="mt-1 text-xl font-black text-slate-950">
                      {formatNumber(
                        stats.certificates.issued,
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* LIFECYCLE */}
            <section className="mt-6 overflow-hidden rounded-3xl border border-blue-100 bg-white p-5 shadow-[0_6px_30px_rgba(15,23,42,0.04)] sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black">
                      Student Lifecycle
                    </h3>

                    <span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-600">
                      END TO END
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    Main Admin → Assessment → Payment →
                    Operations → Dashboard → Internship →
                    Certificate
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
                {[
                  {
                    number: "01",
                    title: "Assessment",
                    value:
                      stats.assessments.passed,
                    icon: "assessment" as const,
                  },
                  {
                    number: "02",
                    title: "Payment",
                    value: stats.payment.paid,
                    icon: "payment" as const,
                  },
                  {
                    number: "03",
                    title: "Review",
                    value:
                      stats.operations.pendingReview,
                    icon: "clock" as const,
                  },
                  {
                    number: "04",
                    title: "Approval",
                    value:
                      stats.operations.approved,
                    icon: "check" as const,
                  },
                  {
                    number: "05",
                    title: "Dashboard",
                    value:
                      stats.dashboards.active,
                    icon: "dashboard" as const,
                  },
                  {
                    number: "06",
                    title: "Internship",
                    value:
                      stats.internships.active,
                    icon: "briefcase" as const,
                  },
                  {
                    number: "07",
                    title: "Certificate",
                    value:
                      stats.certificates.issued,
                    icon: "certificate" as const,
                  },
                ].map((item) => (
                  <div
                    key={item.number}
                    className="group rounded-2xl border border-blue-100 bg-gradient-to-b from-white to-blue-50/40 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black tracking-[0.16em] text-blue-300">
                        {item.number}
                      </span>

                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white">
                        <Icon
                          name={item.icon}
                          className="h-4 w-4"
                        />
                      </div>
                    </div>

                    <p className="mt-4 text-[11px] font-bold text-slate-500">
                      {item.title}
                    </p>

                    <p className="mt-1 text-xl font-black text-slate-950">
                      {formatNumber(item.value)}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* FOOTER */}
            <footer className="mt-8 flex flex-col gap-2 border-t border-blue-100 pt-6 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <p>
                © {new Date().getFullYear()} CyberNet
                Technology. Student Operations Portal.
              </p>

              <div className="flex items-center gap-3">
                {lastUpdated && (
                  <span>
                    Last updated{" "}
                    {lastUpdated.toLocaleTimeString(
                      "en-IN",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </span>
                )}

                <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Operational
                </span>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}