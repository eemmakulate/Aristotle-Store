import { useEffect, useState } from "react";
import { db, auth, OWNER_LOGIN_REDIRECT_URL } from "./firebaseClient";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, orderBy, serverTimestamp,
} from "firebase/firestore";
import {
  onAuthStateChanged, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signOut,
} from "firebase/auth";
import {
  Plus, Minus, MessageCircle, ArrowLeft, Check, Clock, UserPlus, LogOut,
  Package, ShieldCheck, KeyRound, PackagePlus, Trash2, Pencil, Mail,
} from "lucide-react";

const COLORS = {
  bg: "#181D17", surface: "#222820", surfaceRaised: "#2B3227", line: "#3A4234",
  paper: "#EDE6D6", paperDim: "#A8A490", gold: "#C89116", goldSoft: "#8A6A28",
  sage: "#7C9B7E", paid: "#4C7A5E", unpaid: "#B4483C",
};

const WHATSAPP_NUMBER = "2348145808098"; // Aristotle Store's WhatsApp number
const EMAIL_STORAGE_KEY = "aristotle_owner_email_for_signin";

function naira(n) {
  return "₦" + Number(n).toLocaleString("en-NG");
}

const inputStyle = {
  width: "100%", background: "#222820", border: "1px solid #3A4234", borderRadius: 10,
  padding: "12px 14px", color: "#EDE6D6", fontSize: 14, marginBottom: 12, boxSizing: "border-box",
};
const smallInputStyle = { ...inputStyle, padding: "9px 12px", fontSize: 13, marginBottom: 8 };

function Badge({ status }) {
  const paid = status === "paid";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12,
      color: paid ? COLORS.paid : COLORS.unpaid,
      background: paid ? "rgba(76,122,94,0.15)" : "rgba(180,72,60,0.15)",
      border: `1px solid ${paid ? COLORS.paid : COLORS.unpaid}`, borderRadius: 20,
      padding: "3px 10px", fontWeight: 500,
    }}>
      {paid ? <Check size={12} /> : <Clock size={12} />}
      {paid ? "Paid" : "Unpaid"}
    </span>
  );
}

function PhoneFrame({ children }) {
  return (
    <div style={{
      width: 375, maxWidth: "100%", margin: "0 auto", background: COLORS.bg, borderRadius: 28,
      border: "8px solid #0E110D", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.paper, minHeight: 640,
      display: "flex", flexDirection: "column",
    }}>
      {children}
    </div>
  );
}

function TopBar({ title, subtitle, onBack, right }) {
  return (
    <div style={{
      padding: "18px 20px 14px", borderBottom: `1px solid ${COLORS.line}`,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onBack && (
          <button onClick={onBack} style={{ background: "none", border: "none", color: COLORS.paperDim, cursor: "pointer", padding: 4 }}>
            <ArrowLeft size={18} />
          </button>
        )}
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: COLORS.paperDim, marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}

function ToastEl({ text }) {
  return (
    <div style={{
      position: "fixed", bottom: 30, left: "50%", transform: "translateX(-50%)",
      background: "#2B3227", border: "1px solid #C89116", color: "#EDE6D6",
      padding: "10px 18px", borderRadius: 10, fontSize: 13, boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
      zIndex: 50, maxWidth: 320, textAlign: "center",
    }}>
      {text}
    </div>
  );
}

const circleBtnStyle = {
  width: 38, height: 38, borderRadius: "50%", border: "1px solid #3A4234", background: "#222820",
  color: "#EDE6D6", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
};

export default function App() {
  const [session, setSession] = useState(null); // { type: 'customer', customer } | { type: 'owner' }
  const [authChecked, setAuthChecked] = useState(false);
  const [screen, setScreen] = useState("login"); // login | ownerSendLink | ownerLinkSent | ownerNeedsEmail | forceReset | forgotUser | forgotNew
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [toast, setToast] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [pendingCustomer, setPendingCustomer] = useState(null);
  const [forgotUsernameInput, setForgotUsernameInput] = useState("");
  const [forgotCustomer, setForgotCustomer] = useState(null);
  const [newPass1, setNewPass1] = useState("");
  const [newPass2, setNewPass2] = useState("");

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [cartProduct, setCartProduct] = useState(null);
  const [qty, setQty] = useState(1);

  const [ownerTab, setOwnerTab] = useState("orders");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", unit: "", price: "", stock: "" });
  const [editingProductId, setEditingProductId] = useState(null);
  const [editProduct, setEditProduct] = useState({ price: "", stock: "" });
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", username: "", password: "" });

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  }

  // ---- Handle an incoming Firebase email-link sign-in, and persist session across reloads ----
  useEffect(() => {
    async function completeEmailLinkIfPresent() {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        let email = window.localStorage.getItem(EMAIL_STORAGE_KEY);
        if (!email) {
          setScreen("ownerNeedsEmail");
          setAuthChecked(true);
          return;
        }
        setLoading(true);
        try {
          await signInWithEmailLink(auth, email, window.location.href);
          window.localStorage.removeItem(EMAIL_STORAGE_KEY);
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (e) {
          setLoginError("That login link didn't work — it may have expired. Request a new one.");
        }
        setLoading(false);
      }
      setAuthChecked(true);
    }
    completeEmailLinkIfPresent();

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setSession({ type: "owner" });
    });
    return () => unsub();
  }, []);

  async function loadProducts() {
    const snap = await getDocs(collection(db, "products"));
    setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }
  async function loadOrders(customerId) {
    let q = customerId
      ? query(collection(db, "orders"), where("customer_id", "==", customerId))
      : collection(db, "orders");
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
    setOrders(list);
  }
  async function loadCustomers() {
    const snap = await getDocs(collection(db, "customers"));
    setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  useEffect(() => {
    if (session?.type === "owner") {
      loadProducts(); loadOrders(); loadCustomers();
    } else if (session?.type === "customer") {
      loadProducts(); loadOrders(session.customer.id);
    }
  }, [session]);

  function backToLogin() {
    setScreen("login");
    setUsername(""); setPassword(""); setOwnerEmail("");
    setForgotUsernameInput(""); setNewPass1(""); setNewPass2(""); setLoginError("");
  }

  // ---- Customer login ----
  async function handleLogin() {
    setLoginError("");
    setLoading(true);
    const u = username.trim().toLowerCase();
    const snap = await getDocs(query(collection(db, "customers"), where("username_lower", "==", u)));
    setLoading(false);
    if (snap.empty) { setLoginError("Incorrect username or password."); return; }
    const data = { id: snap.docs[0].id, ...snap.docs[0].data() };
    if (data.password !== password) { setLoginError("Incorrect username or password."); return; }
    if (data.must_reset) { setPendingCustomer(data); setScreen("forceReset"); }
    else { setSession({ type: "customer", customer: data }); }
  }

  // ---- Owner login: Firebase email link ----
  async function handleSendOwnerLink() {
    setLoginError("");
    if (!ownerEmail.trim()) { setLoginError("Enter the owner's email address."); return; }
    setLoading(true);
    try {
      await sendSignInLinkToEmail(auth, ownerEmail.trim(), {
        url: OWNER_LOGIN_REDIRECT_URL,
        handleCodeInApp: true,
      });
      window.localStorage.setItem(EMAIL_STORAGE_KEY, ownerEmail.trim());
      setScreen("ownerLinkSent");
      showToast(`Login link sent to ${ownerEmail.trim()}`);
    } catch (e) {
      setLoginError(e.message || "Couldn't send the login link. Try again.");
    }
    setLoading(false);
  }

  async function handleConfirmEmailForLink() {
    setLoading(true);
    try {
      await signInWithEmailLink(auth, ownerEmail.trim(), window.location.href);
      window.localStorage.removeItem(EMAIL_STORAGE_KEY);
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) {
      setLoginError("That didn't match the link. Double check the email you used.");
    }
    setLoading(false);
  }

  async function handleForceResetSubmit() {
    if (newPass1.length < 6) { setLoginError("Choose a password with at least 6 characters."); return; }
    if (newPass1 !== newPass2) { setLoginError("Passwords don't match."); return; }
    setLoading(true);
    await updateDoc(doc(db, "customers", pendingCustomer.id), { password: newPass1, must_reset: false });
    setLoading(false);
    setSession({ type: "customer", customer: { ...pendingCustomer, password: newPass1, must_reset: false } });
    setPendingCustomer(null);
    backToLogin();
  }

  async function handleForgotUsernameSubmit() {
    setLoginError("");
    const u = forgotUsernameInput.trim().toLowerCase();
    setLoading(true);
    const snap = await getDocs(query(collection(db, "customers"), where("username_lower", "==", u)));
    setLoading(false);
    if (snap.empty) { setLoginError("No customer account found with that username. Owners use the email link screen instead."); return; }
    setForgotCustomer({ id: snap.docs[0].id, ...snap.docs[0].data() });
    setScreen("forgotNew");
    showToast("Identity confirmed — choose a new password below.");
  }

  async function handleForgotNewSubmit() {
    if (newPass1.length < 6) { setLoginError("Choose a password with at least 6 characters."); return; }
    if (newPass1 !== newPass2) { setLoginError("Passwords don't match."); return; }
    setLoading(true);
    await updateDoc(doc(db, "customers", forgotCustomer.id), { password: newPass1, must_reset: false });
    setLoading(false);
    setForgotCustomer(null);
    backToLogin();
    showToast("Password reset — log in with your new password.");
  }

  async function logout() {
    if (session?.type === "owner") await signOut(auth);
    setSession(null);
    backToLogin();
  }

  async function placeOrder() {
    if (!cartProduct) return;
    const total = cartProduct.price * qty;
    const customer = session.customer;
    setLoading(true);
    await addDoc(collection(db, "orders"), {
      customer_id: customer.id,
      customer_name: customer.name,
      items: [{ name: cartProduct.name, qty, price: cartProduct.price }],
      total, status: "unpaid", created_at: serverTimestamp(),
    });
    await updateDoc(doc(db, "products", cartProduct.id), { stock: Math.max(0, cartProduct.stock - qty) });
    await loadProducts();
    await loadOrders(customer.id);
    showToast("Order placed — contact the shop on WhatsApp to pay");
    setLoading(false);
    setCartProduct(null);
    setQty(1);
  }

  async function togglePaid(order) {
    const next = order.status === "paid" ? "unpaid" : "paid";
    await updateDoc(doc(db, "orders", order.id), { status: next });
    loadOrders();
  }

  async function addProduct() {
    const price = parseFloat(newProduct.price);
    const stock = parseInt(newProduct.stock, 10);
    if (!newProduct.name.trim() || !newProduct.unit.trim() || isNaN(price) || price <= 0 || isNaN(stock) || stock < 0) {
      showToast("Fill in name, unit, a valid price, and stock count");
      return;
    }
    await addDoc(collection(db, "products"), { name: newProduct.name.trim(), unit: newProduct.unit.trim(), price, stock });
    setNewProduct({ name: "", unit: "", price: "", stock: "" });
    setShowAddProduct(false);
    loadProducts();
    showToast("Product added to catalog");
  }

  function startEditProduct(p) {
    setEditingProductId(p.id);
    setEditProduct({ price: String(p.price), stock: String(p.stock) });
  }

  async function saveEditProduct() {
    const price = parseFloat(editProduct.price);
    const stock = parseInt(editProduct.stock, 10);
    if (isNaN(price) || price <= 0 || isNaN(stock) || stock < 0) { showToast("Enter a valid price and stock count"); return; }
    await updateDoc(doc(db, "products", editingProductId), { price, stock });
    setEditingProductId(null);
    loadProducts();
    showToast("Product updated");
  }

  async function deleteProduct(id) {
    await deleteDoc(doc(db, "products", id));
    if (editingProductId === id) setEditingProductId(null);
    loadProducts();
  }

  async function addCustomer() {
    if (!newCustomer.name.trim() || !newCustomer.username.trim() || !newCustomer.password.trim()) {
      showToast("Fill in name, username, and password");
      return;
    }
    const u = newCustomer.username.trim();
    const existing = await getDocs(query(collection(db, "customers"), where("username_lower", "==", u.toLowerCase())));
    if (!existing.empty) { showToast("That username is already taken"); return; }
    await addDoc(collection(db, "customers"), {
      name: newCustomer.name.trim(), username: u, username_lower: u.toLowerCase(),
      password: newCustomer.password.trim(), must_reset: true,
    });
    setNewCustomer({ name: "", username: "", password: "" });
    setShowAddCustomer(false);
    loadCustomers();
    showToast("Customer added — they'll set their own password on first login.");
  }

  if (!authChecked) {
    return <div style={{ background: "#0E110D", minHeight: 700 }} />;
  }

  // ================= LOGIN SCREENS =================
  if (!session) {
    let body;
    if (screen === "login") {
      body = (
        <>
          <label style={{ fontSize: 12, color: COLORS.paperDim, marginBottom: 6, display: "block" }}>Customer username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" style={inputStyle} />
          <label style={{ fontSize: 12, color: COLORS.paperDim, marginBottom: 6, display: "block" }}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />
          <button onClick={handleLogin} disabled={loading} style={{ background: COLORS.gold, color: "#1B1F19", border: "none", borderRadius: 10, padding: "13px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {loading ? "Checking…" : "Log in"}
          </button>
          <button onClick={() => { setScreen("forgotUser"); setLoginError(""); }} style={{ background: "none", border: "none", color: COLORS.sage, fontSize: 12.5, marginTop: 14, cursor: "pointer", alignSelf: "flex-start", fontWeight: 600, padding: 0 }}>
            Forgot password?
          </button>
          <div style={{ height: 1, background: COLORS.line, margin: "22px 0" }} />
          <div style={{ fontSize: 12.5, color: COLORS.paperDim, marginBottom: 10 }}>Are you the shop owner?</div>
          <button onClick={() => { setScreen("ownerSendLink"); setLoginError(""); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "transparent", border: `1px solid ${COLORS.sage}`, color: COLORS.sage, borderRadius: 10, padding: "12px 0", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
            <ShieldCheck size={16} /> Log in by email link
          </button>
        </>
      );
    } else if (screen === "ownerSendLink") {
      body = (
        <>
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>Owner login</div>
          <div style={{ fontSize: 12, color: COLORS.paperDim, marginBottom: 18 }}>Enter your email — we'll send you a one-tap login link.</div>
          <input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
          <button onClick={handleSendOwnerLink} disabled={loading} style={{ background: COLORS.sage, color: "#12160F", border: "none", borderRadius: 10, padding: "13px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {loading ? "Sending…" : "Send login link"}
          </button>
          <button onClick={backToLogin} style={{ background: "none", border: "none", color: COLORS.paperDim, fontSize: 12.5, marginTop: 14, cursor: "pointer" }}>← Back to login</button>
        </>
      );
    } else if (screen === "ownerLinkSent") {
      body = (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Mail size={18} color={COLORS.sage} />
            <span style={{ fontSize: 13.5 }}>Check {ownerEmail} on this device</span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.paperDim, marginBottom: 18, lineHeight: 1.6 }}>
            Open the email and tap the login link — it'll bring you straight back here, signed in.
          </div>
          <button onClick={backToLogin} style={{ background: "none", border: "none", color: COLORS.paperDim, fontSize: 12.5, cursor: "pointer" }}>← Back to login</button>
        </>
      );
    } else if (screen === "ownerNeedsEmail") {
      body = (
        <>
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>Confirm your email</div>
          <div style={{ fontSize: 12, color: COLORS.paperDim, marginBottom: 18, lineHeight: 1.6 }}>
            You opened this login link on a different device or browser than the one you requested it from. Re-enter your email to finish signing in.
          </div>
          <input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
          <button onClick={handleConfirmEmailForLink} disabled={loading} style={{ background: COLORS.sage, color: "#12160F", border: "none", borderRadius: 10, padding: "13px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {loading ? "Signing in…" : "Confirm & continue"}
          </button>
        </>
      );
    } else if (screen === "forceReset") {
      body = (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <KeyRound size={18} color={COLORS.gold} />
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>Set your own password</span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.paperDim, marginBottom: 18 }}>This is your first login. The temporary password won't work again.</div>
          <input type="password" value={newPass1} onChange={(e) => setNewPass1(e.target.value)} placeholder="New password (6+ characters)" style={inputStyle} />
          <input type="password" value={newPass2} onChange={(e) => setNewPass2(e.target.value)} placeholder="Confirm password" style={inputStyle} />
          <button onClick={handleForceResetSubmit} disabled={loading} style={{ background: COLORS.gold, color: "#1B1F19", border: "none", borderRadius: 10, padding: "13px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {loading ? "Saving…" : "Set password & continue"}
          </button>
        </>
      );
    } else if (screen === "forgotUser") {
      body = (
        <>
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>Reset your password</div>
          <div style={{ fontSize: 12, color: COLORS.paperDim, marginBottom: 18 }}>Enter your username to reset your password.</div>
          <input value={forgotUsernameInput} onChange={(e) => setForgotUsernameInput(e.target.value)} placeholder="Your username" style={inputStyle} />
          <button onClick={handleForgotUsernameSubmit} disabled={loading} style={{ background: COLORS.sage, color: "#12160F", border: "none", borderRadius: 10, padding: "13px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {loading ? "Checking…" : "Continue"}
          </button>
          <button onClick={backToLogin} style={{ background: "none", border: "none", color: COLORS.paperDim, fontSize: 12.5, marginTop: 14, cursor: "pointer" }}>← Back to login</button>
          <div style={{ fontSize: 11, color: COLORS.paperDim, marginTop: 14, lineHeight: 1.5 }}>
            Note: this simple version doesn't verify identity by SMS/email yet — anyone with your username can reset it. Ask the shop owner to add real verification before relying on this for real customers.
          </div>
        </>
      );
    } else if (screen === "forgotNew") {
      body = (
        <>
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>Choose a new password</div>
          <input type="password" value={newPass1} onChange={(e) => setNewPass1(e.target.value)} placeholder="New password (6+ characters)" style={inputStyle} />
          <input type="password" value={newPass2} onChange={(e) => setNewPass2(e.target.value)} placeholder="Confirm password" style={inputStyle} />
          <button onClick={handleForgotNewSubmit} disabled={loading} style={{ background: COLORS.gold, color: "#1B1F19", border: "none", borderRadius: 10, padding: "13px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {loading ? "Saving…" : "Reset password"}
          </button>
        </>
      );
    }

    return (
      <div style={{ background: "#0E110D", padding: "40px 16px", minHeight: 700 }}>
        <PhoneFrame>
          <div style={{ padding: "40px 28px", flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 600, color: COLORS.gold, lineHeight: 1.15 }}>Aristotle Store</div>
              <div style={{ color: COLORS.paperDim, fontSize: 13, marginTop: 6 }}>Fresh oil & household goods, ordered simply.</div>
            </div>
            {body}
            {loginError && <div style={{ color: COLORS.unpaid, fontSize: 12.5, marginTop: 12 }}>{loginError}</div>}
          </div>
        </PhoneFrame>
        {toast && <ToastEl text={toast} />}
      </div>
    );
  }

  // ================= CUSTOMER DASHBOARD =================
  if (session.type === "customer") {
    const me = session.customer;
    const owed = orders.filter((o) => o.status === "unpaid").reduce((s, o) => s + o.total, 0);

    if (cartProduct) {
      const total = cartProduct.price * qty;
      return (
        <div style={{ background: "#0E110D", padding: "40px 16px", minHeight: 700 }}>
          <PhoneFrame>
            <TopBar title={cartProduct.name} subtitle={cartProduct.unit} onBack={() => setCartProduct(null)} />
            <div style={{ padding: 24, flex: 1 }}>
              <div style={{ fontSize: 13, color: COLORS.paperDim, marginBottom: 4 }}>Price per unit</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, color: COLORS.gold, marginBottom: 24 }}>{naira(cartProduct.price)}</div>
              <div style={{ fontSize: 13, color: COLORS.paperDim, marginBottom: 10 }}>Quantity</div>
              <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 24 }}>
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={circleBtnStyle}><Minus size={16} /></button>
                <div style={{ fontSize: 22, fontWeight: 600, minWidth: 30, textAlign: "center" }}>{qty}</div>
                <button onClick={() => setQty((q) => Math.min(cartProduct.stock, q + 1))} style={circleBtnStyle}><Plus size={16} /></button>
                <div style={{ fontSize: 12, color: COLORS.paperDim, marginLeft: "auto" }}>{cartProduct.stock} in stock</div>
              </div>
              <div style={{ borderTop: `1px solid ${COLORS.line}`, paddingTop: 16, display: "flex", justifyContent: "space-between", marginBottom: 28 }}>
                <span style={{ color: COLORS.paperDim, fontSize: 14 }}>Order total</span>
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20 }}>{naira(total)}</span>
              </div>
              <button onClick={placeOrder} disabled={loading} style={{ width: "100%", background: COLORS.gold, color: "#1B1F19", border: "none", borderRadius: 10, padding: "14px 0", fontWeight: 700, fontSize: 14.5, cursor: "pointer" }}>
                {loading ? "Placing order…" : "Place order"}
              </button>
              <div style={{ fontSize: 11.5, color: COLORS.paperDim, marginTop: 12, textAlign: "center" }}>You'll pay directly via WhatsApp after ordering.</div>
            </div>
          </PhoneFrame>
        </div>
      );
    }

    return (
      <div style={{ background: "#0E110D", padding: "40px 16px", minHeight: 700 }}>
        <PhoneFrame>
          <TopBar title={me.name} subtitle={`ID ${me.id.slice(0, 8)}`} right={<button onClick={logout} style={{ background: "none", border: "none", color: COLORS.paperDim, cursor: "pointer" }}><LogOut size={18} /></button>} />
          <div style={{ padding: "18px 20px", flex: 1, overflowY: "auto" }}>
            {owed > 0 && (
              <div style={{ background: "rgba(180,72,60,0.12)", border: `1px solid ${COLORS.unpaid}`, borderRadius: 10, padding: "10px 14px", marginBottom: 18, fontSize: 12.5 }}>
                You have <b>{naira(owed)}</b> outstanding. Message the shop on WhatsApp to settle up.
              </div>
            )}
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, marginBottom: 12 }}>Products</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 26 }}>
              {products.map((p) => (
                <button key={p.id} onClick={() => { setCartProduct(p); setQty(1); }} disabled={p.stock === 0} style={{
                  background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "13px 15px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  cursor: p.stock === 0 ? "not-allowed" : "pointer", opacity: p.stock === 0 ? 0.5 : 1, textAlign: "left",
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: COLORS.paperDim, marginTop: 2 }}>{p.unit} · {p.stock === 0 ? "Out of stock" : `${p.stock} left`}</div>
                  </div>
                  <div style={{ color: COLORS.gold, fontWeight: 600, fontSize: 14 }}>{naira(p.price)}</div>
                </button>
              ))}
              {products.length === 0 && <div style={{ color: COLORS.paperDim, fontSize: 13 }}>No products listed yet.</div>}
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, marginBottom: 12 }}>Your orders</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {orders.length === 0 && <div style={{ color: COLORS.paperDim, fontSize: 13 }}>No orders yet.</div>}
              {orders.map((o) => (
                <div key={o.id} style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "12px 15px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12.5, color: COLORS.paperDim }}>#{o.id.slice(0, 8)}</span>
                    <Badge status={o.status} />
                  </div>
                  <div style={{ fontSize: 13.5 }}>{o.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <span style={{ fontWeight: 600 }}>{naira(o.total)}</span>
                    {o.status === "unpaid" && (
                      <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi, I'd like to pay for order #${o.id.slice(0, 8)} (${naira(o.total)})`)}`} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, color: COLORS.sage, fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>
                        <MessageCircle size={14} /> Pay on WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PhoneFrame>
        {toast && <ToastEl text={toast} />}
      </div>
    );
  }

  // ================= OWNER DASHBOARD =================
  const filteredOrders = orders.filter((o) => ownerFilter === "all" || o.status === ownerFilter);
  const totalOwed = orders.filter((o) => o.status === "unpaid").reduce((s, o) => s + o.total, 0);

  return (
    <div style={{ background: "#0E110D", padding: "40px 16px", minHeight: 700 }}>
      <PhoneFrame>
        <TopBar title="Owner dashboard" subtitle={`${orders.length} total orders`} right={<button onClick={logout} style={{ background: "none", border: "none", color: COLORS.paperDim, cursor: "pointer" }}><LogOut size={18} /></button>} />
        <div style={{ padding: "18px 20px 0", display: "flex", gap: 8 }}>
          {[["orders", "Orders"], ["catalog", "Catalog"], ["customers", "Customers"]].map(([k, label]) => (
            <button key={k} onClick={() => setOwnerTab(k)} style={{
              padding: "7px 14px", borderRadius: 20, border: `1px solid ${ownerTab === k ? COLORS.gold : COLORS.line}`,
              background: ownerTab === k ? "rgba(200,145,22,0.12)" : "transparent",
              color: ownerTab === k ? COLORS.gold : COLORS.paperDim, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            }}>{label}</button>
          ))}
        </div>

        <div style={{ padding: "16px 20px 20px", flex: 1, overflowY: "auto" }}>
          {ownerTab === "orders" && (
            <>
              <div style={{ background: COLORS.surfaceRaised, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "14px 16px", marginBottom: 18, display: "flex", justifyContent: "space-between" }}>
                <div><div style={{ fontSize: 11.5, color: COLORS.paperDim }}>Outstanding</div><div style={{ fontFamily: "'Fraunces', serif", fontSize: 19, color: COLORS.unpaid }}>{naira(totalOwed)}</div></div>
                <div style={{ textAlign: "right" }}><div style={{ fontSize: 11.5, color: COLORS.paperDim }}>Customers</div><div style={{ fontFamily: "'Fraunces', serif", fontSize: 19 }}>{customers.length}</div></div>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {[["all", "All"], ["unpaid", "Unpaid"], ["paid", "Paid"]].map(([k, label]) => (
                  <button key={k} onClick={() => setOwnerFilter(k)} style={{
                    padding: "6px 13px", borderRadius: 20, border: `1px solid ${ownerFilter === k ? COLORS.gold : COLORS.line}`,
                    background: ownerFilter === k ? "rgba(200,145,22,0.12)" : "transparent",
                    color: ownerFilter === k ? COLORS.gold : COLORS.paperDim, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  }}>{label}</button>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredOrders.map((o) => (
                  <div key={o.id} style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "12px 15px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{o.customer_name}</span>
                      <Badge status={o.status} />
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.paperDim, marginBottom: 4 }}>#{o.id.slice(0, 8)}</div>
                    <div style={{ fontSize: 13.5, marginBottom: 8 }}>{o.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 600 }}>{naira(o.total)}</span>
                      <button onClick={() => togglePaid(o)} style={{
                        fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8,
                        border: `1px solid ${o.status === "paid" ? COLORS.line : COLORS.paid}`,
                        background: o.status === "paid" ? "transparent" : "rgba(76,122,94,0.15)",
                        color: o.status === "paid" ? COLORS.paperDim : COLORS.paid, cursor: "pointer",
                      }}>{o.status === "paid" ? "Mark unpaid" : "Mark paid"}</button>
                    </div>
                  </div>
                ))}
                {filteredOrders.length === 0 && <div style={{ color: COLORS.paperDim, fontSize: 13 }}>No orders here yet.</div>}
              </div>
            </>
          )}

          {ownerTab === "catalog" && (
            <>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                Product catalog
                <button onClick={() => setShowAddProduct(true)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: COLORS.gold, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  <PackagePlus size={14} /> Add product
                </button>
              </div>
              {showAddProduct && (
                <div style={{ background: COLORS.surfaceRaised, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
                  <input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Product name" style={smallInputStyle} />
                  <input value={newProduct.unit} onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })} placeholder="Unit (e.g. 4L Keg)" style={smallInputStyle} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} placeholder="Price (₦)" inputMode="numeric" style={{ ...smallInputStyle, flex: 1 }} />
                    <input value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })} placeholder="Stock qty" inputMode="numeric" style={{ ...smallInputStyle, flex: 1 }} />
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button onClick={addProduct} style={{ flex: 1, background: COLORS.gold, color: "#1B1F19", border: "none", borderRadius: 8, padding: "9px 0", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Add to catalog</button>
                    <button onClick={() => setShowAddProduct(false)} style={{ flex: 1, background: "transparent", color: COLORS.paperDim, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "9px 0", fontSize: 12.5, cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {products.map((p) => (
                  <div key={p.id} style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "12px 15px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: editingProductId === p.id ? 10 : 0 }}>
                      <div><div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div><div style={{ fontSize: 11.5, color: COLORS.paperDim, marginTop: 2 }}>{p.unit}</div></div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => startEditProduct(p)} style={{ background: "none", border: "none", color: COLORS.sage, cursor: "pointer", padding: 4 }}><Pencil size={14} /></button>
                        <button onClick={() => deleteProduct(p.id)} style={{ background: "none", border: "none", color: COLORS.unpaid, cursor: "pointer", padding: 4 }}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {editingProductId === p.id ? (
                      <>
                        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                          <input value={editProduct.price} onChange={(e) => setEditProduct({ ...editProduct, price: e.target.value })} placeholder="Price" inputMode="numeric" style={{ ...smallInputStyle, flex: 1, marginBottom: 0 }} />
                          <input value={editProduct.stock} onChange={(e) => setEditProduct({ ...editProduct, stock: e.target.value })} placeholder="Stock" inputMode="numeric" style={{ ...smallInputStyle, flex: 1, marginBottom: 0 }} />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={saveEditProduct} style={{ flex: 1, background: COLORS.gold, color: "#1B1F19", border: "none", borderRadius: 8, padding: "8px 0", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Save</button>
                          <button onClick={() => setEditingProductId(null)} style={{ flex: 1, background: "transparent", color: COLORS.paperDim, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "8px 0", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                        <span style={{ color: COLORS.gold, fontWeight: 600, fontSize: 14 }}>{naira(p.price)}</span>
                        <span style={{ fontSize: 12, color: COLORS.paperDim }}>{p.stock} in stock</span>
                      </div>
                    )}
                  </div>
                ))}
                {products.length === 0 && <div style={{ color: COLORS.paperDim, fontSize: 13 }}>No products yet — add your first one above.</div>}
              </div>
            </>
          )}

          {ownerTab === "customers" && (
            <>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                Customers
                <button onClick={() => setShowAddCustomer(true)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: COLORS.gold, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  <UserPlus size={14} /> Add
                </button>
              </div>
              {showAddCustomer && (
                <div style={{ background: COLORS.surfaceRaised, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
                  <input value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} placeholder="Customer's name" style={smallInputStyle} />
                  <input value={newCustomer.username} onChange={(e) => setNewCustomer({ ...newCustomer, username: e.target.value })} placeholder="Username" style={smallInputStyle} />
                  <input value={newCustomer.password} onChange={(e) => setNewCustomer({ ...newCustomer, password: e.target.value })} placeholder="Temporary password" style={{ ...smallInputStyle, marginBottom: 10 }} />
                  <div style={{ fontSize: 11, color: COLORS.paperDim, marginBottom: 10, marginTop: -4 }}>They'll be required to set their own password on first login.</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={addCustomer} style={{ flex: 1, background: COLORS.gold, color: "#1B1F19", border: "none", borderRadius: 8, padding: "9px 0", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Create account</button>
                    <button onClick={() => setShowAddCustomer(false)} style={{ flex: 1, background: "transparent", color: COLORS.paperDim, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "9px 0", fontSize: 12.5, cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {customers.map((c) => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Package size={14} color={COLORS.paperDim} />
                      <span style={{ fontSize: 13.5 }}>{c.name}</span>
                      {c.must_reset && <span style={{ fontSize: 10.5, color: COLORS.gold, border: `1px solid ${COLORS.gold}`, borderRadius: 20, padding: "1px 7px" }}>pending reset</span>}
                    </div>
                    <span style={{ fontSize: 12, color: COLORS.goldSoft }}>{c.username}</span>
                  </div>
                ))}
                {customers.length === 0 && <div style={{ color: COLORS.paperDim, fontSize: 13 }}>No customers yet.</div>}
              </div>
            </>
          )}
        </div>
      </PhoneFrame>
      {toast && <ToastEl text={toast} />}
    </div>
  );
}
