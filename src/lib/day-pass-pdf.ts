import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Exports a Day Pass voucher element to a high-resolution PDF file.
 * The file is automatically downloaded by the browser, ready to be uploaded to Google Drive.
 */
export async function exportVoucherToPdf(
  element: HTMLElement,
  ticketNo: string,
  clientName: string
): Promise<void> {
  // Save current scroll position
  const originalScrollY = window.scrollY;

  try {
    // Generate high-resolution canvas
    const canvas = await html2canvas(element, {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    const imgData = canvas.toDataURL('image/png', 1.0);

    // Landscape A4: 297mm x 210mm
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Set 8mm margins
    const margin = 8;
    const availableWidth = pageWidth - margin * 2;
    const availableHeight = pageHeight - margin * 2;

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    const ratio = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);
    const renderWidth = imgWidth * ratio;
    const renderHeight = imgHeight * ratio;

    // Center on page
    const posX = (pageWidth - renderWidth) / 2;
    const posY = (pageHeight - renderHeight) / 2;

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
