// FRPB — shared API envelope types.

export type HttpStatus = number;

export interface ApiEnvelope<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface ListLicensesItem {
  id: string;
  key: string;
  plan: string;
  planName: string;
  status: string;
  expiresAt: string | null;
  deviceLimit: number;
  devicesUsed: number;
  createdAt: string;
}

export interface ListLicensesResponse extends ApiEnvelope {
  data?: {
    licenses: ListLicensesItem[];
  };
}

export interface DashboardDeviceItem {
  id: string;
  deviceName: string;
  status: string;
  lastSeenAt: string;
  unboundAt: string | null;
  unbindCount: number;
}

export interface UnbindResponse extends ApiEnvelope {
  data?: {
    availableAt?: string;
  };
}

export interface HealthResponse {
  status: "ok";
  service: string;
  timestamp: string;
}
