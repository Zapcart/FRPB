// FRPB — Admin dashboard analytics types.
// Returned by GET /api/v1/admin/analytics (server-side only).

export interface AdminAnalyticsResponse {
  visitors: {
    total30d: number;
    returning30d: number;
  };
  logins: {
    total30d: number;
  };
  licenses: {
    total: number;
    active: number;
    expired: number;
    revoked: number;
    pending: number;
    deviceSlotsUsed: number;
    deviceSlotsTotal: number;
  };
  frp: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    processing: number;
    successRate: number; // 0..100
  };
  frpByBrand: {
    brand: string;
    total: number;
    completed: number;
    failed: number;
    successRate: number;
  }[];
  frpByAndroidVersion: {
    version: string;
    total: number;
    completed: number;
    failed: number;
    successRate: number;
  }[];
  recentFrp: {
    id: string;
    brand: string;
    model: string;
    androidVersion: string | null;
    status: string;
    requestedAt: string;
  }[];
  recentLicenses: {
    id: string;
    key: string;
    planName: string;
    status: string;
    userEmail: string;
    createdAt: string;
  }[];
  revenue: {
    totalRevenue: number;
    successfulRevenue: number;
    failedRevenue: number;
    currency: string;
    plans: {
      name: string;
      sold: number;
      revenue: number;
    }[];
  };
}

export interface AdminQueryResult {
  visitors: { total30d: number; returning30d: number };
  logins: { total30d: number };
  licenses: { total: number; active: number; expired: number; revoked: number; pending: number; deviceSlotsUsed: number; deviceSlotsTotal: number };
  frp: { total: number; completed: number; failed: number; pending: number; processing: number; successRate: number };
  frpByBrand: { brand: string; total: number; completed: number; failed: number; successRate: number }[];
  frpByAndroidVersion: { version: string; total: number; completed: number; failed: number; successRate: number }[];
  recentFrp: { id: string; brand: string; model: string; androidVersion: string | null; status: string; requestedAt: string }[];
  recentLicenses: { id: string; key: string; planName: string; status: string; userEmail: string; createdAt: string }[];
  revenue: { totalRevenue: number; successfulRevenue: number; failedRevenue: number; currency: string; plans: { name: string; sold: number; revenue: number }[] };
}
