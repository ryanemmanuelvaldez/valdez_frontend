import { useEffect, useRef, useState } from "react";
import { propertyPhotoSource } from "../lib/api.js";

const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || "";
const defaultCenter = { lat: 12.8797, lng: 121.774 };
let mapsApiPromise;

function loadMapsApi() {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (!mapsApiKey) return Promise.reject(new Error("Add VITE_GOOGLE_MAPS_API_KEY to Frontend/.env.local to use the property map."));
  if (mapsApiPromise) return mapsApiPromise;

  mapsApiPromise = new Promise((resolve, reject) => {
    const callbackName = "__renteaseGoogleMapsReady";
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      delete window[callbackName];
      reject(new Error("Google Maps did not load. Check that the Maps JavaScript API is enabled and the key allows this site."));
    }, 20000);

    window[callbackName] = () => {
      window.clearTimeout(timeout);
      resolve(window.google.maps);
      delete window[callbackName];
    };
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(mapsApiKey)}&callback=${callbackName}&v=weekly`;
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timeout);
      delete window[callbackName];
      reject(new Error("Google Maps could not load. Check the Maps JavaScript API and API key restrictions."));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    mapsApiPromise = null;
    throw error;
  });

  return mapsApiPromise;
}

function validCoordinatePair(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return latitude !== "" && longitude !== "" && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    ? { lat, lng }
    : null;
}

function createPropertyCard(listing, position) {
  const card = document.createElement("article");
  card.className = "property-map-info-card";

  const close = document.createElement("button");
  close.className = "property-map-info-close";
  close.type = "button";
  close.setAttribute("aria-label", "Close property details");
  close.textContent = "×";
  close.addEventListener("click", () => card.dispatchEvent(new CustomEvent("closepropertyinfo", { bubbles: true })));
  card.append(close);

  const photoUrl = propertyPhotoSource(listing);
  if (photoUrl) {
    const photo = document.createElement("img");
    photo.className = "property-map-info-photo";
    photo.src = photoUrl;
    photo.alt = listing.title ? `${listing.title} property` : "Rental property";
    photo.loading = "lazy";
    photo.onerror = () => photo.remove();
    card.append(photo);
  }

  const heading = document.createElement("div");
  heading.className = "property-map-info-heading";
  const title = document.createElement("strong");
  title.textContent = listing.title || "Rental property";
  heading.append(title);
  const price = Number(listing.price);
  if (Number.isFinite(price) && price > 0) {
    const rent = document.createElement("span");
    rent.textContent = `₱${price.toLocaleString()} / month`;
    heading.append(rent);
  }
  const directions = document.createElement("a");
  directions.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${position.lat},${position.lng}`)}`;
  directions.target = "_blank";
  directions.rel = "noreferrer";
  directions.textContent = "Directions";
  heading.append(directions);
  card.append(heading);

  const details = document.createElement("div");
  details.className = "property-map-info-details";
  const propertyType = String(listing.property_type || "").replaceAll("_", " ");
  if (propertyType) {
    const type = document.createElement("p");
    type.className = "property-map-info-type";
    type.textContent = propertyType;
    details.append(type);
  }
  const addressText = [listing.unit_number, listing.address, listing.location].filter(Boolean).join(", ");
  if (addressText) {
    const address = document.createElement("p");
    address.className = "property-map-info-address";
    address.textContent = addressText;
    details.append(address);
  }
  if (listing.owner_name) {
    const owner = document.createElement("p");
    owner.textContent = `Owner: ${listing.owner_name}`;
    details.append(owner);
  }
  if (listing.contact_phone) {
    const phone = document.createElement("a");
    phone.href = `tel:${listing.contact_phone}`;
    phone.textContent = listing.contact_phone;
    details.append(phone);
  }
  if (listing.owner_email) {
    const email = document.createElement("a");
    email.href = `mailto:${listing.owner_email}`;
    email.textContent = listing.owner_email;
    details.append(email);
  }
  const capacity = [
    listing.rooms_count ?? listing.bedrooms ? `${listing.rooms_count ?? listing.bedrooms} room${Number(listing.rooms_count ?? listing.bedrooms) === 1 ? "" : "s"}` : "",
    listing.bed_count ? `${listing.bed_count} bed${Number(listing.bed_count) === 1 ? "" : "s"}` : "",
    listing.bathrooms ? `${listing.bathrooms} bath${Number(listing.bathrooms) === 1 ? "" : "s"}` : "",
    listing.max_occupants ? `Up to ${listing.max_occupants} occupants` : "",
    listing.floor_area ? `${listing.floor_area} m²` : "",
  ].filter(Boolean);
  if (capacity.length) {
    const facts = document.createElement("p");
    facts.className = "property-map-info-facts";
    facts.textContent = capacity.join(" · ");
    details.append(facts);
  }
  if (listing.furnishing) {
    const furnishing = document.createElement("p");
    furnishing.textContent = `${String(listing.furnishing).replaceAll("_", " ")}${Number(listing.utilities_included) ? " · Utilities included" : ""}`;
    details.append(furnishing);
  }
  if (listing.amenities) {
    const amenities = document.createElement("p");
    amenities.textContent = `Amenities: ${String(listing.amenities).split(",").map((amenity) => amenity.trim()).filter(Boolean).join(", ")}`;
    details.append(amenities);
  }
  if (listing.available_from) {
    const availability = document.createElement("p");
    availability.textContent = `Available ${new Date(`${listing.available_from}T00:00:00`).toLocaleDateString()}`;
    details.append(availability);
  }
  if (Number(listing.security_deposit) > 0) {
    const deposit = document.createElement("p");
    deposit.textContent = `Security deposit: ₱${Number(listing.security_deposit).toLocaleString()}`;
    details.append(deposit);
  }
  if (listing.status) {
    const status = document.createElement("p");
    status.textContent = `Listing status: ${String(listing.status).replaceAll("_", " ")}`;
    details.append(status);
  }
  if (listing.description) {
    const description = document.createElement("p");
    description.className = "property-map-info-description";
    description.textContent = listing.description;
    details.append(description);
  }
  card.append(details);
  return card;
}

function PropertyMap({ markers = [], selectedLocation = null, selectedListingId = null, onLocationSelect, className = "" }) {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const mapClickListenerRef = useRef(null);
  const onLocationSelectRef = useRef(onLocationSelect);
  const markerObjectsRef = useRef([]);
  const infoOverlayRef = useRef(null);
  const dismissTimerRef = useRef(null);
  const [mapsApi, setMapsApi] = useState(null);
  const [error, setError] = useState("");

  onLocationSelectRef.current = onLocationSelect;

  useEffect(() => {
    let active = true;
    loadMapsApi()
      .then((maps) => {
        if (active) setMapsApi(maps);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!mapsApi || !mapElementRef.current) return undefined;
    const firstMarker = markers.find((marker) => validCoordinatePair(marker.latitude, marker.longitude));
    const center = selectedLocation || (firstMarker && validCoordinatePair(firstMarker.latitude, firstMarker.longitude)) || defaultCenter;
    const map = new mapsApi.Map(mapElementRef.current, {
      center,
      zoom: selectedLocation || firstMarker ? 14 : 6,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      clickableIcons: false,
      zoomControl: true,
    });
    mapRef.current = map;
    if (onLocationSelectRef.current) {
      mapClickListenerRef.current = map.addListener("click", (event) => {
        const point = event.latLng?.toJSON();
        if (point) onLocationSelectRef.current(point);
      });
    }

    return () => {
      mapClickListenerRef.current?.remove();
      mapClickListenerRef.current = null;
      markerObjectsRef.current.forEach((marker) => marker.setMap(null));
      markerObjectsRef.current = [];
      infoOverlayRef.current?.setMap(null);
      infoOverlayRef.current = null;
      mapRef.current = null;
    };
  }, [mapsApi, Boolean(onLocationSelect)]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapsApi || !map) return;

    markerObjectsRef.current.forEach((marker) => marker.setMap(null));
    markerObjectsRef.current = [];
    const points = [];
    const listingMarkers = new Map();
    const cancelDismissal = () => {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    };
    const scheduleDismissal = () => {
      cancelDismissal();
      dismissTimerRef.current = window.setTimeout(() => {
        infoOverlayRef.current?.setMap(null);
        dismissTimerRef.current = null;
      }, 180);
    };
    class PropertyInfoOverlay extends mapsApi.OverlayView {
      constructor(position, content) {
        super();
        this.position = position;
        this.handleViewportChange = () => this.draw();
        this.container = document.createElement("div");
        this.container.className = "property-map-info-overlay";
        this.container.append(content);
        this.container.addEventListener("closepropertyinfo", () => this.setMap(null));
        this.container.addEventListener("pointerenter", cancelDismissal);
        this.container.addEventListener("pointerleave", scheduleDismissal);
        this.setMap(map);
      }

      onAdd() {
        document.body.appendChild(this.container);
        this.resizeObserver = new ResizeObserver(() => this.draw());
        this.resizeObserver.observe(this.container);
        window.addEventListener("scroll", this.handleViewportChange, true);
        window.addEventListener("resize", this.handleViewportChange);
      }

      draw() {
        const pixel = this.getProjection().fromLatLngToDivPixel(this.position);
        if (!pixel) return;
        const mapBounds = mapElementRef.current.getBoundingClientRect();
        const maxWidth = Math.max(180, Math.min(380, mapBounds.width - 24, window.innerWidth - 24));
        this.container.style.setProperty("--map-overlay-max-width", `${maxWidth}px`);
        const popupWidth = this.container.offsetWidth;
        const popupHeight = this.container.offsetHeight;
        const anchorX = mapBounds.left + pixel.x;
        const anchorY = mapBounds.top + pixel.y;
        const left = Math.max(popupWidth / 2 + 12, Math.min(window.innerWidth - popupWidth / 2 - 12, anchorX));
        let top = anchorY - popupHeight - 18;
        if (top < 12) top = anchorY + 18;
        if (top + popupHeight > window.innerHeight - 12) {
          top = Math.max(12, window.innerHeight - popupHeight - 12);
        }
        this.container.style.left = `${left}px`;
        this.container.style.top = `${top}px`;
        this.container.style.visibility = "visible";
      }

      onRemove() {
        this.resizeObserver?.disconnect();
        this.container.removeEventListener("pointerenter", cancelDismissal);
        this.container.removeEventListener("pointerleave", scheduleDismissal);
        window.removeEventListener("scroll", this.handleViewportChange, true);
        window.removeEventListener("resize", this.handleViewportChange);
        this.container.remove();
        if (infoOverlayRef.current === this) infoOverlayRef.current = null;
      }
    }

    const addMarker = (position, listings) => {
      const markerTitle = listings.length === 0
        ? "Selected property location"
        : listings.length > 1
          ? `${listings.length} properties at this location`
          : listings[0].title || "Rental property";
      const marker = new mapsApi.Marker({
        map,
        position,
        title: markerTitle,
        draggable: listings.length === 0 && Boolean(onLocationSelectRef.current),
        icon: {
          url: "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='48' viewBox='0 0 40 48'%3E%3Cpath fill='%23f47b20' stroke='white' stroke-width='2' d='M20 1C9.5 1 1 9.5 1 20c0 13 19 27 19 27s19-14 19-27C39 9.5 30.5 1 20 1z'/%3E%3Ccircle cx='20' cy='20' r='7' fill='white'/%3E%3C/svg%3E",
          scaledSize: new mapsApi.Size(32, 38),
          anchor: new mapsApi.Point(16, 36),
        },
        ...(listings.length > 1 ? { label: String(listings.length) } : {}),
      });
      markerObjectsRef.current.push(marker);
      points.push(position);
      listings.forEach((listing) => listingMarkers.set(String(listing.id), marker));
      if (listings.length === 0 && onLocationSelectRef.current) {
        marker.addListener("dragend", (event) => {
          const point = event.latLng?.toJSON();
          if (point) onLocationSelectRef.current(point);
        });
      }
      if (listings.length) {
        const showPropertyDetails = () => {
          cancelDismissal();
          infoOverlayRef.current?.setMap(null);
          const content = document.createElement("div");
          content.className = "property-map-info-list";
          listings.forEach((listing, index) => {
            const card = createPropertyCard(listing, position);
            if (index < listings.length - 1) card.classList.add("has-divider");
            content.append(card);
          });
          infoOverlayRef.current = new PropertyInfoOverlay(position, content);
        };
        marker.addListener("mouseover", showPropertyDetails);
        marker.addListener("click", showPropertyDetails);
        marker.addListener("mouseout", scheduleDismissal);
      }
      return marker;
    };

    const locations = new Map();
    markers.forEach((listing) => {
      const position = validCoordinatePair(listing.latitude, listing.longitude);
      if (!position) return;
      const key = `${position.lat},${position.lng}`;
      if (!locations.has(key)) locations.set(key, { position, listings: [] });
      locations.get(key).listings.push(listing);
    });
    locations.forEach(({ position, listings: properties }) => addMarker(position, properties));
    if (selectedLocation) addMarker(selectedLocation, []);

    if (points.length > 1) {
      const bounds = new mapsApi.LatLngBounds();
      points.forEach((point) => bounds.extend(point));
      map.fitBounds(bounds);
    } else if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(15);
    }
    if (selectedListingId !== null && selectedListingId !== undefined) {
      const selectedMarker = listingMarkers.get(String(selectedListingId));
      if (selectedMarker) {
        const selectedListing = markers.find((listing) => String(listing.id) === String(selectedListingId));
        if (selectedListing) {
          infoOverlayRef.current?.setMap(null);
          infoOverlayRef.current = new PropertyInfoOverlay(
            validCoordinatePair(selectedListing.latitude, selectedListing.longitude),
            createPropertyCard(selectedListing, validCoordinatePair(selectedListing.latitude, selectedListing.longitude)),
          );
        }
      }
    }
    return () => {
      cancelDismissal();
      markerObjectsRef.current.forEach((marker) => marker.setMap(null));
      markerObjectsRef.current = [];
      infoOverlayRef.current?.setMap(null);
      infoOverlayRef.current = null;
    };
  }, [mapsApi, markers, selectedLocation, selectedListingId]);

  return (
    <div className={`property-map ${className}`.trim()}>
      {error ? <p className="property-map-error" role="alert">{error}</p> : !mapsApi && <p className="property-map-status" role="status">Loading Google Maps…</p>}
      <div className="property-map-canvas" ref={mapElementRef} aria-label="Property locations map" />
    </div>
  );
}

export function PropertyLocationPicker({ latitude = "", longitude = "" }) {
  const [coordinates, setCoordinates] = useState({
    latitude: latitude === null ? "" : String(latitude),
    longitude: longitude === null ? "" : String(longitude),
  });
  const selectedLocation = validCoordinatePair(coordinates.latitude, coordinates.longitude);

  function updateCoordinate(axis, value) {
    setCoordinates((current) => ({
      ...current,
      [axis === "lat" ? "latitude" : "longitude"]: value,
    }));
  }

  function selectLocation(point) {
    setCoordinates({ latitude: String(point.lat), longitude: String(point.lng) });
  }

  return (
    <section className="property-location-picker">
      <div>
        <strong>Pin the exact property location</strong>
        <p>Click the map to place the pin, then drag it to fine-tune the location. You can also enter coordinates directly.</p>
      </div>
      <PropertyMap
        className="property-location-picker-map"
        selectedLocation={selectedLocation}
        onLocationSelect={selectLocation}
      />
      <div className="property-coordinate-fields">
        <label>Latitude<input name="latitude" type="number" step="any" min="-90" max="90" value={coordinates.latitude} onChange={(event) => updateCoordinate("lat", event.target.value)} /></label>
        <label>Longitude<input name="longitude" type="number" step="any" min="-180" max="180" value={coordinates.longitude} onChange={(event) => updateCoordinate("lng", event.target.value)} /></label>
      </div>
    </section>
  );
}

export default PropertyMap;
