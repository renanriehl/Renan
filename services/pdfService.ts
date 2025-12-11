import { jsPDF } from 'jspdf';
import { ReportData, ReportImage } from '../types';
import { processImage } from './docxService';

// A4 size in mm
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_X = 20;
const MARGIN_Y = 20;
const MARGIN_BOTTOM = 20; // Safe bottom margin
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN_X * 2);

// Image Settings
const LIST_IMG_WIDTH = 120;

// Fixed dimensions for Grid Cells (Harmony)
const GRID_CELL_WIDTH = 80;
const GRID_CELL_HEIGHT = 60; // 4:3 fixed box
const GRID_GAP = 10;

const GRID3_CELL_WIDTH = 53; 
const GRID3_CELL_HEIGHT = 42; // ~4:3 fixed box
const GRID3_GAP = 5;

// Helper to calculate dimensions fitting inside a box
const calculateFitDimensions = (originalW: number, originalH: number, maxW: number, maxH: number) => {
    if (originalH === 0 || originalW === 0) return { width: 0, height: 0 };
    const ratio = Math.min(maxW / originalW, maxH / originalH);
    return {
        width: originalW * ratio,
        height: originalH * ratio
    };
};

export const generatePdf = async (data: ReportData, images: ReportImage[], layout: 'list' | 'grid' | 'grid3' = 'list') => {
  const doc = new jsPDF();
  
  // Helper to center text
  const centerText = (text: string, y: number, fontSize: number, isBold: boolean = false) => {
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.text(text, PAGE_WIDTH / 2, y, { align: 'center', maxWidth: CONTENT_WIDTH });
  };

  let cursorY = MARGIN_Y;

  // 1. Header
  centerText(`Relatório Fotográfico - ${data.date}`, cursorY + 5, 16, true);
  cursorY += 12;

  centerText(data.schoolName, cursorY, 14, true);
  cursorY += 8;

  if (data.address) {
    centerText(data.address, cursorY, 12, false);
    cursorY += 8;
  }

  centerText(data.motif, cursorY, 12, false);
  cursorY += 8;

  centerText(`Processo nº ${data.processNumber}`, cursorY, 12, true);
  cursorY += 15;

  // 2. Comments Section
  if (data.comments && data.comments.trim().length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Comentários:", MARGIN_X, cursorY);
    cursorY += 6;

    doc.setFont("helvetica", "normal");
    // Ensure text splitting works with margins
    const commentLines = doc.splitTextToSize(data.comments, CONTENT_WIDTH);
    doc.text(commentLines, MARGIN_X, cursorY);
    
    cursorY += (commentLines.length * 5) + 10;
  } else {
    cursorY += 5;
  }

  // 3. Images Logic
  
  if (layout === 'list') {
      // --- Single Column Mode (Standard behavior, allow variable height) ---
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        try {
            const processed = await processImage(img.file, img.rotation);
            const imageData = new Uint8Array(processed.buffer);
            
            // For list, we don't constrain height rigidly, just width
            const ratio = LIST_IMG_WIDTH / processed.width;
            const imgHeight = processed.height * ratio;
            
            // Calculate text height
            let captionHeight = 0;
            let captionLines: string[] = [];
            const label = `Figura ${i + 1}: `;
            
            if (img.description) {
                doc.setFontSize(10);
                doc.setFont("helvetica", "italic"); 
                const fullText = `${label}${img.description}`;
                if (doc.getTextWidth(fullText) > CONTENT_WIDTH) {
                    captionLines = doc.splitTextToSize(fullText, CONTENT_WIDTH);
                    captionHeight = (captionLines.length * 5); 
                } else {
                    captionHeight = 5; 
                }
            }

            const blockHeight = imgHeight + captionHeight + 15; 

            if (cursorY + blockHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
                doc.addPage();
                cursorY = MARGIN_Y;
            }

            const xPos = (PAGE_WIDTH - LIST_IMG_WIDTH) / 2;
            doc.addImage(imageData, 'JPEG', xPos, cursorY, LIST_IMG_WIDTH, imgHeight);
            cursorY += imgHeight + 6;

            if (img.description) {
                doc.setFontSize(10);
                if (captionLines.length > 0) {
                    doc.setFont("helvetica", "italic");
                    doc.text(captionLines, PAGE_WIDTH / 2, cursorY, { align: 'center' });
                    cursorY += captionHeight + 10;
                } else {
                    doc.setFont("helvetica", "bold");
                    const labelWidth = doc.getTextWidth(label);
                    doc.setFont("helvetica", "italic");
                    const descWidth = doc.getTextWidth(img.description);
                    const totalWidth = labelWidth + descWidth;
                    
                    let startX = (PAGE_WIDTH - totalWidth) / 2;
                    
                    doc.setFont("helvetica", "bold");
                    doc.text(label, startX, cursorY);
                    doc.setFont("helvetica", "italic");
                    doc.text(img.description, startX + labelWidth, cursorY);
                    
                    cursorY += 15;
                }
            } else {
                cursorY += 15;
            }

        } catch (e) {
            console.error(`Error adding list image ${img.id}`, e);
        }
      }
  } else if (layout === 'grid3') {
      // --- 3 Columns Mode (Harmonious Box) ---
      for (let i = 0; i < images.length; i += 3) {
          const img1 = images[i];
          const img2 = images[i+1]; 
          const img3 = images[i+2];

          try {
              // Prepare images
              const p1 = await processImage(img1.file, img1.rotation);
              const data1 = new Uint8Array(p1.buffer);
              const dim1 = calculateFitDimensions(p1.width, p1.height, GRID3_CELL_WIDTH, GRID3_CELL_HEIGHT);

              let p2, data2, dim2;
              if (img2) {
                p2 = await processImage(img2.file, img2.rotation);
                data2 = new Uint8Array(p2.buffer);
                dim2 = calculateFitDimensions(p2.width, p2.height, GRID3_CELL_WIDTH, GRID3_CELL_HEIGHT);
              }

              let p3, data3, dim3;
              if (img3) {
                p3 = await processImage(img3.file, img3.rotation);
                data3 = new Uint8Array(p3.buffer);
                dim3 = calculateFitDimensions(p3.width, p3.height, GRID3_CELL_WIDTH, GRID3_CELL_HEIGHT);
              }

              // Calculate row height (Fixed cell height + Dynamic caption height)
              const maxCaptionWidth = GRID3_CELL_WIDTH; 
              const getCaptionProps = (img: ReportImage, idx: number) => {
                  if (!img.description) return { lines: [], height: 0 };
                  doc.setFontSize(8); 
                  doc.setFont("helvetica", "italic");
                  const label = `Figura ${idx + 1}: `;
                  const text = `${label}${img.description}`;
                  const lines = doc.splitTextToSize(text, maxCaptionWidth);
                  return { lines, height: lines.length * 3.5 }; 
              };

              const c1 = getCaptionProps(img1, i);
              const c2 = img2 ? getCaptionProps(img2, i + 1) : { lines: [], height: 0 };
              const c3 = img3 ? getCaptionProps(img3, i + 2) : { lines: [], height: 0 };

              // Determine biggest text block to keep row even
              const maxTextHeight = Math.max(c1.height, c2.height, c3.height);
              const rowHeight = GRID3_CELL_HEIGHT + maxTextHeight + 15; // + padding

              if (cursorY + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
                  doc.addPage();
                  cursorY = MARGIN_Y;
              }

              // Draw Item 1
              // Center inside the fixed cell box
              const x1 = MARGIN_X + (GRID3_CELL_WIDTH - dim1.width) / 2;
              const y1 = cursorY + (GRID3_CELL_HEIGHT - dim1.height) / 2;
              doc.addImage(data1, 'JPEG', x1, y1, dim1.width, dim1.height);
              
              if (c1.lines.length > 0 || img1.description) {
                  doc.setFontSize(8);
                  doc.setFont("helvetica", "italic");
                  const text = c1.lines.length > 0 ? c1.lines : `Fig ${i+1}: ${img1.description}`;
                  // Text aligns at bottom of the fixed cell box area
                  doc.text(text, MARGIN_X, cursorY + GRID3_CELL_HEIGHT + 5);
              }

              // Draw Item 2
              if (img2 && data2 && dim2) {
                  const baseX = MARGIN_X + GRID3_CELL_WIDTH + GRID3_GAP;
                  const x2 = baseX + (GRID3_CELL_WIDTH - dim2.width) / 2;
                  const y2 = cursorY + (GRID3_CELL_HEIGHT - dim2.height) / 2;
                  doc.addImage(data2, 'JPEG', x2, y2, dim2.width, dim2.height);

                  if (c2.lines.length > 0 || img2.description) {
                      doc.setFontSize(8);
                      doc.setFont("helvetica", "italic");
                      const text = c2.lines.length > 0 ? c2.lines : `Fig ${i+2}: ${img2.description}`;
                      doc.text(text, baseX, cursorY + GRID3_CELL_HEIGHT + 5);
                  }
              }

              // Draw Item 3
              if (img3 && data3 && dim3) {
                  const baseX = MARGIN_X + (GRID3_CELL_WIDTH + GRID3_GAP) * 2;
                  const x3 = baseX + (GRID3_CELL_WIDTH - dim3.width) / 2;
                  const y3 = cursorY + (GRID3_CELL_HEIGHT - dim3.height) / 2;
                  doc.addImage(data3, 'JPEG', x3, y3, dim3.width, dim3.height);

                  if (c3.lines.length > 0 || img3.description) {
                      doc.setFontSize(8);
                      doc.setFont("helvetica", "italic");
                      const text = c3.lines.length > 0 ? c3.lines : `Fig ${i+3}: ${img3.description}`;
                      doc.text(text, baseX, cursorY + GRID3_CELL_HEIGHT + 5);
                  }
              }

              cursorY += rowHeight;

          } catch (e) {
              console.error(`Error adding grid3 row ${i}`, e);
          }
      }
  } else {
      // --- Grid Mode 2 Columns (Harmonious Box) ---
      for (let i = 0; i < images.length; i += 2) {
          const img1 = images[i];
          const img2 = images[i+1]; 

          try {
              const p1 = await processImage(img1.file, img1.rotation);
              const data1 = new Uint8Array(p1.buffer);
              const dim1 = calculateFitDimensions(p1.width, p1.height, GRID_CELL_WIDTH, GRID_CELL_HEIGHT);

              let p2, data2, dim2;
              if (img2) {
                p2 = await processImage(img2.file, img2.rotation);
                data2 = new Uint8Array(p2.buffer);
                dim2 = calculateFitDimensions(p2.width, p2.height, GRID_CELL_WIDTH, GRID_CELL_HEIGHT);
              }

              const maxCaptionWidth = GRID_CELL_WIDTH; 
              const getCaptionProps = (img: ReportImage, idx: number) => {
                  if (!img.description) return { lines: [], height: 0 };
                  doc.setFontSize(9); 
                  doc.setFont("helvetica", "italic");
                  const label = `Figura ${idx + 1}: `;
                  const text = `${label}${img.description}`;
                  const lines = doc.splitTextToSize(text, maxCaptionWidth);
                  return { lines, height: lines.length * 4 }; 
              };

              const c1 = getCaptionProps(img1, i);
              const c2 = img2 ? getCaptionProps(img2, i + 1) : { lines: [], height: 0 };

              const maxTextHeight = Math.max(c1.height, c2.height);
              const rowHeight = GRID_CELL_HEIGHT + maxTextHeight + 15;

              if (cursorY + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
                  doc.addPage();
                  cursorY = MARGIN_Y;
              }

              // Draw Item 1
              const x1 = MARGIN_X + (GRID_CELL_WIDTH - dim1.width) / 2;
              const y1 = cursorY + (GRID_CELL_HEIGHT - dim1.height) / 2;
              doc.addImage(data1, 'JPEG', x1, y1, dim1.width, dim1.height);

              if (c1.lines.length > 0 || img1.description) {
                   doc.setFontSize(9);
                   doc.setFont("helvetica", "italic");
                   const text = c1.lines.length > 0 ? c1.lines : `Fig ${i+1}: ${img1.description}`;
                   doc.text(text, MARGIN_X, cursorY + GRID_CELL_HEIGHT + 5);
              }

              // Draw Item 2
              if (img2 && data2 && dim2) {
                  const baseX = MARGIN_X + GRID_CELL_WIDTH + GRID_GAP;
                  const x2 = baseX + (GRID_CELL_WIDTH - dim2.width) / 2;
                  const y2 = cursorY + (GRID_CELL_HEIGHT - dim2.height) / 2;
                  doc.addImage(data2, 'JPEG', x2, y2, dim2.width, dim2.height);

                  if (c2.lines.length > 0 || img2.description) {
                      doc.setFontSize(9);
                      doc.setFont("helvetica", "italic");
                      const text = c2.lines.length > 0 ? c2.lines : `Fig ${i+2}: ${img2.description}`;
                      doc.text(text, baseX, cursorY + GRID_CELL_HEIGHT + 5);
                  }
              }

              cursorY += rowHeight;

          } catch (e) {
              console.error(`Error adding grid row ${i}`, e);
          }
      }
  }

  const safeName = data.schoolName.replace(/[^a-z0-9]/gi, '_') || 'Instituicao';
  doc.save(`Relatório_fotografico_${safeName}.pdf`);
};