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

  const url = useMemo(
    () =>
      open
        ? shareUrl({
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
          })
        : "",
    [
      open,
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

  const [qr, setQr] = useState<{ link: string; dataUrl: string } | null>(null);

  useEffect(() => {
    if (!open || !url) return;
    if (qr && qr.link === url) return;
    let cancelled = false;
    QRCode.toDataURL(url, { errorCorrectionLevel: "M", width: 240, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) setQr({ link: url, dataUrl });
      })
      .catch(() => undefined);
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
    } catch {
      toast.error(t("toast.copyFailed"));
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
            {dataUrl ? (
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
          <p className="max-w-full truncate font-mono text-[11px] text-muted">{url}</p>
          <Button onClick={copy} disabled={!url} aria-label={t("share.copy")}>
            {t("share.copy")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}