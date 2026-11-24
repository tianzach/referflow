import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RequestStatus } from "@/generated/prisma/enums";
import { canApprove, canSubmitRequest, quotaUsage } from "./quota";

const { PENDING, APPROVED, DECLINED, REFERRED, INTERVIEWING, OFFER, CLOSED } = RequestStatus;

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

/** Approved at `at` and still waiting to be referred. */
function approvedAt(at: string, referrerId = REFERRER) {
  return request(at, [[APPROVED, at]], referrerId);
}

/** `referred` requests referred this month plus `approved` requests still waiting. */
function requests(referred: number, approved: number) {
  return [
    ...Array.from({ length: referred }, (_, i) => referredAt(`2026-11-0${i + 2}T10:00:00Z`)),
    ...Array.from({ length: approved }, () => approvedAt("2026-11-10T10:00:00Z")),
  ];
}

// Submission fixtures: candidate-1 asks referrer-1, who refers to Stripe and Google.
const CANDIDATE = "candidate-1";
const referrer = { userId: REFERRER, companies: ["Stripe", "Google"], acceptingRequests: true };
const input = { company: "Stripe", roleTitle: "New Grad Software Engineer" };

type ExistingFields = {
  candidateId: string;
  referrerId: string;
  company: string;
  roleTitle: string;
};

/** A request candidate-1 already made to referrer-1 for the same company and role as `input`. */
function existing(status: RequestStatus, overrides: Partial<ExistingFields> = {}) {
  return { candidateId: CANDIDATE, referrerId: REFERRER, ...input, status, ...overrides };
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

describe("AC2: canApprove stops at the monthly quota, counting approved-but-not-referred", () => {
  it.each([
    // referred this month, approved and waiting, monthly quota → result
    [0, 0, 3, { ok: true, remaining: 3 }],
    [2, 0, 3, { ok: true, remaining: 1 }],
    [1, 1, 3, { ok: true, remaining: 1 }],
    [3, 0, 3, { ok: false, error: "QUOTA_EXCEEDED" }],
    [2, 1, 3, { ok: false, error: "QUOTA_EXCEEDED" }],
    [0, 3, 3, { ok: false, error: "QUOTA_EXCEEDED" }],
    [0, 0, 0, { ok: false, error: "QUOTA_EXCEEDED" }],
  ])("%i referred + %i approved, quota %i → %o", (referred, approved, monthlyQuota, expected) => {
    const result = canApprove({ ...profile, monthlyQuota }, requests(referred, approved), NOW);
    expect(result).toEqual(expected);
  });

  it("reports both counts and the remaining slots", () => {
    expect(quotaUsage(profile, requests(1, 1), NOW)).toEqual({
      referredThisMonth: 1,
      approvedNotYetReferred: 1,
      remaining: 1,
    });
  });

  it("counts a request approved last month that is still waiting to be referred", () => {
    const waiting = approvedAt("2026-10-20T10:00:00Z");
    expect(quotaUsage(profile, [waiting], NOW).approvedNotYetReferred).toBe(1);
  });

  it("ignores other referrers' approved requests", () => {
    const theirs = approvedAt("2026-11-10T10:00:00Z", "referrer-2");
    expect(quotaUsage(profile, [theirs], NOW).approvedNotYetReferred).toBe(0);
  });

  it("never reports negative remaining when the quota is lowered below this month's usage", () => {
    const lowered = { ...profile, monthlyQuota: 1 };
    expect(quotaUsage(lowered, requests(2, 1), NOW).remaining).toBe(0);
    expect(canApprove(lowered, requests(2, 1), NOW)).toEqual({
      ok: false,
      error: "QUOTA_EXCEEDED",
    });
  });
});

describe("AC5: rejects companies the referrer doesn't offer, and referrers who aren't accepting", () => {
  it("accepts a request for an offered company", () => {
    expect(canSubmitRequest(CANDIDATE, referrer, input, [])).toEqual({ ok: true });
  });

  it.each([
    ["different case", "stripe", ["Stripe"]],
    ["surrounding spaces", "  STRIPE ", ["Stripe"]],
    ["different inner spacing", "Jane  Street", ["jane street"]],
  ])("matches the company despite %s", (_label, company, companies) => {
    const result = canSubmitRequest(
      CANDIDATE,
      { ...referrer, companies },
      { ...input, company },
      [],
    );
    expect(result).toEqual({ ok: true });
  });

  it.each([
    ["a company not in the list", "Meta", ["Stripe", "Google"]],
    ["a longer name that only starts the same", "Stripe Inc", ["Stripe"]],
    ["an empty company list", "Stripe", []],
  ])("rejects %s with COMPANY_NOT_OFFERED", (_label, company, companies) => {
    const result = canSubmitRequest(
      CANDIDATE,
      { ...referrer, companies },
      { ...input, company },
      [],
    );
    expect(result).toEqual({ ok: false, error: "COMPANY_NOT_OFFERED" });
  });

  it("rejects with NOT_ACCEPTING when the referrer has paused requests", () => {
    const paused = { ...referrer, acceptingRequests: false };
    expect(canSubmitRequest(CANDIDATE, paused, input, [])).toEqual({
      ok: false,
      error: "NOT_ACCEPTING",
    });
  });

  it("reports NOT_ACCEPTING before COMPANY_NOT_OFFERED", () => {
    const paused = { ...referrer, acceptingRequests: false };
    const result = canSubmitRequest(CANDIDATE, paused, { ...input, company: "Meta" }, []);
    expect(result).toEqual({ ok: false, error: "NOT_ACCEPTING" });
  });
});

describe("AC4: rejects a duplicate while an earlier request is still active", () => {
  it.each([PENDING, APPROVED, REFERRED, INTERVIEWING])(
    "blocks while the earlier one is %s",
    (status) => {
      expect(canSubmitRequest(CANDIDATE, referrer, input, [existing(status)])).toEqual({
        ok: false,
        error: "DUPLICATE_ACTIVE_REQUEST",
      });
    },
  );

  it.each([
    ["case", { company: "STRIPE", roleTitle: "new grad software engineer" }],
    ["whitespace", { company: " Stripe ", roleTitle: "New  Grad Software   Engineer " }],
  ])("matches company and role regardless of %s", (_label, stored) => {
    expect(canSubmitRequest(CANDIDATE, referrer, input, [existing(PENDING, stored)])).toEqual({
      ok: false,
      error: "DUPLICATE_ACTIVE_REQUEST",
    });
  });

  it.each([
    ["another candidate's request", { candidateId: "candidate-2" }],
    ["a request to another referrer", { referrerId: "referrer-2" }],
    ["a different role at the same company", { roleTitle: "Senior Software Engineer" }],
    ["the same role at another company", { company: "Google" }],
  ])("does not count %s", (_label, overrides) => {
    expect(canSubmitRequest(CANDIDATE, referrer, input, [existing(PENDING, overrides)])).toEqual({
      ok: true,
    });
  });

  it("reports NOT_ACCEPTING and COMPANY_NOT_OFFERED before DUPLICATE_ACTIVE_REQUEST", () => {
    const active = [existing(PENDING), existing(PENDING, { company: "Meta" })];
    const paused = { ...referrer, acceptingRequests: false };
    expect(canSubmitRequest(CANDIDATE, paused, input, active)).toEqual({
      ok: false,
      error: "NOT_ACCEPTING",
    });
    expect(canSubmitRequest(CANDIDATE, referrer, { ...input, company: "Meta" }, active)).toEqual({
      ok: false,
      error: "COMPANY_NOT_OFFERED",
    });
  });
});

describe("AC6: a request that has ended does not block a new one", () => {
  it.each([DECLINED, CLOSED, OFFER])("allows a new request after a %s one", (status) => {
    expect(canSubmitRequest(CANDIDATE, referrer, input, [existing(status)])).toEqual({ ok: true });
  });

  it("still blocks when an ended request is listed before an active one", () => {
    const history = [existing(DECLINED), existing(PENDING)];
    expect(canSubmitRequest(CANDIDATE, referrer, input, history)).toEqual({
      ok: false,
      error: "DUPLICATE_ACTIVE_REQUEST",
    });
  });
});
