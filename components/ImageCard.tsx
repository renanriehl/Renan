
import React, { useState } from 'react';
import { Trash2, RotateCw, GripVertical, ZoomIn, ZoomOut } from 'lucide-react';
import { ReportImage } from '../types';

interface ImageCardProps {
  image: ReportImage;
  index: number;
  onRemove: (id: string) => void;
  onRotate: (id: string) => void;
  onUpdateDescription: (id: string, text: string) => void;
  // Drag props
  dragHandleProps?: any;
  style?: React.CSSProperties;
  innerRef?: (node: HTMLElement | null) => void;
  isDragging?: boolean;
}

export const ImageCard: React.FC<ImageCardProps> = ({
  image,
  index,
  onRemove,
  onRotate,
  onUpdateDescription,
  dragHandleProps,
  style,
  innerRef,
  isDragging
}) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const currentPosition = index + 1;

  const handleDoubleClick = () => {
    setIsZoomed(!isZoomed);
  };

  return (
    <div 
        ref={innerRef}
        style={style}
        className={`bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col h-full ${isDragging ? 'ring-2 ring-blue-500 shadow-xl rotate-1' : ''}`}
    >
      {/* Header: Position Control & Drag Handle */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-3">
           {/* Drag Handle */}
           <div 
             {...dragHandleProps}
             className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-200"
             title="Arrastar para reordenar"
           >
             <GripVertical className="w-5 h-5" />
           </div>

           <span className="text-sm font-semibold text-slate-600">
            Foto {currentPosition}
           </span>
        </div>
        <button
            onClick={() => onRemove(image.id)}
            className="text-slate-400 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50"
            title="Remover imagem"
        >
            <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Image Container */}
      <div 
        className="relative aspect-[4/3] bg-slate-100 overflow-hidden flex items-center justify-center border-b border-slate-100 cursor-zoom-in group"
        onDoubleClick={handleDoubleClick}
        title="Duplo clique para zoom"
      >
        <img
          src={image.previewUrl}
          alt={`Foto ${currentPosition}`}
          style={{ 
            transform: `rotate(${image.rotation}deg) scale(${isZoomed ? 3.0 : 1})`,
            cursor: isZoomed ? 'zoom-out' : 'zoom-in'
          }}
          className="w-full h-full object-contain transition-transform duration-300 ease-in-out"
        />
        
        {/* Zoom Indicator Overlay */}
        <div className="absolute top-2 left-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            {isZoomed ? (
                <div className="bg-blue-600/80 text-white p-1 rounded-md backdrop-blur-sm">
                    <ZoomOut className="w-4 h-4" />
                </div>
            ) : (
                <div className="bg-slate-800/40 text-white p-1 rounded-md backdrop-blur-sm">
                    <ZoomIn className="w-4 h-4" />
                </div>
            )}
        </div>

        {/* Rotate Button Overlay */}
        <button
          onClick={(e) => {
              e.stopPropagation();
              onRotate(image.id);
          }}
          className="absolute bottom-2 right-2 p-1.5 bg-white/90 text-slate-700 rounded-full shadow-sm hover:text-blue-600 transition-colors border border-slate-200 z-10"
          title="Rotacionar 90º"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Description Input */}
      <div className="p-3 flex-1 flex flex-col">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
          Legenda
        </label>
        <div className="relative flex-1">
          <textarea
            value={image.description}
            onChange={(e) => onUpdateDescription(image.id, e.target.value)}
            placeholder="Descreva a imagem..."
            rows={3}
            onKeyDown={(e) => e.stopPropagation()} // Prevent drag keys
            onPointerDown={(e) => e.stopPropagation()} // Prevent drag start
            className="w-full h-full text-sm p-2 text-slate-900 placeholder:text-slate-400 border rounded-md focus:ring-1 focus:ring-blue-500 outline-none resize-none bg-white border-slate-200"
          />
        </div>
      </div>
    </div>
  );
};
