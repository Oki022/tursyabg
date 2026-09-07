/**
 * Индексиране от търсачките.
 *
 * По подразбиране сайтът е ЗАТВОРЕН за търсачки (период на тестване).
 * Отваря се със `VITE_ALLOW_INDEXING=true` в средата (и по избор
 * `ALLOW_INDEXING=true` за сървърните маршрути), без промяна в кода.
 */

function truthy(value: unknown): boolean {
  return typeof value === "string" && ["true", "1", "yes"].includes(value.trim().toLowerCase());
}

/** Стойността, използвана и при сървърното, и при браузърното рисуване. */
export function allowIndexing(): boolean {
  return truthy((import.meta as { env?: Record<string, unknown> }).env?.["VITE_ALLOW_INDEXING"]);
}

/** Само за сървърни маршрути (robots.txt): позволява и сървърна променлива. */
export function allowIndexingServer(): boolean {
  const fromProcess =
    typeof process !== "undefined" ? process.env?.["ALLOW_INDEXING"] : undefined;
  if (typeof fromProcess === "string" && fromProcess.trim() !== "") return truthy(fromProcess);
  return allowIndexing();
}
