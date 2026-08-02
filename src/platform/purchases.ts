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
  if (debug) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }
  Purchases.configure({ apiKey });
  configured = true;
  return true;
}

export function isConfigured(): boolean {
  return configured;
}

/** The current offering, or null when unconfigured or the store is unreachable. */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch {
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
  } catch {
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
  } catch {
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
