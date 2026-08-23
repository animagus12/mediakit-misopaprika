"use client";

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
import type { InvoiceContact, InvoicePreset } from "@/repositories/invoice";
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
}

export function InvoiceControls({
  state,
  actions,
  brandHandle,
  presets,
  billedToPlaceholder,
}: InvoiceControlsProps) {
  return (
    <aside className={styles.panel}>
      <div className={styles.brandbar}>
        <h1>INVOICE</h1>
        <span>{brandHandle}</span>
      </div>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Invoice</legend>
        <div className={`${styles.row} ${styles.rowTight}`}>
          <div className={styles.wMd}>
            <Label className={styles.fieldLabel} htmlFor="invoiceNo">
              Number
            </Label>
            <Input
              id="invoiceNo"
              inputMode="numeric"
              value={state.invoiceNo}
              onChange={(e) => actions.setField("invoiceNo", e.target.value)}
            />
          </div>
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
        <InvoiceImageUploadField
          label="UPI QR code"
          value={state.qrImage}
          onChange={actions.setQrImage}
        />
        <div className="mt-2.5">
          <InvoiceImageUploadField
            label="Stamp / seal"
            value={state.stampImage}
            onChange={actions.setStampImage}
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
        <Label className={styles.fieldLabel} htmlFor="upi">
          UPI ID
        </Label>
        <Input
          id="upi"
          value={state.upi}
          onChange={(e) => actions.setField("upi", e.target.value)}
        />
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

      <Button type="button" className="mt-2.5 w-full" onClick={actions.print}>
        Save as PDF
      </Button>
      <Button type="button" variant="outline" className="mt-2.5 w-full" onClick={actions.reset}>
        Reset fields
      </Button>
    </aside>
  );
}
