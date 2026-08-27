"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildInvoiceNumber, formatInvoiceStatus, INVOICE_STATUS_OPTIONS } from "@/lib/invoice";
import type { InvoiceContact, InvoicePaymentMode, InvoicePreset } from "@/repositories/invoice";
import type { InvoiceStatus } from "@/repositories/invoices";
import { InvoiceImageUploadField } from "./InvoiceImageUploadField";
import { InvoiceLineItemEditor } from "./InvoiceLineItemEditor";
import type { InvoiceFormActions, InvoiceFormState } from "./types";
import styles from "./invoice.module.css";

interface InvoiceControlsProps {
  state: InvoiceFormState;
  actions: InvoiceFormActions;
  brandHandle: string;
  presets: InvoicePreset[];
  billedToPlaceholder: InvoiceContact;
  takenInvoiceNumbers: string[];
  isSaving: boolean;
  isExisting: boolean;
  onImageUploadError: (message: string) => void;
}

export function InvoiceControls({
  state,
  actions,
  brandHandle,
  presets,
  billedToPlaceholder,
  takenInvoiceNumbers,
  isSaving,
  isExisting,
  onImageUploadError,
}: InvoiceControlsProps) {
  const numberClash = Boolean(state.invoiceNo.trim()) && takenInvoiceNumbers.includes(state.invoiceNo.trim());

  return (
    <aside className={styles.panel}>
      <Link
        href="/invoice-generator"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        All invoices
      </Link>

      <div className={styles.brandbar}>
        <h1>INVOICE</h1>
        <span>{brandHandle}</span>
      </div>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Invoice</legend>
        <Label className={styles.fieldLabel} htmlFor="invoiceNo">
          Number
        </Label>
        <Input
          id="invoiceNo"
          inputMode="numeric"
          value={state.invoiceNo}
          onChange={(e) => actions.setField("invoiceNo", e.target.value)}
        />
        {numberClash && (
          <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
            {buildInvoiceNumber(state.invoiceNo)} is already used by another invoice.
          </p>
        )}

        <Label className={styles.fieldLabel} htmlFor="invoiceStatus">
          Status
        </Label>
        <Select
          value={state.status}
          onValueChange={(value) => actions.setField("status", value as InvoiceStatus)}
        >
          <SelectTrigger id="invoiceStatus" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INVOICE_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {formatInvoiceStatus(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className={`${styles.row} ${styles.rowTight}`}>
          <div>
            <Label className={styles.fieldLabel} htmlFor="invoiceDate">
              Date
            </Label>
            <Input
              id="invoiceDate"
              type="date"
              value={state.date}
              onChange={(e) => actions.setField("date", e.target.value)}
            />
          </div>
          <div>
            <Label className={styles.fieldLabel} htmlFor="invoiceDue">
              Due
            </Label>
            <Input
              id="invoiceDue"
              type="date"
              value={state.due}
              onChange={(e) => actions.setField("due", e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Billed to</legend>
        <Label className={styles.fieldLabel} htmlFor="clientContactName">
          Name (optional)
        </Label>
        <Input
          id="clientContactName"
          placeholder="Contact person"
          value={state.clientContactName}
          onChange={(e) => actions.setField("clientContactName", e.target.value)}
        />
        <Label className={styles.fieldLabel} htmlFor="clientName">
          Brand
        </Label>
        <Input
          id="clientName"
          placeholder={billedToPlaceholder.name}
          value={state.clientName}
          onChange={(e) => actions.setField("clientName", e.target.value)}
        />
        <Label className={styles.fieldLabel} htmlFor="clientEmail">
          Email
        </Label>
        <Input
          id="clientEmail"
          placeholder={billedToPlaceholder.email}
          value={state.clientEmail}
          onChange={(e) => actions.setField("clientEmail", e.target.value)}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Deliverables</legend>
        <Label className={styles.fieldLabel} htmlFor="preset">
          Quick fill
        </Label>
        <Select onValueChange={(value) => actions.applyPreset(value)}>
          <SelectTrigger id="preset" className="w-full">
            <SelectValue placeholder="Choose a package…" />
          </SelectTrigger>
          <SelectContent>
            {presets.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {state.items.map((item, index) => (
          <InvoiceLineItemEditor
            key={item.id}
            item={item}
            index={index}
            canRemove={state.items.length > 1}
            onChange={actions.updateItem}
            onRemove={actions.removeItem}
          />
        ))}

        <Button type="button" variant="outline" className="mt-2.5 w-full" onClick={actions.addItem}>
          + Add line
        </Button>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Money</legend>
        <Label className={styles.fieldLabel} htmlFor="advance">
          Advance received (₹)
        </Label>
        <Input
          id="advance"
          type="number"
          min={0}
          step={1}
          value={state.advance}
          onChange={(e) => actions.setField("advance", Number(e.target.value))}
        />

        <div className={styles.toggle}>
          <Checkbox
            id="barterOn"
            checked={state.barterOn}
            onCheckedChange={(checked) => actions.setField("barterOn", checked === true)}
          />
          <Label htmlFor="barterOn" className={styles.toggleLabel}>
            Show barter component
          </Label>
        </div>

        {state.barterOn && (
          <div className={`${styles.row} ${styles.rowTight}`}>
            <div>
              <Label className={styles.fieldLabel} htmlFor="barterVal">
                Barter value (₹)
              </Label>
              <Input
                id="barterVal"
                type="number"
                min={0}
                step={1}
                value={state.barterVal}
                onChange={(e) => actions.setField("barterVal", Number(e.target.value))}
              />
            </div>
            <div>
              <Label className={styles.fieldLabel} htmlFor="barterStatus">
                Status
              </Label>
              <Input
                id="barterStatus"
                value={state.barterStatus}
                onChange={(e) => actions.setField("barterStatus", e.target.value)}
              />
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Branding</legend>
        {state.paymentMode !== "bank" && (
          <InvoiceImageUploadField
            label="UPI QR code"
            value={state.qrImage}
            onChange={actions.setQrImage}
            onError={onImageUploadError}
          />
        )}
        <div className="mt-2.5">
          <InvoiceImageUploadField
            label="Stamp / seal"
            value={state.stampImage}
            onChange={actions.setStampImage}
            onError={onImageUploadError}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Your details</legend>
        <Label className={styles.fieldLabel} htmlFor="payName">
          Name
        </Label>
        <Input
          id="payName"
          value={state.payName}
          onChange={(e) => actions.setField("payName", e.target.value)}
        />
        <Label className={styles.fieldLabel} htmlFor="payEmail">
          Email
        </Label>
        <Input
          id="payEmail"
          value={state.payEmail}
          onChange={(e) => actions.setField("payEmail", e.target.value)}
        />

        <Label className={styles.fieldLabel} htmlFor="paymentMode">
          Payment method shown
        </Label>
        <Select
          value={state.paymentMode}
          onValueChange={(value) => actions.setField("paymentMode", value as InvoicePaymentMode)}
        >
          <SelectTrigger id="paymentMode" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="upi">UPI ID + QR</SelectItem>
            <SelectItem value="bank">Bank details</SelectItem>
            <SelectItem value="both">Both</SelectItem>
          </SelectContent>
        </Select>

        {state.paymentMode !== "bank" && (
          <>
            <Label className={styles.fieldLabel} htmlFor="upi">
              UPI ID
            </Label>
            <Input
              id="upi"
              value={state.upi}
              onChange={(e) => actions.setField("upi", e.target.value)}
            />
          </>
        )}

        {state.paymentMode !== "upi" && (
          <>
            <Label className={styles.fieldLabel} htmlFor="bankAccountName">
              Account holder name
            </Label>
            <Input
              id="bankAccountName"
              value={state.bankAccountName}
              onChange={(e) => actions.setField("bankAccountName", e.target.value)}
            />
            <Label className={styles.fieldLabel} htmlFor="bankAccountNumber">
              Account number
            </Label>
            <Input
              id="bankAccountNumber"
              value={state.bankAccountNumber}
              onChange={(e) => actions.setField("bankAccountNumber", e.target.value)}
            />
            <div className={`${styles.row} ${styles.rowTight}`}>
              <div>
                <Label className={styles.fieldLabel} htmlFor="bankIfsc">
                  IFSC code
                </Label>
                <Input
                  id="bankIfsc"
                  value={state.bankIfsc}
                  onChange={(e) => actions.setField("bankIfsc", e.target.value)}
                />
              </div>
              <div>
                <Label className={styles.fieldLabel} htmlFor="bankName">
                  Bank & branch
                </Label>
                <Input
                  id="bankName"
                  value={state.bankName}
                  onChange={(e) => actions.setField("bankName", e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        <Label className={styles.fieldLabel} htmlFor="gstNote">
          Footer note
        </Label>
        <Input
          id="gstNote"
          value={state.gstNote}
          onChange={(e) => actions.setField("gstNote", e.target.value)}
        />
        <Label className={styles.fieldLabel} htmlFor="closing">
          Closing line
        </Label>
        <Input
          id="closing"
          value={state.closing}
          onChange={(e) => actions.setField("closing", e.target.value)}
        />
      </fieldset>

      <Button
        type="button"
        className="mt-2.5 w-full"
        onClick={actions.save}
        disabled={isSaving}
      >
        {isSaving ? "Saving…" : isExisting ? "Save changes & download PDF" : "Save & download PDF"}
      </Button>
      <Button type="button" variant="outline" className="mt-2.5 w-full" onClick={actions.reset}>
        Reset fields
      </Button>
    </aside>
  );
}
