import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import BrandLogo from "./components/BrandLogo.jsx";
import LineChart from "./components/LineChart.jsx";
import PropertyMap, { PropertyLocationPicker } from "./components/PropertyMap.jsx";
import RentalMap from "./components/RentalMap.jsx";
import { demoListings } from "./data/demoListings.js";
import { API_BASE, apiRequest, apiUpload, propertyPhotoSource, request } from "./lib/api.js";
import "../styles.css";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("The JPG receipt could not be read. Please choose the image again."));
    reader.readAsDataURL(file);
  });
}

function PropertyPhotoField({ id, currentPhoto, className = "", required = false }) {
  const [fileError, setFileError] = useState("");

  function choosePhoto(event) {
    const file = event.currentTarget.files?.[0];
    setFileError("");
    if (!file) return;
    if (file.type !== "image/jpeg" || file.size > 5 * 1024 * 1024) {
      event.currentTarget.value = "";
      setFileError("Choose a JPG/JPEG image no larger than 5 MB.");
    }
  }

  return (
    <div className={`property-photo-field ${className}`.trim()}>
      <label htmlFor={id}>Property photo {required ? "(required)" : "(optional)"}</label>
      <input id={id} name="property_photo" type="file" accept="image/jpeg,.jpg,.jpeg" required={required} onChange={choosePhoto} aria-describedby={`${id}-help ${id}-error`} />
      <small id={`${id}-help`}>{currentPhoto ? "A photo is already saved. Choose a file only if you want to replace it." : "Choose a JPG/JPEG from your device, up to 5 MB."}</small>
      {fileError ? <small id={`${id}-error`} className="property-photo-error" role="alert">{fileError}</small> : <span id={`${id}-error`} className="sr-only" aria-live="polite" />}
    </div>
  );
}

function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function TextField({ id, label, ...props }) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input id={id} {...props} />
    </>
  );
}

function SubmitButton({ children, pending, pendingLabel = "Please wait…" }) {
  return (
    <button className="button button-primary" type="submit" disabled={pending}>
      {pending ? pendingLabel : children} {!pending && <span aria-hidden="true">→</span>}
    </button>
  );
}

function ScreenLinks({ children }) {
  return <p className="switch-copy">{children}</p>;
}

function LoginScreen({ onLogin, pending }) {
  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const fields = new FormData(form);
    await onLogin({ email: fields.get("email"), password: fields.get("password") });
  }

  return (
    <section>
      <h1>Welcome back</h1>
      <p className="intro">Sign in to continue to your RentEase workspace.</p>
      <form id="login-form" onSubmit={handleSubmit}>
        <TextField id="login-email" label="Email address" name="email" type="text" inputMode="email" autoComplete="email" placeholder="you@example.com" required />
        <TextField id="login-password" label="Password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required />
        <div className="form-options">
          <a href="#forgot">Forgot password?</a>
        </div>
        <SubmitButton pending={pending}>Sign in</SubmitButton>
      </form>
      <ScreenLinks>No account? <a href="#register">Create one</a></ScreenLinks>
    </section>
  );
}

function RegisterScreen({ onRegister, onError, pending }) {
  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const fields = new FormData(form);
    const password = fields.get("password");
    const passwordConfirmation = fields.get("password_confirmation");
    if (password !== passwordConfirmation) {
      onError("The passwords do not match.");
      return;
    }
    await onRegister({
      full_name: fields.get("full_name"),
      email: fields.get("email"),
      phone: fields.get("phone"),
      account_type: fields.get("account_type"),
      password,
      password_confirmation: passwordConfirmation,
    });
  }

  return (
    <section>
      <h1>Create your account</h1>
      <p className="intro">Register as a tenant or property owner.</p>
      <form id="register-form" onSubmit={handleSubmit}>
        <TextField id="register-name" label="Full name" name="full_name" type="text" autoComplete="name" maxLength={100} placeholder="Your full name" required />
        <TextField id="register-email" label="Email address" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
        <TextField id="register-phone" label="Mobile number" name="phone" type="tel" autoComplete="tel" maxLength={30} placeholder="+1 555 010 1234" required />
        <label htmlFor="account-type">I am joining as a</label>
        <select id="account-type" name="account_type" required defaultValue="tenant">
          <option value="tenant">Tenant</option>
          <option value="owner">Property owner</option>
        </select>
        <TextField id="register-password" label="Password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} placeholder="At least 8 characters" required />
        <TextField id="register-confirm" label="Confirm password" name="password_confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={72} placeholder="Enter your password again" required />
        <SubmitButton pending={pending}>Create account</SubmitButton>
      </form>
      <ScreenLinks>
        Already have an account? <a href="#login">Sign in</a><br />
        <a href="#verify">Verify an account</a>
      </ScreenLinks>
    </section>
  );
}

function EmailFlowScreen({ screen, onSubmit, pending }) {
  const isForgot = screen === "forgot";
  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [message, setMessage] = useState("");
  const title = isForgot ? "Reset your password" : "Verify your account";
  const description = completed
    ? (isForgot ? "Your password was updated." : "Your email address is verified.")
    : codeSent
      ? `Enter the 6-digit code sent to ${email}. It expires in 10 minutes.`
      : isForgot
        ? "We'll send a 6-digit password reset code to the email address registered to your account."
        : "Enter your email and we'll send a 6-digit verification code.";

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const fields = new FormData(form);
    if (!codeSent) {
      const submittedEmail = String(fields.get("email") || "").trim();
      const result = await onSubmit(isForgot ? "forgot-password" : "send-code", isForgot
        ? { email: submittedEmail }
        : { email: submittedEmail, purpose: "verification" });
      if (result) {
        setEmail(submittedEmail);
        setCodeSent(true);
        setMessage(result.message);
        if (result.verified) setCompleted(true);
      }
      return;
    }

    const payload = {
      email,
      code: String(fields.get("code") || "").trim(),
    };
    if (isForgot) {
      payload.password = fields.get("password");
      payload.password_confirmation = fields.get("password_confirmation");
    }
    const result = await onSubmit(isForgot ? "reset-password" : "verify", payload);
    if (result) {
      setMessage(result.message);
      setCompleted(true);
    }
  }

  async function resendCode() {
    const result = await onSubmit(isForgot ? "forgot-password" : "send-code", isForgot
      ? { email }
      : { email, purpose: "verification" });
    if (result) {
      setMessage(result.message);
      if (result.verified) setCompleted(true);
    }
  }

  return (
    <section>
      <h1>{title}</h1>
      <p className="intro">{description}</p>
      {message && <p className="payment-return-notice" role="status">{message}</p>}
      {!completed && <form id={isForgot ? "forgot-form" : "verify-form"} onSubmit={handleSubmit}>
        {!codeSent ? (
          <TextField id="forgot-email" label="Email address" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
        ) : (
          <>
            <TextField id="verification-code" label="6-digit code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" placeholder="000000" required />
            {isForgot && <>
              <TextField id="reset-password" label="New password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} placeholder="At least 8 characters" required />
              <TextField id="reset-password-confirmation" label="Confirm new password" name="password_confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={72} placeholder="Enter your new password again" required />
            </>}
          </>
        )}
        <SubmitButton pending={pending}>{!codeSent ? "Send code" : isForgot ? "Reset password" : "Verify email"}</SubmitButton>
        {codeSent && <button className="button button-secondary" type="button" onClick={resendCode} disabled={pending}>Send a new code</button>}
      </form>}
      <ScreenLinks>
        {completed && isForgot ? <>Password updated. <a href="#login">Sign in</a></> : <a href="#login">Back to sign in</a>}
      </ScreenLinks>
    </section>
  );
}

const workspaceRoutes = {
  tenant: [
    { path: "dashboard", label: "Overview", icon: "dashboard" },
    { path: "browse", label: "Browse rentals", icon: "home" },
    { path: "requests", label: "My requests & payments", icon: "requests" },
    { path: "payments", label: "Rent & payment history", icon: "wallet" },
    { path: "updates", label: "Updates & support", icon: "support" },
    { path: "profile", label: "My profile", icon: "profile" },
  ],
  owner: [
    { path: "dashboard", label: "Overview", icon: "dashboard" },
    { path: "listings", label: "My properties", icon: "home" },
    { path: "map", label: "Property locations", icon: "map" },
    { path: "requests", label: "Rental requests", icon: "requests" },
    { path: "renters", label: "Monitor renters", icon: "reservations" },
    { path: "sales", label: "My sales", icon: "analytics" },
    { path: "payments", label: "Payments & QR codes", icon: "wallet" },
    { path: "updates", label: "Updates & support", icon: "support" },
    { path: "profile", label: "My profile", icon: "profile" },
  ],
};

function NavIcon({ name }) {
  const paths = {
    dashboard: "M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z",
    home: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z",
    requests: "M8 3h8M8 7h8M8 11h8M8 15h5M5 3h.01M5 7h.01M5 11h.01M5 15h.01M4 21h16a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-2",
    wallet: "M3 6.5A2.5 2.5 0 0 1 5.5 4H20v16H5a2 2 0 0 1-2-2zM3 7h17M16 12h4M16.5 12a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1",
    support: "M4 5h16v12H9l-5 4zM8 9h8M8 13h5",
    profile: "M20 21a8 8 0 0 0-16 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
    listings: "m3 10 9-7 9 7M5 9v11h14V9M9 20v-7h6v7",
    reservations: "M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1zM8 12h3M8 16h3",
    reviews: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z",
    announcements: "M4 11V7l15-4v18L4 17v-4M4 13H2v2a3 3 0 0 0 3 3h1",
    analytics: "M4 19V9M10 19V5M16 19v-7M22 19H2",
    map: "M3 6 9 3l6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15",
    settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.6 2.8-.2-.1a1.7 1.7 0 0 0-1.8.2l-.2.1h-3.2l-.1-.2a1.7 1.7 0 0 0-1.6-.9l-.2.1-2.8-1.6.1-.2a1.7 1.7 0 0 0-.2-1.8l-.1-.2v-3.2l.2-.1a1.7 1.7 0 0 0 .9-1.6l-.1-.2 1.6-2.8.2.1a1.7 1.7 0 0 0 1.8-.2l.2-.1h3.2l.1.2a1.7 1.7 0 0 0 1.6.9l.2-.1 2.8 1.6-.1.2a1.7 1.7 0 0 0 .2 1.8l.1.2v3.2z",
  };
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.dashboard} /></svg>;
}

function AccountScreen({ user, onLogout, onUserUpdate, pending, route }) {
  if (user.role === "admin") {
    return <AdminWorkspace user={user} onLogout={onLogout} pending={pending} route={route} />;
  }

  const accountType = user.account_type === "owner" ? "owner" : "tenant";
  const routePath = route.split("/")[1] || "dashboard";
  const routes = workspaceRoutes[accountType];
  const routeInfo = routes.find((item) => item.path === routePath) || routes[0];
  const initials = user.full_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <div className={`workspace-shell workspace-${accountType}`}>
      <aside className="workspace-sidebar">
        <div className="workspace-sidebar-heading">
          <div className="workspace-brand-mark" aria-hidden="true">RE</div>
          <div><span>RENTEASE</span><strong>{accountType === "owner" ? "Owner workspace" : "Tenant workspace"}</strong></div>
        </div>
        <nav aria-label={`${accountType} workspace`}>
          {routes.map((item) => (
            <a key={item.path} className={routeInfo.path === item.path ? "active" : ""} href={`#${accountType}/${item.path}`} aria-current={routeInfo.path === item.path ? "page" : undefined}>
              <NavIcon name={item.icon} />{item.label}
            </a>
          ))}
        </nav>
        <div className="workspace-sidebar-profile">
          <span className="account-avatar" aria-hidden="true">{initials}</span>
          <div><strong>{user.full_name}</strong><small>{user.email}</small></div>
          <button type="button" onClick={onLogout} disabled={pending}>{pending ? "Signing out…" : "Sign out"}</button>
        </div>
      </aside>
      <section className="workspace-content">
        <header className="workspace-topbar">
          <div><span>{accountType === "owner" ? "OWNER PORTAL" : "TENANT PORTAL"}</span><strong>{routeInfo.label}</strong></div>
          <span className="workspace-welcome">Welcome, {user.full_name.trim().split(/\s+/)[0]}</span>
        </header>
        <section className="workspace-page">
          {routeInfo.path === "profile" ? (
            <section className="profile-panel workspace-profile-panel">
              <div className="account-heading">
                <div><p className="eyebrow">YOUR RENTEASE ACCOUNT</p><h2>Profile & account</h2></div>
                <span className="account-avatar" aria-hidden="true">{initials}</span>
              </div>
              <dl className="profile-list">
                <div><dt>Full name</dt><dd>{user.full_name}</dd></div>
                <div><dt>Email address</dt><dd>{user.email}</dd></div>
                <div><dt>Email verification</dt><dd>{user.email_verified_at ? "Verified" : "Not verified"}</dd></div>
                <div><dt>Mobile number</dt><dd>{user.phone || "Not provided"}</dd></div>
                <div><dt>Account type</dt><dd>{accountType === "owner" ? "Property owner" : "Tenant"}</dd></div>
                {accountType === "owner" && <div><dt>Verification</dt><dd>{user.owner_status === "verified" ? "Verified" : user.owner_status === "rejected" ? "Not approved" : "Under review"}</dd></div>}
              </dl>
              {!user.email_verified_at && <p><a href="#verify">Verify your email address</a></p>}
              <button className="button button-secondary" type="button" onClick={onLogout} disabled={pending}>{pending ? "Please wait…" : "Sign out"}</button>
            </section>
          ) : accountType === "owner" ? (
            routeInfo.path === "updates"
              ? <CommunityWorkspace user={user} accountType={accountType} />
              : <OwnerWorkspace user={user} route={routeInfo.path} onUserUpdate={onUserUpdate} />
          ) : (
            routeInfo.path === "updates"
              ? <CommunityWorkspace user={user} accountType={accountType} />
              : <TenantDashboard user={user} route={routeInfo.path} />
          )}
        </section>
      </section>
    </div>
  );
}

const propertyLabels = { bedspacer: "Bedspacer", room: "Room", apartment: "Apartment" };

function TenantDashboard({ user, route }) {
  const [listings, setListings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [payments, setPayments] = useState([]);
  const [rentSchedule, setRentSchedule] = useState({ schedule: [], payments: [], summary: { due_centavos: 0, outstanding_centavos: 0, paid_centavos: 0 } });
  const [error, setError] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkoutRequestId, setCheckoutRequestId] = useState(null);
  const [browseType, setBrowseType] = useState("");

  const loadDashboard = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [listingResult, requestResult, paymentResult, rentResult] = await Promise.all([
        apiRequest("listings", undefined, "GET"),
        apiRequest("tenant/requests", undefined, "GET"),
        apiRequest("tenant/payments", undefined, "GET"),
        apiRequest("tenant/installments", undefined, "GET"),
      ]);
      setListings(listingResult.listings);
      setRequests(requestResult.requests);
      setPayments(paymentResult.payments);
      setRentSchedule(rentResult);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const returnStatus = parameters.get("payment");
    if (!returnStatus) return undefined;

    window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
    if (returnStatus === "cancelled") {
      setPaymentNotice("Checkout was cancelled. Your request is still available to pay.");
      return undefined;
    }
    if (returnStatus !== "success") return undefined;

    setPaymentNotice("Returned from Xendit. Checking for the payment confirmation…");
    let attempts = 0;
    let timer;
    let stopped = false;
    async function checkPayment() {
      try {
        const [result, scheduleResult] = await Promise.all([
          apiRequest("tenant/payments", undefined, "GET"),
          apiRequest("tenant/installments", undefined, "GET"),
        ]);
        if (stopped) return;
        setPayments(result.payments);
        setRentSchedule(scheduleResult);
        const requestId = parameters.get("request_id");
        const installmentId = parameters.get("installment_id");
        const paymentConfirmed = installmentId
          ? scheduleResult.schedule.some((installment) => String(installment.id) === installmentId && installment.status === "paid")
          : scheduleResult.payments.some((payment) => String(payment.rental_request_id) === String(requestId))
            || result.payments.some((payment) => String(payment.rental_request_id) === String(requestId) && payment.status === "paid");
        if (paymentConfirmed) {
          setPaymentNotice("Payment confirmed. Your rental is now active.");
          await loadDashboard({ silent: true });
          return;
        }
      } catch (paymentError) {
        if (!stopped) setError(paymentError.message);
      }
      attempts += 1;
      if (!stopped && attempts < 10) {
        timer = window.setTimeout(checkPayment, 3000);
      } else if (!stopped) {
        setPaymentNotice("Payment confirmation is still pending. This page will not mark the request paid until Xendit confirms it; refresh shortly to check again.");
      }
    }
    checkPayment();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [loadDashboard]);

  const paymentsByRequest = new Map(payments.map((payment) => [String(payment.rental_request_id), payment]));
  const pendingRequests = requests.filter((request) => request.status === "pending").length;
  const approvedRequests = requests.filter((request) =>
    request.status === "approved" && paymentsByRequest.get(String(request.id))?.status === "paid"
  ).length;
  const activeRequestRentalIds = new Set(requests
    .filter((request) => ["pending", "awaiting_payment", "approved"].includes(request.status))
    .map((request) => String(request.rental_id)));
  const visibleListings = route === "browse" && browseType
    ? listings.filter((listing) => listing.property_type === browseType)
    : listings;
  const routeTitles = {
    dashboard: ["Your rental dashboard", "A quick look at available spaces, active requests, and payments."],
    browse: ["Find your next place", "Explore available bedspacers, rooms, and apartments."],
    requests: ["My rental requests", "Track owner responses and leave a review after your rental is approved."],
    payments: ["Rent & payment history", "See what is due, check upcoming rent dates, and review completed payments."],
  };
  const [pageTitle, pageDescription] = routeTitles[route] || routeTitles.dashboard;

  async function startCheckout(requestId, paymentMethod) {
    setCheckoutRequestId(requestId);
    setError("");
    try {
      const result = await apiRequest(`tenant/requests/${requestId}/checkout`, { payment_method: paymentMethod });
      window.location.assign(result.checkout_url);
    } catch (checkoutError) {
      setError(checkoutError.message);
      setCheckoutRequestId(null);
    }
  }

  async function startInstallmentCheckout(installmentId, paymentMethod) {
    setCheckoutRequestId(`installment-${installmentId}`);
    setError("");
    try {
      const result = await apiRequest(`tenant/installments/${installmentId}/checkout`, { payment_method: paymentMethod });
      window.location.assign(result.checkout_url);
    } catch (checkoutError) {
      setError(checkoutError.message);
      setCheckoutRequestId(null);
    }
  }

  async function reportPhysicalPayment(recordType, recordId, paymentMethod, receiptFile) {
    setCheckoutRequestId(`physical-${recordType}-${recordId}`);
    setError("");
    try {
      if (!receiptFile || receiptFile.type !== "image/jpeg" || receiptFile.size > 2 * 1024 * 1024) {
        throw new Error("Choose a JPG/JPEG receipt screenshot under 2 MB.");
      }
      const receiptImageData = await readFileAsDataUrl(receiptFile);
      const path = paymentMethod === "cash"
        ? recordType === "initial"
          ? `tenant/requests/${recordId}/cash-payment`
          : `tenant/installments/${recordId}/cash-payment`
        : recordType === "initial"
          ? `tenant/requests/${recordId}/physical-payment`
          : `tenant/installments/${recordId}/physical-payment`;
      const payload = paymentMethod === "cash"
        ? { receipt_image_data: receiptImageData }
        : { payment_method: paymentMethod, receipt_image_data: receiptImageData };
      const result = await apiRequest(path, payload);
      setPaymentNotice(result.message);
      await loadDashboard({ silent: true });
    } catch (paymentError) {
      setError(paymentError.message);
    } finally {
      setCheckoutRequestId(null);
    }
  }

  async function submitReview(event, requestId) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setError("");
    try {
      const result = await apiRequest("tenant/reviews", {
        rental_request_id: requestId,
        rating: Number(fields.get("rating")),
        body: fields.get("body"),
      });
      setPaymentNotice(result.message);
      await loadDashboard({ silent: true });
    } catch (reviewError) {
      setError(reviewError.message);
    }
  }

  return (
    <>
      <div className="role-dashboard-heading">
        <div><p className="eyebrow">RENTEASE / TENANT WORKSPACE</p><h1>{pageTitle}</h1><p>{pageDescription}</p></div>
        {route === "dashboard" && <a className="dashboard-action" href="#tenant/browse">Browse rentals <span aria-hidden="true">→</span></a>}
        {route === "requests" && <a className="dashboard-action" href="#tenant/payments">View rent schedule <span aria-hidden="true">→</span></a>}
      </div>
      <RentNotificationFeed accountType="tenant" />
      {route === "dashboard" && <div className="dashboard-stat-grid">
        <article className="dashboard-stat"><span>Available rentals</span><strong>{listings.length}</strong><small>Approved spaces ready to browse</small></article>
        <article className="dashboard-stat"><span>Paid rentals</span><strong>{approvedRequests}</strong><small>Your first rent payment is confirmed</small></article>
        <article className="dashboard-stat"><span>Payments due</span><strong>{requests.filter((request) => request.status === "awaiting_payment").length}</strong><small>Owner-approved requests ready to pay</small></article>
        <article className="dashboard-stat"><span>Requests awaiting owner</span><strong>{pendingRequests}</strong><small>Track responses from property owners</small></article>
      </div>}
      {(route === "requests" || route === "payments") && paymentNotice && <p className="payment-return-notice" role="status">{paymentNotice}</p>}
      {route === "requests" && error && <p className="dashboard-empty payment-error" role="alert">{error}</p>}
      {(route === "dashboard" || route === "browse") && !loading && listings.length > 0 && <section className="dashboard-panel tenant-property-map-panel">
        <div className="dashboard-panel-heading">
          <div><p className="eyebrow">EXPLORE BY LOCATION</p><h2>{route === "browse" ? "Rental locations" : "Find a home on the map"}</h2></div>
          {route === "dashboard" && <a href="#tenant/browse">Browse all rentals →</a>}
        </div>
        <PropertyLocations listings={visibleListings} emptyMessage="No rental locations have been pinned yet." />
      </section>}
      {(route === "dashboard" || route === "browse") && <div className={`tenant-dashboard-grid ${route === "browse" ? "tenant-browse-route" : ""}`}>
        <section className="dashboard-panel">
          <div className="dashboard-panel-heading"><div><p className="eyebrow">{route === "browse" ? "AVAILABLE HOMES" : "DISCOVER A PLACE"}</p><h2>Available rentals</h2></div>{route === "dashboard" ? <a href="#tenant/browse">See all →</a> : (
            <div className="filter-pills" aria-label="Filter rentals by type">
              <button className={!browseType ? "active" : ""} onClick={() => setBrowseType("")}>All</button>
              {Object.entries(propertyLabels).map(([key, label]) => <button key={key} className={browseType === key ? "active" : ""} onClick={() => setBrowseType(key)}>{label}</button>)}
            </div>
          )}</div>
          {error ? <p className="dashboard-empty" role="alert">{error}</p> : loading ? <p className="dashboard-empty">Finding available rentals…</p> : listings.length ? (
            visibleListings.length ? <div className="rental-grid tenant-rental-grid">{(route === "dashboard" ? visibleListings.slice(0, 3) : visibleListings).map((listing) => <RentalCard key={listing.id} listing={listing} user={user} onRequestSent={() => loadDashboard({ silent: true })} hasRequest={activeRequestRentalIds.has(String(listing.id))} />)}</div> : <p className="dashboard-empty">No rentals match this property type yet. Try another filter.</p>
          ) : <p className="dashboard-empty">No published rentals are available yet. New spaces will show up here after approval.</p>}
        </section>
        {route === "dashboard" && <section className="dashboard-panel tenant-attention">
          <div className="dashboard-panel-heading"><div><p className="eyebrow">YOUR RENTAL JOURNEY</p><h2>What needs your attention</h2></div></div>
          <div className="workflow-note"><span aria-hidden="true">01</span><div><strong>Find your next home</strong><p>Explore approved bedspacers, rooms, and apartments.</p></div></div>
          <div className="workflow-note"><span aria-hidden="true">02</span><div><strong>Track your applications</strong><p>View owner responses and pay the first month plus deposit when a request is approved.</p><a href="#tenant/requests">View my requests →</a></div></div>
        </section>}
      </div>}
      {route === "requests" && <section className="dashboard-panel tenant-activity">
        <div className="dashboard-panel-heading"><div><p className="eyebrow">ACCOUNT ACTIVITY</p><h2>My rental requests</h2></div><span>{requests.length} total</span></div>
        {loading ? <p className="dashboard-empty">Loading your requests…</p> : requests.length ? (
          <div className="tenant-request-list">{requests.map((request) => (
            <article className="tenant-request-row" key={request.id}>
              <div className="tenant-request-summary"><strong>{request.rental_title}</strong><span>{request.location} · {propertyLabels[request.property_type] || request.property_type}</span><small>Move-in {formatDate(request.move_in)} · {request.occupants} occupant{Number(request.occupants) === 1 ? "" : "s"} · {request.term_months} months</small></div>
              <div className="tenant-request-status">
                <span className={`listing-state listing-${request.status}`}>{request.status === "awaiting_payment" ? "Payment due" : request.status === "approved" ? (paymentsByRequest.get(String(request.id))?.status === "paid" ? "Paid" : "Approved") : request.status}</span>
                {request.status === "awaiting_payment" && paymentsByRequest.get(String(request.id))?.status !== "paid" && (
                  <div className="tenant-payment-action">
                    <strong>₱{(Number(paymentsByRequest.get(String(request.id))?.amount_centavos || (Number(request.price) + Number(request.security_deposit || 0)) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    {request.initial_payment_status === "pending_owner_confirmation" ? (
                      <>
                        <small role="status">{request.initial_payment_receipt_available ? `Your ${String(request.initial_payment_method || "wallet").toUpperCase()} receipt was submitted. Waiting for the owner to confirm it.` : "A receipt screenshot is required before the owner can confirm this transfer."}</small>
                        {!request.initial_payment_receipt_available && <PhysicalPaymentAction
                          gcashQr={request.owner_gcash_qr_data}
                          mayaQr={request.owner_maya_qr_data}
                          ownerPhone={request.owner_phone}
                          pending={checkoutRequestId === `physical-initial-${request.id}`}
                          onSubmit={(method, receipt) => reportPhysicalPayment("initial", request.id, method, receipt)}
                        />}
                      </>
                    ) : request.initial_payment_status === "pending" || request.initial_payment_status === "creating" ? (
                      <button type="button" disabled={checkoutRequestId === request.id} onClick={() => startCheckout(request.id, request.initial_payment_method || "gcash")}>
                        {checkoutRequestId === request.id ? "Opening checkout…" : `Continue ${String(request.initial_payment_method || "GCash").toUpperCase()} checkout`}
                      </button>
                    ) : (
                      <div className="online-payment-options">
                        <span>Pay online with</span>
                        <button type="button" disabled={checkoutRequestId === request.id} onClick={() => startCheckout(request.id, "gcash")}>GCash</button>
                        <button type="button" disabled={checkoutRequestId === request.id} onClick={() => startCheckout(request.id, "maya")}>Maya</button>
                      </div>
                    )}
                    <small>First month rent + deposit · Online checkout is confirmed by Xendit.</small>
                    {!["pending_owner_confirmation", "pending", "creating"].includes(request.initial_payment_status) && <PhysicalPaymentAction
                      gcashQr={request.owner_gcash_qr_data}
                      mayaQr={request.owner_maya_qr_data}
                      ownerPhone={request.owner_phone}
                      pending={checkoutRequestId === `physical-initial-${request.id}`}
                      onSubmit={(method, receipt) => reportPhysicalPayment("initial", request.id, method, receipt)}
                    />}
                    {!["pending_owner_confirmation", "pending", "creating"].includes(request.initial_payment_status) && <CashPaymentReceiptAction
                      pending={checkoutRequestId === `physical-initial-${request.id}`}
                      onSubmit={(receipt) => reportPhysicalPayment("initial", request.id, "cash", receipt)}
                    />}
                  </div>
                )}
                {paymentsByRequest.get(String(request.id))?.status === "paid" && <small>Payment confirmed {formatDate(paymentsByRequest.get(String(request.id)).paid_at)}</small>}
                {paymentsByRequest.get(String(request.id))?.owner_confirmed && <p className="tenant-owner-confirmation" role="status"><strong>Payment confirmed by the owner.</strong> Your payment has been received and recorded.</p>}
                {request.status === "approved" && paymentsByRequest.get(String(request.id))?.status !== "paid" && <small>Approved before online payments were enabled. Contact the owner to confirm your existing payment.</small>}
                {request.status === "approved" && !request.review && <form className="tenant-review-form" onSubmit={(event) => submitReview(event, request.id)}>
                  <label>Rate your stay<select name="rating" defaultValue="5"><option value="5">5 — Excellent</option><option value="4">4 — Very good</option><option value="3">3 — Good</option><option value="2">2 — Fair</option><option value="1">1 — Poor</option></select></label>
                  <label>Your review<textarea name="body" minLength={10} maxLength={3000} required placeholder="Share your experience with this rental…" /></label>
                  <button type="submit">Submit review</button>
                </form>}
                {request.review && <small>Review submitted · {request.review.status}</small>}
              </div>
            </article>
          ))}</div>
        ) : <p className="dashboard-empty">No rental requests yet. Choose a published space and select “Request to rent”.</p>}
      </section>}
      {route === "payments" && <TenantRentPayments
        rentSchedule={rentSchedule}
        loading={loading}
        error={error}
        checkoutRequestId={checkoutRequestId}
        onCheckout={startInstallmentCheckout}
        onPhysicalPayment={(id, method, receipt) => reportPhysicalPayment("installment", id, method, receipt)}
      />}
    </>
  );
}

function PhysicalPaymentAction({ gcashQr, mayaQr, ownerPhone, pending, advancePayment = false, onSubmit }) {
  const [selectedWallet, setSelectedWallet] = useState(gcashQr ? "gcash" : mayaQr ? "maya" : "gcash");
  const [receiptFile, setReceiptFile] = useState(null);
  const [advanceTermsAccepted, setAdvanceTermsAccepted] = useState(false);
  const wallet = selectedWallet;
  const qr = wallet === "gcash" ? gcashQr : mayaQr;
  const available = Boolean(gcashQr || mayaQr || ownerPhone);
  const canSubmit = !pending && Boolean(receiptFile) && (!advancePayment || advanceTermsAccepted);

  return (
    <details className="physical-payment-action">
      <summary>{advancePayment ? "Make an advance payment directly to the owner" : "Pay the owner directly with GCash/Maya"}</summary>
      {!available ? <p className="dashboard-empty">The owner has not shared a wallet QR or mobile payment number yet. Ask the owner to set it up.</p> : (
        <div className="physical-payment-content">
          <div className="wallet-choice">
            {(gcashQr || ownerPhone) && <button type="button" className={wallet === "gcash" ? "active" : ""} onClick={() => setSelectedWallet("gcash")}>GCash</button>}
            {(mayaQr || ownerPhone) && <button type="button" className={wallet === "maya" ? "active" : ""} onClick={() => setSelectedWallet("maya")}>Maya</button>}
          </div>
          {qr && <img className="wallet-qr-image" src={qr} alt={`Owner's official ${wallet === "gcash" ? "GCash" : "Maya"} QR code`} />}
          {ownerPhone && <p className="owner-payment-number"><strong>{wallet === "gcash" ? "GCash" : "Maya"} number:</strong> {ownerPhone}</p>}
          <label>Payment receipt screenshot (required, JPG/JPEG only)<input type="file" accept="image/jpeg,.jpg,.jpeg" required onChange={(event) => setReceiptFile(event.target.files?.[0] || null)} /><small>Upload a clear screenshot from your GCash or Maya payment receipt, up to 2 MB.</small></label>
          {advancePayment && (
            <label className="advance-payment-confirmation">
              <input type="checkbox" checked={advanceTermsAccepted} onChange={(event) => setAdvanceTermsAccepted(event.target.checked)} />
              <span>I understand this advance payment is final and non-refundable once received. If I transfer to another unit, the amount will not be reversed.</span>
            </label>
          )}
          <p>Use the owner's QR or mobile number in your wallet app. After paying, upload the receipt screenshot; the owner must review and confirm it before the rental is marked rented or the installment is marked paid.</p>
          <button type="button" disabled={!canSubmit} onClick={() => onSubmit(wallet, receiptFile)}>{pending ? "Sending report…" : `${advancePayment ? "I made an advance payment" : "I paid"} with ${wallet === "gcash" ? "GCash" : "Maya"}`}</button>
        </div>
      )}
    </details>
  );
}

function CashPaymentReceiptAction({ pending, advancePayment = false, onSubmit }) {
  const [receiptFile, setReceiptFile] = useState(null);
  const [advanceTermsAccepted, setAdvanceTermsAccepted] = useState(false);
  return (
    <details className="physical-payment-action cash-payment-action">
      <summary>{advancePayment ? "Report an advance cash payment" : "Report cash paid to the owner"}</summary>
      <div className="physical-payment-content">
        <label>Cash receipt screenshot (required, JPG/JPEG only)<input type="file" accept="image/jpeg,.jpg,.jpeg" required onChange={(event) => setReceiptFile(event.target.files?.[0] || null)} /><small>Upload a clear photo or screenshot of the receipt acknowledging the cash payment, up to 2 MB.</small></label>
        {advancePayment && <label className="advance-payment-confirmation"><input type="checkbox" checked={advanceTermsAccepted} onChange={(event) => setAdvanceTermsAccepted(event.target.checked)} /><span>I understand this advance payment is final and non-refundable once received. If I transfer to another unit, the amount will not be reversed.</span></label>}
        <p>The owner must review this receipt and confirm they received the cash. It will not be marked paid before the owner confirms it.</p>
        <button type="button" disabled={pending || !receiptFile || (advancePayment && !advanceTermsAccepted)} onClick={() => onSubmit(receiptFile)}>{pending ? "Submitting receipt…" : "Submit cash receipt for owner confirmation"}</button>
      </div>
    </details>
  );
}

function RentNotificationFeed({ accountType }) {
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    try {
      const result = await apiRequest("account/rent-notifications", undefined, "GET");
      setNotifications(result.notifications || []);
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  async function markAsRead(notification) {
    if (notification.read_at) return;
    try {
      await apiRequest(`account/rent-notifications/${notification.id}/read`, {});
      setNotifications((current) => current.map((item) =>
        item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item
      ));
    } catch (updateError) {
      setError(updateError.message);
    }
  }

  if (!error && !notifications.length) return null;
  return (
    <section className="dashboard-panel rent-notifications">
      <div className="dashboard-panel-heading"><div><p className="eyebrow">PAYMENT REMINDERS</p><h2>Rent due-date updates</h2></div><button type="button" onClick={loadNotifications}>Refresh</button></div>
      {error && <p className="dashboard-empty" role="alert">{error}</p>}
      {notifications.map((notification) => (
        <article className={`rent-notification ${notification.read_at ? "read" : ""}`} key={notification.id}>
          <div><strong>{notification.title}</strong><p>{notification.body}</p><small>{formatDate(notification.created_at)}</small></div>
          <div className="rent-notification-actions">
            {!notification.read_at && <button type="button" onClick={() => markAsRead(notification)}>Mark read</button>}
            <a href={`#${accountType}/payments`}>View payments</a>
          </div>
        </article>
      ))}
    </section>
  );
}

function TenantRentPayments({ rentSchedule, loading, error, checkoutRequestId, onCheckout, onPhysicalPayment }) {
  const unpaid = rentSchedule.schedule.filter((installment) => installment.status !== "paid" && installment.due_date <= localDateInputValue());
  return (
    <div className="tenant-payment-page">
      <div className="dashboard-stat-grid">
        <article className="dashboard-stat"><span>Total currently due</span><strong>₱{(Number(rentSchedule.summary.due_centavos) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong><small>{unpaid.length} unpaid installment{unpaid.length === 1 ? "" : "s"}</small></article>
        <article className="dashboard-stat"><span>Total outstanding</span><strong>₱{(Number(rentSchedule.summary.outstanding_centavos) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong><small>Includes upcoming rent that can be paid early</small></article>
        <article className="dashboard-stat"><span>Total payments recorded</span><strong>₱{(Number(rentSchedule.summary.paid_centavos) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong><small>Rent and move-in payments confirmed</small></article>
        <article className="dashboard-stat"><span>Next rent date</span><strong>{formatDate(rentSchedule.schedule.find((item) => item.status !== "paid")?.due_date)}</strong><small>Based on your rental agreement</small></article>
        <article className="dashboard-stat"><span>Upcoming installments</span><strong>{rentSchedule.schedule.filter((item) => item.status === "upcoming").length}</strong><small>Within your agreed rental term</small></article>
      </div>
      {error && <p className="dashboard-empty" role="alert">{error}</p>}
      <section className="dashboard-panel">
        <div className="dashboard-panel-heading"><div><p className="eyebrow">RENT PLAN</p><h2>Due dates & installments</h2></div></div>
        {loading ? <p className="dashboard-empty">Loading your rent schedule…</p> : rentSchedule.schedule.length ? (
          <div className="tenant-payment-list">{rentSchedule.schedule.map((installment) => (
            <article className="tenant-payment-row" key={installment.id}>
              <div><strong>{installment.rental_title}</strong><span>Installment #{installment.installment_number} · Due {formatDate(installment.due_date)}</span>
                {Number(installment.installment_number) === 1 && <small>Initial rent and security deposit{installment.payment_method ? "" : " (move-in payment)"}</small>}
              </div>
              <strong>₱{(Number(installment.amount_centavos) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
              <span className={`listing-state listing-${installment.status}`}>{installment.status === "upcoming" ? "Upcoming" : installment.status === "overdue" ? "Overdue" : installment.status === "paid" ? "Paid" : installment.status === "pending_owner_confirmation" ? "Owner confirmation" : installment.status === "pending" ? "Checkout started" : installment.status === "creating" ? "Preparing checkout" : "Due"}</span>
              {installment.owner_confirmed && <p className="tenant-owner-confirmation" role="status"><strong>Owner confirmed your payment.</strong> This installment has been marked as received.</p>}
              {installment.status === "pending_owner_confirmation" && <>
                <small role="status">{installment.receipt_available ? "Your receipt was submitted. Waiting for owner confirmation." : "A receipt screenshot is required before the owner can confirm this transfer."}</small>
                {!installment.receipt_available && <PhysicalPaymentAction
                  gcashQr={installment.owner_gcash_qr_data}
                  mayaQr={installment.owner_maya_qr_data}
                  ownerPhone={installment.owner_phone}
                  pending={checkoutRequestId === `physical-installment-${installment.id}`}
                  onSubmit={(method, receipt) => onPhysicalPayment(installment.id, method, receipt)}
                />}
              </>}
              {["due", "overdue", "upcoming", "pending", "creating"].includes(installment.status) && <>
                <div className="online-payment-options">
                  {["pending", "creating"].includes(installment.status)
                    ? <button type="button" disabled={checkoutRequestId === `installment-${installment.id}`} onClick={() => onCheckout(installment.id, installment.payment_method || "gcash")}>{checkoutRequestId === `installment-${installment.id}` ? "Opening…" : `Continue ${String(installment.payment_method || "GCash").toUpperCase()}`}</button>
                    : <><button type="button" disabled={checkoutRequestId === `installment-${installment.id}`} onClick={() => onCheckout(installment.id, "gcash")}>{installment.status === "upcoming" ? "Advance pay · GCash" : "Pay online · GCash"}</button><button type="button" disabled={checkoutRequestId === `installment-${installment.id}`} onClick={() => onCheckout(installment.id, "maya")}>{installment.status === "upcoming" ? "Advance pay · Maya" : "Pay online · Maya"}</button></>}
                </div>
                {!["pending", "creating"].includes(installment.status) && <PhysicalPaymentAction
                  gcashQr={installment.owner_gcash_qr_data}
                  mayaQr={installment.owner_maya_qr_data}
                  ownerPhone={installment.owner_phone}
                  pending={checkoutRequestId === `physical-installment-${installment.id}`}
                  advancePayment={installment.status === "upcoming"}
                  onSubmit={(method, receipt) => onPhysicalPayment(installment.id, method, receipt)}
                />}
                {["due", "overdue", "upcoming"].includes(installment.status) && <CashPaymentReceiptAction
                    advancePayment={installment.status === "upcoming"}
                    pending={checkoutRequestId === `physical-installment-${installment.id}`}
                    onSubmit={(receipt) => onPhysicalPayment(installment.id, "cash", receipt)}
                  />}
              </>}
            </article>
          ))}</div>
        ) : <p className="dashboard-empty">A rent schedule appears after a rental is approved. Requests still awaiting owner approval are shown on My requests.</p>}
      </section>
      <section className="dashboard-panel">
        <div className="dashboard-panel-heading"><div><p className="eyebrow">PAYMENT HISTORY</p><h2>Past payments</h2></div><span>{rentSchedule.payments.length} recorded</span></div>
        {loading ? <p className="dashboard-empty">Loading payment history…</p> : rentSchedule.payments.length ? (
          <div className="tenant-payment-list">{rentSchedule.payments.map((payment) => (
            <article className="tenant-payment-row" key={payment.id}>
              <div><strong>{payment.rental_title}</strong><span>{payment.description} · {formatDate(payment.paid_at)}</span><small>{payment.payment_method || "Payment"}{payment.reference_number ? ` · ${payment.reference_number}` : ""}</small></div>
              <strong>₱{(Number(payment.amount_centavos) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
              <span className="listing-state listing-approved">Paid</span>
              {payment.owner_confirmed && <p className="tenant-owner-confirmation" role="status"><strong>Confirmed by your owner.</strong> This payment was acknowledged as received.</p>}
            </article>
          ))}</div>
        ) : <p className="dashboard-empty">No payments have been recorded yet. Confirmed checkout payments will appear here.</p>}
      </section>
    </div>
  );
}

function CommunityWorkspace({ user, accountType }) {
  const [announcements, setAnnouncements] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const [announcementResult, ticketResult] = await Promise.all([
      apiRequest(`${accountType}/announcements`, undefined, "GET"),
      apiRequest(`${accountType}/tickets`, undefined, "GET"),
    ]);
    setAnnouncements(announcementResult.announcements);
    setTickets(ticketResult.tickets);
  }, [accountType]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      apiRequest(`${accountType}/announcements`, undefined, "GET"),
      apiRequest(`${accountType}/tickets`, undefined, "GET"),
    ]).then(([announcementResult, ticketResult]) => {
      if (!active) return;
      setAnnouncements(announcementResult.announcements);
      setTickets(ticketResult.tickets);
    }).catch((loadError) => {
      if (active) setError(loadError.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [accountType]);

  async function submitTicket(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await apiRequest(`${accountType}/tickets`, {
        subject: fields.get("subject"),
        message: fields.get("message"),
      });
      setMessage(result.message);
      form.reset();
      await refresh();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="role-dashboard-heading">
        <div><p className="eyebrow">RENTEASE / {accountType.toUpperCase()} WORKSPACE</p><h1>Updates & support</h1><p>Read platform updates and get help with your account or rental.</p></div>
      </div>
      {message && <p className="payment-return-notice" role="status">{message}</p>}
      {error && <p className="dashboard-empty" role="alert">{error}</p>}
      <div className="community-workspace-grid">
        <section className="dashboard-panel">
          <div className="dashboard-panel-heading"><div><p className="eyebrow">FROM RENTEase</p><h2>Announcements</h2></div><span>{announcements.length} updates</span></div>
          {loading ? <p className="dashboard-empty">Loading announcements…</p> : announcements.length ? <div className="community-announcements">
            {announcements.map((announcement) => <article key={announcement.id}><span>{formatDate(announcement.publish_at)}</span><strong>{announcement.title}</strong><p>{announcement.body}</p></article>)}
          </div> : <p className="dashboard-empty">There are no new announcements right now.</p>}
        </section>
        <section className="dashboard-panel">
          <div className="dashboard-panel-heading"><div><p className="eyebrow">WE'RE HERE TO HELP</p><h2>Contact support</h2></div></div>
          <form className="community-ticket-form" onSubmit={submitTicket}>
            <label>Subject<input name="subject" minLength={4} maxLength={160} required placeholder="How can we help?" /></label>
            <label>Tell us what happened<textarea name="message" minLength={10} maxLength={5000} required rows={4} placeholder="Include details so our team can help." /></label>
            <button type="submit" disabled={pending}>{pending ? "Sending…" : "Submit support request"}</button>
          </form>
          <div className="community-ticket-list">
            <h3>My support requests</h3>
            {loading ? <p className="dashboard-empty">Loading your tickets…</p> : tickets.length ? tickets.map((ticket) => (
              <article key={ticket.id}>
                <div><strong>{ticket.subject}</strong><span className={`listing-state listing-${ticket.status}`}>{ticket.status.replace("_", " ")}</span></div>
                <p>{ticket.message}</p>
                {ticket.admin_reply && <blockquote><strong>RentEase support</strong>{ticket.admin_reply}</blockquote>}
                <small>{formatDate(ticket.created_at)} · {ticket.priority} priority</small>
              </article>
            )) : <p className="dashboard-empty">No support requests yet.</p>}
          </div>
        </section>
      </div>
    </>
  );
}

function RentalCard({ listing, admin = false, onFeature, onReview, pendingId, user, onRequestSent, hasRequest = false }) {
  const amenities = (listing.amenities || "").split(",").map((item) => item.trim()).filter(Boolean);
  const totalCapacity = Number(listing.total_capacity || 0);
  const availableSlots = Number(listing.available_slots ?? totalCapacity);
  const furnishingLabels = {
    unfurnished: "Unfurnished",
    semi_furnished: "Semi-furnished",
    fully_furnished: "Fully furnished",
  };

  return (
    <article className="rental-card">
      <div className={`rental-art rental-art-${listing.property_type}`}>
        {listing.photo_url && <img className="rental-photo" src={propertyPhotoSource(listing)} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />}
        <span className="rental-type-badge">{propertyLabels[listing.property_type] || listing.property_type}</span>
        {Boolean(Number(listing.is_featured)) && <span className="featured-badge">Featured</span>}
        {Boolean(Number(listing.occupied_slots)) && availableSlots > 0 && <span className="reservation-badge">{availableSlots} bed{availableSlots === 1 ? "" : "s"} left</span>}
      </div>
      <div className="rental-content">
        <div className="rental-title-row">
          <h3>{listing.title}</h3>
          <strong>₱{Number(listing.price).toLocaleString()}<small> / month</small></strong>
        </div>
        <p className="rental-location">{listing.location}</p>
        <p className="rental-description">{listing.description}</p>
        {!admin && (
          <>
            <div className="rental-facts">
              {Number(listing.rooms_count ?? listing.bedrooms) > 0 && <span>{listing.rooms_count ?? listing.bedrooms} room{Number(listing.rooms_count ?? listing.bedrooms) === 1 ? "" : "s"}</span>}
              {listing.property_type === "bedspacer" && Number(listing.bed_count) > 0 && <span>{listing.bed_count} bed{Number(listing.bed_count) === 1 ? "" : "s"}</span>}
              {totalCapacity > 0 && <span>{availableSlots} of {totalCapacity} bed spaces available</span>}
              {Number(listing.bathrooms) > 0 && <span>{listing.bathrooms} bath</span>}
              <span>Up to {listing.max_occupants ?? 1} people</span>
              {Number(listing.floor_area) > 0 && <span>{Number(listing.floor_area)} m²</span>}
            </div>
            <div className="rental-detail-tags">
              <span>{furnishingLabels[listing.furnishing] || "Unfurnished"}</span>
              {Boolean(Number(listing.utilities_included)) && <span>Utilities included</span>}
              {amenities.slice(0, 3).map((amenity) => <span key={amenity}>{amenity}</span>)}
            </div>
            <RentalMap listing={listing} />
            {listing.available_from && <p className="rental-availability">Available {new Date(`${listing.available_from}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>}
            {listing.contact_phone && <a className="rental-contact" href={`tel:${listing.contact_phone}`}>Contact owner <span>{listing.contact_phone}</span></a>}
            {!admin && <RentalRequestAction listing={listing} user={user} onRequestSent={onRequestSent} hasRequest={hasRequest} />}
          </>
        )}
        {admin && <p className="rental-owner">Owner: {listing.owner_name || "—"} · {listing.owner_email || ""}</p>}
        {admin && listing.status === "pending" && (
          <div className="review-actions">
            <button className="small-button" disabled={pendingId === listing.id} onClick={() => onReview(listing.id, "approve")}>Approve</button>
            <button className="small-button small-button-muted" disabled={pendingId === listing.id} onClick={() => onReview(listing.id, "reject")}>Reject</button>
          </div>
        )}
        {admin && listing.status === "published" && (
          <button className="small-button" disabled={pendingId === listing.id} onClick={() => onFeature(listing.id, !Boolean(Number(listing.is_featured)))}>
            {Boolean(Number(listing.is_featured)) ? "Remove featured" : "Mark featured"}
          </button>
        )}
        {!admin && <span className={`listing-state listing-${listing.status}`}>{listing.status}</span>}
      </div>
    </article>
  );
}

function PropertyLocations({ listings, emptyMessage }) {
  const [selectedListingId, setSelectedListingId] = useState(null);
  const mappedListings = listings.filter((listing) => {
    const latitude = Number(listing.latitude);
    const longitude = Number(listing.longitude);
    return listing.latitude !== null && listing.latitude !== "" && listing.longitude !== null && listing.longitude !== ""
      && Number.isFinite(latitude) && Number.isFinite(longitude)
      && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
  });
  const unmappedListings = listings.filter((listing) => !mappedListings.includes(listing));

  return (
    <>
      {mappedListings.length ? (
        <>
          <PropertyMap markers={mappedListings} selectedListingId={selectedListingId} />
          <p className="property-map-count">{mappedListings.length} of {listings.length} properties pinned on the map</p>
          <div className="mapped-property-list" aria-label="Pinned properties">
            {mappedListings.map((listing) => (
              <button
                type="button"
                className={`mapped-property-row${String(selectedListingId) === String(listing.id) ? " is-selected" : ""}`}
                key={listing.id}
                onClick={() => setSelectedListingId(String(listing.id))}
              >
                <strong>{listing.title || "Rental property"}</strong>
                <span>{[listing.owner_name, listing.location, listing.status].filter(Boolean).join(" · ")}</span>
              </button>
            ))}
          </div>
        </>
      ) : <p className="dashboard-empty">{emptyMessage}</p>}
      {unmappedListings.length > 0 && (
        <div className="unmapped-property-list">
          <strong>Properties without a map pin</strong>
          {unmappedListings.map((listing) => (
            <div className="unmapped-property-row" key={listing.id}>
              <span><strong>{listing.title}</strong><small>{listing.location} · {listing.status}</small></span>
              <span>Pin location from property details</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function RentalRequestAction({ listing, user, onRequestSent, hasRequest }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedTerm, setSelectedTerm] = useState(12);
  const agreementVersion = "rental-request-v1-2026-11";

  async function submit(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const result = await apiRequest(`listings/${listing.id}/requests`, {
        move_in: fields.get("move_in"),
        occupants: Number(fields.get("occupants")),
        term_months: Number(fields.get("term_months")),
        message: fields.get("message"),
        agreement_accepted: fields.get("agreement_accepted") === "on",
        agreement_version: agreementVersion,
      });
      setSuccess(result.message);
      setOpen(false);
      setError("");
      await onRequestSent?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(false);
    }
  }

  if (user && (user.role === "admin" || user.account_type !== "tenant")) return null;

  return (
    <>
      {user ? (
        hasRequest ? <span className="rental-request-success" role="status">Request already sent</span> : Number(listing.available_slots ?? listing.total_capacity ?? 1) < 1 ? <span className="rental-request-success" role="status">Fully reserved</span> : <button className="rental-request-button" onClick={() => { setError(""); setOpen(true); }}>Request to rent <span aria-hidden="true">→</span></button>
      ) : <a className="rental-request-button" href="#login">Sign in to request this rental <span aria-hidden="true">→</span></a>}
      {success && <p className="rental-request-success" role="status">{success}</p>}
      {error && !open && <p className="rental-request-error" role="alert">{error}</p>}
      {open && createPortal(
        <div className="request-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setOpen(false); }}>
          <section className="request-dialog" role="dialog" aria-modal="true" aria-labelledby={`request-title-${listing.id}`}>
            <button className="request-dialog-close" type="button" aria-label="Close request form" onClick={() => setOpen(false)}>×</button>
            <p className="eyebrow">RENTAL REQUEST</p>
            <h2 id={`request-title-${listing.id}`}>Request {listing.title}</h2>
            <p className="request-dialog-intro">Send your dates and a short introduction to the property owner. Your request is not confirmed until they approve it.</p>
            <div className="request-rental-summary"><strong>{listing.title}</strong><span>{listing.location} · ₱{Number(listing.price).toLocaleString()} / month</span><span>Security deposit: ₱{Number(listing.security_deposit || 0).toLocaleString()}</span></div>
            <form className="request-form" onSubmit={submit}>
              <div className="request-form-grid">
                <label>Move-in date<input name="move_in" type="date" min={listing.available_from && listing.available_from > localDateInputValue() ? listing.available_from : localDateInputValue()} required /></label>
                <label>Number of occupants<input name="occupants" type="number" min="1" max={Math.min(Number(listing.max_occupants) || 1, Number(listing.available_slots ?? listing.max_occupants) || 1)} defaultValue="1" required /></label>
                <label>Rental term<select name="term_months" value={selectedTerm} onChange={(event) => setSelectedTerm(Number(event.target.value))}>{[1, 3, 6, 12, 18, 24, 36].map((months) => <option key={months} value={months}>{months} {months === 1 ? "month" : "months"}</option>)}</select></label>
              </div>
              <label>Message to property owner<textarea name="message" maxLength={2000} rows={3} placeholder="Introduce yourself and share any important details…" /></label>
              <section className="rental-agreement" aria-labelledby={`agreement-title-${listing.id}`}>
                <p className="eyebrow">READ-ONLY AGREEMENT</p>
                <h3 id={`agreement-title-${listing.id}`}>Rental request &amp; data privacy agreement</h3>
                <div className="rental-agreement-document">
                  <p><strong>Property:</strong> {listing.title} — {listing.location}</p>
                  <p><strong>Listed rent:</strong> ₱{Number(listing.price).toLocaleString()} per month. <strong>Listed security deposit:</strong> ₱{Number(listing.security_deposit || 0).toLocaleString()}.</p>
                  <p><strong>Requested stay:</strong> {selectedTerm} {selectedTerm === 1 ? "month" : "months"} from the move-in date submitted with this request.</p>
                  <ol>
                    <li>This submission is a rental request only. It does not reserve the property or create a confirmed lease. The owner must approve the request, and the parties must complete the required payment and any final written lease before the tenancy begins.</li>
                    <li>The tenant confirms that the requested occupants and information submitted are accurate. Rent, deposit, payment schedule, house rules, and other final tenancy terms must be confirmed with the owner before the tenant agrees to a final lease.</li>
                    <li>Under the Philippines Data Privacy Act of 2012 (Republic Act No. 10173), RentEase uses the account, contact, move-in, occupant, and message details submitted here to process and manage this rental request. Relevant details are shared with the listing owner so they can assess and respond to it, and may be accessed by authorized RentEase personnel for support, safety, and legal obligations.</li>
                    <li>RentEase applies reasonable safeguards and keeps request information only as needed to operate the service and meet applicable obligations. Subject to applicable law, tenants may contact RentEase support to ask about access, correction, objection, or deletion of their personal information, or to raise a privacy concern.</li>
                  </ol>
                  <p>For your records, this agreement version and the time you submit your request are saved with the rental request.</p>
                </div>
                <label className="rental-agreement-accept">
                  <input name="agreement_accepted" type="checkbox" required />
                  <span>I have read and agree to the rental request terms and acknowledge the Data Privacy Notice under RA 10173. I understand this is a request, not a confirmed lease.</span>
                </label>
              </section>
              {error && <p className="rental-request-error" role="alert">{error}</p>}
              <button className="rental-request-button" type="submit" disabled={pending}>{pending ? "Submitting request…" : "Agree & send rental request"} <span aria-hidden="true">→</span></button>
            </form>
          </section>
        </div>
      , document.body)}
    </>
  );
}

function RentalBrowse({ user }) {
  const [type, setType] = useState("");
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offlinePreview, setOfflinePreview] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setOfflinePreview(false);
    apiRequest(`listings${type ? `?type=${encodeURIComponent(type)}` : ""}`, undefined, "GET")
      .then((result) => { if (active) setListings(result.listings); })
      .catch((err) => {
        if (!active) return;
        if (err instanceof Error && err.message.startsWith("Can't reach RentEase")) {
          setListings(demoListings.filter((listing) => !type || listing.property_type === type));
          setOfflinePreview(true);
          return;
        }
        setError(err instanceof Error ? err.message : "Could not load rental listings.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [type]);

  return (
    <section className="browse-page">
      <div className="browse-hero">
        <p className="eyebrow">A PLACE THAT FEELS LIKE YOURS</p>
        <h1>Find your next<br /><em>place to call home.</em></h1>
        <p>Thoughtful spaces for every season of life, from a cozy bedspacer to a whole apartment.</p>
        <a className="button button-primary browse-cta" href="#register">List your space <span aria-hidden="true">→</span></a>
      </div>
      <div className="listing-heading">
        <div><p className="eyebrow">CURATED FOR YOU</p><h2>Featured stays & rentals</h2></div>
        <div className="filter-pills" aria-label="Filter by rental type">
          <button className={!type ? "active" : ""} onClick={() => setType("")}>All spaces</button>
          {Object.entries(propertyLabels).map(([key, label]) => (
            <button key={key} className={type === key ? "active" : ""} onClick={() => setType(key)}>{label}</button>
          ))}
        </div>
      </div>
      {!loading && listings.length > 0 && <section className="dashboard-panel tenant-property-map-panel">
        <div className="dashboard-panel-heading">
          <div><p className="eyebrow">EXPLORE BY LOCATION</p><h2>Rental locations</h2></div>
        </div>
        <PropertyLocations listings={listings} emptyMessage="No rental locations have been pinned yet." />
      </section>}
      {offlinePreview && (
        <div className="offline-preview" role="status">
          <strong>Preview mode</strong>
          <span>Sample rentals are shown because the backend is offline. Account actions and live listings need the backend.</span>
        </div>
      )}
      {error && <div className="notice" role="alert">{error}</div>}
      {loading ? <p className="intro">Finding available rentals…</p> : listings.length ? (
        <div className="rental-grid">{listings.map((listing) => <RentalCard key={listing.id} listing={listing} user={user} />)}</div>
      ) : (
        <div className="empty-state"><span className="empty-icon" aria-hidden="true">⌂</span><h3>New spaces are on the way</h3><p>There are no published rentals in this category yet. Check back soon or list a space of your own.</p></div>
      )}
    </section>
  );
}

function OwnerWorkspace({ user, route, onUserUpdate }) {
  const [listings, setListings] = useState([]);
  const [propertyLocations, setPropertyLocations] = useState([]);
  const [rentalRequests, setRentalRequests] = useState([]);
  const [renters, setRenters] = useState([]);
  const [editingRenterId, setEditingRenterId] = useState(null);
  const [renterFilter, setRenterFilter] = useState("active");
  const [ownerPayments, setOwnerPayments] = useState([]);
  const [salesAnalytics, setSalesAnalytics] = useState(null);
  const [paymentToConfirm, setPaymentToConfirm] = useState(null);
  const [paymentConfirmationAcknowledged, setPaymentConfirmationAcknowledged] = useState(false);
  const [ownerRatings, setOwnerRatings] = useState([]);
  const [verificationDocuments, setVerificationDocuments] = useState([]);
  const [incomeAnalytics, setIncomeAnalytics] = useState(null);
  const [ownerQrProfile, setOwnerQrProfile] = useState({ gcash_qr_data: null, maya_qr_data: null, owner_phone: user.phone || "" });
  const [verificationStatus, setVerificationStatus] = useState(user.owner_status);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [listingType, setListingType] = useState("room");
  const [editingListing, setEditingListing] = useState(null);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const tasks = [];
    if (route === "dashboard" || route === "listings" || route === "map") {
      tasks.push({ key: "listings", promise: apiRequest("owner/listings", undefined, "GET") });
    }
    if (route === "dashboard" || route === "map") {
      tasks.push({ key: "locations", promise: apiRequest("owner/property-locations", undefined, "GET") });
    }
    if (route === "dashboard" || route === "requests") {
      tasks.push({ key: "requests", promise: apiRequest("owner/requests", undefined, "GET") });
    }
    if ((route === "dashboard" || route === "renters") && user.owner_status === "verified") {
      tasks.push({ key: "renters", promise: apiRequest("owner/renters", undefined, "GET") });
    }
    tasks.push({ key: "documents", promise: apiRequest("owner/verification-documents", undefined, "GET") });
    if ((route === "dashboard" || route === "payments") && user.owner_status === "verified") {
      tasks.push({ key: "payments", promise: apiRequest("owner/payments", undefined, "GET") });
      tasks.push({ key: "income", promise: apiRequest("owner/income", undefined, "GET") });
    }
    if (route === "dashboard" && user.owner_status === "verified") {
      tasks.push({ key: "ratings", promise: apiRequest("owner/ratings", undefined, "GET") });
    }
    if (route === "sales" && user.owner_status === "verified") {
      tasks.push({ key: "sales", promise: apiRequest("owner/sales-analytics", undefined, "GET") });
    }

    const results = await Promise.allSettled(tasks.map((task) => task.promise));
    const errors = [];
    results.forEach((result, index) => {
      const key = tasks[index].key;
      if (result.status === "rejected") {
        errors.push(`${key}: ${result.reason instanceof Error ? result.reason.message : "Could not load data."}`);
        return;
      }
      if (key === "listings") setListings(result.value.listings || []);
      if (key === "locations") setPropertyLocations(result.value.locations || []);
      if (key === "requests") setRentalRequests(result.value.requests || []);
      if (key === "renters") setRenters(result.value.renters || []);
      if (key === "documents") setVerificationDocuments(result.value.documents || []);
      if (key === "payments") {
        setOwnerPayments(result.value.payments || []);
        setOwnerQrProfile(result.value.profile || { gcash_qr_data: null, maya_qr_data: null, owner_phone: user.phone || "" });
      }
      if (key === "income") setIncomeAnalytics(result.value.income || null);
      if (key === "sales") setSalesAnalytics(result.value.sales || null);
      if (key === "ratings") setOwnerRatings(result.value.top_rentals || []);
    });
    setLoadError(errors.join(" "));
    setLoading(false);
  }, [route, user.owner_status, user.phone]);

  useEffect(() => { loadWorkspace(); }, [loadWorkspace]);
  const refreshVisibleOwnerData = useCallback(async () => {
    try {
      if (route === "requests") {
        const result = await apiRequest("owner/requests", undefined, "GET");
        setRentalRequests(result.requests || []);
      } else if (route === "renters" && user.owner_status === "verified") {
        const result = await apiRequest("owner/renters", undefined, "GET");
        setRenters(result.renters || []);
      } else if (route === "payments" && user.owner_status === "verified") {
        const [paymentResult, incomeResult] = await Promise.all([
          apiRequest("owner/payments", undefined, "GET"),
          apiRequest("owner/income", undefined, "GET"),
        ]);
        setOwnerPayments(paymentResult.payments || []);
        setOwnerQrProfile(paymentResult.profile || { gcash_qr_data: null, maya_qr_data: null, owner_phone: user.phone || "" });
        setIncomeAnalytics(incomeResult.income || null);
      }
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not refresh owner payment data.");
    }
  }, [route, user.owner_status, user.phone]);
  useEffect(() => {
    if (!["requests", "renters", "payments"].includes(route)) return undefined;
    const timer = window.setInterval(refreshVisibleOwnerData, 10000);
    return () => window.clearInterval(timer);
  }, [route, refreshVisibleOwnerData]);
  useEffect(() => {
    setMessage("");
    setMessageIsError(false);
  }, [route]);

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const fields = new FormData(form);
    fields.set("utilities_included", fields.get("utilities_included") === "on" ? "true" : "false");
    setPending(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const result = await apiUpload("listings", fields);
      setMessage(result.message);
      form.reset();
      setShowForm(false);
      setListingType("room");
      await loadWorkspace();
    } catch (error) {
      setMessage(error.message);
      setMessageIsError(true);
    } finally {
      setPending(false);
    }
  }

  async function reviewRentalRequest(id, decision) {
    setPending(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const result = await apiRequest(`owner/requests/${id}/review`, { decision });
      setMessage(result.message);
      await loadWorkspace();
    } catch (error) {
      setMessage(error.message);
      setMessageIsError(true);
    } finally {
      setPending(false);
    }
  }

  async function updateOwnerListing(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity() || !editingListing) return;
    const fields = new FormData(form);
    fields.set("utilities_included", fields.get("utilities_included") === "on" ? "true" : "false");
    setPending(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const result = await apiUpload(`owner/listings/${editingListing.id}/update`, fields);
      setMessage(result.message);
      setEditingListing(null);
      await loadWorkspace();
    } catch (error) {
      setMessage(error.message);
      setMessageIsError(true);
    } finally {
      setPending(false);
    }
  }

  async function settlePayment(payment, action) {
    setPending(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const result = await apiRequest(`owner/payments/${payment.record_id}/settle`, {
        record_type: payment.record_type,
        action,
      });
      setMessage(result.message);
      if (action === "confirm") {
        setPaymentToConfirm(null);
        setPaymentConfirmationAcknowledged(false);
      }
      await loadWorkspace();
    } catch (error) {
      setMessage(error.message);
      setMessageIsError(true);
    } finally {
      setPending(false);
    }
  }

  async function updateRenter(event, renter) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setPending(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const result = await apiRequest(`owner/renters/${renter.id}/update`, {
        display_name: fields.get("display_name"),
        contact_phone: fields.get("contact_phone"),
        contact_email: fields.get("contact_email"),
        tenancy_status: fields.get("tenancy_status"),
        owner_notes: fields.get("owner_notes"),
      });
      setMessage(result.message);
      setEditingRenterId(null);
      await loadWorkspace();
    } catch (error) {
      setMessage(error.message);
      setMessageIsError(true);
    } finally {
      setPending(false);
    }
  }

  async function endRenter(renter) {
    if (!window.confirm(`End ${renter.display_name}'s tenancy at ${renter.rental_title}? The account and payment history will be kept.`)) return;
    setPending(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const result = await apiRequest(`owner/renters/${renter.id}/end`, {});
      setMessage(result.message);
      await loadWorkspace();
    } catch (error) {
      setMessage(error.message);
      setMessageIsError(true);
    } finally {
      setPending(false);
    }
  }

  async function submitVerificationDocuments(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const requiredTypes = ["government_id", "ownership_proof"];
    const documentTypes = ["government_id", "ownership_proof", "authorization_letter"];
    const selected = documentTypes
      .map((type) => [type, form.elements.namedItem(type).files[0]])
      .filter(([, file]) => file);
    if (requiredTypes.some((type) => !form.elements.namedItem(type).files.length)) {
      setMessage("Upload both required PDFs: government-issued photo ID and proof of property ownership or management.");
      setMessageIsError(true);
      return;
    }
    if (selected.some(([, file]) => file.type !== "application/pdf" || file.size > 2 * 1024 * 1024)) {
      setMessage("Each document must be a PDF no larger than 2 MB.");
      setMessageIsError(true);
      return;
    }
    const formData = new FormData();
    selected.forEach(([type, file]) => formData.append(`documents[${type}]`, file));
    if (!selected.length) {
      setMessage("Choose at least one updated PDF to upload.");
      setMessageIsError(true);
      return;
    }
    setPending(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const result = await apiUpload("owner/verification-documents", formData);
      setMessage(result.message);
      onUserUpdate({ ...user, owner_status: "pending" });
      setVerificationStatus("pending");
      await loadWorkspace();
      form.reset();
    } catch (error) {
      setMessage(error.message);
      setMessageIsError(true);
    } finally {
      setPending(false);
    }
  }

  async function saveOwnerQr(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setPending(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const [gcashQr, mayaQr] = await Promise.all([
        readQrFile(fields.get("gcash_qr_file"), ownerQrProfile.gcash_qr_data),
        readQrFile(fields.get("maya_qr_file"), ownerQrProfile.maya_qr_data),
      ]);
      const result = await apiRequest("owner/payment-profile", {
        gcash_qr_data: gcashQr,
        maya_qr_data: mayaQr,
      });
      setMessage(result.message);
      await loadWorkspace();
    } catch (error) {
      setMessage(error.message);
      setMessageIsError(true);
    } finally {
      setPending(false);
    }
  }

  const publishedCount = listings.filter((listing) => listing.status === "published").length;
  const pendingCount = listings.filter((listing) => listing.status === "pending").length;
  const featuredCount = listings.filter((listing) => Boolean(Number(listing.is_featured))).length;
  const visibleRentalRequests = rentalRequests.filter((request) => ["pending", "awaiting_payment", "approved"].includes(request.status));
  const newRentalRequestCount = rentalRequests.filter((request) => request.status === "pending").length;
  const verified = verificationStatus === "verified";
  const monthlyIncome = (incomeAnalytics?.monthly_income || []).slice(-6);
  const totalIncomeCentavos = Number(incomeAnalytics?.total_centavos || 0);
  const routeTitles = {
    dashboard: ["Property overview", "A quick summary of your listings and incoming rental activity."],
    listings: ["My property listings", "Create and manage every rental space connected to your account."],
    map: ["Property locations", "Pin your rentals on the map and review where each property is located."],
    requests: ["Rental applications", "Review tenant requests and follow each payment confirmation."],
    renters: ["Monitor renters", "Track each tenant's rental, contact details, payment balance, and tenancy status."],
    payments: ["Rent payments & wallet QR", "Set up your own GCash/Maya QR and manage tenant wallet transfers or cash payments."],
    sales: ["My rental sales", "See only the confirmed rental income connected to your properties."],
  };
  const [pageTitle, pageDescription] = routeTitles[route] || routeTitles.dashboard;

  function toggleListingForm() {
    const opening = !showForm;
    setShowForm(opening);
    if (opening) {
      window.requestAnimationFrame(() => document.getElementById("owner-listing-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  return (
    <div className="owner-dashboard">
      <div className="role-dashboard-heading">
        <div><p className="eyebrow">RENTEASE / OWNER WORKSPACE</p><h1>{pageTitle}</h1><p>{pageDescription}</p></div>
        {route === "dashboard" && <a className="dashboard-action" href="#owner/listings">Manage properties <span aria-hidden="true">→</span></a>}
        {route === "map" && <a className="dashboard-action" href="#owner/listings">Edit property details <span aria-hidden="true">→</span></a>}
        {route === "listings" && verified && <button className="dashboard-action" onClick={toggleListingForm}>{showForm ? "Close form" : "+ Add new listing"}</button>}
      </div>
      <RentNotificationFeed accountType="owner" />
      <div className="owner-verification-banner">
        <span className={`owner-verification-icon ${verified ? "verified" : ""}`}>{verified ? "✓" : "!"}</span>
        <div><strong>{verified ? "Owner account verified" : verificationStatus === "rejected" ? "Owner verification not approved" : "Owner verification pending"}</strong><p>{verified ? "You can submit listings for review. New rentals become visible after admin approval." : verificationStatus === "rejected" ? "You can submit updated documents for another review." : "An administrator must verify your owner account before you can publish a rental listing."}</p></div>
        <span className={`owner-status-pill ${verified ? "verified" : ""}`}>{verified ? "Verified" : verificationStatus === "rejected" ? "Not approved" : "Under review"}</span>
      </div>
      {!verified && <section className="dashboard-panel owner-verification-upload">
        <div className="dashboard-panel-heading"><div><p className="eyebrow">OWNER CREDIBILITY</p><h2>Submit verification documents</h2></div></div>
        <p>Submit these documents in order to help the administrator verify your owner account. PDF files only, up to 2 MB each. Include both required documents each time you submit or resubmit them.</p>
        <ol className="verification-checklist">
          <li><strong>Government-issued photo ID</strong><span>Required · PDF</span>{verificationDocuments.find((document) => document.document_type === "government_id") && <small>Submitted: {verificationDocuments.find((document) => document.document_type === "government_id").file_name}</small>}</li>
          <li><strong>Proof of property ownership or management</strong><span>Required · PDF</span>{verificationDocuments.find((document) => document.document_type === "ownership_proof") && <small>Submitted: {verificationDocuments.find((document) => document.document_type === "ownership_proof").file_name}</small>}</li>
          <li><strong>Authorization letter</strong><span>Optional · PDF, if acting for the owner</span>{verificationDocuments.find((document) => document.document_type === "authorization_letter") && <small>Submitted: {verificationDocuments.find((document) => document.document_type === "authorization_letter").file_name}</small>}</li>
        </ol>
        <form className="owner-verification-form" onSubmit={submitVerificationDocuments}>
          <label htmlFor="owner-verification-id">1. Government-issued photo ID (required)</label>
          <input id="owner-verification-id" name="government_id" type="file" accept="application/pdf,.pdf" required />
          <label htmlFor="owner-verification-ownership">2. Proof of property ownership or management (required)</label>
          <input id="owner-verification-ownership" name="ownership_proof" type="file" accept="application/pdf,.pdf" required />
          <label htmlFor="owner-verification-authorization">3. Authorization letter (optional)</label>
          <input id="owner-verification-authorization" name="authorization_letter" type="file" accept="application/pdf,.pdf" />
          <button type="submit" disabled={pending}>{pending ? "Uploading…" : "Submit for verification"}</button>
        </form>
        <small>Only administrators can view these documents. Do not upload wallet PINs, passwords, or unrelated sensitive information.</small>
      </section>}
      {loadError && <p className="dashboard-empty" role="alert">{loadError}</p>}
      {message && <p className={`owner-form-message${messageIsError ? " is-error" : ""}`} role={messageIsError ? "alert" : "status"}>{message}</p>}
      {route === "dashboard" && <div className="dashboard-stat-grid owner-stat-grid">
        <article className="dashboard-stat"><span>Total properties</span><strong>{loading ? "—" : listings.length}</strong><small>All your submitted rental posts</small></article>
        <article className="dashboard-stat"><span>Published listings</span><strong>{loading ? "—" : publishedCount}</strong><small>Visible to tenants</small></article>
        <article className="dashboard-stat"><span>New rental requests</span><strong>{loading ? "—" : newRentalRequestCount}</strong><small>Tenants waiting for your response</small></article>
        <article className="dashboard-stat"><span>Current renters</span><strong>{loading ? "—" : renters.filter((renter) => renter.tenancy_status !== "ended").length}</strong><small><a href="#owner/renters">Monitor tenants and balances →</a></small></article>
        <article className="dashboard-stat"><span>Featured rentals</span><strong>{loading ? "—" : featuredCount}</strong><small>Highlighted on the browse page</small></article>
      </div>}
      {(route === "dashboard" || route === "map") && <section className="dashboard-panel property-locations-panel">
        <div className="dashboard-panel-heading">
          <div><p className="eyebrow">PROPERTY LOCATIONS</p><h2>{route === "map" ? "All your rental locations" : "Where your properties are located"}</h2></div>
          {route === "dashboard" && <a href="#owner/map">Open property map →</a>}
        </div>
        {loading ? <p className="dashboard-empty">Loading your property locations…</p> : listings.length ? <PropertyLocations listings={propertyLocations} emptyMessage="No property locations have been pinned yet. Edit a property to place its map pin." /> : <p className="dashboard-empty">Add a property listing to see its location here.</p>}
      </section>}
      {route === "listings" && <div className="owner-dashboard-grid owner-dashboard-grid-single">
        <section className="dashboard-panel owner-listings-panel">
          <div className="dashboard-panel-heading"><div><p className="eyebrow">YOUR PORTFOLIO</p><h2>Manage property listings</h2></div><span>{pendingCount} awaiting admin</span></div>
          {loading ? <p className="dashboard-empty">Loading your property listings…</p> : listings.length ? (
            <div className="owner-listing-list">{listings.map((listing) => (
              <article className="owner-listing-row" key={listing.id}>
                <div className={`owner-listing-thumb rental-art-${listing.property_type}`}>{listing.photo_url && <img src={propertyPhotoSource(listing)} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />}</div>
                <div className="owner-listing-info"><strong>{listing.title}</strong><span>{propertyLabels[listing.property_type] || listing.property_type} · {listing.location}</span><small>₱{Number(listing.price).toLocaleString()} / month</small></div>
                <span className={`listing-state listing-${listing.status}`}>{listing.status}</span>
                <div className="owner-listing-details">
                  <span>{Number(listing.rooms_count ?? listing.bedrooms) > 0 ? `${listing.rooms_count ?? listing.bedrooms} room${Number(listing.rooms_count ?? listing.bedrooms) === 1 ? "" : "s"}` : "Room count not provided"}</span>
                  {listing.property_type === "bedspacer" && <span>{Number(listing.bed_count) || 0} bed{Number(listing.bed_count) === 1 ? "" : "s"}</span>}
                  <span>{listing.bathrooms > 0 ? `${listing.bathrooms} bath` : "Bath count not provided"}</span>
                  <span>Up to {listing.max_occupants} occupants</span>
                  {listing.floor_area && <span>{Number(listing.floor_area)} m²</span>}
                  {listing.available_from && <span>Available {formatDate(listing.available_from)}</span>}
                  {Boolean(Number(listing.utilities_included)) && <span>Utilities included</span>}
                  {listing.amenities && <span>{listing.amenities}</span>}
                </div>
                {verified && <div className="owner-listing-actions"><button type="button" disabled={pending} onClick={() => setEditingListing(listing)}>Edit property</button></div>}
              </article>
            ))}</div>
          ) : <p className="dashboard-empty">You have not submitted a property yet. Start with a listing to bring your rental to tenants.</p>}
        </section>
      </div>}
      {route === "requests" && <div className="owner-dashboard-grid owner-dashboard-grid-single">
        <section className="dashboard-panel owner-tasks-panel">
          <div className="dashboard-panel-heading"><div><p className="eyebrow">INCOMING TENANTS</p><h2>Rental requests</h2></div><div className="owner-payment-heading-actions"><span>{newRentalRequestCount} need response</span><button type="button" onClick={refreshVisibleOwnerData}>Refresh</button></div></div>
          {loading ? <p className="dashboard-empty">Loading tenant requests…</p> : visibleRentalRequests.length ? (
            <div className="owner-rental-requests">{visibleRentalRequests.map((request) => (
              <article className="owner-request-card" key={request.id}>
                <div className="owner-request-heading"><strong>{request.tenant_name}</strong><span className={`listing-state listing-${request.payment_status === "paid" ? "approved" : request.payment_status === "pending_owner_confirmation" ? "pending_owner_confirmation" : request.status}`}>{request.payment_status === "paid" ? "Paid" : request.payment_status === "pending_owner_confirmation" ? "Confirm payment" : request.status}</span></div>
                <p>{request.rental_title} · ₱{Number(request.price).toLocaleString()} / month</p>
                <small>Move-in {formatDate(request.move_in)} · {request.occupants} occupant{Number(request.occupants) === 1 ? "" : "s"} · {request.term_months} months</small>
                {request.message && <blockquote>{request.message}</blockquote>}
                <div className="owner-request-contact">{request.tenant_email}{request.tenant_phone && ` · ${request.tenant_phone}`}</div>
                {request.status === "pending" && verified && <div className="owner-request-actions">
                  <button type="button" disabled={pending} onClick={() => reviewRentalRequest(request.id, "approve")}>Approve & request payment</button>
                  <button type="button" disabled={pending} onClick={() => reviewRentalRequest(request.id, "decline")}>Decline</button>
                </div>}
                {request.status === "pending" && !verified && <small>Verify your owner account to respond to rental requests.</small>}
                {request.status === "awaiting_payment" && request.payment_status === "pending_owner_confirmation" && <small>The tenant reported a {String(request.payment_method || "wallet").toUpperCase()} payment{request.payment_receipt_available ? " and uploaded a receipt" : ""}. Review it in <a href="#owner/payments">Payments</a> and confirm it to activate the rental.</small>}
                {request.status === "awaiting_payment" && request.payment_status === "paid" && <small>Payment confirmed{request.payment_paid_at ? ` on ${formatDate(request.payment_paid_at)}` : ""}. The rental is active.</small>}
                {request.status === "awaiting_payment" && !["pending_owner_confirmation", "paid"].includes(request.payment_status) && <small>Waiting for the tenant to complete the first rent and deposit payment.</small>}
                {request.status === "approved" && request.payment_status === "paid" && <small>Tenant payment confirmed. This rental is active.</small>}
                {request.status === "approved" && request.payment_status !== "paid" && <small>Legacy approval; no online payment record is available.</small>}
              </article>
            ))}</div>
          ) : <p className="dashboard-empty">No rental requests are waiting. Requests from tenants will appear here.</p>}
        </section>
      </div>}
      {route === "renters" && <div className="owner-dashboard-grid owner-dashboard-grid-single">
        {!verified ? <section className="dashboard-panel"><p className="dashboard-empty">Verify your owner account before monitoring renters.</p></section> : <section className="dashboard-panel owner-tasks-panel">
          <div className="dashboard-panel-heading">
            <div><p className="eyebrow">TENANCY MONITORING</p><h2>Renters and rental status</h2></div>
            <div className="owner-payment-heading-actions">
              <span>{renters.filter((renter) => renter.tenancy_status !== "ended").length} active</span>
              <button type="button" onClick={refreshVisibleOwnerData}>Refresh</button>
            </div>
          </div>
          <p>Update contact details and private owner notes for this rental only. Ending a tenancy keeps the tenant account and all payment records.</p>
          <div className="filter-pills owner-renter-filters" aria-label="Filter renters">
            <button type="button" className={renterFilter === "active" ? "active" : ""} onClick={() => setRenterFilter("active")}>Active renters</button>
            <button type="button" className={renterFilter === "ended" ? "active" : ""} onClick={() => setRenterFilter("ended")}>Ended tenancies</button>
          </div>
          {loading ? <p className="dashboard-empty">Loading renter records…</p> : (() => {
            const visibleRenters = renters.filter((renter) => renterFilter === "ended"
              ? renter.tenancy_status === "ended"
              : renter.tenancy_status !== "ended");
            return visibleRenters.length ? <div className="owner-rental-requests">{visibleRenters.map((renter) => (
              <article className="owner-request-card owner-renter-card" key={renter.id}>
                <div className="owner-request-heading">
                  <strong>{renter.display_name}</strong>
                  <span className={`listing-state listing-${renter.tenancy_status}`}>{renter.tenancy_status === "notice" ? "Move-out notice" : renter.tenancy_status === "maintenance" ? "Maintenance" : renter.tenancy_status === "ended" ? "Tenancy ended" : "Active"}</span>
                </div>
                <p>{renter.rental_title} · {renter.location} · ₱{Number(renter.price).toLocaleString()} / month</p>
                <div className="owner-renter-facts">
                  <span>Move-in {formatDate(renter.move_in)} · {renter.term_months} months · {renter.occupants} occupant{renter.occupants === 1 ? "" : "s"}</span>
                  <span>{renter.contact_email}</span>
                  <span>{renter.contact_phone || "No contact number"}</span>
                  <span>First payment: {formatCurrency(renter.initial_amount_centavos)} · {renter.payment_method ? String(renter.payment_method).toUpperCase() : "Paid"}</span>
                  <strong className={renter.outstanding_centavos > 0 ? "renter-balance-due" : "renter-balance-clear"}>
                    {renter.schedule_installments === 0
                      ? "Rent schedule is being prepared"
                      : renter.outstanding_centavos > 0
                        ? `Outstanding: ${formatCurrency(renter.outstanding_centavos)}`
                        : "No scheduled balance"}
                    {renter.overdue_installments > 0 ? ` · ${renter.overdue_installments} overdue` : ""}
                  </strong>
                </div>
                {renter.owner_notes && <p className="owner-renter-notes"><strong>Owner notes:</strong> {renter.owner_notes}</p>}
                {renter.tenancy_status !== "ended" && <>
                  {editingRenterId === renter.id ? <form className="owner-renter-form" onSubmit={(event) => updateRenter(event, renter)}>
                    <label>Renter display name<input name="display_name" maxLength={160} defaultValue={renter.display_name} required /></label>
                    <label>Contact number<input name="contact_phone" type="tel" maxLength={30} defaultValue={renter.contact_phone || ""} /></label>
                    <label className="owner-renter-notes-field">Contact email<input name="contact_email" type="email" maxLength={254} defaultValue={renter.contact_email || ""} /></label>
                    <label>Tenancy status<select name="tenancy_status" defaultValue={renter.tenancy_status}><option value="active">Active</option><option value="notice">Move-out notice</option><option value="maintenance">Maintenance</option></select></label>
                    <label className="owner-renter-notes-field">Private notes<textarea name="owner_notes" maxLength={2000} defaultValue={renter.owner_notes || ""} placeholder="Record maintenance, condition checks, or other tenancy updates…" /></label>
                    <div className="owner-request-actions"><button type="submit" disabled={pending}>{pending ? "Saving…" : "Save renter updates"}</button><button type="button" disabled={pending} onClick={() => setEditingRenterId(null)}>Cancel</button></div>
                  </form> : <div className="owner-request-actions">
                    <button type="button" disabled={pending} onClick={() => setEditingRenterId(renter.id)}>Update details</button>
                    <button type="button" disabled={pending} onClick={() => endRenter(renter)}>End tenancy</button>
                  </div>}
                </>}
              </article>
            ))}</div> : <p className="dashboard-empty">{renterFilter === "ended" ? "No ended tenancies yet. Ended records and payment history will remain here." : "No active renters yet. Tenants with confirmed first payments will appear here."}</p>;
          })()}
        </section>}
      </div>}
      {route === "sales" && (
        <div className="owner-sales-page">
          {!verified ? <section className="dashboard-panel"><p className="dashboard-empty">Verify your owner account before viewing your rental sales.</p></section> : loading ? (
            <section className="dashboard-panel"><p className="dashboard-empty">Loading your sales analytics…</p></section>
          ) : salesAnalytics ? (
            <>
              <div className="dashboard-stat-grid owner-stat-grid">
                <article className="dashboard-stat"><span>Your confirmed sales</span><strong>₱{(Number(salesAnalytics.total_centavos || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><small>Across your confirmed rental payments</small></article>
                <article className="dashboard-stat"><span>Confirmed payments</span><strong>{salesAnalytics.transactions}</strong><small>Initial payments and paid rent installments</small></article>
              </div>
              <SalesForecastPanel sales={salesAnalytics} formatMoney={formatCurrency} scopeLabel="YOUR RENTAL SALES ONLY" />
              <section className="dashboard-panel admin-table-panel"><div className="dashboard-panel-heading"><div><p className="eyebrow">YOUR PAYMENT HISTORY</p><h2>Monthly confirmed sales</h2></div><span>Last 12 months</span></div><AdminTable headers={["Month", "Payments", "Confirmed amount"]} rows={(salesAnalytics.monthly_income || []).map((item) => [item.month, item.transactions, formatCurrency(item.amount_centavos)])} empty="Your confirmed rental income will appear here." /></section>
            </>
          ) : <section className="dashboard-panel"><p className="dashboard-empty">Could not load your sales analytics. Refresh the page to try again.</p></section>}
        </div>
      )}
      {route === "payments" && !verified && <section className="dashboard-panel"><p className="dashboard-empty">Verify your owner account before setting up wallet QR codes or managing rent payments.</p></section>}
      {route === "payments" && verified && <div className="owner-dashboard-grid owner-dashboard-grid-single owner-payment-workspace">
        <section className="dashboard-panel">
          <div className="dashboard-panel-heading"><div><p className="eyebrow">PHYSICAL WALLET PAYMENTS</p><h2>Your GCash & Maya QR codes</h2></div></div>
          <p>Generate or download your official QR in the GCash or Maya app, then save it here. Tenants can use your saved QR or your account mobile number and report the transfer. Never upload a QR containing a wallet PIN or login code.</p>
          <p>Your RentEase account mobile number <strong>{user.phone || "has not been added"}</strong> can also be used as your payment number. Update it through support if it is incorrect.</p>
          <form className="owner-qr-form" onSubmit={saveOwnerQr}>
            <label>Owner-generated GCash QR<input type="file" name="gcash_qr_file" accept="image/png,image/jpeg,image/webp" /><small>Generate/download your official QR in GCash, then upload it here (PNG/JPG/WebP; max 1 MB).</small></label>
            {ownerQrProfile.gcash_qr_data && <img className="wallet-qr-image" src={ownerQrProfile.gcash_qr_data} alt="Saved GCash QR" />}
            <label>Owner-generated Maya QR<input type="file" name="maya_qr_file" accept="image/png,image/jpeg,image/webp" /><small>Generate/download your official QR in Maya, then upload it here (PNG/JPG/WebP; max 1 MB).</small></label>
            {ownerQrProfile.maya_qr_data && <img className="wallet-qr-image" src={ownerQrProfile.maya_qr_data} alt="Saved Maya QR" />}
            <button type="submit" disabled={pending}>{pending ? "Saving…" : "Save my QR codes"}</button>
          </form>
          <p className="owner-qr-tenant-note">Only you can add or replace these QR codes. Tenants can use your saved QR or account mobile number to pay; they cannot create or edit them.</p>
        </section>
        <section className="dashboard-panel">
          <div className="dashboard-panel-heading"><div><p className="eyebrow">PAYMENT MANAGEMENT</p><h2>Tenant payments</h2></div><div className="owner-payment-heading-actions"><span>{ownerPayments.filter((payment) => payment.status === "pending_owner_confirmation").length} awaiting confirmation</span><button type="button" onClick={refreshVisibleOwnerData}>Refresh</button></div></div>
          {loading ? <p className="dashboard-empty">Loading owner payments…</p> : ownerPayments.some((payment) => payment.status !== "paid") ? (
            <div className="owner-rental-requests">{ownerPayments.filter((payment) => payment.status !== "paid").map((payment) => {
              const awaitingOwnerConfirmation = payment.status === "pending_owner_confirmation";
              const canRecordCash = ["awaiting_payment", "due", "overdue", "upcoming", "failed"].includes(payment.status);
              return <article className="owner-request-card" key={`${payment.record_type}-${payment.record_id}`}>
                <div className="owner-request-heading"><strong>{payment.tenant_name}</strong><span className={`listing-state listing-${payment.status}`}>{payment.status === "pending_owner_confirmation" ? `${String(payment.payment_method || "payment").toUpperCase()} receipt to confirm` : payment.status === "awaiting_payment" ? "Move-in payment due" : payment.status}</span></div>
                <p>{payment.rental_title}{payment.installment_number ? ` · Installment #${payment.installment_number}` : " · First month + deposit"}</p>
                <small>₱{(Number(payment.amount_centavos) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}{payment.due_date ? ` · Due ${formatDate(payment.due_date)}` : ""}</small>
                {payment.payment_method && <small>Method: {String(payment.payment_method).toUpperCase()}</small>}
                {payment.status === "pending_owner_confirmation" && payment.receipt_available && <a href={`${API_BASE}/owner/payments/${payment.record_id}/receipt?record_type=${payment.record_type}`} target="_blank" rel="noreferrer">View JPG payment receipt</a>}
                {awaitingOwnerConfirmation && (payment.receipt_available ? <div className="owner-request-actions">
                  <button type="button" disabled={pending} onClick={() => {
                    setPaymentToConfirm(payment);
                    setPaymentConfirmationAcknowledged(false);
                  }}>Review & confirm payment</button>
                  <button type="button" disabled={pending} onClick={() => settlePayment(payment, "reject")}>Reject report</button>
                </div> : <small role="status">Waiting for the tenant to upload a valid JPG receipt before you can confirm.</small>)}
                {canRecordCash && !awaitingOwnerConfirmation && <small className="cash-receipt-required" role="status">Cash cannot be recorded here without proof. Ask the tenant to submit a JPG cash receipt from their payment page; review it here before confirming receipt.</small>}
                {["pending", "creating"].includes(payment.status) && <small>Online Xendit checkout is still in progress; cash settlement is disabled to avoid duplicate charges.</small>}
              </article>;
            })}</div>
          ) : <p className="dashboard-empty">No unpaid tenant payments are available to manage yet.</p>}
        </section>
      </div>}
      {route === "dashboard" && <div className="owner-dashboard-grid owner-dashboard-lower">
        <section className="dashboard-panel">
          <div className="dashboard-panel-heading"><div><p className="eyebrow">LISTING HISTORY</p><h2>Recent activity</h2></div></div>
          {loading ? <p className="dashboard-empty">Loading recent activity…</p> : listings.length ? (
            <div className="owner-activity-list">{listings.slice(0, 5).map((listing) => (
              <div className="owner-activity-row" key={listing.id}><span className="activity-dot" /><div><strong>{listing.title}</strong><small>{formatDate(listing.created_at)} · {propertyLabels[listing.property_type] || listing.property_type}</small></div><span className={`listing-state listing-${listing.status}`}>{listing.status}</span></div>
            ))}</div>
          ) : <p className="dashboard-empty">Submitted listings and their review status will appear here.</p>}
        </section>
        <section className="dashboard-panel">
          <div className="dashboard-panel-heading"><div><p className="eyebrow">PAYMENT OVERVIEW</p><h2>Rental income</h2></div><a href="#owner/payments">Manage payments →</a></div>
          {!verified ? <p className="dashboard-empty">Verify your owner account to view rental income analytics.</p> : loading ? <p className="dashboard-empty">Loading confirmed rental income…</p> : !incomeAnalytics ? <p className="dashboard-empty">Rental income analytics could not be loaded. Refresh the dashboard to try again.</p> : (
            <>
              <div className="owner-income-total"><span>Confirmed income</span><strong>₱{(totalIncomeCentavos / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><small>{incomeAnalytics.transactions} confirmed payment{Number(incomeAnalytics.transactions) === 1 ? "" : "s"}</small></div>
              {monthlyIncome.length ? <LineChart
                className="owner-income-line-chart"
                ariaLabel="Monthly rental income"
                labels={monthlyIncome.map((item) => new Date(`${item.month}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "2-digit" }))}
                formatValue={(amount) => formatCurrency(amount)}
                datasets={[{
                  label: "Confirmed rental income",
                  data: monthlyIncome.map((item) => Number(item.amount_centavos || 0)),
                  borderColor: "#4d8062",
                  backgroundColor: "rgba(77, 128, 98, 0.12)",
                  pointBackgroundColor: "#4d8062",
                  pointRadius: 3,
                  tension: 0.3,
                  fill: true,
                }]}
              /> : <p className="dashboard-empty">Confirmed tenant payments will appear here once they are received.</p>}
            </>
          )}
        </section>
      </div>}
      {route === "dashboard" && verified && <section className="dashboard-panel owner-ratings-panel">
        <div className="dashboard-panel-heading"><div><p className="eyebrow">TENANT FEEDBACK</p><h2>Your top-rated rentals</h2></div><span>Approved reviews only</span></div>
        {loading ? <p className="dashboard-empty">Loading tenant ratings…</p> : ownerRatings.length ? (
          <div className="owner-ratings-grid">{ownerRatings.slice(0, 3).map((rating, index) => (
            <article className={`owner-rating-card ${index === 0 ? "top-rated" : ""}`} key={rating.rental_id}>
              <span className="owner-rating-rank">{index === 0 ? "TOP RATED" : `#${index + 1}`}</span>
              <strong>{rating.rental_title}</strong>
              <span className="owner-rating-score">★ {Number(rating.average_rating).toFixed(2)} <small>/ 5</small></span>
              <small>{rating.review_count} approved tenant review{rating.review_count === 1 ? "" : "s"}</small>
            </article>
          ))}</div>
        ) : <p className="dashboard-empty">Your rental ratings will appear after tenants submit reviews and an admin approves them.</p>}
      </section>}
      {route === "listings" && showForm && verified && (
        <form id="owner-listing-form" className="listing-form" encType="multipart/form-data" onSubmit={submit}>
          <div className="listing-form-heading">
            <div><p className="eyebrow">PROPERTY DETAILS</p><h3>Tell renters about your space</h3><p>Complete the details below so people can find the right place to call home.</p></div>
            <span>Rental listing details</span>
          </div>
          <fieldset className="listing-form-group">
            <legend>Listing basics</legend>
            <div className="listing-fields">
              <div className="listing-field field-wide"><label htmlFor="rental-title">Listing title</label><input id="rental-title" name="title" minLength={4} maxLength={120} required placeholder="Sunny room near campus" /></div>
              <div className="listing-field"><label htmlFor="rental-type">Space type</label><select id="rental-type" name="property_type" value={listingType} onChange={(event) => setListingType(event.target.value)}><option value="bedspacer">Bedspacer</option><option value="room">Room</option><option value="apartment">Apartment</option></select></div>
              <div className="listing-field"><label htmlFor="rental-price">Monthly rent (₱)</label><input id="rental-price" name="price" type="number" min="1" max="99999999.99" step="0.01" required placeholder="8500" /></div>
              <div className="listing-field"><label htmlFor="rental-location">City / neighborhood</label><input id="rental-location" name="location" minLength={3} maxLength={180} required placeholder="Calapan City, Biga" /></div>
              <div className="listing-field"><label htmlFor="rental-address">Street address</label><input id="rental-address" name="address" minLength={5} maxLength={180} required placeholder="123 Mabini Street" /></div>
              <div className="listing-field"><label htmlFor="rental-unit">Unit / building (optional)</label><input id="rental-unit" name="unit_number" maxLength={40} placeholder="Unit 2B" /></div>
              <div className="listing-field field-wide"><PropertyLocationPicker /></div>
              <PropertyPhotoField id="rental-photo" className="listing-field field-wide" required />
            </div>
          </fieldset>
          <fieldset className="listing-form-group">
            <legend>Capacity & amenities</legend>
            <div className="listing-fields">
              <div className="listing-field"><label htmlFor="rental-rooms">{listingType === "apartment" ? "Number of rooms" : listingType === "bedspacer" ? "Rooms in this space" : "Number of rooms"}</label><input id="rental-rooms" name="rooms_count" type="number" min="0" max="50" required defaultValue="1" /></div>
              {listingType === "bedspacer" && <div className="listing-field"><label htmlFor="rental-beds">Number of beds</label><input id="rental-beds" name="bed_count" type="number" min="1" max="500" required defaultValue="1" /></div>}
              <div className="listing-field"><label htmlFor="rental-bathrooms">Bathrooms</label><input id="rental-bathrooms" name="bathrooms" type="number" min="0" max="50" required defaultValue="1" /></div>
              <div className="listing-field"><label htmlFor="rental-occupants">Maximum occupants</label><input id="rental-occupants" name="max_occupants" type="number" min="1" max="500" required defaultValue="1" /></div>
              <div className="listing-field"><label htmlFor="rental-area">Floor area (m², optional)</label><input id="rental-area" name="floor_area" type="number" min="1" max="99999" step="0.01" placeholder="28" /></div>
              <div className="listing-field"><label htmlFor="rental-furnishing">Furnishing</label><select id="rental-furnishing" name="furnishing" defaultValue="unfurnished"><option value="unfurnished">Unfurnished</option><option value="semi_furnished">Semi-furnished</option><option value="fully_furnished">Fully furnished</option></select></div>
              <div className="listing-field"><label htmlFor="rental-amenities">Amenities (comma-separated)</label><input id="rental-amenities" name="amenities" maxLength={1000} placeholder="Wi-Fi, parking, air conditioning" /></div>
              <label className="utilities-toggle"><input name="utilities_included" type="checkbox" /> Utilities included in rent</label>
            </div>
          </fieldset>
          <fieldset className="listing-form-group">
            <legend>Availability & contact</legend>
            <div className="listing-fields">
              <div className="listing-field"><label htmlFor="rental-available">Available from</label><input id="rental-available" name="available_from" type="date" min={localDateInputValue()} required /></div>
              <div className="listing-field"><label htmlFor="rental-deposit">Security deposit (₱)</label><input id="rental-deposit" name="security_deposit" type="number" min="0" max="99999999.99" step="0.01" required defaultValue="0" /></div>
              <div className="listing-field field-wide"><label htmlFor="rental-contact">Contact phone</label><input id="rental-contact" name="contact_phone" type="tel" maxLength={30} required placeholder="+63 912 345 6789" /></div>
              <div className="listing-field field-wide"><label htmlFor="rental-description">Description</label><textarea id="rental-description" name="description" minLength={20} maxLength={5000} rows={4} required placeholder="Describe the space, nearby landmarks, house rules, and what makes it special." /></div>
            </div>
          </fieldset>
          <div className="listing-form-actions"><p>Your post will be visible after admin review.</p><button className="button button-primary" disabled={pending}>{pending ? "Submitting…" : "Submit for review"} <span aria-hidden="true">→</span></button></div>
        </form>
      )}
      {editingListing && route === "listings" && (
        <div className="admin-modal-backdrop owner-listing-editor-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !pending) setEditingListing(null);
        }}>
          <section className="admin-edit-modal admin-listing-modal owner-listing-editor" role="dialog" aria-modal="true" aria-labelledby="owner-listing-editor-title">
            <button type="button" className="request-dialog-close" aria-label="Close property editor" disabled={pending} onClick={() => setEditingListing(null)}>×</button>
            <p className="eyebrow">EDIT YOUR PROPERTY</p>
            <h2 id="owner-listing-editor-title">{editingListing.title}</h2>
            <form className="owner-listing-editor-form" encType="multipart/form-data" onSubmit={updateOwnerListing}>
              <label>Property title<input name="title" minLength={4} maxLength={120} required defaultValue={editingListing.title} /></label>
              <label>Property type<select name="property_type" defaultValue={editingListing.property_type}><option value="bedspacer">Bedspacer</option><option value="room">Room</option><option value="apartment">Apartment</option></select></label>
              <label>Monthly rent (₱)<input name="price" type="number" min="1" max="99999999.99" step="0.01" required defaultValue={editingListing.price} /></label>
              <label>City / neighborhood<input name="location" minLength={3} maxLength={180} required defaultValue={editingListing.location} /></label>
              <label>Street address<input name="address" minLength={5} maxLength={180} required defaultValue={editingListing.address} /></label>
              <label>Unit / building<input name="unit_number" maxLength={40} defaultValue={editingListing.unit_number || ""} /></label>
              <div className="owner-listing-editor-wide"><PropertyLocationPicker key={editingListing.id} latitude={editingListing.latitude} longitude={editingListing.longitude} /></div>
              <label>Rooms<input name="rooms_count" type="number" min="0" max="50" required defaultValue={editingListing.rooms_count ?? editingListing.bedrooms ?? 0} /></label>
              <label>Beds<input name="bed_count" type="number" min="0" max="500" required defaultValue={editingListing.bed_count || 0} /></label>
              <label>Bathrooms<input name="bathrooms" type="number" min="0" max="50" required defaultValue={editingListing.bathrooms} /></label>
              <label>Maximum occupants<input name="max_occupants" type="number" min="1" max="500" required defaultValue={editingListing.max_occupants} /></label>
              <label>Floor area (m²)<input name="floor_area" type="number" min="1" max="99999" step="0.01" defaultValue={editingListing.floor_area || ""} /></label>
              <label>Furnishing<select name="furnishing" defaultValue={editingListing.furnishing || "unfurnished"}><option value="unfurnished">Unfurnished</option><option value="semi_furnished">Semi-furnished</option><option value="fully_furnished">Fully furnished</option></select></label>
              <label>Available from<input name="available_from" type="date" required defaultValue={editingListing.available_from} /></label>
              <label>Security deposit (₱)<input name="security_deposit" type="number" min="0" max="99999999.99" step="0.01" required defaultValue={editingListing.security_deposit || 0} /></label>
              <label>Contact phone<input name="contact_phone" type="tel" maxLength={30} required defaultValue={editingListing.contact_phone} /></label>
              <PropertyPhotoField id="owner-edit-photo" className="owner-listing-editor-wide" currentPhoto={propertyPhotoSource(editingListing)} />
              <label className="owner-listing-editor-wide">Amenities<input name="amenities" maxLength={1000} defaultValue={editingListing.amenities || ""} /></label>
              <label className="owner-listing-editor-wide">Description<textarea name="description" minLength={20} maxLength={5000} rows={4} required defaultValue={editingListing.description} /></label>
              <label className="owner-listing-editor-utilities"><input name="utilities_included" type="checkbox" defaultChecked={Boolean(Number(editingListing.utilities_included))} /> Utilities included</label>
              <div className="owner-listing-editor-actions"><button type="button" disabled={pending} onClick={() => setEditingListing(null)}>Cancel</button><button type="submit" disabled={pending}>{pending ? "Saving…" : "Save property changes"}</button></div>
            </form>
          </section>
        </div>
      )}
      {paymentToConfirm && route === "payments" && (
        <div className="admin-modal-backdrop payment-confirmation-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !pending) {
            setPaymentToConfirm(null);
            setPaymentConfirmationAcknowledged(false);
          }
        }}>
          <section className="admin-edit-modal payment-confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="owner-payment-confirmation-title">
            <button type="button" className="request-dialog-close" aria-label="Close payment confirmation" disabled={pending} onClick={() => {
              setPaymentToConfirm(null);
              setPaymentConfirmationAcknowledged(false);
            }}>×</button>
            <p className="eyebrow">OWNER PAYMENT CONFIRMATION</p>
            <h2 id="owner-payment-confirmation-title">Confirm this payment was received?</h2>
            <p className="payment-confirmation-intro">
              Review the tenant's receipt below. Confirm only if the transfer has reached your wallet. This will record the payment as received
              {paymentToConfirm.record_type === "initial" ? " and activate the rental." : "."}
            </p>
            <div className="payment-confirmation-summary">
              <strong>{paymentToConfirm.tenant_name}</strong>
              <span>{paymentToConfirm.rental_title}{paymentToConfirm.installment_number ? ` · Installment #${paymentToConfirm.installment_number}` : " · First month + deposit"}</span>
              <strong>₱{(Number(paymentToConfirm.amount_centavos) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              <span>Paid via {String(paymentToConfirm.payment_method || "wallet").toUpperCase()}</span>
            </div>
            <img
              className="payment-confirmation-receipt"
              src={`${API_BASE}/owner/payments/${paymentToConfirm.record_id}/receipt?record_type=${paymentToConfirm.record_type}`}
              alt={`Payment receipt from ${paymentToConfirm.tenant_name}`}
            />
            <label className="payment-owner-acknowledgment">
              <input type="checkbox" checked={paymentConfirmationAcknowledged} onChange={(event) => setPaymentConfirmationAcknowledged(event.target.checked)} />
              <span>I reviewed this receipt and confirm that I received this payment from the tenant.</span>
            </label>
            <div className="owner-request-actions payment-confirmation-actions">
              <button type="button" disabled={pending || !paymentConfirmationAcknowledged} onClick={() => settlePayment(paymentToConfirm, "confirm")}>
                {pending ? "Confirming…" : "Yes, confirm payment received"}
              </button>
              <button type="button" disabled={pending} onClick={() => {
                setPaymentToConfirm(null);
                setPaymentConfirmationAcknowledged(false);
              }}>Cancel</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

const adminScreens = [
  { id: "dashboard", label: "Admin Dashboard", icon: "dashboard" },
  { id: "map", label: "Property Locations", icon: "map" },
  { id: "users", label: "Manage Users & Roles", icon: "profile" },
  { id: "listings", label: "Review Property Listings", icon: "listings" },
  { id: "reservations", label: "Monitor Reservations", icon: "reservations" },
  { id: "reviews", label: "Moderate Reviews", icon: "reviews" },
  { id: "support", label: "Support Ticket Management", icon: "support" },
  { id: "announcements", label: "System Announcements", icon: "announcements" },
  { id: "analytics", label: "Platform Analytics", icon: "analytics" },
  { id: "sales", label: "Sales & Forecast", icon: "analytics" },
  { id: "reports", label: "Reports & System Settings", icon: "settings" },
];

function SalesForecastPanel({ sales, formatMoney, scopeLabel }) {
  const monthly = sales?.monthly_income || sales?.monthly || sales?.monthly_payments || [];
  const actual = monthly.slice(0, -1).slice(-6);
  const forecast = sales?.forecast?.projected_months || [];
  const chartItems = [
    ...actual.map((item) => ({ ...item, kind: "actual" })),
    ...forecast.map((item) => ({ ...item, transactions: null, kind: "forecast" })),
  ];
  const hasHistory = Number(sales?.transactions ?? sales?.paid_transactions ?? 0) > 0;
  const signalLabel = sales?.forecast?.signal === "more_history" ? "More history" : "Limited history";

  return (
    <section className="sales-forecast-panel">
      <div className="sales-forecast-heading">
        <div><p className="eyebrow">{scopeLabel}</p><h2>Three-month sales forecast</h2></div>
        <span className={`forecast-signal${sales?.forecast?.signal === "more_history" ? " forecast-signal-ready" : ""}`}>{signalLabel}</span>
      </div>
      <p className="sales-forecast-note">Estimates use a linear trend from the last six completed months of confirmed payments. They are directional only, not guaranteed income.</p>
      {hasHistory ? (
        <LineChart
          className="sales-forecast-line-chart"
          ariaLabel="Confirmed monthly sales followed by three projected months"
          labels={chartItems.map((item) => item.month)}
          formatValue={formatMoney}
          datasets={[
            {
              label: "Confirmed sales",
              data: chartItems.map((item) => item.kind === "actual" ? Number(item.amount_centavos || 0) : null),
              borderColor: "#159c96",
              backgroundColor: "rgba(21, 156, 150, 0.12)",
              pointBackgroundColor: "#159c96",
              pointRadius: 3,
              tension: 0.3,
            },
            {
              label: "Forecast",
              data: chartItems.map((item, index) => {
                if (item.kind === "forecast") return Number(item.amount_centavos || 0);
                return index === actual.length - 1 ? Number(item.amount_centavos || 0) : null;
              }),
              borderColor: "#75bcb4",
              backgroundColor: "rgba(117, 188, 180, 0.08)",
              borderDash: [6, 5],
              pointBackgroundColor: "#75bcb4",
              pointRadius: 3,
              tension: 0.3,
            },
          ]}
        />
      ) : (
        <p className="sales-forecast-empty">No confirmed sales yet. Forecasts will become more useful as paid rental income is recorded.</p>
      )}
      {forecast.length > 0 && (
        <div className="sales-forecast-summary">
          <strong>Projected next three months</strong>
          <span>{formatMoney(forecast.reduce((sum, item) => sum + Number(item.amount_centavos || 0), 0))}</span>
        </div>
      )}
    </section>
  );
}

function AdminToolsScreen({ screen }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const endpointByScreen = {
    reservations: ["admin/reservations", "reservations"],
    reviews: ["admin/reviews", "reviews"],
    support: ["admin/support-tickets", "tickets"],
    announcements: ["admin/announcements", "announcements"],
    analytics: ["admin/analytics", "analytics"],
    sales: ["admin/sales-analytics", "sales"],
    reports: ["admin/reports", "reports"],
  };
  const [endpoint, field] = endpointByScreen[screen] || endpointByScreen.reports;

  const load = useCallback(async () => {
    if (screen === "reports") {
      const [reportResult, settingsResult] = await Promise.all([
        apiRequest("admin/reports", undefined, "GET"),
        apiRequest("admin/settings", undefined, "GET"),
      ]);
      setData({ ...reportResult.reports, settings: settingsResult.settings });
      return;
    }
    const result = await apiRequest(endpoint, undefined, "GET");
    setData(screen === "reviews"
      ? { reviews: result.reviews, top_rentals: result.top_rentals || [] }
      : result[field]);
  }, [endpoint, field, screen]);

  useEffect(() => {
    let active = true;
    load().catch((loadError) => {
      if (active) setError(loadError.message);
    });
    return () => { active = false; };
  }, [load]);

  async function perform(path, payload, method = "POST") {
    setPending(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest(path, payload, method);
      setNotice(result.message || "Changes saved.");
      await load();
      return result;
    } catch (actionError) {
      setError(actionError.message);
      return null;
    } finally {
      setPending(false);
    }
  }

  async function submitForm(event, path, { closeAnnouncement = false } = {}) {
    event.preventDefault();
    const form = event.currentTarget;
    const result = await perform(path, Object.fromEntries(new FormData(form).entries()));
    if (result && closeAnnouncement) setEditingAnnouncement(null);
    if (result) form.reset();
  }

  function downloadCsv(filename, rows) {
    if (!rows.length) {
      setError("There is no report data to export yet.");
      return;
    }
    const csv = rows.map((row) => row.map((value) => {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    }).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`${filename} export started.`);
  }

  const headings = {
    reservations: ["Reservations", "Review rental requests, property details, and recorded move-in payments."],
    reviews: ["Tenant reviews & rental rankings", "Review tenant feedback and compare the highest-rated rentals across the platform."],
    support: ["Support tickets", "Reply to tenant and owner requests and set status and priority."],
    announcements: ["System announcements", "Create updates for all users, tenants, or property owners."],
    analytics: ["Platform analytics", "Current account, property, rental, and payment activity."],
    sales: ["Platform sales & forecast", "Review confirmed rent income across all owners and see a short-term sales projection."],
    reports: ["Reports & system settings", "Export rental and payment data or update platform settings."],
  };
  const [title, description] = headings[screen] || headings.reports;
  const heading = (
    <div className="admin-page-heading">
      <div><p className="eyebrow">RENTEASE / WORKSPACE</p><h1>{title}</h1><p>{description}</p></div>
    </div>
  );
  const formatMoney = (centavos) => `₱${(Number(centavos || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (screen === "reservations") {
    return <>{heading}{error && <p className="dashboard-empty" role="alert">{error}</p>}{notice && <p className="payment-return-notice" role="status">{notice}</p>}
      <section className="admin-panel admin-table-panel"><AdminTable headers={["Rental", "Tenant", "Owner", "Move-in", "Term", "Status", "Initial payment", "Actions"]} rows={(data || []).map((item) => [
        <strong>{item.rental_title}</strong>,
        <>{item.tenant_name}<small>{item.tenant_email}</small></>,
        <>{item.owner_name}<small>{item.owner_email}</small></>,
        formatDate(item.move_in),
        `${item.term_months} months`,
        <span className={`status-tag status-${item.status}`}>{item.status.replace("_", " ")}</span>,
        <>{item.initial_payment_status}{item.initial_payment_centavos ? <small>{formatMoney(item.initial_payment_centavos)}</small> : null}</>,
        item.status === "pending" ? <div className="admin-inline-actions"><button disabled={pending} onClick={() => perform(`admin/reservations/${item.id}/review`, { decision: "approve" })}>Approve</button><button className="muted" disabled={pending} onClick={() => perform(`admin/reservations/${item.id}/review`, { decision: "decline" })}>Decline</button></div> : "—",
      ])} empty="No rental reservations have been submitted." /></section>
    </>;
  }

  if (screen === "reviews") {
    const reviews = data?.reviews || [];
    const topRentals = data?.top_rentals || [];
    return <>{heading}{error && <p className="dashboard-empty" role="alert">{error}</p>}{notice && <p className="payment-return-notice" role="status">{notice}</p>}
      <section className="admin-panel admin-rating-leaderboard">
        <div className="admin-panel-heading"><div><p className="eyebrow">TENANT-APPROVED FEEDBACK</p><h2>Best-rated rentals across RentEase</h2></div><span>Ranked by average rating, then review count</span></div>
        {topRentals.length ? <div className="admin-rating-grid">{topRentals.slice(0, 3).map((rental, index) => (
          <article className={`admin-rating-card ${index === 0 ? "top-rated" : ""}`} key={rental.rental_id}>
            <span>{index === 0 ? "PLATFORM LEADER" : `RANK #${index + 1}`}</span>
            <strong>{rental.rental_title}</strong>
            <small>Owner · {rental.owner_name}</small>
            <b>★ {Number(rental.average_rating).toFixed(2)} <small>/ 5</small></b>
            <small>{rental.review_count} approved review{rental.review_count === 1 ? "" : "s"}</small>
          </article>
        ))}</div> : <p className="dashboard-empty">The platform leaderboard will appear after tenant reviews are approved.</p>}
      </section>
      <div className="admin-review-list">{reviews.map((review) => <article className="admin-review-card" key={review.id}>
        <div className="admin-review-card-heading"><div><span className="admin-review-stars" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(Number(review.rating))}{"☆".repeat(5 - Number(review.rating))}</span><strong>{review.rental_title}</strong><small>Owner · {review.owner_name}</small></div><span className={`status-tag status-${review.status}`}>{review.status}</span></div>
        <p>{review.body}</p>
        <div className="admin-review-meta"><span>{review.tenant_name} · {review.tenant_email}</span><span>{review.rating}/5 · {formatDate(review.created_at)}</span></div>
        <form className="admin-record-controls" onSubmit={(event) => submitForm(event, `admin/reviews/${review.id}/moderate`)}>
          <label>Status<select name="status" defaultValue={review.status}><option value="approved">Approved</option><option value="hidden">Hidden</option><option value="rejected">Rejected</option></select></label>
          <label>Moderation note<input name="moderation_note" maxLength={500} defaultValue={review.moderation_note || ""} placeholder="Optional internal note" /></label>
          <button disabled={pending}>Save review status</button>
        </form>
      </article>)}{data && !reviews.length && <p className="dashboard-empty">No tenant reviews have been submitted yet.</p>}</div>
    </>;
  }

  if (screen === "support") {
    return <>{heading}{error && <p className="dashboard-empty" role="alert">{error}</p>}{notice && <p className="payment-return-notice" role="status">{notice}</p>}
      <div className="admin-record-list">{(data || []).map((ticket) => <article className="admin-record" key={ticket.id}>
        <div className="admin-record-heading"><div><strong>{ticket.subject}</strong><span>{ticket.user_name} · {ticket.user_email} · {ticket.account_type}</span></div><span className={`status-tag status-${ticket.status}`}>{ticket.status.replace("_", " ")}</span></div>
        <p>{ticket.message}</p><small>Opened {formatDate(ticket.created_at)} · Current priority: {ticket.priority}</small>
        <form className="admin-record-controls" onSubmit={(event) => submitForm(event, `admin/support-tickets/${ticket.id}/update`)}>
          <label>Status<select name="status" defaultValue={ticket.status}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label>
          <label>Priority<select name="priority" defaultValue={ticket.priority}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>
          <label className="field-wide">Reply<textarea name="admin_reply" maxLength={5000} rows={3} defaultValue={ticket.admin_reply || ""} placeholder="Reply visible to the account holder" /></label>
          <button disabled={pending}>Update ticket</button>
        </form>
      </article>)}{data && !data.length && <p className="dashboard-empty">There are no support tickets.</p>}</div>
    </>;
  }

  if (screen === "announcements") {
    const selected = editingAnnouncement;
    return <>{heading}{error && <p className="dashboard-empty" role="alert">{error}</p>}{notice && <p className="payment-return-notice" role="status">{notice}</p>}
      <section className="admin-panel admin-announcement-editor">
        <div className="admin-panel-heading"><h2>{selected ? "Edit announcement" : "Create announcement"}</h2>{selected && <button className="admin-text-action" onClick={() => setEditingAnnouncement(null)}>Cancel edit</button>}</div>
        <form className="admin-record-controls" key={selected?.id || "new"} onSubmit={(event) => submitForm(event, selected ? `admin/announcements/${selected.id}/update` : "admin/announcements", { closeAnnouncement: true })}>
          <label>Title<input name="title" required minLength={4} maxLength={160} defaultValue={selected?.title || ""} /></label>
          <label>Audience<select name="audience" defaultValue={selected?.audience || "all"}><option value="all">Everyone</option><option value="tenant">Tenants</option><option value="owner">Property owners</option></select></label>
          <label>Status<select name="status" defaultValue={selected?.status || "draft"}><option value="draft">Draft</option><option value="published">Publish now</option></select></label>
          <label className="field-wide">Message<textarea name="body" required minLength={10} maxLength={10000} rows={4} defaultValue={selected?.body || ""} /></label>
          <button disabled={pending}>{pending ? "Saving…" : selected ? "Save announcement" : "Create announcement"}</button>
        </form>
      </section>
      <section className="admin-panel admin-table-panel"><AdminTable headers={["Title", "Audience", "Status", "Publish date", "Actions"]} rows={(data || []).map((announcement) => [
        announcement.title, announcement.audience, <span className={`status-tag status-${announcement.status}`}>{announcement.status}</span>, formatDate(announcement.publish_at),
        <div className="admin-inline-actions"><button onClick={() => setEditingAnnouncement(announcement)}>Edit</button><button className="muted" disabled={pending} onClick={() => window.confirm("Delete this announcement?") && perform(`admin/announcements/${announcement.id}/delete`, {})}>Delete</button></div>,
      ])} empty="No announcements have been created." /></section>
    </>;
  }

  if (screen === "analytics") {
    const analytics = data;
    const cards = [
      ["Accounts", analytics?.users], ["Tenants", analytics?.tenants], ["Owners", analytics?.owners],
      ["Published listings", analytics?.published_listings], ["Rented listings", analytics?.rented_listings],
      ["Requests awaiting payment", analytics?.requests_awaiting_payment], ["Confirmed payments", formatMoney(analytics?.paid_total_centavos)],
    ];
    return <>{heading}{error && <p className="dashboard-empty" role="alert">{error}</p>}
      <div className="admin-stat-grid">{cards.map(([label, value]) => <article className="admin-stat" key={label}><span>{label}</span><strong>{value ?? "—"}</strong></article>)}</div>
      <SalesForecastPanel sales={analytics} formatMoney={formatMoney} scopeLabel="ALL RENT EASE SALES" />
      <section className="admin-panel admin-table-panel"><div className="admin-panel-heading"><h2>Monthly payments</h2><span>{analytics?.monthly_payments?.length || 0} months</span></div><AdminTable headers={["Month", "Transactions", "Amount"]} rows={(analytics?.monthly_payments || []).map((item) => [item.month, item.transactions, formatMoney(item.amount_centavos)])} empty="Payment totals appear here when confirmed payments are recorded." /></section>
      <section className="admin-panel admin-table-panel admin-owner-payments-table"><div className="admin-panel-heading"><div><p className="eyebrow">OWNER PERFORMANCE</p><h2>Confirmed payments by owner</h2></div><span>{analytics?.owner_payments?.length || 0} owners</span></div><AdminTable headers={["Owner", "Email", "Transactions", "Confirmed income"]} rows={(analytics?.owner_payments || []).map((owner) => [owner.owner_name, owner.email, owner.transactions, formatMoney(owner.amount_centavos)])} empty="No owner accounts are registered yet." /></section>
    </>;
  }

  if (screen === "sales") {
    const sales = data;
    return <>{heading}{error && <p className="dashboard-empty" role="alert">{error}</p>}
      <div className="admin-stat-grid">
        <article className="admin-stat"><span>All-time confirmed sales</span><strong>{formatMoney(sales?.total_centavos)}</strong></article>
        <article className="admin-stat"><span>Confirmed payments</span><strong>{sales?.transactions ?? "—"}</strong></article>
        <article className="admin-stat"><span>Owners with accounts</span><strong>{sales?.owner_payments?.length ?? "—"}</strong></article>
      </div>
      <SalesForecastPanel sales={sales} formatMoney={formatMoney} scopeLabel="PLATFORM-WIDE CONFIRMED SALES" />
      <section className="admin-panel admin-table-panel admin-owner-payments-table"><div className="admin-panel-heading"><div><p className="eyebrow">OWNER PERFORMANCE</p><h2>Confirmed sales by owner</h2></div><span>{sales?.owner_payments?.length || 0} owners</span></div><AdminTable headers={["Owner", "Email", "Transactions", "Confirmed sales"]} rows={(sales?.owner_payments || []).map((owner) => [owner.owner_name, owner.email, owner.transactions, formatMoney(owner.amount_centavos)])} empty="No owner accounts are registered yet." /></section>
    </>;
  }

  const settings = data?.settings || {};
  const reportData = data || {};
  return <>{heading}{error && <p className="dashboard-empty" role="alert">{error}</p>}{notice && <p className="payment-return-notice" role="status">{notice}</p>}
    <div className="admin-reports-grid">
      <section className="admin-panel"><div className="admin-panel-heading"><h2>Data exports</h2></div><p>Download the latest bounded report data (up to 500 records per report).</p>
        <div className="admin-inline-actions"><button disabled={!reportData.payments?.length} onClick={() => downloadCsv("rentease-payments.csv", [["ID", "Rental request", "Amount (centavos)", "Status", "Paid at"], ...(reportData.payments || []).map((payment) => [payment.id, payment.rental_request_id, payment.amount_centavos, payment.status, payment.paid_at])])}>Export payments CSV</button><button className="muted" disabled={!reportData.reservations?.length} onClick={() => downloadCsv("rentease-reservations.csv", [["ID", "Rental", "Tenant", "Owner", "Status", "Created at"], ...(reportData.reservations || []).map((request) => [request.id, request.rental_id, request.tenant_id, request.owner_id, request.status, request.created_at])])}>Export reservations CSV</button></div>
      </section>
      <section className="admin-panel"><div className="admin-panel-heading"><h2>Platform settings</h2></div>
        <form className="admin-record-controls" onSubmit={(event) => submitForm(event, "admin/settings")}>
          <label>Platform name<input name="platform_name" minLength={2} maxLength={100} required defaultValue={settings.platform_name || ""} /></label>
          <label>Support email<input name="support_email" type="email" maxLength={255} defaultValue={settings.support_email || ""} /></label>
          <label>Support phone<input name="support_phone" maxLength={30} defaultValue={settings.support_phone || ""} /></label>
          <label>Rent due day<input name="rent_due_day" type="number" min={1} max={28} required defaultValue={settings.rent_due_day || "1"} /></label>
          <label className="field-wide">Rental terms<textarea name="terms_text" minLength={10} maxLength={5000} rows={4} required defaultValue={settings.terms_text || ""} /></label>
          <button disabled={pending}>{pending ? "Saving…" : "Save settings"}</button>
        </form>
      </section>
    </div>
  </>;
}

function AdminAccountForm({ account, pending, onCancel, onSubmit }) {
  async function submit(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const payload = Object.fromEntries(fields.entries());
    payload.is_active = fields.get("is_active") === "true";
    await onSubmit(payload);
  }

  return (
    <div className="admin-modal-backdrop" role="presentation">
      <section className="admin-edit-modal" role="dialog" aria-modal="true" aria-labelledby="admin-account-title">
        <button type="button" className="request-dialog-close" aria-label="Close account form" onClick={onCancel}>×</button>
        <p className="eyebrow">ACCOUNT MANAGEMENT</p>
        <h2 id="admin-account-title">{account ? "Update account" : "Add tenant or owner"}</h2>
        <form className="admin-edit-form" onSubmit={submit}>
          <label>Full name<input name="full_name" minLength={2} maxLength={100} defaultValue={account?.full_name || ""} required /></label>
          <label>Email address<input name="email" type="email" maxLength={255} defaultValue={account?.email || ""} required /></label>
          <label>Mobile number<input name="phone" type="tel" maxLength={30} defaultValue={account?.phone || ""} /></label>
          <label>Account type<select name="account_type" defaultValue={account?.account_type || "tenant"}><option value="tenant">Tenant</option><option value="owner">Property owner</option></select></label>
          {account && <label>Account status<select name="is_active" defaultValue={account.is_active ? "true" : "false"}><option value="true">Active</option><option value="false">Inactive</option></select></label>}
          <label className="field-wide">{account ? "New password (leave blank to keep current)" : "Temporary password"}
            <input name="password" type="password" minLength={account ? undefined : 8} maxLength={72} autoComplete="new-password" required={!account} />
          </label>
          <div className="admin-edit-actions">
            <button type="button" className="button button-secondary" onClick={onCancel} disabled={pending}>Cancel</button>
            <button type="submit" className="admin-primary-action" disabled={pending}>{pending ? "Saving…" : account ? "Save changes" : "Create account"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AdminListingForm({ listing, owners, pending, onCancel, onSubmit }) {
  async function submit(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    fields.set("utilities_included", fields.get("utilities_included") === "true" ? "true" : "false");
    fields.set("is_featured", fields.get("is_featured") === "true" ? "true" : "false");
    await onSubmit(fields);
  }
  const today = localDateInputValue();

  return (
    <div className="admin-modal-backdrop" role="presentation">
      <section className="admin-edit-modal admin-listing-modal" role="dialog" aria-modal="true" aria-labelledby="admin-listing-title">
        <button type="button" className="request-dialog-close" aria-label="Close listing form" onClick={onCancel}>×</button>
        <p className="eyebrow">PROPERTY MANAGEMENT</p>
        <h2 id="admin-listing-title">{listing ? "Update property listing" : "Add property listing"}</h2>
        <form className="admin-edit-form admin-listing-form" encType="multipart/form-data" onSubmit={submit}>
          <label>Property owner<select name="owner_id" defaultValue={listing?.owner_id || owners[0]?.id || ""} required>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.full_name} · {owner.email}</option>)}</select></label>
          <label>Listing status<select name="status" defaultValue={listing?.status || "published"}><option value="pending">Pending review</option><option value="published">Published</option><option value="rented">Rented</option><option value="rejected">Rejected</option></select></label>
          <label>Listing title<input name="title" minLength={4} maxLength={120} defaultValue={listing?.title || ""} required /></label>
          <label>Space type<select name="property_type" defaultValue={listing?.property_type || "room"}><option value="bedspacer">Bedspacer</option><option value="room">Room</option><option value="apartment">Apartment</option></select></label>
          <label>Monthly rent (₱)<input name="price" type="number" min="1" max="99999999.99" step="0.01" defaultValue={listing?.price || ""} required /></label>
          <label>City / neighborhood<input name="location" minLength={3} maxLength={180} defaultValue={listing?.location || ""} required /></label>
          <label>Street address<input name="address" minLength={5} maxLength={180} defaultValue={listing?.address || ""} required /></label>
          <label>Unit / building<input name="unit_number" maxLength={40} defaultValue={listing?.unit_number || ""} /></label>
          <div className="field-wide"><PropertyLocationPicker key={listing?.id || "new"} latitude={listing?.latitude} longitude={listing?.longitude} /></div>
          <label>Number of rooms<input name="rooms_count" type="number" min="0" max="50" defaultValue={listing?.rooms_count ?? listing?.bedrooms ?? 1} required /></label>
          <label>Number of beds (bedspacer)<input name="bed_count" type="number" min="0" max="500" defaultValue={listing?.bed_count ?? 0} required /></label>
          <label>Bathrooms<input name="bathrooms" type="number" min="0" max="50" defaultValue={listing?.bathrooms ?? 1} required /></label>
          <label>Maximum occupants<input name="max_occupants" type="number" min="1" max="500" defaultValue={listing?.max_occupants ?? 1} required /></label>
          <label>Floor area (m²)<input name="floor_area" type="number" min="1" max="99999" step="0.01" defaultValue={listing?.floor_area || ""} /></label>
          <label>Furnishing<select name="furnishing" defaultValue={listing?.furnishing || "unfurnished"}><option value="unfurnished">Unfurnished</option><option value="semi_furnished">Semi-furnished</option><option value="fully_furnished">Fully furnished</option></select></label>
          <label>Available from<input name="available_from" type="date" defaultValue={listing?.available_from || today} required /></label>
          <label>Security deposit (₱)<input name="security_deposit" type="number" min="0" max="99999999.99" step="0.01" defaultValue={listing?.security_deposit || 0} required /></label>
          <label>Contact phone<input name="contact_phone" type="tel" maxLength={30} defaultValue={listing?.contact_phone || ""} required /></label>
          <PropertyPhotoField id="admin-listing-photo" className="field-wide" required={!listing} currentPhoto={listing ? propertyPhotoSource(listing) : ""} />
          <label>Amenities<input name="amenities" maxLength={1000} defaultValue={listing?.amenities || ""} /></label>
          <label>Utilities included<select name="utilities_included" defaultValue={Number(listing?.utilities_included) ? "true" : "false"}><option value="false">No</option><option value="true">Yes</option></select></label>
          <label>Featured<select name="is_featured" defaultValue={Number(listing?.is_featured) ? "true" : "false"}><option value="false">No</option><option value="true">Yes</option></select></label>
          <label className="field-wide">Description<textarea name="description" minLength={20} maxLength={5000} rows={4} defaultValue={listing?.description || ""} required /></label>
          <div className="admin-edit-actions field-wide">
            <button type="button" className="button button-secondary" onClick={onCancel} disabled={pending}>Cancel</button>
            <button type="submit" className="admin-primary-action" disabled={pending || owners.length === 0}>{pending ? "Saving…" : listing ? "Save changes" : "Create listing"}</button>
          </div>
        </form>
        {owners.length === 0 && <p className="rental-request-error">Create a property owner account before adding a listing.</p>}
      </section>
    </div>
  );
}

function AdminWorkspace({ user, onLogout, pending: logoutPending, route }) {
  const routeScreen = route.startsWith("admin/") ? route.split("/")[1] : "dashboard";
  const [activeScreen, setActiveScreen] = useState(routeScreen);
  const [overview, setOverview] = useState(null);
  const [paymentAnalytics, setPaymentAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [owners, setOwners] = useState([]);
  const [listings, setListings] = useState([]);
  const [propertyLocations, setPropertyLocations] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [message, setMessage] = useState("");
  const [pendingId, setPendingId] = useState(null);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [listingFilter, setListingFilter] = useState("all");
  const [listingType, setListingType] = useState("all");
  const [editingAccount, setEditingAccount] = useState(null);
  const [editingListing, setEditingListing] = useState(null);
  const [formPending, setFormPending] = useState(false);

  useEffect(() => {
    setActiveScreen(routeScreen);
  }, [routeScreen]);

  function navigateAdmin(screen) {
    setActiveScreen(screen);
    if (window.location.hash !== `#admin/${screen}`) {
      window.location.hash = `admin/${screen}`;
    }
  }

  useEffect(() => {
    document.querySelector(".admin-screen")?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeScreen]);

  const refresh = useCallback(async () => {
    const [overviewResult, usersResult, ownerResult, listingResult, analyticsResult, locationsResult, reservationsResult] = await Promise.all([
      apiRequest("admin/overview", undefined, "GET"),
      apiRequest("admin/users", undefined, "GET"),
      apiRequest("admin/owners", undefined, "GET"),
      apiRequest("admin/listings", undefined, "GET"),
      apiRequest("admin/analytics", undefined, "GET"),
      apiRequest("admin/property-locations", undefined, "GET"),
      apiRequest("admin/reservations", undefined, "GET"),
    ]);
    setOverview(overviewResult.overview);
    setUsers(usersResult.users);
    setOwners(ownerResult.owners);
    setListings(listingResult.listings);
    setPropertyLocations(locationsResult.locations || []);
    setReservations(reservationsResult.reservations || []);
    setPaymentAnalytics(analyticsResult.analytics);
  }, []);

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
  }, [refresh]);

  async function reviewOwner(id, decision) {
    setPendingId(id);
    setMessage("");
    try {
      const result = await apiRequest(`admin/owners/${id}/review`, { decision });
      setMessage(result.message);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setPendingId(null);
    }
  }

  async function reviewListing(id, decision) {
    await changeListing(id, () => apiRequest(`admin/listings/${id}/review`, { decision }));
  }

  async function featureListing(id, featured) {
    await changeListing(id, () => apiRequest(`admin/listings/${id}/featured`, { featured }));
  }

  async function changeListing(id, operation) {
    setPendingId(id);
    setMessage("");
    try {
      const result = await operation();
      setMessage(result.message);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setPendingId(null);
    }
  }

  async function saveAccount(payload) {
    setFormPending(true);
    try {
      const isEditing = Boolean(editingAccount?.id);
      const result = await apiRequest(isEditing ? `admin/users/${editingAccount.id}/update` : "admin/users", payload);
      setMessage(result.message);
      setEditingAccount(null);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setFormPending(false);
    }
  }

  async function deleteAccount(account) {
    if (!window.confirm(`Delete ${account.full_name} and associated rentals/requests? This cannot be undone.`)) return;
    setPendingId(account.id);
    try {
      const result = await apiRequest(`admin/users/${account.id}/delete`, {});
      setMessage(result.message);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setPendingId(null);
    }
  }

  async function saveListing(payload) {
    setFormPending(true);
    try {
      const isEditing = Boolean(editingListing?.id);
      const result = await apiUpload(isEditing ? `admin/listings/${editingListing.id}/update` : "admin/listings", payload);
      setMessage(result.message);
      setEditingListing(null);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setFormPending(false);
    }
  }

  async function deleteListing(listing) {
    if (!window.confirm(`Delete “${listing.title}” and its rental requests? This cannot be undone.`)) return;
    setPendingId(listing.id);
    try {
      const result = await apiRequest(`admin/listings/${listing.id}/delete`, {});
      setMessage(result.message);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setPendingId(null);
    }
  }

  const activeLabel = adminScreens.find((item) => item.id === activeScreen)?.label || "Admin Dashboard";
  const pendingListings = listings.filter((listing) => listing.status === "pending");
  const visibleUsers = users.filter((account) => {
    const matchesSearch = `${account.full_name} ${account.email}`.toLowerCase().includes(search.toLowerCase());
    const matchesType = ownerFilter === "all" || account.account_type === ownerFilter;
    return matchesSearch && matchesType;
  });
  const visibleListings = listings.filter((listing) => listingFilter === "all" || listing.status === listingFilter);
  function renderDashboard() {
    const cards = [
      { label: "Registered users", value: overview?.users ?? "—", note: "All accounts" },
      { label: "Active listings", value: overview?.listings_published ?? "—", note: `${overview?.listings_pending ?? 0} awaiting review` },
      { label: "Rental requests", value: overview?.rental_requests ?? "—", note: `${overview?.requests_pending ?? 0} awaiting owner response` },
      { label: "Open tickets", value: overview?.tickets_open ?? "—", note: "Customer requests needing support" },
      { label: "Confirmed rent income", value: formatCurrency(paymentAnalytics?.paid_total_centavos), note: "Across all confirmed owner payments" },
    ];
    const ownerPaymentRows = paymentAnalytics?.owner_payments || [];
    const monthlyPayments = paymentAnalytics?.monthly_payments || [];
    return (
      <>
        <div className="admin-page-heading">
          <div><p className="eyebrow">RENTEASE / WORKSPACE</p><h1>Platform overview</h1><p>Review activity and keep RentEase running smoothly.</p></div>
          <div className="admin-heading-actions"><button className="admin-primary-action" onClick={() => navigateAdmin("listings")}>+ Review listings</button><button type="button" className="admin-primary-action admin-outline-action" onClick={() => navigateAdmin("map")}>View property map</button></div>
        </div>
        <div className="admin-stat-grid">
          {cards.map((card) => <article className="admin-stat" key={card.label}><span>{card.label}</span><strong>{card.value}</strong><small>{card.note}</small></article>)}
        </div>
        <section className="admin-panel property-locations-panel">
          <div className="admin-panel-heading"><div><p className="eyebrow">PROPERTY LOCATIONS</p><h2>Where properties are located</h2></div><button type="button" onClick={() => navigateAdmin("map")}>Open full property map →</button></div>
          {listings.length || propertyLocations.length ? <PropertyLocations listings={propertyLocations} emptyMessage="No property locations have been pinned yet." /> : <p className="dashboard-empty">Loading property locations…</p>}
        </section>
        <div className="admin-overview-grid">
          <section className="admin-panel">
            <div className="admin-panel-heading"><h2>Monthly confirmed rent income</h2><span>Last 6 months</span></div>
            {monthlyPayments.length ? <LineChart
              className="admin-monthly-line-chart"
              ariaLabel="Monthly confirmed rent income"
              labels={monthlyPayments.slice(-6).map((item) => item.month)}
              formatValue={formatCurrency}
              datasets={[{
                label: "Confirmed rent income",
                data: monthlyPayments.slice(-6).map((item) => Number(item.amount_centavos || 0)),
                borderColor: "#159c96",
                backgroundColor: "rgba(21, 156, 150, 0.12)",
                pointBackgroundColor: "#159c96",
                pointRadius: 3,
                tension: 0.3,
                fill: true,
              }]}
            /> : <p className="dashboard-empty">Monthly payments will appear here as payments are confirmed.</p>}
          </section>
          <section className="admin-panel">
            <div className="admin-panel-heading"><h2>Tasks requiring review</h2><span>{owners.length + pendingListings.length} pending</span></div>
            {owners.length + pendingListings.length ? (
              <div className="admin-task-list">
                {owners.slice(0, 3).map((owner) => <button key={`owner-${owner.id}`} onClick={() => navigateAdmin("users")}><span>{owner.full_name}</span><small>Owner verification</small><b className="status-tag status-pending">Pending</b></button>)}
                {pendingListings.slice(0, 3).map((listing) => <button key={`listing-${listing.id}`} onClick={() => navigateAdmin("listings")}><span>{listing.title}</span><small>Property listing</small><b className="status-tag status-pending">Pending</b></button>)}
              </div>
            ) : <div className="admin-empty-inline">No owner or listing reviews are waiting.</div>}
          </section>
        </div>
        <section className="admin-panel admin-recent">
          <div className="admin-panel-heading"><h2>Recent accounts</h2><button onClick={() => navigateAdmin("users")}>View all →</button></div>
          <AdminTable
            headers={["User", "Account type", "Joined", "Status"]}
            rows={users.slice(0, 5).map((account) => [
              <span className="admin-user-cell" key="user"><strong>{account.full_name}</strong><small>{account.email}</small></span>,
              account.role === "admin" ? "Administrator" : account.account_type === "owner" ? "Property owner" : "Tenant",
              formatDate(account.created_at),
              <span key="status" className={`status-tag ${account.owner_status === "pending" ? "status-pending" : "status-approved"}`}>{account.account_type === "owner" ? account.owner_status : "Active"}</span>,
            ])}
            empty="No accounts yet."
          />
        </section>
        <section className="admin-panel admin-payment-overview">
          <div className="admin-panel-heading"><div><p className="eyebrow">PAYMENT ANALYTICS</p><h2>Confirmed rent income by owner</h2></div><button onClick={() => navigateAdmin("sales")}>Full analytics →</button></div>
          <div className="admin-payment-analytics-grid">
            <div className="admin-payment-owner-list">
              {ownerPaymentRows.length ? ownerPaymentRows.slice(0, 8).map((owner, index) => (
                <article className="admin-payment-owner-row" key={owner.owner_id}>
                  <span className="admin-payment-rank">{index + 1}</span>
                  <div><strong>{owner.owner_name}</strong><small>{owner.email} · {owner.transactions} confirmed payment{Number(owner.transactions) === 1 ? "" : "s"}</small></div>
                  <b>{formatCurrency(owner.amount_centavos)}</b>
                </article>
              )) : <p className="dashboard-empty">No confirmed rent payments have been recorded yet.</p>}
            </div>
          </div>
        </section>
        <SalesForecastPanel sales={paymentAnalytics} formatMoney={formatCurrency} scopeLabel="ALL OWNERS · PLATFORM TOTAL" />
      </>
    );
  }

  function renderUsers() {
    return (
      <>
        <div className="admin-page-heading">
          <div><p className="eyebrow">RENTEASE / WORKSPACE</p><h1>Manage users & roles</h1><p>Review user accounts, access levels, and owner verification status.</p></div>
          <div className="admin-heading-actions"><span className="admin-result-count">{visibleUsers.length} accounts</span><button className="admin-primary-action" onClick={() => setEditingAccount({})}>+ Add account</button></div>
        </div>
        <div className="admin-toolbar">
          <input aria-label="Search users" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people or email..." />
          <select aria-label="Filter account type" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}><option value="all">All account types</option><option value="tenant">Tenants</option><option value="owner">Property owners</option></select>
        </div>
        <section className="admin-panel admin-table-panel">
          <AdminTable
            headers={["User / Owner", "Type", "Joined", "Status", "Action"]}
            rows={visibleUsers.map((account) => [
              <span className="admin-user-cell" key="user">
                <strong>{account.full_name}</strong><small>{account.email}</small>
                {account.account_type === "owner" && (() => {
                  const ownerReview = owners.find((owner) => String(owner.id) === String(account.id));
                  if (!ownerReview) return null;
                  const requiredDocuments = [
                    ["government_id", "Government-issued photo ID"],
                    ["ownership_proof", "Property ownership / management proof"],
                  ];
                  const submittedTypes = new Set((ownerReview.documents || []).map((document) => document.document_type));
                  return <span className="admin-owner-documents">
                    <strong>Verification requirements</strong>
                    <span className="admin-owner-document-checklist">{requiredDocuments.map(([type, label]) => (
                      <small className={submittedTypes.has(type) ? "submitted" : "missing"} key={type}>
                        {submittedTypes.has(type) ? "✓" : "!"} {label} · {submittedTypes.has(type) ? "PDF attached" : "Missing"}
                      </small>
                    ))}</span>
                    {(ownerReview.documents || []).map((document) => (
                      <a key={document.id} href={`${API_BASE}/admin/owners/${account.id}/documents/${document.id}`} target="_blank" rel="noreferrer">
                        View {({ government_id: "Government ID", ownership_proof: "Ownership proof", authorization_letter: "Authorization letter" })[document.document_type] || "Verification document"} · {document.file_name}
                      </a>
                    ))}
                    {!ownerReview.documents?.length && <small>No PDFs submitted yet.</small>}
                  </span>;
                })()}
              </span>,
              account.role === "admin" ? "Administrator" : account.account_type === "owner" ? "Property owner" : "Tenant",
              formatDate(account.created_at),
              <span key="status" className={`status-tag ${account.account_type === "owner" && account.owner_status === "pending" ? "status-pending" : account.account_type === "owner" && account.owner_status === "rejected" ? "status-rejected" : "status-approved"}`}>{account.account_type === "owner" ? account.owner_status : account.is_active ? "Active" : "Inactive"}</span>,
              account.role === "admin" ? "Primary admin" : (
                <div className="table-actions" key="actions">
                  {account.account_type === "owner" && account.owner_status === "pending" && <>
                    <button className="admin-text-action" title="Required PDF documents must be attached before verification." disabled={pendingId === account.id || !["government_id", "ownership_proof"].every((type) => owners.find((owner) => String(owner.id) === String(account.id))?.documents?.some((document) => document.document_type === type && document.mime_type === "application/pdf"))} onClick={() => reviewOwner(account.id, "approve")}>Verify</button>
                    <button className="admin-text-action muted" disabled={pendingId === account.id} onClick={() => reviewOwner(account.id, "reject")}>Reject</button>
                  </>}
                  <button className="admin-text-action" disabled={pendingId === account.id} onClick={() => setEditingAccount(account)}>Edit</button>
                  <button className="admin-text-action muted" disabled={pendingId === account.id} onClick={() => deleteAccount(account)}>Delete</button>
                </div>
              ),
            ])}
            empty="No accounts match these filters."
          />
        </section>
      </>
    );
  }

  function renderListings() {
    return (
      <>
        <div className="admin-page-heading">
          <div><p className="eyebrow">RENTEASE / WORKSPACE</p><h1>Manage property listings</h1><p>Create, edit, delete, approve, and feature rental listings.</p></div>
          <div className="admin-heading-actions"><span className="admin-result-count">{pendingListings.length} awaiting review</span><button className="admin-primary-action" onClick={() => setEditingListing({})}>+ Add listing</button></div>
        </div>
        <div className="admin-toolbar">
          <div className="admin-filter-tabs" aria-label="Filter listings">
            {[["all", "All spaces"], ["pending", "Pending"], ["published", "Published"], ["rented", "Rented"], ["rejected", "Rejected"]].map(([key, label]) => <button className={listingFilter === key ? "selected" : ""} key={key} onClick={() => setListingFilter(key)}>{label}</button>)}
          </div>
          <select aria-label="Filter property type" value={listingType} onChange={(event) => setListingType(event.target.value)}><option value="all">All rental types</option>{Object.entries(propertyLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        </div>
        <div className="admin-listing-grid">
          {visibleListings.filter((listing) => listingType === "all" || listing.property_type === listingType).map((listing) => (
            <div className="admin-listing-item" key={listing.id}>
              <RentalCard listing={listing} admin onFeature={featureListing} onReview={reviewListing} pendingId={pendingId} />
              <div className="admin-listing-actions"><button className="admin-text-action" disabled={pendingId === listing.id} onClick={() => setEditingListing(listing)}>Edit listing</button><button className="admin-text-action muted" disabled={pendingId === listing.id} onClick={() => deleteListing(listing)}>Delete listing</button></div>
            </div>
          ))}
          {!visibleListings.length && <div className="admin-empty-state">No property listings in this view yet.</div>}
        </div>
      </>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-heading"><span>ADMIN SCREENS</span><span className="admin-role-tag">ADMIN</span></div>
        <nav aria-label="Admin screens">
          {adminScreens.map((item) => (
            <button
              className={activeScreen === item.id ? "active" : ""}
              key={item.id}
              onClick={() => {
                navigateAdmin(item.id);
                if (["dashboard", "users", "listings"].includes(item.id)) {
                  refresh().catch((error) => setMessage(error.message));
                }
              }}
            >
              <NavIcon name={item.icon} />{item.label}
              {item.id === "users" && owners.length > 0 && <b>{owners.length}</b>}
              {item.id === "listings" && pendingListings.length > 0 && <b>{pendingListings.length}</b>}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer"><span>ADMINISTRATOR</span><strong>{user.full_name}</strong><small>{user.email}</small><button onClick={onLogout} disabled={logoutPending}>{logoutPending ? "Signing out…" : "Sign out"}</button></div>
      </aside>
      <section className="admin-content">
        <div className="admin-breadcrumb"><span>Admin</span><span>/</span><strong>{activeLabel}</strong><small>WORKSPACE</small></div>
        <main className="admin-screen">
          {message && <div className="notice" role="status">{message}</div>}
          {!overview ? <div className="admin-loading">Loading your admin workspace…</div> : (
            <>
              {activeScreen === "dashboard" && renderDashboard()}
              {activeScreen === "map" && <section className="admin-property-map-page">
                <div className="admin-page-heading"><div><p className="eyebrow">RENTEASE / WORKSPACE</p><h1>Property locations</h1><p>View all rental properties with saved map pins. Edit a listing to add or move its pin.</p></div></div>
                <section className="admin-panel property-locations-panel">
                  {listings.length || propertyLocations.length ? <PropertyLocations listings={propertyLocations} emptyMessage="No property locations have been pinned yet." /> : <p className="dashboard-empty">Loading property locations…</p>}
                </section>
              </section>}
              {activeScreen === "users" && renderUsers()}
              {activeScreen === "listings" && renderListings()}
              {!["dashboard", "map", "users", "listings"].includes(activeScreen) && <AdminToolsScreen key={activeScreen} screen={activeScreen} />}
            </>
          )}
        </main>
        <footer className="admin-screen-footer"><span>RentEase workspace</span><span>Account data and listing reviews update from your database.</span></footer>
      </section>
      {editingAccount && <AdminAccountForm account={editingAccount.id ? editingAccount : null} pending={formPending} onCancel={() => setEditingAccount(null)} onSubmit={saveAccount} />}
      {editingListing && <AdminListingForm listing={editingListing.id ? editingListing : null} owners={users.filter((account) => account.account_type === "owner" && account.is_active)} pending={formPending} onCancel={() => setEditingListing(null)} onSubmit={saveListing} />}
    </div>
  );
}

function AdminTable({ headers, rows, empty }) {
  return (
    <div className="admin-table-scroll">
      <table className="admin-table">
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td className="admin-table-empty" colSpan={headers.length}>{empty}</td></tr>}</tbody>
      </table>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(centavos) {
  return `₱${(Number(centavos || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function readQrFile(file, existingImage) {
  if (!file || file.size === 0) return Promise.resolve(existingImage || null);
  if (file.size > 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    return Promise.reject(new Error("Choose a PNG, JPG, or WebP QR image under 1 MB."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read the QR image."));
    reader.onerror = () => reject(new Error("Could not read the QR image."));
    reader.readAsDataURL(file);
  });
}

function App() {
  const getScreen = useCallback(() => {
    const screen = window.location.hash.slice(1);
    return ["home", "login", "register", "forgot", "verify", "dashboard", "admin/dashboard", "admin/map", "admin/users", "admin/listings", "admin/reservations", "admin/reviews", "admin/support", "admin/announcements", "admin/analytics", "admin/sales", "admin/reports", "tenant/dashboard", "tenant/browse", "tenant/requests", "tenant/payments", "tenant/updates", "tenant/profile", "owner/dashboard", "owner/listings", "owner/map", "owner/requests", "owner/renters", "owner/sales", "owner/payments", "owner/updates", "owner/profile"].includes(screen) ? screen : "home";
  }, []);
  const [screen, setScreen] = useState(getScreen);
  const [user, setUser] = useState(null);
  const [notice, setNotice] = useState(null);
  const [pending, setPending] = useState(false);

  const showScreen = useCallback((nextScreen) => {
    setScreen(nextScreen);
    setNotice(null);
  }, []);

  const runRequest = useCallback(async (operation) => {
    setPending(true);
    setNotice(null);
    try {
      return await operation();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The request could not be completed.");
      return null;
    } finally {
      setPending(false);
    }
  }, []);

  const signIn = useCallback(async (path, payload) => {
    const result = await runRequest(() => request(path, payload));
    if (!result) return;
    setUser(result.user);
    const workspaceRoute = result.user.role === "admin" ? "admin/dashboard" : `${result.user.account_type}/dashboard`;
    window.location.hash = workspaceRoute;
    showScreen(workspaceRoute);
  }, [runRequest, showScreen]);

  useEffect(() => {
    const onHashChange = () => showScreen(getScreen());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [getScreen, showScreen]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.requestAnimationFrame(() => {
      document.querySelector(".workspace-page, .admin-screen")?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [screen]);

  useEffect(() => {
    let active = true;
    request("me", undefined, "GET")
      .then((result) => {
        if (!active) return;
        setUser(result.user);
        const currentScreen = window.location.hash.slice(1);
        if (result.user.role === "admin") {
          if (currentScreen === "dashboard") {
            setScreen("admin/dashboard");
            window.location.hash = "admin/dashboard";
          } else if (!currentScreen.startsWith("admin/")) {
            setScreen("admin/dashboard");
            window.location.hash = "admin/dashboard";
          }
        } else {
          const role = result.user.account_type === "owner" ? "owner" : "tenant";
          const validRoutes = role === "owner"
            ? ["dashboard", "home", "login", "register", "forgot", "verify", "owner/dashboard", "owner/listings", "owner/map", "owner/requests", "owner/renters", "owner/sales", "owner/payments", "owner/updates", "owner/profile"]
            : ["dashboard", "home", "login", "register", "forgot", "verify", "tenant/dashboard", "tenant/browse", "tenant/requests", "tenant/payments", "tenant/updates", "tenant/profile"];
          const validRoute = validRoutes.includes(currentScreen);
          if (!validRoute) {
            setScreen(`${role}/dashboard`);
            window.location.hash = `${role}/dashboard`;
          } else if (["dashboard", "login", "register", "forgot"].includes(currentScreen)) {
            setScreen(`${role}/dashboard`);
            window.location.hash = `${role}/dashboard`;
          }
        }
      })
      .catch((error) => {
        if (!active || error.message === "You are not signed in.") return;
        if (error.message.startsWith("Can't reach RentEase")) return;
        setNotice(error.message);
      });
    return () => { active = false; };
  }, []);

  async function handleEmailFlow(path, payload) {
    const result = await runRequest(() => request(path, payload));
    if (result && path === "verify" && user) {
      try {
        const current = await request("me", undefined, "GET");
        setUser(current.user);
      } catch (error) {
        setNotice(error.message);
      }
    }
    return result;
  }

  async function handleLogout() {
    const result = await runRequest(() => request("logout", {}));
    if (!result) return;
    setUser(null);
    window.location.hash = "login";
    showScreen("login");
  }

  function renderScreen() {
    if (screen === "home") {
      return <RentalBrowse user={user} />;
    }
    if (screen === "verify" || (!user && (screen === "forgot" || screen === "verify"))) {
      return <EmailFlowScreen key={screen} screen={screen} onSubmit={handleEmailFlow} pending={pending} />;
    }
    if (user && (screen === "dashboard" || screen.startsWith("admin/") || screen.startsWith("tenant/") || screen.startsWith("owner/"))) {
      const role = user.role === "admin" ? "admin" : user.account_type === "owner" ? "owner" : "tenant";
      const route = screen === "dashboard" ? (role === "admin" ? "admin/dashboard" : `${role}/dashboard`) : screen;
      return <AccountScreen user={user} onLogout={handleLogout} onUserUpdate={setUser} pending={pending} route={route} />;
    }
    if (user) return <RentalBrowse user={user} />;
    if (screen === "register") {
      return <RegisterScreen onRegister={(payload) => signIn("register", payload)} onError={setNotice} pending={pending} />;
    }
    if (screen === "forgot") {
      return <EmailFlowScreen key={screen} screen={screen} onSubmit={handleEmailFlow} pending={pending} />;
    }
    return <LoginScreen onLogin={(payload) => signIn("login", payload)} pending={pending} />;
  }

  const isAdminWorkspace = user?.role === "admin" && (screen === "dashboard" || screen.startsWith("admin/"));
  const isAccountDashboard = Boolean(user && (screen === "dashboard" || screen.startsWith("admin/") || screen.startsWith("tenant/") || screen.startsWith("owner/")));
  const workspaceHome = user?.role === "admin" ? "#admin/dashboard" : `#${user?.account_type === "owner" ? "owner" : "tenant"}/dashboard`;
  const browseRoute = user?.account_type === "tenant" ? "#tenant/browse" : "#home";

  return (
    <>
      <header className="topbar">
        <a className="wordmark" href="#home" aria-label="RentEase home">
          <BrandLogo />
        </a>
        <nav className="topbar-nav">
          <a href={browseRoute}>{user?.account_type === "owner" ? "Public listings" : "Browse rentals"}</a>
          {user ? <a href={workspaceHome}>My workspace</a> : <a href="#login">Sign in</a>}
          {!user && <a className="nav-cta" href="#register">List your space</a>}
        </nav>
      </header>

      <main className={screen === "home" ? "page page-home" : isAdminWorkspace ? "page page-admin" : isAccountDashboard ? "page page-role" : "page"}>
      <section className={screen === "home" ? "home-card" : isAdminWorkspace ? "admin-card" : isAccountDashboard ? "role-card" : "auth-card"} aria-live="polite">
          {screen !== "home" && !isAccountDashboard && <>
          <div className="card-brand">
            <BrandLogo className="brand-logo-compact" />
            <span className="eyebrow">RENTEASE ACCOUNT</span>
          </div>
          </>}
          {renderScreen()}
          {notice && <div className="notice" role="alert">{notice}</div>}
          {screen !== "home" && !isAccountDashboard && <p className="fine-print">By continuing, you agree to RentEase terms and privacy policy.</p>}
        </section>
      </main>

      <footer className="footer">
        <span>© {new Date().getFullYear()} RentEase</span>
        <span>Find a place to call home.</span>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
