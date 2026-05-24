export type RewardCardFrontHtmlParams = {
  /** HTML-escaped full customer display name (comma added in template). */
  customerDisplayNameEscaped: string;
  displayClaimEscaped: string;
  qrRewardDataUrl: string;
  logoCornerAbsoluteUrl: string;
};

/** Lucide-style Gift outline (stroke) — reads clearly at card scale */
const giftIconSvg = `<svg class="glass-gift-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path fill="none" d="M12 8v13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path fill="none" d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path fill="none" d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Credit-card (ID-1) proportions — see print CSS 85.6mm × 53.98mm. */
export function buildRewardCardFrontHtml(p: RewardCardFrontHtmlParams): string {
  const {
    customerDisplayNameEscaped,
    displayClaimEscaped,
    qrRewardDataUrl,
    logoCornerAbsoluteUrl,
  } = p;

  return `<section class="sheet sheet--front reward-card-page" aria-label="Reward card front">
        <div class="card-noise card-noise--purple" aria-hidden="true"></div>
        <div class="shine shine--purple"></div>
        <div class="vignette" aria-hidden="true"></div>
        <div class="front-inner front-inner--credit">
          <header class="front-header-band">
            <div class="front-header-row1">
              <p class="micro-label">MEMBERS GIFT REWARD</p>
              <img class="front-logo-corner" src="${logoCornerAbsoluteUrl}" alt="" width="28" height="28" />
            </div>
            <p class="front-header-title">Bunny&#8217;s Whisper</p>
          </header>
          <div class="front-col-left">
            <p class="greet">${customerDisplayNameEscaped},</p>
            <p class="thank">Thank you for shopping with us.</p>
            <p class="little-gift">here&#8217;s a little something from us,</p>
            <p class="whisper-note">(shhh&#8230; don&#8217;t tell anyone)</p>
            <div class="front-col-spacer" aria-hidden="true"></div>
            <div class="glass-panel glass-panel--credit">
              <div class="glass-panel-head">
                <span class="glass-gift-icon">${giftIconSvg}</span>
                <div class="glass-title">YOUR BUNNY POINTS ARE WAITING.</div>
              </div>
              <div class="glass-body">Hidden inside every order is a small thank-you from our members circle. Unlock it once your order arrives.</div>
              <div class="glass-chip">CLAIM YOUR POINTS <span class="glass-chip-arrow" aria-hidden="true">&#8594;</span></div>
            </div>
          </div>
          <aside class="front-col-right qr-module" aria-label="Reward QR">
            <div class="qr-module-glow" aria-hidden="true"></div>
            <div class="qr-panel">
              <div class="qr-frame qr-frame--neon">
                <img class="qr-reward" src="${qrRewardDataUrl}" alt="Reward QR" />
              </div>
              <div class="code-full">${displayClaimEscaped}</div>
              <div class="hint">Scan after delivery. Enter this code manually if needed.</div>
            </div>
          </aside>
        </div>
      </section>`;
}
