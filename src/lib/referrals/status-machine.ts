import { RequestStatus, type Role } from "@/generated/prisma/enums";

export type Actor = { id: string; role: Role };

export type RequestRef = {
  id: string;
  candidateId: string;
  referrerId: string;
  status: RequestStatus;
};

export type TransitionError = "INVALID_TRANSITION" | "TERMINAL_STATUS";

export type TransitionResult = { ok: true } | { ok: false; error: TransitionError };

const NEXT: Partial<Record<RequestStatus, RequestStatus[]>> = {
  PENDING: [RequestStatus.APPROVED, RequestStatus.DECLINED],
  APPROVED: [RequestStatus.REFERRED],
  REFERRED: [RequestStatus.INTERVIEWING],
  INTERVIEWING: [RequestStatus.OFFER],
};

const TERMINAL: RequestStatus[] = [
  RequestStatus.DECLINED,
  RequestStatus.OFFER,
  RequestStatus.CLOSED,
];

export function transition(
  request: RequestRef,
  _actor: Actor,
  to: RequestStatus,
  _options: { reason?: string } = {},
): TransitionResult {
  if (TERMINAL.includes(request.status)) {
    return { ok: false, error: "TERMINAL_STATUS" };
  }
  if (!NEXT[request.status]?.includes(to)) {
    return { ok: false, error: "INVALID_TRANSITION" };
  }
  return { ok: true };
}
