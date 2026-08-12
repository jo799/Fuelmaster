import type { Request, Response, NextFunction, RequestHandler } from "express";

export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error(err);
  if (typeof err?.message === "string" && err.message.startsWith("CORS:")) {
    return res.status(403).json({ error: "Origin not allowed" });
  }
  const status = err.status ?? 500;
  // Only ever surface an error's own message when it explicitly opted in via
  // `expose` (i.e. it's one of our own HttpError instances with a message
  // written for the client). Anything else \u2014 a library throwing an
  // unexpected shape, a DB driver error, etc. \u2014 could otherwise leak
  // internal details (queries, file paths, stack fragments) to the client.
  const message = err.expose === true ? err.message : "An unexpected error occurred";
  res.status(status).json({ error: message });
}

export class HttpError extends Error {
  status: number;
  expose = true;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}