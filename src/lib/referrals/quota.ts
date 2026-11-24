import { RequestStatus } from "@/generated/prisma/enums";
import type {
  ReferralRequestModel,
  ReferrerProfileModel,
  StatusChangeModel,
} from "@/generated/prisma/models";

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

export function quotaUsage(
  profile: QuotaProfile,
  requests: readonly QuotaRequest[],
  now: Date,
): QuotaUsage {
  const referredThisMonth = requests.filter(
    (request) =>
      request.referrerId === profile.userId &&
      request.statusChanges.some(
        (change) =>
          change.to === RequestStatus.REFERRED &&
          change.createdAt.getUTCFullYear() === now.getUTCFullYear() &&
          change.createdAt.getUTCMonth() === now.getUTCMonth(),
      ),
  ).length;

  const approvedNotYetReferred = requests.filter(
    (request) => request.referrerId === profile.userId && request.status === RequestStatus.APPROVED,
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
