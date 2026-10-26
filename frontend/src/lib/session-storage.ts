const KEY_PREFIX = "amr:session:";

function keyFor(caseId: string): string {
  return `${KEY_PREFIX}${caseId}`;
}

export function readStoredSessionId(caseId: string): string | null {
  try {
    return window.sessionStorage.getItem(keyFor(caseId));
  } catch {
    return null;
  }
}

export function storeSessionId(caseId: string, sessionId: string): void {
  try {
    window.sessionStorage.setItem(keyFor(caseId), sessionId);
  } catch {
    // Session resume is a convenience; the HttpOnly cookie remains authoritative.
  }
}

export function clearStoredSessionId(caseId: string): void {
  try {
    window.sessionStorage.removeItem(keyFor(caseId));
  } catch {
    // Ignore storage restrictions.
  }
}
