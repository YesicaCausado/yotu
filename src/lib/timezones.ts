/**
 * Lista de zonas horarias IANA para los selectores. Se calcula en el servidor
 * y se pasa como prop para evitar diferencias de hidratación entre el ICU de
 * Node y el del navegador.
 */
export function listTimeZones(current?: string | null) {
  const zones = new Set(Intl.supportedValuesOf("timeZone"));
  zones.add("UTC");
  if (current) zones.add(current);
  return [...zones].sort();
}
