import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

type ErrorResponse = {
  success: false;
  message: string | string[];
  error: string;
  statusCode: number;
  timestamp: string;
  path: string;
  [key: string]: unknown;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode: HttpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const errorBody =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as Record<string, unknown>)
        : null;

    const body: ErrorResponse = {
      success: false,
      message: this.getMessage(exception, errorBody),
      error: this.getError(statusCode, errorBody),
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...this.getExtraErrorFields(errorBody),
    };

    response.status(statusCode).json(body);
  }

  private getMessage(
    exception: unknown,
    errorBody: Record<string, unknown> | null,
  ) {
    if (Array.isArray(errorBody?.message)) {
      return errorBody.message.filter((message) => typeof message === 'string');
    }

    if (typeof errorBody?.message === 'string') {
      return errorBody.message;
    }

    if (exception instanceof Error && exception.message) {
      return exception.message;
    }

    return 'Internal server error.';
  }

  private getError(
    statusCode: HttpStatus,
    errorBody: Record<string, unknown> | null,
  ) {
    if (typeof errorBody?.error === 'string') {
      return errorBody.error;
    }

    return statusCode === HttpStatus.INTERNAL_SERVER_ERROR
      ? 'Internal Server Error'
      : 'Request Error';
  }

  private getExtraErrorFields(errorBody: Record<string, unknown> | null) {
    if (!errorBody) {
      return {};
    }

    const reservedFields = new Set(['message', 'error', 'statusCode']);

    return Object.fromEntries(
      Object.entries(errorBody).filter(([key]) => !reservedFields.has(key)),
    );
  }
}
