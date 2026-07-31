"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import { nestFetch } from "@/lib/api/nest";
import type { PeriodWindows } from "@/lib/admin/template-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LocationMapPicker = dynamic(
  () =>
    import("@/components/admin/location-map-picker").then(
      (m) => m.LocationMapPicker,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-72 items-center justify-center rounded-md border bg-muted/40 text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

type DisbursementSlot = {
  id: string;
  office_name?: string | null;
  program_template_id?: string | null;
  program_name?: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number;
  booked_count: number;
  remaining: number;
  label?: string | null;
  status: string;
  site_name?: string | null;
  site_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  maps_url?: string | null;
};

type ProgramOption = {
  id: string;
  name: string;
  period_windows?: PeriodWindows | null;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDayKey(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthMatrix(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function formatWindow(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function DisbursementSlotsPage() {
  const [slots, setSlots] = useState<DisbursementSlot[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [programId, setProgramId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBookedCount, setEditingBookedCount] = useState(0);
  const [windowStartInput, setWindowStartInput] = useState("");
  const [windowEndInput, setWindowEndInput] = useState("");

  function toLocalInput(iso?: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fromLocalInput(v: string) {
    if (!v.trim()) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const today = useMemo(() => startOfDay(new Date()), []);
  const minLeadDays = 2;
  const earliestSlotDay = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + minLeadDays);
    return d;
  }, [today]);
  const [viewYear, setViewYear] = useState(earliestSlotDay.getFullYear());
  const [viewMonth, setViewMonth] = useState(earliestSlotDay.getMonth());
  const [selectedDate, setSelectedDate] = useState(earliestSlotDay);

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [capacity, setCapacity] = useState("10");
  const [label, setLabel] = useState("Morning queue");
  const [siteName, setSiteName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [latitude, setLatitude] = useState(14.5995);
  const [longitude, setLongitude] = useState(120.9842);

  const selectedProgram = useMemo(
    () => programs.find((p) => p.id === programId) ?? null,
    [programs, programId],
  );

  const windowStart = useMemo(() => {
    const raw = selectedProgram?.period_windows?.disbursement_start;
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [selectedProgram]);

  const windowEnd = useMemo(() => {
    const raw = selectedProgram?.period_windows?.disbursement_end;
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [selectedProgram]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [slotData, tplData] = await Promise.all([
        nestFetch<DisbursementSlot[]>("/admin/disbursement-slots"),
        nestFetch<ProgramOption[]>("/admin/program-templates"),
      ]);
      setSlots(slotData);
      setPrograms(tplData);
      setProgramId((prev) => {
        if (prev && tplData.some((p) => p.id === prev)) return prev;
        return tplData[0]?.id ?? "";
      });
    } catch (e) {
      setSlots([]);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  // Keep local window editors in sync with the selected program.
  useEffect(() => {
    const p = selectedProgram?.period_windows;
    setWindowStartInput(toLocalInput(p?.disbursement_start));
    setWindowEndInput(toLocalInput(p?.disbursement_end));
  }, [selectedProgram]);

  // Jump calendar into the program disbursement window when program changes.
  useEffect(() => {
    const floor = earliestSlotDay;
    let anchor = floor;
    if (windowStart && windowStart > floor) {
      anchor = startOfDay(windowStart);
    }
    setViewYear(anchor.getFullYear());
    setViewMonth(anchor.getMonth());
    setSelectedDate(anchor);
  }, [programId, windowStart, earliestSlotDay]);

  const cells = useMemo(
    () => monthMatrix(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const visibleSlots = useMemo(() => {
    if (!programId) return slots;
    return slots.filter(
      (s) => !s.program_template_id || s.program_template_id === programId,
    );
  }, [slots, programId]);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, DisbursementSlot[]>();
    for (const s of visibleSlots) {
      const key = formatDayKey(new Date(s.starts_at));
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [visibleSlots]);

  const selectedKey = formatDayKey(selectedDate);
  const daySlots = slotsByDay.get(selectedKey) ?? [];

  function dayAllowed(day: Date) {
    const hasSlots = (slotsByDay.get(formatDayKey(day))?.length ?? 0) > 0;
    // Always allow days that already have slots (view / edit).
    if (hasSlots) return true;
    if (day < earliestSlotDay) return false;
    if (!windowStart && !windowEnd) return false;
    if (windowStart && endOfDay(day) < windowStart) return false;
    if (windowEnd && startOfDay(day) > windowEnd) return false;
    return true;
  }

  async function saveDisbursementWindow() {
    if (!programId || !selectedProgram) {
      setError("Select a program first.");
      return;
    }
    const startIso = fromLocalInput(windowStartInput);
    const endIso = fromLocalInput(windowEndInput);
    if (!startIso || !endIso) {
      setError("Set both Disbursement scheduling opens and closes.");
      return;
    }
    if (new Date(endIso) <= new Date(startIso)) {
      setError("Disbursement closes must be after it opens.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const prev = selectedProgram.period_windows ?? {};
      await nestFetch(`/admin/program-templates/${programId}`, {
        method: "PATCH",
        body: {
          period_windows: {
            application_start: prev.application_start ?? null,
            application_end: prev.application_end ?? null,
            review_start: prev.review_start ?? prev.application_start ?? null,
            review_end: prev.review_end ?? null,
            review_leeway_days: 0,
            disbursement_start: startIso,
            disbursement_end: endIso,
          },
        },
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function suggestWindowFromSlots() {
    const floor = earliestSlotDay;
    const end = new Date(floor);
    end.setDate(end.getDate() + 30);
    end.setHours(17, 0, 0, 0);
    const start = new Date(floor);
    start.setHours(8, 0, 0, 0);
    // Prefer spanning existing program slots when present.
    const programSlots = slots.filter(
      (s) => s.program_template_id === programId,
    );
    if (programSlots.length > 0) {
      const times = programSlots.map((s) => new Date(s.starts_at).getTime());
      const min = new Date(Math.min(...times));
      const max = new Date(Math.max(...times));
      min.setHours(0, 0, 0, 0);
      max.setHours(23, 59, 0, 0);
      setWindowStartInput(toLocalInput(min.toISOString()));
      setWindowEndInput(toLocalInput(max.toISOString()));
      return;
    }
    setWindowStartInput(toLocalInput(start.toISOString()));
    setWindowEndInput(toLocalInput(end.toISOString()));
  }

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function combineDateAndTime(date: Date, time: string) {
    const [hh, mm] = time.split(":").map(Number);
    const out = new Date(date);
    out.setHours(hh || 0, mm || 0, 0, 0);
    return out;
  }

  async function reverseGeocode(lat: number, lng: number) {
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        display_name?: string;
        name?: string;
      };
      if (data.display_name) {
        setSiteAddress(data.display_name);
      }
      if (data.name && !siteName.trim()) {
        setSiteName(data.name);
      }
    } catch {
      // Address lookup is best-effort; pin still works.
    } finally {
      setGeocoding(false);
    }
  }

  function onMapPin(lat: number, lng: number) {
    setLatitude(lat);
    setLongitude(lng);
    void reverseGeocode(lat, lng);
  }

  function padTime(d: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function beginEdit(s: DisbursementSlot) {
    const start = new Date(s.starts_at);
    const end = new Date(s.ends_at);
    setEditingId(s.id);
    setEditingBookedCount(s.booked_count ?? 0);
    setSelectedDate(startOfDay(start));
    setViewYear(start.getFullYear());
    setViewMonth(start.getMonth());
    setStartTime(padTime(start));
    setEndTime(padTime(end));
    setCapacity(String(s.capacity));
    setLabel(s.label ?? "");
    setSiteName(s.site_name ?? "");
    setSiteAddress(s.site_address ?? "");
    if (s.latitude != null) setLatitude(Number(s.latitude));
    if (s.longitude != null) setLongitude(Number(s.longitude));
    if (s.program_template_id) setProgramId(s.program_template_id);
    setError(null);
  }

  function clearEdit() {
    setEditingId(null);
    setEditingBookedCount(0);
    setStartTime("09:00");
    setEndTime("11:00");
    setCapacity("10");
    setLabel("Morning queue");
    setSiteName("");
    setSiteAddress("");
    setError(null);
  }

  async function saveSlot() {
    if (editingId) {
      await updateSlot();
    } else {
      await createSlot();
    }
  }

  async function updateSlot() {
    if (!editingId) return;
    if (!dayAllowed(selectedDate)) {
      setError(
        "Selected day is too soon or outside this program’s disbursement window.",
      );
      return;
    }
    const starts = combineDateAndTime(selectedDate, startTime);
    const ends = combineDateAndTime(selectedDate, endTime);
    if (ends <= starts) {
      setError("End time must be after start time.");
      return;
    }
    const nextCapacity = Number(capacity) || 0;
    if (nextCapacity < editingBookedCount) {
      setError(
        `Capacity cannot be below current bookings (${editingBookedCount}). You can only increase capacity.`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await nestFetch(`/admin/disbursement-slots/${editingId}`, {
        method: "PATCH",
        body: {
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          capacity: nextCapacity,
          label: label.trim() || undefined,
          site_name: siteName.trim() || undefined,
          site_address: siteAddress.trim() || undefined,
          latitude,
          longitude,
        },
      });
      clearEdit();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function cancelSlot(id: string) {
    if (!window.confirm("Cancel this slot? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      await nestFetch(`/admin/disbursement-slots/${id}/cancel`, {
        method: "POST",
        body: {},
      });
      if (editingId === id) clearEdit();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function createSlot() {
    if (!programId) {
      setError("Select a program first (uses that program’s disbursement window).");
      return;
    }
    if (!windowStart && !windowEnd) {
      setError(
        "This program has no disbursement window. Edit the program under Programs → Program periods and set Disbursement scheduling opens/closes.",
      );
      return;
    }
    if (!dayAllowed(selectedDate)) {
      setError(
        "Selected day is too soon or outside this program’s disbursement window. Slots must be at least 2 days ahead.",
      );
      return;
    }
    const starts = combineDateAndTime(selectedDate, startTime);
    const ends = combineDateAndTime(selectedDate, endTime);
    if (ends <= starts) {
      setError("End time must be after start time.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await nestFetch("/admin/disbursement-slots", {
        method: "POST",
        body: {
          program_template_id: programId,
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          capacity: Number(capacity) || 10,
          label: label.trim() || undefined,
          site_name: siteName.trim() || undefined,
          site_address: siteAddress.trim() || undefined,
          latitude,
          longitude,
        },
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleString(
    undefined,
    { month: "long", year: "numeric" },
  );

  const windowLabel = (() => {
    const open = formatWindow(
      selectedProgram?.period_windows?.disbursement_start,
    );
    const close = formatWindow(
      selectedProgram?.period_windows?.disbursement_end,
    );
    if (!open && !close) {
      return "No disbursement window on this program — set Disbursement scheduling opens/closes under Programs → Program periods, then refresh.";
    }
    return `Window: ${open ?? "open"} → ${close ?? "open"}`;
  })();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Disbursement schedule
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Slots are tied to a program’s disbursement period (Programs →
            Program periods). Schedule at least {minLeadDays} days ahead —
            same-day / next-day slots are not allowed.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      <div className="space-y-3 rounded-md border bg-muted/30 px-3 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1 space-y-1.5">
            <Label htmlFor="program">Program</Label>
            <select
              id="program"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
            >
              {programs.length === 0 ? (
                <option value="">No programs</option>
              ) : (
                programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <p className="pb-1 text-sm text-muted-foreground">{windowLabel}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="win-start">Disbursement scheduling opens</Label>
            <Input
              id="win-start"
              type="datetime-local"
              value={windowStartInput}
              onChange={(e) => setWindowStartInput(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="win-end">Disbursement scheduling closes</Label>
            <Input
              id="win-end"
              type="datetime-local"
              value={windowEndInput}
              onChange={(e) => setWindowEndInput(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              disabled={busy || !programId}
              onClick={suggestWindowFromSlots}
            >
              Suggest
            </Button>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              disabled={busy || !programId}
              onClick={() => void saveDisbursementWindow()}
            >
              {busy ? "Saving…" : "Save window"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Existing slots still appear on the calendar. Save a disbursement window
          to unlock more days for new slots (also stored on Programs → Program
          periods).
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">{monthLabel}</CardTitle>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => shiftMonth(-1)}
                >
                  Prev
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const floor = earliestSlotDay;
                    const anchor =
                      windowStart && windowStart > floor
                        ? startOfDay(windowStart)
                        : floor;
                    setViewYear(anchor.getFullYear());
                    setViewMonth(anchor.getMonth());
                    setSelectedDate(anchor);
                  }}
                >
                  Soonest
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => shiftMonth(1)}
                >
                  Next
                </Button>
              </div>
            </div>
            <CardDescription>
              {windowStart || windowEnd
                ? `Only days inside this program’s disbursement window and at least ${minLeadDays} days from today can be selected.`
                : "Set Disbursement scheduling opens/closes on Programs for this program before selecting days."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map((day, idx) => {
                if (!day) {
                  return <div key={`empty-${idx}`} className="min-h-16" />;
                }
                const key = formatDayKey(day);
                const count = slotsByDay.get(key)?.length ?? 0;
                const isSelected = sameDay(day, selectedDate);
                const isToday = sameDay(day, today);
                const allowed = dayAllowed(day);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!allowed}
                    onClick={() => setSelectedDate(startOfDay(day))}
                    className={[
                      "min-h-16 rounded-md border p-1.5 text-left transition-colors",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-transparent hover:border-border hover:bg-muted/50",
                      !allowed ? "cursor-not-allowed opacity-35" : "",
                      isToday && !isSelected ? "ring-1 ring-primary/40" : "",
                    ].join(" ")}
                  >
                    <span className="text-sm font-medium">{day.getDate()}</span>
                    {count > 0 ? (
                      <span className="mt-1 block rounded bg-primary/15 px-1 py-0.5 text-[10px] font-medium text-primary">
                        {count} slot{count === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-medium">
                Slots on{" "}
                {selectedDate.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </h3>
              {daySlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No slots for this day yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {daySlots.map((s) => (
                    <li
                      key={s.id}
                      className={[
                        "rounded-md border px-3 py-2 text-sm",
                        editingId === s.id ? "border-primary bg-primary/5" : "",
                      ].join(" ")}
                    >
                      <p className="font-medium">
                        {s.label || "Disbursement slot"}
                      </p>
                      <p className="text-muted-foreground">
                        {new Date(s.starts_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        –{" "}
                        {new Date(s.ends_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {s.booked_count}/{s.capacity} booked
                      </p>
                      {s.program_name ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Program: {s.program_name}
                        </p>
                      ) : null}
                      {(s.site_name || s.site_address) && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {s.site_name}
                          {s.site_address ? ` · ${s.site_address}` : ""}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {s.maps_url ? (
                          <a
                            className="text-xs text-primary underline-offset-2 hover:underline"
                            href={s.maps_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open map
                          </a>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => beginEdit(s)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy || s.booked_count > 0}
                          onClick={() => void cancelSlot(s.id)}
                        >
                          Cancel slot
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? "Edit slot" : "Add slot"}
            </CardTitle>
            <CardDescription>
              Queue window for{" "}
              {selectedDate.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {selectedProgram ? ` · ${selectedProgram.name}` : ""}. Must fall
              inside the program disbursement period.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="start-time">Starts</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end-time">Ends</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cap">Capacity</Label>
                <Input
                  id="cap"
                  type="number"
                  min={editingId ? Math.max(1, editingBookedCount) : 1}
                  max={500}
                  value={capacity}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setCapacity(raw);
                    if (!editingId) return;
                    const n = Number(raw);
                    if (
                      Number.isFinite(n) &&
                      n < editingBookedCount &&
                      raw.trim() !== ""
                    ) {
                      setError(
                        `Capacity cannot go below ${editingBookedCount} booked seat${editingBookedCount === 1 ? "" : "s"}. Increase only.`,
                      );
                    } else if (
                      error?.includes("booked") ||
                      error?.includes("Capacity cannot")
                    ) {
                      setError(null);
                    }
                  }}
                />
                {editingId ? (
                  <p className="text-xs text-muted-foreground">
                    {editingBookedCount > 0
                      ? editingBookedCount >= Number(capacity)
                        ? `Slot is full (${editingBookedCount}/${capacity}). You can increase capacity but not reduce it below ${editingBookedCount}.`
                        : `Minimum capacity is ${editingBookedCount} (already booked). You may increase capacity freely.`
                      : "No bookings yet — capacity can be changed freely."}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Morning queue A"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="site">Site name</Label>
                <Input
                  id="site"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="NCR Field Office — Cash window"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="addr">
                  Site address
                  {geocoding ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      Looking up…
                    </span>
                  ) : null}
                </Label>
                <Input
                  id="addr"
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                  placeholder="Click the map to auto-fill from the pin"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Disbursement site pin</Label>
              <LocationMapPicker
                latitude={latitude}
                longitude={longitude}
                onChange={onMapPin}
              />
              <p className="text-xs text-muted-foreground">
                Lat {latitude.toFixed(6)}, Lng {longitude.toFixed(6)} ·
                OpenStreetMap (drag or click to set pin)
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy || !programId || !dayAllowed(selectedDate)}
                onClick={() => void saveSlot()}
              >
                {busy
                  ? "Saving…"
                  : editingId
                    ? "Save changes"
                    : "Create slot"}
              </Button>
              {editingId ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={clearEdit}
                >
                  Stop editing
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
