import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft, ArrowRight, Bell, Boxes, Check, CheckCircle2,
  ChevronDown, ChevronRight, CircleAlert, CreditCard, FileText, Inbox,
  LayoutDashboard, Mail, MapPin, Package, PackageCheck,
  QrCode, Search, Send, ShieldCheck, Smartphone, Truck,
  Wallet, X, Zap,
} from "lucide-react";
import { initialItems, initialLockers } from "./data.js";

const STORAGE_KEY = "postbox-react-state-v1";
const navigation = {
  customer: [
    { id: "inbox", label: "My postbox", icon: Inbox },
    { id: "tracking", label: "Track parcels", icon: Truck },
    { id: "send", label: "Send a parcel", icon: Send },
    { id: "account", label: "Account & dues", icon: CreditCard },
  ],
  driver: [
    { id: "route", label: "Today's route", icon: Truck },
    { id: "scan", label: "Scan delivery", icon: QrCode },
  ],
  supervisor: [
    { id: "overview", label: "Hub overview", icon: LayoutDashboard },
    { id: "intake", label: "Mail intake", icon: ArrowDownLeft },
    { id: "lockers", label: "Smart lockers", icon: Boxes },
  ],
};

function readSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      role: saved.role || "customer",
      items: saved.items || initialItems,
      lockers: saved.lockers || initialLockers,
      daysRemaining: saved.daysRemaining ?? 12,
    };
  } catch {
    return { role: "customer", items: initialItems, lockers: initialLockers, daysRemaining: 12 };
  }
}

function shortDate() {
  return new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
}

function statusTone(status) {
  if (status === "out_for_delivery") return "coral";
  if (status === "action_required") return "amber";
  if (status === "delivered" || status === "ready_pickup") return "green";
  return "blue";
}

function App() {
  const [saved, setSaved] = useState(readSavedState);
  const [view, setView] = useState("inbox");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All mail");
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [saved]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const items = saved.items;
  const incoming = items.filter((item) => item.direction !== "outgoing");
  const pendingCount = incoming.filter((item) => !["delivered", "ready_pickup"].includes(item.status)).length;
  const transitCount = incoming.filter((item) => ["in_transit", "out_for_delivery"].includes(item.status)).length;
  const currentNav = navigation[saved.role];

  const stopCamera = () => {
    setIsScanning(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const changeRole = (role) => {
    stopCamera();
    setSaved((state) => ({ ...state, role }));
    setView(role === "customer" ? "inbox" : role === "driver" ? "route" : "overview");
  };

  const confirmDelivery = (id) => {
    const item = items.find((mail) => mail.id.toLowerCase() === id.replace(/^#/, "").toLowerCase()
      || mail.trackingNumber.toLowerCase() === id.toLowerCase());
    if (!item) {
      setToast(`No parcel matched “${id}”. Ask the sorting desk to verify its tracking number.`);
      return;
    }
    if (item.status === "delivered") {
      setToast(`${item.trackingNumber} is already marked as delivered.`);
      return;
    }
    const time = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date());
    setSaved((state) => ({
      ...state,
      items: state.items.map((mail) => mail.id === item.id ? {
        ...mail,
        status: "delivered",
        statusLabel: "Delivered & verified",
        eta: "Delivered",
        deliveredTime: "Just now",
        proof: { timestamp: new Date().toISOString(), recipient: "Alex Banda", method: "Barcode scan" },
        history: [`Delivery verified at ${time}`, ...mail.history],
      } : mail),
    }));
    setSelected(null);
    setToast(`Delivery confirmed · ${item.trackingNumber}`);
  };

  const resolveScan = (code) => {
    const clean = code.trim();
    if (!clean) return;
    const item = items.find((mail) => mail.id.toLowerCase() === clean.replace(/^#/, "").toLowerCase()
      || mail.trackingNumber.toLowerCase() === clean.toLowerCase());
    if (!item) {
      setToast(`Code “${clean}” is not registered. Ask the sorting desk to match this parcel first.`);
      return;
    }
    setSelected(item);
  };

  const startCamera = async () => {
    setCameraError("");
    if (!("BarcodeDetector" in window)) {
      setCameraError("Live barcode reading is not available in this browser. Enter the tracking number below instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsScanning(true);
    } catch (error) {
      setCameraError(error.name === "NotAllowedError"
        ? "Camera permission is needed to scan. You can enter the tracking number below."
        : "Camera is unavailable on this device. You can enter the tracking number below.");
    }
  };

  useEffect(() => {
    if (!isScanning || !videoRef.current || !("BarcodeDetector" in window)) return undefined;
    let active = true;
    const detector = new window.BarcodeDetector({ formats: ["qr_code", "code_128", "ean_13", "ean_8", "pdf417"] });
    const scanFrame = async () => {
      if (!active || !videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes.length && active) {
          stopCamera();
          resolveScan(codes[0].rawValue);
          return;
        }
      } catch {
        setCameraError("Could not read that barcode. Try again or enter the tracking number.");
      }
      if (active) window.requestAnimationFrame(scanFrame);
    };
    window.requestAnimationFrame(scanFrame);
    return () => { active = false; };
  }, [isScanning, items]);

  const navigate = (id) => {
    if (view === "scan" && id !== "scan") stopCamera();
    setView(id);
    setSearch("");
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); navigate(saved.role === "customer" ? "inbox" : currentNav[0].id); }}>
          <span className="brand-mark"><Mail size={22} strokeWidth={2.2} /></span>
          <span><strong>Postbox</strong><small>MALAWI POSTS</small></span>
        </a>
        <div className="station-label"><span className="online-dot" /> BLANTYRE GPO</div>
        <div className="nav-heading">{saved.role === "customer" ? "YOUR ACCOUNT" : saved.role === "driver" ? "COURIER TOOLS" : "HUB OPERATIONS"}</div>
        <nav className="side-nav" aria-label="Main navigation">
          {currentNav.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-link ${view === id ? "active" : ""}`} onClick={() => navigate(id)}>
              <Icon size={18} /><span>{label}</span>
              {id === "inbox" && pendingCount > 0 && <span className="nav-count">{pendingCount}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="help-card">
          <div className="help-icon"><Smartphone size={17} /></div>
          <strong>Need a hand?</strong>
          <p>Our postal team is here to help with your mail.</p>
          <a href="tel:+2651820123">Contact Blantyre GPO <ArrowRight size={14} /></a>
        </div>
        <button className="profile-switch" onClick={() => changeRole(saved.role === "customer" ? "driver" : saved.role === "driver" ? "supervisor" : "customer")}>
          <span className="avatar">{saved.role === "customer" ? "AB" : saved.role === "driver" ? "KB" : "CG"}</span>
          <span className="profile-text"><strong>{saved.role === "customer" ? "Alex Banda" : saved.role === "driver" ? "Kondwani Banda" : "Chifundo Gondwe"}</strong><small>{roleTitle(saved.role)}</small></span>
          <ChevronDown size={16} className="muted" />
        </button>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><Mail size={20} /></span><strong>Postbox</strong></div>
          <div className="breadcrumbs"><span>Malawi Posts</span><ChevronRight size={14} /><strong>{pageTitle(view)}</strong></div>
          <div className="topbar-actions">
            <span className="date-label">{shortDate()}</span>
            <button className={`icon-button ${showNotifications ? "selected" : ""}`} aria-label="Notifications" onClick={() => setShowNotifications(!showNotifications)}><Bell size={19} /><i /></button>
            <button className="role-select" onClick={() => changeRole(saved.role === "customer" ? "driver" : saved.role === "driver" ? "supervisor" : "customer")}>
              <span className="avatar small">{saved.role === "customer" ? "AB" : saved.role === "driver" ? "KB" : "CG"}</span>
              <span className="role-name">{roleTitle(saved.role)}</span><ChevronDown size={14} />
            </button>
          </div>
        </header>
        {showNotifications && <div className="notification-popover"><strong>Recent updates</strong><p><Truck size={15} /> Van 04 is on the way with your parcel.</p><p><Mail size={15} /> New digital mail is in Postbox #104.</p></div>}

        <div className="content">
          {saved.role === "customer" && view === "inbox" && <CustomerHome items={incoming} transitCount={transitCount} daysRemaining={saved.daysRemaining} onNavigate={navigate} onSelect={setSelected} />}
          {saved.role === "customer" && view === "tracking" && <Tracking items={items} onSelect={setSelected} />}
          {saved.role === "customer" && view === "send" && <SendParcel onCreated={(item) => { setSaved((state) => ({ ...state, items: [item, ...state.items] })); setToast(`Parcel created · ${item.trackingNumber}`); navigate("tracking"); }} />}
          {saved.role === "customer" && view === "account" && <Account daysRemaining={saved.daysRemaining} onRenew={(days) => { setSaved((state) => ({ ...state, daysRemaining: state.daysRemaining + days })); setToast("Demo renewal complete · no payment was collected."); }} />}
          {saved.role === "driver" && view === "route" && <DriverRoute items={items} onScan={() => navigate("scan")} />}
          {saved.role === "driver" && view === "scan" && <Scanner videoRef={videoRef} scanning={isScanning} cameraError={cameraError} onStartCamera={startCamera} onStopCamera={stopCamera} onManualScan={resolveScan} />}
          {saved.role === "supervisor" && view === "overview" && <SupervisorOverview items={items} lockers={saved.lockers} onNavigate={navigate} onSelect={setSelected} />}
          {saved.role === "supervisor" && view === "intake" && <MailIntake onIntake={(item) => { setSaved((state) => ({ ...state, items: [item, ...state.items] })); setToast(`Mail scanned into Postbox #104 · ${item.trackingNumber}`); }} />}
          {saved.role === "supervisor" && view === "lockers" && <LockerManagement lockers={saved.lockers} onUnlock={(id) => { setSaved((state) => ({ ...state, lockers: state.lockers.map((locker) => locker.id === id ? { ...locker, state: "Available", parcel: "—" } : locker) })); setToast(`Locker ${id} released for collection.`); }} />}
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {currentNav.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => navigate(id)} className={view === id ? "active" : ""}><Icon size={20} /><span>{label.replace("My postbox", "Inbox").replace("Today's route", "Route").replace("Track parcels", "Track").replace("Account & dues", "Account").replace("Send a parcel", "Send").replace("Scan delivery", "Scan").replace("Hub overview", "Overview").replace("Mail intake", "Intake").replace("Smart lockers", "Lockers")}</span></button>)}
      </nav>

      {selected && <DeliveryDialog item={selected} onClose={() => setSelected(null)} onConfirm={() => confirmDelivery(selected.id)} />}
      {toast && <div className="toast" role="status"><CheckCircle2 size={18} />{toast}<button aria-label="Dismiss" onClick={() => setToast("")}><X size={15} /></button></div>}
    </div>
  );
}

function roleTitle(role) {
  return role === "customer" ? "Customer" : role === "driver" ? "Delivery courier" : "Hub supervisor";
}

function pageTitle(view) {
  return ({
    inbox: "My postbox", tracking: "Track parcels", send: "Send a parcel", account: "Account & dues",
    route: "Today's route", scan: "Scan delivery", overview: "Hub overview", intake: "Mail intake", lockers: "Smart lockers",
  })[view] || "My postbox";
}

function PageHeader({ eyebrow, title, description, action }) {
  return <div className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{action}</div>;
}

function CustomerHome({ items, transitCount, daysRemaining, onNavigate, onSelect }) {
  const [filter, setFilter] = useState("All mail");
  const [search, setSearch] = useState("");
  const outstanding = items.filter((item) => item.status !== "delivered" && item.status !== "ready_pickup");
  const filtered = items.filter((item) => {
    const matchesType = filter === "All mail" || (filter === "Packages" ? item.type === "package" : item.type !== "package");
    const matchesSearch = `${item.title} ${item.sender} ${item.trackingNumber}`.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });
  return <>
    <PageHeader eyebrow={shortDate()} title="Your postbox, at a glance" description="Welcome back, Alex. Here’s what’s happening with your mail." />
    <section className="welcome-banner">
      <div className="welcome-copy"><span className="welcome-kicker"><MapPin size={14} /> YOUR MALAWI POSTS ADDRESS</span><h2>Postbox #104</h2><p>Blantyre General Post Office</p><div className="membership-line"><span className="membership-dot" /> Premium membership · {daysRemaining} days remaining</div></div>
      <div className="welcome-actions"><button className="button button-light" onClick={() => onNavigate("tracking")}><Truck size={17} /> Track a parcel</button><button className="button button-ghost-light" onClick={() => onNavigate("account")}><Wallet size={17} /> Manage membership</button></div>
      <div className="postmark" aria-hidden="true"><Mail size={82} strokeWidth={0.9} /></div>
    </section>
    <div className="stats-grid">
      <StatCard icon={Inbox} label="Items in transit" value={String(transitCount).padStart(2, "0")} caption="Across all deliveries" tone="red" />
      <StatCard icon={PackageCheck} label="Ready to collect" value={items.filter((item) => item.status === "ready_pickup").length.toString().padStart(2, "0")} caption="Waiting at your post office" tone="green" />
      <StatCard icon={Wallet} label="Membership" value={`${daysRemaining} days`} caption="Next renewal · Dec 5" tone="gold" />
    </div>
    {outstanding.length > 0 && <section className="route-banner"><div className="route-icon"><Truck size={20} /></div><div><span className="route-label">ON THE ROAD TO YOU</span><strong>Van 04 is heading your way</strong><span>Blantyre Central · estimated arrival in 8 min</span></div><button className="text-button" onClick={() => onSelect(outstanding[0])}>View parcel <ArrowRight size={15} /></button></section>}
    <section className="section">
      <div className="section-heading"><div><p className="eyebrow">YOUR MAIL</p><h2>Recent deliveries</h2></div><button className="text-button" onClick={() => onNavigate("tracking")}>View all <ArrowRight size={15} /></button></div>
      <div className="mail-toolbar"><label className="search-field"><Search size={17} /><input placeholder="Search mail or tracking ID" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></label><div className="filter-group">{["All mail", "Packages", "Letters"].map((item) => <button key={item} onClick={() => setFilter(item)} className={filter === item ? "active" : ""}>{item}</button>)}</div></div>
      <MailList items={filtered.slice(0, 5)} onSelect={onSelect} />
    </section>
    <section className="send-promo"><div className="promo-icon"><Send size={19} /></div><div><strong>Sending something across Malawi?</strong><span>Book a pickup and follow your parcel from door to door.</span></div><button className="button button-dark" onClick={() => onNavigate("send")}>Send a parcel <ArrowRight size={16} /></button></section>
  </>;
}

function StatCard({ icon: Icon, label, value, caption, tone }) {
  return <div className="stat-card"><span className={`stat-icon ${tone}`}><Icon size={19} /></span><span className="stat-label">{label}</span><strong>{value}</strong><span className="stat-caption">{caption}</span></div>;
}

function MailList({ items, onSelect }) {
  if (!items.length) return <div className="empty-state"><Inbox size={24} /><strong>No matching mail</strong><span>Try changing your search or filter.</span></div>;
  return <div className="mail-list">{items.map((item) => <button className="mail-row" key={item.id} onClick={() => onSelect(item)}>
    <span className={`mail-icon ${item.type === "package" ? "package" : item.type === "letter" ? "letter" : "magazine"}`}>{item.type === "package" ? <Package size={20} /> : item.type === "letter" ? <FileText size={20} /> : <Mail size={20} />}</span>
    <span className="mail-copy"><strong>{item.sender}</strong><span>{item.title}</span><small>{item.trackingNumber} <i>·</i> {item.weight}</small></span>
    <span className="mail-status"><span className={`status-pill ${statusTone(item.status)}`}><i />{item.statusLabel}</span><small>{item.eta}</small></span>
    <ChevronRight className="row-chevron" size={18} />
  </button>)}</div>;
}

function Tracking({ items, onSelect }) {
  const [term, setTerm] = useState("");
  const matching = items.filter((item) => `${item.title} ${item.sender} ${item.trackingNumber}`.toLowerCase().includes(term.toLowerCase()));
  return <><PageHeader eyebrow="PARCEL TRACKING" title="Every delivery, accounted for" description="Follow your incoming and outgoing parcels and check their latest status." /><label className="search-field tracking-search"><Search size={17} /><input placeholder="Enter a sender, description or tracking number" value={term} onChange={(event) => setTerm(event.target.value)} /></label><section className="section"><div className="section-heading"><div><p className="eyebrow">ALL SHIPMENTS</p><h2>{matching.length} parcels & mail</h2></div></div><MailList items={matching} onSelect={onSelect} /></section></>;
}

function DeliveryDialog({ item, onClose, onConfirm }) {
  const alreadyDelivered = item.status === "delivered";
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="delivery-modal" role="dialog" aria-modal="true" aria-labelledby="delivery-title">
    <div className="modal-head"><span className="modal-check"><ShieldCheck size={23} /></span><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>
    <p className="eyebrow">{alreadyDelivered ? "DELIVERY RECORD" : "PARCEL DETAILS"}</p><h2 id="delivery-title">{alreadyDelivered ? "Delivery confirmed" : "Check before confirming"}</h2><p className="modal-intro">{alreadyDelivered ? "This parcel has already been marked as delivered." : "Make sure the tracking number belongs to the parcel you received."}</p>
    <div className="verify-parcel"><span className="mail-icon package"><Package size={21} /></span><div><strong>{item.title}</strong><span>{item.sender}</span></div></div>
    <div className="verify-details"><div><small>TRACKING NUMBER</small><strong>{item.trackingNumber}</strong></div><div><small>DELIVERY POINT</small><strong>{item.pickupPoint}</strong></div></div>
    {!alreadyDelivered && <div className="confirm-note"><CircleAlert size={17} /><span>Confirm only after you have received and checked the parcel.</span></div>}
    <div className="modal-actions">{alreadyDelivered ? <button className="button button-dark full-width" onClick={onClose}>Close</button> : <><button className="button button-outline" onClick={onClose}>Not my parcel</button><button className="button button-red" onClick={onConfirm}><Check size={17} /> Confirm received</button></>}</div>
    {alreadyDelivered && item.proof && <p className="proof-caption"><CheckCircle2 size={15} /> Verified via {item.proof.method} · {new Date(item.proof.timestamp).toLocaleString()}</p>}
  </section></div>;
}

function Scanner({ videoRef, scanning, cameraError, onStartCamera, onStopCamera, onManualScan }) {
  const [code, setCode] = useState("");
  const submit = (event) => { event.preventDefault(); onManualScan(code); };
  return <><PageHeader eyebrow="COURIER TOOLS" title="Verify a delivery" description="Scan the barcode on the parcel, then confirm the right item reached its recipient." /><div className="scanner-layout">
    <section className="scanner-card"><div className="scanner-preview">{scanning ? <video ref={videoRef} autoPlay muted playsInline /> : <div className="scan-placeholder"><span className="scan-graphic"><QrCode size={58} strokeWidth={1.2} /></span><span>Place a parcel barcode inside the frame</span></div>}<div className="scan-frame"><i /><i /><i /><i /></div>{scanning && <span className="scan-live"><span className="online-dot" /> CAMERA ACTIVE</span>}</div><div className="scanner-controls"><div><strong>Scan a parcel label</strong><span>Use the rear camera in a well-lit area.</span></div><button className={`button ${scanning ? "button-outline" : "button-red"}`} onClick={scanning ? onStopCamera : onStartCamera}>{scanning ? <><X size={16} /> Stop camera</> : <><QrCode size={17} /> Start camera</>}</button></div>{cameraError && <p className="form-message warning"><CircleAlert size={16} />{cameraError}</p>}</section>
    <section className="manual-card"><span className="manual-icon"><PackageCheck size={21} /></span><p className="eyebrow">NO CAMERA? NO PROBLEM.</p><h2>Enter the tracking number</h2><p>Read the number printed below the barcode and type it here.</p><form className="manual-form" onSubmit={submit}><label htmlFor="tracking-code">Tracking number</label><input id="tracking-code" autoComplete="off" placeholder="e.g. AZ-9921-X01" value={code} onChange={(event) => setCode(event.target.value)} required /><button className="button button-dark full-width" type="submit">Find parcel <ArrowRight size={16} /></button></form><div className="security-note"><ShieldCheck size={16} /> Parcel details are checked before delivery is recorded.</div></section>
  </div><div className="test-scan-row"><strong>Demo shortcuts</strong><button className="text-button" onClick={() => onManualScan("AZ-9921-X01")}>Open test parcel <ArrowRight size={15} /></button></div></>;
}

function DriverRoute({ items, onScan }) {
  const stops = items.filter((item) => item.type === "package" && item.status !== "delivered");
  return <><PageHeader eyebrow="COURIER NAVIGATION" title="Good morning, Kondwani" description="Your route for today · Blantyre Central · Van 04" action={<span className="live-badge"><span className="online-dot" /> ON DUTY</span>} /><section className="driver-summary"><div className="driver-metric"><span className="metric-icon"><MapPin size={19} /></span><span><small>ROUTE PROGRESS</small><strong>{Math.max(1, 3 - stops.length)} of 3 stops</strong></span></div><div className="progress-track"><span style={{ width: `${Math.min(90, 35 + (3 - stops.length) * 22)}%` }} /></div><div className="route-points"><span>Blantyre GPO</span><span>Victoria Avenue</span><span>Customer stops</span></div></section><div className="section-heading route-heading"><div><p className="eyebrow">DELIVERY MANIFEST</p><h2>{stops.length} remaining stops</h2></div><button className="button button-red" onClick={onScan}><QrCode size={17} /> Scan parcel</button></div><div className="stop-list">{stops.map((item, index) => <article className="stop-card" key={item.id}><span className="stop-index">{String(index + 1).padStart(2, "0")}</span><div className="stop-info"><span className="stop-type">{item.type.toUpperCase()} · {item.trackingNumber}</span><strong>{item.title}</strong><span>{item.sender} · {item.pickupPoint}</span><span className="stop-address"><MapPin size={14} /> Blantyre · Southern Region</span></div><div className="stop-actions"><span className={`status-pill ${statusTone(item.status)}`}><i />{item.statusLabel}</span><button className="button button-outline" onClick={onScan}><QrCode size={15} /> Scan & verify</button></div></article>)}{stops.length === 0 && <div className="empty-state"><CheckCircle2 size={25} /><strong>Route complete</strong><span>All assigned parcel deliveries have been confirmed.</span></div>}</div><section className="driver-note"><Zap size={18} /><div><strong>Delivery proof is recorded automatically</strong><span>Scanning a known parcel adds a verified time and recipient record to its delivery history.</span></div></section></>;
}

function Account({ daysRemaining, onRenew }) {
  const [plan, setPlan] = useState(30);
  return <><PageHeader eyebrow="MEMBERSHIP & PAYMENTS" title="Your postal account" description="Manage your postbox plan and see your current membership status." /><div className="account-grid"><section className="plan-card"><div className="plan-top"><span className="plan-mark"><Mail size={20} /></span><span className="status-pill green"><i /> ACTIVE</span></div><p className="eyebrow">CURRENT PLAN</p><h2>Premium Plus</h2><p>Your secure Blantyre GPO postal address, digital mail and parcel storage.</p><div className="plan-price"><strong>MK 15,000</strong><span>/ month</span></div><div className="plan-benefits"><span><Check size={15} /> Digital mail scanning</span><span><Check size={15} /> Secure parcel holding</span><span><Check size={15} /> Delivery notifications</span></div><div className="membership-progress"><div><span>Time remaining</span><strong>{daysRemaining} days</strong></div><div className="progress-track"><span style={{ width: `${Math.min(100, daysRemaining / 30 * 100)}%` }} /></div></div></section><section className="payment-card"><p className="eyebrow">RENEW MEMBERSHIP</p><h2>Keep your postbox active</h2><p className="page-description">Choose a renewal term. This standalone demo does not connect to a payment provider.</p><div className="plan-options"><button className={plan === 30 ? "selected" : ""} onClick={() => setPlan(30)}><span>Monthly renewal</span><strong>MK 15,000</strong><small>30 days · flexible billing</small></button><button className={plan === 365 ? "selected" : ""} onClick={() => setPlan(365)}><span>Annual renewal</span><strong>MK 135,000</strong><small>365 days · save 25%</small></button></div><div className="payment-demo-note"><ShieldCheck size={17} /><span>Demo checkout only. No card details or actual payment are collected.</span></div><button className="button button-red full-width" onClick={() => onRenew(plan)}>Renew for {plan} days <ArrowRight size={16} /></button></section></div></>;
}

function SendParcel({ onCreated }) {
  const [service, setService] = useState("Express courier");
  const handleSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = `MW-OUT-${Math.floor(1000 + Math.random() * 9000)}`;
    onCreated({ id, trackingNumber: `#${id}`, type: "package", direction: "outgoing", sender: "Alex Banda", title: form.get("description"), status: "in_transit", statusLabel: "Pickup requested", eta: "Awaiting courier", pickupPoint: form.get("destination"), weight: `${form.get("weight")} kg`, deliveredTime: null, history: ["Pickup requested by customer"] });
    event.currentTarget.reset();
  };
  return <><PageHeader eyebrow="OUTGOING MAIL" title="Send a parcel" description="Arrange a Malawi Posts courier pickup and create a trackable shipment." /><form className="shipping-form" onSubmit={handleSubmit}><section className="form-card"><p className="eyebrow">01 · RECIPIENT</p><h2>Where is it going?</h2><div className="field-grid"><label>Recipient full name<input name="recipient" placeholder="e.g. Grace Mvula" required /></label><label>Destination address<input name="destination" placeholder="Town, street or postbox" required /></label></div></section><section className="form-card"><p className="eyebrow">02 · PARCEL</p><h2>Tell us what you’re sending</h2><div className="field-grid"><label>Parcel description<input name="description" placeholder="e.g. Documents and books" required /></label><label>Weight (kg)<input name="weight" type="number" min="0.1" step="0.1" placeholder="1.0" required /></label><label>Delivery service<select value={service} onChange={(event) => setService(event.target.value)}><option>Express courier</option><option>Standard post</option><option>Registered secure delivery</option></select></label></div></section><div className="shipping-total"><span><strong>{service}</strong><small>Pickup arranged after shipment creation</small></span><strong>{service === "Express courier" ? "MK 4,500" : service === "Standard post" ? "MK 2,200" : "MK 6,000"}</strong></div><button className="button button-red" type="submit">Create shipment <ArrowRight size={17} /></button></form></>;
}

function SupervisorOverview({ items, lockers, onNavigate, onSelect }) {
  const available = lockers.filter((locker) => locker.state === "Available").length;
  const pending = items.filter((item) => item.status !== "delivered").length;
  return <><PageHeader eyebrow="BLANTYRE GPO · HUB OPERATIONS" title="Good morning, Chifundo" description="Here is the latest activity across the central sorting hub." action={<span className="station-chip"><MapPin size={14} /> BLANTYRE GPO</span>} /><div className="stats-grid supervisor-stats"><StatCard icon={Boxes} label="Locker capacity" value={`${available}/${lockers.length}`} caption="Compartments available" tone="red" /><StatCard icon={Package} label="Parcels in process" value={String(pending).padStart(2, "0")} caption="Awaiting final delivery" tone="gold" /><StatCard icon={CheckCircle2} label="Deliveries verified" value={items.filter((item) => item.status === "delivered").length.toString().padStart(2, "0")} caption="Recorded in the mail ledger" tone="green" /></div><section className="section"><div className="section-heading"><div><p className="eyebrow">HUB WORKSPACE</p><h2>Operations</h2></div></div><div className="operations-grid"><button className="operation-card" onClick={() => onNavigate("intake")}><span className="operation-icon red"><ArrowDownLeft size={20} /></span><strong>Register incoming mail</strong><span>Log a new item and notify its postbox owner.</span><ArrowRight size={17} /></button><button className="operation-card" onClick={() => onNavigate("lockers")}><span className="operation-icon green"><Boxes size={20} /></span><strong>Manage smart lockers</strong><span>Review compartment availability and collection status.</span><ArrowRight size={17} /></button></div></section><section className="section"><div className="section-heading"><div><p className="eyebrow">LATEST ACTIVITY</p><h2>Recent mail</h2></div></div><MailList items={items.slice(0, 4)} onSelect={onSelect} /></section></>;
}

function MailIntake({ onIntake }) {
  const handleSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = `MW-IN-${Math.floor(1000 + Math.random() * 9000)}`;
    onIntake({ id, trackingNumber: `#${id}`, type: form.get("type"), direction: "incoming", sender: form.get("sender"), title: form.get("title"), status: form.get("urgent") ? "action_required" : "delivered", statusLabel: form.get("urgent") ? "Action required" : "Added to postbox", eta: "Just now", pickupPoint: "Postbox #104 · Blantyre GPO", weight: "50 g", deliveredTime: "Just now", history: ["Scanned and registered at Blantyre GPO"] });
    event.currentTarget.reset();
  };
  return <><PageHeader eyebrow="SORTING DESK" title="Register incoming mail" description="Scan, digitize and route a new item to a customer's postbox." /><form className="form-card intake-form" onSubmit={handleSubmit}><div className="intake-recipient"><span className="avatar">AB</span><span><small>DELIVER TO</small><strong>Alex Banda · Postbox #104</strong><small>Blantyre General Post Office</small></span><CheckCircle2 size={19} /></div><div className="field-grid"><label>Sender<input name="sender" placeholder="Company or sender name" required /></label><label>Mail type<select name="type"><option value="letter">Letter</option><option value="package">Package</option><option value="magazine">Magazine</option></select></label><label className="field-wide">Subject / item description<input name="title" placeholder="e.g. Monthly account statement" required /></label><label className="field-wide">Digital summary (optional)<textarea name="summary" rows="3" placeholder="Briefly describe scanned or digitized contents" /></label></div><label className="urgent-toggle"><input type="checkbox" name="urgent" /><span><strong>Flag as action required</strong><small>Mark time-sensitive mail so the customer sees it straight away.</small></span></label><button className="button button-red" type="submit"><QrCode size={17} /> Register mail</button></form></>;
}

function LockerManagement({ lockers, onUnlock }) {
  return <><PageHeader eyebrow="BLANTYRE GPO · SMART STORAGE" title="Smart locker management" description="Check compartment availability and release a locker when a collection is complete." /><section className="locker-summary"><div className="locker-legend"><span><i className="legend-dot available" /> Available</span><span><i className="legend-dot occupied" /> Occupied</span><span><i className="legend-dot reserved" /> Reserved</span></div><div className="locker-grid">{lockers.map((locker) => <article key={locker.id} className={`locker-tile ${locker.state.toLowerCase()}`}><div><strong>#{String(locker.id).padStart(2, "0")}</strong><span>{locker.size} SIZE</span></div><p>{locker.parcel}</p><div className="locker-footer"><small>{locker.state}</small>{locker.state !== "Available" && <button onClick={() => onUnlock(locker.id)}>Release</button>}</div></article>)}</div></section></>;
}

export default App;
