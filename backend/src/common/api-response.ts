export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export function apiResponse<T>(message: string, data: T): ApiResponse<T> {
  return {
    success: true,
    message,
    data,
  };
}
