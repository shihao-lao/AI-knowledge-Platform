import { Request, Response, NextFunction } from 'express';
import { error as errorResponse } from '../utils/response.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error(err.stack);
  const status = (err as any).status || 500;
  const message = err.message || 'Internal Server Error';
  errorResponse(res, message, status);
}

export function notFoundHandler(_req: Request, res: Response): void {
  errorResponse(res, 'Route not found', 404);
}
