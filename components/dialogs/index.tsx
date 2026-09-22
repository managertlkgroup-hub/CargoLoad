"use client";

import { CargoDialog } from "@/components/dialogs/cargo-dialog";
import { PresetsDialog } from "@/components/dialogs/presets-dialog";
import { SessionsDialog } from "@/components/dialogs/sessions-dialog";
import { VehicleDialog } from "@/components/dialogs/vehicle-dialog";
import { VehiclePickerDialog } from "@/components/dialogs/vehicle-picker-dialog";

/** Все модальные диалоги приложения (управляются ui-store: dialog). */
export function Dialogs() {
  return (
    <>
      <CargoDialog />
      <VehicleDialog />
      <VehiclePickerDialog />
      <PresetsDialog />
      <SessionsDialog />
    </>
  );
}
