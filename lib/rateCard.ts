import { isCampaignCalledOff } from "@/lib/campaigns";
import type { Campaign } from "@/repositories/campaigns";
import type { MediaKitData } from "@/repositories/mediakit";

// What the media kit says a slot costs, against what the slots actually went
// for. The published prices already existed in data/mediakit.json and the
// deliverables already existed on every deal; nothing here is stored, and the
// two halves had simply never been divided by each other.
//
// Client-safe (no "server-only"), typed structurally on the media kit's
// pricing fields rather than on the whole document, so the discount read can
// be exercised against a card written for the test: same split
// repositories/earnings.ts made when summarizeEarnings came out of the fetch.

export interface RateCard {
  /** Card price for one posted Reel + Story, the base tier. */
  packagePrice: number;
  /** The ad-usage add-on, priced per package. 0 when the card omits it. */
  usagePrice: number;
}

/** The pricing half of the media kit: the only part of it this module reads. */
export type RateCardSource = Pick<MediaKitData, "services" | "addons">;

// The card is typed prose, not numbers: "₹4,500" for a price and "+20%" for
// the rush-delivery surcharge, in the same array. Requiring the currency mark
// is what keeps the surcharge from being read as ₹20.
const CARD_PRICE = /^₹\s*([\d,]+)$/;

export function parseCardPrice(price: string): number | null {
  const match = price.trim().match(CARD_PRICE);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * The card's base package price, and what it charges to license the post.
 *
 * Read positionally, which the fixed-length tuples in MediaKitData make safe:
 * `services` is three ascending tiers and the first is the base posted
 * deliverable, `addons` leads with the ad-usage licence. Matching on the names
 * instead would be matching on free text the creator retypes at will.
 *
 * null when the base tier carries no parseable price, because a realization
 * percentage computed against a card nobody priced is a number with no
 * denominator. Callers render nothing rather than guess a rate.
 */
export function toRateCard(source: RateCardSource): RateCard | null {
  const packagePrice = parseCardPrice(source.services[0]?.price ?? "");
  if (packagePrice === null) return null;
  return { packagePrice, usagePrice: parseCardPrice(source.addons[0]?.price ?? "") ?? 0 };
}

/**
 * How many of a thing a deliverable field names. "5 Reels" is 5, "None" is 0.
 *
 * The stored vocabulary is fixed (see REEL_OPTIONS / STORY_OPTIONS in
 * lib/campaigns.ts) but a record edited by hand carries whatever it carries,
 * so this reads the leading count rather than matching the whole phrase.
 */
export function deliverableCount(value: string): number {
  const match = value.trim().match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
}

/**
 * What the card says a deal's deliverables were worth.
 *
 * The reel is the billable unit and the story rides with it, because that is
 * how the card is written: its base line is "Instagram Reel + Story" at one
 * price, and there is no reel-only and no story-only price to fall back on.
 * A deal posted without a story is therefore still valued at the package rate,
 * which is the honest reading of a card that does not discount for it: the two
 * Blinkit deals close above 100% on that basis, and they did.
 *
 * A licensed deal is priced at the higher tier, since the card sells ad usage
 * as a named add-on rather than throwing it in.
 *
 * 0 when the deal names no reel, which is a deal the card does not price
 * rather than a deal worth nothing.
 */
export function cardValueOf(
  deal: Pick<Campaign, "reels" | "usage">,
  card: RateCard
): number {
  const packages = deliverableCount(deal.reels);
  if (packages === 0) return 0;
  const licensed = deal.usage.months > 0 ? card.usagePrice : 0;
  return packages * (card.packagePrice + licensed);
}

export interface RateRealization {
  /** Deals carrying both a card-priced deliverable and an agreed value. */
  deals: number;
  /** Reel + Story packages across those deals: the denominator's unit. */
  packages: number;
  /** What the card says those packages were worth. */
  cardValue: number;
  /** What they actually closed for, cash and barter together. */
  value: number;
  /** The cash half alone. */
  cash: number;
  /** value as a percentage of cardValue. */
  valuePercent: number;
  /** cash as a percentage of cardValue: the same read with barter taken out. */
  cashPercent: number;
  /** Mean close per package, to set beside the card's own number. */
  averagePackageValue: number;
  /** The card's base price, so a caller can name what it is comparing to. */
  packagePrice: number;
  /**
   * Deals dropped for carrying no value at all.
   *
   * Surfaced rather than swallowed: they are the part of the book this figure
   * cannot see, and a realization rate quoted without its denominator's holes
   * is the kind of number that gets acted on twice.
   */
  unpriced: number;
}

/**
 * The single most useful number this dataset produces: what the creator
 * actually closes at, against what the media kit asks for.
 *
 * Called-off deals are dropped, the same exclusion every money figure in the
 * app makes. Deals recorded at ₹0 are dropped too, and counted separately: a
 * deal nobody priced is not a deal closed for nothing, and folding the two
 * free-product barters in the current book into the average as 0% of card
 * would move the headline by roughly five points on evidence that does not
 * exist. A deal still in the pipeline is kept, because this measures the price
 * that was agreed, not the work that was delivered.
 *
 * null when nothing in the book can be priced against the card, so callers
 * render nothing rather than a percentage of zero.
 */
export function computeRateRealization(
  campaigns: Campaign[],
  card: RateCard | null
): RateRealization | null {
  if (card === null) return null;

  let deals = 0;
  let packages = 0;
  let cardValue = 0;
  let value = 0;
  let cash = 0;
  let unpriced = 0;

  for (const campaign of campaigns) {
    if (isCampaignCalledOff(campaign.status)) continue;

    const dealCardValue = cardValueOf(campaign, card);
    if (dealCardValue <= 0) continue;

    if (campaign.total <= 0) {
      unpriced += 1;
      continue;
    }

    deals += 1;
    packages += deliverableCount(campaign.reels);
    cardValue += dealCardValue;
    value += campaign.total;
    cash += campaign.amount;
  }

  if (cardValue <= 0) return null;

  return {
    deals,
    packages,
    cardValue,
    value,
    cash,
    valuePercent: (value / cardValue) * 100,
    cashPercent: (cash / cardValue) * 100,
    averagePackageValue: packages > 0 ? Math.round(value / packages) : 0,
    packagePrice: card.packagePrice,
    unpriced,
  };
}
