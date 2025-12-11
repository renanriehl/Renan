import React, { useState } from 'react';
import { FileText, Upload, Download, Image as ImageIcon, FileType, X, AlertCircle } from 'lucide-react';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragEndEvent,
  DragStartEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  horizontalListSortingStrategy
} from '@dnd-kit/sortable';

import { Input } from './components/Input';
import { ImageCard } from './components/ImageCard';
import { SortableItem } from './components/SortableItem';
import { ReportData, ReportImage, GenerationStatus } from './types';
import { generateDocx } from './services/docxService';
import { generatePdf } from './services/pdfService';

// Helper to generate unique IDs without external dependencies
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const App: React.FC = () => {
  // State
  const [reportData, setReportData] = useState<ReportData>({
    schoolName: '',
    motif: '',
    processNumber: '',
    address: '',
    date: (() => {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    })(),
    comments: '',
  });

  const [images, setImages] = useState<ReportImage[]>([]);
  const [layout, setLayout] = useState<'list' | 'grid' | 'grid3'>('list');
  const [status, setStatus] = useState<GenerationStatus>({ isGenerating: false, message: '' });
  
  // Error Modal State
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; messages: string[] }>({
    isOpen: false,
    messages: [],
  });
  
  // Dragging State
  const [activeId, setActiveId] = useState<string | null>(null);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
            distance: 8, // Avoid accidental drags
        }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    let { name, value } = e.target;

    if (name === 'processNumber') {
      // Remove non-numeric chars
      const numbers = value.replace(/\D/g, '');
      
      // Only format if exactly 19 digits are present (5-8-4-2 format)
      if (numbers.length === 19) {
        // Apply mask: XXXXX-XXXXXXXX/XXXX-XX
        value = numbers.replace(/^(\d{5})(\d{8})(\d{4})(\d{2})$/, '$1-$2/$3-$4');
      } else {
        // Otherwise, keep raw numbers (allows user to type less or more than 19 without interference)
        value = numbers;
      }
    }

    setReportData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles: File[] = Array.from(e.target.files);
      
      const newImages: ReportImage[] = newFiles.map((file) => ({
        id: generateId(),
        file,
        previewUrl: URL.createObjectURL(file),
        description: '',
        rotation: 0,
      }));

      setImages((prev) => [...prev, ...newImages]);
    }
    // Reset input to allow selecting the same file again if needed
    e.target.value = '';
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  };

  const rotateImage = (id: string) => {
    setImages((prev) => 
      prev.map((img) => 
        img.id === id ? { ...img, rotation: (img.rotation + 90) % 360 } : img
      )
    );
  };

  const updateImageDescription = (id: string, description: string) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, description } : img))
    );
  };

  // DnD Handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // Clean IDs (remove prefixes to find underlying data)
    // Grid items use pure UUID. Thumbs use "thumb-" + UUID.
    const rawActiveId = (active.id as string).replace('thumb-', '');
    const rawOverId = (over.id as string).replace('thumb-', '');

    if (rawActiveId !== rawOverId) {
      setImages((items) => {
        const oldIndex = items.findIndex((item) => item.id === rawActiveId);
        const newIndex = items.findIndex((item) => item.id === rawOverId);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleGenerate = async (type: 'doc' | 'pdf') => {
    const missingFields: string[] = [];

    if (!reportData.schoolName) missingFields.push("Nome da instituição escolar");
    if (!reportData.motif) missingFields.push("Motivo");
    if (!reportData.processNumber) missingFields.push("Processo nº");
    if (!reportData.date) missingFields.push("Data do Relatório");

    if (missingFields.length > 0) {
      setErrorModal({
        isOpen: true,
        messages: missingFields.map(f => `O campo "${f}" é obrigatório.`)
      });
      return;
    }

    if (images.length === 0) {
      setErrorModal({
        isOpen: true,
        messages: ["É necessário adicionar pelo menos uma imagem ao relatório."]
      });
      return;
    }

    setStatus({ isGenerating: true, message: `Gerando ${type === 'doc' ? 'DOCX' : 'PDF'}...` });

    // Format date from YYYY-MM-DD to DD/MM/YYYY for the report
    const formattedDate = reportData.date.split('-').reverse().join('/');
    const reportDataFormatted = { ...reportData, date: formattedDate };

    try {
      setTimeout(async () => {
        try {
            if (type === 'doc') {
                await generateDocx(reportDataFormatted, images, layout);
            } else {
                await generatePdf(reportDataFormatted, images, layout);
            }
            setStatus({ isGenerating: false, message: '' });
        } catch (error) {
            console.error(error);
            setStatus({ isGenerating: false, message: 'Erro ao gerar arquivo. Tente novamente.' });
        }
      }, 100);
    } catch (error) {
      setStatus({ isGenerating: false, message: 'Erro ao iniciar geração.' });
    }
  };

  // Prepare IDs for Sortable Contexts
  // Grid uses raw IDs. Thumbs use prefixed IDs to avoid collision in DndContext.
  const gridIds = images.map(img => img.id);
  const thumbIds = images.map(img => `thumb-${img.id}`);

  // Find active image for overlay
  const activeImage = activeId 
    ? images.find(img => img.id === activeId || `thumb-${img.id}` === activeId)
    : null;
    
  const isDraggingThumb = activeId?.startsWith('thumb-');

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCenter} 
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-slate-50 py-10 px-4 md:px-8 font-sans">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Header App */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-8 h-8 text-blue-600" />
                Gerador de Relatório Fotográfico
              </h1>
              <p className="text-slate-500 mt-1">Gere relatórios padronizados para vistorias escolares.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
               <button
                  onClick={() => handleGenerate('doc')}
                  disabled={status.isGenerating}
                  className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold shadow-md transition-all transform hover:-translate-y-0.5 active:translate-y-0 ${
                  status.isGenerating
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                  }`}
              >
                  {status.isGenerating ? (
                  <>
                      {/* Using Upload icon as a placeholder spinner if needed or just text */}
                      <span className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full mr-2"></span>
                      Processando...
                  </>
                  ) : (
                  <>
                      <Download className="w-5 h-5" />
                      Baixar .DOCX
                  </>
                  )}
              </button>
              <button
                  onClick={() => handleGenerate('pdf')}
                  disabled={status.isGenerating}
                  className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold shadow-md transition-all transform hover:-translate-y-0.5 active:translate-y-0 ${
                  status.isGenerating
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700 text-white shadow-red-200'
                  }`}
              >
                  <FileType className="w-5 h-5" />
                  Baixar .PDF
              </button>
            </div>
          </header>

          {/* Input Form */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-xl font-semibold text-slate-800 mb-6 flex items-center gap-2">
              1. Informações do Cabeçalho
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="col-span-1 md:col-span-2">
                  <Input
                  label="Nome da instituição escolar *"
                  name="schoolName"
                  placeholder="Ex: E.M. Prof. João da Silva"
                  value={reportData.schoolName}
                  onChange={handleInputChange}
                  />
              </div>
              <div className="col-span-1 md:col-span-2">
                  <Input
                  label="Endereço"
                  name="address"
                  placeholder="Ex: Rua das Flores, 123"
                  value={reportData.address}
                  onChange={handleInputChange}
                  />
              </div>
              <div className="col-span-1 md:col-span-2">
                  <Input
                  label="Motivo *"
                  name="motif"
                  placeholder="Ex: Vistoria de infraestrutura predial"
                  value={reportData.motif}
                  onChange={handleInputChange}
                  />
              </div>
              <Input
                label="Processo nº *"
                name="processNumber"
                placeholder="Ex: XXXXX-XXXXXXXX/XXXX-XX"
                value={reportData.processNumber}
                onChange={handleInputChange}
              />
              <Input
                label="Data do Relatório *"
                name="date"
                type="date"
                value={reportData.date}
                onChange={handleInputChange}
              />
              <div className="col-span-1 md:col-span-2 lg:col-span-4">
                 <div className="flex flex-col gap-1 w-full">
                    <label className="text-sm font-medium text-slate-700">Comentários / Observações Gerais</label>
                    <textarea
                      name="comments"
                      value={reportData.comments}
                      onChange={handleInputChange}
                      placeholder="Insira observações gerais que aparecerão no início do relatório..."
                      rows={3}
                      className="px-4 py-2 bg-white text-slate-900 placeholder:text-slate-400 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-y"
                    />
                 </div>
              </div>
            </div>
          </section>

          {/* Image Upload Section */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
               <div>
                  <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                      2. Fotos da Vistoria
                      <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      {images.length} fotos
                      </span>
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Arraste as fotos (grade ou barra superior) para reordenar.
                  </p>
               </div>
               
               {/* Layout Selector */}
               <div className="flex flex-col items-start md:items-end gap-1.5">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Disposição das fotos no documento
                  </span>
                  <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button 
                      onClick={() => setLayout('list')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        layout === 'list' 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                      title="Uma foto por linha"
                    >
                      1 Coluna
                    </button>
                    <button 
                      onClick={() => setLayout('grid')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        layout === 'grid' 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                      title="Duas fotos por linha"
                    >
                      2 Colunas
                    </button>
                    <button 
                      onClick={() => setLayout('grid3')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        layout === 'grid3' 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                      title="Três fotos por linha"
                    >
                      3 Colunas
                    </button>
                 </div>
               </div>
            </div>

            {images.length === 0 ? (
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center bg-slate-50">
                <div className="mx-auto w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                  <ImageIcon className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-slate-900">Nenhuma imagem selecionada</h3>
                <p className="text-slate-500 mb-6">Selecione as fotos para compor o relatório.</p>
                <label className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-lg cursor-pointer font-medium transition-colors">
                  <Upload className="w-5 h-5" />
                  Selecionar Arquivos
                  <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                  />
                </label>
              </div>
            ) : (
              <>
                  {/* Mini Visualization / Sequence Strip (Sortable) */}
                  <div className="mb-6 p-4 bg-slate-100 rounded-xl overflow-x-auto border border-slate-200 custom-scrollbar">
                      <SortableContext 
                        items={thumbIds} 
                        strategy={horizontalListSortingStrategy}
                      >
                        <div className="flex gap-3 min-w-min">
                            {images.map((img, idx) => (
                                <SortableItem key={`thumb-${img.id}`} id={`thumb-${img.id}`}>
                                  {({ setNodeRef, attributes, listeners, style, isDragging }) => (
                                    <div 
                                      ref={setNodeRef} 
                                      style={style} 
                                      {...attributes} 
                                      {...listeners}
                                      className={`flex-shrink-0 relative group flex flex-col gap-1 items-center cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50' : ''}`}
                                    >
                                        <div className="w-24 h-20 bg-white rounded-lg border border-slate-300 overflow-hidden flex items-center justify-center relative shadow-sm hover:ring-2 hover:ring-blue-400 transition-all">
                                            <img 
                                                src={img.previewUrl} 
                                                className="w-full h-full object-contain pointer-events-none"
                                                style={{ transform: `rotate(${img.rotation}deg)` }}
                                                alt={`Miniatura ${idx + 1}`}
                                            />
                                            <div className="absolute top-0 left-0 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-br z-10">
                                                {idx + 1}
                                            </div>
                                            
                                            {/* Delete Button (Horizontal Bar) */}
                                            <button
                                                onClick={(e) => {
                                                  e.stopPropagation(); // Stop click from propagating to SortableItem logic if needed
                                                  removeImage(img.id);
                                                }}
                                                // Prevent the drag sensor from picking up the click on this button
                                                onPointerDown={(e) => e.stopPropagation()}
                                                className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600 z-20 hover:scale-110"
                                                title="Remover"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                  )}
                                </SortableItem>
                            ))}
                        </div>
                      </SortableContext>
                  </div>

                  {/* Main Grid (Sortable) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    <SortableContext 
                        items={gridIds} 
                        strategy={rectSortingStrategy}
                    >
                        {images.map((img, index) => (
                        <SortableItem key={img.id} id={img.id}>
                            {({ setNodeRef, attributes, listeners, style, isDragging }) => (
                            <ImageCard
                                innerRef={setNodeRef}
                                style={style}
                                dragHandleProps={{ ...attributes, ...listeners }}
                                isDragging={isDragging}
                                image={img}
                                index={index}
                                onRemove={removeImage}
                                onRotate={rotateImage}
                                onUpdateDescription={updateImageDescription}
                            />
                            )}
                        </SortableItem>
                        ))}
                    </SortableContext>

                    {/* Add More Photos Card */}
                    <label className="flex flex-col items-center justify-center h-full min-h-[350px] border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 hover:border-blue-400 cursor-pointer transition-all group">
                        <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-400 group-hover:text-blue-600 group-hover:scale-110 transition-all border border-slate-200">
                            <Upload className="w-7 h-7" />
                        </div>
                        <span className="mt-3 text-sm font-semibold text-slate-500 group-hover:text-blue-600">Adicionar mais fotos</span>
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileUpload}
                        />
                    </label>
                  </div>
              </>
            )}
          </section>
        </div>
        
        {/* Drag Overlay (Visual Feedback) */}
        <DragOverlay>
            {activeImage ? (
                isDraggingThumb ? (
                    // Thumb Overlay
                    <div className="w-24 h-20 bg-white rounded-lg border border-blue-500 overflow-hidden flex items-center justify-center shadow-2xl rotate-3 cursor-grabbing">
                        <img 
                            src={activeImage.previewUrl} 
                            className="w-full h-full object-contain"
                            style={{ transform: `rotate(${activeImage.rotation}deg)` }}
                        />
                    </div>
                ) : (
                   // Card Overlay
                   <div className="w-[300px] bg-white border border-blue-500 rounded-xl overflow-hidden shadow-2xl rotate-2 opacity-90 cursor-grabbing">
                       <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
                           <span className="text-xs font-bold text-slate-500">Movendo...</span>
                       </div>
                       <div className="relative aspect-[4/3] bg-slate-100 flex items-center justify-center">
                            <img
                              src={activeImage.previewUrl}
                              style={{ transform: `rotate(${activeImage.rotation}deg)` }}
                              className="w-full h-full object-contain"
                            />
                       </div>
                   </div>
                )
            ) : null}
        </DragOverlay>

        {/* Error Modal */}
        {errorModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3 text-red-600">
                            <div className="p-2 bg-red-100 rounded-full">
                                <AlertCircle className="w-6 h-6" /> 
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">Atenção</h3>
                        </div>
                        <button 
                            onClick={() => setErrorModal(prev => ({ ...prev, isOpen: false }))}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <p className="text-slate-600 mb-4 font-medium">
                        Não foi possível gerar o arquivo. Verifique os pontos abaixo:
                    </p>
                    
                    <ul className="space-y-2 mb-6">
                        {errorModal.messages.map((msg, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-slate-700 bg-red-50 p-2 rounded border border-red-100">
                                <span className="text-red-500 font-bold">•</span>
                                {msg}
                            </li>
                        ))}
                    </ul>

                    <button
                        onClick={() => setErrorModal(prev => ({ ...prev, isOpen: false }))}
                        className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        )}
      </div>
    </DndContext>
  );
};

export default App;