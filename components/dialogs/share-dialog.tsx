"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useT } from "@/hooks/use-t";
import { shareUrl } from "@/lib/advanced/share";
import { useLayoutStore } from "@/store/use-layout-store";
import { useUiStore } from "@/store/use-ui-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Диалог «Поделиться»: ссылка-хэш #s=… + QR-код восстановления раскладки. */
export function ShareDialog() {
  const t = useT();
  const dialog = useUiStore((s) => s.dialog);
  const dialogOpen = useUiStore((s) => s.dialogOpen);
  const closeDialog = useUiStore((s) => s.closeDialog);
  const open = dialogOpen && dialog?.kind === "share";

  const items = useLayoutStore((s) => s.items);
  const vehicleId = useLayoutStore((s) => s.vehicleId);
  const mode = useLayoutStore((s) => s.mode);
  const gaps = useLayoutStore((s) => s.gaps);
  const placements = useLayoutStore((s) => s.placements);
  const stops = useLayoutStore((s) => s.stops);
  const loadingSide = useLayoutStore((s) => s.loadingSide);
  const stacking = useLayoutStore((s) => s.stacking);
  const lifo = useLayoutStore((s) => s.lifo);
  const maxLayers = useLayoutStore((s) => s.maxLayers);

  // сессия строится один раз на изменение стора — стабильный deps для эффектов
  const session = useMemo(
    () => ({
      items,
      vehicleId,
      mode,
      gaps,
      placements,
      stops,
      loadingSide,
      stacking,
      lifo,
      maxLayers,
    }),
    [
      items,
      vehicleId,
      mode,
      gaps,
      placements,
      stops,
      loadingSide,
      stacking,
      lifo,
      maxLayers,
    ]
  );

  const [url, setUrl] = useState("");
  const [qr, setQr] = useState<{ link: string; dataUrl: string } | null>(null);
  const [qrError, setQrError] = useState(false);

  // кодирование ссылки асинхронное (gzip) — генерируем URL после открытия
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void shareUrl(session).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [open, session]);

  // QR-код генерируется из полного URL
  useEffect(() => {
    if (!open || !url) return;
    if (qr && qr.link === url) return; // уже сгенерирован для этого URL
    let cancelled = false;
    QRCode.toDataURL(url, { errorCorrectionLevel: "L", width: 240, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) {
          setQrError(false);
          setQr({ link: url, dataUrl });
        }
      })
      .catch(() => {
        // слишком длинный URL не умещается в QR-кадр — показываем заглушку
        if (!cancelled) setQrError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, url, qr]);

  const dataUrl = qr && qr.link === url ? qr.dataUrl : "";

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast(t("toast.copied"));
      return;
    } catch {
      // fallback: старые браузеры / небезопасный контекст без Clipboard API
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        toast(t("toast.copied"));
      } catch {
        toast.error(t("toast.copyFailed"));
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("share.title")}</DialogTitle>
          <DialogDescription>{t("share.desc")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-xl bg-white p-3">
            {qrError ? (
              <div className="flex size-[240px] flex-col items-center justify-center gap-2 rounded-md bg-muted/10 px-4 text-center">
                <p className="text-[12px] leading-snug text-muted">
                  {t("share.qrFailed")}
                </p>
              </div>
            ) : dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- QR — data:URL, оптимизация не нужна
              <img
                src={dataUrl}
                alt={t("share.qrLabel")}
                width={240}
                height={240}
                className="block size-[240px]"
              />
            ) : (
              <div className="size-[240px] animate-pulse rounded-md bg-muted/30" />
            )}
          </div>
          <p className="max-w-full truncate font-mono text-[11px] text-muted" title={url}>
            {url || " "}
          </p>
          <Button onClick={copy} disabled={!url} aria-label={t("share.copy")}>
            {t("share.copy")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}