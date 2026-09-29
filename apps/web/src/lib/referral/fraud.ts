// FRPB — self-referral / abuse detection (pure, dependency-free).
//
// Blocks a user from farming their own referral credits using identical IP
// addresses, device fingerprints, or (payment) identities.

export interface FraudSignals {
  referrerUserId?: string | null;
  referredUserId?: string | null;
  referrerEmail?: string | null;
  referredEmail?: string | null;
  referrerIpHash?: string | null;
  referredIpHash?: string | null;
  referrerDeviceHash?: string | null;
  referredDeviceHash?: string | null;
}

export interface FraudVerdict {
  blocked: boolean;
  reasons: string[];
}

function sameNonEmpty(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Detect self-referral fraud from identity + fingerprint signals. */
export function detectSelfReferral(signals: FraudSignals): FraudVerdict {
  const reasons: string[] = [];

  if (
    signals.referrerUserId &&
    signals.referredUserId &&
    signals.referrerUserId === signals.referredUserId
  ) {
    reasons.push("same_user");
  }
  if (sameNonEmpty(signals.referrerEmail, signals.referredEmail)) {
    reasons.push("same_email");
  }
  if (sameNonEmpty(signals.referrerIpHash, signals.referredIpHash)) {
    reasons.push("same_ip");
  }
  if (sameNonEmpty(signals.referrerDeviceHash, signals.referredDeviceHash)) {
    reasons.push("same_device");
  }

  return { blocked: reasons.length > 0, reasons };
}

/** Convenience boolean wrapper. */
export function isSelfReferral(signals: FraudSignals): boolean {
  return detectSelfReferral(signals).blocked;
}
