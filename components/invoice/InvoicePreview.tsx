import {
  buildInvoiceNumber,
  computeBalanceDue,
  computeSubtotal,
  formatInvoiceDate,
  formatMoney,
  lineItemTotal,
} from "@/lib/invoice";
import { splitIntoPages } from "@/lib/invoicePagination";
import { SocialIcon } from "@/components/links/SocialIcon";
import type { InvoiceLineItem } from "@/lib/invoice";
import type { InvoiceFormState } from "./types";
import { measured, useInvoicePageSizes } from "./useInvoicePageSizes";
import styles from "./invoice.module.css";

interface InvoicePreviewProps {
  state: InvoiceFormState;
  /**
   * What the payment ledger says has been received against this invoice: a
   * linked invoice's deal payments, a standalone invoice's own. 0 for an
   * invoice not yet saved.
   */
  amountReceived: number;
}

export function InvoicePreview({ state, amountReceived }: InvoicePreviewProps) {
  const subtotal = computeSubtotal(state.items);
  const balanceDue = computeBalanceDue(subtotal, amountReceived);
  const { measureRef, pageSizes } = useInvoicePageSizes(state.items.length);
  const pages = splitIntoPages(state.items, pageSizes);
  const totals = (
    <InvoiceTotals state={state} subtotal={subtotal} amountReceived={amountReceived} balanceDue={balanceDue} />
  );

  return (
    <div className={styles.pages}>
      {pages.map((pageItems, pageIndex) => {
        const isFirstPage = pageIndex === 0;
        const isLastPage = pageIndex === pages.length - 1;

        return (
          <div className={styles.page} key={pageIndex}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={`${styles.band} ${styles.bandTop}`} src="/invoice/band-top.png" alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={`${styles.band} ${styles.bandBottom}`} src="/invoice/band-bottom.png" alt="" />

            <div className={styles.sheet}>
              <div className={styles.spacerTop} />
              <PageHead state={state} page={pageIndex + 1} pageCount={pages.length} />
              {/* A last page the rows ran out before holds only the totals. */}
              {(isFirstPage || pageItems.length > 0) && <ItemsTable items={pageItems} />}
              {isLastPage && totals}
              <div className={styles.spacerBottom} />
              {isLastPage ? (
                <PageFooter state={state} />
              ) : (
                <p className={styles.continuedFooter}>Continued on page {pageIndex + 2} →</p>
              )}
            </div>
          </div>
        );
      })}

      {/* Every block a page can hold, laid out once at full size for
          useInvoicePageSizes to measure. Its sheet is a real page's height. */}
      <div className={`${styles.page} ${styles.measure}`} aria-hidden inert>
        <div ref={measureRef} className={styles.sheet}>
          <div {...measured("firstHead")}>
            <PageHead state={state} page={1} pageCount={2} />
          </div>
          <div {...measured("continuedHead")}>
            {/* The page numbers only need to be as wide as the real ones. */}
            <PageHead state={state} page={2} pageCount={2} />
          </div>
          <div {...measured("items")}>
            <ItemsTable items={state.items} />
          </div>
          <div {...measured("totals")}>{totals}</div>
          <div {...measured("footer")}>
            <PageFooter state={state} />
          </div>
          <div {...measured("continuedFooter")}>
            <p className={styles.continuedFooter}>Continued on page 2 →</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PageHead({ state, page, pageCount }: { state: InvoiceFormState; page: number; pageCount: number }) {
  return (
    <div>
      <div className={styles.titlerow}>
        <div className={styles.rule} />
        <h2>INVOICE</h2>
      </div>
      {page === 1 ? (
        <InvoiceParties state={state} />
      ) : (
        <p className={styles.continued}>
          {buildInvoiceNumber(state.invoiceNo)} · CONTINUED · PAGE {page} OF {pageCount}
        </p>
      )}
    </div>
  );
}

function InvoiceParties({ state }: { state: InvoiceFormState }) {
  const instagramHandle = state.instagramHandle.trim().replace(/^@+/, "");
  const youtubeHandle = state.youtubeHandle.trim().replace(/^@+/, "");

  return (
    <>
      <div className={styles.meta}>
        <div className={styles.metaLeft}>
          <p className={styles.lbl}>ISSUED TO:</p>
          {state.clientContactName && (
            <p className={styles.val}>{state.clientContactName}</p>
          )}
          {state.clientName && <p className={styles.val}>{state.clientName}</p>}
          {state.clientEmail && <p className={styles.val}>{state.clientEmail}</p>}
          {state.clientAddress && <p className={styles.val}>{state.clientAddress}</p>}
          {state.clientPanNumber && (
            <p className={styles.val}><strong>PAN:</strong> {state.clientPanNumber}</p>
          )}
          {state.clientGstNumber && (
            <p className={styles.val}><strong>GST:</strong> {state.clientGstNumber}</p>
          )}
        </div>
        <div className={styles.metaRight}>
          <p className={styles.lbl}>
            INVOICE NO: <span>{buildInvoiceNumber(state.invoiceNo)}</span>
          </p>
          <p className={styles.val}>DATE: {formatInvoiceDate(state.date)}</p>
          <p className={styles.val}>DUE DATE: {formatInvoiceDate(state.due)}</p>
          {state.campaignName && (
            <p className={styles.val}>CAMPAIGN: {state.campaignName}</p>
          )}
        </div>
      </div>

      <div className={`${styles.meta} ${styles.metaSecond}`}>
        <div className={styles.metaLeft}>
          <p className={styles.lbl}>PAY TO:</p>
          <p className={styles.val}>{state.payName}</p>
          <p className={styles.val}>{state.payEmail}</p>
          {state.panNumber && <p className={styles.val}><strong>PAN:</strong> {state.panNumber}</p>}
          {state.address && <p className={styles.val}>{state.address}</p>}
          {state.showInstagram && instagramHandle && (
            <p className={styles.val}>
              <a
                className={styles.socialLink}
                href={`https://www.instagram.com/${encodeURIComponent(instagramHandle)}/`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Instagram profile for @${instagramHandle}`}
              >
                <SocialIcon platform="instagram" size={14} />
                <span>@{instagramHandle}</span>
              </a>
            </p>
          )}
          {state.showYouTube && youtubeHandle && (
            <p className={styles.val}>
              <a
                className={styles.socialLink}
                href={`https://www.youtube.com/@${encodeURIComponent(youtubeHandle)}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`YouTube channel for @${youtubeHandle}`}
              >
                <SocialIcon platform="youtube" size={14} />
                <span>@{youtubeHandle}</span>
              </a>
            </p>
          )}
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
    </>
  );
}

function ItemsTable({ items }: { items: InvoiceLineItem[] }) {
  return (
    <div className={styles.itemsBlock}>
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
          {items.map((item) => (
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
      {/* The rule closes the table outside its rows, so a row is the same
          height wherever it falls on a page. */}
      {items.length > 0 && <div className={styles.itemsEnd} />}
    </div>
  );
}

interface InvoiceTotalsProps {
  state: InvoiceFormState;
  subtotal: number;
  amountReceived: number;
  balanceDue: number;
}

function InvoiceTotals({ state, subtotal, amountReceived, balanceDue }: InvoiceTotalsProps) {
  // Only once something has arrived: a fresh invoice reads Subtotal, then
  // Balance due, with no zero line between them.
  const showReceived = amountReceived > 0;

  return (
    <table className={styles.totals}>
      <colgroup>
        <col className={styles.colDesc} />
        <col className={styles.colQty} />
        <col className={styles.colPrice} />
        <col className={styles.colTotal} />
      </colgroup>
      <tbody>
        <tr
          className={`${styles.totalsStrong} ${!showReceived && !state.barterOn ? styles.totalsLastline : ""}`}
        >
          <td>SUBTOTAL</td>
          <td></td>
          <td></td>
          <td className={styles.c}>{formatMoney(subtotal)}</td>
        </tr>
        {showReceived && (
          <tr
            className={`${styles.totalsStrong} ${!state.barterOn ? styles.totalsLastline : ""}`}
          >
            <td>AMOUNT RECEIVED</td>
            <td></td>
            <td></td>
            <td className={styles.c}>{formatMoney(amountReceived)}</td>
          </tr>
        )}
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
  );
}

function PageFooter({ state }: { state: InvoiceFormState }) {
  return (
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
  );
}
