import { randomBytes } from "node:crypto";

const ID_PATTERN = /^[a-f0-9]{24}$/i;

/**
 * Case, suspect, exhibit, session, and generation identifiers are stored as
 * 24-character hex strings. This preserves the existing public API and
 * session-cookie format while using `TEXT` primary keys in Postgres.
 */
export function newId(): string {
  return randomBytes(12).toString("hex");
}

export function isId(value: string): boolean {
  return ID_PATTERN.test(value);
}
