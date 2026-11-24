import { RequestStatus, Role } from "@/generated/prisma/enums";

export type Actor = { id: string; role: Role };

export type RequestRef = {
  id: string;
  candidateId: string;
  referrerId: string;
  status: RequestStatus;
};

export type TransitionError =
  "INVALID_TRANSITION" | "TERMINAL_STATUS" | "FORBIDDEN" | "REASON_REQUIRED";

/** Matches the StatusChange model; the caller persists it alongside the status update. */
export type StatusChangeRecord = {
  requestId: string;
  from: RequestStatus;
  to: RequestStatus;
  actorId: string;
  reason: string | null;
};

export type TransitionResult =
  { ok: true; change: StatusChangeRecord } | { ok: false; error: TransitionError };

/** Who, relative to a request, may perform a move. */
type Party = "owner" | "assignedReferrer";

const { PENDING, APPROVED, DECLINED, REFERRED, INTERVIEWING, OFFER, CLOSED } = RequestStatus;

/**
 * The single source of truth for the request lifecycle (see docs/architecture.md):
 * `RULES[from][to]` lists the parties allowed to make that move. A status with no entry is
 * terminal.
 */
const RULES: Partial<Record<RequestStatus, Partial<Record<RequestStatus, Party[]>>>> = {
  [PENDING]: {
    [APPROVED]: ["assignedReferrer"],
    [DECLINED]: ["assignedReferrer"],
    [CLOSED]: ["owner"],
  },
  [APPROVED]: {
    [REFERRED]: ["assignedReferrer"],
    [CLOSED]: ["owner", "assignedReferrer"],
  },
  [REFERRED]: {
    [INTERVIEWING]: ["assignedReferrer"],
    [CLOSED]: ["assignedReferrer"],
  },
  [INTERVIEWING]: {
    [OFFER]: ["assignedReferrer"],
    [CLOSED]: ["assignedReferrer"],
  },
};

export function isTerminal(status: RequestStatus): boolean {
  return RULES[status] === undefined;
}

function partyOf(request: RequestRef, actor: Actor): Party | null {
  if (actor.role === Role.CANDIDATE && actor.id === request.candidateId) return "owner";
  if (actor.role === Role.REFERRER && actor.id === request.referrerId) return "assignedReferrer";
  return null;
}

export function transition(
  request: RequestRef,
  actor: Actor,
  to: RequestStatus,
  options: { reason?: string } = {},
): TransitionResult {
  const edges = RULES[request.status];
  if (!edges) return { ok: false, error: "TERMINAL_STATUS" };

  const allowedParties = edges[to];
  if (!allowedParties) return { ok: false, error: "INVALID_TRANSITION" };

  const party = partyOf(request, actor);
  if (!party || !allowedParties.includes(party)) return { ok: false, error: "FORBIDDEN" };

  const reason = options.reason?.trim() || null;
  if (to === DECLINED && !reason) return { ok: false, error: "REASON_REQUIRED" };

  return {
    ok: true,
    change: { requestId: request.id, from: request.status, to, actorId: actor.id, reason },
  };
}

/** Statuses `actor` may move `request` to, in pipeline order. Use it to decide which buttons to show. */
export function allowedTransitions(request: RequestRef, actor: Actor): RequestStatus[] {
  const party = partyOf(request, actor);
  if (!party) return [];
  const edges = RULES[request.status] ?? {};
  return (Object.keys(edges) as RequestStatus[]).filter((to) => edges[to]?.includes(party));
}
