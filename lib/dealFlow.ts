import { isCampaignCalledOff } from "@/lib/campaigns";
import type { Campaign } from "@/repositories/campaigns";

// What happens to a deal between agreeing it and being paid for it: what is
// promised and not yet delivered, and what never made it at all.
//
// Both figures were on the record already and neither was ever added up. The
// dashboard listed the pipeline deals as cards without valuing them, and the
// cancelled and scam rows were filed under a tab where they could be read one
// at a time but never counted.

export interface PipelineValue {
  /** Deals agreed and not yet finished: everything short of a terminal status. */
  count: number;
  total: number;
  cash: number;
  barter: number;
  /**
   * Deals in the pipeline carrying no value yet.
   *
   * Counted apart from `count` rather than dropped: an unpriced deal is real
   * work that is coming, and a pipeline that says "3 deals, ₹2,449" without
   * saying one of them has no number on it is overstating how much of the
   * pipeline is actually known.
   */
  unpriced: number;
}

/**
 * Committed but not delivered.
 *
 * Defined as every deal still in an active stage rather than by naming
 * Brainstorming and Todo, which is what the current book happens to hold.
 * repositories/campaigns.ts settles this once, by whitelisting the three
 * terminal statuses and calling everything else active, on the stated grounds
 * that new pipeline stages appear far more often than new terminal ones. A
 * list of pipeline statuses here would be a second copy of that rule, and the
 * copy that silently stops counting the day a stage is added.
 */
export function computePipelineValue(campaigns: Campaign[]): PipelineValue {
  const pipeline: PipelineValue = { count: 0, total: 0, cash: 0, barter: 0, unpriced: 0 };

  for (const campaign of campaigns) {
    if (campaign.stage !== "active") continue;

    pipeline.count += 1;
    pipeline.total += campaign.total;
    pipeline.cash += campaign.amount;
    pipeline.barter += campaign.barterValue;
    if (campaign.total <= 0) pipeline.unpriced += 1;
  }

  return pipeline;
}

export interface FallthroughRate {
  /** Every deal ever recorded, including the lost ones. */
  total: number;
  /** Deals that came to nothing: called off, marked a scam, or both. */
  lost: number;
  /** Called off, whether the record says Cancelled or Redacted. */
  calledOff: number;
  /** Marked type Scam, which a record can be while its status says anything. */
  scam: number;
  percent: number;
  /** What the lost deals had been agreed at, where they were priced at all. */
  lostValue: number;
}

export const EMPTY_FALLTHROUGH: FallthroughRate = {
  total: 0,
  lost: 0,
  calledOff: 0,
  scam: 0,
  percent: 0,
  lostValue: 0,
};

/**
 * The share of the book that came to nothing.
 *
 * A deal is lost if it was called off or if it was a scam, counted once when
 * it was both, which is the normal case: a scam is usually discovered and then
 * redacted, and adding the two categories would report a fallthrough rate
 * higher than the number of deals that actually fell through.
 *
 * "Called off" covers Cancelled and Redacted together, through the same
 * isCampaignCalledOff every money figure in the app reads: a deal written out
 * of the record did not happen, and the two words for that are one fact.
 *
 * The denominator is every deal on the record, lost ones included. It is the
 * one figure in the app that deliberately does not exclude them, because they
 * are what it is measuring.
 */
export function computeFallthroughRate(campaigns: Campaign[]): FallthroughRate {
  const rate: FallthroughRate = { ...EMPTY_FALLTHROUGH, total: campaigns.length };

  for (const campaign of campaigns) {
    const calledOff = isCampaignCalledOff(campaign.status);
    const scam = campaign.type === "Scam";
    if (calledOff) rate.calledOff += 1;
    if (scam) rate.scam += 1;
    if (!calledOff && !scam) continue;

    rate.lost += 1;
    rate.lostValue += campaign.total;
  }

  rate.percent = rate.total > 0 ? (rate.lost / rate.total) * 100 : 0;
  return rate;
}
