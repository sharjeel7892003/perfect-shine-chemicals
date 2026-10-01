/**
 * Isolated multi-page print utility for Perfect Shine Chemicals POS & ERP.
 * 
 * Clones the printable section into an isolated, headless iframe to guarantee
 * full document flow, unclipped multi-page pagination across all browser engines,
 * repeating table headers (thead), and zero interference from host modal scrollboxes.
 */

export const printElement = (elementId: string, documentTitle?: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const targetElement = document.getElementById(elementId);
    if (!targetElement) {
      console.warn(`[printHelper] Target element with ID "${elementId}" not found. Falling back to window.print().`);
      window.print();
      resolve(false);
      return;
    }

    try {
      // 1. Create a hidden, sandboxed printing iframe attached to body
      const iframe = document.createElement('iframe');
      iframe.setAttribute('id', `psc-print-frame-${Date.now()}`);
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
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
                size: A4 portrait;
                margin: 12mm 10mm 15mm 10mm;
              }
              html, body {
                background: #ffffff !important;
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
              /* Strip any container height / overflow restrictions */
              #${elementId},
              #${elementId} > div,
              .printable-table-wrapper {
                position: static !important;
                display: block !important;
                width: 100% !important;
                max-width: 100% !important;
                height: auto !important;
                max-height: none !important;
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

      // 4. Trigger print once iframe DOM and assets are fully flushed
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

      if (iframe.contentWindow) {
        iframe.contentWindow.onload = executePrint;
        // Fallback in case onload is swallowed
        setTimeout(executePrint, 600);
      } else {
        executePrint();
      }
    } catch (err) {
      console.error('[printHelper error]:', err);
      window.print();
      resolve(false);
    }
  });
};
