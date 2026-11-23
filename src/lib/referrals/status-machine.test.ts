import { describe, expect, it } from "vitest";
import { RequestStatus, Role } from "@/generated/prisma/enums";
import { transition, type Actor, type RequestRef } from "./status-machine";

const { PENDING, APPROVED, DECLINED, REFERRED, INTERVIEWING, OFFER, CLOSED } = RequestStatus;

const referrer: Actor = { id: "referrer-1", role: Role.REFERRER };

function request(status: RequestStatus): RequestRef {
  return { id: "req-1", candidateId: "candidate-1", referrerId: referrer.id, status };
}

describe("AC1: allows each forward step of the pipeline", () => {
  it.each([
    [PENDING, APPROVED],
    [APPROVED, REFERRED],
    [REFERRED, INTERVIEWING],
    [INTERVIEWING, OFFER],
  ])("%s → %s", (from, to) => {
    expect(transition(request(from), referrer, to).ok).toBe(true);
  });

  it("PENDING → DECLINED (with a reason)", () => {
    const result = transition(request(PENDING), referrer, DECLINED, { reason: "Role is filled" });
    expect(result.ok).toBe(true);
  });
});

describe("AC2: rejects skipped, backward and same-status moves", () => {
  it.each([
    [PENDING, REFERRED],
    [PENDING, INTERVIEWING],
    [PENDING, OFFER],
    [APPROVED, INTERVIEWING],
    [APPROVED, DECLINED],
    [REFERRED, APPROVED],
    [INTERVIEWING, REFERRED],
    [INTERVIEWING, PENDING],
    [PENDING, PENDING],
    [REFERRED, REFERRED],
  ])("%s → %s is INVALID_TRANSITION", (from, to) => {
    expect(transition(request(from), referrer, to)).toEqual({
      ok: false,
      error: "INVALID_TRANSITION",
    });
  });
});

describe("AC3: DECLINED, OFFER and CLOSED are terminal", () => {
  it.each([
    [DECLINED, PENDING],
    [DECLINED, APPROVED],
    [OFFER, CLOSED],
    [OFFER, INTERVIEWING],
    [CLOSED, PENDING],
    [CLOSED, REFERRED],
  ])("%s → %s is TERMINAL_STATUS", (from, to) => {
    expect(transition(request(from), referrer, to)).toEqual({
      ok: false,
      error: "TERMINAL_STATUS",
    });
  });
});

const candidate: Actor = { id: "candidate-1", role: Role.CANDIDATE };
const otherReferrer: Actor = { id: "referrer-2", role: Role.REFERRER };
const otherCandidate: Actor = { id: "candidate-2", role: Role.CANDIDATE };

describe("AC4: only the assigned referrer moves a request through the pipeline", () => {
  it.each([
    [PENDING, APPROVED],
    [APPROVED, REFERRED],
    [REFERRED, INTERVIEWING],
    [INTERVIEWING, OFFER],
  ])("the candidate cannot move %s → %s", (from, to) => {
    expect(transition(request(from), candidate, to)).toEqual({ ok: false, error: "FORBIDDEN" });
  });

  it("the candidate cannot decline their own request", () => {
    expect(transition(request(PENDING), candidate, DECLINED, { reason: "nope" })).toEqual({
      ok: false,
      error: "FORBIDDEN",
    });
  });

  it("a referrer who is not assigned cannot approve", () => {
    expect(transition(request(PENDING), otherReferrer, APPROVED)).toEqual({
      ok: false,
      error: "FORBIDDEN",
    });
  });

  it("an invalid move is reported as INVALID_TRANSITION even for an unauthorized actor", () => {
    expect(transition(request(PENDING), candidate, REFERRED)).toEqual({
      ok: false,
      error: "INVALID_TRANSITION",
    });
  });
});

describe("AC5: withdrawing and closing", () => {
  it.each([PENDING, APPROVED])("the owning candidate can withdraw from %s", (from) => {
    expect(transition(request(from), candidate, CLOSED).ok).toBe(true);
  });

  it.each([REFERRED, INTERVIEWING])("the candidate cannot withdraw from %s", (from) => {
    expect(transition(request(from), candidate, CLOSED)).toEqual({
      ok: false,
      error: "FORBIDDEN",
    });
  });

  it("another candidate cannot withdraw someone else's request", () => {
    expect(transition(request(PENDING), otherCandidate, CLOSED)).toEqual({
      ok: false,
      error: "FORBIDDEN",
    });
  });

  it.each([APPROVED, REFERRED, INTERVIEWING])("the assigned referrer can close from %s", (from) => {
    expect(transition(request(from), referrer, CLOSED).ok).toBe(true);
  });

  it("the referrer must decline, not close, a PENDING request", () => {
    expect(transition(request(PENDING), referrer, CLOSED)).toEqual({
      ok: false,
      error: "FORBIDDEN",
    });
  });

  it("another referrer cannot close the request", () => {
    expect(transition(request(REFERRED), otherReferrer, CLOSED)).toEqual({
      ok: false,
      error: "FORBIDDEN",
    });
  });
});

describe("AC6: declining requires a reason", () => {
  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["whitespace only", "   "],
  ])("a %s reason is REASON_REQUIRED", (_label, reason) => {
    expect(transition(request(PENDING), referrer, DECLINED, { reason })).toEqual({
      ok: false,
      error: "REASON_REQUIRED",
    });
  });

  it("permission is checked before the reason", () => {
    expect(transition(request(PENDING), candidate, DECLINED)).toEqual({
      ok: false,
      error: "FORBIDDEN",
    });
  });
});

describe("AC7: a successful move returns the StatusChange to persist", () => {
  it("records from, to, actor and the trimmed reason", () => {
    const result = transition(request(PENDING), referrer, DECLINED, {
      reason: "  Team is not hiring new grads  ",
    });

    expect(result).toEqual({
      ok: true,
      change: {
        requestId: "req-1",
        from: PENDING,
        to: DECLINED,
        actorId: "referrer-1",
        reason: "Team is not hiring new grads",
      },
    });
  });

  it("stores a null reason when none is given", () => {
    const result = transition(request(APPROVED), referrer, REFERRED);
    expect(result).toEqual({
      ok: true,
      change: {
        requestId: "req-1",
        from: APPROVED,
        to: REFERRED,
        actorId: "referrer-1",
        reason: null,
      },
    });
  });

  it("keeps an optional reason on non-decline moves (e.g. why the candidate withdrew)", () => {
    const result = transition(request(PENDING), candidate, CLOSED, {
      reason: "Accepted another offer",
    });
    expect(result.ok && result.change.reason).toBe("Accepted another offer");
  });
});
