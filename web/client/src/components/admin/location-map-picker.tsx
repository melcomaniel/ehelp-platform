"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Props = {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
  className?: string;
};

const DEFAULT_ZOOM = 15;

function fixDefaultIcons() {
  // Next/webpack breaks Leaflet's default marker image paths.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

export function LocationMapPicker({
  latitude,
  longitude,
  onChange,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    fixDefaultIcons();

    const map = L.map(containerRef.current, {
      center: [latitude, longitude],
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([latitude, longitude], {
      draggable: true,
    }).addTo(map);

    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      onChangeRef.current(
        Number(pos.lat.toFixed(6)),
        Number(pos.lng.toFixed(6)),
      );
    });

    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      onChangeRef.current(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
    });

    mapRef.current = map;
    markerRef.current = marker;

    // Leaflet needs a tick after mount in flex layouts.
    const t = window.setTimeout(() => map.invalidateSize(), 80);

    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Initialize once; lat/lng sync handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const current = marker.getLatLng();
    if (
      Math.abs(current.lat - latitude) < 1e-7 &&
      Math.abs(current.lng - longitude) < 1e-7
    ) {
      return;
    }
    marker.setLatLng([latitude, longitude]);
    map.panTo([latitude, longitude]);
  }, [latitude, longitude]);

  return (
    <div
      ref={containerRef}
      className={className ?? "h-72 w-full rounded-md border"}
      role="application"
      aria-label="Map pin picker. Click or drag the marker to set location."
    />
  );
}
