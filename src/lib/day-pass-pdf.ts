import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Returns formatted file name including ticket No, customer name, and date (DDMMYYYY).
 * Example: DayPass_DP09772_Danunun_Dew_22102026.pdf
 */
export function getDayPassFileName(
  ticketNo: string,
  clientName: string,
  dateStr?: string
): string {
  const cleanName = (clientName || 'Guest')
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_');

  let dateFormatted = '';
  if (dateStr && dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      // parts: [YYYY, MM, DD] -> DDMMYYYY
      dateFormatted = `${parts[2]}${parts[1]}${parts[0]}`;
    }
  }

  if (!dateFormatted) {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = String(now.getFullYear());
    dateFormatted = `${d}${m}${y}`;
  }

  return `DayPass_${ticketNo || 'DP'}_${cleanName}_${dateFormatted}.pdf`;
}

/**
 * Generates the jsPDF document and Base64 representation of the voucher.
 */
export async function generateVoucherPdfBlob(
  element: HTMLElement
): Promise<{ pdf: jsPDF; base64: string; blob: Blob }> {
  const originalScrollY = window.scrollY;

  try {
    window.scrollTo(0, 0);

    const canvas = await html2canvas(element, {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      windowWidth: document.documentElement.offsetWidth,
    });

    const imgData = canvas.toDataURL('image/png', 1.0);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
    const margin = 10;
    const availableWidth = pageWidth - margin * 2; // 190mm
    const availableHeight = pageHeight - margin * 2; // 277mm

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    const ratio = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);
    const renderWidth = imgWidth * ratio;
    const renderHeight = imgHeight * ratio;

    const posX = (pageWidth - renderWidth) / 2;
    const posY = margin + 2;

    pdf.addImage(imgData, 'PNG', posX, posY, renderWidth, renderHeight, undefined, 'FAST');

    const base64 = pdf.output('datauristring');
    const blob = pdf.output('blob');

    return { pdf, base64, blob };
  } finally {
    window.scrollTo(0, originalScrollY);
  }
}

/**
 * Exports a Day Pass voucher element to a high-resolution Portrait A4 PDF and triggers download.
 */
export async function exportVoucherToPdf(
  element: HTMLElement,
  ticketNo: string,
  clientName: string,
  dateStr?: string
): Promise<void> {
  const { pdf } = await generateVoucherPdfBlob(element);
  const fileName = getDayPassFileName(ticketNo, clientName, dateStr);
  pdf.save(fileName);
}
