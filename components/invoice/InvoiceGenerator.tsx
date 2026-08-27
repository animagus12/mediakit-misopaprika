"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createInvoice as createInvoiceAction,
  saveInvoiceDefaults,
  updateInvoice as updateInvoiceAction,
} from "@/app/invoice-generator/actions";
import {
  formStateToInvoiceInput,
  invoiceDefaultsToFormState,
  invoiceRecordToFormState,
  todayISO,
  toInvoiceDefaults,
  type InvoiceLineItem,
} from "@/lib/invoice";
import type { InvoiceData } from "@/repositories/invoice";
import type { Invoice } from "@/repositories/invoices";
import { InvoiceControls } from "./InvoiceControls";
import { InvoicePreview } from "./InvoicePreview";
import type { InvoiceFormState } from "./types";
import styles from "./invoice.module.css";

function buildInitialState(data: InvoiceData, invoice?: Invoice): InvoiceFormState {
  return invoice ? invoiceRecordToFormState(invoice) : invoiceDefaultsToFormState(data);
}

interface InvoiceGeneratorProps {
  data: InvoiceData;
  invoice?: Invoice;
  takenInvoiceNumbers?: string[];
}

export function InvoiceGenerator({ data, invoice, takenInvoiceNumbers = [] }: InvoiceGeneratorProps) {
  const router = useRouter();
  const [state, setState] = useState<InvoiceFormState>(() => buildInitialState(data, invoice));
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();

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
  // persisting the invoice happens in the background and only surfaces a
  // toast, so it doesn't compete with the print dialog for attention. For a
  // brand-new invoice the current form is also carried forward as the
  // defaults for the next one (the pre-list behaviour of "Save as PDF"),
  // then the URL swaps to the saved record so a second Save updates it
  // rather than creating a duplicate.
  const save = useCallback(() => {
    window.print();
    const input = formStateToInvoiceInput(state);
    startSaveTransition(async () => {
      if (invoice) {
        const result = await updateInvoiceAction({ id: invoice.id, ...input });
        showToast(result.success ? "Invoice saved" : result.error);
        return;
      }
      const result = await createInvoiceAction(input);
      if (!result.success) {
        showToast(result.error);
        return;
      }
      await saveInvoiceDefaults(toInvoiceDefaults(state, data));
      router.replace(`/invoice-generator/${result.id}`);
    });
  }, [state, data, invoice, router, showToast]);

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
      save,
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
      save,
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
        takenInvoiceNumbers={takenInvoiceNumbers}
        isSaving={isSaving}
        isExisting={invoice != null}
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
