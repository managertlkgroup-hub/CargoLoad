import type { PdfData } from "@/components/export/pdf-doc";

/**
 * Экспорт PDF без статической зависимости от @react-pdf/renderer:
 * библиотека и документ подтягиваются await import() в момент клика,
 * поэтому не попадают в серверный/предзагрузочный бандл приложения.
 */

let fontPromise: Promise<void> | null = null;

function ensureFonts(): Promise<void> {
  if (!fontPromise) {
    fontPromise = import("@react-pdf/renderer").then(({ Font }) => {
      Font.register({
        family: "Roboto",
        fonts: [
          { src: "/fonts/Roboto-Regular.ttf" },
          { src: "/fonts/Roboto-Bold.ttf", fontWeight: "bold" },
        ],
      });
    });
  }
  return fontPromise;
}

export async function exportPdf(data: PdfData, fileName: string): Promise<void> {
  await ensureFonts();
  const [rpd, doc] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/export/pdf-doc"),
  ]);
  const blob = await rpd.pdf(<doc.PdfDocument data={data} />).toBlob();
  downloadBlob(blob, fileName);
}

/** Скачивание Blob (общий для PDF и других бинарных экспортов). */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}