import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, RotateCw, GripVertical, Wand2 } from 'lucide-react';
import { ReportImage } from '../types';

interface SortableImageProps {
  image: ReportImage;
  index: number;
  onRemove: (id: string) => void;
  onRotate: (id: string) => void;
  onUpdateDescription: (id: string, text: string) => void;
  isAnalyzing: boolean;
}

export const SortableImage: React.FC<SortableImageProps> = ({
  image,
  index,
  onRemove,
  onRotate,
  onUpdateDescription,
  isAnalyzing,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col h-full"
    >
      {/* Image Container */}
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden flex items-center justify-center">
        {/* Drag Handle Overlay - Only active on the image part */}
        <div 
          {...attributes} 
          {...listeners} 
          className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 bg-black/5 transition-opacity flex items-start justify-start p-2"
        >
             <div className="bg-white/80 p-1 rounded-md text-slate-600 backdrop-blur-sm">
                <GripVertical className="w-4 h-4" />
             </div>
        </div>

        <img
          src={image.previewUrl}
          alt="Preview"
          style={{ transform: `rotate(${image.rotation}deg)` }}
          className="w-full h-full object-contain transition-transform duration-300 ease-in-out"
        />

        {/* Floating Delete Button (Top Right) - Higher Z to be clickable over drag handle */}
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent drag start
            onRemove(image.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 p-1.5 bg-white/90 text-red-600 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 z-30 cursor-pointer"
          title="Remover imagem"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Toolbar Actions (Middle) */}
      <div className="flex items-center justify-end px-2 py-2 bg-slate-50 border-b border-slate-100 gap-2">
        <button
          onClick={() => onRotate(image.id)}
          className="flex items-center gap-1 px-3 py-1 rounded bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors z-30"
          title="Rotacionar 90º"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Girar
        </button>
      </div>

      {/* Description Input (Bottom) */}
      <div className="p-3 flex-1 flex flex-col">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
          Legenda
        </label>
        <div className="relative flex-1">
          <textarea
            value={image.description}
            onChange={(e) => onUpdateDescription(image.id, e.target.value)}
            // Stop propagation to prevent dragging when interacting with text
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Descreva a imagem..."
            rows={3}
            className={`w-full h-full text-sm p-2 text-slate-900 placeholder:text-slate-400 border rounded-md focus:ring-1 focus:ring-blue-500 outline-none resize-none ${
              isAnalyzing ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'
            }`}
          />
          {isAnalyzing && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
              <Wand2 className="w-5 h-5 text-indigo-600 animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
