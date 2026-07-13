// Client-side image sharing via html-to-image + Web Share API (no backend).
import { toPng } from "html-to-image";

export async function renderNodeToPng(node, opts = {}) {
  return toPng(node, { pixelRatio: opts.pixelRatio || 2, cacheBust: true, backgroundColor: opts.backgroundColor || "#FBF8F2", ...opts });
}

export async function shareOrDownloadPng(dataUrl, filename = "meditrax.png", title = "Meditrax") {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title, text: title });
      return "shared";
    }
  } catch (e) {
    if (e?.name === "AbortError") return "cancelled";
    // fall through to download
  }
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
  return "downloaded";
}

export async function shareNode(node, { filename, title } = {}) {
  const dataUrl = await renderNodeToPng(node);
  return shareOrDownloadPng(dataUrl, filename, title);
}
