import Image from "next/image";

const sizes = { sm: "size-9 text-sm", md: "size-12 text-base", lg: "size-20 text-2xl", xl: "size-28 text-3xl" };

export function Avatar({
  name,
  url,
  size = "md",
}: {
  name: string;
  url: string | null;
  size?: keyof typeof sizes;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-blush-200 font-display font-semibold text-wine-700 ring-2 ring-cream-50 ${sizes[size]}`}
    >
      {url ? (
        // URL firmada de corta duración: no se pasa por el optimizador de imágenes.
        <Image src={url} alt={`Foto de ${name}`} fill unoptimized sizes="112px" className="object-cover" />
      ) : (
        <span aria-hidden>{initials || "♡"}</span>
      )}
    </span>
  );
}
