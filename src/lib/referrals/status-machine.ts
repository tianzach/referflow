import { RequestStatus, Role } from "@/generated/prisma/enums";

export type Actor = { id: string; role: Role };

export type RequestRef = {
  id: string;
  candidateId: string;
  referrerId: string;
  status: RequestStatus;
};

export type TransitionError = "INVALID_TRANSITION" | "TERMINAL_STATUS" | "FORBIDDEN";

export type TransitionResult = { ok: true } | { ok: false; error: TransitionError };

const NEXT: Partial<Record<RequestStatus, RequestStatus[]>> = {
  PENDING: [RequestStatus.APPROVED, RequestStatus.DECLINED, RequestStatus.CLOSED],
  APPROVED: [RequestStatus.REFERRED, RequestStatus.CLOSED],
  REFERRED: [RequestStatus.INTERVIEWING, RequestStatus.CLOSED],
  INTERVIEWING: [RequestStatus.OFFER, RequestStatus.CLOSED],
};

const TERMINAL: RequestStatus[] = [
  RequestStatus.DECLINED,
  RequestStatus.OFFER,
  RequestStatus.CLOSED,
];

const CANDIDATE_CAN_WITHDRAW_FROM: RequestStatus[] = [
  RequestStatus.PENDING,
  RequestStatus.APPROVED,
];

export function transition(
  request: RequestRef,
  actor: Actor,
  to: RequestStatus,
  _options: { reason?: string } = {},
): TransitionResult {
  if (TERMINAL.includes(request.status)) {
    return { ok: false, error: "TERMINAL_STATUS" };
  }
  if (!NEXT[request.status]?.includes(to)) {
    return { ok: false, error: "INVALID_TRANSITION" };
  }

  const isOwner = actor.role === Role.CANDIDATE && actor.id === request.candidateId;
  const isAssignedReferrer = actor.role === Role.REFERRER && actor.id === request.referrerId;

  if (to === RequestStatus.CLOSED) {
    const allowed =
      (isOwner && CANDIDATE_CAN_WITHDRAW_FROM.includes(request.status)) ||
      (isAssignedReferrer && request.status !== RequestStatus.PENDING);
    return allowed ? { ok: true } : { ok: false, error: "FORBIDDEN" };
  }

  if (!isAssignedReferrer) {
    return { ok: false, error: "FORBIDDEN" };
  }
  return { ok: true };
}
