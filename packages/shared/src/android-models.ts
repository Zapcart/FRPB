// FRPB — shared Android model registry + USB vendor mapping.
// Mirrors apps/desktop/electron/utils/android-models.ts but exposed via
// the shared package so the desktop wizard and web app both consume it.

/** USB vendor ID → brand name mapping. */
export const ANDROID_VENDOR_IDS: Record<number, string> = {
  0x04e8: "Samsung",
  0x18d1: "Google",
  0x22d9: "OnePlus",
  0x2717: "Xiaomi",
  0x12d1: "Huawei",
  0x22b8: "Motorola",
  0x1004: "LG",
  0x054c: "Sony",
  0x0bb4: "HTC",
  0x2d95: "Vivo",
  0x2a70: "Realme",
  0x2e40: "OPPO",
  0x0e8d: "MediaTek",
  0x05c6: "Qualcomm",
};

/** Map a USB vendor ID to a brand name. */
export function brandFromVendorId(vendorId: number): string | undefined {
  return ANDROID_VENDOR_IDS[vendorId];
}

/** Curated model list (subset of the full desktop registry) — always allow manual entry. */
export const KNOWN_MODELS: string[] = [
  "Samsung Galaxy S24",
  "Samsung Galaxy S23",
  "Samsung Galaxy S22",
  "Samsung Galaxy S21",
  "Samsung Galaxy A54",
  "Samsung Galaxy A53",
  "Samsung Galaxy A34",
  "Samsung Galaxy A33",
  "Samsung Galaxy M34",
  "Samsung Galaxy M54",
  "Samsung Galaxy Note 20",
  "Samsung Galaxy Z Fold 4",
  "Samsung Galaxy Z Flip 4",
  "Xiaomi Redmi Note 12",
  "Xiaomi Redmi Note 13",
  "Xiaomi Redmi 12",
  "Xiaomi 13",
  "Xiaomi POCO X6",
  "Xiaomi POCO F5",
  "OnePlus 12",
  "OnePlus 11",
  "OnePlus Nord 3",
  "Oppo Reno 11",
  "Oppo A78",
  "realme 12",
  "realme C55",
  "Vivo Y200",
  "Vivo V29",
  "Motorola Moto G84",
  "Motorola Edge 40",
  "Google Pixel 8",
  "Google Pixel 8a",
  "Google Pixel 7 Pro",
  "Lenovo Tab M11",
  "TECNO Camon 30",
  "Infinix Hot 40",
  "itel S23",
  "Honor 90",
  "TCL 55C735",
  "Nothing Phone 2",
  "Nokia G42",
  "Sony Xperia 10 V",
  "HTC Desire 22 Pro",
  "LG V60",
  "Asus Zenfone 11",
  "Samsung Galaxy S25",
  "Samsung Galaxy S25 Ultra",
  "Xiaomi 14",
  "Xiaomi POCO F6",
  "OnePlus 13",
  "OnePlus Nord CE 4",
  "Oppo Find X8",
  "realme GT 6",
  "Vivo X200",
  "Motorola Razr 2024",
  "Google Pixel 9",
  "Google Pixel 9 Pro",
];

/** Return a copy of known models. Manual entry always allowed. */
export function listKnownModels(): string[] {
  return [...KNOWN_MODELS];
}
