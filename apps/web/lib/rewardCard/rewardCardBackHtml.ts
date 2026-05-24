export type RewardCardBackHtmlParams = {
  qrInstagramDataUrl: string;
  qrTiktokDataUrl: string;
  qrFacebookDataUrl: string;
  logoAbsoluteUrl: string;
};

const iconInstagram = `<svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zm0 2a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM17.5 6.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>`;

const iconTiktok = `<svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 4h2.5c.2 1.5 1.3 2.7 2.8 3v2.5c-1.3-.1-2.5-.6-3.5-1.4V14c0 3.3-2.7 6-6 6s-6-2.7-6-6 2.7-6 6-6c.3 0 .7 0 1 .1v2.8c-.3-.1-.7-.2-1-.2-2 0-3.5 1.6-3.5 3.5S8 17.5 10 17.5s3.5-1.6 3.5-3.5V4z"/></svg>`;

const iconFacebook = `<svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13 10h3l-.5 3H13v8h-3v-8H8v-3h2V9.3c0-2 1.2-3.2 3.1-3.2.9 0 1.8.1 2.1.1V10z"/></svg>`;

export function buildRewardCardBackHtml(p: RewardCardBackHtmlParams): string {
  const {
    qrInstagramDataUrl,
    qrTiktokDataUrl,
    qrFacebookDataUrl,
    logoAbsoluteUrl,
  } = p;

  return `<section class="sheet sheet--back reward-card-page" aria-label="Reward card back">
        <div class="card-noise card-noise--purple" aria-hidden="true"></div>
        <div class="shine shine--purple"></div>
        <div class="vignette" aria-hidden="true"></div>
        <div class="back-inner back-inner--credit">
          <div class="back-brand">
            <img class="back-logo" src="${logoAbsoluteUrl}" alt="" width="48" height="48" />
            <div class="back-title">Bunny&#8217;s Whisper</div>
            <div class="back-subtitle">STAY CLOSE &#8212; SCAN TO FOLLOW</div>
          </div>
          <div class="social-grid-wrap">
            <div class="social-grid social-grid--credit">
              <div class="social-cell">
                <div class="social-glow" aria-hidden="true"></div>
                <div class="social-frame social-frame--neon">
                  <img class="social-qr" src="${qrInstagramDataUrl}" alt="Instagram QR" />
                </div>
                <div class="social-label-row">${iconInstagram}<span class="social-label">Instagram</span></div>
              </div>
              <div class="social-cell">
                <div class="social-glow" aria-hidden="true"></div>
                <div class="social-frame social-frame--neon">
                  <img class="social-qr" src="${qrTiktokDataUrl}" alt="TikTok QR" />
                </div>
                <div class="social-label-row">${iconTiktok}<span class="social-label">TikTok</span></div>
              </div>
              <div class="social-cell">
                <div class="social-glow" aria-hidden="true"></div>
                <div class="social-frame social-frame--neon">
                  <img class="social-qr" src="${qrFacebookDataUrl}" alt="Facebook QR" />
                </div>
                <div class="social-label-row">${iconFacebook}<span class="social-label">Facebook</span></div>
              </div>
            </div>
          </div>
          <p class="back-footer">Official social channels &#8212; scan to connect with Bunny&#8217;s Whisper.</p>
          <div class="back-heart" aria-hidden="true">
            <svg class="back-heart-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M12 21s-6.716-4.9-9.333-8.333C.5 10.5.5 7.5 3 5c2.5-2.5 6.5-2.5 9 1 2.5-3.5 6.5-3.5 9-1 2.5 2.5 2.5 5.5-.667 7.667L12 21z"/></svg>
          </div>
        </div>
      </section>`;
}
