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

export const generatePdf = async (data: ReportData, images: ReportImage[], layout: 'list' | 'grid' | 'grid3' = 'list', styleMode: 'simple' | 'card' = 'simple') => {
  const doc = new jsPDF();
  
  // Helper to center text
  const centerText = (text: string, y: number, fontSize: number, isBold: boolean = false) => {
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.text(text, PAGE_WIDTH / 2, y, { align: 'center', maxWidth: CONTENT_WIDTH });
  };

  const drawBorder = (x: number, y: number, w: number, h: number) => {
      if (styleMode === 'simple') return;
      doc.setDrawColor(0);
      doc.setLineWidth(0.1);
      // For Card, maybe round corners? jsPDF has roundedRect
      if (styleMode === 'card') {
          doc.roundedRect(x, y, w, h, 2, 2, 'S');
      } else {
          doc.rect(x, y, w, h, 'S');
      }
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
    doc.setFontSize(10); // Reduced font size for label
    doc.text("Comentários:", MARGIN_X, cursorY);
    cursorY += 5; // Reduced spacing

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9); // Reduced font size for content
    // Ensure text splitting works with margins
    const commentLines = doc.splitTextToSize(data.comments, CONTENT_WIDTH);
    doc.text(commentLines, MARGIN_X, cursorY);
    
    cursorY += (commentLines.length * 4) + 8; // Compact line height and spacing
  } else {
    cursorY += 5;
  }

  // 3. Images Logic
  
  if (layout === 'list') {
      // --- Single Column Mode ---
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
            const label = img.description ? `Figura ${i + 1}: ` : `Figura ${i + 1}`;
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "italic"); 
            const fullText = img.description ? `${label}${img.description}` : label;
            
            if (doc.getTextWidth(fullText) > CONTENT_WIDTH) {
                captionLines = doc.splitTextToSize(fullText, CONTENT_WIDTH);
                captionHeight = (captionLines.length * 5); 
            } else {
                captionLines = [fullText];
                captionHeight = 5; 
            }

            // Padding logic (Reduced padding)
            const padding = styleMode !== 'simple' ? 5 : 0;
            const contentHeight = imgHeight + (captionHeight > 0 ? captionHeight + 5 : 0) + 2; // Reduced extra spacing
            const blockHeight = contentHeight + (padding * 2);

            if (cursorY + blockHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
                doc.addPage();
                cursorY = MARGIN_Y;
            }
            
            // Draw Border if needed
            if (styleMode !== 'simple') {
                const boxWidth = LIST_IMG_WIDTH + 20; // 10 padding each side
                const boxX = (PAGE_WIDTH - boxWidth) / 2;
                drawBorder(boxX, cursorY, boxWidth, blockHeight);
            }

            const xPos = (PAGE_WIDTH - LIST_IMG_WIDTH) / 2;
            const imgY = cursorY + padding;
            doc.addImage(imageData, 'JPEG', xPos, imgY, LIST_IMG_WIDTH, imgHeight);
            
            let textY = imgY + imgHeight + 6;

            doc.setFontSize(10);
            
            // If we have just one line and simple description or no description, handle styling carefully
            if (img.description && captionLines.length === 1) {
                doc.setFont("helvetica", "bold");
                const labelWidth = doc.getTextWidth(label);
                doc.setFont("helvetica", "italic");
                const descWidth = doc.getTextWidth(img.description);
                const totalWidth = labelWidth + descWidth;
                
                let startX = (PAGE_WIDTH - totalWidth) / 2;
                
                doc.setFont("helvetica", "bold");
                doc.text(label, startX, textY);
                doc.setFont("helvetica", "italic");
                doc.text(img.description, startX + labelWidth, textY);
            } else if (!img.description) {
                // Just the label, centered
                doc.setFont("helvetica", "bold");
                doc.text(label, PAGE_WIDTH / 2, textY, { align: 'center' });
            } else {
                // Multi-line description, fallback to plain italic for everything to keep it simple or split logic
                // For simplicity in multiline, we'll keep it italic, but ideally we should bold the prefix.
                // Doing mixed style in multiline jsPDF is complex. 
                // Let's print just the lines as they are for multiline.
                doc.setFont("helvetica", "italic");
                doc.text(captionLines, PAGE_WIDTH / 2, textY, { align: 'center' });
            }

            cursorY += blockHeight + 4; // Reduced spacing between items

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
                  doc.setFontSize(8); 
                  doc.setFont("helvetica", "italic");
                  const label = img.description ? `Figura ${idx + 1}: ` : `Figura ${idx + 1}`;
                  const text = img.description ? `${label}${img.description}` : label;
                  const lines = doc.splitTextToSize(text, maxCaptionWidth);
                  return { lines, height: lines.length * 3.5 }; 
              };

              const c1 = getCaptionProps(img1, i);
              const c2 = img2 ? getCaptionProps(img2, i + 1) : { lines: [], height: 0 };
              const c3 = img3 ? getCaptionProps(img3, i + 2) : { lines: [], height: 0 };

              // Determine biggest text block to keep row even
              const maxTextHeight = Math.max(c1.height, c2.height, c3.height);
              
              // Add padding if borders (Reduced padding)
              const padding = styleMode !== 'simple' ? 3 : 0;
              const cellHeight = GRID3_CELL_HEIGHT + maxTextHeight + 8 + (padding * 2); // Reduced internal spacing

              if (cursorY + cellHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
                  doc.addPage();
                  cursorY = MARGIN_Y;
              }

              // Draw Item 1
              const x1Box = MARGIN_X;
              const yBox = cursorY;
              drawBorder(x1Box, yBox, GRID3_CELL_WIDTH, cellHeight);

              const x1 = x1Box + (GRID3_CELL_WIDTH - dim1.width) / 2;
              const y1 = yBox + padding + (GRID3_CELL_HEIGHT - dim1.height) / 2;
              doc.addImage(data1, 'JPEG', x1, y1, dim1.width, dim1.height);
              
              if (c1.lines.length > 0) {
                  doc.setFontSize(8);
                  doc.setFont("helvetica", "italic");
                  doc.text(c1.lines, x1Box + GRID3_CELL_WIDTH/2, yBox + padding + GRID3_CELL_HEIGHT + 5, { align: 'center' });
              }

              // Draw Item 2
              if (img2 && data2 && dim2) {
                  const x2Box = MARGIN_X + GRID3_CELL_WIDTH + GRID3_GAP;
                  drawBorder(x2Box, yBox, GRID3_CELL_WIDTH, cellHeight);

                  const x2 = x2Box + (GRID3_CELL_WIDTH - dim2.width) / 2;
                  const y2 = yBox + padding + (GRID3_CELL_HEIGHT - dim2.height) / 2;
                  doc.addImage(data2, 'JPEG', x2, y2, dim2.width, dim2.height);

                  if (c2.lines.length > 0) {
                      doc.setFontSize(8);
                      doc.setFont("helvetica", "italic");
                      doc.text(c2.lines, x2Box + GRID3_CELL_WIDTH/2, yBox + padding + GRID3_CELL_HEIGHT + 5, { align: 'center' });
                  }
              }

              // Draw Item 3
              if (img3 && data3 && dim3) {
                  const x3Box = MARGIN_X + (GRID3_CELL_WIDTH + GRID3_GAP) * 2;
                  drawBorder(x3Box, yBox, GRID3_CELL_WIDTH, cellHeight);

                  const x3 = x3Box + (GRID3_CELL_WIDTH - dim3.width) / 2;
                  const y3 = yBox + padding + (GRID3_CELL_HEIGHT - dim3.height) / 2;
                  doc.addImage(data3, 'JPEG', x3, y3, dim3.width, dim3.height);

                  if (c3.lines.length > 0) {
                      doc.setFontSize(8);
                      doc.setFont("helvetica", "italic");
                      doc.text(c3.lines, x3Box + GRID3_CELL_WIDTH/2, yBox + padding + GRID3_CELL_HEIGHT + 5, { align: 'center' });
                  }
              }

              cursorY += cellHeight + 3; // Reduced spacing between rows

          } catch (e) {
              console.error(`Error adding grid3 row ${i}`, e);
          }
      }
  } else {
      // --- Grid Mode 2 Columns ---
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
                  doc.setFontSize(9); 
                  doc.setFont("helvetica", "italic");
                  const label = img.description ? `Figura ${idx + 1}: ` : `Figura ${idx + 1}`;
                  const text = img.description ? `${label}${img.description}` : label;
                  const lines = doc.splitTextToSize(text, maxCaptionWidth);
                  return { lines, height: lines.length * 4 }; 
              };

              const c1 = getCaptionProps(img1, i);
              const c2 = img2 ? getCaptionProps(img2, i + 1) : { lines: [], height: 0 };

              const maxTextHeight = Math.max(c1.height, c2.height);
              
              // Reduced padding
              const padding = styleMode !== 'simple' ? 4 : 0;
              // Reduced internal spacing
              const cellHeight = GRID_CELL_HEIGHT + maxTextHeight + 8 + (padding * 2);

              if (cursorY + cellHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
                  doc.addPage();
                  cursorY = MARGIN_Y;
              }

              // Draw Item 1
              const x1Box = MARGIN_X;
              drawBorder(x1Box, cursorY, GRID_CELL_WIDTH, cellHeight);
              
              const x1 = x1Box + (GRID_CELL_WIDTH - dim1.width) / 2;
              const y1 = cursorY + padding + (GRID_CELL_HEIGHT - dim1.height) / 2;
              doc.addImage(data1, 'JPEG', x1, y1, dim1.width, dim1.height);

              if (c1.lines.length > 0) {
                   doc.setFontSize(9);
                   doc.setFont("helvetica", "italic");
                   doc.text(c1.lines, x1Box + GRID_CELL_WIDTH/2, cursorY + padding + GRID_CELL_HEIGHT + 5, { align: 'center' });
              }

              // Draw Item 2
              if (img2 && data2 && dim2) {
                  const x2Box = MARGIN_X + GRID_CELL_WIDTH + GRID_GAP;
                  drawBorder(x2Box, cursorY, GRID_CELL_WIDTH, cellHeight);

                  const x2 = x2Box + (GRID_CELL_WIDTH - dim2.width) / 2;
                  const y2 = cursorY + padding + (GRID_CELL_HEIGHT - dim2.height) / 2;
                  doc.addImage(data2, 'JPEG', x2, y2, dim2.width, dim2.height);

                  if (c2.lines.length > 0) {
                      doc.setFontSize(9);
                      doc.setFont("helvetica", "italic");
                      doc.text(c2.lines, x2Box + GRID_CELL_WIDTH/2, cursorY + padding + GRID_CELL_HEIGHT + 5, { align: 'center' });
                  }
              }

              cursorY += cellHeight + 3; // Reduced spacing between rows

          } catch (e) {
              console.error(`Error adding grid row ${i}`, e);
          }
      }
  }

  const safeName = data.schoolName.replace(/[^a-z0-9]/gi, '_') || 'Instituicao';
  doc.save(`Relatório_fotografico_${safeName}.pdf`);
};