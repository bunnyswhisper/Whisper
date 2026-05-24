/**
 * Two-sided reward card — ID-1 (85.6mm × 53.98mm), purple neon mockup.
 * Screen preview scales typography via vars; print locks mm sizes + physical dimensions.
 */

export const rewardCardPrintDocumentCss = `
:root {
  color-scheme: dark;
}

@media print {
  @page {
    size: 85.6mm 53.98mm;
    margin: 0;
  }
}

@page {
  size: 85.6mm 53.98mm;
  margin: 0;
}

html,
body {
  margin: 0;
  padding: 0;
  background: #07030d;
}

.preview-stack {
  margin: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  justify-content: flex-start;
}

/* --- Tokens: print defaults (mm); screen bumps inside preview-stack below --- */
.reward-card-page {
  --rc-neon: #c084fc;
  --rc-neon-hot: #a855f7;
  --rc-neon-deep: #6b21a8;
  --rc-glow: rgba(168, 85, 247, 0.5);
  --rc-card-edge: rgba(192, 132, 252, 0.42);

  --fs-micro: 1mm;
  --fs-header-title: 1.05mm;
  --fs-name: 2.5mm;
  --fs-thank: 1.38mm;
  --fs-gift: 1.28mm;
  --fs-whisper: 1.05mm;
  --fs-glass-title: 1.08mm;
  --fs-glass-body: 1.02mm;
  --fs-chip: 0.96mm;
  --fs-code: 0.84mm;
  --fs-hint: 0.92mm;
  --fs-back-title: 1.78mm;
  --fs-back-sub: 0.96mm;
  --fs-social-label: 0.88mm;
  --fs-back-footer: 0.86mm;
}

@media screen {
  .preview-stack .reward-card-page {
    --fs-micro: clamp(5px, 1.35vw, 7px);
    --fs-header-title: clamp(5.5px, 1.5vw, 7.5px);
    --fs-name: clamp(12px, 3.6vw, 15px);
    --fs-thank: clamp(7px, 2vw, 9px);
    --fs-gift: clamp(6.5px, 1.85vw, 8.5px);
    --fs-whisper: clamp(5.5px, 1.55vw, 7px);
    --fs-glass-title: clamp(6px, 1.75vw, 8px);
    --fs-glass-body: clamp(5.5px, 1.55vw, 7px);
    --fs-chip: clamp(5.25px, 1.5vw, 6.75px);
    --fs-code: clamp(4.75px, 1.35vw, 6.25px);
    --fs-hint: clamp(4.75px, 1.35vw, 6.25px);
    --fs-back-title: clamp(9px, 2.5vw, 11px);
    --fs-back-sub: clamp(5.25px, 1.45vw, 6.75px);
    --fs-social-label: clamp(4.75px, 1.35vw, 6.25px);
    --fs-back-footer: clamp(4.75px, 1.35vw, 6.25px);
  }
}

.sheet.reward-card-page {
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
  border-radius: 3mm;
  width: min(85.6mm, calc(100vw - 32px));
  aspect-ratio: 85.6 / 53.98;
  height: auto;
  max-width: 100%;
  margin: 0 auto;
  padding: 0;
  border: 1px solid var(--rc-card-edge);
  box-shadow:
    0 0 0 1px rgba(168, 85, 247, 0.12),
    0 0 18px var(--rc-glow),
    0 0 42px rgba(88, 28, 135, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    inset 0 -16mm 28mm rgba(0, 0, 0, 0.55);
}

.sheet--front,
.sheet--back {
  background:
    radial-gradient(ellipse 100% 85% at 14% 10%, rgba(168, 85, 247, 0.3), transparent 56%),
    radial-gradient(ellipse 95% 75% at 90% 86%, rgba(124, 58, 237, 0.24), transparent 52%),
    radial-gradient(ellipse 70% 55% at 50% 102%, rgba(88, 28, 135, 0.38), transparent 58%),
    linear-gradient(168deg, #1c0d2e 0%, #140a22 35%, #0a0514 68%, #030206 100%);
}

.card-noise--purple {
  position: absolute;
  inset: -45%;
  opacity: 0.065;
  mix-blend-mode: overlay;
  pointer-events: none;
  background-image:
    repeating-linear-gradient(
      92deg,
      rgba(216, 180, 254, 0.08) 0px,
      rgba(216, 180, 254, 0.08) 1px,
      transparent 1px,
      transparent 3px
    ),
    repeating-linear-gradient(
      2deg,
      rgba(192, 132, 252, 0.06) 0px,
      rgba(192, 132, 252, 0.06) 1px,
      transparent 1px,
      transparent 4px
    );
  transform: rotate(-7deg);
}

.shine--purple {
  position: absolute;
  inset: -45%;
  pointer-events: none;
  background: radial-gradient(
    closest-side at 28% 20%,
    rgba(233, 213, 255, 0.16),
    transparent 58%
  );
  opacity: 0.65;
  mix-blend-mode: screen;
}

.vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  box-shadow: inset 0 0 28mm rgba(0, 0, 0, 0.45);
}

/* ---------- Front ---------- */

.front-inner--credit {
  position: relative;
  z-index: 1;
  height: 100%;
  padding: 1.5mm 1.85mm 1.75mm;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 23mm;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.55mm 1.5mm;
  align-items: stretch;
}

.front-header-band {
  grid-column: 1 / -1;
  grid-row: 1;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.38mm;
  padding-bottom: 0.1mm;
}

.front-header-row1 {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.25mm;
}

.front-header-title {
  margin: 0;
  padding: 0 4mm;
  text-align: center;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  font-size: var(--fs-header-title);
  line-height: 1.12;
  color: rgba(250, 248, 255, 0.94);
  text-shadow:
    0 0 10px rgba(168, 85, 247, 0.45),
    0 0 22px rgba(124, 58, 237, 0.22);
}

.front-col-left {
  grid-column: 1;
  grid-row: 2;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  justify-content: flex-start;
}

.front-col-spacer {
  flex: 1 1 auto;
  min-height: 0;
  max-height: 3.25mm;
  width: 100%;
}

.front-col-right {
  grid-column: 2;
  grid-row: 2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.micro-label {
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: var(--fs-micro);
  line-height: 1.15;
  color: rgba(216, 180, 254, 0.88);
}

.front-logo-corner {
  width: 5.25mm;
  height: 5.25mm;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 0 6px rgba(168, 85, 247, 0.55));
}

.greet {
  margin: 0;
  font-family: ui-serif, Georgia, Cambria, Times New Roman, serif;
  font-weight: 600;
  letter-spacing: 0.02em;
  font-size: var(--fs-name);
  line-height: 1.12;
  color: #faf6ff;
  text-shadow: 0 0 12px rgba(168, 85, 247, 0.22);
}

.thank {
  margin: 0.5mm 0 0;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  font-weight: 500;
  font-size: var(--fs-thank);
  line-height: 1.22;
  color: rgba(248, 245, 255, 0.9);
}

.little-gift {
  margin: 0.35mm 0 0;
  font-family: ui-serif, Georgia, Cambria, Times New Roman, serif;
  font-weight: 400;
  font-style: italic;
  font-size: var(--fs-gift);
  line-height: 1.22;
  color: #f5cce8;
}

.whisper-note {
  margin: 0.28mm 0 0;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  font-weight: 400;
  font-style: normal;
  font-size: var(--fs-whisper);
  line-height: 1.2;
  color: rgba(196, 194, 214, 0.62);
}

.glass-panel--credit {
  margin-top: 0;
  flex-shrink: 0;
  padding: 1.25mm 1.75mm;
  border-radius: 2mm;
  border: 1px solid rgba(192, 132, 252, 0.45);
  background:
    linear-gradient(
      145deg,
      rgba(24, 12, 42, 0.82),
      rgba(10, 6, 22, 0.92)
    );
  backdrop-filter: blur(10px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 0 14px rgba(168, 85, 247, 0.2),
    0 6px 16px rgba(0, 0, 0, 0.42);
}

.glass-panel-head {
  display: flex;
  align-items: center;
  gap: 1.1mm;
}

.glass-gift-icon {
  flex-shrink: 0;
  color: #e9d5ff;
  filter: drop-shadow(0 0 4px rgba(168, 85, 247, 0.45));
}

.glass-gift-svg {
  display: block;
  width: 5.4mm;
  height: 5.4mm;
}

@media screen {
  .glass-gift-svg {
    width: clamp(20px, 5.2vw, 24px);
    height: clamp(20px, 5.2vw, 24px);
  }
}

.glass-title {
  flex: 1;
  min-width: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 800;
  font-size: var(--fs-glass-title);
  line-height: 1.18;
  color: #f5d0fe;
  text-shadow: 0 0 10px rgba(168, 85, 247, 0.35);
}

.glass-body {
  margin-top: 0.45mm;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  font-weight: 400;
  font-size: var(--fs-glass-body);
  line-height: 1.28;
  color: rgba(248, 245, 255, 0.92);
}

.glass-chip {
  margin-top: 0.55mm;
  display: inline-flex;
  align-items: center;
  gap: 0.35mm;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 800;
  font-size: var(--fs-chip);
  color: #fde6f6;
  text-shadow: 0 0 8px rgba(168, 85, 247, 0.35);
}

.glass-chip-arrow {
  font-weight: 700;
  opacity: 0.95;
}

.qr-module {
  position: relative;
}

.qr-module-glow {
  position: absolute;
  inset: -22%;
  border-radius: 4mm;
  background: radial-gradient(circle at 50% 48%, rgba(168, 85, 247, 0.55), transparent 62%);
  opacity: 0.65;
  filter: blur(5px);
  pointer-events: none;
}

.qr-panel {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.42mm;
}

.qr-frame--neon {
  padding: 0.75mm;
  border-radius: 1.6mm;
  border: 1.5px solid rgba(216, 180, 254, 0.75);
  background: linear-gradient(180deg, #ffffff 0%, #faf8ff 100%);
  box-shadow:
    0 0 12px rgba(168, 85, 247, 0.62),
    0 0 28px rgba(124, 58, 237, 0.35),
    0 0 44px rgba(88, 28, 135, 0.22),
    inset 0 0 0 1px rgba(255, 255, 255, 0.95);
}

.qr-reward {
  width: 15.75mm;
  height: 15.75mm;
  display: block;
}

.code-full {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
  font-weight: 700;
  letter-spacing: 0.025em;
  font-size: var(--fs-code);
  line-height: 1.12;
  color: #f5f3ff;
  text-align: center;
  white-space: nowrap;
  max-width: 100%;
}

.hint {
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  font-weight: 400;
  font-size: var(--fs-hint);
  line-height: 1.2;
  color: rgba(210, 208, 222, 0.76);
  text-align: center;
}

/* ---------- Back ---------- */

.back-inner--credit {
  position: relative;
  z-index: 1;
  height: 100%;
  padding: 1.2mm 1.75mm 1.35mm;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.35mm;
}

.social-grid-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.15mm 0 0.2mm;
}

.social-grid--credit {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.05mm;
  align-items: end;
}

.back-brand {
  text-align: center;
  flex-shrink: 0;
}

.back-logo {
  width: 6.75mm;
  height: 6.75mm;
  object-fit: contain;
  filter: drop-shadow(0 0 8px rgba(168, 85, 247, 0.55));
}

.back-title {
  margin-top: 0.25mm;
  font-family: ui-serif, Georgia, Cambria, Times New Roman, serif;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: var(--fs-back-title);
  line-height: 1.08;
  color: #faf6ff;
  text-shadow: 0 0 14px rgba(168, 85, 247, 0.45);
}

.back-subtitle {
  margin-top: 0.28mm;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  font-size: var(--fs-back-sub);
  line-height: 1.12;
  color: rgba(216, 180, 254, 0.78);
}

.social-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.28mm;
}

.social-glow {
  position: absolute;
  inset: -18% -8% -10%;
  border-radius: 3mm;
  background: radial-gradient(circle at 50% 42%, rgba(168, 85, 247, 0.42), transparent 62%);
  opacity: 0.55;
  filter: blur(4px);
  pointer-events: none;
}

.social-frame--neon {
  padding: 0.55mm;
  border-radius: 1.35mm;
  border: 1.5px solid rgba(216, 180, 254, 0.72);
  background: linear-gradient(180deg, #ffffff 0%, #faf8ff 100%);
  box-shadow:
    0 0 10px rgba(168, 85, 247, 0.52),
    0 0 22px rgba(88, 28, 135, 0.26),
    inset 0 0 0 1px rgba(255, 255, 255, 0.92);
}

.social-qr {
  width: 10.75mm;
  height: 10.75mm;
  display: block;
}

.social-label-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35mm;
}

.social-icon {
  flex-shrink: 0;
  width: 2.6mm;
  height: 2.6mm;
  color: rgba(248, 245, 255, 0.92);
  filter: drop-shadow(0 0 3px rgba(168, 85, 247, 0.35));
}

@media screen {
  .social-icon {
    width: clamp(10px, 2.8vw, 12px);
    height: clamp(10px, 2.8vw, 12px);
  }
}

.social-label {
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 800;
  font-size: var(--fs-social-label);
  line-height: 1.05;
  color: rgba(248, 245, 255, 0.88);
}

.back-footer {
  margin: 0;
  flex-shrink: 0;
  text-align: center;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  font-weight: 400;
  font-size: var(--fs-back-footer);
  line-height: 1.25;
  color: rgba(248, 245, 255, 0.82);
}

.back-heart {
  flex-shrink: 0;
  width: 2.4mm;
  height: 2.4mm;
  margin: 0.2mm auto 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--rc-neon-hot);
  filter: drop-shadow(0 0 4px var(--rc-glow));
}

.back-heart-svg {
  display: block;
  width: 100%;
  height: 100%;
}

@media screen {
  .back-heart {
    width: clamp(9px, 2.4vw, 11px);
    height: clamp(9px, 2.4vw, 11px);
  }
}

/* ---------- Print ---------- */

@media print {
  html,
  body {
    background: #07030d;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .preview-stack {
    padding: 0;
    gap: 0;
    display: block;
  }

  .sheet.reward-card-page {
    width: 85.6mm !important;
    height: 53.98mm !important;
    max-width: none !important;
    aspect-ratio: unset !important;
    border-radius: 2mm !important;
    page-break-after: always;
    page-break-inside: avoid;
    break-after: page;
    break-inside: avoid;
    margin: 0 !important;
  }

  .sheet.reward-card-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }

  .glass-panel--credit {
    backdrop-filter: none !important;
  }

  .qr-module-glow,
  .social-glow {
    opacity: 0.85 !important;
    filter: blur(3px) !important;
  }

  .card-noise--purple {
    opacity: 0.05 !important;
  }

  .shine--purple {
    opacity: 0.55 !important;
  }

  .qr-reward {
    width: 15.75mm !important;
    height: 15.75mm !important;
  }

  .social-qr {
    width: 10.85mm !important;
    height: 10.85mm !important;
  }

  .glass-gift-svg {
    width: 5.4mm !important;
    height: 5.4mm !important;
  }

  .social-icon {
    width: 2.6mm !important;
    height: 2.6mm !important;
  }

  .back-heart {
    width: 2.4mm !important;
    height: 2.4mm !important;
  }
}

@media screen {
  .preview-stack .sheet.reward-card-page {
    width: min(340px, calc(100vw - 32px));
    height: auto;
    aspect-ratio: 85.6 / 53.98;
  }
}
`;
