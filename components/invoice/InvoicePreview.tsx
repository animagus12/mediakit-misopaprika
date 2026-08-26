import { forwardRef } from "react";
import {
  buildInvoiceNumber,
  computeBalanceDue,
  computeSubtotal,
  formatInvoiceDate,
  formatMoney,
  lineItemTotal,
} from "@/lib/invoice";
import type { InvoiceContact } from "@/repositories/invoice";
import type { InvoiceFormState } from "./types";
import styles from "./invoice.module.css";

interface InvoicePreviewProps {
  state: InvoiceFormState;
  billedToPlaceholder: InvoiceContact;
}

export const InvoicePreview = forwardRef<HTMLDivElement, InvoicePreviewProps>(
  function InvoicePreview({ state, billedToPlaceholder }, ref) {
    const subtotal = computeSubtotal(state.items);
    const balanceDue = computeBalanceDue(subtotal, state.advance);
    const clientName = state.clientName || billedToPlaceholder.name;
    const clientEmail = state.clientEmail || billedToPlaceholder.email;

    return (
      <div className={styles.page} ref={ref}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={`${styles.band} ${styles.bandTop}`} src="/invoice/band-top.png" alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={`${styles.band} ${styles.bandBottom}`} src="/invoice/band-bottom.png" alt="" />

        <div className={styles.sheet}>
          <div className={styles.titlerow}>
            <div className={styles.rule} />
            <h2>INVOICE</h2>
          </div>

          <div className={styles.meta}>
            <div className={styles.metaLeft}>
              <p className={styles.lbl}>ISSUED TO:</p>
              {state.clientContactName && (
                <p className={styles.val}>{state.clientContactName}</p>
              )}
              <p className={styles.val}>{clientName}</p>
              <p className={styles.val}>{clientEmail}</p>
            </div>
            <div className={styles.metaRight}>
              <p className={styles.lbl}>
                INVOICE NO: <span>{buildInvoiceNumber(state.invoiceNo)}</span>
              </p>
              <p className={styles.val}>DATE: {formatInvoiceDate(state.date)}</p>
              <p className={styles.val}>DUE DATE: {formatInvoiceDate(state.due)}</p>
            </div>
          </div>

          <div className={`${styles.meta} ${styles.metaSecond}`}>
            <div className={styles.metaLeft}>
              <p className={styles.lbl}>PAY TO:</p>
              <p className={styles.val}>{state.payName}</p>
              <p className={styles.val}>{state.payEmail}</p>
            </div>
            <div className={styles.metaRight}>
              <p className={styles.lbl}>PAYMENT METHOD</p>
              {state.paymentMode !== "bank" && (
                <>
                  <p className={styles.val}>
                    <strong>UPI ID:</strong> {state.upi}
                  </p>
                  {state.qrImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={styles.qr} src={state.qrImage} alt="UPI QR code" />
                  )}
                </>
              )}
              {state.paymentMode !== "upi" && (
                <>
                  <p className={styles.val}>
                    <strong>Account name:</strong> {state.bankAccountName}
                  </p>
                  <p className={styles.val}>
                    <strong>Account no:</strong> {state.bankAccountNumber}
                  </p>
                  <p className={styles.val}>
                    <strong>IFSC:</strong> {state.bankIfsc}
                  </p>
                  <p className={styles.val}>
                    <strong>Bank:</strong> {state.bankName}
                  </p>
                </>
              )}
            </div>
          </div>

          <table className={styles.items}>
            <colgroup>
              <col className={styles.colDesc} />
              <col className={styles.colQty} />
              <col className={styles.colPrice} />
              <col className={styles.colTotal} />
            </colgroup>
            <thead>
              <tr>
                <th>DESCRIPTION</th>
                <th>QTY</th>
                <th>UNIT PRICE</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.desc}
                    {item.sub && <span className={styles.sub}>{item.sub}</span>}
                  </td>
                  <td>{item.qty}</td>
                  <td>{formatMoney(item.price)}</td>
                  <td>{formatMoney(lineItemTotal(item))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className={styles.totals}>
            <colgroup>
              <col className={styles.colDesc} />
              <col className={styles.colQty} />
              <col className={styles.colPrice} />
              <col className={styles.colTotal} />
            </colgroup>
            <tbody>
              <tr className={styles.totalsStrong}>
                <td>SUBTOTAL</td>
                <td></td>
                <td></td>
                <td className={styles.c}>{formatMoney(subtotal)}</td>
              </tr>
              <tr
                className={`${styles.totalsStrong} ${!state.barterOn ? styles.totalsLastline : ""}`}
              >
                <td>ADVANCE RECEIVED</td>
                <td></td>
                <td></td>
                <td className={styles.c}>{formatMoney(state.advance)}</td>
              </tr>
              {state.barterOn && (
                <tr className={`${styles.totalsStrong} ${styles.totalsLastline}`}>
                  <td>Barter Component</td>
                  <td className={styles.qtyCell}>1</td>
                  <td className={styles.c}>{formatMoney(state.barterVal)}</td>
                  <td className={styles.c}>{state.barterStatus}</td>
                </tr>
              )}
              <tr className={styles.totalsDue}>
                <td>BALANCE DUE</td>
                <td></td>
                <td></td>
                <td className={styles.c}>{formatMoney(balanceDue)}</td>
              </tr>
            </tbody>
          </table>

          <div className={styles.pagefoot}>
            <p className={styles.closing}>{state.closing}</p>
            <div className={styles.signrow}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.sq} src="/invoice/squiggle.png" alt="" />
              {state.stampImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.sig} src={state.stampImage} alt="" />
              )}
            </div>
            <p className={styles.gst}>{state.gstNote}</p>
          </div>
        </div>
      </div>
    );
  }
);
