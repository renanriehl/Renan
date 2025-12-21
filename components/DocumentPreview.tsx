import React from 'react';
import { X } from 'lucide-react';
import { ReportData, ReportImage } from '../types';

interface DocumentPreviewProps {
  data: ReportData;
  images: ReportImage[];
  layout: 'list' | 'grid' | 'grid3';
  styleMode: 'simple' | 'card';
  onClose: () => void;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({ data, images, layout, styleMode, onClose }) => {
  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateString;
  };

  const getGridClass = () => {
    switch (layout) {
      case 'grid': return 'grid-cols-2 gap-4';
      case 'grid3': return 'grid-cols-3 gap-2';
      default: return 'grid-cols-1 gap-8';
    }
  };

  const getItemStyleClass = () => {
      if (styleMode === 'card') {
          return 'bg-white shadow-sm border border-slate-200 rounded-lg p-3';
      }
      return '';
  };

  // Logic to split images into pages visually
  const getPages = () => {
      // Conservative estimate of items per page based on layout
      let itemsOnFirstPage = 0;
      let itemsOnNextPages = 0;

      // Adjust based on typical height of items in each layout
      // Note: This is an approximation for preview purposes.
      if (layout === 'list') {
          // Large images
          itemsOnFirstPage = data.comments.length > 400 ? 1 : 2;
          itemsOnNextPages = 3;
      } else if (layout === 'grid') {
          // 2 Columns
          // If comments are long, fits ~1 row (2 items), else ~2 rows (4 items)
          itemsOnFirstPage = data.comments.length > 400 ? 2 : 4;
          itemsOnNextPages = 8; // ~4 rows
      } else {
          // 3 Columns
          // If comments are long, fits ~2 rows (6 items), else ~3 rows (9 items)
          itemsOnFirstPage = data.comments.length > 400 ? 6 : 9;
          itemsOnNextPages = 15; // ~5 rows
      }

      const pages = [];
      
      // Page 1
      const firstPageImages = images.slice(0, itemsOnFirstPage);
      pages.push({
          isFirstPage: true,
          images: firstPageImages
      });

      // Subsequent Pages
      let remainingImages = images.slice(itemsOnFirstPage);
      while (remainingImages.length > 0) {
          const chunk = remainingImages.slice(0, itemsOnNextPages);
          pages.push({
              isFirstPage: false,
              images: chunk
          });
          remainingImages = remainingImages.slice(itemsOnNextPages);
      }

      // Handle case with no images but data
      if (pages.length === 0) {
          pages.push({ isFirstPage: true, images: [] });
      }

      return pages;
  };

  const pages = getPages();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-hidden">
      <div className="relative w-full max-w-5xl h-full flex flex-col bg-slate-200/80 rounded-xl shadow-2xl overflow-hidden backdrop-blur-md">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-300 z-10 shadow-sm">
          <div className="flex flex-col">
            <h3 className="text-lg font-bold text-slate-800">Pré-visualização do Documento</h3>
            <p className="text-xs text-slate-500">
                Visualização aproximada. O arquivo final pode apresentar pequenas diferenças de paginação.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Document Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="flex flex-col items-center gap-8">
            
            {pages.map((page, pageIndex) => (
                <div key={pageIndex} className="bg-white w-full max-w-[210mm] min-h-[297mm] shadow-lg p-[20mm] text-slate-900 box-border relative transition-transform">
                    
                    {/* Header & Comments - Only on First Page */}
                    {page.isFirstPage && (
                        <>
                            <div className="text-center mb-8 font-sans">
                                <h1 className="text-2xl font-bold mb-2 uppercase">Relatório Fotográfico - {formatDate(data.date)}</h1>
                                <h2 className="text-xl font-bold mb-1">{data.schoolName || '[Nome da Instituição]'}</h2>
                                {data.address && <p className="text-base mb-1">{data.address}</p>}
                                <p className="text-base mb-1">{data.motif || '[Motivo]'}</p>
                                <p className="text-lg font-bold mt-2">Processo nº {data.processNumber || '_____'}</p>
                            </div>

                            {(data.comments) && (
                                <div className="mb-8 text-justify leading-relaxed">
                                    <h3 className="font-bold text-lg mb-2">Comentários:</h3>
                                    <p className="whitespace-pre-line text-slate-800 text-sm">{data.comments}</p>
                                </div>
                            )}
                        </>
                    )}

                    {/* Spacer for non-first pages to match top margin visually if needed, 
                        though p-[20mm] handles the margin. 
                        We just render grid directly. 
                    */}

                    {/* Images Grid */}
                    <div className={`grid ${getGridClass()} auto-rows-min`}>
                    {page.images.map((img, index) => {
                        // Calculate absolute index for label
                        // We need to know how many items were in previous pages
                        let absoluteIndex = 0;
                        for(let i=0; i<pageIndex; i++) {
                            absoluteIndex += pages[i].images.length;
                        }
                        absoluteIndex += index;

                        return (
                            <div key={img.id} className={`break-inside-avoid flex flex-col items-center ${getItemStyleClass()} ${styleMode === 'simple' ? 'mb-4' : ''}`}>
                                <div className={`relative overflow-hidden bg-slate-50 flex items-center justify-center
                                    ${layout === 'list' ? 'w-full max-w-[13cm] aspect-[4/3]' : 'w-full aspect-[4/3]'}
                                `}>
                                    <img 
                                    src={img.previewUrl} 
                                    className="w-full h-full object-contain"
                                    style={{ transform: `rotate(${img.rotation}deg)` }}
                                    alt={`Foto ${absoluteIndex + 1}`}
                                    />
                                </div>
                                
                                <div className="mt-2 text-center text-sm px-2 w-full">
                                    <span className="font-bold">
                                      {img.description 
                                        ? `Figura ${absoluteIndex + 1}: ` 
                                        : `Figura ${absoluteIndex + 1}`
                                      }
                                    </span>
                                    {img.description && <span className="italic">{img.description}</span>}
                                </div>
                            </div>
                        );
                    })}
                    </div>

                    {page.isFirstPage && page.images.length === 0 && images.length === 0 && (
                        <div className="text-center text-slate-400 py-10 italic border-2 border-dashed border-slate-200 rounded">
                            Nenhuma imagem adicionada
                        </div>
                    )}

                    {/* Page Number Footer */}
                    <div className="absolute bottom-8 right-8 text-xs text-slate-400 font-medium">
                        Página {pageIndex + 1} de {pages.length}
                    </div>
                </div>
            ))}

          </div>
        </div>
      </div>
    </div>
  );
};