import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  LayoutDashboard, Landmark, BookOpen, Calendar, CalendarDays, ClipboardList, RotateCcw, ListChecks,
  BarChart3, Trophy, Plus, Trash2, X, ChevronDown, ChevronRight, Menu, Clock, CheckCircle2,
  AlertTriangle, Pencil, Save, Layers, Percent, Search, Repeat, Mail, LogOut,
} from 'lucide-react';
import { supabase } from './supabaseClient.js';

/* ============================================================================
   CONSTANTES
============================================================================ */
const STORAGE_KEY = 'painel-estudos-v1';

const DIAS_SEMANA = [
  { key: 'seg', label: 'Segunda' },
  { key: 'ter', label: 'Terça' },
  { key: 'qua', label: 'Quarta' },
  { key: 'qui', label: 'Quinta' },
  { key: 'sex', label: 'Sexta' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
];

const TIPOS_ESTUDO = ['Teoria', 'Questões', 'Revisão', 'Simulado', 'Leitura de lei seca', 'Videoaula', 'Resumo'];

const STATUS_ASSUNTO = [
  { value: 'nao_iniciado', label: 'Não iniciado', color: '#8B92A0', bg: '#EDEEF0' },
  { value: 'estudando', label: 'Estudando', color: '#3E7C9E', bg: '#DEEBF2' },
  { value: 'estudado', label: 'Estudado', color: '#AD832E', bg: '#F1E6CB' },
  { value: 'revisando', label: 'Revisando', color: '#7A5A96', bg: '#EBE3F1' },
  { value: 'dominado', label: 'Dominado', color: '#0D6857', bg: '#DCEEE8' },
];
const STATUS_ASSUNTO_MAP = Object.fromEntries(STATUS_ASSUNTO.map((s) => [s.value, s]));
const STATUS_WEIGHT = { nao_iniciado: 0, estudando: 25, estudado: 50, revisando: 75, dominado: 100 };

const STATUS_CONCURSO = [
  { value: 'planejando', label: 'Planejando', color: '#8B92A0', bg: '#EDEEF0' },
  { value: 'estudando', label: 'Estudando', color: '#3E7C9E', bg: '#DEEBF2' },
  { value: 'revisando', label: 'Revisando', color: '#7A5A96', bg: '#EBE3F1' },
  { value: 'finalizado', label: 'Finalizado', color: '#0D6857', bg: '#DCEEE8' },
];
const STATUS_CONCURSO_MAP = Object.fromEntries(STATUS_CONCURSO.map((s) => [s.value, s]));

const DIFICULDADE = [
  { value: 'facil', label: 'Fácil', color: '#0D6857', bg: '#DCEEE8' },
  { value: 'medio', label: 'Médio', color: '#AD832E', bg: '#F1E6CB' },
  { value: 'dificil', label: 'Difícil', color: '#9C4430', bg: '#F3E1DB' },
];
const DIFICULDADE_MAP = Object.fromEntries(DIFICULDADE.map((s) => [s.value, s]));

const ACCENTS = ['teal', 'gold', 'blue', 'plum', 'brick'];

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'concursos', label: 'Concursos', icon: Landmark },
  { key: 'materias', label: 'Matérias e assuntos', icon: BookOpen },
  { key: 'cronograma', label: 'Cronograma semanal', icon: CalendarDays },
  { key: 'registro', label: 'Registro de estudos', icon: ClipboardList },
  { key: 'revisoes', label: 'Revisões', icon: RotateCcw },
  { key: 'questoes', label: 'Questões', icon: ListChecks },
  { key: 'relatorios', label: 'Relatórios', icon: BarChart3 },
  { key: 'simulados', label: 'Simulados', icon: Trophy },
];

const emptyState = () => ({
  concursos: [],
  materias: [],
  assuntos: [],
  sessoes: [],
  revisoes: [],
  simulados: [],
  cronograma: [],
  metaSemanalHoras: 20,
});

/* ============================================================================
   HELPERS
============================================================================ */
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

// Converte um Date para 'YYYY-MM-DD' usando o horário LOCAL (não UTC).
// Importante: `.toISOString()` sempre usa UTC, o que faria "hoje" virar "amanhã"
// a partir de ~21h em fusos como o do Brasil (UTC-3). Nunca use toISOString()
// para extrair a data aqui — sempre local.
const toISODateLocal = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const todayISO = () => toISODateLocal(new Date());

const sum = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

const formatMin = (min) => {
  const m = Math.round(Number(min) || 0);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}min`;
  if (r === 0) return `${h}h`;
  return `${h}h${String(r).padStart(2, '0')}`;
};

const formatDateBR = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const weekdayLabel = (iso) => {
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const d = new Date(`${iso}T12:00:00`);
  return dias[d.getDay()];
};

const addDaysISO = (iso, days) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toISODateLocal(d);
};

const diffDaysFromToday = (iso) => {
  if (!iso) return null;
  const today = new Date(`${todayISO()}T12:00:00`);
  const target = new Date(`${iso}T12:00:00`);
  return Math.round((target - today) / 86400000);
};

const getWeekRange = (refISO = todayISO()) => {
  const d = new Date(`${refISO}T12:00:00`);
  const dow = d.getDay(); // 0 = domingo
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    days.push(toISODateLocal(dd));
  }
  return { startISO: days[0], endISO: days[6], days };
};

const last14Days = () => {
  const out = [];
  for (let i = 13; i >= 0; i--) out.push(addDaysISO(todayISO(), -i));
  return out;
};

const shortDate = (iso) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

const csvSafe = (v) => (v === null || v === undefined ? '' : String(v));

/* ============================================================================
   ESTILOS GLOBAIS + ASSINATURA VISUAL (selo)
============================================================================ */
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600;0,700;1,500&family=Public+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

      .pe-root {
        --ink: #172038;
        --ink-soft: #2E3A57;
        --paper: #F3F5F0;
        --card: #FFFFFF;
        --gold: #AD832E;
        --gold-soft: #F1E6CB;
        --teal: #0D6857;
        --teal-soft: #DCEEE8;
        --brick: #9C4430;
        --brick-soft: #F3E1DB;
        --plum: #7A5A96;
        --plum-soft: #EBE3F1;
        --blue: #3E7C9E;
        --blue-soft: #DEEBF2;
        --line: #DEDFD3;
        --text: #1B2333;
        --text-muted: #6B7280;
        --font-display: 'Newsreader', Georgia, serif;
        --font-body: 'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        --font-mono: 'IBM Plex Mono', 'SF Mono', Consolas, monospace;
        font-family: var(--font-body);
        color: var(--text);
        background: var(--paper);
        min-height: 100vh;
      }
      .pe-root *, .pe-root *::before, .pe-root *::after { box-sizing: border-box; }
      .pe-serif { font-family: var(--font-display); }
      .pe-mono { font-family: var(--font-mono); }
      .pe-root ::-webkit-scrollbar { width: 8px; height: 8px; }
      .pe-root ::-webkit-scrollbar-thumb { background: var(--line); border-radius: 8px; }
      .pe-root button, .pe-root input, .pe-root select, .pe-root textarea { font-family: inherit; font-size: inherit; }
      .pe-root button { cursor: pointer; }
      .pe-root button:focus-visible, .pe-root input:focus-visible, .pe-root select:focus-visible,
      .pe-root textarea:focus-visible, .pe-root a:focus-visible {
        outline: 2px solid var(--teal); outline-offset: 2px;
      }
      .pe-card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; }
      .pe-btn:hover { filter: brightness(1.07); }
      .pe-btn:active { filter: brightness(0.94); }
      .pe-navitem:hover { background: rgba(255,255,255,0.06); }
      .pe-row:hover { background: rgba(23,32,56,0.03); }
      @media (prefers-reduced-motion: reduce) {
        .pe-root * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
      }
      @keyframes pe-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      .pe-animate-in { animation: pe-fade-in 0.22s ease-out; }
      input[type="checkbox"].pe-check { accent-color: var(--teal); width: 16px; height: 16px; }
    `}</style>
  );
}

function Selo({ size = 44, color = 'var(--gold)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" style={{ flexShrink: 0 }}>
      <g transform="rotate(-9 60 60)">
        <circle cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="3" strokeDasharray="3 4" />
        <circle cx="60" cy="60" r="42" fill="none" stroke={color} strokeWidth="1.5" />
        <path d="M40 61 L53 74 L82 43" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/* ============================================================================
   COMPONENTES DE UI COMPARTILHADOS
============================================================================ */
const inputStyle = { border: '1px solid var(--line)', color: 'var(--text)', background: '#fff' };
const inputCls = 'w-full rounded-lg px-3 py-2 text-sm outline-none';

function Field({ label, children, hint, required }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
        {label}
        {required && <span style={{ color: 'var(--brick)' }}> *</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  );
}

function TextInput(props) {
  return <input {...props} className={`${inputCls} ${props.className || ''}`} style={{ ...inputStyle, ...(props.style || {}) }} />;
}
function TextArea(props) {
  return <textarea {...props} className={`${inputCls} ${props.className || ''}`} style={{ ...inputStyle, ...(props.style || {}) }} />;
}
function Select(props) {
  return <select {...props} className={`${inputCls} ${props.className || ''}`} style={{ ...inputStyle, ...(props.style || {}) }} />;
}

function Btn({ children, onClick, icon: Icon, variant = 'primary', type = 'button', size = 'md', className = '', disabled, title }) {
  const base = 'pe-btn inline-flex items-center justify-center gap-1.5 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const sizeCls = size === 'sm' ? 'text-xs px-2.5 py-1.5' : 'text-sm px-3.5 py-2';
  const variants = {
    primary: { background: 'var(--ink)', color: '#fff' },
    accent: { background: 'var(--teal)', color: '#fff' },
    gold: { background: 'var(--gold)', color: '#fff' },
    ghost: { background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line)' },
    danger: { background: 'var(--brick-soft)', color: 'var(--brick)' },
  };
  return (
    <button type={type} title={title} onClick={onClick} disabled={disabled} className={`${base} ${sizeCls} ${className}`} style={variants[variant]}>
      {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
}

function Badge({ label, color, bg, icon: Icon, size = 'sm' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap ${size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-sm px-2.5 py-1'}`}
      style={{ color, background: bg }}
    >
      {Icon && <Icon size={size === 'sm' ? 11 : 13} />}
      {label}
    </span>
  );
}

function ProgressBar({ value, color = 'var(--teal)', height = 8, track = 'var(--line)' }) {
  const v = clamp(value || 0, 0, 100);
  return (
    <div style={{ background: track, borderRadius: 999, height, overflow: 'hidden', width: '100%' }}>
      <div style={{ width: `${v}%`, background: color, height: '100%', borderRadius: 999, transition: 'width 0.4s ease' }} />
    </div>
  );
}

function Card({ children, className = '', style = {}, padded = true }) {
  return (
    <div className={`pe-card ${padded ? 'p-4 md:p-5' : ''} ${className}`} style={style}>
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sublabel, accent = 'teal' }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: `var(--${accent})` }} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide truncate" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <p className="pe-serif text-3xl mt-1" style={{ color: 'var(--ink)' }}>{value}</p>
          {sublabel && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sublabel}</p>}
        </div>
        {Icon && (
          <div className="rounded-full p-2 shrink-0" style={{ background: `var(--${accent}-soft)` }}>
            <Icon size={18} style={{ color: `var(--${accent})` }} />
          </div>
        )}
      </div>
    </Card>
  );
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h2 className="pe-serif text-2xl md:text-3xl" style={{ color: 'var(--ink)' }}>{title}</h2>
        {subtitle && <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(23,32,56,0.45)' }} onClick={onClose}>
      <div
        className={`pe-animate-in w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 md:p-6`}
        style={{ border: '1px solid var(--line)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="pe-serif text-xl" style={{ color: 'var(--ink)' }}>{title}</h3>
          <button onClick={onClose} className="pe-btn p-1 rounded-full" style={{ color: 'var(--text-muted)' }} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmButton({ onConfirm, label = 'Excluir' }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          onClick={() => { onConfirm(); setConfirming(false); }}
          className="pe-btn text-[11px] font-semibold px-2 py-1 rounded-md"
          style={{ background: 'var(--brick)', color: '#fff' }}
        >
          Confirmar
        </button>
        <button onClick={() => setConfirming(false)} className="pe-btn text-[11px] px-2 py-1 rounded-md" style={{ background: 'var(--line)', color: 'var(--text)' }}>
          Cancelar
        </button>
      </span>
    );
  }
  return (
    <button onClick={() => setConfirming(true)} className="pe-btn p-1.5 rounded-md" style={{ color: 'var(--text-muted)' }} title={label} aria-label={label}>
      <Trash2 size={15} />
    </button>
  );
}

function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-4">
      <div className="rounded-full p-3 mb-3" style={{ background: 'var(--paper)', border: '1px dashed var(--line)' }}>
        {Icon && <Icon size={22} style={{ color: 'var(--text-muted)' }} />}
      </div>
      <p className="pe-serif text-lg" style={{ color: 'var(--ink)' }}>{title}</p>
      {description && <p className="text-sm mt-1 max-w-sm" style={{ color: 'var(--text-muted)' }}>{description}</p>}
      {actionLabel && onAction && (
        <div className="mt-4">
          <Btn icon={Plus} onClick={onAction} variant="accent">{actionLabel}</Btn>
        </div>
      )}
    </div>
  );
}

function Sidebar({ view, setView, open, setOpen, revisoesPendentes, userEmail, onSignOut }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-30 md:hidden" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setOpen(false)} />}
      <aside
        className={`fixed md:sticky top-0 z-40 h-screen flex flex-col shrink-0 transition-transform duration-200 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: 236, background: 'var(--ink)' }}
      >
        <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
          <Selo size={32} />
          <div>
            <p className="pe-serif text-[17px] leading-tight" style={{ color: '#fff' }}>Painel de Estudos</p>
            <p className="text-[10px] tracking-wide uppercase" style={{ color: 'rgba(255,255,255,0.45)' }}>Central de concursos</p>
          </div>
          <button className="ml-auto md:hidden pe-btn p-1" style={{ color: '#fff' }} onClick={() => setOpen(false)} aria-label="Fechar menu">
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = view === item.key;
            return (
              <button
                key={item.key}
                onClick={() => { setView(item.key); setOpen(false); }}
                className="pe-navitem w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium mb-1 transition-colors"
                style={{ background: active ? 'rgba(173,131,46,0.18)' : 'transparent', color: active ? 'var(--gold)' : 'rgba(255,255,255,0.75)' }}
              >
                <Icon size={17} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.key === 'revisoes' && revisoesPendentes > 0 && (
                  <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5 pe-mono" style={{ background: 'var(--brick)', color: '#fff' }}>
                    {revisoesPendentes}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="px-4 py-3.5 border-t flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Conectado como</p>
            <p className="text-[12px] truncate" style={{ color: 'rgba(255,255,255,0.75)' }} title={userEmail}>{userEmail}</p>
          </div>
          <button
            onClick={onSignOut}
            className="pe-btn p-1.5 rounded-md shrink-0"
            style={{ color: 'rgba(255,255,255,0.55)' }}
            title="Sair"
            aria-label="Sair da conta"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}

function TopBar({ setSidebarOpen, title }) {
  return (
    <div className="flex items-center gap-3 px-4 md:px-8 pt-5 pb-1 md:hidden">
      <button onClick={() => setSidebarOpen(true)} className="pe-btn p-2 rounded-lg" style={{ border: '1px solid var(--line)', background: '#fff' }} aria-label="Abrir menu">
        <Menu size={18} />
      </button>
      <p className="pe-serif text-lg" style={{ color: 'var(--ink)' }}>{title}</p>
    </div>
  );
}

/* ============================================================================
   DASHBOARD
============================================================================ */
function MetaEditor({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="pe-btn text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--teal)' }}>
        <Pencil size={11} /> Ajustar meta
      </button>
    );
  }
  return (
    <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); onSave(Number(v) || 0); setEditing(false); }}>
      <TextInput type="number" min="0" value={v} onChange={(e) => setV(e.target.value)} style={{ width: 60 }} className="text-xs py-1" autoFocus />
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>h/sem</span>
      <button type="submit" className="pe-btn text-xs font-semibold" style={{ color: 'var(--teal)' }}>OK</button>
    </form>
  );
}

function DashboardView({ state, derived, goTo, actions }) {
  const { concursos } = state;
  const {
    hojeISO, minHoje, minSemana, metaMin, questoesTotais, taxaAcerto,
    materiasPendentesCount, revisoesPendentes, progressoPorConcurso, last14,
  } = derived;

  const faltamMin = Math.max(0, metaMin - minSemana);
  const metaPct = pct(minSemana, metaMin);

  const proximaProva = useMemo(() => {
    return concursos
      .filter((c) => c.dataProva && diffDaysFromToday(c.dataProva) >= 0)
      .sort((a, b) => a.dataProva.localeCompare(b.dataProva))[0];
  }, [concursos]);

  const proximasRevisoes = useMemo(
    () => revisoesPendentes.slice().sort((a, b) => a.dataRevisao.localeCompare(b.dataRevisao)).slice(0, 6),
    [revisoesPendentes]
  );
  const revisoesAtrasadasCount = useMemo(() => revisoesPendentes.filter((r) => r.dataRevisao < hojeISO).length, [revisoesPendentes, hojeISO]);
  const revisoesHojeCount = useMemo(() => revisoesPendentes.filter((r) => r.dataRevisao === hojeISO).length, [revisoesPendentes, hojeISO]);

  const maxMin14 = Math.max(1, ...last14.map((d) => d.min));

  return (
    <div>
      <SectionHeader title="Dashboard" subtitle={`Hoje é ${weekdayLabel(hojeISO)}, ${formatDateBR(hojeISO)}`} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-4">
        <StatCard icon={Clock} label="Estudado hoje" value={formatMin(minHoje)} accent="teal" />
        <StatCard icon={Calendar} label="Estudado na semana" value={formatMin(minSemana)} sublabel={`Meta: ${formatMin(metaMin)}`} accent="blue" />
        <StatCard icon={ListChecks} label="Questões feitas" value={questoesTotais} sublabel={`Acerto: ${taxaAcerto}%`} accent="gold" />
        <StatCard icon={Layers} label="Matérias pendentes" value={materiasPendentesCount} accent="plum" />
        <StatCard icon={RotateCcw} label="Revisões pendentes" value={revisoesPendentes.length} sublabel={revisoesAtrasadasCount > 0 ? `${revisoesAtrasadasCount} atrasada${revisoesAtrasadasCount > 1 ? 's' : ''}` : 'em dia'} accent={revisoesAtrasadasCount > 0 ? 'brick' : 'teal'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-2 gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Meta da semana</p>
            <div className="flex items-center gap-2">
              <span className="pe-mono text-xs" style={{ color: 'var(--text-muted)' }}>{metaPct}%</span>
              <MetaEditor value={state.metaSemanalHoras} onSave={actions.setMetaSemanalHoras} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-3 flex-wrap">
            <span className="pe-serif text-3xl" style={{ color: 'var(--ink)' }}>{formatMin(minSemana)}</span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>de {formatMin(metaMin)} · faltam {formatMin(faltamMin)}</span>
          </div>
          <ProgressBar value={metaPct} color="var(--teal)" height={10} />
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Últimos 14 dias</p>
            <div className="flex items-end gap-1 h-16">
              {last14.map((d) => (
                <div
                  key={d.iso}
                  className="flex-1 rounded-t"
                  style={{ height: `${Math.max(4, (d.min / maxMin14) * 100)}%`, background: d.iso === hojeISO ? 'var(--gold)' : 'var(--teal-soft)' }}
                  title={`${formatDateBR(d.iso)} · ${formatMin(d.min)}`}
                />
              ))}
            </div>
          </div>
        </Card>

        {proximaProva ? (
          <Card style={{ background: 'var(--ink)', border: 'none' }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.55)' }}>Próxima prova</p>
            <p className="pe-serif text-xl mt-1 leading-snug" style={{ color: '#fff' }}>{proximaProva.nome}</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{proximaProva.banca || 'Banca a definir'}</p>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="pe-serif text-4xl" style={{ color: 'var(--gold)' }}>{diffDaysFromToday(proximaProva.dataProva)}</span>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>dias restantes</span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Prova em {formatDateBR(proximaProva.dataProva)}</p>
          </Card>
        ) : (
          <Card className="flex flex-col items-center justify-center text-center">
            <Selo size={40} />
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Cadastre um concurso com data de prova para ver a contagem regressiva aqui.</p>
            <div className="mt-3"><Btn size="sm" icon={Plus} onClick={() => goTo('concursos')} variant="accent">Cadastrar concurso</Btn></div>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Revisões</p>
            <button onClick={() => goTo('revisoes')} className="pe-btn text-xs font-semibold flex items-center gap-0.5" style={{ color: 'var(--teal)' }}>
              Ver todas <ChevronRight size={13} />
            </button>
          </div>
          {revisoesPendentes.length > 0 && (
            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
              {revisoesAtrasadasCount > 0 && <Badge label={`${revisoesAtrasadasCount} atrasada${revisoesAtrasadasCount > 1 ? 's' : ''}`} color="var(--brick)" bg="var(--brick-soft)" />}
              {revisoesHojeCount > 0 && <Badge label={`${revisoesHojeCount} para hoje`} color="var(--gold)" bg="var(--gold-soft)" />}
              <Badge label={`${revisoesPendentes.length} no total`} color="var(--text-muted)" bg="var(--paper)" />
            </div>
          )}
          {proximasRevisoes.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>Nenhuma revisão pendente. Registre um estudo para gerar revisões automáticas.</p>
          ) : (
            <div className="space-y-1">
              {proximasRevisoes.map((r) => {
                const atrasada = r.dataRevisao < hojeISO;
                const hoje = r.dataRevisao === hojeISO;
                return (
                  <div key={r.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0" style={{ borderColor: 'var(--line)' }}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{r.assuntoNome}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{r.materiaNome} · {r.numero}ª revisão</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge
                        label={atrasada ? `Atrasada · ${formatDateBR(r.dataRevisao)}` : hoje ? 'Hoje' : formatDateBR(r.dataRevisao)}
                        color={atrasada ? 'var(--brick)' : hoje ? 'var(--gold)' : 'var(--text-muted)'}
                        bg={atrasada ? 'var(--brick-soft)' : hoje ? 'var(--gold-soft)' : 'var(--paper)'}
                      />
                      <button
                        onClick={() => actions.toggleRevisao(r.id)}
                        className="pe-btn p-1 rounded-md shrink-0"
                        style={{ color: 'var(--teal)' }}
                        title="Marcar como concluída"
                        aria-label="Marcar como concluída"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Progresso por concurso</p>
            <button onClick={() => goTo('concursos')} className="pe-btn text-xs font-semibold flex items-center gap-0.5" style={{ color: 'var(--teal)' }}>
              Ver todos <ChevronRight size={13} />
            </button>
          </div>
          {progressoPorConcurso.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>Nenhum concurso cadastrado ainda.</p>
          ) : (
            <div className="space-y-3">
              {progressoPorConcurso.slice(0, 5).map((p, i) => (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{p.nome}</p>
                    <span className="pe-mono text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{p.progresso}%</span>
                  </div>
                  <ProgressBar value={p.progresso} color={`var(--${ACCENTS[i % ACCENTS.length]})`} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ============================================================================
   CONCURSOS
============================================================================ */
function ConcursoFormModal({ open, onClose, onSave, initial }) {
  const blank = { nome: '', banca: '', cargo: '', dataProva: '', status: 'planejando', editalLink: '', observacoes: '' };
  const [form, setForm] = useState(blank);
  useEffect(() => { setForm(initial ? { ...blank, ...initial } : blank); }, [initial, open]); // eslint-disable-line

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    onSave({ ...form, id: initial?.id || uid(), createdAt: initial?.createdAt || Date.now() });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar concurso' : 'Novo concurso'}>
      <form onSubmit={submit}>
        <Field label="Nome do concurso" required>
          <TextInput value={form.nome} onChange={set('nome')} placeholder="Ex: INSS Técnico do Seguro Social" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Banca">
            <TextInput value={form.banca} onChange={set('banca')} placeholder="Ex: Cebraspe" />
          </Field>
          <Field label="Cargo">
            <TextInput value={form.cargo} onChange={set('cargo')} placeholder="Ex: Técnico" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data da prova">
            <TextInput type="date" value={form.dataProva} onChange={set('dataProva')} />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set('status')}>
              {STATUS_CONCURSO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Edital (link)" hint="Cole aqui a URL do PDF do edital — o painel guarda texto e links, não arquivos.">
          <TextInput value={form.editalLink} onChange={set('editalLink')} placeholder="https://..." />
        </Field>
        <Field label="Observações">
          <TextArea value={form.observacoes} onChange={set('observacoes')} rows={3} placeholder="Anotações gerais sobre o concurso..." />
        </Field>
        <div className="flex justify-end gap-2 mt-4">
          <Btn variant="ghost" onClick={onClose} type="button">Cancelar</Btn>
          <Btn variant="accent" type="submit" icon={Save}>Salvar</Btn>
        </div>
      </form>
    </Modal>
  );
}

function ConcursosView({ state, derived, actions }) {
  const { concursos } = state;
  const { progressoPorConcurso } = derived;
  const progressoMap = useMemo(() => Object.fromEntries(progressoPorConcurso.map((p) => [p.id, p])), [progressoPorConcurso]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (c) => { setEditing(c); setModalOpen(true); };

  return (
    <div>
      <SectionHeader
        title="Concursos"
        subtitle="Cadastre os concursos que está estudando e acompanhe o progresso de cada edital."
        action={<Btn icon={Plus} variant="accent" onClick={openNew}>Novo concurso</Btn>}
      />

      {concursos.length === 0 ? (
        <Card>
          <EmptyState
            icon={Landmark}
            title="Nenhum concurso cadastrado"
            description="Cadastre o primeiro concurso para começar a organizar matérias, cronograma e revisões."
            actionLabel="Cadastrar concurso"
            onAction={openNew}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {concursos.map((c) => {
            const st = STATUS_CONCURSO_MAP[c.status] || STATUS_CONCURSO[0];
            const prog = progressoMap[c.id];
            const dias = c.dataProva ? diffDaysFromToday(c.dataProva) : null;
            return (
              <Card key={c.id} className="relative">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="pe-serif text-lg leading-snug" style={{ color: 'var(--ink)' }}>{c.nome}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{[c.banca, c.cargo].filter(Boolean).join(' · ') || 'Sem banca/cargo definidos'}</p>
                  </div>
                  <Badge label={st.label} color={st.color} bg={st.bg} />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1"><Calendar size={13} /> {c.dataProva ? formatDateBR(c.dataProva) : 'Data não definida'}</span>
                  {dias !== null && dias >= 0 && <Badge label={`${dias} dias restantes`} color="var(--brick)" bg="var(--brick-soft)" />}
                  {dias !== null && dias < 0 && <Badge label="Prova realizada" color="var(--text-muted)" bg="var(--paper)" />}
                </div>

                {prog && prog.totalAssuntos > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{prog.dominados}/{prog.totalAssuntos} assuntos dominados</span>
                      <span className="pe-mono text-xs" style={{ color: 'var(--text-muted)' }}>{prog.progresso}%</span>
                    </div>
                    <ProgressBar value={prog.progresso} />
                  </div>
                )}

                {c.editalLink && (
                  <a href={c.editalLink} target="_blank" rel="noopener noreferrer" className="text-xs underline break-all" style={{ color: 'var(--blue)' }}>
                    {c.editalLink}
                  </a>
                )}
                {c.observacoes && <p className="text-xs mt-2 whitespace-pre-wrap" style={{ color: 'var(--text-muted)' }}>{c.observacoes}</p>}

                <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
                  <button onClick={() => openEdit(c)} className="pe-btn p-1.5 rounded-md" style={{ color: 'var(--text-muted)' }} title="Editar" aria-label="Editar">
                    <Pencil size={15} />
                  </button>
                  <ConfirmButton onConfirm={() => actions.deleteConcurso(c.id)} label="Excluir concurso" />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConcursoFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={actions.saveConcurso} initial={editing} />
    </div>
  );
}

/* ============================================================================
   MATÉRIAS E ASSUNTOS
============================================================================ */
function StatusAssuntoSelect({ value, onChange }) {
  const st = STATUS_ASSUNTO_MAP[value] || STATUS_ASSUNTO[0];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-[11px] font-semibold rounded-full px-2 py-1 outline-none cursor-pointer border-0"
      style={{ color: st.color, background: st.bg }}
    >
      {STATUS_ASSUNTO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
    </select>
  );
}

function MateriaFormModal({ open, onClose, onSave, initial, concursoId }) {
  const [nome, setNome] = useState('');
  const [horasCiclo, setHorasCiclo] = useState('2');
  useEffect(() => {
    setNome(initial?.nome || '');
    setHorasCiclo(initial?.horasCiclo ? String(initial.horasCiclo) : '2');
  }, [initial, open]);
  const submit = (e) => {
    e.preventDefault();
    if (!nome.trim()) return;
    const hc = Number(horasCiclo);
    onSave({
      id: initial?.id || uid(), concursoId: initial?.concursoId || concursoId, nome: nome.trim(),
      horasCiclo: hc > 0 ? hc : 2, createdAt: initial?.createdAt || Date.now(),
    });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar matéria' : 'Nova matéria'}>
      <form onSubmit={submit}>
        <Field label="Nome da matéria" required>
          <TextInput value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Direito Constitucional" autoFocus />
        </Field>
        <Field label="Horas por volta no ciclo de estudos" hint="Quanto tempo dedicar a esta matéria a cada rodada do ciclo (aba Cronograma).">
          <TextInput type="number" min="0.5" step="0.5" value={horasCiclo} onChange={(e) => setHorasCiclo(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Btn variant="ghost" type="button" onClick={onClose}>Cancelar</Btn>
          <Btn variant="accent" type="submit" icon={Save}>Salvar</Btn>
        </div>
      </form>
    </Modal>
  );
}

function AssuntoFormModal({ open, onClose, onSave, initial, materiaId }) {
  const blank = { nome: '', status: 'nao_iniciado' };
  const [form, setForm] = useState(blank);
  useEffect(() => { setForm(initial ? { nome: initial.nome, status: initial.status } : blank); }, [initial, open]); // eslint-disable-line
  const submit = (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    onSave({ id: initial?.id || uid(), materiaId: initial?.materiaId || materiaId, nome: form.nome.trim(), status: form.status, createdAt: initial?.createdAt || Date.now() });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar assunto' : 'Novo assunto'}>
      <form onSubmit={submit}>
        <Field label="Nome do assunto" required>
          <TextInput value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex: Controle de constitucionalidade" autoFocus />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            {STATUS_ASSUNTO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Btn variant="ghost" type="button" onClick={onClose}>Cancelar</Btn>
          <Btn variant="accent" type="submit" icon={Save}>Salvar</Btn>
        </div>
      </form>
    </Modal>
  );
}

/* Divide um texto colado em vários nomes de assunto.
   Aceita um por linha, separados por ";" ou (quando vem tudo numa linha só) por vírgula.
   Remove marcadores de lista comuns no começo (1. , 2) , - , • ...) e itens repetidos. */
function parseAssuntosBloco(texto) {
  const bruto = (texto || '').trim();
  if (!bruto) return [];
  let partes;
  if (/[\n;]/.test(bruto)) partes = bruto.split(/[\n;]+/);
  else if (bruto.includes(',')) partes = bruto.split(/,+/);
  else partes = [bruto];
  const vistos = new Set();
  const out = [];
  partes.forEach((p) => {
    const nome = p.replace(/^\s*(\d+\s*[.)\-–]|[-•*–▪◦])\s*/, '').trim();
    if (!nome) return;
    const chave = nome.toLowerCase();
    if (vistos.has(chave)) return;
    vistos.add(chave);
    out.push(nome);
  });
  return out;
}

function CadastroRapidoModal({ open, onClose, onSave, materias, concursoId, materiaIdInicial }) {
  const NOVA = '__nova__';
  const [materiaSel, setMateriaSel] = useState(NOVA);
  const [nomeNova, setNomeNova] = useState('');
  const [texto, setTexto] = useState('');

  useEffect(() => {
    if (!open) return;
    setMateriaSel(materiaIdInicial || NOVA);
    setNomeNova('');
    setTexto('');
  }, [open, materiaIdInicial]);

  const assuntosParseados = useMemo(() => parseAssuntosBloco(texto), [texto]);
  const criandoNova = materiaSel === NOVA;
  const podeSalvar = assuntosParseados.length > 0 && (!criandoNova || !!nomeNova.trim());

  const submit = (e) => {
    e.preventDefault();
    if (!podeSalvar) return;
    if (criandoNova) {
      onSave({
        novaMateria: { id: uid(), concursoId, nome: nomeNova.trim(), horasCiclo: 2, createdAt: Date.now() },
        nomesAssuntos: assuntosParseados,
      });
    } else {
      onSave({ materiaId: materiaSel, nomesAssuntos: assuntosParseados });
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Cadastro rápido de assuntos" wide>
      <form onSubmit={submit}>
        <Field label="Matéria" required hint="Crie uma matéria nova aqui mesmo ou jogue os assuntos numa que já existe.">
          <Select value={materiaSel} onChange={(e) => setMateriaSel(e.target.value)}>
            <option value={NOVA}>➕ Nova matéria...</option>
            {materias.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Select>
        </Field>

        {criandoNova && (
          <Field label="Nome da nova matéria" required>
            <TextInput value={nomeNova} onChange={(e) => setNomeNova(e.target.value)} placeholder="Ex: Direito Constitucional" autoFocus />
          </Field>
        )}

        <Field
          label="Assuntos"
          required
          hint='Cole vários de uma vez: um por linha (ou separados por ";"). Numeração e marcadores tipo "1." ou "-" são removidos sozinhos, e assuntos repetidos são ignorados.'
        >
          <TextArea
            rows={9}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={'Controle de constitucionalidade\nOrganização do Estado\nDireitos e garantias fundamentais\nPoder Executivo\nProcesso legislativo'}
          />
        </Field>

        <div className="flex items-center justify-between gap-3 mt-1 flex-wrap">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {assuntosParseados.length > 0
              ? `${assuntosParseados.length} assunto${assuntosParseados.length !== 1 ? 's' : ''} ser${assuntosParseados.length !== 1 ? 'ão' : 'á'} adicionado${assuntosParseados.length !== 1 ? 's' : ''}`
              : 'Nenhum assunto detectado ainda'}
          </p>
          <div className="flex gap-2">
            <Btn variant="ghost" type="button" onClick={onClose}>Cancelar</Btn>
            <Btn variant="accent" type="submit" icon={Save} disabled={!podeSalvar}>Adicionar</Btn>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function MateriasView({ state, actions }) {
  const { concursos, materias, assuntos } = state;
  const [concursoId, setConcursoId] = useState(concursos[0]?.id || null);
  useEffect(() => { if ((!concursoId || !concursos.some((c) => c.id === concursoId)) && concursos[0]) setConcursoId(concursos[0].id); }, [concursos, concursoId]);

  const [expanded, setExpanded] = useState({});
  const [materiaModal, setMateriaModal] = useState({ open: false, editing: null });
  const [assuntoModal, setAssuntoModal] = useState({ open: false, editing: null, materiaId: null });
  const [rapidoModal, setRapidoModal] = useState({ open: false, materiaId: null });

  if (concursos.length === 0) {
    return (
      <div>
        <SectionHeader title="Matérias e assuntos" subtitle="Organize o conteúdo de cada edital em matérias e assuntos." />
        <Card>
          <EmptyState icon={BookOpen} title="Cadastre um concurso primeiro" description="As matérias ficam organizadas dentro de cada concurso. Cadastre um concurso para começar a montar o conteúdo programático." />
        </Card>
      </div>
    );
  }

  const materiasDoConcurso = materias.filter((m) => m.concursoId === concursoId);

  return (
    <div>
      <SectionHeader
        title="Matérias e assuntos"
        subtitle="Organize o conteúdo de cada edital e controle o status de cada assunto."
        action={(
          <div className="flex gap-2">
            <Btn icon={Layers} variant="gold" onClick={() => setRapidoModal({ open: true, materiaId: null })}>Cadastro rápido</Btn>
            <Btn icon={Plus} variant="accent" onClick={() => setMateriaModal({ open: true, editing: null })}>Nova matéria</Btn>
          </div>
        )}
      />

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {concursos.map((c) => (
          <button
            key={c.id}
            onClick={() => setConcursoId(c.id)}
            className="pe-btn shrink-0 text-sm font-medium px-3.5 py-2 rounded-lg"
            style={{ background: concursoId === c.id ? 'var(--ink)' : '#fff', color: concursoId === c.id ? '#fff' : 'var(--text)', border: '1px solid var(--line)' }}
          >
            {c.nome}
          </button>
        ))}
      </div>

      {materiasDoConcurso.length === 0 ? (
        <Card>
          <EmptyState icon={BookOpen} title="Nenhuma matéria cadastrada" description="Adicione as matérias do edital deste concurso." actionLabel="Nova matéria" onAction={() => setMateriaModal({ open: true, editing: null })} />
        </Card>
      ) : (
        <div className="space-y-3">
          {materiasDoConcurso.map((m) => {
            const assuntosDaMateria = assuntos.filter((a) => a.materiaId === m.id);
            const progresso = assuntosDaMateria.length ? Math.round(sum(assuntosDaMateria.map((a) => STATUS_WEIGHT[a.status])) / assuntosDaMateria.length) : 0;
            const isOpen = !!expanded[m.id];
            return (
              <Card key={m.id} padded={false}>
                <div
                  className="w-full flex items-center gap-3 p-4 text-left cursor-pointer select-none"
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpanded((e) => ({ ...e, [m.id]: !e[m.id] }))}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded((ex) => ({ ...ex, [m.id]: !ex[m.id] })); }}
                >
                  {isOpen ? <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold" style={{ color: 'var(--ink)' }}>{m.nome}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{assuntosDaMateria.length} assunto{assuntosDaMateria.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="w-24 hidden sm:block"><ProgressBar value={progresso} /></div>
                  <span className="pe-mono text-xs w-9 text-right shrink-0" style={{ color: 'var(--text-muted)' }}>{progresso}%</span>
                  <button onClick={(e) => { e.stopPropagation(); setMateriaModal({ open: true, editing: m }); }} className="pe-btn p-1.5 rounded-md" style={{ color: 'var(--text-muted)' }} aria-label="Editar matéria">
                    <Pencil size={14} />
                  </button>
                  <div onClick={(e) => e.stopPropagation()}>
                    <ConfirmButton onConfirm={() => actions.deleteMateria(m.id)} label="Excluir matéria" />
                  </div>
                </div>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: 'var(--line)' }}>
                    {assuntosDaMateria.length === 0 ? (
                      <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>Nenhum assunto cadastrado nesta matéria.</p>
                    ) : (
                      <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
                        {assuntosDaMateria.map((a) => (
                          <div key={a.id} className="pe-row flex items-center gap-2 py-2.5 rounded-lg px-1 -mx-1">
                            <p className="flex-1 text-sm min-w-0 truncate" style={{ color: 'var(--text)' }}>{a.nome}</p>
                            {a.status === 'dominado' && <Selo size={16} />}
                            <StatusAssuntoSelect value={a.status} onChange={(v) => actions.saveAssunto({ ...a, status: v })} />
                            <button onClick={() => setAssuntoModal({ open: true, editing: a, materiaId: m.id })} className="pe-btn p-1.5 rounded-md" style={{ color: 'var(--text-muted)' }} aria-label="Editar assunto">
                              <Pencil size={13} />
                            </button>
                            <ConfirmButton onConfirm={() => actions.deleteAssunto(a.id)} label="Excluir assunto" />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex gap-2 flex-wrap">
                      <Btn size="sm" variant="ghost" icon={Plus} onClick={() => setAssuntoModal({ open: true, editing: null, materiaId: m.id })}>Novo assunto</Btn>
                      <Btn size="sm" variant="ghost" icon={Layers} onClick={() => setRapidoModal({ open: true, materiaId: m.id })}>Colar vários</Btn>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <MateriaFormModal open={materiaModal.open} onClose={() => setMateriaModal({ open: false, editing: null })} onSave={actions.saveMateria} initial={materiaModal.editing} concursoId={concursoId} />
      <AssuntoFormModal open={assuntoModal.open} onClose={() => setAssuntoModal({ open: false, editing: null, materiaId: null })} onSave={actions.saveAssunto} initial={assuntoModal.editing} materiaId={assuntoModal.materiaId} />
      <CadastroRapidoModal
        open={rapidoModal.open}
        onClose={() => setRapidoModal({ open: false, materiaId: null })}
        onSave={actions.cadastrarAssuntosEmMassa}
        materias={materiasDoConcurso}
        concursoId={concursoId}
        materiaIdInicial={rapidoModal.materiaId}
      />
    </div>
  );
}

/* ============================================================================
   CRONOGRAMA SEMANAL
============================================================================ */
function durationMin(b) {
  if (!b.horarioInicio || !b.horarioFim) return 0;
  const [h1, m1] = b.horarioInicio.split(':').map(Number);
  const [h2, m2] = b.horarioFim.split(':').map(Number);
  return Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1));
}

function CronogramaFormModal({ open, onClose, onSave, onDelete, initial, dia, materias }) {
  const blank = { dia: 'seg', horarioInicio: '08:00', horarioFim: '09:00', materiaId: '', atividade: TIPOS_ESTUDO[0] };
  const [form, setForm] = useState(blank);
  useEffect(() => { setForm(initial ? { ...blank, ...initial } : { ...blank, dia: dia || 'seg' }); }, [initial, open, dia]); // eslint-disable-line

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.horarioInicio || !form.horarioFim) return;
    onSave({ ...form, id: initial?.id || uid() });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar bloco' : 'Novo bloco de estudo'}>
      <form onSubmit={submit}>
        <Field label="Dia da semana" required>
          <Select value={form.dia} onChange={set('dia')}>
            {DIAS_SEMANA.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Início" required><TextInput type="time" value={form.horarioInicio} onChange={set('horarioInicio')} /></Field>
          <Field label="Fim" required><TextInput type="time" value={form.horarioFim} onChange={set('horarioFim')} /></Field>
        </div>
        <Field label="Matéria">
          <Select value={form.materiaId} onChange={set('materiaId')}>
            <option value="">Sem matéria específica</option>
            {materias.map((m) => <option key={m.id} value={m.id}>{m.displayNome}</option>)}
          </Select>
        </Field>
        <Field label="Atividade">
          <Select value={form.atividade} onChange={set('atividade')}>
            {TIPOS_ESTUDO.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <div className="flex justify-between items-center gap-2 mt-4">
          {initial ? <Btn variant="danger" type="button" icon={Trash2} onClick={() => { onDelete(initial.id); onClose(); }}>Excluir</Btn> : <span />}
          <div className="flex gap-2">
            <Btn variant="ghost" type="button" onClick={onClose}>Cancelar</Btn>
            <Btn variant="accent" type="submit" icon={Save}>Salvar</Btn>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function CicloEstudos({ state, goToRegistroComPrefill }) {
  const { concursos, materias, sessoes } = state;
  const [concursoId, setConcursoId] = useState(concursos[0]?.id || null);
  useEffect(() => {
    if ((!concursoId || !concursos.some((c) => c.id === concursoId)) && concursos[0]) setConcursoId(concursos[0].id);
  }, [concursos]); // eslint-disable-line

  const materiasDoConcurso = useMemo(
    () => materias.filter((m) => m.concursoId === concursoId).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
    [materias, concursoId]
  );

  const itens = useMemo(() => {
    if (materiasDoConcurso.length === 0) return [];
    const minutosPorMateria = {};
    sessoes.forEach((s) => { if (s.materiaId) minutosPorMateria[s.materiaId] = (minutosPorMateria[s.materiaId] || 0) + s.tempoMinutos; });
    const base = materiasDoConcurso.map((m) => {
      const horasVolta = Number(m.horasCiclo) > 0 ? Number(m.horasCiclo) : 2;
      const minutosVolta = horasVolta * 60;
      const minutosEstudados = minutosPorMateria[m.id] || 0;
      const voltasCompletas = minutosEstudados / minutosVolta;
      const voltaAtual = Math.floor(voltasCompletas) + 1;
      const minutosNaVolta = minutosEstudados - Math.floor(voltasCompletas) * minutosVolta;
      const progressoVolta = clamp(Math.round((minutosNaVolta / minutosVolta) * 100), 0, 100);
      return { materiaId: m.id, concursoId: m.concursoId, nome: m.nome, horasVolta, voltasCompletas, voltaAtual, minutosNaVolta, progressoVolta };
    });
    let proximaIdx = 0;
    base.forEach((it, i) => { if (it.voltasCompletas < base[proximaIdx].voltasCompletas) proximaIdx = i; });
    return base.map((it, i) => ({ ...it, proxima: i === proximaIdx }));
  }, [materiasDoConcurso, sessoes]);

  const totalHoras = sum(itens.map((it) => it.horasVolta));

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-1">
        <Repeat size={16} style={{ color: 'var(--plum)' }} />
        <p className="pe-serif text-lg" style={{ color: 'var(--ink)' }}>Ciclo de estudos</p>
        {itens.length > 0 && (
          <span className="text-xs ml-auto shrink-0" style={{ color: 'var(--text-muted)' }}>{itens.length} matérias · {totalHoras}h por volta completa</span>
        )}
      </div>
      <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
        Estude sempre a matéria destacada como "Próxima" — é a que está mais atrasada em relação ao seu peso no ciclo. As horas por volta de cada matéria são ajustadas na aba Matérias.
      </p>

      {concursos.length === 0 ? (
        <Card><EmptyState icon={Repeat} title="Cadastre um concurso primeiro" description="O ciclo de estudos é montado a partir das matérias de cada concurso." /></Card>
      ) : (
        <>
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {concursos.map((c) => (
              <button
                key={c.id}
                onClick={() => setConcursoId(c.id)}
                className="pe-btn shrink-0 text-sm font-medium px-3.5 py-2 rounded-lg"
                style={{ background: concursoId === c.id ? 'var(--ink)' : '#fff', color: concursoId === c.id ? '#fff' : 'var(--text)', border: '1px solid var(--line)' }}
              >
                {c.nome}
              </button>
            ))}
          </div>

          {itens.length === 0 ? (
            <Card><EmptyState icon={Repeat} title="Nenhuma matéria cadastrada" description="Adicione matérias a este concurso na aba Matérias para montar o ciclo." /></Card>
          ) : (
            <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
              {itens.map((it, i) => (
                <React.Fragment key={it.materiaId}>
                  <Card padded={false} className="shrink-0 pe-animate-in" style={{ width: 188, border: it.proxima ? '2px solid var(--plum)' : '1px solid var(--line)' }}>
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="pe-mono text-[11px] font-bold rounded-full flex items-center justify-center shrink-0"
                          style={{ width: 22, height: 22, background: it.proxima ? 'var(--plum)' : 'var(--paper)', color: it.proxima ? '#fff' : 'var(--text-muted)' }}
                        >
                          {i + 1}
                        </span>
                        {it.proxima && <Badge label="Próxima" color="var(--plum)" bg="var(--plum-soft)" />}
                      </div>
                      <p className="text-sm font-semibold truncate mb-1" style={{ color: 'var(--ink)' }} title={it.nome}>{it.nome}</p>
                      <p className="text-[11px] mb-1.5" style={{ color: 'var(--text-muted)' }}>Volta {it.voltaAtual} · {formatMin(it.minutosNaVolta)} de {it.horasVolta}h</p>
                      <ProgressBar value={it.progressoVolta} color={it.proxima ? 'var(--plum)' : 'var(--teal)'} height={6} />
                      <div className="mt-2.5">
                        <Btn
                          size="sm" variant="ghost" icon={ClipboardList} className="w-full justify-center"
                          onClick={() => goToRegistroComPrefill({ concursoId: it.concursoId, materiaId: it.materiaId, tipoEstudo: TIPOS_ESTUDO[0] })}
                        >
                          Estudar
                        </Btn>
                      </div>
                    </div>
                  </Card>
                  {i < itens.length - 1 && (
                    <div className="flex items-center shrink-0" style={{ color: 'var(--line)' }}><ChevronRight size={16} /></div>
                  )}
                </React.Fragment>
              ))}
              <div className="flex items-center shrink-0 pl-1 pr-2" style={{ color: 'var(--text-muted)' }} title="Volta ao início do ciclo">
                <ChevronRight size={16} style={{ color: 'var(--line)' }} />
                <Repeat size={15} className="ml-1" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CronogramaView({ state, derived, actions, goToRegistroComPrefill }) {
  const { cronograma, materias } = state;
  const { concursoMap } = derived;
  const [modal, setModal] = useState({ open: false, editing: null, dia: 'seg' });

  const materiaMap = useMemo(() => Object.fromEntries(materias.map((m) => [m.id, m])), [materias]);
  const materiasComConcurso = useMemo(
    () => materias.map((m) => ({ ...m, displayNome: `${m.nome}${concursoMap[m.concursoId] ? ' — ' + concursoMap[m.concursoId].nome : ''}` })),
    [materias, concursoMap]
  );

  const totalSemanaMin = sum(cronograma.map(durationMin));

  return (
    <div>
      <SectionHeader
        title="Cronograma"
        subtitle="Seu ciclo de estudos por matéria e o planejamento de blocos por dia da semana."
      />

      <CicloEstudos state={state} goToRegistroComPrefill={goToRegistroComPrefill} />

      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <p className="pe-serif text-lg" style={{ color: 'var(--ink)' }}>Blocos por dia da semana</p>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Total planejado: {formatMin(totalSemanaMin)} / semana</span>
          <Btn icon={Plus} variant="accent" size="sm" onClick={() => setModal({ open: true, editing: null, dia: 'seg' })}>Novo bloco</Btn>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {DIAS_SEMANA.map((dia) => {
          const blocks = cronograma.filter((b) => b.dia === dia.key).sort((a, b) => a.horarioInicio.localeCompare(b.horarioInicio));
          const totalDia = sum(blocks.map(durationMin));
          return (
            <div key={dia.key} className="shrink-0" style={{ width: 208 }}>
              <Card padded={false} className="h-full flex flex-col">
                <div className="px-3 py-2.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--line)' }}>
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{dia.label}</p>
                  <span className="pe-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{totalDia ? formatMin(totalDia) : '—'}</span>
                </div>
                <div className="p-2 space-y-1.5 flex-1" style={{ minHeight: 90 }}>
                  {blocks.length === 0 ? (
                    <p className="text-[11px] text-center py-6" style={{ color: 'var(--text-muted)' }}>Sem blocos</p>
                  ) : (
                    blocks.map((b, i) => {
                      const accent = ACCENTS[i % ACCENTS.length];
                      return (
                        <button
                          key={b.id}
                          onClick={() => setModal({ open: true, editing: b, dia: dia.key })}
                          className="pe-btn w-full text-left rounded-lg p-2"
                          style={{ background: '#fff', border: '1px solid var(--line)', borderLeft: `3px solid var(--${accent})` }}
                        >
                          <p className="text-[11px] font-semibold pe-mono" style={{ color: 'var(--ink)' }}>{b.horarioInicio}–{b.horarioFim}</p>
                          <p className="text-xs font-medium truncate mt-0.5" style={{ color: 'var(--text)' }}>{materiaMap[b.materiaId]?.nome || 'Geral'}</p>
                          <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{b.atividade}</p>
                        </button>
                      );
                    })
                  )}
                </div>
                <div className="p-2 pt-0">
                  <button
                    onClick={() => setModal({ open: true, editing: null, dia: dia.key })}
                    className="pe-btn w-full text-xs font-semibold py-1.5 rounded-lg flex items-center justify-center gap-1"
                    style={{ color: 'var(--teal)', border: '1px dashed var(--line)' }}
                  >
                    <Plus size={12} /> Adicionar
                  </button>
                </div>
              </Card>
            </div>
          );
        })}
      </div>

      <CronogramaFormModal
        open={modal.open}
        onClose={() => setModal({ open: false, editing: null, dia: 'seg' })}
        onSave={actions.saveCronogramaBloco}
        onDelete={actions.deleteCronogramaBloco}
        initial={modal.editing}
        dia={modal.dia}
        materias={materiasComConcurso}
      />
    </div>
  );
}

/* ============================================================================
   REGISTRO DE ESTUDOS
============================================================================ */
/* ============================================================================
   CRONÔMETRO DE ESTUDO
   Conta o tempo em tempo real e, ao parar, registra a sessão (com observações).
   O estado fica guardado no navegador (localStorage), então o cronômetro continua
   contando certo mesmo que você troque de aba dentro do painel ou recarregue a
   página — o tempo é calculado por horário real, não por "tique" de tela.
============================================================================ */
const CRONO_KEY = 'painel-estudos-cronometro-v1';

const lerCrono = () => {
  try { const raw = localStorage.getItem(CRONO_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
};
const gravarCrono = (obj) => {
  try {
    if (obj) localStorage.setItem(CRONO_KEY, JSON.stringify(obj));
    else localStorage.removeItem(CRONO_KEY);
  } catch { /* ignora (navegação privada, etc.) */ }
};

const fmtCronometro = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
};

function CronometroCard({ state, actions }) {
  const { concursos, materias, assuntos } = state;

  const [sel, setSel] = useState(() => {
    const salvo = lerCrono();
    const cid = salvo?.concursoId && concursos.some((c) => c.id === salvo.concursoId) ? salvo.concursoId : (concursos[0]?.id || '');
    const mid = salvo?.materiaId && materias.some((m) => m.id === salvo.materiaId && m.concursoId === cid) ? salvo.materiaId : '';
    const aid = salvo?.assuntoId && assuntos.some((a) => a.id === salvo.assuntoId && a.materiaId === mid) ? salvo.assuntoId : '';
    return { concursoId: cid, materiaId: mid, assuntoId: aid, tipoEstudo: salvo?.tipoEstudo || TIPOS_ESTUDO[0] };
  });
  const [running, setRunning] = useState(() => !!lerCrono()?.running);
  const [startTs, setStartTs] = useState(() => lerCrono()?.startTs || null);
  const [accMs, setAccMs] = useState(() => lerCrono()?.accMs || 0);
  const [finalizando, setFinalizando] = useState(() => !!lerCrono()?.finalizando);
  const [observacoes, setObservacoes] = useState(() => lerCrono()?.observacoes || '');
  const [gerarRevisoes, setGerarRevisoes] = useState(() => {
    const v = lerCrono()?.gerarRevisoes;
    return v === undefined ? true : !!v;
  });
  const [, setTick] = useState(0);

  // Mantém o relógio "andando" na tela enquanto está rodando.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  // Persiste o estado no navegador a cada mudança relevante.
  useEffect(() => {
    if (!running && !finalizando && accMs === 0) { gravarCrono(null); return; }
    gravarCrono({ ...sel, running, startTs, accMs, finalizando, observacoes, gerarRevisoes });
  }, [sel, running, startTs, accMs, finalizando, observacoes, gerarRevisoes]);

  const elapsedMs = accMs + (running && startTs ? Date.now() - startTs : 0);
  const emSessao = running || accMs > 0 || finalizando; // já começou a contar

  const materiasFiltradas = materias.filter((m) => m.concursoId === sel.concursoId);
  const assuntosFiltrados = assuntos.filter((a) => a.materiaId === sel.materiaId);

  const setCampo = (k) => (e) => {
    const v = e.target.value;
    setSel((s) => {
      const next = { ...s, [k]: v };
      if (k === 'concursoId') { next.materiaId = ''; next.assuntoId = ''; }
      if (k === 'materiaId') { next.assuntoId = ''; }
      return next;
    });
  };

  const iniciar = () => {
    if (!sel.concursoId) return;
    setStartTs(Date.now());
    setRunning(true);
    setFinalizando(false);
  };
  const pausar = () => {
    setAccMs((a) => a + (startTs ? Date.now() - startTs : 0));
    setStartTs(null);
    setRunning(false);
  };
  const retomar = () => {
    setStartTs(Date.now());
    setRunning(true);
  };
  const parar = () => {
    setAccMs((a) => a + (running && startTs ? Date.now() - startTs : 0));
    setStartTs(null);
    setRunning(false);
    setFinalizando(true);
  };
  const limpar = () => {
    setRunning(false);
    setStartTs(null);
    setAccMs(0);
    setFinalizando(false);
    setObservacoes('');
    setGerarRevisoes(true);
    gravarCrono(null);
  };

  const salvarSessao = () => {
    if (!sel.concursoId) return;
    const tempoMinutos = Math.max(1, Math.round(elapsedMs / 60000));
    actions.addSessao({
      id: uid(),
      data: todayISO(),
      concursoId: sel.concursoId,
      materiaId: sel.materiaId || null,
      assuntoId: sel.assuntoId || null,
      tempoMinutos,
      tipoEstudo: sel.tipoEstudo,
      questoesTotal: 0,
      acertos: 0,
      banca: '',
      observacoes,
      dificuldade: 'medio',
      gerarRevisoes: !!gerarRevisoes && !!sel.assuntoId,
      createdAt: Date.now(),
    });
    limpar();
  };

  if (concursos.length === 0) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <Clock size={16} style={{ color: 'var(--teal)' }} />
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Cronômetro de estudo</p>
        </div>
        <p className="text-sm py-2" style={{ color: 'var(--text-muted)' }}>Cadastre um concurso na aba <b>Concursos</b> para usar o cronômetro.</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Clock size={16} style={{ color: 'var(--teal)' }} />
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Cronômetro de estudo</p>
        {emSessao && (
          <Badge
            label={running ? 'Em andamento' : (finalizando ? 'Finalizando' : 'Pausado')}
            color={running ? 'var(--teal)' : 'var(--gold)'}
            bg={running ? 'var(--teal-soft)' : 'var(--gold-soft)'}
          />
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Concurso" required>
          <Select value={sel.concursoId} onChange={setCampo('concursoId')} disabled={emSessao}>
            {concursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        </Field>
        <Field label="Matéria">
          <Select value={sel.materiaId} onChange={setCampo('materiaId')} disabled={emSessao || !materiasFiltradas.length}>
            <option value="">Selecione...</option>
            {materiasFiltradas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Select>
        </Field>
        <Field label="Assunto">
          <Select value={sel.assuntoId} onChange={setCampo('assuntoId')} disabled={emSessao || !assuntosFiltrados.length}>
            <option value="">Geral / não especificado</option>
            {assuntosFiltrados.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Select>
        </Field>
        <Field label="Tipo de estudo">
          <Select value={sel.tipoEstudo} onChange={setCampo('tipoEstudo')} disabled={emSessao}>
            {TIPOS_ESTUDO.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 mt-2 py-3 px-4 rounded-xl" style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}>
        <div className="pe-mono leading-none" style={{ fontSize: '2.5rem', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
          {fmtCronometro(elapsedMs)}
        </div>
        <div className="flex gap-2 sm:ml-auto flex-wrap justify-center">
          {!emSessao && <Btn variant="accent" icon={Clock} onClick={iniciar}>Iniciar</Btn>}
          {running && (
            <>
              <Btn variant="ghost" onClick={pausar}>Pausar</Btn>
              <Btn variant="gold" onClick={parar}>Parar</Btn>
            </>
          )}
          {!running && emSessao && !finalizando && (
            <>
              <Btn variant="accent" onClick={retomar}>Retomar</Btn>
              <Btn variant="gold" onClick={parar}>Parar</Btn>
            </>
          )}
        </div>
      </div>

      {finalizando && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
          <p className="text-sm mb-2" style={{ color: 'var(--ink)' }}>
            Sessão de <b>{fmtCronometro(elapsedMs)}</b> — será registrada como <b>{Math.max(1, Math.round(elapsedMs / 60000))} min</b>.
          </p>
          <Field label="Observações">
            <TextArea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="O que você estudou, dificuldades, pontos de atenção..."
              autoFocus
            />
          </Field>
          {sel.assuntoId && (
            <label className="flex items-center gap-2 text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              <input type="checkbox" className="pe-check" checked={gerarRevisoes} onChange={(e) => setGerarRevisoes(e.target.checked)} />
              Gerar revisões automáticas (1, 7, 15 e 30 dias)
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Btn variant="danger" icon={Trash2} onClick={limpar}>Descartar</Btn>
            <Btn variant="accent" icon={Save} onClick={salvarSessao}>Salvar sessão</Btn>
          </div>
        </div>
      )}
    </Card>
  );
}

function RegistroForm({ state, actions, prefill, onDone }) {
  const { concursos, materias, assuntos } = state;
  const blank = {
    data: todayISO(), concursoId: concursos[0]?.id || '', materiaId: '', assuntoId: '',
    horas: '', minutos: '', tipoEstudo: TIPOS_ESTUDO[0], questoesTotal: '', acertos: '',
    banca: '', observacoes: '', dificuldade: 'medio', gerarRevisoes: true,
  };
  const [form, setForm] = useState(() => (prefill ? { ...blank, ...prefill } : blank));
  useEffect(() => { if (prefill) setForm({ ...blank, ...prefill }); }, [prefill]); // eslint-disable-line

  const materiasFiltradas = materias.filter((m) => m.concursoId === form.concursoId);
  const assuntosFiltrados = assuntos.filter((a) => a.materiaId === form.materiaId);

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === 'concursoId') { next.materiaId = ''; next.assuntoId = ''; }
      if (k === 'materiaId') { next.assuntoId = ''; }
      return next;
    });
  };

  const submit = (e) => {
    e.preventDefault();
    const tempoMinutos = (Number(form.horas) || 0) * 60 + (Number(form.minutos) || 0);
    if (!form.data || !form.concursoId || tempoMinutos <= 0) return;
    const questoesTotal = Number(form.questoesTotal) || 0;
    const acertos = Math.min(Number(form.acertos) || 0, questoesTotal);
    actions.addSessao({
      id: uid(), data: form.data, concursoId: form.concursoId, materiaId: form.materiaId || null,
      assuntoId: form.assuntoId || null, tempoMinutos, tipoEstudo: form.tipoEstudo,
      questoesTotal, acertos, banca: form.banca, observacoes: form.observacoes,
      dificuldade: form.dificuldade, gerarRevisoes: !!form.gerarRevisoes && !!form.assuntoId,
      createdAt: Date.now(),
    });
    setForm({ ...blank, concursoId: form.concursoId, materiaId: form.materiaId });
    if (onDone) onDone();
  };

  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Registrar sessão de estudo</p>
      {concursos.length === 0 ? (
        <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>Cadastre um concurso na aba <b>Concursos</b> antes de registrar estudos.</p>
      ) : (
        <form onSubmit={submit}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Data" required><TextInput type="date" value={form.data} onChange={set('data')} /></Field>
            <Field label="Concurso" required>
              <Select value={form.concursoId} onChange={set('concursoId')}>
                {concursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </Field>
            <Field label="Matéria">
              <Select value={form.materiaId} onChange={set('materiaId')} disabled={!materiasFiltradas.length}>
                <option value="">Selecione...</option>
                {materiasFiltradas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </Select>
            </Field>
            <Field label="Assunto">
              <Select value={form.assuntoId} onChange={set('assuntoId')} disabled={!assuntosFiltrados.length}>
                <option value="">Geral / não especificado</option>
                {assuntosFiltrados.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-1">
            <Field label="Tempo estudado" required>
              <div className="flex gap-1.5 items-center">
                <TextInput type="number" min="0" value={form.horas} onChange={set('horas')} placeholder="0" className="text-center" />
                <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>h</span>
                <TextInput type="number" min="0" max="59" value={form.minutos} onChange={set('minutos')} placeholder="0" className="text-center" />
                <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>min</span>
              </div>
            </Field>
            <Field label="Tipo de estudo">
              <Select value={form.tipoEstudo} onChange={set('tipoEstudo')}>
                {TIPOS_ESTUDO.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Questões feitas"><TextInput type="number" min="0" value={form.questoesTotal} onChange={set('questoesTotal')} placeholder="0" /></Field>
            <Field label="Acertos"><TextInput type="number" min="0" value={form.acertos} onChange={set('acertos')} placeholder="0" /></Field>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-1 items-end">
            <Field label="Banca (opcional)"><TextInput value={form.banca} onChange={set('banca')} placeholder="Ex: Cebraspe" /></Field>
            <Field label="Dificuldade">
              <Select value={form.dificuldade} onChange={set('dificuldade')}>
                {DIFICULDADE.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </Select>
            </Field>
            <div className="col-span-2 pb-3">
              {form.assuntoId && (
                <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <input type="checkbox" className="pe-check" checked={form.gerarRevisoes} onChange={set('gerarRevisoes')} />
                  Gerar revisões automáticas (1, 7, 15 e 30 dias)
                </label>
              )}
            </div>
          </div>

          <Field label="Observações">
            <TextArea rows={2} value={form.observacoes} onChange={set('observacoes')} placeholder="O que você estudou, dificuldades, pontos de atenção..." />
          </Field>

          <div className="flex justify-end">
            <Btn type="submit" variant="accent" icon={Save}>Registrar estudo</Btn>
          </div>
        </form>
      )}
    </Card>
  );
}

function RegistroHistorico({ state, derived, actions }) {
  const { sessoes, concursos } = state;
  const { materiaMap, assuntoMap } = derived;
  const [filtroConcurso, setFiltroConcurso] = useState('');
  const [busca, setBusca] = useState('');

  const linhas = useMemo(() => {
    return sessoes
      .filter((s) => !filtroConcurso || s.concursoId === filtroConcurso)
      .filter((s) => {
        if (!busca) return true;
        const texto = `${materiaMap[s.materiaId]?.nome || ''} ${assuntoMap[s.assuntoId]?.nome || ''} ${s.observacoes || ''}`.toLowerCase();
        return texto.includes(busca.toLowerCase());
      })
      .sort((a, b) => (b.data + String(b.createdAt)).localeCompare(a.data + String(a.createdAt)));
  }, [sessoes, filtroConcurso, busca, materiaMap, assuntoMap]);

  return (
    <Card padded={false} className="mt-4">
      <div className="flex flex-wrap items-center gap-2 p-4 border-b" style={{ borderColor: 'var(--line)' }}>
        <p className="text-xs font-semibold uppercase tracking-wide mr-auto" style={{ color: 'var(--text-muted)' }}>Histórico de estudos ({linhas.length})</p>
        <Select value={filtroConcurso} onChange={(e) => setFiltroConcurso(e.target.value)} style={{ width: 'auto' }} className="text-xs py-1.5">
          <option value="">Todos os concursos</option>
          {concursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Select>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
          <TextInput value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." style={{ width: 'auto' }} className="pl-7 text-xs py-1.5" />
        </div>
      </div>

      {linhas.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nenhum registro encontrado" description="Registre sua primeira sessão de estudo usando o formulário acima." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                <th className="font-semibold text-[11px] uppercase tracking-wide px-4 py-2">Data</th>
                <th className="font-semibold text-[11px] uppercase tracking-wide px-4 py-2">Matéria / Assunto</th>
                <th className="font-semibold text-[11px] uppercase tracking-wide px-4 py-2">Tipo</th>
                <th className="font-semibold text-[11px] uppercase tracking-wide px-4 py-2">Tempo</th>
                <th className="font-semibold text-[11px] uppercase tracking-wide px-4 py-2">Questões</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((s) => {
                const acertoPct = s.questoesTotal ? pct(s.acertos, s.questoesTotal) : null;
                return (
                  <tr key={s.id} className="pe-row border-t" style={{ borderColor: 'var(--line)' }}>
                    <td className="px-4 py-2.5 pe-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{formatDateBR(s.data)}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium" style={{ color: 'var(--ink)' }}>{materiaMap[s.materiaId]?.nome || '—'}</p>
                      {assuntoMap[s.assuntoId] && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{assuntoMap[s.assuntoId].nome}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap">{s.tipoEstudo}</td>
                    <td className="px-4 py-2.5 pe-mono text-xs whitespace-nowrap">{formatMin(s.tempoMinutos)}</td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                      {s.questoesTotal ? (
                        <>{s.acertos}/{s.questoesTotal} <span style={{ color: acertoPct >= 70 ? 'var(--teal)' : acertoPct >= 50 ? 'var(--gold)' : 'var(--brick)' }}>({acertoPct}%)</span></>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right"><ConfirmButton onConfirm={() => actions.deleteSessao(s.id)} label="Excluir registro" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function RegistroView({ state, derived, actions, prefill, clearPrefill }) {
  return (
    <div>
      <SectionHeader title="Registro de estudos" subtitle="Use o cronômetro para estudar agora, ou registre manualmente uma sessão. Cada sessão pode gerar automaticamente as revisões futuras." />
      <div className="mb-4"><CronometroCard state={state} actions={actions} /></div>
      <RegistroForm state={state} actions={actions} prefill={prefill} onDone={clearPrefill} />
      <RegistroHistorico state={state} derived={derived} actions={actions} />
    </div>
  );
}

/* ============================================================================
   REVISÕES
============================================================================ */
function RevisoesView({ state, derived, actions, goToRegistroComPrefill }) {
  const { hojeISO, revisoesTodas, revisoesPendentes } = derived;
  const [filtroConcurso, setFiltroConcurso] = useState('');
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false);

  const base = mostrarConcluidas ? revisoesTodas : revisoesPendentes;
  const filtradas = useMemo(
    () => base.filter((r) => !filtroConcurso || r.concursoId === filtroConcurso).sort((a, b) => a.dataRevisao.localeCompare(b.dataRevisao)),
    [base, filtroConcurso]
  );

  const grupos = useMemo(() => {
    const atrasadas = [], hoje = [], semana = [], futuras = [], concluidas = [];
    filtradas.forEach((r) => {
      if (r.concluida) { concluidas.push(r); return; }
      if (r.dataRevisao < hojeISO) atrasadas.push(r);
      else if (r.dataRevisao === hojeISO) hoje.push(r);
      else if (diffDaysFromToday(r.dataRevisao) <= 7) semana.push(r);
      else futuras.push(r);
    });
    return { atrasadas, hoje, semana, futuras, concluidas };
  }, [filtradas, hojeISO]);

  const Grupo = ({ titulo, itens, tone }) => {
    if (itens.length === 0) return null;
    return (
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: tone || 'var(--text-muted)' }}>{titulo}</p>
          <span className="pe-mono text-[10px] rounded-full px-1.5" style={{ background: 'var(--paper)', color: 'var(--text-muted)' }}>{itens.length}</span>
        </div>
        <div className="space-y-2">
          {itens.map((r) => (
            <Card key={r.id} padded={false} className="flex items-center gap-3 p-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{r.assuntoNome}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{r.materiaNome} · {r.concursoNome} · {r.numero}ª revisão · {formatDateBR(r.dataRevisao)}</p>
              </div>
              {!r.concluida ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Btn size="sm" variant="ghost" icon={ClipboardList} onClick={() => goToRegistroComPrefill(r)}>Estudar</Btn>
                  <Btn size="sm" variant="accent" icon={CheckCircle2} onClick={() => actions.toggleRevisao(r.id)}>Concluir</Btn>
                </div>
              ) : (
                <Badge label="Concluída" color="var(--teal)" bg="var(--teal-soft)" icon={CheckCircle2} />
              )}
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <SectionHeader
        title="Revisões"
        subtitle="Geradas automaticamente a partir dos registros de estudo, seguindo a curva de esquecimento (1, 7, 15 e 30 dias)."
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select value={filtroConcurso} onChange={(e) => setFiltroConcurso(e.target.value)} style={{ width: 'auto' }} className="text-xs py-1.5">
          <option value="">Todos os concursos</option>
          {state.concursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Select>
        <label className="flex items-center gap-1.5 text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
          <input type="checkbox" className="pe-check" checked={mostrarConcluidas} onChange={(e) => setMostrarConcluidas(e.target.checked)} />
          Mostrar concluídas
        </label>
      </div>

      {filtradas.length === 0 ? (
        <Card><EmptyState icon={RotateCcw} title="Nenhuma revisão pendente" description="Registre estudos vinculados a um assunto na aba Registro de estudos para gerar revisões automáticas." /></Card>
      ) : (
        <>
          <Grupo titulo="Atrasadas" itens={grupos.atrasadas} tone="var(--brick)" />
          <Grupo titulo="Hoje" itens={grupos.hoje} tone="var(--gold)" />
          <Grupo titulo="Próximos 7 dias" itens={grupos.semana} tone="var(--blue)" />
          <Grupo titulo="Futuras" itens={grupos.futuras} />
          {mostrarConcluidas && <Grupo titulo="Concluídas" itens={grupos.concluidas} tone="var(--teal)" />}
        </>
      )}
    </div>
  );
}

/* ============================================================================
   QUESTÕES
============================================================================ */
function QuestoesQuickAddModal({ open, onClose, onSave, state }) {
  const { concursos, materias, assuntos } = state;
  const blank = { data: todayISO(), concursoId: concursos[0]?.id || '', materiaId: '', assuntoId: '', banca: '', questoesTotal: '', acertos: '' };
  const [form, setForm] = useState(blank);
  useEffect(() => { if (open) setForm({ ...blank, concursoId: concursos[0]?.id || '' }); }, [open]); // eslint-disable-line

  const materiasFiltradas = materias.filter((m) => m.concursoId === form.concursoId);
  const assuntosFiltrados = assuntos.filter((a) => a.materiaId === form.materiaId);
  const set = (k) => (e) => setForm((f) => {
    const n = { ...f, [k]: e.target.value };
    if (k === 'concursoId') { n.materiaId = ''; n.assuntoId = ''; }
    if (k === 'materiaId') { n.assuntoId = ''; }
    return n;
  });

  const submit = (e) => {
    e.preventDefault();
    const questoesTotal = Number(form.questoesTotal) || 0;
    if (!form.concursoId || questoesTotal <= 0) return;
    const acertos = Math.min(Number(form.acertos) || 0, questoesTotal);
    onSave({
      id: uid(), data: form.data, concursoId: form.concursoId, materiaId: form.materiaId || null,
      assuntoId: form.assuntoId || null, tempoMinutos: 0, tipoEstudo: 'Questões',
      questoesTotal, acertos, banca: form.banca, observacoes: '', dificuldade: 'medio',
      gerarRevisoes: false, createdAt: Date.now(),
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Registrar questões avulsas">
      <form onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data" required><TextInput type="date" value={form.data} onChange={set('data')} /></Field>
          <Field label="Concurso" required>
            <Select value={form.concursoId} onChange={set('concursoId')}>
              {concursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          </Field>
          <Field label="Matéria">
            <Select value={form.materiaId} onChange={set('materiaId')} disabled={!materiasFiltradas.length}>
              <option value="">Selecione...</option>
              {materiasFiltradas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </Select>
          </Field>
          <Field label="Assunto">
            <Select value={form.assuntoId} onChange={set('assuntoId')} disabled={!assuntosFiltrados.length}>
              <option value="">Geral</option>
              {assuntosFiltrados.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </Select>
          </Field>
          <Field label="Banca"><TextInput value={form.banca} onChange={set('banca')} placeholder="Ex: FCC" /></Field>
          <div />
          <Field label="Total de questões" required><TextInput type="number" min="1" value={form.questoesTotal} onChange={set('questoesTotal')} /></Field>
          <Field label="Acertos" required><TextInput type="number" min="0" value={form.acertos} onChange={set('acertos')} /></Field>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Btn variant="ghost" type="button" onClick={onClose}>Cancelar</Btn>
          <Btn variant="accent" type="submit" icon={Save}>Salvar</Btn>
        </div>
      </form>
    </Modal>
  );
}

function QuestoesView({ state, derived, actions }) {
  const { sessoes, concursos } = state;
  const { materiaMap, assuntoMap } = derived;
  const [modalOpen, setModalOpen] = useState(false);
  const [filtroConcurso, setFiltroConcurso] = useState('');
  const [filtroBanca, setFiltroBanca] = useState('');
  const [materiaAberta, setMateriaAberta] = useState(null);

  const comQuestoes = sessoes.filter((s) => s.questoesTotal > 0);
  const bancas = useMemo(() => Array.from(new Set(comQuestoes.map((s) => s.banca).filter(Boolean))).sort(), [comQuestoes]);

  const filtradas = comQuestoes
    .filter((s) => !filtroConcurso || s.concursoId === filtroConcurso)
    .filter((s) => !filtroBanca || s.banca === filtroBanca);

  const totalGeral = sum(filtradas.map((s) => s.questoesTotal));
  const acertosGeral = sum(filtradas.map((s) => s.acertos));

  const porMateria = useMemo(() => {
    const map = {};
    filtradas.forEach((s) => {
      const key = s.materiaId || '__geral__';
      if (!map[key]) map[key] = { materiaId: s.materiaId, nome: s.materiaId ? (materiaMap[s.materiaId]?.nome || 'Matéria removida') : 'Sem matéria', total: 0, acertos: 0 };
      map[key].total += s.questoesTotal;
      map[key].acertos += s.acertos;
    });
    return Object.values(map).map((m) => ({ ...m, taxa: pct(m.acertos, m.total) })).sort((a, b) => b.total - a.total);
  }, [filtradas, materiaMap]);

  const porAssunto = useMemo(() => {
    if (!materiaAberta) return [];
    const map = {};
    filtradas.filter((s) => s.materiaId === materiaAberta).forEach((s) => {
      const key = s.assuntoId || '__geral__';
      if (!map[key]) map[key] = { assuntoId: s.assuntoId, nome: s.assuntoId ? (assuntoMap[s.assuntoId]?.nome || 'Assunto removido') : 'Sem assunto específico', total: 0, acertos: 0 };
      map[key].total += s.questoesTotal;
      map[key].acertos += s.acertos;
    });
    return Object.values(map).map((m) => ({ ...m, taxa: pct(m.acertos, m.total) })).sort((a, b) => b.total - a.total);
  }, [filtradas, materiaAberta, assuntoMap]);

  return (
    <div>
      <SectionHeader
        title="Questões"
        subtitle="Desempenho consolidado por matéria e assunto, a partir dos registros de estudo."
        action={<Btn icon={Plus} variant="accent" onClick={() => setModalOpen(true)}>Registrar questões avulsas</Btn>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
        <StatCard icon={ListChecks} label="Total de questões" value={totalGeral} accent="teal" />
        <StatCard icon={CheckCircle2} label="Acertos" value={acertosGeral} accent="blue" />
        <StatCard icon={Percent} label="Taxa de acerto" value={`${pct(acertosGeral, totalGeral)}%`} accent="gold" />
        <StatCard icon={Layers} label="Matérias com questões" value={porMateria.length} accent="plum" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Select value={filtroConcurso} onChange={(e) => setFiltroConcurso(e.target.value)} style={{ width: 'auto' }} className="text-xs py-1.5">
          <option value="">Todos os concursos</option>
          {concursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Select>
        {bancas.length > 0 && (
          <Select value={filtroBanca} onChange={(e) => setFiltroBanca(e.target.value)} style={{ width: 'auto' }} className="text-xs py-1.5">
            <option value="">Todas as bancas</option>
            {bancas.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
        )}
      </div>

      {porMateria.length === 0 ? (
        <Card><EmptyState icon={ListChecks} title="Nenhuma questão registrada" description="Registre questões junto às sessões de estudo ou use questões avulsas." actionLabel="Registrar questões avulsas" onAction={() => setModalOpen(true)} /></Card>
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: 'var(--text-muted)' }}>
                  <th className="font-semibold text-[11px] uppercase tracking-wide px-4 py-2.5">Matéria</th>
                  <th className="font-semibold text-[11px] uppercase tracking-wide px-4 py-2.5">Questões</th>
                  <th className="font-semibold text-[11px] uppercase tracking-wide px-4 py-2.5">Acertos</th>
                  <th className="font-semibold text-[11px] uppercase tracking-wide px-4 py-2.5">Erros</th>
                  <th className="font-semibold text-[11px] uppercase tracking-wide px-4 py-2.5">Aproveitamento</th>
                </tr>
              </thead>
              <tbody>
                {porMateria.map((m) => (
                  <React.Fragment key={m.materiaId || '__geral__'}>
                    <tr
                      className="pe-row border-t cursor-pointer"
                      style={{ borderColor: 'var(--line)' }}
                      onClick={() => setMateriaAberta(materiaAberta === m.materiaId ? null : m.materiaId)}
                    >
                      <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--ink)' }}>
                        <span className="inline-flex items-center gap-1.5">
                          {m.materiaId && (materiaAberta === m.materiaId ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                          {m.nome}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">{m.total}</td>
                      <td className="px-4 py-2.5">{m.acertos}</td>
                      <td className="px-4 py-2.5">{m.total - m.acertos}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div style={{ width: 60 }}><ProgressBar value={m.taxa} color={m.taxa >= 70 ? 'var(--teal)' : m.taxa >= 50 ? 'var(--gold)' : 'var(--brick)'} /></div>
                          <span className="pe-mono text-xs">{m.taxa}%</span>
                        </div>
                      </td>
                    </tr>
                    {materiaAberta === m.materiaId && porAssunto.map((a) => (
                      <tr key={a.assuntoId || '__geral__'} className="border-t" style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}>
                        <td className="px-4 py-2 pl-9 text-xs" style={{ color: 'var(--text-muted)' }}>{a.nome}</td>
                        <td className="px-4 py-2 text-xs">{a.total}</td>
                        <td className="px-4 py-2 text-xs">{a.acertos}</td>
                        <td className="px-4 py-2 text-xs">{a.total - a.acertos}</td>
                        <td className="px-4 py-2 text-xs pe-mono">{a.taxa}%</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <QuestoesQuickAddModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={actions.addSessao} state={state} />
    </div>
  );
}

/* ============================================================================
   RELATÓRIOS
============================================================================ */
const chartTooltipStyle = { background: 'var(--ink)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 12, padding: '8px 12px' };
const chartAxisStyle = { fontSize: 11, fill: 'var(--text-muted)' };

function ChartCard({ title, subtitle, children, empty, emptyMsg }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{title}</p>
      <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--text-muted)' }}>{subtitle || '\u00A0'}</p>
      {empty ? (
        <p className="text-sm text-center py-10" style={{ color: 'var(--text-muted)' }}>{emptyMsg || 'Sem dados suficientes ainda.'}</p>
      ) : children}
    </Card>
  );
}

function RelatoriosView({ derived }) {
  const { last14, horasPorMateria, assuntosMaisFracos, evolucaoAcerto, metaSemanas, progressoPorConcurso } = derived;
  const dadosDias = last14.map((d) => ({ dia: shortDate(d.iso), horas: +(d.min / 60).toFixed(2), min: d.min }));

  return (
    <div>
      <SectionHeader title="Relatórios" subtitle="Sua evolução: horas de estudo, aproveitamento em questões e progresso nos editais." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Horas estudadas" subtitle="Últimos 14 dias" empty={dadosDias.every((d) => d.min === 0)}>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={dadosDias} margin={{ left: -20 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="dia" tick={chartAxisStyle} axisLine={{ stroke: 'var(--line)' }} tickLine={false} />
                <YAxis tick={chartAxisStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v, n, p) => [formatMin(p.payload.min), 'Estudado']} cursor={{ fill: 'var(--paper)' }} />
                <Bar dataKey="horas" radius={[4, 4, 0, 0]} fill="var(--teal)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Meta vs. realizado" subtitle="Últimas semanas, em horas" empty={metaSemanas.length === 0}>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={metaSemanas} margin={{ left: -20 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" tick={chartAxisStyle} axisLine={{ stroke: 'var(--line)' }} tickLine={false} />
                <YAxis tick={chartAxisStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => `${v}h`} cursor={{ fill: 'var(--paper)' }} />
                <Bar dataKey="meta" fill="var(--line)" radius={[4, 4, 0, 0]} name="Meta" />
                <Bar dataKey="realizado" fill="var(--gold)" radius={[4, 4, 0, 0]} name="Realizado" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Horas por matéria" subtitle="Total acumulado" empty={horasPorMateria.length === 0}>
          <div style={{ width: '100%', height: Math.max(180, horasPorMateria.length * 34) }}>
            <ResponsiveContainer>
              <BarChart data={horasPorMateria} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid stroke="var(--line)" horizontal={false} />
                <XAxis type="number" tick={chartAxisStyle} axisLine={{ stroke: 'var(--line)' }} tickLine={false} />
                <YAxis type="category" dataKey="nome" width={110} tick={chartAxisStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v, n, p) => [formatMin(p.payload.min), 'Tempo']} cursor={{ fill: 'var(--paper)' }} />
                <Bar dataKey="horas" radius={[0, 4, 4, 0]} fill="var(--blue)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Assuntos mais fracos" subtitle="Menor aproveitamento (mín. 5 questões)" empty={assuntosMaisFracos.length === 0}>
          <div style={{ width: '100%', height: Math.max(180, assuntosMaisFracos.length * 34) }}>
            <ResponsiveContainer>
              <BarChart data={assuntosMaisFracos} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid stroke="var(--line)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={chartAxisStyle} axisLine={{ stroke: 'var(--line)' }} tickLine={false} unit="%" />
                <YAxis type="category" dataKey="nome" width={110} tick={chartAxisStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v, n, p) => [`${v}% (${p.payload.acertos}/${p.payload.total})`, 'Aproveitamento']} cursor={{ fill: 'var(--paper)' }} />
                <Bar dataKey="taxa" radius={[0, 4, 4, 0]} fill="var(--brick)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Evolução da taxa de acerto" subtitle="Últimas sessões com questões, em ordem cronológica" empty={evolucaoAcerto.length === 0}>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={evolucaoAcerto} margin={{ left: -20 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" tick={chartAxisStyle} axisLine={{ stroke: 'var(--line)' }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={chartAxisStyle} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [`${v}%`, 'Acerto']} cursor={{ stroke: 'var(--line)' }} />
                <Line type="monotone" dataKey="taxa" stroke="var(--gold)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--gold)' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Progresso do edital" subtitle="Por concurso" empty={progressoPorConcurso.length === 0}>
          <div className="space-y-4 py-1">
            {progressoPorConcurso.map((p, i) => (
              <div key={p.id}>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{p.nome}</span>
                  <span className="pe-mono text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{p.dominados}/{p.totalAssuntos} · {p.progresso}%</span>
                </div>
                <ProgressBar value={p.progresso} color={`var(--${ACCENTS[i % ACCENTS.length]})`} height={10} />
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

/* ============================================================================
   SIMULADOS
============================================================================ */
function SimuladoFormModal({ open, onClose, onSave, initial, concursos }) {
  const blank = { nome: '', data: todayISO(), concursoId: concursos[0]?.id || '', totalQuestoes: '', acertos: '', nota: '', tempoGastoHoras: '', tempoGastoMin: '', pontosFracos: '' };
  const [form, setForm] = useState(blank);
  useEffect(() => {
    if (initial) {
      setForm({
        ...blank, ...initial,
        tempoGastoHoras: initial.tempoGastoMinutos ? Math.floor(initial.tempoGastoMinutos / 60) : '',
        tempoGastoMin: initial.tempoGastoMinutos ? initial.tempoGastoMinutos % 60 : '',
        nota: initial.nota ?? '',
      });
    } else {
      setForm({ ...blank, concursoId: concursos[0]?.id || '' });
    }
  }, [initial, open]); // eslint-disable-line

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const totalQuestoes = Number(form.totalQuestoes) || 0;
    if (!form.nome.trim() || !form.concursoId || totalQuestoes <= 0) return;
    const acertos = Math.min(Number(form.acertos) || 0, totalQuestoes);
    const tempoGastoMinutos = (Number(form.tempoGastoHoras) || 0) * 60 + (Number(form.tempoGastoMin) || 0);
    onSave({
      id: initial?.id || uid(), nome: form.nome.trim(), data: form.data, concursoId: form.concursoId,
      totalQuestoes, acertos, nota: form.nota === '' ? null : Number(form.nota),
      tempoGastoMinutos, pontosFracos: form.pontosFracos, createdAt: initial?.createdAt || Date.now(),
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar simulado' : 'Novo simulado'} wide>
      <form onSubmit={submit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Nome do simulado" required>
            <TextInput value={form.nome} onChange={set('nome')} placeholder="Ex: Simulado TEC Concursos #4" autoFocus />
          </Field>
          <Field label="Concurso" required>
            <Select value={form.concursoId} onChange={set('concursoId')}>
              {concursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Data" required><TextInput type="date" value={form.data} onChange={set('data')} /></Field>
          <Field label="Total de questões" required><TextInput type="number" min="1" value={form.totalQuestoes} onChange={set('totalQuestoes')} /></Field>
          <Field label="Acertos" required><TextInput type="number" min="0" value={form.acertos} onChange={set('acertos')} /></Field>
          <Field label="Nota (opcional)"><TextInput type="number" step="0.01" value={form.nota} onChange={set('nota')} placeholder="Ex: 72.5" /></Field>
        </div>
        <Field label="Tempo gasto">
          <div className="flex gap-1.5 items-center">
            <TextInput type="number" min="0" value={form.tempoGastoHoras} onChange={set('tempoGastoHoras')} placeholder="0" className="text-center" />
            <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>h</span>
            <TextInput type="number" min="0" max="59" value={form.tempoGastoMin} onChange={set('tempoGastoMin')} placeholder="0" className="text-center" />
            <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>min</span>
          </div>
        </Field>
        <Field label="Pontos fracos identificados">
          <TextArea rows={2} value={form.pontosFracos} onChange={set('pontosFracos')} placeholder="Ex: Controle de constitucionalidade, prazos processuais..." />
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Btn variant="ghost" type="button" onClick={onClose}>Cancelar</Btn>
          <Btn variant="accent" type="submit" icon={Save}>Salvar</Btn>
        </div>
      </form>
    </Modal>
  );
}

function SimuladosView({ state, actions }) {
  const { simulados, concursos } = state;
  const [modal, setModal] = useState({ open: false, editing: null });
  const [filtroConcurso, setFiltroConcurso] = useState('');

  const lista = simulados.filter((s) => !filtroConcurso || s.concursoId === filtroConcurso).sort((a, b) => b.data.localeCompare(a.data));
  const concursoMap = Object.fromEntries(concursos.map((c) => [c.id, c]));
  const mediaGeral = lista.length ? Math.round(sum(lista.map((s) => pct(s.acertos, s.totalQuestoes))) / lista.length) : 0;

  return (
    <div>
      <SectionHeader
        title="Simulados"
        subtitle="Registre seus simulados e acompanhe a evolução da nota."
        action={<Btn icon={Plus} variant="accent" onClick={() => setModal({ open: true, editing: null })} disabled={concursos.length === 0}>Novo simulado</Btn>}
      />

      {concursos.length === 0 ? (
        <Card><EmptyState icon={Trophy} title="Cadastre um concurso primeiro" description="Os simulados ficam vinculados a um concurso." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
            <StatCard icon={Trophy} label="Simulados feitos" value={lista.length} accent="gold" />
            <StatCard icon={Percent} label="Aproveitamento médio" value={`${mediaGeral}%`} accent="teal" />
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Select value={filtroConcurso} onChange={(e) => setFiltroConcurso(e.target.value)} style={{ width: 'auto' }} className="text-xs py-1.5">
              <option value="">Todos os concursos</option>
              {concursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          </div>

          {lista.length === 0 ? (
            <Card><EmptyState icon={Trophy} title="Nenhum simulado registrado" description="Registre seu primeiro simulado para acompanhar a evolução." actionLabel="Novo simulado" onAction={() => setModal({ open: true, editing: null })} /></Card>
          ) : (
            <div className="space-y-3">
              {lista.map((s) => {
                const taxa = pct(s.acertos, s.totalQuestoes);
                return (
                  <Card key={s.id}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="pe-serif text-lg" style={{ color: 'var(--ink)' }}>{s.nome}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {concursoMap[s.concursoId]?.nome || '—'} · {formatDateBR(s.data)}{s.tempoGastoMinutos ? ` · ${formatMin(s.tempoGastoMinutos)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className="pe-serif text-2xl" style={{ color: taxa >= 70 ? 'var(--teal)' : taxa >= 50 ? 'var(--gold)' : 'var(--brick)' }}>{taxa}%</p>
                          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{s.acertos}/{s.totalQuestoes} questões</p>
                        </div>
                        {s.nota !== null && s.nota !== undefined && s.nota !== '' && (
                          <div className="text-right pl-4 border-l" style={{ borderColor: 'var(--line)' }}>
                            <p className="pe-serif text-2xl" style={{ color: 'var(--ink)' }}>{s.nota}</p>
                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>nota</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {s.pontosFracos && (
                      <p className="text-xs mt-2 pt-2 border-t" style={{ color: 'var(--text-muted)', borderColor: 'var(--line)' }}>
                        <b style={{ color: 'var(--text)' }}>Pontos fracos:</b> {s.pontosFracos}
                      </p>
                    )}
                    <div className="flex items-center justify-end gap-1 mt-2">
                      <button onClick={() => setModal({ open: true, editing: s })} className="pe-btn p-1.5 rounded-md" style={{ color: 'var(--text-muted)' }} aria-label="Editar">
                        <Pencil size={15} />
                      </button>
                      <ConfirmButton onConfirm={() => actions.deleteSimulado(s.id)} label="Excluir simulado" />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <SimuladoFormModal open={modal.open} onClose={() => setModal({ open: false, editing: null })} onSave={actions.saveSimulado} initial={modal.editing} concursos={concursos} />
    </div>
  );
}

/* ============================================================================
   APP PRINCIPAL
============================================================================ */
function LoginScreen() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) { setStatus('error'); setErrorMsg(error.message); }
    else setStatus('sent');
  };

  return (
    <div className="pe-root flex items-center justify-center px-4" style={{ minHeight: '100vh' }}>
      <GlobalStyles />
      <div className="w-full" style={{ maxWidth: 380 }}>
        <div className="flex flex-col items-center mb-6">
          <Selo size={48} />
          <p className="pe-serif text-2xl mt-3" style={{ color: 'var(--ink)' }}>Painel de Estudos</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Central de concursos</p>
        </div>
        <Card>
          {status === 'sent' ? (
            <div className="text-center py-2">
              <Mail size={28} style={{ color: 'var(--teal)', margin: '0 auto' }} />
              <p className="text-sm font-semibold mt-3" style={{ color: 'var(--ink)' }}>Verifique seu e-mail</p>
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                Enviamos um link de acesso para <b>{email}</b>. Clique nele para entrar — não precisa de senha.
              </p>
              <button onClick={() => setStatus('idle')} className="pe-btn text-xs font-semibold mt-4" style={{ color: 'var(--teal)' }}>
                Usar outro e-mail
              </button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>Entrar</p>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                Digite seu e-mail e enviaremos um link de acesso — sem senha para lembrar.
              </p>
              <Field label="E-mail">
                <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" autoFocus required />
              </Field>
              {status === 'error' && (
                <p className="text-xs mb-2" style={{ color: 'var(--brick)' }}>{errorMsg || 'Não foi possível enviar o link. Tente novamente.'}</p>
              )}
              <Btn variant="accent" type="submit" className="w-full justify-center" disabled={status === 'sending'}>
                {status === 'sending' ? 'Enviando...' : 'Enviar link de acesso'}
              </Btn>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

function AuthLoadingScreen() {
  return (
    <div className="pe-root flex items-center justify-center" style={{ minHeight: '100vh' }}>
      <GlobalStyles />
      <div className="text-center">
        <Selo size={48} />
        <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>Verificando sua sessão...</p>
      </div>
    </div>
  );
}

function PainelEstudos({ userId, userEmail, onSignOut }) {
  const [data, setData] = useState(emptyState());
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [view, setView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prefillRegistro, setPrefillRegistro] = useState(null);
  const [importOffer, setImportOffer] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    (async () => {
      try {
        const { data: row, error } = await supabase
          .from('painel_dados')
          .select('dados')
          .eq('user_id', userId)
          .maybeSingle();
        if (!active) return;
        if (error) throw error;
        if (row && row.dados) {
          setData((d) => ({ ...d, ...row.dados }));
        } else {
          // ainda não existe nada na nuvem para esta conta — verifica se há dados
          // de uma versão anterior (salva só neste navegador) para oferecer importar
          try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) setImportOffer(JSON.parse(raw));
          } catch (err) {
            // ignora dado local corrompido
          }
        }
      } catch (err) {
        // IMPORTANTE: se não conseguimos confirmar os dados reais da nuvem, nunca
        // devemos deixar o efeito de salvar rodar sobre o estado vazio — isso
        // apagaria os dados reais do usuário na próxima edição. loadFailed bloqueia
        // completamente a tela normal (e, por consequência, o salvamento) até uma
        // nova tentativa de carregamento ter sucesso.
        if (active) setLoadFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [userId, reloadTick]);

  useEffect(() => {
    if (loading || loadFailed) return; // nunca salva sem ter confirmado o estado real primeiro
    const t = setTimeout(() => {
      supabase
        .from('painel_dados')
        .upsert({ user_id: userId, dados: data, updated_at: new Date().toISOString() })
        .then(({ error }) => setSaveError(!!error))
        .catch(() => setSaveError(true));
    }, 500);
    return () => clearTimeout(t);
  }, [data, loading, loadFailed, userId]);

  const acceptImport = () => { setData((d) => ({ ...d, ...importOffer })); setImportOffer(null); };
  const dismissImport = () => setImportOffer(null);



  const goTo = (v) => setView(v);
  const goToRegistroComPrefill = (prefill) => {
    setPrefillRegistro({
      concursoId: prefill.concursoId, materiaId: prefill.materiaId, assuntoId: prefill.assuntoId || '',
      tipoEstudo: prefill.tipoEstudo || 'Revisão', data: todayISO(),
    });
    setView('registro');
  };
  const clearPrefill = () => setPrefillRegistro(null);

  const upsert = (key) => (item) => {
    setData((d) => {
      const arr = d[key];
      const exists = arr.some((x) => x.id === item.id);
      return { ...d, [key]: exists ? arr.map((x) => (x.id === item.id ? item : x)) : [...arr, item] };
    });
  };
  const removeBy = (key, pred) => setData((d) => ({ ...d, [key]: d[key].filter((x) => !pred(x)) }));

  const actions = {
    saveConcurso: upsert('concursos'),
    deleteConcurso: (id) => {
      setData((d) => {
        const materiaIds = d.materias.filter((m) => m.concursoId === id).map((m) => m.id);
        return {
          ...d,
          concursos: d.concursos.filter((c) => c.id !== id),
          materias: d.materias.filter((m) => m.concursoId !== id),
          assuntos: d.assuntos.filter((a) => !materiaIds.includes(a.materiaId)),
          sessoes: d.sessoes.filter((s) => s.concursoId !== id),
          revisoes: d.revisoes.filter((r) => r.concursoId !== id),
          simulados: d.simulados.filter((s) => s.concursoId !== id),
          cronograma: d.cronograma.filter((b) => b.concursoId !== id),
        };
      });
    },
    saveMateria: upsert('materias'),
    deleteMateria: (id) => {
      setData((d) => {
        const assuntoIds = d.assuntos.filter((a) => a.materiaId === id).map((a) => a.id);
        return {
          ...d,
          materias: d.materias.filter((m) => m.id !== id),
          assuntos: d.assuntos.filter((a) => a.materiaId !== id),
          revisoes: d.revisoes.filter((r) => !assuntoIds.includes(r.assuntoId)),
        };
      });
    },
    saveAssunto: upsert('assuntos'),
    // Cria vários assuntos de uma vez (e, opcionalmente, também a matéria).
    // Ignora nomes repetidos, comparando sem diferenciar maiúsculas/minúsculas.
    cadastrarAssuntosEmMassa: ({ materiaId, novaMateria, nomesAssuntos }) => {
      setData((d) => {
        let materias = d.materias;
        let alvoId = materiaId;
        if (novaMateria) { alvoId = novaMateria.id; materias = [...materias, novaMateria]; }
        const existentes = new Set(
          d.assuntos.filter((a) => a.materiaId === alvoId).map((a) => (a.nome || '').trim().toLowerCase())
        );
        const novos = [];
        (nomesAssuntos || []).forEach((nome) => {
          const limpo = (nome || '').trim();
          const chave = limpo.toLowerCase();
          if (!limpo || existentes.has(chave)) return;
          existentes.add(chave);
          novos.push({ id: uid(), materiaId: alvoId, nome: limpo, status: 'nao_iniciado', createdAt: Date.now() });
        });
        return { ...d, materias, assuntos: [...d.assuntos, ...novos] };
      });
    },
    deleteAssunto: (id) => {
      setData((d) => ({ ...d, assuntos: d.assuntos.filter((a) => a.id !== id), revisoes: d.revisoes.filter((r) => r.assuntoId !== id) }));
    },
    saveCronogramaBloco: upsert('cronograma'),
    deleteCronogramaBloco: (id) => removeBy('cronograma', (b) => b.id === id),
    addSessao: (sessao) => {
      setData((d) => {
        let revisoes = d.revisoes;
        if (sessao.gerarRevisoes && sessao.assuntoId) {
          const assunto = d.assuntos.find((a) => a.id === sessao.assuntoId);
          const novas = [1, 7, 15, 30].map((dias, idx) => ({
            id: uid(), assuntoId: sessao.assuntoId, materiaId: assunto?.materiaId || null, concursoId: sessao.concursoId,
            sessaoOrigemId: sessao.id, dataOrigem: sessao.data, dataRevisao: addDaysISO(sessao.data, dias),
            numero: idx + 1, concluida: false, createdAt: Date.now(),
          }));
          revisoes = [...revisoes, ...novas];
        }
        return { ...d, sessoes: [...d.sessoes, sessao], revisoes };
      });
    },
    deleteSessao: (id) => {
      setData((d) => ({ ...d, sessoes: d.sessoes.filter((s) => s.id !== id), revisoes: d.revisoes.filter((r) => r.sessaoOrigemId !== id) }));
    },
    toggleRevisao: (id) => {
      setData((d) => ({ ...d, revisoes: d.revisoes.map((r) => (r.id === id ? { ...r, concluida: !r.concluida } : r)) }));
    },
    saveSimulado: upsert('simulados'),
    deleteSimulado: (id) => removeBy('simulados', (s) => s.id === id),
    setMetaSemanalHoras: (horas) => setData((d) => ({ ...d, metaSemanalHoras: horas })),
  };

  const derived = useMemo(() => {
    const { concursos, materias, assuntos, sessoes, revisoes, metaSemanalHoras } = data;
    const concursoMap = Object.fromEntries(concursos.map((c) => [c.id, c]));
    const materiaMap = Object.fromEntries(materias.map((m) => [m.id, m]));
    const assuntoMap = Object.fromEntries(assuntos.map((a) => [a.id, a]));

    const hojeISO = todayISO();
    const semana = getWeekRange(hojeISO);
    const minHoje = sum(sessoes.filter((s) => s.data === hojeISO).map((s) => s.tempoMinutos));
    const minSemana = sum(sessoes.filter((s) => s.data >= semana.startISO && s.data <= semana.endISO).map((s) => s.tempoMinutos));
    const metaMin = (metaSemanalHoras || 0) * 60;

    const questoesTotais = sum(sessoes.map((s) => s.questoesTotal || 0));
    const acertosTotais = sum(sessoes.map((s) => s.acertos || 0));
    const taxaAcerto = pct(acertosTotais, questoesTotais);

    const revisoesTodas = revisoes.map((r) => ({
      ...r,
      assuntoNome: assuntoMap[r.assuntoId]?.nome || 'Assunto removido',
      materiaNome: materiaMap[r.materiaId]?.nome || '—',
      concursoNome: concursoMap[r.concursoId]?.nome || '—',
    }));
    const revisoesPendentes = revisoesTodas.filter((r) => !r.concluida);

    const materiasPendentesCount = materias.filter((m) => {
      const as = assuntos.filter((a) => a.materiaId === m.id);
      return as.length === 0 || as.some((a) => a.status !== 'dominado');
    }).length;

    const progressoPorConcurso = concursos.map((c) => {
      const materiasDoC = materias.filter((m) => m.concursoId === c.id);
      const assuntosDoC = assuntos.filter((a) => materiasDoC.some((m) => m.id === a.materiaId));
      const progresso = assuntosDoC.length ? Math.round(sum(assuntosDoC.map((a) => STATUS_WEIGHT[a.status])) / assuntosDoC.length) : 0;
      return { ...c, progresso, totalAssuntos: assuntosDoC.length, dominados: assuntosDoC.filter((a) => a.status === 'dominado').length };
    });

    const last14 = last14Days().map((iso) => ({ iso, min: sum(sessoes.filter((s) => s.data === iso).map((s) => s.tempoMinutos)) }));

    const horasPorMateriaMap = {};
    sessoes.forEach((s) => { if (s.materiaId) horasPorMateriaMap[s.materiaId] = (horasPorMateriaMap[s.materiaId] || 0) + s.tempoMinutos; });
    const horasPorMateria = Object.entries(horasPorMateriaMap)
      .map(([materiaId, min]) => ({ materiaId, nome: materiaMap[materiaId]?.nome || 'Matéria removida', min, horas: +(min / 60).toFixed(2) }))
      .filter((m) => m.min > 0)
      .sort((a, b) => b.min - a.min)
      .slice(0, 12);

    const assuntoStatsMap = {};
    sessoes.filter((s) => s.assuntoId && s.questoesTotal > 0).forEach((s) => {
      if (!assuntoStatsMap[s.assuntoId]) assuntoStatsMap[s.assuntoId] = { total: 0, acertos: 0 };
      assuntoStatsMap[s.assuntoId].total += s.questoesTotal;
      assuntoStatsMap[s.assuntoId].acertos += s.acertos;
    });
    const assuntosMaisFracos = Object.entries(assuntoStatsMap)
      .map(([assuntoId, v]) => ({ assuntoId, nome: assuntoMap[assuntoId]?.nome || 'Assunto removido', total: v.total, acertos: v.acertos, taxa: pct(v.acertos, v.total) }))
      .filter((a) => a.total >= 5)
      .sort((a, b) => a.taxa - b.taxa)
      .slice(0, 8);

    const evolucaoAcerto = sessoes
      .filter((s) => s.questoesTotal > 0)
      .sort((a, b) => (a.data + String(a.createdAt)).localeCompare(b.data + String(b.createdAt)))
      .slice(-20)
      .map((s) => ({ label: shortDate(s.data), taxa: pct(s.acertos, s.questoesTotal) }));

    const metaSemanas = [];
    for (let i = 5; i >= 0; i--) {
      const wk = getWeekRange(addDaysISO(hojeISO, -7 * i));
      const min = sum(sessoes.filter((s) => s.data >= wk.startISO && s.data <= wk.endISO).map((s) => s.tempoMinutos));
      metaSemanas.push({ label: i === 0 ? 'Esta sem.' : `Sem. -${i}`, meta: metaSemanalHoras || 0, realizado: +(min / 60).toFixed(1) });
    }

    return {
      hojeISO, semana, minHoje, minSemana, metaMin, questoesTotais, acertosTotais, taxaAcerto,
      revisoesTodas, revisoesPendentes, materiasPendentesCount, progressoPorConcurso,
      last14, horasPorMateria, assuntosMaisFracos, evolucaoAcerto, metaSemanas,
      concursoMap, materiaMap, assuntoMap,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="pe-root flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <GlobalStyles />
        <div className="text-center">
          <Selo size={48} />
          <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>Carregando seu painel...</p>
        </div>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="pe-root flex items-center justify-center px-4" style={{ minHeight: '100vh' }}>
        <GlobalStyles />
        <div className="text-center" style={{ maxWidth: 340 }}>
          <AlertTriangle size={36} style={{ color: 'var(--brick)', margin: '0 auto' }} />
          <p className="pe-serif text-lg mt-3" style={{ color: 'var(--ink)' }}>Não foi possível carregar seus dados</p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            Verifique sua conexão com a internet. Por segurança, nada é exibido ou salvo até confirmarmos seus dados reais na nuvem.
          </p>
          <Btn variant="accent" className="mt-4" onClick={() => setReloadTick((t) => t + 1)}>Tentar novamente</Btn>
          <button onClick={onSignOut} className="pe-btn text-xs font-semibold mt-3 block mx-auto" style={{ color: 'var(--text-muted)' }}>Sair</button>
        </div>
      </div>
    );
  }

  const viewProps = { state: data, derived, actions, goTo };

  return (
    <div className="pe-root flex" style={{ minHeight: '100vh' }}>
      <GlobalStyles />
      <Sidebar
        view={view} setView={setView} open={sidebarOpen} setOpen={setSidebarOpen}
        revisoesPendentes={derived.revisoesPendentes.length} userEmail={userEmail} onSignOut={onSignOut}
      />
      <div className="flex-1 min-w-0">
        <TopBar setSidebarOpen={setSidebarOpen} title={NAV_ITEMS.find((n) => n.key === view)?.label || ''} />
        <main className="px-4 md:px-8 py-6 max-w-6xl mx-auto">
          {importOffer && (
            <div className="mb-4 rounded-lg px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: 'var(--gold-soft)', border: '1px solid var(--gold)' }}>
              <p className="text-sm" style={{ color: 'var(--ink)' }}>
                Encontramos dados de uma versão anterior salvos neste navegador. Quer importá-los para sua conta?
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <Btn variant="ghost" onClick={dismissImport}>Ignorar</Btn>
                <Btn variant="accent" onClick={acceptImport}>Importar</Btn>
              </div>
            </div>
          )}
          {saveError && (
            <div className="mb-4 text-xs rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: 'var(--brick-soft)', color: 'var(--brick)' }}>
              <AlertTriangle size={14} /> Não foi possível sincronizar as últimas alterações com a nuvem. Verifique sua conexão.
            </div>
          )}
          {view === 'dashboard' && <DashboardView {...viewProps} />}
          {view === 'concursos' && <ConcursosView {...viewProps} />}
          {view === 'materias' && <MateriasView {...viewProps} />}
          {view === 'cronograma' && <CronogramaView {...viewProps} goToRegistroComPrefill={goToRegistroComPrefill} />}
          {view === 'registro' && <RegistroView {...viewProps} prefill={prefillRegistro} clearPrefill={clearPrefill} />}
          {view === 'revisoes' && <RevisoesView {...viewProps} goToRegistroComPrefill={goToRegistroComPrefill} />}
          {view === 'questoes' && <QuestoesView {...viewProps} />}
          {view === 'relatorios' && <RelatoriosView {...viewProps} />}
          {view === 'simulados' && <SimuladosView {...viewProps} />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = verificando, null = sem sessão, objeto = logado

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <AuthLoadingScreen />;
  if (!session) return <LoginScreen />;
  return (
    <PainelEstudos
      key={session.user.id}
      userId={session.user.id}
      userEmail={session.user.email}
      onSignOut={() => supabase.auth.signOut()}
    />
  );
}
