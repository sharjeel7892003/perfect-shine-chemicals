/**
 * Isolated multi-page print utility for Perfect Shine Chemicals POS & ERP.
 * 
 * Clones the printable section into an isolated, headless iframe to guarantee
 * full document flow, unclipped multi-page pagination across all browser engines,
 * repeating table headers (thead), clean page margins, white backgrounds with crisp black text,
 * and zero interference from host modal scrollboxes or dark-mode layout shells.
 */

export interface PrintOptions {
  orientation?: 'portrait' | 'landscape';
  pageMargins?: string;
}

export const printElement = (
  elementId: string, 
  documentTitle?: string,
  options?: PrintOptions
): Promise<boolean> => {
  return new Promise((resolve) => {
    const targetElement = document.getElementById(elementId);
    if (!targetElement) {
      console.warn(`[printHelper] Target element with ID "${elementId}" not found. Falling back to window.print().`);
      window.print();
      resolve(false);
      return;
    }

    try {
      // 1. Create a sandboxed printing iframe attached to body (rendered offscreen/transparently so Chromium generates layout)
      const iframe = document.createElement('iframe');
      iframe.setAttribute('id', `psc-print-frame-${Date.now()}`);
      iframe.style.position = 'fixed';
      iframe.style.left = '0';
      iframe.style.top = '0';
      iframe.style.width = '100vw';
      iframe.style.height = '100vh';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document;
      if (!frameDoc) {
        document.body.removeChild(iframe);
        window.print();
        resolve(false);
        return;
      }

      // 2. Clone all active stylesheet links and <style> tags from the host document
      let styleSheetsHtml = '';
      document.querySelectorAll('link[rel="stylesheet"], style').forEach(node => {
        styleSheetsHtml += node.outerHTML;
      });

      const title = documentTitle || 'Statement of Accounts — Perfect Shine Chemicals';
      const isLandscape = options?.orientation === 'landscape';
      const pageSize = isLandscape ? 'A4 landscape' : 'A4 portrait';
      const pageMargin = options?.pageMargins || (isLandscape ? '10mm 10mm 12mm 10mm' : '12mm 10mm 15mm 10mm');

      // 3. Populate iframe document with clean, unconstrained paginated structure
      frameDoc.open();
      frameDoc.write(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <title>${title}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            ${styleSheetsHtml}
            <style>
              @page {
                size: ${pageSize};
                margin: ${pageMargin};
                @bottom-right {
                  content: "Page " counter(page);
                  font-family: inherit;
                  font-size: 9px;
                  color: #64748b;
                }
              }
              html, body {
                background: #ffffff !important;
                background-color: #ffffff !important;
                color: #0f172a !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                min-height: 100% !important;
                height: auto !important;
                overflow: visible !important;
                font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                font-size: 11px !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              /* Ensure the printed root and all children are explicitly visible in the iframe */
              #print-root,
              #print-root * {
                visibility: visible !important;
              }
              /* Strip any container height, fixed position, or overflow restrictions */
              #${elementId},
              #${elementId} > div,
              .printable-table-wrapper {
                position: static !important;
                display: block !important;
                width: 100% !important;
                max-width: 100% !important;
                height: auto !important;
                max-height: none !important;
                min-height: 0 !important;
                overflow: visible !important;
                box-shadow: none !important;
                border: none !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              .no-print {
                display: none !important;
              }
              table {
                width: 100% !important;
                border-collapse: collapse !important;
                page-break-inside: auto !important;
                break-inside: auto !important;
              }
              thead {
                display: table-header-group !important;
              }
              tfoot {
                display: table-footer-group !important;
              }
              tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              td, th {
                word-break: break-word;
              }
              /* Clean light mode overrides for dark theme classes when printed */
              [class*="bg-slate-"], [class*="bg-zinc-"], [class*="bg-gray-"] {
                background-color: transparent !important;
                color: #0f172a !important;
              }
              [class*="text-white"], [class*="text-slate-1"], [class*="text-slate-2"], [class*="text-slate-3"], [class*="text-slate-4"] {
                color: #0f172a !important;
              }
              [class*="border-slate-8"], [class*="border-slate-7"], [class*="border-slate-9"] {
                border-color: #e2e8f0 !important;
              }
            </style>
          </head>
          <body>
            <div id="print-root">
              ${targetElement.outerHTML}
            </div>
          </body>
        </html>
      `);
      frameDoc.close();

      // 4. Trigger print once iframe DOM and images are fully flushed
      const executePrint = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (printErr) {
          console.error('[printHelper print error]:', printErr);
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
            resolve(true);
          }, 1500);
        }
      };

      // Ensure images in iframe (like company logo) are loaded before calling print
      const checkAndPrint = () => {
        const imgs = Array.from(frameDoc.images);
        if (imgs.length > 0) {
          Promise.all(imgs.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(r => { 
              img.onload = r; 
              img.onerror = r; 
              setTimeout(r, 500); // 500ms timeout per image
            });
          })).then(() => {
            setTimeout(executePrint, 150);
          });
        } else {
          executePrint();
        }
      };

      if (iframe.contentWindow) {
        iframe.contentWindow.onload = checkAndPrint;
        // Fallback in case onload is swallowed
        setTimeout(checkAndPrint, 600);
      } else {
        checkAndPrint();
      }
    } catch (err) {
      console.error('[printHelper error]:', err);
      window.print();
      resolve(false);
    }
  });
};
