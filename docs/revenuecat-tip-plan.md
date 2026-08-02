# Plan: RevenueCat tip jar via the Test Store

Implementation plan. Background research is in [`revenuecat.md`](./revenuecat.md).

**Goal:** an optional "support Runnerd" tip, running entirely against the
RevenueCat **Test Store** — no paid Apple Developer account, no App Store
Connect products, no Play Console.

## 0. Assumed decisions

These were open questions; the plan proceeds on the defaults below. Each notes
what changing it costs.

| Decision | Assumed | Cost to change later |
|---|---|---|
| What a tip grants | **Nothing** — a pure thank-you. Consumable product, attached to no entitlement. | Low. Adding a supporter badge means attaching the product to an entitlement in the dashboard and reading `customerInfo.entitlements.active` — the core/platform split below already isolates this. It also adds a mandatory Restore Purchases affordance. |
| Number of tiers | **Rendered from the offering**, so RevenueCat decides how many and at what price. Starts as the three auto-provisioned products. | None — that's the point of rendering from `getOfferings()`. |
| Where the UI lives | **Heart icon in the History screen header**, opening a modal. | Low. Moving it to a new About tab is a `App.tsx` navigator change plus a screen; the modal itself is reusable as-is. |

The "grants nothing" choice is the important one, and it is deliberately the
smallest thing that works: no entitlement means no restore flow, no persisted
purchase state, no entitlement threading through the UI, and no App Store
review surface around restoring. If the tip should leave a permanent mark,
say so before step 3 — it changes the product type question from "consumable"
to "consumable *and* entitlement", not the architecture.

**Explicit non-goals:** real money, App Store Connect products, Android, the
`appl_`/`goog_` production keys, subscriptions, and paywall UI from
`react-native-purchases-ui`.

## 1. Constraints this plan has to respect

- **Coverage gate.** `vitest.config.ts` enforces 95% lines over all
  `src/**/*.ts`. Every new `.ts` file needs tests. `.tsx` is outside both the
  vitest `include` glob and the coverage `include`, so screens are exempt.
- **Expo Go stops covering the purchase path.** The SDK falls back to Preview
  API Mode there (JS mocks, no real purchase). Tip work needs a dev build —
  but the existing free-Apple-ID `pnpm ios:release` flow is fine, because the
  Test Store never touches StoreKit.
- **Privacy policy.** `agents.md` requires `docs/privacy-policy.html` updated
  in the same PR as the SDK. Section 7 currently states outright that Runnerd
  uses no third-party SDKs, and the app is currently network-free — both stop
  being true. Sections 2, 3, 4 and 7 plus the "Last updated: 14 April 2026"
  date all need revising.
- **No force-push, merge only** (`agents.md`).

## 2. Product setup in the RevenueCat dashboard

No code. Roughly 10 minutes.

1. Sign up at <https://app.revenuecat.com/signup>; a project is created
   automatically, already carrying a `default` offering with three Test Store
   products and one entitlement.
2. **Apps & providers** → confirm **Test Store** is enabled. Do not connect
   App Store or Play Store — neither is needed and both require credentials
   we don't have.
3. Replace the auto-provisioned products with three **non-subscription**
   (consumable) tip products, e.g. `tip_small` / `tip_medium` / `tip_large`.
4. Put them in the `default` offering as three packages, cheapest first.
5. **Detach them from every entitlement.** This is the step that's easy to get
   wrong: a consumable attached to an entitlement unlocks it *forever*, since
   there's no expiration date to fall off. A tip that grants nothing must
   belong to no entitlement.
6. Copy the `test_` SDK key from **API keys**.

## 3. Code

### 3.1 Dependencies

```bash
npx expo install react-native-purchases expo-dev-client
```

`react-native-purchases@10.6.0` ships no Expo config plugin — only a podspec
and a Gradle module — so autolinking handles it and `app.json` does not
change. Peers (RN ≥ 0.73, iOS ≥ 13, new architecture) are all satisfied by
Expo 54 / RN 0.81.5.

### 3.2 `src/core/tips.ts` — pure, fully tested

Uses a **type-only** import, so vitest never loads the native module and this
file needs no mocks at all (verified against this project's vitest 4.1.2).

```ts
import type { PurchasesPackage, PurchasesError } from "react-native-purchases";

export interface TipOption {
  id: string;
  priceString: string;
  pkg: PurchasesPackage;
}

export type TipOutcome = "thanks" | "cancelled" | "pending" | "failed";

export function toTipOptions(packages: PurchasesPackage[]): TipOption[];
export function classifyPurchaseError(e: PurchasesError): TipOutcome;
export function isTestStoreKey(key: string): boolean;
```

`toTipOptions` sorts by price ascending and maps to what the modal renders.
`classifyPurchaseError` keeps every `try/catch` decision out of the screen —
note `code` is a `PURCHASES_ERROR_CODE` and the older `userCancelled` field is
deprecated in favour of `code === PURCHASE_CANCELLED_ERROR`.

### 3.3 `src/platform/purchases.ts` — thin shim, mocked in tests

```ts
import Purchases, { LOG_LEVEL } from "react-native-purchases";

export function configurePurchases(apiKey: string, debug: boolean): void;
export async function getTipPackages(): Promise<PurchasesPackage[]>;
export async function purchaseTip(pkg: PurchasesPackage): Promise<TipOutcome>;
```

The key is a **parameter**, not read from `Platform.select` inside the module.
That is deliberate: no `src/**/*.ts` file currently imports `react-native`, and
vitest runs in node where that import fails. Keeping the platform branch in
`App.tsx` (a `.tsx`, outside vitest) avoids mocking `react-native` entirely.

`src/platform/purchases.test.ts` mocks the SDK with a `vi.mock` factory. The
SDK's `Purchases` is a **default** export, so the factory must supply
`default: { … }` — verified working.

### 3.4 Key handling and the guard test

Per the discussion above, the `test_` key is committed as a plain constant in
`src/core/tips.ts` with a comment explaining it is a public client key. The
safety comes from the guard, not from hiding it:

```ts
// Fails the build if a Test Store key ever reaches the production selector.
it("refuses a test_ key on the production path", () => {
  expect(() => productionKey("test_abc")).toThrow();
});
```

`isTestStoreKey()` exists for the same reason, and `configurePurchases` can
additionally refuse a `test_` key when `!__DEV__` once a production build path
exists.

### 3.5 UI

- `src/screens/TipModal.tsx` — lists `TipOption`s, one button each, thank-you
  and error states driven by `TipOutcome`.
- `src/screens/HistoryScreen.tsx` — a heart `Ionicons` button in the header
  (the screen already imports `Ionicons` and `Modal`), plus
  `testID="tip-open"` and `testID="tip-thanks"` for Maestro.
- `App.tsx` — call `configurePurchases(...)` in the existing `useEffect`
  alongside `setupNotificationHandler()`.

Since a tip grants nothing, there is no persisted state, no entitlement check
on launch, and no Restore Purchases button.

## 4. Testing

Detail in [`revenuecat.md` §5](./revenuecat.md). Concretely:

- `src/core/tips.test.ts` — sorting, price formatting, and every branch of
  `classifyPurchaseError`. No mocks.
- `src/platform/purchases.test.ts` — `configure` called once, debug logging
  only in dev, `purchaseTip` mapping success/cancel/failure, and the `test_`
  guard.
- `e2e/tip.yaml` — Maestro against the Test Store's deterministic modal:

```yaml
appId: com.runnerd.app
---
- launchApp:
    clearState: true
- tapOn:
    id: "tab-history"
- tapOn:
    id: "tip-open"
- tapOn:
    index: 0
    id: "tip-option"
- tapOn: "Simulate purchase"
- assertVisible:
    id: "tip-thanks"
```

`clearState: true` matters even here: it forces a fresh anonymous app user ID
per run so purchases don't accumulate across CI runs.

`Simulate failure` and `Cancel` get their own flows — those branches are
near-impossible to trigger reliably against a real store, and here they're a
tap.

**CI impact.** `.github/workflows/e2e-ios.yml` already builds a Release
simulator app on `macos-15` and runs `e2e/`, and the Test Store explicitly
supports simulators and CI runners, so no new infrastructure is needed. Two
notes: the Pods cache key is `hashFiles('pnpm-lock.yaml')`, so the first run
after adding the dependency takes a full `pod install`; and because the job
builds `-configuration Release`, a `__DEV__` check will not select the test key
there — with the key committed as a constant this is a non-issue, which is a
second reason to commit it.

## 5. Sequencing

Three PRs. They can be collapsed into one if the review overhead isn't worth
it — the total diff is small.

1. **SDK + core + platform + policy.** Dependencies, `src/core/tips.ts`,
   `src/platform/purchases.ts`, both test files, `configurePurchases()` wired
   into `App.tsx`, and the `docs/privacy-policy.html` rewrite (sections 2, 3,
   4, 7 + date bump). No user-visible change yet.
2. **Tip UI.** `TipModal.tsx`, the History header button, test IDs.
3. **E2E.** `e2e/tip.yaml` for the success, cancel, and failure flows.

A README note on needing a dev build for tip work belongs in PR 1 or 2.

## 6. Risks

- **Consumable attached to an entitlement by accident** — silently grants
  forever. Guarded by step 2.5 above; worth re-checking in the dashboard after
  the first successful test purchase.
- **Expo Go divergence.** Preview API Mode means the tip button appears to do
  nothing in Expo Go rather than failing loudly. Worth an explicit "requires a
  dev build" note so it isn't debugged as a bug.
- **Test Store key shipped to production.** Mitigated by the guard test; only
  becomes a live risk when a real Apple account exists.
- **Nothing here validates real StoreKit.** Receipt validation, Ask to Buy,
  and refund handling are untested until there's a paid account. That's
  acceptable while the app isn't shipping, but the tip feature is not
  "done for the App Store" at the end of this plan.
