"use client";

import { useEffect, useRef, useState } from "react";
import { listOrderPhotos, toViewPhoto, uploadOrderPhoto } from "./order-media";
import type { OrderPhoto } from "./order-types";

export type PendingPhoto = { localId: string; caption: string; previewUrl?: string; error?: string };

export function useOrderPhotos(studioId: string, workOrderId: string, initial: OrderPhoto[]) {
  const [photos, setPhotos] = useState(initial);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const generation = useRef(0);
  const previews = useRef<string[]>([]);

  useEffect(() => {
    const gen = generation.current;
    let cancelled = false;
    listOrderPhotos(studioId, workOrderId)
      .then((list) => {
        if (!cancelled && generation.current === gen) setPhotos(list.map(toViewPhoto));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [studioId, workOrderId]);

  useEffect(() => () => {
    for (const url of previews.current) URL.revokeObjectURL(url);
  }, []);

  function rememberPreview(file: File) {
    if (typeof URL.createObjectURL !== "function") return undefined;
    const url = URL.createObjectURL(file);
    previews.current.push(url);
    return url;
  }

  async function uploadFiles(files: File[], stage: number) {
    setUploading(true);
    generation.current += 1;
    try {
      for (const file of files) {
        const localId = crypto.randomUUID();
        const previewUrl = rememberPreview(file);
        setPending((current) => [...current, { localId, caption: file.name, previewUrl }]);
        try {
          const confirmed = await uploadOrderPhoto({ studioId, workOrderId, file, stage });
          setPhotos((current) => current.some((item) => item.id && item.id === confirmed.id) ? current : [...current, toViewPhoto(confirmed)]);
          try {
            setPhotos((await listOrderPhotos(studioId, workOrderId)).map(toViewPhoto));
          } catch {
            // Potwierdzone zdjęcie ma już podpisany adres z odpowiedzi confirm.
          }
          setPending((current) => current.filter((item) => item.localId !== localId));
          if (previewUrl) URL.revokeObjectURL(previewUrl);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Nie udało się dodać zdjęcia.";
          setPending((current) => current.map((item) => item.localId === localId ? { ...item, error: message } : item));
        }
      }
    } finally {
      setUploading(false);
    }
  }

  return { photos, pending, uploading, uploadFiles };
}
