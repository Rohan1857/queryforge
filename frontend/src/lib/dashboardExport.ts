import type { Dashboard } from "@/types/dashboard";
import type { CanvasPreset } from "@/lib/dashboardCanvas";
import { getCanvasSectionTop } from "@/lib/dashboardCanvas";

export type DashboardExportFormat = "pdf" | "pptx" | "png" | "html";

interface ExportRequest {
  canvasElement: HTMLElement;
  dashboard: Dashboard;
  preset: CanvasPreset;
  sectionCount: number;
}

function sanitizeFileName(value: string): string {
  return (value || "dashboard")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

async function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to generate export blob"));
        return;
      }
      resolve(blob);
    }, type);
  });
}

function cropCanvas(
  source: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
): HTMLCanvasElement {
  const nextCanvas = document.createElement("canvas");
  nextCanvas.width = width;
  nextCanvas.height = height;
  const context = nextCanvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas export is not available in this browser");
  }

  context.drawImage(source, x, y, width, height, 0, 0, width, height);
  return nextCanvas;
}

async function captureDashboardCanvas(canvasElement: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas");
  return html2canvas(canvasElement, {
    backgroundColor: "#f8fafc",
    scale: Math.max(2, window.devicePixelRatio || 1),
    useCORS: true,
    logging: false,
  });
}

function getPptLayoutSize(preset: CanvasPreset): { width: number; height: number } {
  if (preset.height > preset.width) {
    const height = 13.333;
    return {
      width: Number((height * (preset.width / preset.height)).toFixed(3)),
      height,
    };
  }

  const width = 13.333;
  return {
    width,
    height: Number((width * (preset.height / preset.width)).toFixed(3)),
  };
}

async function buildStandaloneHtml(canvasElement: HTMLElement, dashboard: Dashboard): Promise<Blob> {
  const clone = canvasElement.cloneNode(true) as HTMLElement;
  const styles = Array.from(document.styleSheets)
    .map((styleSheet) => {
      try {
        return Array.from(styleSheet.cssRules)
          .map((rule) => rule.cssText)
          .join("\n");
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("\n");

  const html = `<!doctype html>
<html class="${document.documentElement.className}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${dashboard.title}</title>
    <style>
      ${styles}
      body {
        margin: 0;
        background: #e2e8f0;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      .dashboard-export-shell {
        min-height: 100vh;
        padding: 32px;
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>
    <div class="dashboard-export-shell">
      ${clone.outerHTML}
    </div>
  </body>
</html>`;

  return new Blob([html], { type: "text/html;charset=utf-8" });
}

export async function exportDashboard(format: DashboardExportFormat, request: ExportRequest) {
  const { canvasElement, dashboard, preset, sectionCount } = request;
  const baseName = sanitizeFileName(dashboard.title);
  const capturedCanvas = await captureDashboardCanvas(canvasElement);
  const scale = capturedCanvas.width / canvasElement.offsetWidth;

  if (format === "png") {
    const blob = await canvasToBlob(capturedCanvas);
    downloadBlob(blob, `${baseName}.png`);
    return;
  }

  if (format === "html") {
    const blob = await buildStandaloneHtml(canvasElement, dashboard);
    downloadBlob(blob, `${baseName}.html`);
    return;
  }

  if (format === "pdf") {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({
      orientation: preset.width >= preset.height ? "landscape" : "portrait",
      unit: "px",
      format: [preset.width, preset.height],
      compress: true,
    });

    for (let index = 0; index < sectionCount; index += 1) {
      if (index > 0) {
        doc.addPage([preset.width, preset.height], preset.width >= preset.height ? "landscape" : "portrait");
      }

      const top = getCanvasSectionTop(index, preset) * scale;
      const sectionCanvas = cropCanvas(
        capturedCanvas,
        0,
        top,
        capturedCanvas.width,
        preset.height * scale,
      );
      doc.addImage(sectionCanvas.toDataURL("image/png"), "PNG", 0, 0, preset.width, preset.height);
    }

    doc.save(`${baseName}.pdf`);
    return;
  }

  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  const layout = getPptLayoutSize(preset);
  pptx.defineLayout({ name: "QUERYFORGE_CUSTOM", width: layout.width, height: layout.height });
  pptx.layout = "QUERYFORGE_CUSTOM";
  pptx.author = "QueryForge";
  pptx.subject = dashboard.title;
  pptx.title = dashboard.title;
  pptx.company = "QueryForge";

  for (let index = 0; index < sectionCount; index += 1) {
    const slide = pptx.addSlide();
    const top = getCanvasSectionTop(index, preset) * scale;
    const sectionCanvas = cropCanvas(
      capturedCanvas,
      0,
      top,
      capturedCanvas.width,
      preset.height * scale,
    );
    slide.addImage({
      data: sectionCanvas.toDataURL("image/png"),
      x: 0,
      y: 0,
      w: layout.width,
      h: layout.height,
    });
  }

  await pptx.writeFile({ fileName: `${baseName}.pptx` });
}
