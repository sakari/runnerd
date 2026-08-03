import Purchases, { LOG_LEVEL } from "react-native-purchases";
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from "react-native-purchases";
import { TipOutcome, classifyPurchaseError } from "../core/tips";

let configured = false;

/**
 * Configures the RevenueCat SDK. Returns false when no API key is set, which
 * leaves every other function in this module inert and the tip UI hidden —
 * that is the state until the Test Store key is filled in.
 */
export function configurePurchases(apiKey: string, debug: boolean): boolean {
  if (apiKey === "") return false;
  try {
    if (debug) {
      // Not awaited by the SDK either, but it rejects rather than throws when
      // the native module is missing, so it needs its own catch.
      Purchases.setLogLevel(LOG_LEVEL.DEBUG)?.catch?.(() => {});
    }
    // Throws synchronously when the native module is absent — the common state
    // where the dependency is installed but the app has not been rebuilt. This
    // runs inside App's effect with no error boundary above it, so an escaping
    // throw would unmount the whole app rather than just hide the tip.
    Purchases.configure({ apiKey });
    configured = true;
    return true;
  } catch (error) {
    // Loud on purpose. Every downstream failure mode here renders as "the tip
    // widget is invisible", which is indistinguishable from "still loading" —
    // so the reason has to reach the log or it is undebuggable on a device.
    console.warn(
      "[tips] RevenueCat configure failed — the tip UI will stay hidden. " +
        "Most often the native module is missing because the app was not " +
        "rebuilt after the dependency was added: try " +
        "`npx expo prebuild --platform ios --clean` then `pnpm ios:release`.",
      error,
    );
    return false;
  }
}

export function isConfigured(): boolean {
  return configured;
}

/** The current offering, or null when unconfigured or the store is unreachable. */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings?.current ?? null;
  } catch (error) {
    console.warn("[tips] getOfferings failed — the tip sheet will offer nothing.", error);
    return null;
  }
}

/** Runs a purchase and maps both success and failure into a `TipOutcome`. */
export async function purchaseTip(pkg: PurchasesPackage): Promise<TipOutcome> {
  try {
    await Purchases.purchasePackage(pkg);
    return "thanks";
  } catch (error) {
    return classifyPurchaseError(error);
  }
}

/** Latest CustomerInfo, or null when unconfigured or unreachable. */
export async function refreshCustomerInfo(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    console.warn("[tips] getCustomerInfo failed — the tip widget stays hidden.", error);
    return null;
  }
}

/**
 * Restores purchases from the underlying store account.
 *
 * Only ever call this from a deliberate user action — RevenueCat's guidance is
 * that it can raise an OS-level sign-in prompt, so it must not run on launch.
 * Returns null if the restore itself failed; an empty entitlement set is a
 * successful restore that found nothing, which the caller must report plainly.
 */
export async function restoreTip(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    return await Purchases.restorePurchases();
  } catch (error) {
    console.warn("[tips] restorePurchases failed.", error);
    return null;
  }
}

/**
 * Subscribes to CustomerInfo changes (purchases, restores, cross-device sync).
 * Returns an unsubscribe function.
 */
export function onCustomerInfoChange(listener: (info: CustomerInfo) => void): () => void {
  if (!configured) return () => {};
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

/** Test seam: resets module state between cases. */
export function resetForTests(): void {
  configured = false;
}
