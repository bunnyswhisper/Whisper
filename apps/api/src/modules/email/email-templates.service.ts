import { Injectable } from '@nestjs/common';

export type EmailTemplatePayload = {
  subject: string;
  html: string;
  text: string;
};

const BRAND = "Bunny's Whisper";
const TAGLINE = 'Luxury Streetwear';
const FONT = 'Segoe UI, Arial, Helvetica, sans-serif';
const CARD_WIDTH = 680;

/** Dark luxury palette — solid hex only (no rgba/gradients) for Gmail iOS. */
const P = {
  outer: '#0B0612',
  shell: '#0B0612',
  card: '#0B0612',
  header: '#0B0612',
  headerLine: '#B86CFF',
  headerSub: '#C9B8E8',
  headerTitle: '#FFFFFF',
  text: '#F4EEFF',
  muted: '#C9B8E8',
  summaryBg: '#12071F',
  summaryRow: '#12071F',
  summaryRowHi: '#1A0F2A',
  summaryBorder: '#3D2E5C',
  summaryLabel: '#C9B8E8',
  summaryValue: '#FFFFFF',
  accent: '#B86CFF',
  accentDark: '#9B4DE8',
  accentHi: '#D4B8FF',
  btnText: '#FFFFFF',
  btnBg: '#9B4DE8',
  cardBorder: '#3D2E5C',
  footer: '#C9B8E8',
  eyebrowBg: '#1A0F2A',
  eyebrowText: '#F4EEFF',
  alert: '#FCA5A5',
};

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function siteUrl(): string {
  return (process.env.FRONTEND_URL?.trim() || 'http://localhost:3000').replace(
    /\/$/,
    '',
  );
}

function preheader(text: string): string {
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${P.outer};background-color:${P.outer};opacity:0;">${esc(text)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`;
}

/** Gmail / Apple Mail dark-mode resistance (solid colors, no rgba). */
function emailDarkModeHeadCss(): string {
  const force = (sel: string, bg: string, fg?: string) => {
    const colorRule = fg
      ? `${sel}{background-color:${bg} !important;color:${fg} !important;}`
      : `${sel}{background-color:${bg} !important;}`;
    return `${colorRule}
    @media (prefers-color-scheme:dark){${colorRule}}
    [data-ogsc] ${sel.replace(/^\./, '.')}{background-color:${bg} !important;${fg ? `color:${fg} !important;` : ''}}
    [data-ogsb] ${sel.replace(/^\./, '.')}{background-color:${bg} !important;${fg ? `color:${fg} !important;` : ''}}`;
  };
  return `
    :root{color-scheme:dark;supported-color-schemes:dark;}
    body,.bw-body{margin:0 !important;padding:0 !important;width:100% !important;background-color:${P.outer} !important;color:${P.text} !important;}
    u + .bw-body .bw-outer{background-color:${P.outer} !important;}
    ${force('.bw-outer', P.outer, P.text)}
    ${force('.bw-shell', P.shell, P.text)}
    ${force('.bw-card', P.card, P.text)}
    ${force('.bw-header', P.header, P.text)}
    ${force('.bw-summary', P.summaryBg)}
    ${force('.bw-summary-row', P.summaryRow, P.summaryValue)}
    ${force('.bw-text', P.card, P.text)}
    ${force('.bw-headline', P.card, P.text)}
    ${force('.bw-muted', P.card, P.muted)}
    ${force('.bw-footer', P.card, P.footer)}
    a.bw-link{color:${P.accentHi} !important;text-decoration:none !important;}
    a{color:${P.accentHi} !important;text-decoration:none !important;}
    .bw-btn a,.bw-btn td{color:${P.btnText} !important;text-decoration:none !important;background-color:${P.btnBg} !important;border-color:${P.accentDark} !important;}
    [data-ogsc] .bw-btn a,[data-ogsb] .bw-btn a{color:${P.btnText} !important;background-color:${P.btnBg} !important;}
  `;
}

function spacer(h: number): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="${h}" style="height:${h}px;line-height:${h}px;font-size:${h}px;">&nbsp;</td></tr></table>`;
}

function paragraph(html: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-family:${FONT};font-size:17px;line-height:1.75;color:${P.text};padding:0 0 22px 0;">${html}</td></tr></table>`;
}

type SummaryRow = {
  label: string;
  value: string;
  highlight?: boolean;
  wrapValue?: boolean;
};

/** Summary rows — side-by-side on desktop; stacks cleanly on narrow screens. */
function summaryCard(rows: SummaryRow[]): string {
  const rowHtml = rows
    .map((row, i) => {
      const isLast = i === rows.length - 1;
      const bg = row.highlight ? P.summaryRowHi : P.summaryRow;
      const borderBottom = isLast
        ? ''
        : `border-bottom:1px solid ${P.summaryBorder};`;
      const valueStyle = `font-family:${FONT};font-size:16px;font-weight:700;line-height:1.45;color:${P.summaryValue};word-break:break-word;overflow-wrap:break-word;background-color:${bg};`;
      const labelStyle = `font-family:${FONT};font-size:11px;font-weight:700;line-height:1.35;color:${P.summaryLabel};text-transform:uppercase;letter-spacing:0.1em;background-color:${bg};`;

      if (row.wrapValue) {
        return `
<tr>
  <td colspan="2" bgcolor="${bg}" class="bw-summary-row" style="background-color:${bg};${borderBottom}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="summary-stack">
      <tr>
        <td class="summary-label" style="padding:14px 20px 6px 20px;${labelStyle}">
          ${esc(row.label)}
        </td>
      </tr>
      <tr>
        <td class="summary-value" style="padding:0 20px 14px 20px;${valueStyle}">
          ${esc(row.value)}
        </td>
      </tr>
    </table>
  </td>
</tr>`;
      }

      return `
<tr>
  <td colspan="2" bgcolor="${bg}" class="bw-summary-row" style="background-color:${bg};${borderBottom}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" valign="top" width="40%" class="summary-label" style="padding:14px 8px 14px 20px;${labelStyle}">
          ${esc(row.label)}
        </td>
        <td align="right" valign="top" width="60%" class="summary-value" style="padding:14px 20px 14px 8px;${valueStyle}text-align:right;">
          ${esc(row.value)}
        </td>
      </tr>
    </table>
  </td>
</tr>`;
    })
    .join('');

  return `
<table role="presentation" class="bw-summary" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${P.summaryBg}" style="border-collapse:collapse;border:1px solid ${P.summaryBorder};background-color:${P.summaryBg};">
  <tr>
    <td bgcolor="${P.summaryBg}" style="background-color:${P.summaryBg};padding:16px 20px 12px 20px;border-bottom:1px solid ${P.summaryBorder};font-family:${FONT};font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:${P.accentHi};text-align:center;">
      Order Summary
    </td>
  </tr>
  ${rowHtml}
</table>`;
}

/** Bulletproof centered CTA — Outlook VML + solid fill for Gmail/iOS. */
function ctaButton(href: string, label: string): string {
  const url = esc(href);
  const text = esc(label);
  const w = 300;
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
  <tr>
    <td align="center" style="padding:8px 0;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:54px;v-text-anchor:middle;width:${w}px;" arcsize="50%" strokecolor="${P.accentDark}" fillcolor="${P.btnBg}">
        <w:anchorlock/>
        <center style="color:${P.btnText};font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;">${text}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <table role="presentation" class="bw-btn" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" bgcolor="${P.btnBg}" style="background-color:${P.btnBg};border-radius:50px;mso-padding-alt:0;">
            <a href="${url}" target="_blank" class="bw-link" style="background-color:${P.btnBg};border:2px solid ${P.accentDark};border-radius:50px;color:${P.btnText};display:inline-block;font-family:${FONT};font-size:17px;font-weight:700;line-height:54px;text-align:center;text-decoration:none;min-width:${w}px;padding:0 36px;-webkit-text-size-adjust:none;mso-color-alt:${P.btnText};">
              ${text}
            </a>
          </td>
        </tr>
      </table>
      <!--<![endif]-->
    </td>
  </tr>
</table>`;
}

function footerNote(extra?: string): string {
  const year = new Date().getFullYear();
  return `
${spacer(28)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="border-top:1px solid ${P.cardBorder};padding-top:28px;font-family:${FONT};font-size:14px;line-height:1.7;color:${P.footer};text-align:center;">
      ${extra ? `<span style="display:block;padding-bottom:12px;color:${P.muted};">${extra}</span>` : ''}
      Keep this email for your records.<br/>
      &copy; ${year} ${esc(BRAND)}. All rights reserved.
    </td>
  </tr>
</table>`;
}

export type LuxuryEmailContent = {
  preheader: string;
  eyebrow: string;
  headline: string;
  bodyHtml: string;
  headlineColor?: string;
};

/** Shared luxury transactional layout for all customer emails. */
export function buildLuxuryEmailLayout(content: LuxuryEmailContent): string {
  const headlineColor = content.headlineColor || P.text;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <meta name="color-scheme" content="dark"/>
  <meta name="supported-color-schemes" content="dark"/>
  <title>${esc(BRAND)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    ${emailDarkModeHeadCss()}
    @media only screen and (max-width:620px) {
      .email-container { width:100% !important; max-width:100% !important; }
      .body-pad { padding-left:20px !important; padding-right:20px !important; }
      .header-pad { padding-left:20px !important; padding-right:20px !important; }
      .summary-label, .summary-value { display:block !important; width:100% !important; max-width:100% !important; text-align:left !important; }
      .summary-value { font-size:16px !important; line-height:1.5 !important; padding-top:4px !important; word-break:break-word !important; overflow-wrap:break-word !important; }
      .summary-stack .summary-label { padding-bottom:6px !important; }
    }
  </style>
</head>
<body class="bw-body" style="margin:0;padding:0;width:100%;background-color:${P.outer};color:${P.text};">
  ${preheader(content.preheader)}
  <table role="presentation" class="bw-outer" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${P.outer}" style="background-color:${P.outer};">
    <tr>
      <td class="bw-shell" align="center" bgcolor="${P.shell}" style="background-color:${P.shell};padding:32px 16px 40px 16px;">
        <table role="presentation" class="email-container bw-card" cellpadding="0" cellspacing="0" border="0" width="${CARD_WIDTH}" bgcolor="${P.card}" style="width:100%;max-width:${CARD_WIDTH}px;border-collapse:collapse;background-color:${P.card};border:1px solid ${P.cardBorder};mso-table-lspace:0;mso-table-rspace:0;">
          <!-- Branded header -->
          <tr>
            <td align="center" bgcolor="${P.header}" class="bw-header header-pad" style="background-color:${P.header};padding:44px 40px 40px 40px;border-radius:20px 20px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="64" align="center">
                      <tr><td height="4" bgcolor="${P.headerLine}" style="background-color:${P.headerLine};font-size:4px;line-height:4px;border-radius:4px;">&nbsp;</td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.38em;text-transform:uppercase;color:${P.headerSub};background-color:${P.header};padding-bottom:14px;">
                    ${esc(TAGLINE)}
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:${FONT};font-size:34px;font-weight:800;line-height:1.1;letter-spacing:0.02em;color:${P.headerTitle};background-color:${P.header};">
                    ${esc(BRAND)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Dark body -->
          <tr>
            <td bgcolor="${P.card}" class="bw-card bw-text body-pad" style="background-color:${P.card};padding:44px 40px 24px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom:22px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                      <tr>
                        <td bgcolor="${P.eyebrowBg}" style="background-color:${P.eyebrowBg};border:1px solid ${P.summaryBorder};border-radius:50px;padding:9px 22px;font-family:${FONT};font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:${P.eyebrowText};">
                          ${esc(content.eyebrow)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="bw-headline" align="center" style="font-family:${FONT};font-size:32px;font-weight:800;line-height:1.2;color:${headlineColor};background-color:${P.card};padding-bottom:30px;text-align:center;">
                    ${esc(content.headline)}
                  </td>
                </tr>
                <tr>
                  <td class="bw-text" style="color:${P.text};background-color:${P.card};">
                    ${content.bodyHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer band -->
          <tr>
            <td bgcolor="${P.card}" class="bw-card bw-footer body-pad" style="background-color:${P.card};padding:0 44px 40px 44px;border-radius:0 0 20px 20px;">
              ${footerNote('You received this message about your Bunny\u2019s Whisper order.')}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

@Injectable()
export class EmailTemplatesService {
  /** Debug / Resend smoke test — same layout as production emails. */
  resendConnectionTest(): EmailTemplatePayload {
    const subject = `${BRAND} — email preview`;
    const bodyHtml = `
${paragraph(`This is a <strong style="color:${P.text};">design preview</strong> of your transactional emails. If you can read this clearly on desktop and mobile, Resend is configured correctly.`)}
${summaryCard([
  { label: 'Reference', value: 'PREVIEW01' },
  { label: 'Payment method', value: 'Test' },
  { label: 'Status', value: 'Confirmed' },
  { label: 'Total', value: 'EGP 0.00', highlight: true },
])}
${spacer(32)}
${ctaButton(`${siteUrl()}/`, 'Visit Bunny\u2019s Whisper')}
`;
    return {
      subject,
      html: buildLuxuryEmailLayout({
        preheader: 'Email design preview from Bunny\u2019s Whisper.',
        eyebrow: 'Connection test',
        headline: 'Your emails are ready',
        bodyHtml,
      }),
      text: `${subject}\n\nIf you received this, Resend and the template layout are working.`,
    };
  }

  orderConfirmation(params: {
    customerName: string;
    orderRef: string;
    total: string;
  }): EmailTemplatePayload {
    const subject = `Your ${BRAND} order is confirmed`;
    const ordersUrl = `${siteUrl()}/account/orders`;
    const bodyHtml = `
${paragraph(`Hi <strong style="color:${P.text};">${esc(params.customerName)}</strong>,`)}
${paragraph(`Thank you for shopping with us. We have received your order and our team is preparing it with care.`)}
${spacer(28)}
${summaryCard([
  { label: 'Reference', value: params.orderRef },
  { label: 'Payment method', value: 'Cash on delivery' },
  { label: 'Status', value: 'Confirmed' },
  { label: 'Total', value: params.total, highlight: true },
])}
${spacer(32)}
${paragraph(`We will email you again when your order ships.`)}
${spacer(8)}
${ctaButton(ordersUrl, 'View my orders')}
`;
    return {
      subject,
      html: buildLuxuryEmailLayout({
        preheader: 'Your order is confirmed. Thank you for shopping with us.',
        eyebrow: 'Order confirmed',
        headline: 'Your order is confirmed',
        bodyHtml,
      }),
      text: [
        subject,
        '',
        `Hi ${params.customerName},`,
        `Reference: ${params.orderRef}`,
        `Total: ${params.total}`,
        `View orders: ${ordersUrl}`,
      ].join('\n'),
    };
  }

  paymentConfirmed(params: {
    customerName: string;
    orderRef: string;
    total: string;
  }): EmailTemplatePayload {
    const subject = `Payment received — your ${BRAND} order is confirmed`;
    const ordersUrl = `${siteUrl()}/account/orders`;
    const bodyHtml = `
${paragraph(`Hi <strong style="color:${P.text};">${esc(params.customerName)}</strong>,`)}
${paragraph(`Your card payment was successful. Your order is confirmed and we are preparing it now.`)}
${spacer(28)}
${summaryCard([
  { label: 'Reference', value: params.orderRef },
  { label: 'Payment method', value: 'Card (Paymob)' },
  { label: 'Payment status', value: 'Paid' },
  { label: 'Total paid', value: params.total, highlight: true },
])}
${spacer(32)}
${paragraph(`You will receive another update when your order ships.`)}
${spacer(8)}
${ctaButton(ordersUrl, 'View my orders')}
`;
    return {
      subject,
      html: buildLuxuryEmailLayout({
        preheader: 'Payment received. Your order is confirmed.',
        eyebrow: 'Payment confirmed',
        headline: 'Payment confirmed',
        bodyHtml,
      }),
      text: [
        subject,
        '',
        `Hi ${params.customerName},`,
        `Order ${params.orderRef} — ${params.total}`,
        ordersUrl,
      ].join('\n'),
    };
  }

  orderShipped(params: {
    customerName: string;
    orderRef: string;
  }): EmailTemplatePayload {
    const subject = `Your ${BRAND} order is on the way`;
    const ordersUrl = `${siteUrl()}/account/orders`;
    const bodyHtml = `
${paragraph(`Hi <strong style="color:${P.text};">${esc(params.customerName)}</strong>,`)}
${paragraph(`Great news — your package has shipped and is on its way to you.`)}
${spacer(28)}
${summaryCard([
  { label: 'Reference', value: params.orderRef },
  { label: 'Status', value: 'Shipped' },
  { label: 'Estimated delivery', value: '2–4 business days' },
])}
${spacer(32)}
${paragraph(`We will notify you when delivery is complete.`)}
${spacer(8)}
${ctaButton(ordersUrl, 'Track my order')}
`;
    return {
      subject,
      html: buildLuxuryEmailLayout({
        preheader: 'Your order has shipped and is on the way.',
        eyebrow: 'Shipping update',
        headline: 'Your order has shipped',
        bodyHtml,
      }),
      text: `${subject}\n\nHi ${params.customerName},\nOrder ${params.orderRef}\n${ordersUrl}`,
    };
  }

  orderCancelled(params: {
    customerName: string;
    orderRef: string;
    cancellationReason: string;
  }): EmailTemplatePayload {
    const subject = `Your ${BRAND} order was cancelled`;
    const ordersUrl = `${siteUrl()}/account/orders`;
    const bodyHtml = `
${paragraph(`Hi <strong style="color:${P.text};">${esc(params.customerName)}</strong>,`)}
${paragraph(`We are writing to let you know that your order has been cancelled.`)}
${spacer(24)}
${summaryCard([
  { label: 'Reference', value: params.orderRef },
  { label: 'Status', value: 'Cancelled' },
  {
    label: 'Reason',
    value: params.cancellationReason,
    highlight: true,
    wrapValue: true,
  },
])}
${spacer(32)}
${ctaButton(ordersUrl, 'View my orders')}
`;
    return {
      subject,
      html: buildLuxuryEmailLayout({
        preheader: 'Your order was cancelled.',
        eyebrow: 'Order cancelled',
        headline: 'Your order was cancelled',
        bodyHtml,
        headlineColor: P.alert,
      }),
      text: [
        subject,
        '',
        `Hi ${params.customerName},`,
        `Reference: ${params.orderRef}`,
        `Status: Cancelled`,
        `Reason: ${params.cancellationReason}`,
        ordersUrl,
      ].join('\n'),
    };
  }

  orderDelivered(params: {
    customerName: string;
    orderRef: string;
    reviewUrl?: string;
  }): EmailTemplatePayload {
    const subject = `Your ${BRAND} order has arrived`;
    const ordersUrl = `${siteUrl()}/account/orders`;
    const reviewCta = params.reviewUrl
      ? `${spacer(8)}${ctaButton(params.reviewUrl, 'Review your order')}${paragraph(`<span style="color:${P.muted};font-size:15px;">Share a quick rating — your feedback helps us improve.</span>`)}`
      : `${spacer(8)}${ctaButton(ordersUrl, 'View my orders')}`;

    const bodyHtml = `
${paragraph(`Hi <strong style="color:${P.text};">${esc(params.customerName)}</strong>,`)}
${paragraph(`Your order should now be with you. We hope you love every piece — thank you for choosing ${esc(BRAND)}.`)}
${spacer(28)}
${summaryCard([
  { label: 'Reference', value: params.orderRef },
  { label: 'Status', value: 'Delivered' },
])}
${spacer(32)}
${reviewCta}
`;
    return {
      subject,
      html: buildLuxuryEmailLayout({
        preheader: 'Your order was delivered. We would love your feedback.',
        eyebrow: 'Delivered',
        headline: 'Your order was delivered',
        bodyHtml,
      }),
      text: [
        subject,
        '',
        `Hi ${params.customerName},`,
        `Order ${params.orderRef}`,
        params.reviewUrl || ordersUrl,
      ].join('\n'),
    };
  }

  paymentFailed(params: { customerName: string }): EmailTemplatePayload {
    const subject = `Your ${BRAND} payment was not completed`;
    const checkoutUrl = `${siteUrl()}/checkout`;
    const bodyHtml = `
${paragraph(`Hi <strong style="color:${P.text};">${esc(params.customerName)}</strong>,`)}
${paragraph(`We could not confirm your card payment. <strong style="color:${P.alert};">Nothing has been charged.</strong> You can return to checkout and try again when you are ready.`)}
${spacer(32)}
${ctaButton(checkoutUrl, 'Return to checkout')}
`;
    return {
      subject,
      html: buildLuxuryEmailLayout({
        preheader: 'Payment not completed. You can try again safely.',
        eyebrow: 'Payment issue',
        headline: 'Payment was not completed',
        bodyHtml,
        headlineColor: P.alert,
      }),
      text: `${subject}\n\nHi ${params.customerName}\n${checkoutUrl}`,
    };
  }

  paymentExpired(params: { customerName: string }): EmailTemplatePayload {
    const subject = `Your ${BRAND} payment session expired`;
    const checkoutUrl = `${siteUrl()}/checkout`;
    const bodyHtml = `
${paragraph(`Hi <strong style="color:${P.text};">${esc(params.customerName)}</strong>,`)}
${paragraph(`Your secure payment session timed out. Your order may still be waiting — open checkout again to complete payment safely.`)}
${spacer(32)}
${ctaButton(checkoutUrl, 'Complete payment')}
`;
    return {
      subject,
      html: buildLuxuryEmailLayout({
        preheader: 'Payment session expired. Restart checkout.',
        eyebrow: 'Session expired',
        headline: 'Payment session expired',
        bodyHtml,
        headlineColor: P.alert,
      }),
      text: `${subject}\n\nHi ${params.customerName}\n${checkoutUrl}`,
    };
  }

  abandonedCartReminder(params: {
    customerName: string;
    itemsHint?: string;
  }): EmailTemplatePayload {
    const subject = `You left something beautiful behind — ${BRAND}`;
    const cartUrl = `${siteUrl()}/cart`;
    const hint = esc(
      params.itemsHint ||
        'Items you loved are still saved. Complete your order before they slip away.',
    );
    const bodyHtml = `
${paragraph(`Hi <strong style="color:${P.text};">${esc(params.customerName)}</strong>,`)}
${paragraph(hint)}
${spacer(32)}
${ctaButton(cartUrl, 'Return to your cart')}
`;
    return {
      subject,
      html: buildLuxuryEmailLayout({
        preheader: 'Your cart is waiting for you.',
        eyebrow: 'Cart reminder',
        headline: 'Your cart is waiting',
        bodyHtml,
      }),
      text: `${subject}\n\nHi ${params.customerName}\n${cartUrl}`,
    };
  }

  lowStockAdminAlert(params: {
    productName: string;
    skuOrVariant?: string;
    quantityLeft: number;
  }): EmailTemplatePayload {
    const subject = `[${BRAND}] Low stock: ${params.productName}`;
    const adminUrl = `${siteUrl()}/admin/inventory`;
    const bodyHtml = `
${paragraph(`<strong style="color:${P.text};">${esc(params.productName)}</strong>${params.skuOrVariant ? `<br/><span style="color:${P.muted};font-size:15px;">${esc(params.skuOrVariant)}</span>` : ''}`)}
${spacer(24)}
${summaryCard([
  {
    label: 'Estimated quantity left',
    value: String(params.quantityLeft),
    highlight: true,
  },
])}
${spacer(32)}
${ctaButton(adminUrl, 'Open inventory')}
`;
    return {
      subject,
      html: buildLuxuryEmailLayout({
        preheader: 'Low stock alert for admin.',
        eyebrow: 'Admin alert',
        headline: 'Inventory alert',
        bodyHtml,
      }),
      text: `${subject}\n\nQty: ${params.quantityLeft}\n${adminUrl}`,
    };
  }
}
