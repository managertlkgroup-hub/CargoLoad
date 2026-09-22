"use client";

import { Check, FolderOpen, HardDrive, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useT } from "@/hooks/use-t";
import { createSessionNameSchema, validateOrError } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { useSessionsStore } from "@/store/use-sessions-store";
import { useUiStore } from "@/store/use-ui-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

/** Список сохранённых сессий: сохранить / загрузить / удалить с подтверждением. */
export function SessionsDialog() {
  const t = useT();
  const locale = useUiStore((s) => s.locale);
  const dialog = useUiStore((s) => s.dialog);
  const dialogOpen = useUiStore((s) => s.dialogOpen);
  const closeDialog = useUiStore((s) => s.closeDialog);

  const sessions = useSessionsStore((s) => s.sessions);
  const saveSession = useSessionsStore((s) => s.saveSession);
  const loadSession = useSessionsStore((s) => s.loadSession);
  const removeSession = useSessionsStore((s) => s.removeSession);

  const open = dialogOpen && dialog?.kind === "sessions";
  const [name, setName] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  /** сброс локального состояния при закрытии (вместо setState-in-effect) */
  const onOpenChange = (v: boolean) => {
    if (!v) {
      setName("");
      setConfirmId(null);
      closeDialog();
    }
  };

  const dateFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale]
  );

  const onSave = () => {
    const r = validateOrError(createSessionNameSchema(t), name);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    saveSession(r.data);
    setName("");
    toast(t("toast.sessionSaved"));
  };

  const onLoad = (id: string) => {
    if (loadSession(id)) {
      toast(t("toast.sessionLoaded"));
      closeDialog();
    }
  };

  return (
    <Dialog open={!!open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("sessions.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("sessions.title")}</DialogDescription>
        </DialogHeader>

        {/* сохранить текущую */}
        <div className="grid gap-1.5">
          <Label htmlFor="sess-name">{t("sessions.nameLabel")}</Label>
          <div className="flex gap-2">
            <Input
              id="sess-name"
              value={name}
              placeholder={t("sessions.namePlaceholder")}
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSave();
                }
              }}
            />
            <Button type="button" onClick={onSave} className="shrink-0">
              <HardDrive className="size-4" />
              {t("sessions.saveCurrent")}
            </Button>
          </div>
        </div>

        {/* список */}
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong/70 p-6 text-center">
            <div className="rounded-2xl bg-accent/12 p-3.5">
              <FolderOpen className="size-6 text-accent" />
            </div>
            <p className="text-sm font-medium text-fg-2">{t("sessions.empty")}</p>
            <p className="max-w-[320px] text-xs leading-relaxed text-muted">
              {t("sessions.empty.hint")}
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[45dvh] pr-1">
            <ul className="grid gap-1.5">
              {sessions.map((s) => {
                const confirming = confirmId === s.id;
                return (
                  <li
                    key={s.id}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl border p-3 transition-all duration-150",
                      confirming
                        ? "border-danger/50 bg-danger/8"
                        : "border-border bg-panel-soft/60 hover:border-border-strong hover:bg-panel"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium text-fg">{s.name}</div>
                      <div className="tnum truncate text-[11px] text-muted">
                        {t("sessions.updated")}: {dateFormat.format(new Date(s.updatedAt))}
                        {" · "}
                        {t("sessions.positions", { n: s.data.items.length })}
                      </div>
                    </div>

                    {confirming ? (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-danger hover:text-danger"
                          aria-label={t("action.confirm")}
                          onClick={() => {
                            removeSession(s.id);
                            setConfirmId(null);
                            toast(t("toast.sessionRemoved"));
                          }}
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("action.cancel")}
                          onClick={() => setConfirmId(null)}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex shrink-0 gap-0.5 opacity-80 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <Button variant="outline" size="sm" onClick={() => onLoad(s.id)}>
                          {t("sessions.load")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="hover:text-danger"
                          aria-label={t("action.delete")}
                          onClick={() => setConfirmId(s.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
