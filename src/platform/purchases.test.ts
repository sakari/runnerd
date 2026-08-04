import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockConfigure,
  mockSetLogLevel,
  mockGetOfferings,
  mockPurchasePackage,
  mockGetCustomerInfo,
  mockRestorePurchases,
  mockAddListener,
  mockRemoveListener,
} = vi.hoisted(() => ({
  mockConfigure: vi.fn(),
  mockSetLogLevel: vi.fn(() => Promise.resolve()),
  mockGetOfferings: vi.fn(),
  mockPurchasePackage: vi.fn(),
  mockGetCustomerInfo: vi.fn(),
  mockRestorePurchases: vi.fn(),
  mockAddListener: vi.fn(),
  mockRemoveListener: vi.fn(),
}));

vi.mock("react-native-purchases", () => ({
  // The SDK exposes Purchases as a default export.
  default: {
    configure: mockConfigure,
    setLogLevel: mockSetLogLevel,
    getOfferings: mockGetOfferings,
    purchasePackage: mockPurchasePackage,
    getCustomerInfo: mockGetCustomerInfo,
    restorePurchases: mockRestorePurchases,
    addCustomerInfoUpdateListener: mockAddListener,
    removeCustomerInfoUpdateListener: mockRemoveListener,
  },
  LOG_LEVEL: { DEBUG: "DEBUG" },
}));

import {
  configurePurchases,
  getCurrentOffering,
  isConfigured,
  onCustomerInfoChange,
  purchaseTip,
  refreshCustomerInfo,
  restoreTip,
  resetForTests,
} from "./purchases";

const pkg = { identifier: "tip" } as never;

beforeEach(() => {
  vi.clearAllMocks();
  resetForTests();
});

describe("configurePurchases", () => {
  it("does not configure the SDK without an API key", () => {
    expect(configurePurchases("", false)).toBe(false);

    expect(mockConfigure).not.toHaveBeenCalled();
    expect(isConfigured()).toBe(false);
  });

  it("configures the SDK with the given key", () => {
    expect(configurePurchases("test_abc", false)).toBe(true);

    expect(mockConfigure).toHaveBeenCalledWith({ apiKey: "test_abc" });
    expect(isConfigured()).toBe(true);
  });

  it("returns false when the native module is missing", () => {
    // Purchases.configure throws synchronously when the app has not been
    // rebuilt since the dependency was added. It must not escape into App's
    // effect, where there is no error boundary above it.
    // Once: clearAllMocks resets calls but keeps implementations, so a
    // persistent throw here would break every later test.
    mockConfigure.mockImplementationOnce(() => {
      throw new Error("react-native-purchases native module not found");
    });

    expect(configurePurchases("test_abc", false)).toBe(false);
    expect(isConfigured()).toBe(false);
  });

  it("survives a rejected setLogLevel", () => {
    mockSetLogLevel.mockReturnValueOnce(Promise.reject(new Error("no native module")));

    expect(configurePurchases("test_abc", true)).toBe(true);
  });

  it("enables debug logging only when asked", () => {
    configurePurchases("test_abc", false);
    expect(mockSetLogLevel).not.toHaveBeenCalled();

    resetForTests();
    configurePurchases("test_abc", true);
    expect(mockSetLogLevel).toHaveBeenCalledWith("DEBUG");
  });
});

describe("getCurrentOffering", () => {
  it("returns null when unconfigured", async () => {
    await expect(getCurrentOffering()).resolves.toBeNull();

    expect(mockGetOfferings).not.toHaveBeenCalled();
  });

  it("returns the current offering", async () => {
    const current = { availablePackages: [pkg] };
    mockGetOfferings.mockResolvedValue({ current });
    configurePurchases("test_abc", false);

    await expect(getCurrentOffering()).resolves.toBe(current);
  });

  it("returns null when the store is unreachable", async () => {
    mockGetOfferings.mockRejectedValue(new Error("offline"));
    configurePurchases("test_abc", false);

    await expect(getCurrentOffering()).resolves.toBeNull();
  });

  it("returns null when there is no current offering", async () => {
    mockGetOfferings.mockResolvedValue({});
    configurePurchases("test_abc", false);

    await expect(getCurrentOffering()).resolves.toBeNull();
  });
});

describe("purchaseTip", () => {
  it("reports thanks on success", async () => {
    mockPurchasePackage.mockResolvedValue({});

    await expect(purchaseTip(pkg)).resolves.toBe("thanks");
    expect(mockPurchasePackage).toHaveBeenCalledWith(pkg);
  });

  it("reports a cancellation", async () => {
    mockPurchasePackage.mockRejectedValue({ userCancelled: true });

    await expect(purchaseTip(pkg)).resolves.toBe("cancelled");
  });

  it("reports a pending payment", async () => {
    mockPurchasePackage.mockRejectedValue({ code: "20" });

    await expect(purchaseTip(pkg)).resolves.toBe("pending");
  });

  it("reports a failure", async () => {
    mockPurchasePackage.mockRejectedValue({ code: "2" });

    await expect(purchaseTip(pkg)).resolves.toBe("failed");
  });

  it("reports a failure when the SDK was never configured", async () => {
    // purchaseTip has no `configured` guard: the SDK's own throwIfNotConfigured
    // rejects, and that classifies as a failure. Documented rather than relied
    // on silently.
    mockPurchasePackage.mockRejectedValue(new Error("There is no singleton instance"));

    await expect(purchaseTip(pkg)).resolves.toBe("failed");
  });
});

describe("refreshCustomerInfo", () => {
  it("returns null when unconfigured", async () => {
    await expect(refreshCustomerInfo()).resolves.toBeNull();

    expect(mockGetCustomerInfo).not.toHaveBeenCalled();
  });

  it("returns customer info", async () => {
    const info = { entitlements: { active: {} } };
    mockGetCustomerInfo.mockResolvedValue(info);
    configurePurchases("test_abc", false);

    await expect(refreshCustomerInfo()).resolves.toBe(info);
  });

  it("returns null when the lookup fails", async () => {
    mockGetCustomerInfo.mockRejectedValue(new Error("offline"));
    configurePurchases("test_abc", false);

    await expect(refreshCustomerInfo()).resolves.toBeNull();
  });
});

describe("restoreTip", () => {
  it("returns null when unconfigured", async () => {
    await expect(restoreTip()).resolves.toBeNull();

    expect(mockRestorePurchases).not.toHaveBeenCalled();
  });

  it("returns the restored customer info", async () => {
    const info = { entitlements: { active: {} } };
    mockRestorePurchases.mockResolvedValue(info);
    configurePurchases("test_abc", false);

    await expect(restoreTip()).resolves.toBe(info);
  });

  it("returns null when the restore fails", async () => {
    mockRestorePurchases.mockRejectedValue(new Error("no receipt"));
    configurePurchases("test_abc", false);

    await expect(restoreTip()).resolves.toBeNull();
  });
});

describe("onCustomerInfoChange", () => {
  it("does not subscribe when unconfigured", () => {
    const unsubscribe = onCustomerInfoChange(() => {});
    unsubscribe();

    expect(mockAddListener).not.toHaveBeenCalled();
    expect(mockRemoveListener).not.toHaveBeenCalled();
  });

  it("subscribes the listener", () => {
    const listener = vi.fn();
    configurePurchases("test_abc", false);

    onCustomerInfoChange(listener);

    expect(mockAddListener).toHaveBeenCalledWith(listener);
  });

  it("unsubscribes the listener", () => {
    const listener = vi.fn();
    configurePurchases("test_abc", false);

    onCustomerInfoChange(listener)();

    expect(mockRemoveListener).toHaveBeenCalledWith(listener);
  });
});
