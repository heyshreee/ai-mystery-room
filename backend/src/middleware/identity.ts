import type { NextFunction, Request, Response } from "express";
import { generateOpaqueToken, guestTokenHash } from "../utils/hash.js";
import {
  GUEST_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@amr/shared";
import type { AppConfig } from "../config/env.js";

export interface SessionCredential {
  sessionId: string;
  token: string;
}

export interface RequestContext {
  requestId: string;
  guestToken: string;
  guestHash: string;
  sessionCredential?: SessionCredential;
}

const BASE64URL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SESSION_COOKIE_PATTERN = /^([a-f0-9]{24})\.([A-Za-z0-9_-]{43})$/i;

export function getRequestContext(res: Response): RequestContext {
  return res.locals as unknown as RequestContext;
}

export function getGuestContext(res: Response): Pick<RequestContext, "guestHash" | "guestToken"> {
  const context = getRequestContext(res);
  return { guestHash: context.guestHash, guestToken: context.guestToken };
}

export function parseSessionCookie(cookieValue: unknown): SessionCredential | undefined {
  if (typeof cookieValue !== "string") {
    return undefined;
  }
  const match = SESSION_COOKIE_PATTERN.exec(cookieValue);
  if (!match?.[1] || !match[2]) {
    return undefined;
  }
  return { sessionId: match[1], token: match[2] };
}

export function guestIdentityMiddleware(config: AppConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const existing = req.cookies?.[GUEST_COOKIE_NAME];
      const validExisting =
        typeof existing === "string" && BASE64URL_TOKEN_PATTERN.test(existing);
      const guestToken = validExisting ? existing : generateOpaqueToken();
      const sessionCredential = parseSessionCookie(req.cookies?.[SESSION_COOKIE_NAME]);

      res.locals.guestToken = guestToken;
      res.locals.guestHash = guestTokenHash(config.sessionSecret, guestToken);
      res.locals.sessionCredential = sessionCredential;

      if (!validExisting) {
        res.cookie(GUEST_COOKIE_NAME, guestToken, {
          httpOnly: true,
          secure: config.isProduction,
          sameSite: "lax",
          path: "/api",
          maxAge: config.guestCookieTtlMs,
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function setSessionCookie(
  res: Response,
  config: AppConfig,
  sessionId: string,
  token: string,
): void {
  res.cookie(SESSION_COOKIE_NAME, `${sessionId}.${token}`, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    path: "/api",
    maxAge: config.sessionTtlMs,
  });
}

export function clearSessionCookie(res: Response, config: AppConfig): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    path: "/api",
  });
}
