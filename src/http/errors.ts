import { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { DomainConflictError } from "../domain/DomainConflictError";
import { BattleError } from "../services/BattleService";

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export function asyncRoute(
  handler: (request: Parameters<import("express").RequestHandler>[0], response: Parameters<import("express").RequestHandler>[1]) => Promise<unknown>
): import("express").RequestHandler {
  return (request, response, next) => {
    void handler(request, response).catch(next);
  };
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ApiError) {
    response.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof BattleError) {
    response.status(409).json({ error: error.message });
    return;
  }
  if (error instanceof DomainConflictError) {
    response.status(409).json({ error: error.message });
    return;
  }
  if (error instanceof ZodError) {
    response.status(400).json({
      error: "Données invalides.",
      details: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message
      }))
    });
    return;
  }
  if (typeof error === "object" && error !== null && "code" in error) {
    const databaseError = error as { code: string };
    if (databaseError.code === "23505") {
      response.status(409).json({ error: "Cette ressource existe déjà ou cette relation est en double." });
      return;
    }
    if (databaseError.code === "23503") {
      response.status(409).json({ error: "La ressource est utilisée par une autre ressource." });
      return;
    }
  }

  console.error(error);
  response.status(500).json({ error: "Une erreur interne est survenue." });
};
