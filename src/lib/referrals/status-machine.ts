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
  _options: { reason?: string } = {},
): TransitionResult {
  const edges = RULES[request.status];
  if (!edges) return { ok: false, error: "TERMINAL_STATUS" };

  const allowedParties = edges[to];
  if (!allowedParties) return { ok: false, error: "INVALID_TRANSITION" };

  const party = partyOf(request, actor);
  if (!party || !allowedParties.includes(party)) return { ok: false, error: "FORBIDDEN" };

  return { ok: true };
}
