# Plan: RevenueCat tip jar via the Test Store

Implementation plan. Background research is in [`revenuecat.md`](./revenuecat.md).

> **Status: implemented.** Where the shipped code differs from the plan below:
>
> - `react-native-purchases` resolved to **10.5.0**, not 10.6.0 — the newer
>   release is inside the repo's 3-day `minimumReleaseAge` window. The APIs
>   used were re-verified against 10.5.0.
> - **`expo-dev-client` was not installed.** The project already builds
>   natively via `expo run:ios`, which is all the SDK needs; the dev client
>   only adds a launcher UI.
> - `REVENUECAT_TEST_KEY` ships **empty**, pending the dashboard setup in §2.
>   While empty the SDK is never configured and the tip widget renders nothing.
> - The UI is one component, `src/screens/TipWidget.tsx` (hook + badge +
>   modal), mounted as the History screen's `headerRight`. No context provider
>   was needed — the widget is the only consumer of supporter state.
> - `e2e/tip.yaml` guards every block on `tip-open` being visible, so it
>   **passes without testing anything** until the key is set. That is a real
>   gap, not a covered case.

**Goal:** an optional "support Runnerd" tip, running entirely against the
RevenueCat **Test Store** — no paid Apple Developer account, no App Store
Connect products, no Play Console.

## 0. Assumed decisions

These were open questions; the plan proceeds on the defaults below. Each notes
what changing it costs.

| Decision           | Assumed                                                                                                                                                                                           | Cost to change later                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| What a tip grants  | **A permanent `supporter` entitlement.** Once tipped, the tip widget is replaced by a thank-you state, for good.                                                                                  | — this is now the requirement, not an assumption.                                                                           |
| Product type       | **Non-consumable** (one-time, restorable). On the Test Store it's simply a non-subscription product; the consumable/non-consumable split only becomes real when App Store Connect products exist. | Low now, higher once real products are live — the type is fixed at product creation in App Store Connect.                   |
| Tip amount         | **One product at roughly €1 / $1.** A single package in the `default` offering; no tiers.                                                                                                         | Low — adding tiers means adding products in the dashboard and mapping over `availablePackages` instead of taking the first. |
| Post-tip display   | **"Supporter since <month year>"**, read from the entitlement's `originalPurchaseDate`.                                                                                                           | None — it's one string.                                                                                                     |
| Where the UI lives | **Heart icon in the History screen header**, opening a modal.                                                                                                                                     | Low. Moving it to a new About tab is a `App.tsx` navigator change plus a screen; the modal itself is reusable as-is.        |

Making the tip permanently change the UI has three consequences that a
grants-nothing tip would have avoided, and they drive most of what follows:

1. **The purchase must be one-time, so it's a non-consumable.** A consumable
   is designed to be bought repeatedly; if tipping disables the widget, buying
   twice is impossible by construction.
2. **Restore Purchases becomes mandatory.** Apple requires a restore
   affordance for non-consumables (guideline 3.1.1), and it's needed in
   practice regardless — see the anonymous-ID risk in §6.
3. **The UI now has three states, not two** — supporter, not-supporter, and
   _unknown_ while `CustomerInfo` is still loading. Rendering "unknown" as
   "not-supporter" makes the widget flicker into existence for people who
   already paid, which is the worst of the three failure modes.

`originalPurchaseDate` on the entitlement means "supporter since" needs no
local storage at all — no SQLite column, no `AsyncStorage` flag. RevenueCat's
cached `CustomerInfo` is the single source of truth and survives app restarts
offline.

**One amount does not mean a hardcoded price string.** "€1" is what it costs
in the eurozone; Apple and Google map a price tier to their own local amount
per storefront, so the same product is $0.99, £0.99, ¥160 and so on. The UI
must render `pkg.product.priceString` from the offering — already localized
and currency-formatted by the store — and never a literal. The offering is
still worth fetching for exactly this reason, plus it keeps the product
swappable server-side.

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
3. Replace the auto-provisioned products with a single **non-subscription**
   product, `tip`, priced at the ~€1 / $1 tier.
4. Put it in the `default` offering as one package.
5. Create a `supporter` entitlement and **attach `tip` to it**. The
   unlock-forever behaviour of non-subscription products — no expiration date
   to fall off — is exactly what's wanted here: the tip grants `supporter`
   permanently.
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
import type { CustomerInfo, PurchasesPackage, PurchasesError } from "react-native-purchases";

export const SUPPORTER = "supporter";

export type TipOutcome = "thanks" | "cancelled" | "pending" | "failed";

/** The widget's three states. `unknown` renders neither button nor badge. */
export type SupporterState =
  | { kind: "unknown" }
  | { kind: "none" }
  | { kind: "supporter"; since: Date };

export function supporterState(info: CustomerInfo | null): SupporterState;
export function formatSupporterSince(since: Date): string;
/** The single tip package, or null if the offering is empty/unavailable. */
export function tipPackage(offering: PurchasesOffering | null): PurchasesPackage | null;
export function classifyPurchaseError(e: PurchasesError): TipOutcome;
export function isTestStoreKey(key: string): boolean;
```

`supporterState` is the heart of it, and it's pure — it takes a plain
`CustomerInfo` (or `null` while loading) and returns the discriminated union
the widget renders from. It reads
`info.entitlements.active[SUPPORTER].originalPurchaseDate`, so every "has the
user tipped / since when" question is answered by one tested function against
fixture objects, with no native module and no device.

`tipPackage` takes the first available package and returns `null` for an empty
or missing offering, so "the store didn't load" is a normal, tested value
rather than an exception at the call site.

`classifyPurchaseError` keeps every `try/catch` decision out of the screen —
note `code` is a `PURCHASES_ERROR_CODE` and the older `userCancelled` field is
deprecated in favour of `code === PURCHASE_CANCELLED_ERROR`.

### 3.3 `src/platform/purchases.ts` — thin shim, mocked in tests

```ts
import Purchases, { LOG_LEVEL } from "react-native-purchases";

export function configurePurchases(apiKey: string, debug: boolean): void;
export async function getCurrentOffering(): Promise<PurchasesOffering | null>;
export async function purchaseTip(pkg: PurchasesPackage): Promise<TipOutcome>;
export async function refreshCustomerInfo(): Promise<CustomerInfo>;
export async function restoreTip(): Promise<CustomerInfo>;
export function onCustomerInfoChange(cb: (info: CustomerInfo) => void): void;
```

`onCustomerInfoChange` wraps `Purchases.addCustomerInfoUpdateListener`, which
fires on purchase, on restore, and on cross-device sync. Feeding the widget
from that listener rather than from `purchaseTip`'s return value means the
supporter state has exactly one source, and restore updates the UI for free.

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

### 3.5 Reinstall: restore, not a persistent ID

**Decision: no custom app user ID. Ship the anonymous ID plus a Restore
button.** Recorded here with the evidence so it doesn't get re-litigated.

Losing entitlements on reinstall and recovering them with an explicit Restore
tap is not a wart to engineer around — it is the platform's intended design and
the near-universal convention:

- **Apple requires the button anyway.** Guideline 3.1.1 mandates a Restore
  Purchases control for any app selling non-consumables or subscriptions, so
  users can regain access _on a new device or after a reinstall_. A missing or
  broken one is a routine rejection. The button is not optional work we'd be
  saving by adding a persistent ID — it ships either way.
- **RevenueCat says not to automate it.** Their docs state `restorePurchases`
  should not be triggered programmatically because it can raise OS-level
  sign-in prompts, and should only run from a deliberate user action.
- **The Keychain trick is explicitly discouraged by Apple.** Apple staff
  describe Keychain surviving uninstall as a side-effect of the implementation
  rather than a feature, not to be relied upon — and they did briefly remove
  the behaviour in an iOS 10.3 beta before reverting under pressure.

So the previous plan's `expo-secure-store` app user ID would have added a
dependency and a module to avoid one tap, in a way Apple advises against, while
not removing any required work. Dropped.

What ships instead: the SDK's anonymous ID, and a **Restore purchases** link in
the tip modal. Reinstall → tap Restore → the store account returns the
purchase → supporter again. Three-device, cross-platform, and factory-reset
cases are all covered by the same path, because the identity is the App Store
or Play account rather than anything on the device.

Two notes for later, neither in scope now:

- `syncPurchases()` is RevenueCat's sanctioned _programmatic_ alternative — it
  does not raise sign-in prompts, and their guidance is to call it once on the
  first launch after install rather than on every launch. That is the correct
  hook if automatic recovery ever becomes worth it.
- Sign in with Apple remains the only true cross-device identity, and remains
  overkill for a EUR 1 tip that grants a heart icon.

**Consequence for testing:** Test Store purchases are tied to the RevenueCat
app user ID with no store account behind them, so a fresh install has nothing
for `restorePurchases()` to find. The restore path therefore cannot be
meaningfully exercised until a paid account and real products exist. The
Restore button still ships — it just has nothing to prove against the Test
Store, and the modal's nothing-to-restore state is what gets tested there.

### 3.6 UI

- `src/screens/TipModal.tsx` — a short blurb, one **Tip `{priceString}`**
  button (the price comes from the package, never a literal), thank-you and
  error states driven by `TipOutcome`, and a small secondary **Restore
  purchases** link. When `tipPackage()` returns `null` — offline, or the
  offering failed to load — the button is replaced by a "couldn't reach the
  store" line with a retry, which is why that case is a value and not a throw.

  The confirm step is deliberate: a heart tap that goes straight to a payment
  sheet reads as a dark pattern, and with one fixed amount the modal is small
  enough that it costs nothing.

- `src/screens/HistoryScreen.tsx` — the widget in the header, rendering from
  `SupporterState`:
  - `unknown` → render nothing (no placeholder, no spinner — it resolves in
    milliseconds from cache, and an empty slot beats a flicker);
  - `none` → heart `Ionicons` button, `testID="tip-open"`, opens the modal;
  - `supporter` → a non-interactive filled heart with "Supporter since March
    2026", `testID="tip-supporter"`. No tap target — this is the "disable the
    widget" half of the requirement.

  The screen already imports `Ionicons` and `Modal`, so this adds no new deps.

- `App.tsx` — `configurePurchases(...)` in the existing `useEffect` alongside
  `setupNotificationHandler()`.
- Supporter state lives in a small `useSupporter()` hook (a `.tsx` or a
  context) seeded by `refreshCustomerInfo()` on mount and kept current by
  `onCustomerInfoChange`. It starts at `{ kind: "unknown" }`.

## 4. Testing

Detail in [`revenuecat.md` §5](./revenuecat.md). Concretely:

- `src/core/tips.test.ts` — every branch of `supporterState` (null info,
  no entitlement, active entitlement with a date), `formatSupporterSince`,
  `tipPackage` (populated / empty / null offering), and every branch of
  `classifyPurchaseError`. No mocks.
- `src/platform/purchases.test.ts` — `configure` called once, debug logging
  only in dev, `purchaseTip` mapping success/cancel/failure, `restoreTip`
  delegating to `restorePurchases`, and the `test_` guard.
- `e2e/tip.yaml` — Maestro against the Test Store's deterministic modal. The
  assertion that matters is the **transition**: the button is gone and the
  badge is present.

```yaml
appId: com.runnerd.app
---
- launchApp:
    clearState: true
- tapOn:
    id: "tab-history"
- assertVisible:
    id: "tip-open"
- tapOn:
    id: "tip-open"
- tapOn:
    id: "tip-confirm"
- tapOn: "Simulate purchase"
- assertVisible:
    id: "tip-supporter"
- assertNotVisible:
    id: "tip-open"
```

`clearState: true` is load-bearing now, not just hygiene: without it the
second CI run starts already-a-supporter, `tip-open` never renders, and the
flow fails on the first `assertVisible` — or worse, a badly written flow
passes for the wrong reason.

A second flow should relaunch **without** `clearState` after a successful tip
and assert `tip-supporter` is still visible. That's the persistence guarantee
the feature actually promises, and it's the one thing unit tests can't reach.

`Simulate failure` and `Cancel` get their own flows, each asserting the widget
stayed in the `tip-open` state — the negative case matters as much as the
positive one here, since a failed purchase that disables the widget would be
worse than one that errors loudly.

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
2. **Tip UI.** `TipModal.tsx` (including Restore purchases), the
   `useSupporter()` hook, the three-state History header widget, test IDs.
3. **E2E.** `e2e/tip.yaml` for the success, persistence-across-relaunch,
   cancel, and failure flows.

A README note on needing a dev build for tip work belongs in PR 1 or 2.

## 6. Risks

- **Reinstall drops supporter status until Restore is tapped.** By design
  (§3.5), and the platform convention — but still worth a line of copy in the
  modal so a lost badge isn't experienced as "I paid and it forgot me". The
  nothing-to-restore case must say so plainly rather than silently no-op;
  that specific silent failure is a documented source of 3.1.1 rejections.
- **Flicker on cold start.** If `unknown` is rendered as `none`, a supporter
  sees the tip button for a moment on every launch. The three-state union
  exists specifically to prevent this; it's the first thing to check by hand.
- **Entitlement misconfiguration.** Forgetting to attach the products to
  `supporter` means purchases succeed and the widget never changes — a silent,
  confusing failure. Verify in the dashboard after the first test purchase.
- **Expo Go divergence.** Preview API Mode means the tip button appears to do
  nothing in Expo Go rather than failing loudly. Worth an explicit "requires a
  dev build" note so it isn't debugged as a bug.
- **Test Store key shipped to production.** Mitigated by the guard test; only
  becomes a live risk when a real Apple account exists.
- **Nothing here validates real StoreKit.** Receipt validation, Ask to Buy,
  and refund handling are untested until there's a paid account. That's
  acceptable while the app isn't shipping, but the tip feature is not
  "done for the App Store" at the end of this plan.
