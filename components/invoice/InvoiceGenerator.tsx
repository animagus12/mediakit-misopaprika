"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createInvoice as createInvoiceAction,
  saveInvoiceDefaults,
  updateInvoice as updateInvoiceAction,
} from "@/app/invoices/actions";
import {
  formStateToInvoiceInput,
  invoiceDefaultsToFormState,
  invoiceRecordToFormState,
  todayISO,
  toInvoiceDefaults,
  type InvoiceBrandOption,
  type InvoiceEditorJobOption,
  type InvoiceLineItem,
} from "@/lib/invoice";
import type { InvoiceData } from "@/repositories/invoice";
import type { Invoice } from "@/repositories/invoices";
import { InvoiceControls } from "./InvoiceControls";
import { InvoicePreview } from "./InvoicePreview";
import type { InvoiceFormState } from "./types";
import styles from "./invoice.module.css";

function buildInitialState(
  data: InvoiceData,
  invoice: Invoice | undefined,
  brandOptions: InvoiceBrandOption[],
  initialBrandId?: string
): InvoiceFormState {
  if (invoice) return invoiceRecordToFormState(invoice);
  const base = invoiceDefaultsToFormState(data);
  // Deep-linked from a brand ("New invoice" on /brands/[id]) — pre-select it
  // and seed the shown client name from the brand.
  const brand = initialBrandId ? brandOptions.find((option) => option.id === initialBrandId) : undefined;
  if (!brand) return base;
  return {
    ...base,
    brandId: brand.id,
    clientName: brand.name,
    clientContactName: brand.contactNames.length === 1 ? brand.contactNames[0] : base.clientContactName,
  };
}

interface InvoiceGeneratorProps {
  data: InvoiceData;
  invoice?: Invoice;
  takenInvoiceNumbers?: string[];
  brandOptions?: InvoiceBrandOption[];
  editorJobOptions?: InvoiceEditorJobOption[];
  initialBrandId?: string;
}

export function InvoiceGenerator({
  data,
  invoice,
  takenInvoiceNumbers = [],
  brandOptions = [],
  editorJobOptions = [],
  initialBrandId,
}: InvoiceGeneratorProps) {
  const router = useRouter();
  const [state, setState] = useState<InvoiceFormState>(() =>
    buildInitialState(data, invoice, brandOptions, initialBrandId)
  );
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

  // Links the invoice to a CRM brand and pulls the brand name onto the sheet
  // (and its sole contact, when there's exactly one and no name typed yet).
  // The snapshot fields stay editable — this is a convenience, not a lock.
  const selectBrand = useCallback(
    (brandId: string | null) => {
      setState((prev) => {
        if (!brandId) return { ...prev, brandId: null };
        const brand = brandOptions.find((option) => option.id === brandId);
        if (!brand) return { ...prev, brandId };
        return {
          ...prev,
          brandId,
          clientName: brand.name,
          clientContactName:
            !prev.clientContactName.trim() && brand.contactNames.length === 1
              ? brand.contactNames[0]
              : prev.clientContactName,
        };
      });
    },
    [brandOptions]
  );

  const selectEditorJob = useCallback((editorTransactionId: string | null) => {
    setState((prev) => ({ ...prev, editorTransactionId }));
  }, []);

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
      brandId: null,
      editorTransactionId: null,
      clientName: "",
      clientContactName: "",
      clientEmail: "",
      advance: 0,
      date: todayISO(),
      due: todayISO(data.dueInDays),
    }));
    showToast("Fields reset");
  }, [data.defaultItems, data.dueInDays, showToast, withFreshIds]);

  // Persists the invoice without touching the print dialog — "Save" and
  // "Download PDF" are separate actions. For a brand-new invoice the current
  // form is also carried forward as the defaults for the next one (invoice
  // number, campaign name, payee details, line items, …), then the URL swaps
  // to the saved record so a second Save updates it rather than duplicating.
  const save = useCallback(() => {
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
      showToast("Invoice saved");
      router.replace(`/invoices/${result.id}`);
    });
  }, [state, data, invoice, router, showToast]);

  // Opens the browser's print/Save-as-PDF dialog for the live preview. The
  // invoice.module.css @media print rules hide the controls panel, so only
  // the A4 sheet prints. Independent of Save — the record isn't touched.
  const download = useCallback(() => {
    window.print();
  }, []);

  const setQrImage = useCallback((dataUrl: string | null) => {
    setState((prev) => ({ ...prev, qrImage: dataUrl }));
  }, []);

  const setStampImage = useCallback((dataUrl: string | null) => {
    setState((prev) => ({ ...prev, stampImage: dataUrl }));
  }, []);

  const actions = useMemo(
    () => ({
      setField,
      selectBrand,
      selectEditorJob,
      updateItem,
      removeItem,
      addItem,
      applyPreset,
      reset,
      save,
      download,
      setQrImage,
      setStampImage,
    }),
    [
      setField,
      selectBrand,
      selectEditorJob,
      updateItem,
      removeItem,
      addItem,
      applyPreset,
      reset,
      save,
      download,
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
        brandOptions={brandOptions}
        editorJobOptions={editorJobOptions}
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
