export interface ReportData {
  schoolName: string;
  motif: string;
  processNumber: string;
  address: string;
  date: string;
  comments: string;
}

export interface ReportImage {
  id: string;
  file: File;
  previewUrl: string;
  description: string;
  rotation: number; // 0, 90, 180, 270
}

export interface GenerationStatus {
  isGenerating: boolean;
  message: string;
}