export interface ApiErrorPayload {
  code?: string;
  message?: string;
}

export interface ApiEnvelope<TData = unknown> {
  success: boolean;
  data?: TData;
  message?: string;
  error?: ApiErrorPayload;
  [key: string]: unknown;
}

export type ApiRuntimeModule = typeof import("./index.runtime.js").default;
