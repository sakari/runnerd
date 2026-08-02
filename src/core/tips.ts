import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from "react-native-purchases";

// Type-only imports above: pulling anything from react-native-purchases at
// runtime would load react-native, which is not available under vitest.

/** Entitlement identifier configured in the RevenueCat dashboard. */
export const SUPPORTER_ENTITLEMENT = "supporter";

/**
 * RevenueCat Test Store SDK key.
 *
 * This is a *public* client key: RevenueCat SDK keys ship inside the app binary
 * and can be extracted from any build, so committing it is not a secret leak.
 * The risk worth guarding against is the opposite one — a Test Store key
 * reaching a production build, where it would silently replace the payment
 * sheet with the simulator. `productionApiKey` below is that guard.
 *
 * Paste the `test_...` key from the RevenueCat dashboard here. While it is
 * empty the SDK is never configured and the tip UI stays hidden.
 */
export const REVENUECAT_TEST_KEY = "";

/** Outcome of a tip attempt, as the UI needs to render it. */
export type TipOutcome = "thanks" | "cancelled" | "pending" | "failed";

/**
 * The tip widget's three states. `unknown` is the pre-load state and renders
 * neither the tip button nor the badge — showing "none" before CustomerInfo
 * has resolved would flash the tip button at people who already paid.
 */
export type SupporterState =
  | { kind: "unknown" }
  | { kind: "none" }
  | { kind: "supporter"; since: Date | null };

// Mirrors PURCHASES_ERROR_CODE from the SDK. Duplicated as plain strings
// because importing the enum would pull the native module in (see above).
const CODE_CANCELLED = "1";
const CODE_ALREADY_PURCHASED = "6";
const CODE_PENDING = "20";
const READABLE_CANCELLED = "PURCHASE_CANCELLED_ERROR";
const READABLE_ALREADY_PURCHASED = "PRODUCT_ALREADY_PURCHASED_ERROR";
const READABLE_PENDING = "PAYMENT_PENDING_ERROR";

/** True for RevenueCat Test Store keys, which must never ship to production. */
export function isTestStoreKey(key: string): boolean {
  return key.startsWith("test_");
}

/**
 * Returns `key` for use in a production build, refusing Test Store keys.
 *
 * Not called anywhere yet — there is no production build path until a paid
 * Apple account exists. It exists so the accompanying test fails loudly if a
 * `test_` key is ever wired into one.
 */
export function productionApiKey(key: string): string {
  if (isTestStoreKey(key)) {
    throw new Error("Refusing to use a RevenueCat Test Store key in a production build");
  }
  if (key === "") {
    throw new Error("Missing RevenueCat API key");
  }
  return key;
}

/**
 * Derives the widget state from CustomerInfo. `null` means "not loaded yet"
 * rather than "not a supporter".
 */
export function supporterState(info: CustomerInfo | null): SupporterState {
  // Tolerates undefined and a malformed CustomerInfo as well as null: this
  // reads a shape that crosses the native bridge, so a missing `entitlements`
  // should hide the widget rather than crash the History screen.
  if (!info?.entitlements?.active) return { kind: "unknown" };

  const entitlement = info.entitlements.active[SUPPORTER_ENTITLEMENT];
  if (!entitlement) return { kind: "none" };

  const parsed = new Date(entitlement.originalPurchaseDate);
  const since = isNaN(parsed.getTime()) ? null : parsed;
  return { kind: "supporter", since };
}

/** Formats the supporter badge's date, e.g. "March 2026". */
export function formatSupporterSince(since: Date, locale?: string): string {
  return since.toLocaleDateString(locale, { month: "long", year: "numeric" });
}

/**
 * The single tip package from the current offering, or null when the offering
 * is missing or empty — offline and misconfigured are ordinary states here,
 * not exceptions.
 */
export function tipPackage(offering: PurchasesOffering | null): PurchasesPackage | null {
  return offering?.availablePackages?.[0] ?? null;
}

/**
 * Maps a rejected purchase into a `TipOutcome`.
 *
 * "Already purchased" counts as thanks: the entitlement is genuinely owned, and
 * the caller refreshes CustomerInfo afterwards, so the badge appears either way.
 */
export function classifyPurchaseError(error: unknown): TipOutcome {
  if (typeof error !== "object" || error === null) return "failed";

  const e = error as {
    code?: unknown;
    readableErrorCode?: unknown;
    userInfo?: { readableErrorCode?: unknown };
    userCancelled?: unknown;
  };
  const code = typeof e.code === "string" ? e.code : "";
  // Top-level readableErrorCode is deprecated in favour of the userInfo copy;
  // read both so this keeps working whichever one the SDK populates.
  const readable =
    typeof e.readableErrorCode === "string"
      ? e.readableErrorCode
      : typeof e.userInfo?.readableErrorCode === "string"
        ? e.userInfo.readableErrorCode
        : "";

  if (e.userCancelled === true) return "cancelled";
  if (code === CODE_CANCELLED || readable === READABLE_CANCELLED) return "cancelled";
  if (code === CODE_PENDING || readable === READABLE_PENDING) return "pending";
  if (code === CODE_ALREADY_PURCHASED || readable === READABLE_ALREADY_PURCHASED) {
    return "thanks";
  }
  return "failed";
}
