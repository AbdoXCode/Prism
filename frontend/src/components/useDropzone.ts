import { useCallback, useRef, useState } from "react";

/** Drag-and-drop + file picker for PDFs. */
export function useDropzone(onFiles: (files: File[]) => void) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);

  const takeFiles = useCallback(
    (list: FileList | File[] | null | undefined) => {
      if (!list) return;
      const all = Array.from(list);
      const pdfs = all.filter(
        (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
      );
      if (pdfs.length < all.length) alert("Only PDF files are allowed.");
      if (pdfs.length > 0) onFiles(pdfs);
    },
    [onFiles],
  );

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  const handlers = {
    onDragEnter: (e: React.DragEvent) => {
      e.preventDefault();
      depth.current += 1;
      setDragging(true);
    },
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault();
      depth.current -= 1;
      if (depth.current <= 0) {
        depth.current = 0;
        setDragging(false);
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      takeFiles(e.dataTransfer.files);
    },
    onClick: (e: React.MouseEvent) => {
      // Avoid double-open when clicking the hidden input itself
      if ((e.target as HTMLElement).tagName !== "INPUT") openPicker();
    },
  };

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      takeFiles(e.target.files);
      e.target.value = "";
    },
    [takeFiles],
  );

  return { dragging, inputRef, openPicker, handlers, onInputChange };
}
