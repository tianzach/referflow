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

export type QuotaUsage = { referredThisMonth: number };

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

  return { referredThisMonth };
}
