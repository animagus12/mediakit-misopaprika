"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { saveInvoiceDefaults } from "@/app/invoice-generator/actions";
import { todayISO, toInvoiceDefaults, type InvoiceLineItem } from "@/lib/invoice";
import type { InvoiceData } from "@/repositories/invoice";
import { InvoiceControls } from "./InvoiceControls";
import { InvoicePreview } from "./InvoicePreview";
import type { InvoiceFormState } from "./types";
import styles from "./invoice.module.css";

// Deterministic (index-based) ids for state computed during the initial
// render, so SSR output and the first client render match exactly —
// Math.random()/crypto here would cause a hydration mismatch.
function withStableIds(items: InvoiceData["defaultItems"]): InvoiceLineItem[] {
  return items.map((item, index) => ({ ...item, id: `initial-${index}` }));
}

function buildInitialState(data: InvoiceData): InvoiceFormState {
  return {
    invoiceNo: data.invoiceNumberSeed,
    date: todayISO(),
    due: todayISO(data.dueInDays),
    clientName: "",
    clientContactName: "",
    clientEmail: "",
    items: withStableIds(data.defaultItems),
    advance: 0,
    barterOn: data.barter.defaultEnabled,
    barterVal: data.barter.defaultValue,
    barterStatus: data.barter.defaultStatus,
    payName: data.payee.name,
    payEmail: data.payee.email,
    paymentMode: data.payee.paymentMode,
    upi: data.payee.upi,
    bankAccountName: data.payee.bank.accountName,
    bankAccountNumber: data.payee.bank.accountNumber,
    bankIfsc: data.payee.bank.ifsc,
    bankName: data.payee.bank.bankName,
    gstNote: data.payee.footerNote,
    closing: data.payee.closingLine,
    qrImage: data.payee.defaultQrImage,
    stampImage: data.payee.defaultStampImage,
  };
}

interface InvoiceGeneratorProps {
  data: InvoiceData;
}

export function InvoiceGenerator({ data }: InvoiceGeneratorProps) {
  const [state, setState] = useState<InvoiceFormState>(() => buildInitialState(data));
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [, startSaveDefaultsTransition] = useTransition();

  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only ever called from client-triggered handlers (add line, apply
  // preset, reset) — never during the initial render — so a plain
  // incrementing counter is safe and can't collide with the "initial-*"
  // ids used for the first render's items.
  const nextItemId = useRef(0);
  const makeItemId = useCallback(() => `item-${nextItemId.current++}`, []);
  const withFreshIds = useCallback(
    (items: InvoiceData["defaultItems"]): InvoiceLineItem[] =>
      items.map((item) => ({ ...item, id: makeItemId() })),
    [makeItemId]
  );

  const showToast = useCallback((message: string) => {
    setToastMsg(message);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToastMsg(null), 1800);
  }, []);

  const setField = useCallback(
    <K extends keyof InvoiceFormState>(field: K, value: InvoiceFormState[K]) => {
      setState((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const updateItem = useCallback(
    (id: string, field: "desc" | "sub" | "qty" | "price", value: string) => {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === id
            ? {
                ...item,
                [field]: field === "qty" || field === "price" ? Number(value) : value,
              }
            : item
        ),
      }));
    },
    []
  );

  const removeItem = useCallback((id: string) => {
    setState((prev) =>
      prev.items.length > 1
        ? { ...prev, items: prev.items.filter((item) => item.id !== id) }
        : prev
    );
  }, []);

  const addItem = useCallback(() => {
    setState((prev) => ({
      ...prev,
      items: [...prev.items, { id: makeItemId(), desc: "", sub: "", qty: 1, price: 0 }],
    }));
  }, [makeItemId]);

  const applyPreset = useCallback(
    (presetId: string) => {
      const preset = data.presets.find((p) => p.id === presetId);
      if (!preset) return;
      const itemsWithoutSub = preset.items.map((item) => ({ ...item, sub: "" }));
      setState((prev) => ({ ...prev, items: withFreshIds(itemsWithoutSub) }));
    },
    [data.presets, withFreshIds]
  );

  const reset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      items: withFreshIds(data.defaultItems),
      clientName: "",
      clientContactName: "",
      clientEmail: "",
      advance: 0,
      date: todayISO(),
      due: todayISO(data.dueInDays),
    }));
    showToast("Fields reset");
  }, [data.defaultItems, data.dueInDays, showToast, withFreshIds]);

  // window.print() fires first so the dialog appears with no added latency;
  // saving the new defaults happens in the background and only surfaces a
  // toast on failure, so it doesn't compete with the print dialog for
  // attention.
  const print = useCallback(() => {
    window.print();
    const payload = toInvoiceDefaults(state, data);
    startSaveDefaultsTransition(async () => {
      const result = await saveInvoiceDefaults(payload);
      if (!result.success) showToast(result.error);
    });
  }, [state, data, showToast]);

  const setQrImage = useCallback((dataUrl: string | null) => {
    setState((prev) => ({ ...prev, qrImage: dataUrl }));
  }, []);

  const setStampImage = useCallback((dataUrl: string | null) => {
    setState((prev) => ({ ...prev, stampImage: dataUrl }));
  }, []);

  const actions = useMemo(
    () => ({
      setField,
      updateItem,
      removeItem,
      addItem,
      applyPreset,
      reset,
      print,
      setQrImage,
      setStampImage,
    }),
    [
      setField,
      updateItem,
      removeItem,
      addItem,
      applyPreset,
      reset,
      print,
      setQrImage,
      setStampImage,
    ]
  );

  return (
    <div className={styles.app}>
      <InvoiceControls
        state={state}
        actions={actions}
        brandHandle={data.brandHandle}
        presets={data.presets}
        billedToPlaceholder={data.billedToPlaceholder}
        onImageUploadError={showToast}
      />

      <main className={styles.stage}>
        <div className={styles.stageInner}>
          <InvoicePreview state={state} billedToPlaceholder={data.billedToPlaceholder} />
        </div>
      </main>

      <div className={`${styles.toast} ${toastMsg ? styles.toastShow : ""}`}>{toastMsg}</div>
    </div>
  );
}
