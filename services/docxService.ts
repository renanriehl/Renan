import { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType, VerticalAlign, TableLayoutType } from 'docx';
import FileSaver from 'file-saver';
import { ReportData, ReportImage } from '../types';

// --- WORKER CODE AS STRING ---
const WORKER_CODE = `
  self.onmessage = async (e) => {
    const { id, file, rotation } = e.data;
    
    try {
      const bitmap = await createImageBitmap(file);
      
      const MAX_DIMENSION = 1600;
      let width = bitmap.width;
      let height = bitmap.height;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const isRotated90 = rotation % 180 !== 0;
      const canvasWidth = isRotated90 ? height : width;
      const canvasHeight = isRotated90 ? width : height;

      const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error("Could not get OffscreenCanvas context");

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      ctx.translate(canvasWidth / 2, canvasHeight / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      ctx.drawImage(bitmap, -width / 2, -height / 2, width, height);

      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.80 });
      const buffer = await blob.arrayBuffer();

      bitmap.close();

      // Return buffer AND dimensions
      self.postMessage({ id, buffer, width: canvasWidth, height: canvasHeight }, [buffer]);

    } catch (error) {
      self.postMessage({ id, error: error.message });
    }
  };
`;

// --- WORKER MANAGER ---
let worker: Worker | null = null;
const pendingRequests = new Map<string, { resolve: (res: { buffer: ArrayBuffer, width: number, height: number }) => void; reject: (e: any) => void }>();

const getWorker = () => {
  if (!worker) {
    const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
    worker = new Worker(URL.createObjectURL(blob));
    
    worker.onmessage = (e) => {
      const { id, buffer, width, height, error } = e.data;
      const request = pendingRequests.get(id);
      
      if (request) {
        if (error) request.reject(new Error(error));
        else request.resolve({ buffer, width, height });
        pendingRequests.delete(id);
      }
    };

    worker.onerror = (e) => {
      console.error("Worker error:", e);
    };
  }
  return worker;
};

const processImageOnMainThread = async (file: File, rotation: number): Promise<{ buffer: ArrayBuffer, width: number, height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      const MAX_DIMENSION = 1600;
      let width = img.width;
      let height = img.height;
      
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
      }

      const isRotated90 = rotation % 180 !== 0;
      canvas.width = isRotated90 ? height : width;
      canvas.height = isRotated90 ? width : height;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -width / 2, -height / 2, width, height);

      canvas.toBlob((blob) => {
        if (blob) {
          const reader = new FileReader();
          reader.onload = () => resolve({ 
              buffer: reader.result as ArrayBuffer,
              width: canvas.width,
              height: canvas.height
          });
          reader.readAsArrayBuffer(blob);
        } else {
          reject(new Error("Canvas to Blob failed"));
        }
      }, 'image/jpeg', 0.80);
    };

    img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image"));
    };
    
    img.src = url;
  });
};

export const processImage = async (file: File, rotation: number): Promise<{ buffer: ArrayBuffer, width: number, height: number }> => {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(7);
      pendingRequests.set(id, { resolve, reject });
      
      const w = getWorker();
      w.postMessage({ id, file, rotation });
    });
  } else {
    return processImageOnMainThread(file, rotation);
  }
};

/**
 * Calculates dimensions to FIT inside a bounding box (maxW x maxH)
 * preserving aspect ratio.
 */
const calculateFitDimensions = (originalW: number, originalH: number, maxW: number, maxH: number) => {
    const ratio = Math.min(maxW / originalW, maxH / originalH);
    return {
        width: Math.round(originalW * ratio),
        height: Math.round(originalH * ratio)
    };
};

const createCellContent = (
    imgData: { buffer: ArrayBuffer, width: number, height: number }, 
    img: ReportImage, 
    index: number, 
    maxWidth: number,
    maxHeight: number,
    fontSize: number = 20
) => {
    // Calculate best fit dimensions to keep row height uniform
    const { width, height } = calculateFitDimensions(imgData.width, imgData.height, maxWidth, maxHeight);

    const children = [];
    children.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new ImageRun({
                    data: imgData.buffer,
                    transformation: {
                        width: width,
                        height: height,
                    },
                    type: "jpg"
                }),
            ],
            spacing: { before: 0, after: 120 }
        })
    );

    if (img.description) {
        children.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({
                        text: `Figura ${index + 1}: `,
                        bold: true,
                        size: fontSize,
                        font: "Arial"
                    }),
                    new TextRun({
                        text: img.description,
                        italics: true,
                        size: fontSize, 
                        font: "Arial"
                    })
                ],
                spacing: { after: 120 } 
            })
        );
    } else {
        children.push(new Paragraph({ spacing: { after: 120 } }));
    }
    return children;
};

export const generateDocx = async (data: ReportData, images: ReportImage[], layout: 'list' | 'grid' | 'grid3' = 'list') => {
  const children = [];

  // 1. Header Section
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.TITLE,
      children: [
        new TextRun({
          text: `Relatório Fotográfico - ${data.date}`, 
          bold: true,
          size: 32,
          font: "Arial"
        }),
      ],
      spacing: { after: 120 }, 
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: data.schoolName,
          bold: true,
          size: 28,
          font: "Arial"
        }),
      ],
      spacing: { after: 60 }, 
    })
  );

  if (data.address) {
    children.push(
        new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
            new TextRun({
            text: data.address,
            size: 24,
            font: "Arial"
            }),
        ],
        spacing: { after: 60 }, 
        })
    );
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: data.motif,
          size: 24,
          font: "Arial"
        }),
      ],
      spacing: { after: 60 }, 
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Processo nº ${data.processNumber}`, 
          bold: true,
          size: 24,
          font: "Arial"
        }),
      ],
      spacing: { after: 200 }, 
    })
  );

  // 2. Comments Section
  if (data.comments && data.comments.trim().length > 0) {
    children.push(
        new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
                new TextRun({
                    text: "Comentários:",
                    bold: true,
                    size: 22,
                    font: "Arial"
                }),
            ],
            spacing: { before: 0, after: 100 }
        })
    );
    
    const commentLines = data.comments.split('\n');
    for (const line of commentLines) {
        children.push(
            new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                children: [
                    new TextRun({
                        text: line,
                        size: 22,
                        font: "Arial"
                    }),
                ],
                spacing: { after: 100 }
            })
        );
    }
    
    children.push(new Paragraph({ spacing: { after: 300 } }));
  } else {
    children.push(new Paragraph({ spacing: { after: 300 } }));
  }

  // 3. Images Section
  if (layout === 'list') {
      // 1-Column Layout (List)
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        try {
            const processed = await processImage(img.file, img.rotation);
            // In list mode, we fix width to ~13cm (500px) and let height adjust naturally
            // No strict box needed here, usually vertical photos are fine in a list
            const { width, height } = calculateFitDimensions(processed.width, processed.height, 500, 800);
            
            children.push(
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new ImageRun({
                            data: processed.buffer,
                            transformation: {
                                width: width,
                                height: height,
                            },
                            type: "jpg"
                        }),
                    ],
                    spacing: { before: 100, after: 80 } 
                })
            );

            if (img.description) {
                children.push(
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({
                                text: `Figura ${i + 1}: `,
                                bold: true,
                                size: 20,
                                font: "Arial"
                            }),
                            new TextRun({
                                text: img.description,
                                italics: true,
                                size: 20,
                                font: "Arial"
                            })
                        ],
                        spacing: { after: 300 } 
                    })
                );
            } else {
                children.push(new Paragraph({ spacing: { after: 300 } }));
            }
        } catch (e) {
            console.error(`Failed to process image ${img.id}`, e);
        }
      }
  } else if (layout === 'grid3') {
    // 3-Column Grid Layout
    // Constraints: Width ~190px. Height ~150px (approx 4:3 landscape box)
    const MAX_W = 190;
    const MAX_H = 150;

    const rows = [];
    
    for (let i = 0; i < images.length; i += 3) {
        const img1 = images[i];
        const img2 = images[i + 1]; 
        const img3 = images[i + 2]; 

        try {
            const p1 = await processImage(img1.file, img1.rotation);
            const p2 = img2 ? await processImage(img2.file, img2.rotation) : null;
            const p3 = img3 ? await processImage(img3.file, img3.rotation) : null;

            const cell1Children = createCellContent(p1, img1, i, MAX_W, MAX_H, 18);
            const cell2Children = p2 && img2 
                ? createCellContent(p2, img2, i + 1, MAX_W, MAX_H, 18) 
                : [new Paragraph({})];
            const cell3Children = p3 && img3
                ? createCellContent(p3, img3, i + 2, MAX_W, MAX_H, 18)
                : [new Paragraph({})];

            rows.push(
                new TableRow({
                    children: [
                        new TableCell({
                            children: cell1Children,
                            width: { size: 33.33, type: WidthType.PERCENTAGE },
                            verticalAlign: VerticalAlign.CENTER, // Center Vertically
                            borders: {
                                top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                            },
                            margins: { top: 100, bottom: 200, right: 100 }
                        }),
                        new TableCell({
                            children: cell2Children,
                            width: { size: 33.33, type: WidthType.PERCENTAGE },
                            verticalAlign: VerticalAlign.CENTER,
                            borders: {
                                top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                            },
                            margins: { top: 100, bottom: 200, left: 50, right: 50 }
                        }),
                        new TableCell({
                            children: cell3Children,
                            width: { size: 33.33, type: WidthType.PERCENTAGE },
                            verticalAlign: VerticalAlign.CENTER,
                            borders: {
                                top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                            },
                            margins: { top: 100, bottom: 200, left: 100 }
                        }),
                    ],
                })
            );
            
        } catch (e) {
            console.error(`Failed to process grid row starting at ${i}`, e);
        }
    }

    children.push(
        new Table({
            layout: TableLayoutType.FIXED,
            rows: rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
                insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
            }
        })
    );
  } else {
      // 2-Column Grid Layout
      // Constraints: Width ~290px. Height ~220px
      const MAX_W = 290;
      const MAX_H = 220;

      const rows = [];
      
      for (let i = 0; i < images.length; i += 2) {
          const img1 = images[i];
          const img2 = images[i + 1]; 

          try {
              const p1 = await processImage(img1.file, img1.rotation);
              const p2 = img2 ? await processImage(img2.file, img2.rotation) : null;

              const cell1Children = createCellContent(p1, img1, i, MAX_W, MAX_H, 20);
              const cell2Children = p2 && img2 
                  ? createCellContent(p2, img2, i + 1, MAX_W, MAX_H, 20) 
                  : [new Paragraph({})];

              rows.push(
                  new TableRow({
                      children: [
                          new TableCell({
                              children: cell1Children,
                              width: { size: 50, type: WidthType.PERCENTAGE },
                              verticalAlign: VerticalAlign.CENTER,
                              borders: {
                                  top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                  bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                  left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                  right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                              },
                              margins: { top: 100, bottom: 200, right: 150 }
                          }),
                          new TableCell({
                              children: cell2Children,
                              width: { size: 50, type: WidthType.PERCENTAGE },
                              verticalAlign: VerticalAlign.CENTER,
                              borders: {
                                  top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                  bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                  left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                  right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                              },
                              margins: { top: 100, bottom: 200, left: 150 }
                          }),
                      ],
                  })
              );
              
          } catch (e) {
              console.error(`Failed to process grid row starting at ${i}`, e);
          }
      }

      children.push(
          new Table({
              layout: TableLayoutType.FIXED,
              rows: rows,
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                  top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                  bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                  left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                  right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
                  insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
              }
          })
      );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
             page: {
                margin: {
                    top: 1000, 
                    bottom: 1000,
                    left: 1200,
                    right: 1200,
                },
            },
        },
        children: children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = data.schoolName.replace(/[^a-z0-9]/gi, '_') || 'Instituicao';
  FileSaver.saveAs(blob, `Relatório_fotografico_${safeName}.docx`);
};