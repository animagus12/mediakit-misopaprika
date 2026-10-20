import {
  buildInvoiceNumber,
  computeBalanceDue,
  computeSubtotal,
  formatInvoiceDate,
  formatMoney,
  lineItemTotal,
} from "@/lib/invoice";
import { SocialIcon } from "@/components/links/SocialIcon";
import type { InvoiceLineItem } from "@/lib/invoice";
import type { InvoiceFormState } from "./types";
import styles from "./invoice.module.css";

interface InvoicePreviewProps {
  state: InvoiceFormState;
}

const FIRST_PAGE_ITEM_LIMIT = 2;
const CONTINUATION_PAGE_ITEM_LIMIT = 4;

function paginateItems(items: InvoiceLineItem[]): InvoiceLineItem[][] {
  if (items.length <= FIRST_PAGE_ITEM_LIMIT) return [items];

  const pages = [items.slice(0, FIRST_PAGE_ITEM_LIMIT)];
  for (let index = FIRST_PAGE_ITEM_LIMIT; index < items.length; index += CONTINUATION_PAGE_ITEM_LIMIT) {
    pages.push(items.slice(index, index + CONTINUATION_PAGE_ITEM_LIMIT));
  }
  return pages;
}

export function InvoicePreview({ state }: InvoicePreviewProps) {
  const subtotal = computeSubtotal(state.items);
  const balanceDue = computeBalanceDue(subtotal, state.advance);
  const instagramHandle = state.instagramHandle.trim().replace(/^@+/, "");
  const youtubeHandle = state.youtubeHandle.trim().replace(/^@+/, "");
  const pages = paginateItems(state.items);

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
          <div className={styles.titlerow}>
            <div className={styles.rule} />
            <h2>INVOICE</h2>
          </div>
          {!isFirstPage && (
            <p className={styles.continued}>
              {buildInvoiceNumber(state.invoiceNo)} · CONTINUED · PAGE {pageIndex + 1} OF {pages.length}
            </p>
          )}

          {isFirstPage && (
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
          )}

          {isFirstPage && (
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
          )}

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
              {pageItems.map((item) => (
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

          {!isLastPage && (
            <p className={styles.continuedFooter}>
              Continued on page {pageIndex + 2} →
            </p>
          )}

          {isLastPage && (
          <>
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
          </>
          )}
        </div>
      </div>
        );
      })}
    </div>
  );
}
