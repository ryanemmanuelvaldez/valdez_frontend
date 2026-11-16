import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";

function normalizeReservationDate(value) {
  const date = String(value || "").slice(0, 10);
  const parts = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return "";
  const parsed = new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])));
  return parsed.getUTCFullYear() === Number(parts[1])
    && parsed.getUTCMonth() === Number(parts[2]) - 1
    && parsed.getUTCDate() === Number(parts[3])
    ? date
    : "";
}

function reservationEndDate(moveIn, moveOut, termMonths) {
  const start = normalizeReservationDate(moveIn);
  const explicitEnd = normalizeReservationDate(moveOut);
  if (explicitEnd && explicitEnd > start) return explicitEnd;
  if (!start) return "";

  const [year, month, day] = start.split("-").map(Number);
  const totalMonths = year * 12 + month - 1 + Math.max(1, Number(termMonths) || 1);
  const endYear = Math.floor(totalMonths / 12);
  const endMonth = totalMonths % 12;
  const endDay = Math.min(day, new Date(Date.UTC(endYear, endMonth + 1, 0)).getUTCDate());
  return `${endYear}-${String(endMonth + 1).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
}

function formatDate(value) {
  const date = normalizeReservationDate(value);
  if (!date) return "—";
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ReservationCalendar({ reservations, scope }) {
  const [selectedReservation, setSelectedReservation] = useState(null);
  const events = (reservations || []).flatMap((reservation) => {
    const confirmed = scope === "owner"
      ? reservation.payment_status === "paid"
      : reservation.status === "approved" && reservation.initial_payment_status === "paid";
    if (!confirmed) return [];

    const start = normalizeReservationDate(reservation.move_in);
    const end = reservationEndDate(reservation.move_in, reservation.move_out, reservation.term_months);
    if (!start || !end || end <= start) return [];

    const tenantName = scope === "owner"
      ? reservation.display_name || reservation.tenant_name || "Tenant"
      : reservation.tenant_name || "Tenant";
    const tenancyStatus = reservation.tenancy_status === "ended" ? "Ended" : "Active";
    return [{
      id: String(reservation.id),
      title: `${reservation.rental_title || "Rental"} · ${tenantName}`,
      start,
      end,
      allDay: true,
      classNames: tenancyStatus === "Ended" ? ["reservation-event-ended"] : [],
      extendedProps: {
        rentalTitle: reservation.rental_title || "Rental",
        tenantName,
        ownerName: reservation.owner_name || "",
        occupants: Number(reservation.occupants) || 0,
        termMonths: Number(reservation.term_months) || 0,
        tenancyStatus,
      },
    }];
  });

  return (
    <div className="reservation-calendar">
      <p className="reservation-calendar-summary">
        {events.length} confirmed reservation{events.length === 1 ? "" : "s"}. Requests awaiting payment are not shown.
      </p>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,listMonth" }}
        buttonText={{ today: "Today", month: "Month", week: "Week", list: "Agenda" }}
        events={events}
        eventClick={({ event }) => setSelectedReservation({
          id: event.id,
          title: event.title,
          start: event.startStr,
          end: event.endStr,
          ...event.extendedProps,
        })}
        dayMaxEvents
        height="auto"
        contentHeight="auto"
      />
      {selectedReservation && <section className="reservation-calendar-detail" aria-live="polite">
        <div><p className="eyebrow">SELECTED RESERVATION</p><h3>{selectedReservation.rentalTitle}</h3></div>
        <button type="button" onClick={() => setSelectedReservation(null)}>Clear selection</button>
        <p><strong>Tenant:</strong> {selectedReservation.tenantName}</p>
        {scope === "admin" && <p><strong>Owner:</strong> {selectedReservation.ownerName || "Unavailable"}</p>}
        <p><strong>Move-in:</strong> {formatDate(selectedReservation.start)} · <strong>Planned move-out:</strong> {formatDate(selectedReservation.end)}</p>
        <p><strong>Occupants:</strong> {selectedReservation.occupants} · <strong>Term:</strong> {selectedReservation.termMonths} months · <strong>Status:</strong> {selectedReservation.tenancyStatus}</p>
      </section>}
      {!events.length && <p className="dashboard-empty">No paid reservations are available for this calendar yet.</p>}
    </div>
  );
}
