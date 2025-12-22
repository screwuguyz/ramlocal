import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * HTML elementini PDF'e dönüştürür
 */
export async function exportToPDF(
  elementId: string,
  filename: string = 'rapor.pdf',
  options?: {
    format?: 'a4' | 'letter';
    orientation?: 'portrait' | 'landscape';
    margin?: number;
    quality?: number;
  }
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`);
  }

  const {
    format = 'a4',
    orientation = 'portrait',
    margin = 10,
    quality = 1,
  } = options || {};

  try {
    // Element'i canvas'a dönüştür
    const canvas = await html2canvas(element, {
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    } as any);

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = format === 'a4' ? 210 : 216; // A4 veya Letter genişliği (mm)
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const pageHeight = format === 'a4' ? 297 : 279; // A4 veya Letter yüksekliği (mm)

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format,
    });

    let heightLeft = imgHeight;
    let position = margin;

    // İlk sayfa
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth - margin * 2, imgHeight);
    heightLeft -= pageHeight - margin * 2;

    // Birden fazla sayfa gerekirse
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth - margin * 2, imgHeight);
      heightLeft -= pageHeight - margin * 2;
    }

    pdf.save(filename);
  } catch (error) {
    console.error('PDF export error:', error);
    throw error;
  }
}

/**
 * Birden fazla elementi tek PDF'de birleştirir
 */
export async function exportMultipleToPDF(
  elements: Array<{ id: string; title?: string }>,
  filename: string = 'rapor.pdf',
  options?: {
    format?: 'a4' | 'letter';
    orientation?: 'portrait' | 'landscape';
    margin?: number;
    quality?: number;
  }
): Promise<void> {
  const {
    format = 'a4',
    orientation = 'portrait',
    margin = 10,
    quality = 1,
  } = options || {};

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format,
  });

  const imgWidth = format === 'a4' ? 210 : 216;
  const pageHeight = format === 'a4' ? 297 : 279;

  try {
    for (let i = 0; i < elements.length; i++) {
      const { id, title } = elements[i];
      const element = document.getElementById(id);
      
      if (!element) {
        console.warn(`Element with id "${id}" not found, skipping...`);
        continue;
      }

      // Başlık ekle (ilk sayfa değilse)
      if (i > 0) {
        pdf.addPage();
      }

      if (title) {
        pdf.setFontSize(16);
        pdf.text(title, margin, margin + 5);
      }

      const canvas = await html2canvas(element, {
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      } as any);

      const imgData = canvas.toDataURL('image/png');
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const titleHeight = title ? 10 : 0;
      let heightLeft = imgHeight;
      let position = margin + titleHeight;

      // İlk sayfa
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth - margin * 2, imgHeight);
      heightLeft -= pageHeight - margin * 2 - titleHeight;

      // Birden fazla sayfa gerekirse
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth - margin * 2, imgHeight);
        heightLeft -= pageHeight - margin * 2;
      }
    }

    pdf.save(filename);
  } catch (error) {
    console.error('PDF export error:', error);
    throw error;
  }
}

