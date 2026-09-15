/**
 * A real, live, pannable/zoomable Google Map centered on one point — the
 * keyless `output=embed` search-embed URL, so it needs no Google Maps API
 * key/billing setup (unlike the JS Maps API or the official Embed API).
 */
export function GoogleMapEmbed({
  lat,
  lng,
  label,
  height = 180,
  zoom = 13,
}: {
  lat: number;
  lng: number;
  label: string;
  height?: number;
  zoom?: number;
}) {
  return (
    <iframe
      src={`https://www.google.com/maps?q=${lat},${lng}&z=${zoom}&output=embed`}
      className="w-full border-0"
      style={{ height }}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      title={`Map of ${label}`}
    />
  );
}
