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
| What a tip grants | **A permanent `supporter` entitlement.** Once tipped, the tip widget is replaced by a thank-you state, for good. | — this is now the requirement, not an assumption. |
| Product type | **Non-consumable** (one-time, restorable). On the Test Store it's simply a non-subscription product; the consumable/non-consumable split only becomes real when App Store Connect products exist. | Low now, higher once real products are live — the type is fixed at product creation in App Store Connect. |
| Tip amount | **One product at roughly €1 / $1.** A single package in the `default` offering; no tiers. | Low — adding tiers means adding products in the dashboard and mapping over `availablePackages` instead of taking the first. |
| Post-tip display | **"Supporter since <month year>"**, read from the entitlement's `originalPurchaseDate`. | None — it's one string. |
| Where the UI lives | **Heart icon in the History screen header**, opening a modal. | Low. Moving it to a new About tab is a `App.tsx` navigator change plus a screen; the modal itself is reusable as-is. |

Making the tip permanently change the UI has three consequences that a
grants-nothing tip would have avoided, and they drive most of what follows:

1. **The purchase must be one-time, so it's a non-consumable.** A consumable
   is designed to be bought repeatedly; if tipping disables the widget, buying
   twice is impossible by construction.
2. **Restore Purchases becomes mandatory.** Apple requires a restore
   affordance for non-consumables (guideline 3.1.1), and it's needed in
   practice regardless — see the anonymous-ID risk in §6.
3. **The UI now has three states, not two** — supporter, not-supporter, and
   *unknown* while `CustomerInfo` is still loading. Rendering "unknown" as
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
npx expo install react-native-purchases expo-dev-client expo-secure-store
```

`expo-secure-store` is for the stable app user ID in §3.5. Use
`npx expo install` rather than a pinned version — the SDK-54-compatible
release isn't reachable via an npm dist-tag.

`react-native-purchases@10.6.0` ships no Expo config plugin — only a podspec
and a Gradle module — so autolinking handles it and `app.json` does not
change. Peers (RN ≥ 0.73, iOS ≥ 13, new architecture) are all satisfied by
Expo 54 / RN 0.81.5.

### 3.2 `src/core/tips.ts` — pure, fully tested

Uses a **type-only** import, so vitest never loads the native module and this
file needs no mocks at all (verified against this project's vitest 4.1.2).

```ts
import type {
  CustomerInfo,
  PurchasesPackage,
  PurchasesError,
} from "react-native-purchases";

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

### 3.5 Surviving reinstall: the app user ID

There are three layers of identity here, and it's worth being precise about
which one does what, because they're easy to conflate.

**1. The store account — already sufficient, costs one tap.** `restorePurchases()`
asks StoreKit/Play what this Apple ID or Google account owns. That *is* a
persistent identifier, and a better one than anything we could invent: it
survives reinstall, a new device, and a factory reset. It is the reason the
Restore link exists and the reason no server-side account is needed.

**2. A Keychain-backed app user ID — makes it automatic on iOS.** RevenueCat's
anonymous ID lives in `UserDefaults`/`SharedPreferences`, which the OS wipes on
uninstall. Generating our own UUID once and keeping it in `expo-secure-store`
changes that on iOS, because Keychain items outlive app deletion:

```ts
// src/platform/identity.ts
const KEY = "runnerd.appUserId";
export async function stableAppUserId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY);
  if (existing) return existing;
  const id = randomUUID();
  await SecureStore.setItemAsync(KEY, id);
  return id;
}
```

Pass it to `configure({ apiKey, appUserID })` — **not** to `logIn()` after the
fact. `configure` takes an optional `appUserID` directly (verified in the
10.6.0 typings), which avoids creating an anonymous user and then aliasing it.

Verified properties of `expo-secure-store` (typings for 55.0.16, the closest
published release to ours):

- `keychainAccessible` defaults to `WHEN_UNLOCKED`, and the `_THIS_DEVICE_ONLY`
  variants are documented as the ones *not* migrated to a new device on
  restore-from-backup. So the default also carries the ID onto a new phone set
  up from an encrypted backup — better than plain reinstall survival.
- There is **no** `synchronizable` option (`kSecAttrSynchronizable`), so the
  value is not live-synced through iCloud Keychain. A second device set up
  fresh is a different user until Restore is tapped.

**Android gets nothing from this.** `expo-secure-store` there is
`SharedPreferences` encrypted with a Keystore key, and both are removed on
uninstall. Android leans on Play restore, which is reliable enough that this
doesn't matter.

**Caveat worth stating plainly:** Keychain-survives-uninstall is long-standing
observed behaviour, not a documented guarantee — Apple has called it undefined
and briefly changed it in an iOS 10.3 beta before reverting. Treat it as a
nice-to-have that removes a tap, never as the mechanism of record. The Restore
link stays regardless.

**3. A real account (Sign in with Apple).** The only option giving a genuine
cross-device, cross-platform identity. It needs a paid Apple Developer account
for the capability and adds a login flow to an app that is otherwise entirely
local and account-free. For a €1 tip that grants a heart icon, that is not a
trade worth making. Explicitly rejected.

**The argument that actually decides it: testability.** Test Store purchases
have no Apple ID behind them — they are tied to the RevenueCat app user ID and
nothing else. So on a fresh anonymous install, `restorePurchases()` has
literally nothing to find, and **layer 1 cannot be tested at all until there's
a paid account**. With a stable ID from SecureStore, the reinstall-persistence
story becomes testable today, because the identity is ours rather than Apple's.
That is why §3.5 is in the plan and not deferred.

One dashboard setting to be aware of while testing: the project's restore
behaviour controls what happens when a purchase is restored onto a *different*
app user ID (transfer vs. keep with the original). It's the knob to check if a
restore appears to do nothing.

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

1. **SDK + core + platform + identity + policy.** Dependencies,
   `src/core/tips.ts`, `src/platform/purchases.ts`,
   `src/platform/identity.ts`, their test files, `configurePurchases()` wired
   into `App.tsx` with the stable app user ID, and the
   `docs/privacy-policy.html` rewrite (sections 2, 3, 4, 7 + date bump). No
   user-visible change yet.
2. **Tip UI.** `TipModal.tsx` (including Restore purchases), the
   `useSupporter()` hook, the three-state History header widget, test IDs.
3. **E2E.** `e2e/tip.yaml` for the success, persistence-across-relaunch,
   cancel, and failure flows. Reinstall persistence needs a real
   uninstall/reinstall rather than `clearState`, so it stays a manual check on
   a device — noted in the PR rather than automated.

A README note on needing a dev build for tip work belongs in PR 1 or 2.

## 6. Risks

- **Reinstall loses supporter status on Android, and on iOS if the Keychain
  trick fails.** §3.5 covers the layers. The residual risk is that Keychain
  survival is undocumented behaviour, so the honest posture is: Restore is the
  mechanism, the stable ID is an optimisation. Worth a line of copy in the
  modal so a lost badge isn't experienced as "I paid and it forgot me".
- **A stable app user ID is device identity, not user identity.** Two devices
  are two RevenueCat users until Restore is tapped on the second. Fine here;
  it would not be fine for anything with real value behind it.
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
