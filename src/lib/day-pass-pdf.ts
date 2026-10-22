import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Exports a Day Pass voucher element to a high-resolution Portrait A4 PDF.
 * Formatted to match the on-screen preview 1:1 with balanced margins.
 */
export async function exportVoucherToPdf(
  element: HTMLElement,
  ticketNo: string,
  clientName: string
): Promise<void> {
  const originalScrollY = window.scrollY;

  try {
    // Scroll to top temporarily to prevent any offset issues during canvas capture
    window.scrollTo(0, 0);

    // Generate high-resolution canvas matching the exact element dimensions
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

    // Portrait A4: 210mm x 297mm
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth(); // 210
    const pageHeight = pdf.internal.pageSize.getHeight(); // 297

    // Set 10mm margins for a balanced, professional document
    const margin = 10;
    const availableWidth = pageWidth - margin * 2; // 190mm
    const availableHeight = pageHeight - margin * 2; // 277mm

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    const ratio = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);
    const renderWidth = imgWidth * ratio;
    const renderHeight = imgHeight * ratio;

    // Center horizontally, position with top margin
    const posX = (pageWidth - renderWidth) / 2;
    const posY = margin + 2;

    pdf.addImage(imgData, 'PNG', posX, posY, renderWidth, renderHeight, undefined, 'FAST');

    // Clean client name for filename
    const cleanName = (clientName || 'Guest')
      .trim()
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/\s+/g, '_');

    const fileName = `DayPass_${ticketNo || 'DP'}_${cleanName}.pdf`;
    pdf.save(fileName);
  } finally {
    window.scrollTo(0, originalScrollY);
  }
}
