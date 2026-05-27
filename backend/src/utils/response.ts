import { Response } from 'express';

export interface ApiResponse<T> {
  code: number;
  data: T;
  message?: string;
}

export function success<T>(res: Response, data: T): void {
  res.json({ code: 0, data });
}

export function created<T>(res: Response, data: T): void {
  res.status(201).json({ code: 0, data });
}

export function error(res: Response, message: string, status = 500): void {
  res.status(status).json({ code: 1, data: null, message });
}

export function notFound(res: Response, message = 'Resource not found'): void {
  error(res, message, 404);
}

export function badRequest(res: Response, message = 'Bad request'): void {
  error(res, message, 400);
}
