import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export function hashToken(secret: string, purpose: string, token: string): string {
  return createHmac("sha256", secret).update(`${purpose}:${token}`).digest("hex");
}

export function guestTokenHash(secret: string, token: string): string {
  return hashToken(secret, "guest", token);
}

export function sessionTokenHash(secret: string, token: string): string {
  return hashToken(secret, "session", token);
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}
