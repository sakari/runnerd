import { describe, it, expect } from "vitest";
import type { CustomerInfo, PurchasesOffering } from "react-native-purchases";
import {
  SUPPORTER_ENTITLEMENT,
  REVENUECAT_TEST_KEY,
  apiKeyForBuild,
  classifyPurchaseError,
  formatSupporterSince,
  isTestStoreKey,
  productionApiKey,
  supporterState,
  tipPackage,
} from "./tips";

function customerInfo(
  active: Record<string, { originalPurchaseDate: string }>,
  nonSubscriptionTransactions: unknown[] = [],
): CustomerInfo {
  return { entitlements: { active }, nonSubscriptionTransactions } as unknown as CustomerInfo;
}

function offering(packages: unknown[]): PurchasesOffering {
  return { availablePackages: packages } as unknown as PurchasesOffering;
}

describe("supporterState", () => {
  it("is unknown before CustomerInfo has loaded", () => {
    expect(supporterState(null)).toEqual({ kind: "unknown" });
  });

  it("is none when the supporter entitlement is absent", () => {
    expect(supporterState(customerInfo({}))).toEqual({ kind: "none" });
  });

  it("is unknown for a CustomerInfo missing its entitlements", () => {
    // Shape crosses the native bridge; hide the widget rather than crash.
    expect(supporterState({} as never)).toEqual({ kind: "unknown" });
    expect(supporterState({ entitlements: {} } as never)).toEqual({ kind: "unknown" });
    expect(supporterState(undefined as never)).toEqual({ kind: "unknown" });
  });

  it("ignores unrelated active entitlements", () => {
    const info = customerInfo({ something_else: { originalPurchaseDate: "2026-03-04" } });

    expect(supporterState(info)).toEqual({ kind: "none" });
  });

  it("is supporter with the original purchase date", () => {
    const info = customerInfo({
      [SUPPORTER_ENTITLEMENT]: { originalPurchaseDate: "2026-03-04T10:00:00Z" },
    });

    const state = supporterState(info);

    expect(state.kind).toBe("supporter");
    expect(state.kind === "supporter" && state.since?.toISOString()).toBe(
      "2026-03-04T10:00:00.000Z",
    );
  });

  it("is supporter with a null date when the date is unparseable", () => {
    const info = customerInfo({ [SUPPORTER_ENTITLEMENT]: { originalPurchaseDate: "nonsense" } });

    expect(supporterState(info)).toEqual({ kind: "supporter", since: null });
  });

  it("is supporter from purchase history when no entitlement is configured", () => {
    // The dashboard may have no `supporter` entitlement, or one under another
    // name. The purchase still happened, so the badge must still appear.
    const info = customerInfo({}, [
      { productIdentifier: "tip", purchaseDate: "2026-05-02T09:00:00Z" },
    ]);

    expect(supporterState(info)).toEqual({
      kind: "supporter",
      since: new Date("2026-05-02T09:00:00Z"),
    });
  });

  it("uses the earliest purchase when there are several", () => {
    const info = customerInfo({}, [
      { purchaseDate: "2026-06-01T00:00:00Z" },
      { purchaseDate: "2026-04-01T00:00:00Z" },
      { purchaseDate: "2026-05-01T00:00:00Z" },
    ]);

    expect(supporterState(info)).toEqual({
      kind: "supporter",
      since: new Date("2026-04-01T00:00:00Z"),
    });
  });

  it("is supporter with a null date when purchase dates are unusable", () => {
    expect(supporterState(customerInfo({}, [{ purchaseDate: null }]))).toEqual({
      kind: "supporter",
      since: null,
    });
  });

  it("prefers the entitlement date over purchase history", () => {
    const info = customerInfo(
      { [SUPPORTER_ENTITLEMENT]: { originalPurchaseDate: "2026-03-04T10:00:00Z" } },
      [{ purchaseDate: "2026-05-02T09:00:00Z" }],
    );

    expect(supporterState(info)).toEqual({
      kind: "supporter",
      since: new Date("2026-03-04T10:00:00Z"),
    });
  });

  it("is supporter with a null date for a non-string purchase date", () => {
    // new Date(null) is epoch 0, not Invalid Date — it would read "January 1970".
    for (const raw of [null, undefined, 0]) {
      const info = customerInfo({
        [SUPPORTER_ENTITLEMENT]: { originalPurchaseDate: raw },
      } as never);

      expect(supporterState(info)).toEqual({ kind: "supporter", since: null });
    }
  });
});

describe("formatSupporterSince", () => {
  it("formats as month and year", () => {
    expect(formatSupporterSince(new Date("2026-03-04T10:00:00Z"), "en-US")).toBe("March 2026");
  });
});

describe("tipPackage", () => {
  it("returns null when there is no offering", () => {
    expect(tipPackage(null)).toBeNull();
  });

  it("returns null when the offering has no packages", () => {
    expect(tipPackage(offering([]))).toBeNull();
  });

  it("returns null when the offering has no availablePackages field", () => {
    expect(tipPackage({} as never)).toBeNull();
  });

  it("returns the single package", () => {
    const pkg = { identifier: "tip" };

    expect(tipPackage(offering([pkg]))).toBe(pkg);
  });

  it("returns the first package when the dashboard has more than one", () => {
    const first = { identifier: "tip" };

    expect(tipPackage(offering([first, { identifier: "other" }]))).toBe(first);
  });
});

describe("classifyPurchaseError", () => {
  it("treats the deprecated userCancelled flag as a cancellation", () => {
    expect(classifyPurchaseError({ userCancelled: true })).toBe("cancelled");
  });

  it("treats the cancellation code as a cancellation", () => {
    expect(classifyPurchaseError({ code: "1" })).toBe("cancelled");
  });

  it("treats the readable cancellation code as a cancellation", () => {
    expect(classifyPurchaseError({ readableErrorCode: "PURCHASE_CANCELLED_ERROR" })).toBe(
      "cancelled",
    );
  });

  it("reads the readable code from userInfo when the top-level one is absent", () => {
    expect(
      classifyPurchaseError({ userInfo: { readableErrorCode: "PURCHASE_CANCELLED_ERROR" } }),
    ).toBe("cancelled");
    expect(
      classifyPurchaseError({ userInfo: { readableErrorCode: "PAYMENT_PENDING_ERROR" } }),
    ).toBe("pending");
  });

  it("matches the shape the SDK actually rejects with", () => {
    // react-native-purchases sets userCancelled from code === "1" and rethrows.
    const cancelled = Object.assign(new Error("cancelled"), {
      code: "1",
      userCancelled: true,
      readableErrorCode: "PURCHASE_CANCELLED_ERROR",
      userInfo: { readableErrorCode: "PURCHASE_CANCELLED_ERROR" },
    });
    expect(classifyPurchaseError(cancelled)).toBe("cancelled");

    const network = Object.assign(new Error("net"), {
      code: "10",
      userCancelled: false,
      readableErrorCode: "NETWORK_ERROR",
      userInfo: { readableErrorCode: "NETWORK_ERROR" },
    });
    expect(classifyPurchaseError(network)).toBe("failed");
  });

  it("treats a pending payment as pending", () => {
    expect(classifyPurchaseError({ code: "20" })).toBe("pending");
    expect(classifyPurchaseError({ readableErrorCode: "PAYMENT_PENDING_ERROR" })).toBe("pending");
  });

  it("treats an already-owned product as thanks", () => {
    expect(classifyPurchaseError({ code: "6" })).toBe("thanks");
    expect(classifyPurchaseError({ readableErrorCode: "PRODUCT_ALREADY_PURCHASED_ERROR" })).toBe(
      "thanks",
    );
  });

  it("treats anything else as a failure", () => {
    expect(classifyPurchaseError({ code: "10" })).toBe("failed");
    expect(classifyPurchaseError({ userCancelled: false })).toBe("failed");
    expect(classifyPurchaseError(new Error("boom"))).toBe("failed");
  });

  it("survives non-object rejections", () => {
    expect(classifyPurchaseError(null)).toBe("failed");
    expect(classifyPurchaseError("nope")).toBe("failed");
    expect(classifyPurchaseError(undefined)).toBe("failed");
  });
});

describe("apiKeyForBuild", () => {
  it("withholds a Test Store key when the build disallows it", () => {
    // The SDK alerts and crashes on a test_ key outside a debug build, by
    // design — so it must never reach configure() there.
    expect(apiKeyForBuild("test_abc123", false)).toBe("");
  });

  it("passes a Test Store key through when the build allows it", () => {
    expect(apiKeyForBuild("test_abc123", true)).toBe("test_abc123");
  });

  it("passes a store key through either way", () => {
    expect(apiKeyForBuild("appl_abc123", false)).toBe("appl_abc123");
    expect(apiKeyForBuild("appl_abc123", true)).toBe("appl_abc123");
  });

  it("keeps an empty key empty", () => {
    expect(apiKeyForBuild("", false)).toBe("");
  });

  it("never hands the committed key to a plain Release build", () => {
    expect(apiKeyForBuild(REVENUECAT_TEST_KEY, false)).toBe("");
  });
});

describe("API key handling", () => {
  it("recognises Test Store keys", () => {
    expect(isTestStoreKey("test_abc123")).toBe(true);
    expect(isTestStoreKey("appl_abc123")).toBe(false);
  });

  it("refuses a Test Store key on the production path", () => {
    expect(() => productionApiKey("test_abc123")).toThrow(/Test Store key/);
  });

  it("refuses an empty key on the production path", () => {
    expect(() => productionApiKey("")).toThrow(/Missing/);
  });

  it("accepts a store key on the production path", () => {
    expect(productionApiKey("appl_abc123")).toBe("appl_abc123");
  });

  it("keeps the committed key out of production builds", () => {
    // The committed key must be either unset or a Test Store key — never a
    // real store key. Asserting the message keeps this honest about which
    // branch it actually exercises.
    expect(REVENUECAT_TEST_KEY === "" || isTestStoreKey(REVENUECAT_TEST_KEY)).toBe(true);
    expect(() => productionApiKey(REVENUECAT_TEST_KEY)).toThrow(
      REVENUECAT_TEST_KEY === "" ? /Missing/ : /Test Store key/,
    );
  });
});
