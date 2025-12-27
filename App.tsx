
import React, { useState, useRef, useEffect } from 'react';
import { FileText, Upload, Download, Image as ImageIcon, FileType, X, AlertCircle, Eye, Palette, Wand2 } from 'lucide-react';
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
import { DocumentPreview } from './components/DocumentPreview';
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
  const [layout, setLayout] = useState<'list' | 'grid' | 'grid3'>('grid');
  // Removed 'table' from styleMode type
  const [styleMode, setStyleMode] = useState<'simple' | 'card'>('card');
  const [status, setStatus] = useState<GenerationStatus>({ isGenerating: false, message: '' });
  
  // Validation State
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Preview Modal State
  const [showPreview, setShowPreview] = useState(false);

  // Error Modal State
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; messages: string[] }>({
    isOpen: false,
    messages: [],
  });
  
  // Dragging State
  const [activeId, setActiveId] = useState<string | null>(null);

  // Refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Effect for Horizontal Scroll locking
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Only intervene if there is horizontal scrolling content
      if (container.scrollWidth > container.clientWidth) {
         // Determine if we are scrolling vertically with the mouse wheel
         if (e.deltaY !== 0) {
            // Prevent default vertical page scroll
            e.preventDefault();
            // Manually scroll horizontally
            container.scrollLeft += e.deltaY;
         }
      }
    };

    // Add event listener with passive: false to allow preventDefault
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

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
  // Fixed typo: HTMLInputChange changed to HTMLInputElement on line 119
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

    // Clear error for this field if it exists
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
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

  const handleGenerateExample = async () => {
    if (status.isGenerating) return;
    
    // Clear any validation errors when generating example
    setErrors({});

    // 1. Fill Text Data (Generic Data, No specific entities, Pure numbers in process)
    setReportData({
        schoolName: 'Escola Municipal Exemplo',
        motif: 'Relatório Fotográfico de Instalações',
        processNumber: '12345-67890123/2024-00', // Pure numbers, no "DF"
        address: 'Rua Modelo, 100 - Bairro Centro, Cidade - UF',
        date: new Date().toISOString().split('T')[0],
        comments: 'Relatório gerado para demonstração das instalações da unidade escolar, contemplando fachada, áreas de convivência e salas de aula.\n\nObserva-se que os ambientes encontram-se organizados.',
    });

    setStatus({ isGenerating: true, message: 'Baixando 8 imagens de exemplo...' });

    try {
        // 2. Fetch Sample Images 
        const imageUrls = [
            'https://images.unsplash.com/photo-1577896334614-54e604ba0056?auto=format&fit=crop&w=800&q=80', // 1. Fachada
            'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=800&q=80', // 2. Piscina
            'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80', // 3. Sala de Aula
            'https://images.unsplash.com/photo-1556910103-1c02745a30bf?auto=format&fit=crop&w=800&q=80', // 4. Copa / Cozinha
            'https://images.unsplash.com/photo-1596464716127-f9a8759fa417?auto=format&fit=crop&w=800&q=80', // 5. Playground
            'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=800&q=80', // 6. Corredor
            'https://images.unsplash.com/photo-1628177142894-da1e95e81a8b?auto=format&fit=crop&w=800&q=80', // 7. Pia
            'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=800&q=80'  // 8. Geral
        ];

        const newImages: ReportImage[] = [];
        const TARGET_COUNT = 8;

        // Try to fetch images up to the target count
        for (let i = 0; i < TARGET_COUNT; i++) {
            try {
                // Use modulo to cycle through URLs if we run out or just to be safe
                const url = imageUrls[i % imageUrls.length];
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                const blob = await response.blob();
                const file = new File([blob], `exemplo_${i+1}.jpg`, { type: 'image/jpeg' });
                
                newImages.push({
                    id: generateId(),
                    file,
                    previewUrl: URL.createObjectURL(file),
                    description: '', // Empty captions
                    rotation: 0
                });
            } catch (err) {
                console.warn(`Could not fetch sample image ${i+1}`, err);
            }
        }

        // 3. Ensure we have exactly 8 images. 
        // If some downloads failed, we duplicate the successful ones to reach the target.
        if (newImages.length > 0 && newImages.length < TARGET_COUNT) {
            let cloneSourceIndex = 0;
            while (newImages.length < TARGET_COUNT) {
                const sourceImg = newImages[cloneSourceIndex];
                // Clone the file object (conceptually, reusing the blob content)
                const clonedFile = new File([sourceImg.file], `copia_${newImages.length + 1}.jpg`, { type: sourceImg.file.type });
                
                newImages.push({
                    id: generateId(),
                    file: clonedFile,
                    previewUrl: URL.createObjectURL(clonedFile),
                    description: '', 
                    rotation: 0
                });
                
                // Cycle through available images to clone
                cloneSourceIndex = (cloneSourceIndex + 1) % newImages.length; 
            }
        }
        
        // Clean up old URLs
        images.forEach(img => URL.revokeObjectURL(img.previewUrl));
        setImages(newImages);

    } catch (error) {
        console.error("Error generating example", error);
        setErrorModal({ isOpen: true, messages: ["Erro ao baixar imagens de exemplo. Verifique sua conexão."]});
    } finally {
        setStatus({ isGenerating: false, message: '' });
    }
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
    // Validation is no longer required for specific header fields per user request.
    // However, we still check for at least one image.
    if (images.length === 0) {
      setErrorModal({
        isOpen: true,
        messages: ["É necessário adicionar pelo menos uma imagem ao relatório."]
      });
      return;
    }

    setStatus({ isGenerating: true, message: `Gerando ${type === 'doc' ? 'DOCX' : 'PDF'}...` });

    // Format date from YYYY-MM-DD to DD/MM/YYYY for the report
    const formattedDate = reportData.date ? reportData.date.split('-').reverse().join('/') : '';
    const reportDataFormatted = { ...reportData, date: formattedDate };

    try {
      setTimeout(async () => {
        try {
            if (type === 'doc') {
                await generateDocx(reportDataFormatted, images, layout, styleMode);
            } else {
                await generatePdf(reportDataFormatted, images, layout, styleMode);
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
            <div className="flex flex-col items-start md:items-end gap-2">
                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={() => setShowPreview(true)}
                        disabled={status.isGenerating}
                        className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold shadow-md transition-all transform hover:-translate-y-0.5 active:translate-y-0 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-blue-600"
                        title="Pré-visualizar documento"
                    >
                        <Eye className="w-5 h-5" />
                        <span className="hidden sm:inline">Visualizar .DOCX</span>
                    </button>

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
                <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 font-medium">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>PDFs podem ter a formatação diferente</span>
                </div>
            </div>
          </header>

          {/* Input Form */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                    1. Informações do Cabeçalho
                </h2>
                <button
                    onClick={handleGenerateExample}
                    disabled={status.isGenerating}
                    className="text-sm flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-medium transition-colors border border-indigo-100"
                    title="Preencher com dados e fotos de teste"
                >
                    <Wand2 className="w-4 h-4" />
                    Gerar Exemplo
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="col-span-1 md:col-span-2">
                  <Input
                  label="Nome da instituição escolar"
                  name="schoolName"
                  placeholder="Ex: E.M. Prof. João da Silva"
                  value={reportData.schoolName}
                  onChange={handleInputChange}
                  error={errors.schoolName}
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
                  label="Motivo"
                  name="motif"
                  placeholder="Ex: Vistoria de infraestrutura predial"
                  value={reportData.motif}
                  onChange={handleInputChange}
                  error={errors.motif}
                  />
              </div>
              <Input
                label="Processo nº"
                name="processNumber"
                placeholder="Ex: XXXXX-XXXXXXXX/XXXX-XX"
                value={reportData.processNumber}
                onChange={handleInputChange}
                error={errors.processNumber}
              />
              <Input
                label="Data do Relatório"
                name="date"
                type="date"
                value={reportData.date}
                onChange={handleInputChange}
                error={errors.date}
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
               
               <div className="flex flex-col sm:flex-row items-end gap-6">
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
                      >
                        3 Colunas
                      </button>
                   </div>
                 </div>

                 {/* Style Selector */}
                 <div className="flex flex-col items-start md:items-end gap-1.5">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                      <Palette className="w-3 h-3" />
                      Estilo Visual
                    </span>
                    <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                      <button 
                        onClick={() => setStyleMode('simple')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                          styleMode === 'simple' 
                            ? 'bg-white text-blue-600 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Simples
                      </button>
                      {/* Removed "Células" Button */}
                      <button 
                        onClick={() => setStyleMode('card')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                          styleMode === 'card' 
                            ? 'bg-white text-blue-600 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Card
                      </button>
                   </div>
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
                  <div 
                    ref={scrollContainerRef}
                    className="mb-6 p-4 bg-slate-100 rounded-xl overflow-x-auto border border-slate-200 custom-scrollbar"
                  >
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

        {/* Preview Modal */}
        {showPreview && (
          <DocumentPreview 
            data={reportData}
            images={images}
            layout={layout}
            styleMode={styleMode}
            onClose={() => setShowPreview(false)}
          />
        )}

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
