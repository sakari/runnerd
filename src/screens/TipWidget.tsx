import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, Modal, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";
import {
  SupporterState,
  TipOutcome,
  formatSupporterSince,
  supporterState,
  tipPackage,
} from "../core/tips";
import {
  getCurrentOffering,
  isConfigured,
  onCustomerInfoChange,
  purchaseTip,
  refreshCustomerInfo,
  restoreTip,
} from "../platform/purchases";

const MAX_LOAD_ATTEMPTS = 5;
const RETRY_DELAY_MS = 2000;

/**
 * Tracks supporter status. Starts at `unknown` so neither the tip button nor
 * the badge renders until CustomerInfo has resolved — showing the button first
 * would flash it at people who have already tipped.
 */
function useSupporter(): [SupporterState, (info: CustomerInfo | null) => void] {
  const [info, setInfo] = useState<CustomerInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    // A single failed lookup would otherwise hide the widget for the whole
    // session: the listener below never replays current state, so nothing else
    // would ever populate it. Retry a bounded number of times, and not at all
    // when there is no API key — that case is meant to stay hidden.
    const load = () => {
      refreshCustomerInfo().then((next) => {
        if (cancelled) return;
        if (next) {
          setInfo(next);
          return;
        }
        if (!isConfigured() || ++attempts >= MAX_LOAD_ATTEMPTS) return;
        timer = setTimeout(load, RETRY_DELAY_MS * attempts);
      });
    };

    load();
    const unsubscribe = onCustomerInfoChange((next) => setInfo(next));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return [supporterState(info), setInfo];
}

export default function TipWidget() {
  const [state, setInfo] = useSupporter();
  const [open, setOpen] = useState(false);

  return (
    <>
      {state.kind === "supporter" ? (
        <View style={styles.badge} testID="tip-supporter">
          <Ionicons name="heart" size={16} color="#1a1" />
          <Text style={styles.badgeText}>
            {state.since ? `Supporter since ${formatSupporterSince(state.since)}` : "Supporter"}
          </Text>
        </View>
      ) : state.kind === "none" ? (
        <Pressable
          style={styles.headerButton}
          testID="tip-open"
          accessibilityLabel="Support Runnerd"
          onPress={() => setOpen(true)}
        >
          <Ionicons name="heart-outline" size={20} color="#fff" />
        </Pressable>
      ) : null}

      {/* Rendered outside the state switch on purpose. When it lived inside the
          "none" branch, a purchase flipping the state to "supporter" unmounted
          the sheet mid-flow — discarding the "Thank you" state entirely if the
          CustomerInfo listener won the race with purchaseTip, and otherwise
          self-dismissing the sheet the user never closed. Its lifetime is now
          governed only by `open`. */}
      {open ? <TipModal onClose={() => setOpen(false)} onCustomerInfo={setInfo} /> : null}
    </>
  );
}

function TipModal({
  onClose,
  onCustomerInfo,
}: {
  onClose: () => void;
  onCustomerInfo: (info: CustomerInfo | null) => void;
}) {
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<TipOutcome | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getCurrentOffering().then((offering) => {
      if (cancelled) return;
      setPkg(tipPackage(offering));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setLoading(true);
    setOutcome(null);
    setRestoreMessage(null);
    setAttempt((n) => n + 1);
  }, []);

  const handleTip = async () => {
    if (!pkg) return;
    setBusy(true);
    // Clear the other channel's message, or the sheet shows a stale restore
    // result alongside a fresh purchase result.
    setRestoreMessage(null);
    const result = await purchaseTip(pkg);
    setOutcome(result);
    if (result === "thanks") {
      // Only on a successful refresh: pushing a null back would drop the widget
      // to its "unknown" state and hide it entirely, right after someone paid.
      // If the refresh fails, the CustomerInfo listener still catches up.
      const info = await refreshCustomerInfo();
      if (info) onCustomerInfo(info);
    }
    setBusy(false);
  };

  const handleRestore = async () => {
    setBusy(true);
    setRestoreMessage(null);
    setOutcome(null);
    const info = await restoreTip();
    if (!info) {
      setRestoreMessage("Couldn't reach the store. Try again in a moment.");
    } else if (supporterState(info).kind === "supporter") {
      setRestored(true);
      onCustomerInfo(info);
    } else {
      // Never a silent no-op: a restore that finds nothing has to say so.
      setRestoreMessage("No previous tip found on this account.");
    }
    setBusy(false);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Ionicons name="heart" size={28} color="#1a1" />
          <Text style={styles.title}>Support Runnerd</Text>
          <Text style={styles.blurb}>
            Runnerd is free and stores everything on your phone. A one-off tip is a thank-you — it
            doesn&apos;t unlock anything.
          </Text>

          {outcome === "thanks" || restored ? (
            <Text style={styles.thanks} testID="tip-thanks">
              {restored ? "Tip restored — thank you! ♥" : "Thank you! ♥"}
            </Text>
          ) : (
            <>
              {loading ? (
                <ActivityIndicator color="#1a1" style={styles.loader} />
              ) : pkg ? (
                <Pressable
                  style={[styles.tipButton, (busy || outcome === "pending") && styles.disabled]}
                  testID="tip-confirm"
                  disabled={busy || outcome === "pending"}
                  onPress={handleTip}
                >
                  <Text style={styles.tipButtonText}>Tip {pkg.product.priceString}</Text>
                </Pressable>
              ) : (
                <View style={styles.unavailable}>
                  <Text style={styles.error} testID="tip-unavailable">
                    Couldn&apos;t reach the store.
                  </Text>
                  <Pressable onPress={retry} testID="tip-retry">
                    <Text style={styles.link}>Try again</Text>
                  </Pressable>
                </View>
              )}

              {outcome === "cancelled" ? (
                <Text style={styles.note}>Purchase cancelled.</Text>
              ) : null}
              {outcome === "pending" ? (
                <Text style={styles.note}>
                  Waiting for approval — your tip will complete once it&apos;s confirmed.
                </Text>
              ) : null}
              {outcome === "failed" ? (
                <Text style={styles.error} testID="tip-failed">
                  Something went wrong. No payment was taken.
                </Text>
              ) : null}
            </>
          )}

          {outcome === "thanks" || restored ? null : (
            <Pressable onPress={handleRestore} disabled={busy} testID="tip-restore">
              <Text style={styles.link}>Restore purchases</Text>
            </Pressable>
          )}
          {restoreMessage ? (
            <Text style={styles.note} testID="tip-restore-message">
              {restoreMessage}
            </Text>
          ) : null}

          <Pressable style={styles.close} onPress={onClose} testID="tip-close">
            <Ionicons name="close" size={16} color="#aaa" />
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 16,
  },
  badgeText: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#111",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  blurb: {
    color: "#888",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  loader: {
    marginVertical: 12,
  },
  tipButton: {
    backgroundColor: "#1a1",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 4,
  },
  disabled: {
    opacity: 0.5,
  },
  tipButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  unavailable: {
    alignItems: "center",
    gap: 6,
  },
  thanks: {
    color: "#1a1",
    fontSize: 18,
    fontWeight: "700",
    marginVertical: 12,
  },
  note: {
    color: "#888",
    fontSize: 13,
    textAlign: "center",
  },
  error: {
    color: "#f44",
    fontSize: 13,
    textAlign: "center",
  },
  link: {
    color: "#4a9",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  close: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  closeText: {
    color: "#aaa",
    fontSize: 14,
  },
});
