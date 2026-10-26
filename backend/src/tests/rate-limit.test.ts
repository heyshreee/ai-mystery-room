import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../middleware/rate-limit.js";
import { AppError } from "../utils/errors.js";

function testApp(max: number, now: () => number) {
  const app = express();
  app.get(
    "/limited",
    createRateLimiter({
      windowMs: 1_000,
      max,
      keyPrefix: "test",
      now,
    }),
    (_req, res) => {
      res.json({ ok: true });
    },
  );
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ code: error.code });
        return;
      }
      res.status(500).json({ code: "INTERNAL_ERROR" });
    },
  );
  return app;
}

describe("rate limiter", () => {
  it("allows requests up to the limit and rejects the next one", async () => {
    let timestamp = 1_000;
    const app = testApp(2, () => timestamp);

    await request(app).get("/limited").expect(200);
    await request(app).get("/limited").expect(200);
    const blocked = await request(app).get("/limited").expect(429);

    expect(blocked.body.code).toBe("RATE_LIMITED");
    expect(blocked.headers["ratelimit-limit"]).toBe("2");
    expect(blocked.headers["ratelimit-remaining"]).toBe("0");
    expect(blocked.headers["retry-after"]).toBeDefined();

    timestamp += 1_001;
    await request(app).get("/limited").expect(200);
  });
});
