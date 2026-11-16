import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import listPlugin from "@fullcalendar/react/list";
import themePlugin from "@fullcalendar/react/themes/monarch";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/monarch/theme.css";
import "@fullcalendar/react/themes/monarch/palettes/purple.css";

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

function formatStatus(value) {
  const status = String(value || "not recorded").replace(/_/g, " ");
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatMoney(centavos) {
  const amount = Number(centavos);
  if (!Number.isFinite(amount) || amount <= 0) return "—";
  return `₱${(amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ReservationCalendar({ reservations, scope, onRefresh }) {
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
      ...(tenancyStatus === "Ended" ? { backgroundColor: "#788780", borderColor: "#788780" } : {}),
      extendedProps: {
        rentalTitle: reservation.rental_title || "Rental",
        tenantName,
        tenantEmail: scope === "admin" ? reservation.tenant_email || "" : "",
        ownerName: scope === "admin" ? reservation.owner_name || "" : "",
        ownerEmail: scope === "admin" ? reservation.owner_email || "" : "",
        occupants: Number(reservation.occupants) || 0,
        termMonths: Number(reservation.term_months) || 0,
        tenancyStatus,
        reservationStatus: reservation.status || "approved",
        paymentStatus: scope === "admin"
          ? reservation.initial_payment_status || "not recorded"
          : reservation.payment_status || "not recorded",
        paymentAmount: scope === "admin" ? Number(reservation.initial_payment_centavos) || 0 : 0,
      },
    }];
  });

  return (
    <div className="reservation-calendar">
      <p className="reservation-calendar-summary">
        {events.length} confirmed reservation{events.length === 1 ? "" : "s"}. Requests awaiting payment are not shown.
      </p>
      <FullCalendar
        plugins={[themePlugin, dayGridPlugin, listPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{ left: "refreshReservations today prev,next", center: "title", right: "dayGridMonth,dayGridWeek,listMonth" }}
        buttons={{
          refreshReservations: {
            text: "Refresh",
            hint: "Refresh reservation data",
            isPrimary: true,
            click: () => onRefresh?.(),
          },
        }}
        buttonText={{ today: "Today", month: "Month", week: "Week", list: "List" }}
        headerToolbarClass="reservation-calendar-toolbar"
        toolbarSectionClass="reservation-calendar-toolbar-section"
        toolbarTitleClass="reservation-calendar-title"
        buttonClass="reservation-calendar-button"
        weekNumbers
        weekTextShort="W"
        firstDay={0}
        fixedWeekCount
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
      {selectedReservation ? <section className="reservation-calendar-detail" aria-live="polite">
        <div className="reservation-calendar-detail-heading">
          <div><p className="eyebrow">RESERVATION #{selectedReservation.id}</p><h3>{selectedReservation.rentalTitle}</h3></div>
          <button type="button" onClick={() => setSelectedReservation(null)}>Clear selection</button>
        </div>
        <div className="reservation-calendar-detail-grid">
          <div className="reservation-calendar-detail-item">
            <span>Tenant</span>
            <strong>{selectedReservation.tenantName}</strong>
            {selectedReservation.tenantEmail && <small>{selectedReservation.tenantEmail}</small>}
          </div>
          {scope === "admin" && <div className="reservation-calendar-detail-item">
            <span>Owner</span>
            <strong>{selectedReservation.ownerName || "Unavailable"}</strong>
            {selectedReservation.ownerEmail && <small>{selectedReservation.ownerEmail}</small>}
          </div>}
          <div className="reservation-calendar-detail-item">
            <span>Move-in</span>
            <strong>{formatDate(selectedReservation.start)}</strong>
          </div>
          <div className="reservation-calendar-detail-item">
            <span>Planned move-out</span>
            <strong>{formatDate(selectedReservation.end)}</strong>
          </div>
          <div className="reservation-calendar-detail-item">
            <span>Occupants · term</span>
            <strong>{selectedReservation.occupants || "Not provided"} · {selectedReservation.termMonths || "—"} months</strong>
          </div>
          {scope === "admin" ? <>
            <div className="reservation-calendar-detail-item">
              <span>Reservation status</span>
              <strong className={`status-tag status-${selectedReservation.reservationStatus}`}>{formatStatus(selectedReservation.reservationStatus)}</strong>
            </div>
            <div className="reservation-calendar-detail-item">
              <span>Initial payment</span>
              <strong>{formatStatus(selectedReservation.paymentStatus)}</strong>
              <small>{formatMoney(selectedReservation.paymentAmount)}</small>
            </div>
          </> : <div className="reservation-calendar-detail-item">
            <span>Tenancy</span>
            <strong>{selectedReservation.tenancyStatus}</strong>
          </div>}
        </div>
      </section> : <p className="reservation-calendar-hint">Select a calendar event to see its reservation details.</p>}
      {!events.length && <p className="dashboard-empty">No paid reservations are available for this calendar yet.</p>}
    </div>
  );
}
