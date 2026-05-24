import { rewardCardPrintDocumentCss } from '@/lib/rewardCard/printDocumentCss';
import { buildRewardCardBackHtml } from '@/lib/rewardCard/rewardCardBackHtml';
import { buildRewardCardFrontHtml } from '@/lib/rewardCard/rewardCardFrontHtml';

export type RewardCardPrintParams = {
  /** HTML-escaped customer display name (full name; comma added in template). */
  customerDisplayNameEscaped: string;
  displayClaimEscaped: string;
  qrRewardDataUrl: string;
  qrInstagramDataUrl: string;
  qrTiktokDataUrl: string;
  qrFacebookDataUrl: string;
  logoAbsoluteUrl: string;
};

/**
 * Printable insert: page 1 front, page 2 back — ID-1 credit card (85.6mm × 53.98mm each).
 */
export function buildRewardCardPrintHtml(p: RewardCardPrintParams): string {
  const {
    customerDisplayNameEscaped,
    displayClaimEscaped,
    qrRewardDataUrl,
    qrInstagramDataUrl,
    qrTiktokDataUrl,
    qrFacebookDataUrl,
    logoAbsoluteUrl,
  } = p;

  const front = buildRewardCardFrontHtml({
    customerDisplayNameEscaped,
    displayClaimEscaped,
    qrRewardDataUrl,
    logoCornerAbsoluteUrl: logoAbsoluteUrl,
  });

  const back = buildRewardCardBackHtml({
    qrInstagramDataUrl,
    qrTiktokDataUrl,
    qrFacebookDataUrl,
    logoAbsoluteUrl,
  });

  const css = rewardCardPrintDocumentCss;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bunny&apos;s Whisper — Reward card</title>
    <style>${css}
    </style>
  </head>
  <body>
    <div class="preview-stack">
      ${front}
      ${back}
    </div>
    <script>
      window.onload = function () { window.print(); };
    </script>
  </body>
</html>`;
}
