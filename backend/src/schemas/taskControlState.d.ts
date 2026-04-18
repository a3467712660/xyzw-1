export declare const TASK_CONTROL_MAX_ROWS: number;
export declare const TASK_CONTROL_MAX_TOKEN_IDS_PER_TASK: number;
export declare const TASK_CONTROL_MAX_MAP_ITEMS: number;

export declare const taskControlTaskRowSchema: unknown;
export declare const taskControlStateBodySchema: unknown;

export declare const parseTaskControlRowsFromPayload: (payloadJson: string) => unknown[];
export declare const isAllowedTaskControlWsHostname: (
  hostname: string,
  allowlist?: string[],
) => boolean;
export declare const sanitizeTaskControlWsUrl: (
  wsUrl: string,
  options?: {
    allowCustom?: boolean;
    allowlist?: string[];
  },
) => string;
