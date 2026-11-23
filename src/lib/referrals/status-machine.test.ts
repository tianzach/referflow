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
