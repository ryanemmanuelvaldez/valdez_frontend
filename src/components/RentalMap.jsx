import { useState } from "react";

const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || "";

export default function RentalMap({ listing }) {
  const [isOpen, setIsOpen] = useState(false);
  const address = [listing.address, listing.location]
    .filter((part) => part && part !== "Not provided")
    .join(", ") || listing.location;
  const latitude = Number(listing.latitude);
  const longitude = Number(listing.longitude);
  const hasCoordinates = listing.latitude !== null && listing.latitude !== "" && listing.longitude !== null && listing.longitude !== ""
    && Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
  const locationQuery = hasCoordinates ? `${latitude},${longitude}` : address;
  const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationQuery)}`;
  const embedUrl = new URL("https://www.google.com/maps/embed/v1/place");

  if (googleMapsApiKey) {
    embedUrl.searchParams.set("key", googleMapsApiKey);
    embedUrl.searchParams.set("q", locationQuery);
  }

  return (
    <div className="rental-map">
      <button
        className="rental-map-toggle"
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? "Hide map" : "Show property map"}
      </button>
      {isOpen && (
        <div className="rental-map-content">
          {googleMapsApiKey ? (
            <iframe
              className="rental-map-frame"
              title={`Map showing ${listing.title}`}
              src={embedUrl.toString()}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          ) : (
            <p className="rental-map-message">
              Map preview is unavailable until a Google Maps API key is configured.
            </p>
          )}
          <a className="rental-map-link" href={searchUrl} target="_blank" rel="noreferrer">
            Open in Google Maps
          </a>
        </div>
      )}
    </div>
  );
}
