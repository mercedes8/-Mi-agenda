import { requireOptionalNativeModule } from 'expo';

type PdfRendererModule = {
  getPageCount(uri: string): Promise<number>;
  renderPage(uri: string, page: number, width: number, outUri: string): Promise<{ uri: string; width: number; height: number }>;
  imagesToPdf(images: string[], outUri: string): Promise<string>;
};

/** null si la app se corre sin el módulo nativo (por ejemplo en Expo Go) */
export const PdfRenderer = requireOptionalNativeModule<PdfRendererModule>('PdfRenderer');
