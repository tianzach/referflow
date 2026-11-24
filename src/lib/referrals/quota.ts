import { RequestStatus } from "@/generated/prisma/enums";
import type {
  ReferralRequestModel,
  ReferrerProfileModel,
  StatusChangeModel,
} from "@/generated/prisma/models";
import type { NewReferralRequestInput } from "./request-input";
import { isTerminal } from "./status-machine";

export type QuotaProfile = Pick<ReferrerProfileModel, "userId" | "monthlyQuota">;

/** A request with its status history, e.g. a `findMany` with `include: { statusChanges: true }`. */
export type QuotaRequest = Pick<ReferralRequestModel, "referrerId" | "status"> & {
  statusChanges: readonly Pick<StatusChangeModel, "to" | "createdAt">[];
};

export type QuotaUsage = {
  referredThisMonth: number;
  approvedNotYetReferred: number;
  remaining: number;
};

export type ApproveResult =
  { ok: true; remaining: number } | { ok: false; error: "QUOTA_EXCEEDED" };

export type SubmitReferrer = Pick<
  ReferrerProfileModel,
  "userId" | "companies" | "acceptingRequests"
>;
export type SubmitInput = Pick<NewReferralRequestInput, "company" | "roleTitle">;
export type ExistingRequest = Pick<
  ReferralRequestModel,
  "candidateId" | "referrerId" | "company" | "roleTitle" | "status"
>;

export type SubmitError = "NOT_ACCEPTING" | "COMPANY_NOT_OFFERED" | "DUPLICATE_ACTIVE_REQUEST";
export type SubmitResult = { ok: true } | { ok: false; error: SubmitError };

/** Month boundaries are UTC (AC3), so never use the local-time getters here. */
function sameUtcMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

/** Uses the REFERRED StatusChange timestamp, not `createdAt`, and ignores the current status. */
function referredInMonthOf(request: QuotaRequest, now: Date): boolean {
  return request.statusChanges.some(
    (change) => change.to === RequestStatus.REFERRED && sameUtcMonth(change.createdAt, now),
  );
}

export function quotaUsage(
  profile: QuotaProfile,
  requests: readonly QuotaRequest[],
  now: Date,
): QuotaUsage {
  const own = requests.filter((request) => request.referrerId === profile.userId);
  const referredThisMonth = own.filter((request) => referredInMonthOf(request, now)).length;
  const approvedNotYetReferred = own.filter(
    (request) => request.status === RequestStatus.APPROVED,
  ).length;
  const remaining = Math.max(0, profile.monthlyQuota - referredThisMonth - approvedNotYetReferred);

  return { referredThisMonth, approvedNotYetReferred, remaining };
}

export function canApprove(
  profile: QuotaProfile,
  requests: readonly QuotaRequest[],
  now: Date,
): ApproveResult {
  const { remaining } = quotaUsage(profile, requests, now);
  if (remaining === 0) return { ok: false, error: "QUOTA_EXCEEDED" };
  return { ok: true, remaining };
}

export function canSubmitRequest(
  candidateId: string,
  referrer: SubmitReferrer,
  input: SubmitInput,
  existing: readonly ExistingRequest[],
): SubmitResult {
  if (!referrer.acceptingRequests) return { ok: false, error: "NOT_ACCEPTING" };

  const company = input.company.trim().replace(/\s+/g, " ").toLowerCase();
  const offered = referrer.companies.some(
    (name) => name.trim().replace(/\s+/g, " ").toLowerCase() === company,
  );
  if (!offered) return { ok: false, error: "COMPANY_NOT_OFFERED" };

  const roleTitle = input.roleTitle.trim().replace(/\s+/g, " ").toLowerCase();
  const duplicate = existing.some(
    (request) =>
      request.candidateId === candidateId &&
      request.referrerId === referrer.userId &&
      request.company.trim().replace(/\s+/g, " ").toLowerCase() === company &&
      request.roleTitle.trim().replace(/\s+/g, " ").toLowerCase() === roleTitle &&
      !isTerminal(request.status),
  );
  if (duplicate) return { ok: false, error: "DUPLICATE_ACTIVE_REQUEST" };

  return { ok: true };
}
