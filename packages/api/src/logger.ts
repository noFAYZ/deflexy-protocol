import { randomUUID } from "node:crypto";
import { pino, stdSerializers, type Logger } from "pino";
import type { MiddlewareHandler } from "hono";

const isProd = process.env.NODE_ENV === "production";

/** Root logger. Pretty + colorized in dev; line-delimited JSON in prod (ship to
 * Loki/Datadog/etc). Level via LOG_LEVEL (default info). */
export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "deflexy-api" },
  // Render Errors nicely (stack/type/message) if they land in a log object.
  serializers: { err: stdSerializers.err },
  ...(isProd
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true, // colors the level: INFO green, WARN yellow, ERROR red
            translateTime: "SYS:HH:MM:ss.l",
            ignore: "pid,hostname,service,reqId",
            // Short request id ahead of the message; full id stays queryable in
            // the JSON object. The level color already conveys 2xx/4xx/5xx.
            messageFormat: "{reqId}  {msg}",
          },
        },
      }),
});

// Hono context typing so handlers can pull the per-request child logger.
export type AppEnv = { Variables: { log: Logger; reqId: string } };

/**
 * Per-request structured logging with latency. Emits one line on completion:
 *   method, path, status, ms (wall-clock), response bytes, request id.
 * Level scales with status (2xx/3xx info, 4xx warn, 5xx error). Slow requests
 * (>1s) are tagged `slow: true` so they're trivially filterable.
 */
export const requestLogger = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  const start = performance.now();
  const reqId = c.req.header("x-request-id") ?? randomUUID();
  const log = logger.child({ reqId });
  c.set("reqId", reqId);
  c.set("log", log);
  c.header("x-request-id", reqId);

  const { method } = c.req;
  const path = c.req.path;

  try {
    await next();
  } catch (err) {
    const ms = +(performance.now() - start).toFixed(1);
    log.error({ method, path, status: 500, ms, err }, `${method} ${path} 500 ${ms}ms`);
    throw err;
  }

  const ms = +(performance.now() - start).toFixed(1);
  const status = c.res.status;
  const bytes = Number(c.res.headers.get("content-length")) || undefined;
  const slow = ms > 1000 || undefined;
  const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

  log[level]({ method, path, status, ms, bytes, slow }, `${method} ${path} ${status} ${ms}ms`);
};

/** Time an async block and return [result, ms] — for measuring slow externals
 * (Pinata). Accepts any thenable so SDK builders (not real Promises) work too. */
export async function timed<T>(fn: () => PromiseLike<T> | T): Promise<[Awaited<T>, number]> {
  const t = performance.now();
  const out = await fn();
  return [out, +(performance.now() - t).toFixed(1)];
}
