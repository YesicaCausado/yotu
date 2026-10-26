"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { removeAvatar, setAvatar } from "@/features/profile/actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/alert";
import type { FormState } from "@/lib/form";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const SIZE = 512;

/** Recorta al centro en cuadrado y reduce a 512 px; elimina metadatos (EXIF, GPS). */
async function prepareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();

  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  // Algunos navegadores (Safari) no codifican WebP y devuelven PNG: se usa JPEG.
  const webp = await toBlob("image/webp");
  if (webp?.type === "image/webp") return webp;
  const jpeg = await toBlob("image/jpeg");
  if (!jpeg) throw new Error("encode");
  return jpeg;
}

export function AvatarUploader({ userId, name, url }: { userId: string; name: string; url: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<FormState | null>(null);
  const [pending, startTransition] = useTransition();

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setState({ status: "error", message: "Usa una imagen JPG, PNG o WebP." });
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setState({ status: "error", message: "La imagen es demasiado grande (máximo 10 MB)." });
      return;
    }

    startTransition(async () => {
      setState(null);
      try {
        const blob = await prepareImage(file);
        const ext = blob.type === "image/webp" ? "webp" : "jpg";
        const path = `${userId}/avatar-${Date.now().toString(36)}.${ext}`;

        const supabase = createClient();
        const { error } = await supabase.storage
          .from("avatars")
          .upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: "3600" });
        if (error) {
          setState({ status: "error", message: "No se pudo subir la imagen. Inténtalo de nuevo." });
          return;
        }
        setState(await setAvatar(path));
      } catch {
        setState({ status: "error", message: "No se pudo procesar la imagen. Prueba con otra." });
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  };

  const onRemove = () => startTransition(async () => setState(await removeAvatar()));

  return (
    <div className="flex flex-col gap-4">
      {state && <FormMessage state={state} />}
      <div className="flex items-center gap-5">
        <Avatar name={name} url={url} size="xl" />
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="sr-only"
            id="avatar-input"
            onChange={(e) => onFile(e.target.files?.[0])}
            disabled={pending}
          />
          <Button type="button" variant="secondary" pending={pending} onClick={() => inputRef.current?.click()}>
            {!pending && <Camera className="size-4" aria-hidden />}
            {url ? "Cambiar foto" : "Subir foto"}
          </Button>
          {url && (
            <Button type="button" variant="ghost" onClick={onRemove} disabled={pending}>
              <Trash2 className="size-4" aria-hidden />
              Quitar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
