import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RequestStatus } from "@/generated/prisma/enums";
import { quotaUsage } from "./quota";

const { PENDING, APPROVED, DECLINED, REFERRED, INTERVIEWING, CLOSED } = RequestStatus;

// Fixtures: referrer-1 offers 3 referrals a month; "now" is mid-November 2026 unless a test says
// otherwise. All timestamps are UTC.
const REFERRER = "referrer-1";
const profile = { userId: REFERRER, monthlyQuota: 3 };
const NOW = new Date("2026-11-15T12:00:00Z");

type Move = [to: RequestStatus, at: string];

/** A request submitted at `createdAt` that then made `moves`, in order. */
function request(createdAt: string, moves: Move[] = [], referrerId = REFERRER) {
  return {
    referrerId,
    createdAt: new Date(createdAt),
    status: moves.at(-1)?.[0] ?? PENDING,
    statusChanges: moves.map(([to, at]) => ({ to, createdAt: new Date(at) })),
  };
}

/** Submitted and approved a day before it was referred at `at`. */
function referredAt(at: string, referrerId = REFERRER) {
  const dayBefore = new Date(Date.parse(at) - 86_400_000).toISOString();
  return request(
    dayBefore,
    [
      [APPROVED, dayBefore],
      [REFERRED, at],
    ],
    referrerId,
  );
}

describe("AC1: counts requests that reached REFERRED in the current UTC month", () => {
  it.each([
    ["referred this month", 1, referredAt("2026-11-05T10:00:00Z")],
    [
      "submitted last month, referred this month",
      1,
      request("2026-10-28T10:00:00Z", [
        [APPROVED, "2026-10-29T10:00:00Z"],
        [REFERRED, "2026-11-02T10:00:00Z"],
      ]),
    ],
    [
      "referred this month, since moved on to INTERVIEWING",
      1,
      request("2026-11-01T10:00:00Z", [
        [APPROVED, "2026-11-02T10:00:00Z"],
        [REFERRED, "2026-11-03T10:00:00Z"],
        [INTERVIEWING, "2026-11-10T10:00:00Z"],
      ]),
    ],
    [
      "referred this month, since CLOSED",
      1,
      request("2026-11-01T10:00:00Z", [
        [APPROVED, "2026-11-02T10:00:00Z"],
        [REFERRED, "2026-11-03T10:00:00Z"],
        [CLOSED, "2026-11-12T10:00:00Z"],
      ]),
    ],
    [
      "submitted this month, approved but not referred yet",
      0,
      request("2026-11-10T10:00:00Z", [[APPROVED, "2026-11-11T10:00:00Z"]]),
    ],
    [
      "declined this month",
      0,
      request("2026-11-10T10:00:00Z", [[DECLINED, "2026-11-11T10:00:00Z"]]),
    ],
    [
      "referred last month, moved to INTERVIEWING this month",
      0,
      request("2026-10-01T10:00:00Z", [
        [APPROVED, "2026-10-02T10:00:00Z"],
        [REFERRED, "2026-10-03T10:00:00Z"],
        [INTERVIEWING, "2026-11-04T10:00:00Z"],
      ]),
    ],
  ])("%s → %i", (_label, expected, req) => {
    expect(quotaUsage(profile, [req], NOW).referredThisMonth).toBe(expected);
  });

  it("sums this referrer's requests and ignores other referrers'", () => {
    const requests = [
      referredAt("2026-11-03T10:00:00Z"),
      referredAt("2026-11-04T10:00:00Z"),
      referredAt("2026-11-05T10:00:00Z", "referrer-2"),
    ];
    expect(quotaUsage(profile, requests, NOW).referredThisMonth).toBe(2);
  });

  it("is 0 when the referrer has no requests", () => {
    expect(quotaUsage(profile, [], NOW).referredThisMonth).toBe(0);
  });
});

describe("AC3: month boundaries are UTC", () => {
  // Run in a zone 14 hours ahead of UTC, where 2026-11-30T23:59Z is already 1 December locally,
  // so code that reads local months instead of UTC months fails here and not only on a laptop.
  beforeEach(() => {
    vi.stubEnv("TZ", "Pacific/Kiritimati");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is really running in a non-UTC zone", () => {
    expect(new Date("2026-11-30T23:59:00Z").getDate()).toBe(1);
  });

  it.each([
    ["2026-11-30T23:59:00Z", "2026-11-30T23:59:59.999Z", 1, "counts for November"],
    ["2026-11-30T23:59:00Z", "2026-12-01T00:00:00Z", 0, "does not count for December"],
    ["2026-12-01T00:00:00Z", "2026-12-01T00:00:00Z", 1, "counts for December"],
    ["2026-12-01T00:00:00Z", "2026-12-31T23:59:59.999Z", 1, "still counts at the end of December"],
    ["2026-12-31T23:59:00Z", "2027-01-01T00:00:00Z", 0, "does not roll into the next year"],
    ["2026-01-15T10:00:00Z", "2027-01-20T10:00:00Z", 0, "does not count a year later"],
  ])("a referral at %s, seen at %s → %i (%s)", (at, now, expected) => {
    expect(quotaUsage(profile, [referredAt(at)], new Date(now)).referredThisMonth).toBe(expected);
  });
});
