const {
  useState,
  useEffect,
  useMemo,
  useCallback
} = React;

/* ============================================================
   AMCARS · MELBUS — Касса / Разбивки / Дашборд / Справочник
   Design tokens:
   - bg-base   #14131A  (asphalt)
   - bg-surface #1B1924 (panel)
   - bg-raised #2A2732  (card)
   - line     #322E3A
   - text-hi  #EDE8DD
   - text-lo  #A79E8C
   - amber    #EDE8DD   (signature accent — road marking)
   - green    #34D399   (income)
   - rust     #FB5D5D   (expense)
   - steel    #9C9486   (transfer / neutral)
   Type: display = "Space Grotesk", numbers = "JetBrains Mono", body = system-ui
   Signature: odometer-style tabular readouts for every amount
   ============================================================ */

const FONT_LINK_ID = "lpl-fonts";
function ensureFonts() {
  // Intentionally a no-op now: we use system fonts only, to avoid extra
  // network round-trips to fonts.googleapis.com on slow connections.
  // Kept as a function so call sites don't need to change.
}
const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthKey = iso => iso.slice(0, 7);
function fmt(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("pl-PL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}
const COMPANIES = ["AMCARS", "MELBUS"];
const COMPANY_COLORS = {
  AMCARS: "#7DD3C0",
  MELBUS: "#E3A576"
};
const PARTNERS = ["GLS", "DPD"];
const DEFAULT_STATE = {
  version: 1,
  company: "AMCARS · MELBUS",
  categories: {
    income: ["Доход", "Прочее"],
    expense: ["Зарплата", "Топливо", "Аренда/Лизинг", "Ремонт", "Налоги", "Комиссии", "Мойка/бытовое", "Долги", "Перевод между кассами", "Прочее"]
  },
  districts: [{
    id: uid(),
    name: "1240",
    partner: "GLS"
  }, {
    id: uid(),
    name: "5204",
    partner: "DPD"
  }, {
    id: uid(),
    name: "3310",
    partner: "GLS"
  }],
  vehicles: [{
    id: uid(),
    name: "Бус (аренда)",
    status: "аренда",
    payingCompany: "AMCARS",
    partner: "GLS"
  }, {
    id: uid(),
    name: "Тойота",
    status: "своя",
    payingCompany: "MELBUS",
    partner: "DPD"
  }],
  transactions: [],
  incomeSplits: [],
  fuelSplits: [],
  notes: []
};
const STORE_KEY = "lpl-store-v1";
function useStore() {
  const [state, setState] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let unsubscribe = null;
    if (window.storage.listen) {
      // Live mode: fires immediately with current data, then again on every
      // change made by this device OR any partner's device.
      unsubscribe = window.storage.listen(STORE_KEY, rawValue => {
        if (cancelled) return;
        try {
          const parsed = rawValue ? JSON.parse(rawValue) : {};
          setState({
            ...DEFAULT_STATE,
            ...parsed
          });
        } catch (e) {
          setState(prev => prev || DEFAULT_STATE);
        }
        setStatus("ready");
      });
    } else {
      // Fallback: one-time load (older bridge without live listening)
      (async () => {
        try {
          const res = await window.storage.get(STORE_KEY, true);
          if (cancelled) return;
          if (res && res.value) {
            const parsed = JSON.parse(res.value);
            setState({
              ...DEFAULT_STATE,
              ...parsed
            });
          } else {
            setState(DEFAULT_STATE);
          }
          setStatus("ready");
        } catch (e) {
          if (cancelled) return;
          setState(DEFAULT_STATE);
          setStatus("ready");
        }
      })();
    }
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);
  const persist = useCallback(async next => {
    setSaving(true);
    try {
      await window.storage.set(STORE_KEY, JSON.stringify(next), true);
      setSaveError(false);
    } catch (e) {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }, []);
  const update = useCallback(updater => {
    setState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      persist(next);
      return next;
    });
  }, [persist]);
  return {
    state,
    update,
    status,
    saving,
    saveError
  };
}

/* ---------------- small UI atoms ---------------- */

function Odometer({
  value,
  size = "lg",
  tone = "hi",
  prefix = "",
  suffix = "\u00A0zł",
  colorOverride
}) {
  const sizes = {
    sm: "16px",
    sm2: "18px",
    md: "20px",
    lg: "30px",
    xl: "40px"
  };
  const tones = {
    hi: "#EDE8DD",
    green: "#34D399",
    rust: "#FB5D5D",
    amber: "#EDE8DD",
    steel: "#9C9486",
    lo: "#A79E8C"
  };
  const formatted = fmt(value).replace(/\s/g, "\u00A0");
  const color = colorOverride || tones[tone];
  return /*#__PURE__*/React.createElement("span", {
    key: formatted,
    className: "lpl-flip",
    style: {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      fontVariantNumeric: "tabular-nums",
      fontSize: sizes[size],
      color,
      fontWeight: 600,
      letterSpacing: "0.02em",
      whiteSpace: "nowrap",
      display: "inline-block"
    }
  }, prefix, formatted, /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.55,
      fontWeight: 500
    }
  }, suffix));
}
function Pill({
  active,
  onClick,
  children,
  tone = "amber",
  color
}) {
  const tones = {
    amber: "#EDE8DD",
    green: "#34D399",
    rust: "#FB5D5D",
    steel: "#9C9486"
  };
  const c = color || tones[tone];
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      padding: "7px 13px",
      borderRadius: 999,
      border: `1px solid ${active ? c : "#322E3A"}`,
      background: active ? `${c}1A` : "transparent",
      color: active ? c : "#A79E8C",
      fontSize: 13,
      fontWeight: 600,
      whiteSpace: "nowrap",
      cursor: "pointer",
      transition: "all .15s ease"
    }
  }, children);
}
function Card({
  children,
  style,
  className
}) {
  const cls = ["lpl-stack", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", {
    className: cls,
    style: {
      background: "#1E1C26",
      border: "1px solid #322E3A",
      boxShadow: "0 1px 2px #00000030",
      borderRadius: 18,
      padding: 16,
      position: "relative",
      zIndex: 0,
      ...style
    }
  }, children);
}
function Field({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "block",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#A79E8C",
      marginBottom: 6,
      fontWeight: 600
    }
  }, label), children);
}
const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  background: "#14131A",
  border: "1px solid #322E3A",
  borderRadius: 10,
  padding: "11px 12px",
  color: "#EDE8DD",
  fontSize: 15,
  fontFamily: "inherit",
  outline: "none"
};
function Select({
  value,
  onChange,
  options,
  placeholder
}) {
  return /*#__PURE__*/React.createElement("select", {
    value: value,
    onChange: e => onChange(e.target.value),
    style: {
      ...inputStyle,
      appearance: "auto"
    }
  }, placeholder && /*#__PURE__*/React.createElement("option", {
    value: ""
  }, placeholder), options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o
  }, o)));
}
function Empty({
  title,
  hint
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "36px 16px",
      color: "#A79E8C",
      border: "1px dashed #322E3A",
      borderRadius: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: "#EDE8DD",
      fontWeight: 600,
      marginBottom: 4
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13
    }
  }, hint));
}

/* ---------------- period helper ---------------- */

function usePeriod() {
  const [mode, setMode] = useState("month"); // month | all | custom
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const inRange = useCallback(iso => {
    if (mode === "all") return true;
    if (mode === "month") return monthKey(iso) === month;
    return iso >= from && iso <= to;
  }, [mode, month, from, to]);
  return {
    mode,
    setMode,
    month,
    setMonth,
    from,
    setFrom,
    to,
    setTo,
    inRange
  };
}

/* ================= MAIN APP ================= */

const LOGIN = "amcarspolska@gmail.com";
const PASSWORD = "2026";
function LoginScreen({
  onSuccess
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  function submit() {
    if (password === PASSWORD) {
      onSuccess();
    } else {
      setError("Неверный пароль");
    }
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...shellStyle,
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: 340
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      justifyContent: "center",
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 12,
      height: 12,
      borderRadius: 3,
      background: `linear-gradient(135deg, ${COMPANY_COLORS.AMCARS} 0%, #9C9486 50%, ${COMPANY_COLORS.MELBUS} 100%)`,
      transform: "rotate(45deg)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontWeight: 700,
      fontSize: 20,
      letterSpacing: "0.04em"
    }
  }, "AMCARS · MELBUS")), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(Field, {
    label: "Логин"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...inputStyle,
      color: "#A79E8C",
      background: "#1A1820",
      userSelect: "none"
    }
  }, LOGIN)), /*#__PURE__*/React.createElement(Field, {
    label: "Пароль"
  }, /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: password,
    onChange: e => setPassword(e.target.value),
    onKeyDown: e => e.key === "Enter" && submit(),
    placeholder: "••••••••",
    style: inputStyle,
    autoFocus: true
  })), error && /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#FB5D5D",
      fontSize: 12.5,
      marginBottom: 10
    }
  }, error), /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    style: primaryBtnStyle
  }, "Войти"))));
}
function App() {
  useEffect(() => {
    ensureFonts();
  }, []);
  const {
    state,
    update,
    status,
    saving,
    saveError
  } = useStore();
  const [tab, setTab] = useState("dash");
  const [authed, setAuthed] = useState(false);
  if (!authed) {
    return /*#__PURE__*/React.createElement(LoginScreen, {
      onSuccess: () => setAuthed(true)
    });
  }
  if (status === "loading" || !state) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: "100vh",
        maxWidth: 480,
        margin: "0 auto",
        background: "linear-gradient(180deg, #14131A 0%, #0C0B10 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 22,
        height: 22,
        borderRadius: 6,
        background: `linear-gradient(135deg, ${COMPANY_COLORS.AMCARS} 0%, #9C9486 50%, ${COMPANY_COLORS.MELBUS} 100%)`,
        transform: "rotate(45deg)",
        boxShadow: "0 0 24px #00000040"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        color: "#EDE8DD",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontWeight: 700,
        fontSize: 15,
        letterSpacing: "0.04em"
      }
    }, "AMCARS · MELBUS"), /*#__PURE__*/React.createElement("div", {
      style: {
        color: "#8C8474",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize: 13
      }
    }, "загрузка данных…"));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: shellStyle
  }, /*#__PURE__*/React.createElement("style", null, `
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 0; height: 0; }
        button { font-family: inherit; }
        input::placeholder { color: #8C8474; }

        .lpl-stack::before {
          content: "";
          position: absolute;
          inset: 7px -6px -6px 7px;
          background: #17151D;
          border: 1px solid #2A2732;
          border-radius: 18px;
          z-index: -1;
        }

        @media (prefers-reduced-motion: no-preference) {
          .lpl-flip {
            animation: lpl-flip-in 480ms cubic-bezier(.16,.9,.2,1);
            transform-origin: 50% 50%;
          }
          @keyframes lpl-flip-in {
            0%   { opacity: 0; transform: translateY(-14px) scaleY(0.4) rotateX(60deg); filter: blur(3px); }
            45%  { opacity: 1; transform: translateY(2px) scaleY(1.08) rotateX(-8deg); filter: blur(0); }
            70%  { transform: translateY(-1px) scaleY(0.98) rotateX(4deg); }
            100% { opacity: 1; transform: translateY(0) scaleY(1) rotateX(0); }
          }

          .lpl-tab-enter {
            animation: lpl-tab-in 320ms ease;
          }
          @keyframes lpl-tab-in {
            0%   { opacity: 0; }
            100% { opacity: 1; }
          }

          .lpl-card-in {
            animation: lpl-card-in 460ms cubic-bezier(.16,.9,.2,1) both;
          }
          @keyframes lpl-card-in {
            0%   { opacity: 0; transform: translateY(16px) scale(0.97); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
        }
      `), /*#__PURE__*/React.createElement(Header, {
    company: state.company,
    saving: saving,
    saveError: saveError
  }), /*#__PURE__*/React.createElement("div", {
    key: tab,
    className: "lpl-tab-enter",
    style: {
      flex: 1,
      overflowY: "auto",
      padding: "0 14px 150px"
    }
  }, tab === "dash" && /*#__PURE__*/React.createElement(Dashboard, {
    state: state
  }), tab === "ledger" && /*#__PURE__*/React.createElement(Ledger, {
    state: state,
    update: update
  }), tab === "splits" && /*#__PURE__*/React.createElement(Splits, {
    state: state,
    update: update
  }), tab === "notes" && /*#__PURE__*/React.createElement(Notes, {
    state: state,
    update: update
  }), tab === "settings" && /*#__PURE__*/React.createElement(Settings, {
    state: state,
    update: update
  })), /*#__PURE__*/React.createElement(BottomNav, {
    tab: tab,
    setTab: setTab
  }));
}
const shellStyle = {
  minHeight: "100vh",
  background: `
    radial-gradient(circle at 1.5px 1.5px, #FFFFFF08 1px, transparent 1.5px),
    radial-gradient(900px 600px at 50% -5%, #211E28 0%, transparent 60%),
    linear-gradient(180deg, #17151D 0%, #0C0B10 100%)
  `,
  backgroundSize: "3px 3px, auto, auto",
  color: "#EDE8DD",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  display: "flex",
  flexDirection: "column",
  maxWidth: 480,
  margin: "0 auto",
  position: "relative",
  paddingTop: "env(safe-area-inset-top)",
  paddingBottom: "env(safe-area-inset-bottom)"
};
function Header({
  company,
  saving,
  saveError
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 16px 10px",
      borderBottom: "1px solid #2A2732",
      position: "sticky",
      top: 0,
      background: "#14131Aee",
      backdropFilter: "blur(6px)",
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 9,
      height: 9,
      borderRadius: 2,
      background: `linear-gradient(135deg, ${COMPANY_COLORS.AMCARS} 0%, #9C9486 50%, ${COMPANY_COLORS.MELBUS} 100%)`,
      transform: "rotate(45deg)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontWeight: 700,
      fontSize: 17,
      letterSpacing: "0.04em"
    }
  }, company)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 600,
      color: saveError ? "#FB5D5D" : saving ? "#EDE8DD" : "#34D399"
    }
  }, saveError ? "⚠ не сохранено" : saving ? "сохранение…" : "✓ сохранено")));
}
function BottomNav({
  tab,
  setTab
}) {
  const items = [{
    id: "dash",
    label: "Дашборд",
    glyph: "▤"
  }, {
    id: "ledger",
    label: "Касса",
    glyph: "≡"
  }, {
    id: "splits",
    label: "Разбивки",
    glyph: "⑃"
  }, {
    id: "notes",
    label: "Заметки",
    glyph: "✎"
  }, {
    id: "settings",
    label: "Справочник",
    glyph: "⚙"
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "sticky",
      bottom: 0,
      padding: "0 10px calc(10px + env(safe-area-inset-bottom))",
      maxWidth: 480,
      width: "100%",
      background: "linear-gradient(0deg, #0C0B10 40%, #0C0B1000 100%)",
      pointerEvents: "none",
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      borderRadius: 20,
      border: "1px solid #322E3A",
      background: "#1A1820f5",
      backdropFilter: "blur(10px)",
      boxShadow: "0 10px 30px #00000060",
      padding: 5,
      pointerEvents: "auto"
    }
  }, items.map(it => {
    const active = tab === it.id;
    return /*#__PURE__*/React.createElement("button", {
      key: it.id,
      onClick: () => setTab(it.id),
      style: {
        flex: 1,
        background: active ? "#EDE8DD18" : "none",
        border: "none",
        borderRadius: 15,
        padding: "8px 0 7px",
        color: active ? "#EDE8DD" : "#8C8474",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        cursor: "pointer",
        transition: "background .18s ease, color .18s ease"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        lineHeight: 1
      }
    }, it.glyph), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9.5,
        fontWeight: 600
      }
    }, it.label));
  })));
}

/* ================= LEDGER (Касса) ================= */

const RECEIPT_PROXY_URL = "https://lpl-receipt-proxy.edgar-lekh99.workers.dev";
function Ledger({
  state,
  update
}) {
  const [showForm, setShowForm] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [filterMethod, setFilterMethod] = useState("all");
  const [filterCompany, setFilterCompany] = useState("all");
  const [search, setSearch] = useState("");
  const period = usePeriod();
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.transactions.filter(t => period.inRange(t.date)).filter(t => filterMethod === "all" || t.method === filterMethod).filter(t => filterCompany === "all" || t.company === filterCompany).filter(t => {
      if (!q) return true;
      const haystack = `${t.category || ""} ${t.comment || ""}`.toLowerCase();
      return haystack.includes(q);
    }).sort((a, b) => a.date < b.date ? 1 : -1);
  }, [state.transactions, period, filterMethod, filterCompany, search]);
  function addTx(tx) {
    update(prev => ({
      ...prev,
      transactions: [...prev.transactions, {
        id: uid(),
        ...tx
      }]
    }));
    setShowForm(false);
  }
  function addManyTx(txs) {
    update(prev => ({
      ...prev,
      transactions: [...prev.transactions, ...txs.map(tx => ({
        id: uid(),
        ...tx
      }))]
    }));
    setShowScan(false);
  }
  function removeTx(id) {
    update(prev => ({
      ...prev,
      transactions: prev.transactions.filter(t => t.id !== id)
    }));
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PeriodBar, {
    period: period
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      margin: "12px 0",
      flexWrap: "wrap"
    }
  }, ["all", "cash", "card"].map(m => /*#__PURE__*/React.createElement(Pill, {
    key: m,
    active: filterMethod === m,
    onClick: () => setFilterMethod(m)
  }, m === "all" ? "Всё" : m === "cash" ? "Наличка" : "Карта"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 12,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    active: filterCompany === "all",
    tone: "steel",
    onClick: () => setFilterCompany("all")
  }, "Все фирмы"), COMPANIES.map(c => /*#__PURE__*/React.createElement(Pill, {
    key: c,
    active: filterCompany === c,
    color: COMPANY_COLORS[c],
    onClick: () => setFilterCompany(c)
  }, c))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: search,
    onChange: e => setSearch(e.target.value),
    placeholder: "Поиск по категории или комментарию…",
    style: {
      ...inputStyle,
      paddingRight: search ? 34 : 12
    }
  }), search && /*#__PURE__*/React.createElement("button", {
    onClick: () => setSearch(""),
    style: {
      position: "absolute",
      right: 8,
      top: "50%",
      transform: "translateY(-50%)",
      background: "none",
      border: "none",
      color: "#8C8474",
      fontSize: 15,
      cursor: "pointer"
    }
  }, "✕")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowScan(true),
    style: scanButtonStyle
  }, "📷 Загрузить скриншот банка"), list.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    title: search ? "Ничего не найдено" : "Пока нет операций",
    hint: search ? "Попробуйте другой запрос" : "Добавьте первую запись кнопкой ниже"
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, list.map((t, i) => /*#__PURE__*/React.createElement(TxRow, {
    key: t.id,
    tx: t,
    onDelete: () => removeTx(t.id),
    animDelay: i < 6 ? i * 35 : 0
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowForm(true),
    style: fabStyle
  }, "+"), showForm && /*#__PURE__*/React.createElement(TxForm, {
    categories: state.categories,
    onCancel: () => setShowForm(false),
    onSave: addTx
  }), showScan && /*#__PURE__*/React.createElement(ReceiptScanForm, {
    onCancel: () => setShowScan(false),
    onSave: addManyTx
  }));
}
const scanButtonStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: 12,
  border: "1px dashed #9C9486",
  background: "#9C948614",
  color: "#9C9486",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  marginBottom: 12
};
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function ReceiptScanForm({
  onCancel,
  onSave
}) {
  const [stage, setStage] = useState("company"); // company | pick | loading | review | error
  const [company, setCompany] = useState(COMPANIES[0]);
  const [rows, setRows] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setStage("loading");
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch(RECEIPT_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          image: base64,
          mediaType: file.type || "image/png"
        })
      });
      if (!res.ok) throw new Error("Сервис распознавания недоступен");
      const data = await res.json();
      if (!data.transactions || data.transactions.length === 0) {
        setErrorMsg("Не удалось найти операции на скриншоте. Попробуйте другой скриншот или добавьте вручную.");
        setStage("error");
        return;
      }
      setRows(data.transactions.map(t => ({
        date: t.date || todayISO(),
        amount: t.amount != null ? String(t.amount) : "",
        type: t.type === "income" ? "income" : "expense",
        method: t.method === "cash" ? "cash" : "card",
        company,
        category: t.suggestedCategory || "",
        comment: t.comment || "",
        include: true
      })));
      setStage("review");
    } catch (err) {
      setErrorMsg("Ошибка распознавания. Проверьте интернет-соединение и попробуйте снова.");
      setStage("error");
    }
  }
  function updateRow(i, patch) {
    setRows(prev => prev.map((r, idx) => idx === i ? {
      ...r,
      ...patch
    } : r));
  }
  function submit() {
    const toSave = rows.filter(r => r.include && r.amount).map(r => ({
      date: r.date,
      amount: Number(r.amount),
      type: r.type,
      method: r.method,
      company: r.method === "card" ? r.company : null,
      category: r.category || (r.type === "income" ? "Доход" : "Прочее"),
      comment: r.comment
    }));
    if (toSave.length === 0) return;
    onSave(toSave);
  }
  const footer = stage === "company" ? /*#__PURE__*/React.createElement("button", {
    onClick: () => setStage("pick"),
    style: primaryBtnStyle
  }, "Далее") : stage === "pick" ? /*#__PURE__*/React.createElement("label", {
    style: pickFileLabelStyle
  }, "Выбрать скриншот", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    onChange: handleFile,
    style: {
      display: "none"
    }
  })) : stage === "error" ? /*#__PURE__*/React.createElement("label", {
    style: pickFileLabelStyle
  }, "Попробовать снова", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    onChange: handleFile,
    style: {
      display: "none"
    }
  })) : stage === "review" ? /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    style: primaryBtnStyle
  }, "Сохранить выбранные операции") : null;
  return /*#__PURE__*/React.createElement(Sheet, {
    title: "Скриншот банка",
    onClose: onCancel,
    footer: footer
  }, stage === "company" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#A79E8C",
      marginBottom: 14
    }
  }, "Со счёта какой фирмы этот скриншот? Это определит, к какой карте применятся найденные операции."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 16
    }
  }, COMPANIES.map(c => /*#__PURE__*/React.createElement(Pill, {
    key: c,
    active: company === c,
    color: COMPANY_COLORS[c],
    onClick: () => setCompany(c)
  }, c)))), stage === "pick" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#A79E8C",
      marginBottom: 14
    }
  }, "Загрузите скриншот банковской выписки счёта ", /*#__PURE__*/React.createElement("b", null, company), " — операции распознаются автоматически, вы сможете проверить и поправить их перед сохранением.")), stage === "loading" && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "30px 0",
      color: "#A79E8C"
    }
  }, "Распознаём скриншот…"), stage === "error" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#FB5D5D",
      fontSize: 13.5,
      marginBottom: 14
    }
  }, errorMsg)), stage === "review" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "#A79E8C",
      marginBottom: 12
    }
  }, "Найдено операций: ", rows.length, ", счёт ", /*#__PURE__*/React.createElement("b", null, company), ". Проверьте и поправьте перед сохранением."), rows.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      border: "1px solid #322E3A",
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      opacity: r.include ? 1 : 0.4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: r.include,
    onChange: e => updateRow(i, {
      include: e.target.checked
    })
  }), "включить"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    active: r.type === "income",
    tone: "green",
    onClick: () => updateRow(i, {
      type: "income"
    })
  }, "Доход"), /*#__PURE__*/React.createElement(Pill, {
    active: r.type === "expense",
    tone: "rust",
    onClick: () => updateRow(i, {
      type: "expense"
    })
  }, "Расход"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: r.amount,
    onChange: e => updateRow(i, {
      amount: e.target.value
    }),
    placeholder: "Сумма",
    style: {
      ...inputStyle,
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: r.date,
    onChange: e => updateRow(i, {
      date: e.target.value
    }),
    style: {
      ...inputStyle,
      width: 130
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    active: r.method === "cash",
    onClick: () => updateRow(i, {
      method: "cash"
    })
  }, "Наличка"), /*#__PURE__*/React.createElement(Pill, {
    active: r.method === "card",
    onClick: () => updateRow(i, {
      method: "card"
    })
  }, "Карта")), /*#__PURE__*/React.createElement("input", {
    value: r.category,
    onChange: e => updateRow(i, {
      category: e.target.value
    }),
    placeholder: "Категория",
    style: {
      ...inputStyle,
      marginBottom: 8
    }
  }), /*#__PURE__*/React.createElement("input", {
    value: r.comment,
    onChange: e => updateRow(i, {
      comment: e.target.value
    }),
    placeholder: "Комментарий",
    style: inputStyle
  })))));
}
const pickFileLabelStyle = {
  display: "block",
  textAlign: "center",
  padding: "14px",
  borderRadius: 12,
  border: "1px solid #EDE8DD",
  color: "#EDE8DD",
  fontWeight: 700,
  cursor: "pointer"
};
function PeriodBar({
  period
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 14,
      display: "flex",
      gap: 8,
      alignItems: "center"
    }
  }, ["month", "all", "custom"].map(m => /*#__PURE__*/React.createElement(Pill, {
    key: m,
    active: period.mode === m,
    onClick: () => period.setMode(m),
    tone: "steel"
  }, m === "month" ? "Месяц" : m === "all" ? "Всё время" : "Период")), period.mode === "month" && /*#__PURE__*/React.createElement("input", {
    type: "month",
    value: period.month,
    onChange: e => period.setMonth(e.target.value),
    style: {
      ...inputStyle,
      width: 140,
      padding: "6px 8px",
      fontSize: 13
    }
  }), period.mode === "custom" && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: period.from,
    onChange: e => period.setFrom(e.target.value),
    style: {
      ...inputStyle,
      width: 120,
      padding: "6px 8px",
      fontSize: 12
    }
  }), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: period.to,
    onChange: e => period.setTo(e.target.value),
    style: {
      ...inputStyle,
      width: 120,
      padding: "6px 8px",
      fontSize: 12
    }
  })));
}
const toneForType = {
  income: "green",
  expense: "rust",
  transfer: "steel"
};
const signForType = {
  income: "+",
  expense: "−",
  transfer: "⇄"
};
function TxRow({
  tx,
  onDelete,
  animDelay = 0
}) {
  const [open, setOpen] = useState(false);
  return /*#__PURE__*/React.createElement(Card, {
    className: "lpl-card-in",
    style: {
      padding: 12,
      animationDelay: `${animDelay}ms`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      cursor: "pointer"
    },
    onClick: () => setOpen(o => !o)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: "#EDE8DD",
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, tx.category, tx.company && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      fontSize: 10.5,
      fontWeight: 600,
      color: "#9C9486"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: COMPANY_COLORS[tx.company] || "#9C9486",
      display: "inline-block"
    }
  }), tx.company)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#A79E8C",
      marginTop: 2
    }
  }, tx.date, " ·", " ", tx.type === "transfer" ? tx.direction === "cash_to_card" ? "нал → карта" : "карта → нал" : tx.method === "cash" ? "нал" : "карта", tx.comment ? ` · ${tx.comment}` : "")), /*#__PURE__*/React.createElement(Odometer, {
    value: tx.amount,
    size: "md",
    tone: toneForType[tx.type],
    prefix: signForType[tx.type] + " "
  })), open && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onDelete,
    style: deleteBtnStyle
  }, "Удалить запись")));
}
function DirectionOption({
  active,
  onClick,
  fromLabel,
  toLabel,
  hint
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      textAlign: "left",
      padding: "12px 14px",
      borderRadius: 12,
      border: `1px solid ${active ? "#9C9486" : "#322E3A"}`,
      background: active ? "#9C94861A" : "#14131A",
      cursor: "pointer",
      color: "#EDE8DD"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", null, fromLabel), /*#__PURE__*/React.createElement("span", {
    style: {
      color: active ? "#9C9486" : "#8C8474"
    }
  }, "→"), /*#__PURE__*/React.createElement("span", null, toLabel)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "#A79E8C",
      marginTop: 3
    }
  }, hint)), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 18,
      height: 18,
      borderRadius: "50%",
      border: `2px solid ${active ? "#9C9486" : "#4E4A42"}`,
      background: active ? "#9C9486" : "transparent",
      flexShrink: 0
    }
  }));
}
function TxForm({
  categories,
  onCancel,
  onSave
}) {
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [direction, setDirection] = useState("card_to_cash"); // for transfer
  const [company, setCompany] = useState(COMPANIES[0]);
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(todayISO());
  const [comment, setComment] = useState("");
  const catList = type === "income" ? categories.income : type === "expense" ? categories.expense : ["Перевод между кассами"];
  const needsCompany = type === "transfer" || method === "card";
  function submit() {
    if (!amount) return;
    if (type === "transfer") {
      onSave({
        type,
        amount: Number(amount),
        direction,
        method: direction === "cash_to_card" ? "cash" : "card",
        // source, for display in ledger row
        company,
        category: "Перевод между кассами",
        date,
        comment
      });
      return;
    }
    if (!category) return;
    onSave({
      type,
      amount: Number(amount),
      method,
      company: method === "card" ? company : null,
      category,
      date,
      comment
    });
  }
  return /*#__PURE__*/React.createElement(Sheet, {
    title: "Новая операция",
    onClose: onCancel,
    footer: /*#__PURE__*/React.createElement("button", {
      onClick: submit,
      style: primaryBtnStyle
    }, "Сохранить")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 14
    }
  }, [{
    id: "income",
    label: "Доход",
    tone: "green"
  }, {
    id: "expense",
    label: "Расход",
    tone: "rust"
  }, {
    id: "transfer",
    label: "Перевод",
    tone: "steel"
  }].map(o => /*#__PURE__*/React.createElement(Pill, {
    key: o.id,
    active: type === o.id,
    tone: o.tone,
    onClick: () => {
      setType(o.id);
      setCategory("");
    }
  }, o.label))), /*#__PURE__*/React.createElement(Field, {
    label: "Сумма"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    inputMode: "decimal",
    value: amount,
    onChange: e => setAmount(e.target.value),
    placeholder: "0",
    style: inputStyle
  })), type === "transfer" ? /*#__PURE__*/React.createElement(Field, {
    label: "Направление перевода"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(DirectionOption, {
    active: direction === "card_to_cash",
    onClick: () => setDirection("card_to_cash"),
    fromLabel: "Карта",
    toLabel: "Наличка",
    hint: "Например: сняли деньги в банкомате"
  }), /*#__PURE__*/React.createElement(DirectionOption, {
    active: direction === "cash_to_card",
    onClick: () => setDirection("cash_to_card"),
    fromLabel: "Наличка",
    toLabel: "Карта",
    hint: "Например: внесли наличные на карту/счёт"
  }))) : /*#__PURE__*/React.createElement(Field, {
    label: "Способ оплаты"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    active: method === "cash",
    onClick: () => setMethod("cash")
  }, "Наличка"), /*#__PURE__*/React.createElement(Pill, {
    active: method === "card",
    onClick: () => setMethod("card")
  }, "Карта"))), needsCompany && /*#__PURE__*/React.createElement(Field, {
    label: type === "transfer" ? "Карта какой фирмы" : "Фирма"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, COMPANIES.map(c => /*#__PURE__*/React.createElement(Pill, {
    key: c,
    active: company === c,
    color: COMPANY_COLORS[c],
    onClick: () => setCompany(c)
  }, c)))), type !== "transfer" && /*#__PURE__*/React.createElement(Field, {
    label: "Категория"
  }, /*#__PURE__*/React.createElement(Select, {
    value: category,
    onChange: setCategory,
    options: catList,
    placeholder: "Выбрать категорию"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Дата"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: date,
    onChange: e => setDate(e.target.value),
    style: inputStyle
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Комментарий (необязательно)"
  }, /*#__PURE__*/React.createElement("input", {
    value: comment,
    onChange: e => setComment(e.target.value),
    placeholder: "Например: DPD за март",
    style: inputStyle
  })));
}

/* ================= SPLITS (Разбивки) ================= */

function Splits({
  state,
  update
}) {
  const [mode, setMode] = useState("income"); // income | fuel
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    active: mode === "income",
    tone: "green",
    onClick: () => setMode("income")
  }, "По районам"), /*#__PURE__*/React.createElement(Pill, {
    active: mode === "fuel",
    tone: "rust",
    onClick: () => setMode("fuel")
  }, "По машинам")), mode === "income" ? /*#__PURE__*/React.createElement(SplitBlock, {
    state: state,
    update: update,
    storeKey: "incomeSplits",
    targets: state.districts,
    targetLabel: "Район",
    tone: "green",
    invoiceHint: "Например: DPD март 2026"
  }) : /*#__PURE__*/React.createElement(SplitBlock, {
    state: state,
    update: update,
    storeKey: "fuelSplits",
    targets: state.vehicles,
    targetLabel: "Машина",
    tone: "rust",
    invoiceHint: "Например: DKV топливо март"
  }));
}
function SplitBlock({
  state,
  update,
  storeKey,
  targets,
  targetLabel,
  tone,
  invoiceHint
}) {
  const [showForm, setShowForm] = useState(false);
  const [filterCompany, setFilterCompany] = useState("all");
  const splits = state[storeKey];
  function addSplit(split) {
    update(prev => ({
      ...prev,
      [storeKey]: [...prev[storeKey], {
        id: uid(),
        ...split
      }]
    }));
    setShowForm(false);
  }
  function removeSplit(id) {
    update(prev => ({
      ...prev,
      [storeKey]: prev[storeKey].filter(s => s.id !== id)
    }));
  }
  if (targets.length === 0) {
    return /*#__PURE__*/React.createElement(Empty, {
      title: `Нет списка «${targetLabel}»`,
      hint: "Добавьте хотя бы один вариант в Справочнике, прежде чем делать разбивку"
    });
  }
  const filteredSplits = splits.filter(s => filterCompany === "all" || s.company === filterCompany);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 12,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    active: filterCompany === "all",
    tone: "steel",
    onClick: () => setFilterCompany("all")
  }, "Все фирмы"), COMPANIES.map(c => /*#__PURE__*/React.createElement(Pill, {
    key: c,
    active: filterCompany === c,
    color: COMPANY_COLORS[c],
    onClick: () => setFilterCompany(c)
  }, c))), filteredSplits.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    title: "Разбивок ещё нет",
    hint: "Распределите фактуру по позициям ниже"
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, filteredSplits.slice().sort((a, b) => a.date < b.date ? 1 : -1).map(s => /*#__PURE__*/React.createElement(SplitCard, {
    key: s.id,
    split: s,
    targets: targets,
    tone: tone,
    onDelete: () => removeSplit(s.id)
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowForm(true),
    style: fabStyle
  }, "+"), showForm && /*#__PURE__*/React.createElement(SplitForm, {
    targets: targets,
    targetLabel: targetLabel,
    invoiceHint: invoiceHint,
    onCancel: () => setShowForm(false),
    onSave: addSplit
  }));
}
function SplitCard({
  split,
  targets,
  tone,
  onDelete
}) {
  const [open, setOpen] = useState(false);
  const allocSum = split.allocations.reduce((a, x) => a + Number(x.amount || 0), 0);
  const diff = Number(split.total) - allocSum;
  const nameOf = id => targets.find(t => t.id === id)?.name || "—";
  return /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      cursor: "pointer"
    },
    onClick: () => setOpen(o => !o)
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 14,
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, split.label || "Фактура", split.company && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      fontSize: 10.5,
      fontWeight: 600,
      color: "#9C9486"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: COMPANY_COLORS[split.company] || "#9C9486",
      display: "inline-block"
    }
  }), split.company)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#A79E8C",
      marginTop: 2
    }
  }, split.date)), /*#__PURE__*/React.createElement(Odometer, {
    value: split.total,
    size: "md",
    tone: tone,
    prefix: ""
  })), open && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      borderTop: "1px solid #322E3A",
      paddingTop: 10
    }
  }, split.allocations.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: 13,
      padding: "5px 0",
      color: "#EDE8DD"
    }
  }, /*#__PURE__*/React.createElement("span", null, nameOf(a.targetId)), /*#__PURE__*/React.createElement(Odometer, {
    value: a.amount,
    size: "sm",
    tone: "hi"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: 6,
      paddingTop: 6,
      borderTop: "1px dashed #322E3A",
      fontSize: 12,
      color: diff === 0 ? "#34D399" : "#FB5D5D",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    }
  }, /*#__PURE__*/React.createElement("span", null, diff === 0 ? "✓ сходится с фактурой" : "⚠ расхождение"), /*#__PURE__*/React.createElement("span", null, diff !== 0 ? `${diff > 0 ? "+" : ""}${fmt(diff)}` : "")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right",
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onDelete,
    style: deleteBtnStyle
  }, "Удалить разбивку"))));
}
function SplitForm({
  targets,
  targetLabel,
  invoiceHint,
  onCancel,
  onSave
}) {
  const [label, setLabel] = useState("");
  const [total, setTotal] = useState("");
  const [date, setDate] = useState(todayISO());
  const [company, setCompany] = useState(COMPANIES[0]);
  const [rows, setRows] = useState(targets.map(t => ({
    targetId: t.id,
    amount: ""
  })));
  const allocSum = rows.reduce((a, r) => a + Number(r.amount || 0), 0);
  const diff = Number(total || 0) - allocSum;
  function setRowAmount(idx, val) {
    setRows(prev => prev.map((r, i) => i === idx ? {
      ...r,
      amount: val
    } : r));
  }
  function submit() {
    if (!total) return;
    const allocations = rows.filter(r => Number(r.amount) > 0).map(r => ({
      targetId: r.targetId,
      amount: Number(r.amount)
    }));
    if (allocations.length === 0) return;
    onSave({
      label,
      total: Number(total),
      date,
      company,
      allocations
    });
  }
  return /*#__PURE__*/React.createElement(Sheet, {
    title: `Разбивка · ${targetLabel}`,
    onClose: onCancel,
    footer: /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        fontSize: 13,
        marginBottom: 10,
        color: diff === 0 ? "#34D399" : "#FB5D5D",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
      }
    }, /*#__PURE__*/React.createElement("span", null, "Остаток к распределению"), /*#__PURE__*/React.createElement("span", null, fmt(diff), " zł")), /*#__PURE__*/React.createElement("button", {
      onClick: submit,
      style: primaryBtnStyle
    }, "Сохранить разбивку"))
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Со счёта какой фирмы фактура"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, COMPANIES.map(c => /*#__PURE__*/React.createElement(Pill, {
    key: c,
    active: company === c,
    color: COMPANY_COLORS[c],
    onClick: () => setCompany(c)
  }, c))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "#8C8474",
      marginTop: 6
    }
  }, "Это про то, чей счёт оплатил фактуру — а не про то, на какую фирму/партнёра работает ", targetLabel.toLowerCase(), ". Ниже можно распределить сумму на любую позицию, независимо от этого.")), /*#__PURE__*/React.createElement(Field, {
    label: "Название фактуры"
  }, /*#__PURE__*/React.createElement("input", {
    value: label,
    onChange: e => setLabel(e.target.value),
    placeholder: invoiceHint,
    style: inputStyle
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Сумма фактуры"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    inputMode: "decimal",
    value: total,
    onChange: e => setTotal(e.target.value),
    placeholder: "0",
    style: inputStyle
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Дата"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: date,
    onChange: e => setDate(e.target.value),
    style: inputStyle
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#A79E8C",
      fontWeight: 600,
      marginBottom: 8
    }
  }, "Распределить по: ", targetLabel.toLowerCase(), "у"), targets.map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontSize: 14
    }
  }, t.name), /*#__PURE__*/React.createElement("input", {
    type: "number",
    inputMode: "decimal",
    value: rows[i]?.amount ?? "",
    onChange: e => setRowAmount(i, e.target.value),
    placeholder: "0",
    style: {
      ...inputStyle,
      width: 110
    }
  }))));
}

/* ================= DASHBOARD ================= */

function prevPeriodRange(period) {
  // Returns an inRange-style predicate for the period immediately preceding
  // the current one, of the same length — used for "vs previous period".
  if (period.mode === "month") {
    const [y, m] = period.month.split("-").map(Number);
    const prevDate = new Date(y, m - 2, 1); // JS months are 0-indexed
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    return iso => monthKey(iso) === prevKey;
  }
  if (period.mode === "custom") {
    const from = new Date(period.from);
    const to = new Date(period.to);
    const lengthMs = to - from;
    const prevTo = new Date(from.getTime() - 24 * 60 * 60 * 1000);
    const prevFrom = new Date(prevTo.getTime() - lengthMs);
    const prevFromIso = prevFrom.toISOString().slice(0, 10);
    const prevToIso = prevTo.toISOString().slice(0, 10);
    return iso => iso >= prevFromIso && iso <= prevToIso;
  }
  return null; // "all" mode has no meaningful previous period
}
function Dashboard({
  state
}) {
  const period = usePeriod();
  const txInRange = useMemo(() => state.transactions.filter(t => period.inRange(t.date)), [state.transactions, period]);
  const allTx = state.transactions;
  const balance = useMemo(() => {
    let cash = 0;
    const cards = {};
    COMPANIES.forEach(c => cards[c] = 0);
    for (const t of allTx) {
      if (t.type === "income") {
        if (t.method === "cash") cash += t.amount;else if (t.company) cards[t.company] = (cards[t.company] || 0) + t.amount;
      } else if (t.type === "expense") {
        if (t.method === "cash") cash -= t.amount;else if (t.company) cards[t.company] = (cards[t.company] || 0) - t.amount;
      } else if (t.type === "transfer") {
        // direction: 'cash_to_card' moves money OUT of cash INTO the specified company's card, and vice versa
        if (!t.company) continue;
        if (t.direction === "cash_to_card") {
          cash -= t.amount;
          cards[t.company] = (cards[t.company] || 0) + t.amount;
        } else {
          cards[t.company] = (cards[t.company] || 0) - t.amount;
          cash += t.amount;
        }
      }
    }
    return {
      cash,
      cards
    };
  }, [allTx]);
  const {
    income,
    expense,
    byCategory
  } = useMemo(() => {
    let income = 0,
      expense = 0;
    const cat = {};
    for (const t of txInRange) {
      if (t.type === "income") income += t.amount;
      if (t.type === "expense") {
        expense += t.amount;
        cat[t.category] = (cat[t.category] || 0) + t.amount;
      }
    }
    const rows = Object.entries(cat).sort((a, b) => b[1] - a[1]);
    return {
      income,
      expense,
      byCategory: rows
    };
  }, [txInRange]);
  const comparison = useMemo(() => {
    const prevInRange = prevPeriodRange(period);
    if (!prevInRange) return null;
    let prevIncome = 0,
      prevExpense = 0;
    for (const t of state.transactions) {
      if (!prevInRange(t.date)) continue;
      if (t.type === "income") prevIncome += t.amount;
      if (t.type === "expense") prevExpense += t.amount;
    }
    const pctChange = (curr, prev) => {
      if (prev === 0) return curr === 0 ? 0 : null; // no baseline to compare against
      return (curr - prev) / Math.abs(prev) * 100;
    };
    return {
      prevIncome,
      prevExpense,
      prevNet: prevIncome - prevExpense,
      incomeChange: pctChange(income, prevIncome),
      expenseChange: pctChange(expense, prevExpense)
    };
  }, [period, state.transactions, income, expense]);
  const districtRanking = useMemo(() => {
    const sums = {};
    for (const s of state.incomeSplits) {
      if (!period.inRange(s.date)) continue;
      for (const a of s.allocations) sums[a.targetId] = (sums[a.targetId] || 0) + Number(a.amount);
    }
    return state.districts.map(d => ({
      id: d.id,
      name: d.name,
      total: sums[d.id] || 0
    })).sort((a, b) => b.total - a.total);
  }, [state.incomeSplits, state.districts, period]);
  const vehicleRanking = useMemo(() => {
    const sums = {};
    for (const s of state.fuelSplits) {
      if (!period.inRange(s.date)) continue;
      for (const a of s.allocations) sums[a.targetId] = (sums[a.targetId] || 0) + Number(a.amount);
    }
    return state.vehicles.map(v => ({
      name: v.name,
      total: sums[v.id] || 0
    })).sort((a, b) => b.total - a.total);
  }, [state.fuelSplits, state.vehicles, period]);
  const vehicleProfitability = useMemo(() => {
    const fuelByVehicle = {};
    for (const s of state.fuelSplits) {
      if (!period.inRange(s.date)) continue;
      for (const a of s.allocations) fuelByVehicle[a.targetId] = (fuelByVehicle[a.targetId] || 0) + Number(a.amount);
    }
    const incomeByDistrict = {};
    for (const s of state.incomeSplits) {
      if (!period.inRange(s.date)) continue;
      for (const a of s.allocations) incomeByDistrict[a.targetId] = (incomeByDistrict[a.targetId] || 0) + Number(a.amount);
    }
    return (state.vehicles || []).filter(v => v.districtId).map(v => {
      const revenue = incomeByDistrict[v.districtId] || 0;
      const cost = fuelByVehicle[v.id] || 0;
      const district = (state.districts || []).find(d => d.id === v.districtId);
      return {
        name: v.name,
        districtName: district ? district.name : "—",
        revenue,
        cost,
        profit: revenue - cost
      };
    }).sort((a, b) => b.profit - a.profit);
  }, [state.vehicles, state.districts, state.fuelSplits, state.incomeSplits, period]);
  const net = income - expense;
  const maxCat = byCategory[0]?.[1] || 1;
  const maxDist = districtRanking[0]?.total || 1;
  const maxVeh = vehicleRanking[0]?.total || 1;
  const maxProfit = Math.max(1, ...vehicleProfitability.map(v => Math.abs(v.profit)));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 14,
      paddingBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Card, {
    className: "lpl-card-in",
    style: {
      marginBottom: 10,
      animationDelay: "0ms"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: smallLabel
  }, "НАЛИЧКА (ОБЩАЯ)"), /*#__PURE__*/React.createElement(Odometer, {
    value: balance.cash,
    size: "lg",
    tone: balance.cash < 0 ? "rust" : "hi"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginBottom: 12
    }
  }, COMPANIES.map((c, i) => /*#__PURE__*/React.createElement(Card, {
    key: c,
    className: "lpl-card-in",
    style: {
      flex: 1,
      minWidth: 0,
      borderTop: `2px solid ${COMPANY_COLORS[c]}`,
      animationDelay: `${60 + i * 60}ms`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...smallLabel,
      color: COMPANY_COLORS[c]
    }
  }, c, " · КАРТА"), /*#__PURE__*/React.createElement(Odometer, {
    value: balance.cards[c] || 0,
    size: "sm2",
    colorOverride: (balance.cards[c] || 0) < 0 ? "#FB5D5D" : COMPANY_COLORS[c]
  })))), /*#__PURE__*/React.createElement(PeriodBar, {
    period: period
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      margin: "14px 0"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: smallLabel
  }, "ДОХОД"), /*#__PURE__*/React.createElement(Odometer, {
    value: income,
    size: "sm2",
    tone: "green",
    prefix: "+ "
  }), comparison && /*#__PURE__*/React.createElement(ChangeBadge, {
    pct: comparison.incomeChange,
    goodDirection: "up"
  })), /*#__PURE__*/React.createElement(Card, {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: smallLabel
  }, "РАСХОД"), /*#__PURE__*/React.createElement(Odometer, {
    value: expense,
    size: "sm2",
    tone: "rust",
    prefix: "− "
  }), comparison && /*#__PURE__*/React.createElement(ChangeBadge, {
    pct: comparison.expenseChange,
    goodDirection: "down"
  }))), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: smallLabel
  }, "ИТОГО ЗА ПЕРИОД"), /*#__PURE__*/React.createElement(Odometer, {
    value: net,
    size: "md",
    tone: net >= 0 ? "amber" : "rust",
    prefix: net >= 0 ? "+ " : ""
  })), comparison && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "#9C9486",
      marginBottom: 14,
      marginTop: -6
    }
  }, "vs предыдущий период: доход ", fmt(comparison.prevIncome), " zł, расход ", fmt(comparison.prevExpense), " zł"), /*#__PURE__*/React.createElement(SectionTitle, null, "Расходы по категориям"), byCategory.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    title: "Нет расходов за период",
    hint: "Измените период или добавьте операции в Кассе"
  }) : /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 16
    }
  }, byCategory.map(([name, val]) => /*#__PURE__*/React.createElement(BarRow, {
    key: name,
    label: name,
    value: val,
    max: maxCat,
    tone: "rust"
  }))), /*#__PURE__*/React.createElement(SectionTitle, null, "Районы · кто сколько принёс"), districtRanking.every(d => d.total === 0) ? /*#__PURE__*/React.createElement(Empty, {
    title: "Разбивок по районам ещё нет",
    hint: "Добавьте их во вкладке «Разбивки»"
  }) : /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 16
    }
  }, districtRanking.map(d => /*#__PURE__*/React.createElement(BarRow, {
    key: d.name,
    label: d.name,
    value: d.total,
    max: maxDist,
    tone: "green"
  }))), /*#__PURE__*/React.createElement(SectionTitle, null, "Машины · во что обходятся"), vehicleRanking.every(v => v.total === 0) ? /*#__PURE__*/React.createElement(Empty, {
    title: "Разбивок по машинам ещё нет",
    hint: "Добавьте их во вкладке «Разбивки»"
  }) : /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 16
    }
  }, vehicleRanking.map(v => /*#__PURE__*/React.createElement(BarRow, {
    key: v.name,
    label: v.name,
    value: v.total,
    max: maxVeh,
    tone: "rust"
  }))), /*#__PURE__*/React.createElement(SectionTitle, null, "Рентабельность машин"), vehicleProfitability.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    title: "Привяжите машину к району",
    hint: "В Справочнике → Машины укажите, за какой район отвечает машина — тогда посчитаем доход минус топливо"
  }) : /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 8
    }
  }, vehicleProfitability.map(v => /*#__PURE__*/React.createElement("div", {
    key: v.name,
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: "#EDE8DD"
    }
  }, v.name, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#9C9486",
      fontSize: 11
    }
  }, "· район ", v.districtName)), /*#__PURE__*/React.createElement(Odometer, {
    value: v.profit,
    size: "sm",
    tone: v.profit >= 0 ? "green" : "rust",
    prefix: v.profit >= 0 ? "+ " : ""
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      height: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: Math.max(v.revenue, 1),
      background: "#34D399",
      borderRadius: 4,
      opacity: 0.85
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: Math.max(v.cost, 1),
      background: "#FB5D5D",
      borderRadius: 4,
      opacity: 0.85
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: 3,
      fontSize: 10.5,
      color: "#9C9486"
    }
  }, /*#__PURE__*/React.createElement("span", null, "доход ", fmt(v.revenue), " zł"), /*#__PURE__*/React.createElement("span", null, "топливо ", fmt(v.cost), " zł"))))));
}
function ChangeBadge({
  pct,
  goodDirection
}) {
  if (pct === null) return /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: "#9C9486",
      marginTop: 4
    }
  }, "новое");
  const isUp = pct >= 0;
  const isGood = goodDirection === "up" ? isUp : !isUp;
  const color = pct === 0 ? "#9C9486" : isGood ? "#34D399" : "#FB5D5D";
  const arrow = pct === 0 ? "•" : isUp ? "▲" : "▼";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color,
      marginTop: 4,
      fontWeight: 600
    }
  }, arrow, " ", Math.abs(pct).toFixed(0), "%");
}
const smallLabel = {
  fontSize: 10.5,
  color: "#9C9486",
  fontWeight: 700,
  letterSpacing: "0.06em",
  marginBottom: 6
};
function SectionTitle({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: 14,
      fontWeight: 600,
      margin: "6px 0 8px 2px",
      color: "#EDE8DD"
    }
  }, children);
}
function BarRow({
  label,
  value,
  max,
  tone
}) {
  const pct = Math.max(4, Math.round(value / max * 100));
  const colors = {
    green: "#34D399",
    rust: "#FB5D5D",
    amber: "#EDE8DD"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: "#EDE8DD"
    }
  }, label), /*#__PURE__*/React.createElement(Odometer, {
    value: value,
    size: "sm",
    tone: "hi"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6,
      background: "#14131A",
      borderRadius: 4,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${pct}%`,
      height: "100%",
      background: colors[tone],
      borderRadius: 4
    }
  })));
}

/* ================= NOTES (Заметки) ================= */

const NOTE_KINDS = [{
  id: "debt",
  label: "Долг",
  tone: "amber"
}, {
  id: "todo",
  label: "Напоминание",
  tone: "steel"
}, {
  id: "info",
  label: "Инфо",
  tone: "green"
}];
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(todayISO());
  const target = new Date(dateStr);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}
function urgencyOf(note) {
  if (note.done || !note.dueDate) return "none";
  const d = daysUntil(note.dueDate);
  if (d < 0) return "overdue";
  const remindDays = note.remindBefore === "month" ? 30 : note.remindBefore === "week" ? 7 : 3;
  if (d <= remindDays) return "soon";
  return "later";
}
const urgencyStyle = {
  overdue: {
    color: "#FB5D5D",
    label: "просрочено"
  },
  soon: {
    color: "#EDE8DD",
    label: "скоро"
  },
  later: {
    color: "#9C9486",
    label: null
  },
  none: {
    color: "#9C9486",
    label: null
  }
};
function Notes({
  state,
  update
}) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const notes = state.notes || [];
  const list = useMemo(() => {
    return notes.filter(n => filter === "all" || n.kind === filter).sort((a, b) => {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      const ua = urgencyOf(a);
      const ub = urgencyOf(b);
      const rank = {
        overdue: 0,
        soon: 1,
        later: 2,
        none: 3
      };
      if (rank[ua] !== rank[ub]) return rank[ua] - rank[ub];
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
  }, [notes, filter]);
  const upcomingCount = useMemo(() => notes.filter(n => !n.done && ["overdue", "soon"].includes(urgencyOf(n))).length, [notes]);
  function addNote(note) {
    update(prev => ({
      ...prev,
      notes: [...(prev.notes || []), {
        id: uid(),
        createdAt: new Date().toISOString(),
        done: false,
        ...note
      }]
    }));
    setShowForm(false);
  }
  function toggleDone(id) {
    update(prev => ({
      ...prev,
      notes: prev.notes.map(n => n.id === id ? {
        ...n,
        done: !n.done
      } : n)
    }));
  }
  function removeNote(id) {
    update(prev => ({
      ...prev,
      notes: prev.notes.filter(n => n.id !== id)
    }));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 14
    }
  }, upcomingCount > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12,
      padding: "9px 12px",
      borderRadius: 10,
      background: "#EDE8DD14",
      border: "1px solid #EDE8DD40",
      color: "#EDE8DD",
      fontSize: 12.5,
      fontWeight: 600
    }
  }, "⚠ ", upcomingCount, " ", upcomingCount === 1 ? "напоминание требует" : "напоминания требуют", " внимания"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 14,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    active: filter === "all",
    tone: "steel",
    onClick: () => setFilter("all")
  }, "Всё"), NOTE_KINDS.map(k => /*#__PURE__*/React.createElement(Pill, {
    key: k.id,
    active: filter === k.id,
    tone: k.tone,
    onClick: () => setFilter(k.id)
  }, k.label))), list.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    title: "Заметок нет",
    hint: "Отмечайте долги, платежи со сроком (страховка, техосмотр) или любую важную информацию"
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, list.map(n => /*#__PURE__*/React.createElement(NoteRow, {
    key: n.id,
    note: n,
    onToggle: () => toggleDone(n.id),
    onDelete: () => removeNote(n.id)
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowForm(true),
    style: fabStyle
  }, "+"), showForm && /*#__PURE__*/React.createElement(NoteForm, {
    onCancel: () => setShowForm(false),
    onSave: addNote
  }));
}
function NoteRow({
  note,
  onToggle,
  onDelete
}) {
  const [open, setOpen] = useState(false);
  const kind = NOTE_KINDS.find(k => k.id === note.kind) || NOTE_KINDS[2];
  const colors = {
    amber: "#EDE8DD",
    steel: "#9C9486",
    green: "#34D399"
  };
  const urgency = urgencyOf(note);
  const ustyle = urgencyStyle[urgency];
  const d = note.dueDate ? daysUntil(note.dueDate) : null;
  return /*#__PURE__*/React.createElement(Card, {
    style: {
      opacity: note.done ? 0.5 : 1,
      borderColor: urgency !== "none" && urgency !== "later" ? `${ustyle.color}55` : "#322E3A"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onToggle,
    style: {
      width: 20,
      height: 20,
      borderRadius: 6,
      border: `2px solid ${colors[kind.tone]}`,
      background: note.done ? colors[kind.tone] : "transparent",
      flexShrink: 0,
      marginTop: 2,
      cursor: "pointer"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      cursor: "pointer"
    },
    onClick: () => setOpen(o => !o)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      color: colors[kind.tone],
      letterSpacing: "0.04em"
    }
  }, kind.label.toUpperCase()), note.amount ? /*#__PURE__*/React.createElement(Odometer, {
    value: note.amount,
    size: "sm",
    tone: "hi"
  }) : null, ustyle.label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      color: ustyle.color,
      border: `1px solid ${ustyle.color}55`,
      borderRadius: 999,
      padding: "1px 8px"
    }
  }, ustyle.label)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      marginTop: 3,
      textDecoration: note.done ? "line-through" : "none"
    }
  }, note.title), note.text && (open || note.text.length < 60) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#A79E8C",
      marginTop: 4,
      whiteSpace: "pre-wrap"
    }
  }, note.text), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#8C8474",
      marginTop: 4
    }
  }, note.dueDate ? `срок: ${note.dueDate}${d !== null ? ` (${d >= 0 ? `через ${d} дн.` : `${Math.abs(d)} дн. назад`})` : ""}` : (note.createdAt || "").slice(0, 10)))), open && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onDelete,
    style: deleteBtnStyle
  }, "Удалить заметку")));
}
function NoteForm({
  onCancel,
  onSave
}) {
  const [kind, setKind] = useState("debt");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [hasDue, setHasDue] = useState(false);
  const [dueDate, setDueDate] = useState(todayISO());
  const [remindBefore, setRemindBefore] = useState("week");
  function submit() {
    if (!title.trim()) return;
    onSave({
      kind,
      title: title.trim(),
      text: text.trim(),
      amount: amount ? Number(amount) : null,
      dueDate: hasDue ? dueDate : null,
      remindBefore: hasDue ? remindBefore : null
    });
  }
  return /*#__PURE__*/React.createElement(Sheet, {
    title: "Новая заметка",
    onClose: onCancel,
    footer: /*#__PURE__*/React.createElement("button", {
      onClick: submit,
      style: primaryBtnStyle
    }, "Сохранить")
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Тип"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, NOTE_KINDS.map(k => /*#__PURE__*/React.createElement(Pill, {
    key: k.id,
    active: kind === k.id,
    tone: k.tone,
    onClick: () => setKind(k.id)
  }, k.label)))), /*#__PURE__*/React.createElement(Field, {
    label: "Заголовок"
  }, /*#__PURE__*/React.createElement("input", {
    value: title,
    onChange: e => setTitle(e.target.value),
    placeholder: kind === "debt" ? "Например: Артём должен за март" : "Например: Страховка авто, Техосмотр",
    style: inputStyle
  })), kind === "debt" && /*#__PURE__*/React.createElement(Field, {
    label: "Сумма (необязательно)"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    inputMode: "decimal",
    value: amount,
    onChange: e => setAmount(e.target.value),
    placeholder: "0",
    style: inputStyle
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Срок / платёж с датой"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: hasDue ? 10 : 0
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    active: !hasDue,
    tone: "steel",
    onClick: () => setHasDue(false)
  }, "Без срока"), /*#__PURE__*/React.createElement(Pill, {
    active: hasDue,
    tone: "amber",
    onClick: () => setHasDue(true)
  }, "Есть дата")), hasDue && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: dueDate,
    onChange: e => setDueDate(e.target.value),
    style: {
      ...inputStyle,
      marginBottom: 10
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#A79E8C",
      marginBottom: 6
    }
  }, "Напомнить заранее за:"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    active: remindBefore === "week",
    onClick: () => setRemindBefore("week")
  }, "Неделю"), /*#__PURE__*/React.createElement(Pill, {
    active: remindBefore === "month",
    onClick: () => setRemindBefore("month")
  }, "Месяц")))), /*#__PURE__*/React.createElement(Field, {
    label: "Подробности (необязательно)"
  }, /*#__PURE__*/React.createElement("textarea", {
    value: text,
    onChange: e => setText(e.target.value),
    placeholder: "Любая дополнительная информация",
    rows: 4,
    style: {
      ...inputStyle,
      resize: "vertical",
      fontFamily: "inherit"
    }
  })));
}

/* ================= SETTINGS (Справочник) ================= */

function Settings({
  state,
  update
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 14
    }
  }, /*#__PURE__*/React.createElement(ListEditor, {
    title: "Районы",
    items: state.districts,
    placeholder: "Номер района, напр. 1240",
    onAdd: name => update(p => ({
      ...p,
      districts: [...p.districts, {
        id: uid(),
        name,
        partner: PARTNERS[0]
      }]
    })),
    onRename: (id, name) => update(p => ({
      ...p,
      districts: p.districts.map(d => d.id === id ? {
        ...d,
        name
      } : d)
    })),
    onRemove: id => update(p => ({
      ...p,
      districts: p.districts.filter(d => d.id !== id)
    })),
    extraSelects: [{
      label: "Партнёр",
      options: PARTNERS,
      value: it => it.partner || PARTNERS[0],
      onChange: (id, val) => update(p => ({
        ...p,
        districts: p.districts.map(d => d.id === id ? {
          ...d,
          partner: val
        } : d)
      }))
    }]
  }), /*#__PURE__*/React.createElement(ListEditor, {
    title: "Машины",
    items: state.vehicles,
    placeholder: "Название машины",
    extraField: true,
    onAdd: (name, status) => update(p => ({
      ...p,
      vehicles: [...p.vehicles, {
        id: uid(),
        name,
        status: status || "своя",
        payingCompany: COMPANIES[0],
        partner: PARTNERS[0]
      }]
    })),
    onRename: (id, name) => update(p => ({
      ...p,
      vehicles: p.vehicles.map(v => v.id === id ? {
        ...v,
        name
      } : v)
    })),
    onRemove: id => update(p => ({
      ...p,
      vehicles: p.vehicles.filter(v => v.id !== id)
    })),
    onStatusChange: (id, status) => update(p => ({
      ...p,
      vehicles: p.vehicles.map(v => v.id === id ? {
        ...v,
        status
      } : v)
    })),
    extraSelects: [{
      label: "Платит фирма",
      options: COMPANIES,
      value: it => it.payingCompany || COMPANIES[0],
      onChange: (id, val) => update(p => ({
        ...p,
        vehicles: p.vehicles.map(v => v.id === id ? {
          ...v,
          payingCompany: val
        } : v)
      }))
    }, {
      label: "Работает на партнёра",
      options: PARTNERS,
      value: it => it.partner || PARTNERS[0],
      onChange: (id, val) => update(p => ({
        ...p,
        vehicles: p.vehicles.map(v => v.id === id ? {
          ...v,
          partner: val
        } : v)
      }))
    }],
    linkOptions: state.districts,
    linkFieldLabel: "Район (для рентабельности)",
    onLinkChange: (id, districtId) => update(p => ({
      ...p,
      vehicles: p.vehicles.map(v => v.id === id ? {
        ...v,
        districtId
      } : v)
    }))
  }), /*#__PURE__*/React.createElement(CategoryEditor, {
    title: "Категории дохода",
    list: state.categories.income,
    onChange: list => update(p => ({
      ...p,
      categories: {
        ...p.categories,
        income: list
      }
    }))
  }), /*#__PURE__*/React.createElement(CategoryEditor, {
    title: "Категории расхода",
    list: state.categories.expense,
    onChange: list => update(p => ({
      ...p,
      categories: {
        ...p.categories,
        expense: list
      }
    }))
  }), /*#__PURE__*/React.createElement(BackupCard, {
    state: state
  }));
}
function BackupCard({
  state
}) {
  function download() {
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lpl-logistics-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  return /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(SectionTitle, null, "Резервная копия"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "#A79E8C",
      marginBottom: 12
    }
  }, "Скачайте файл со всеми данными (касса, разбивки, заметки, справочник) — на всякий случай, независимо от базы."), /*#__PURE__*/React.createElement("button", {
    onClick: download,
    style: primaryBtnStyle
  }, "Скачать резервную копию"));
}
function ListEditor({
  title,
  items,
  placeholder,
  onAdd,
  onRename,
  onRemove,
  onStatusChange,
  extraField,
  linkOptions,
  onLinkChange,
  linkFieldLabel,
  extraSelects
}) {
  const [val, setVal] = useState("");
  const [status, setStatus] = useState("своя");
  const [editingId, setEditingId] = useState(null);
  const [editVal, setEditVal] = useState("");
  return /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(SectionTitle, null, title), items.map(it => /*#__PURE__*/React.createElement("div", {
    key: it.id,
    style: {
      padding: "6px 0",
      borderBottom: "1px solid #2E2A32"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, editingId === it.id ? /*#__PURE__*/React.createElement("input", {
    value: editVal,
    onChange: e => setEditVal(e.target.value),
    onBlur: () => {
      if (editVal.trim()) onRename(it.id, editVal.trim());
      setEditingId(null);
    },
    autoFocus: true,
    style: {
      ...inputStyle,
      flex: 1,
      padding: "6px 8px"
    }
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontSize: 14,
      cursor: "pointer"
    },
    onClick: () => {
      setEditingId(it.id);
      setEditVal(it.name);
    }
  }, it.name, extraField && it.status && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "#9C9486",
      marginLeft: 8
    }
  }, "· ", it.status)), extraField && onStatusChange && /*#__PURE__*/React.createElement("select", {
    value: it.status,
    onChange: e => onStatusChange(it.id, e.target.value),
    style: {
      ...inputStyle,
      width: 90,
      padding: "5px 6px",
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "своя"
  }, "своя"), /*#__PURE__*/React.createElement("option", {
    value: "аренда"
  }, "аренда")), /*#__PURE__*/React.createElement("button", {
    onClick: () => onRemove(it.id),
    style: smallDeleteStyle
  }, "✕")), extraSelects && extraSelects.map(es => /*#__PURE__*/React.createElement("div", {
    key: es.label,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginTop: 6,
      paddingLeft: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "#9C9486",
      whiteSpace: "nowrap"
    }
  }, es.label, ":"), /*#__PURE__*/React.createElement("select", {
    value: es.value(it) || "",
    onChange: e => es.onChange(it.id, e.target.value),
    style: {
      ...inputStyle,
      flex: 1,
      padding: "5px 6px",
      fontSize: 12
    }
  }, es.options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o
  }, o))))), linkOptions && onLinkChange && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginTop: 6,
      paddingLeft: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "#9C9486",
      whiteSpace: "nowrap"
    }
  }, linkFieldLabel, ":"), /*#__PURE__*/React.createElement("select", {
    value: it.districtId || "",
    onChange: e => onLinkChange(it.id, e.target.value || null),
    style: {
      ...inputStyle,
      flex: 1,
      padding: "5px 6px",
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "не привязана"), linkOptions.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.id,
    value: o.id
  }, o.name)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: val,
    onChange: e => setVal(e.target.value),
    placeholder: placeholder,
    style: {
      ...inputStyle,
      flex: 1
    }
  }), extraField && /*#__PURE__*/React.createElement("select", {
    value: status,
    onChange: e => setStatus(e.target.value),
    style: {
      ...inputStyle,
      width: 96
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "своя"
  }, "своя"), /*#__PURE__*/React.createElement("option", {
    value: "аренда"
  }, "аренда")), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (!val.trim()) return;
      onAdd(val.trim(), status);
      setVal("");
    },
    style: {
      ...primaryBtnStyle,
      width: 56,
      padding: 0,
      marginTop: 0
    }
  }, "+")));
}
function CategoryEditor({
  title,
  list,
  onChange
}) {
  const [val, setVal] = useState("");
  return /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(SectionTitle, null, title), list.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: c + i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "5px 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontSize: 14
    }
  }, c), /*#__PURE__*/React.createElement("button", {
    onClick: () => onChange(list.filter((_, idx) => idx !== i)),
    style: smallDeleteStyle
  }, "✕"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: val,
    onChange: e => setVal(e.target.value),
    placeholder: "Новая категория",
    style: {
      ...inputStyle,
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (!val.trim()) return;
      onChange([...list, val.trim()]);
      setVal("");
    },
    style: {
      ...primaryBtnStyle,
      width: 56,
      padding: 0,
      marginTop: 0
    }
  }, "+")));
}

/* ---------------- shared bits ---------------- */

function Sheet({
  title,
  onClose,
  children,
  footer
}) {
  return /*#__PURE__*/ReactDOM.createPortal(/*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "#000000a0",
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      zIndex: 100
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: "#1A1820",
      borderTop: "1px solid #322E3A",
      borderRadius: "18px 18px 0 0",
      width: "100%",
      maxWidth: 480,
      maxHeight: "86vh",
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "18px 16px 4px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontWeight: 700,
      fontSize: 16
    }
  }, title), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: "none",
      border: "none",
      color: "#A79E8C",
      fontSize: 20,
      cursor: "pointer"
    }
  }, "✕")), children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "sticky",
      bottom: 0,
      padding: "12px 16px calc(16px + env(safe-area-inset-bottom))",
      borderTop: "1px solid #322E3A",
      background: "#1A1820"
    }
  }, footer))), document.body);
}
const fabStyle = {
  position: "fixed",
  bottom: "calc(70px + env(safe-area-inset-bottom))",
  right: "calc(16px + env(safe-area-inset-right))",
  width: 54,
  height: 54,
  borderRadius: 17,
  background: "#EDE8DD",
  color: "#17151D",
  fontSize: 26,
  fontWeight: 700,
  border: "none",
  boxShadow: "0 6px 18px #00000050, 0 2px 4px #00000040",
  cursor: "pointer",
  lineHeight: "54px",
  zIndex: 20
};
const primaryBtnStyle = {
  width: "100%",
  padding: "13px",
  borderRadius: 12,
  border: "none",
  background: "#EDE8DD",
  color: "#17151D",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
  marginTop: 6
};
const deleteBtnStyle = {
  background: "none",
  border: "1px solid #3D2233",
  color: "#FB5D5D",
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 8,
  cursor: "pointer"
};
const smallDeleteStyle = {
  background: "none",
  border: "none",
  color: "#8C8474",
  fontSize: 14,
  cursor: "pointer",
  padding: "2px 4px"
};
function mountApp() {
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(React.createElement(App));
}
if (window.storage) {
  mountApp();
} else {
  window.addEventListener("firebase-ready", mountApp, {
    once: true
  });
}
