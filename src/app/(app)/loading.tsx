export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando">
      <div className="h-9 w-48 animate-pulse rounded-full bg-blush-100" />
      <div className="h-40 animate-pulse rounded-3xl bg-cream-50 shadow-soft" />
      <div className="h-28 animate-pulse rounded-3xl bg-cream-50 shadow-soft" />
    </div>
  );
}
