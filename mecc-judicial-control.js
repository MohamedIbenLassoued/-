/* =====================================================================
   MECC Judicial Control — prototype (plain JavaScript, no framework)
   Inspector + Administration portals in one page, hash routing.
   Data model: localStorage key "mecc_inspection_cases_v1" (unchanged);
   older records are normalised on read and stay compatible.
   ===================================================================== */
'use strict';
(function () {

/* ------------------------------------------------------------------ *
 * Constants & reference data
 * ------------------------------------------------------------------ */
const KEY = 'mecc_inspection_cases_v1';
const PROFILE_KEY = 'mecc_inspector_profile_v1';
const MAX_PHOTOS = 8;
const MAX_BYTES = 10 * 1024 * 1024;
const PREVIEW_MAX = 1024;   // px — stored display preview (originals are never stored)
const THUMB_MAX = 240;      // px — used in lists / cards
const MAX_DIMENSION = 16000;
const LOCALE = 'ar-QA-u-nu-latn';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const QATAR_CENTER = [25.3, 51.2];
/* Inside an embedded viewer (iframe) printing, external map tiles and device location are
   usually blocked, so those affordances are hidden or explained. Opened directly in Edge = full app. */
const EMBEDDED = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();

const LAWS = [
  'القانون رقم (1) لسنة 1993 بشأن منع تجريف الأراضي الزراعية ورمال الشواطئ',
  'القانون رقم (32) لسنة 1995 بشأن منع الإضرار بالبيئة النباتية ومكوناتها',
  'القانون رقم (10) لسنة 1987 بشأن أملاك الدولة العامة والخاصة',
  'القانون رقم (4) لسنة 2002 بتنظيم صيد الحيوانات والطيور والزواحف البرية',
  'القانون رقم (30) لسنة 2002 بإصدار قانون حماية البيئة'
];

/* Penalty text as printed on the official form — informational only. */
const PENALTIES = {
  A: { range: 'البنود 1 – 14', text: 'الحبس مدة لا تجاوز ثلاثة أشهر، وبغرامة لا تقل عن ألفي ريال ولا تزيد على عشرين ألف ريال، أو بإحدى هاتين العقوبتين، وتضاعف العقوبة في حالة العود.' },
  B: { range: 'البند 15', text: 'الحبس مدة لا تزيد على ثلاثة شهور وبغرامة لا تقل عن ألف ريال ولا تزيد على عشرين ألف ريال أو بإحدى هاتين العقوبتين، فضلاً عن الحكم بإعادة الحال إلى ما كانت عليه على نفقة المخالف.' },
  C: { range: 'البنود 16 – 19', text: 'الحبس مدة لا تجاوز سنة وبغرامة لا تزيد على عشرة آلاف ريال، أو بإحدى هاتين العقوبتين، ومصادرة الأدوات والأسلحة المستخدمة في المخالفة، وتضاعف العقوبة عند العود.' },
  D: { range: 'البند 20', text: 'الحبس مدة لا تجاوز سنة، وبالغرامة التي لا تقل عن عشرين ألف ريال ولا تزيد على مائة ألف ريال، أو بإحدى هاتين العقوبتين.' }
};

const CATS = { grazing: 'رعي', plant: 'البيئة النباتية', soil: 'تجريف التربة', wildlife: 'الحياة الفطرية', water: 'المياه' };

/* The 20 official violations (form WPD/01). */
const VIOLATIONS = [
  [1, 'grazing', 'A', 'الرعي في مناطق البيئة النباتية التي تحتاج إلى حماية أو صيانة.'],
  [2, 'grazing', 'A', 'الرعي في الأراضي التي لم يمض على تشجيرها عشر سنوات.'],
  [3, 'grazing', 'A', 'الرعي في الأراضي المسورة بقصد منع الرعي فيها.'],
  [4, 'grazing', 'A', 'الرعي في مناطق البيئة النباتية التي تجرى بها أبحاث ودراسات على الغطاء النباتي.'],
  [5, 'plant', 'A', 'القيام بالأعمال الزراعية في مناطق البيئة النباتية دون الحصول على ترخيص بذلك من وزارة البيئة والتغير المناخي.'],
  [6, 'plant', 'A', 'قطع الأشجار والشجيرات في مناطق البيئة النباتية بدون الحصول على ترخيص بذلك من وزارة البيئة والتغير المناخي.'],
  [7, 'plant', 'A', 'استغلال الثروة الطبيعية المتجددة وأراضيها في مناطق البيئة النباتية بدون الحصول على ترخيص بذلك من وزارة البيئة والتغير المناخي.'],
  [8, 'plant', 'A', 'قطع أو خلع أو اقتلاع الأشجار والشجيرات والحشائش والأعشاب، أو حرقها، أو إزالتها، أو نقلها، أو تجريدها من أوراقها أو قشورها، أو الإضرار بها في مناطق البيئة النباتية بدون الحصول على ترخيص بذلك من وزارة البيئة والتغير المناخي.'],
  [9, 'plant', 'A', 'إقامة المنشآت الثابتة في مناطق البيئة النباتية بدون الحصول على ترخيص بذلك من وزارة البيئة والتغير المناخي.'],
  [10, 'plant', 'A', 'إشعال النار أو استعمالها لأي غرض في مناطق البيئة النباتية.'],
  [11, 'plant', 'A', 'حرق بقايا المحاصيل الزراعية أو الحشائش والأعشاب، سواء داخل مناطق البيئة النباتية أو المناطق القريبة منها.'],
  [12, 'plant', 'A', 'إلقاء المخلفات الصناعية، أو الزراعية، أو النفايات، أو نواتج الهدم، أو التسوية وما شابهها في مناطق البيئة النباتية.'],
  [13, 'plant', 'A', 'العبث أو الإضرار بالأسوار أو الإنشاءات الخاصة بمحميات البيئة النباتية.'],
  [14, 'plant', 'A', 'مرور السيارات والمعدات والآليات عشوائياً في غير المناطق المخصص لها.'],
  [15, 'soil', 'B', 'تجريف الأراضي الزراعية أو نقل أتربة منها، أو القيام بأي عمل من شأنه إزالة التربة الزراعية المعدة للفلاحة أو أي جزء من سطح الأرض، على نحو يكون من شأنه الكشف عن الطبقة التحتية للأرض.'],
  [16, 'wildlife', 'C', 'صيد الحيوانات والطيور والزواحف البرية في المحميات والجزر، وداخل حدود المدن والقرى، وعلى بعد يقل عن خمسمائة متر من الطرق العامة، وداخل الممتلكات الخاصة بدون الحصول على موافقة أصحابها وذوي الحقوق عليها.'],
  [17, 'wildlife', 'C', 'التعرض للسلاحف البحرية وبيضها.'],
  [18, 'wildlife', 'C', 'التعرض لبيض الطيور، والمساس بأعشاشها.'],
  [19, 'wildlife', 'C', 'الإضرار بالروض والنباتات البرية.'],
  [20, 'water', 'D', 'إلقاء أو صرف أو التخلص من المواد الصلبة أو السائلة أو الغازية في مصادر أو مجاري المياه السطحية أو الجوفية الصالحة للاستخدام.']
].map(([no, cat, pen, text]) => ({ no, cat, pen, text }));
const VBY = Object.fromEntries(VIOLATIONS.map(v => [v.no, v]));
const CHIP_REQUIRED = [1, 2, 3, 4];

/* Placeholder violation labels used by the earlier two-portal prototype. */
const LEGACY_VIOLATIONS = ['مخالفة رعي (البند ١)', 'مخالفة رعي (البند ٢)', 'مخالفة رعي (البند ٣)', 'مخالفة رعي (البند ٤)', 'مخالفة أخرى (البند ٥)', 'مخالفة أخرى (البند ٦)', 'مخالفة أخرى (البند ٧)', 'مخالفة أخرى (البند ٨)'];

const STATUS = {
  draft: { label: 'مسودة', cls: 'b-draft' },
  submitted: { label: 'قيد المراجعة', cls: 'b-review' },
  resubmitted: { label: 'أعيد تسليمه للمراجعة', cls: 'b-review2' },
  returned: { label: 'معاد للتعديل', cls: 'b-returned' },
  approved: { label: 'معتمد', cls: 'b-approved' }
};
const PENDING = ['submitted', 'resubmitted'];
const EDITABLE = ['draft', 'returned'];
const ACTIONS = {
  created: 'إنشاء مسودة المحضر',
  submitted: 'تسليم المحضر للمراجعة',
  resubmitted: 'إعادة التسليم بعد التعديل',
  returned: 'إرجاع المحضر للمفتش للتعديل',
  approved: 'اعتماد المحضر'
};
const SIGNATURE = { unspecified: 'لم يحدد', signed: 'وقّع', refused: 'رفض التوقيع' };
const SETTLEMENT = { '': 'لم يحدد', offered: 'تم عرض الصلح', not_offered: 'لم يُعرض الصلح' };
const OFFENDER_TYPE = { person: 'شخص', company: 'شركة' };
const PHOTO_CAT = { field: 'صورة ميدانية', support: 'دليل داعم' };
const LOC_SOURCE = { gps: 'GPS الجهاز', map: 'تحديد على الخريطة', manual: 'إدخال يدوي' };
const STEPS = ['الموقع والزمان', 'المخالفات والأدلة', 'بيانات المخالف والمراجعة'];
const STEPS_SHORT = ['الموقع', 'المخالفات', 'المخالف'];

const LEGAL_NOTE = 'العقوبات والإشارات القانونية معروضة للاطلاع فقط. لا يحتسب النظام أي غرامة، ولا يقرر الإدانة، ولا يطبق أي عقوبة؛ القرار القانوني يصدر بعد المراجعة الرسمية من الجهة المختصة.';
const SIGN_NOTE = 'تسجيل حالة التوقيع إجراء توثيقي فقط، ولا يُعد توقيع المخالف أو رفضه للتوقيع إقراراً بالمخالفة أو نفياً لها.';

/* ------------------------------------------------------------------ *
 * Icons (inline SVG, no dependency)
 * ------------------------------------------------------------------ */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5.5 5h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  pin: '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  next: '<path d="m15 6-6 6 6 6"/>',   /* RTL: forward points left */
  prev: '<path d="m9 6 6 6-6 6"/>',    /* RTL: back points right   */
  print: '<path d="M7 9V3h10v6"/><path d="M7 17H4v-7h16v7h-3"/><path d="M7 14h10v7H7z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  device: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  scale: '<path d="M12 3v18M5 21h14M5 7h14M7 7l-3 7h6zM17 7l-3 7h6z"/>',
  chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>'
};
function icon(name, cls) {
  return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
}

/* ------------------------------------------------------------------ *
 * Utilities
 * ------------------------------------------------------------------ */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const enc = encodeURIComponent;
function todayISO() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function nowTime() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function latinDigits(s) {
  return String(s ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
}
/* null = empty, NaN = invalid */
function parseNum(v) {
  const s = latinDigits(v).trim().replace(/[٫،,]/g, '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
function validLat(n) { return typeof n === 'number' && Number.isFinite(n) && n >= -90 && n <= 90; }
function validLng(n) { return typeof n === 'number' && Number.isFinite(n) && n >= -180 && n <= 180; }
function hasCoords(c) { return validLat(c.lat) && validLng(c.lng); }
function inQatar(lat, lng) { return lat >= 24.4 && lat <= 26.3 && lng >= 50.6 && lng <= 52.0; }
function fmtDate(s) {
  if (!s) return '—';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : new Date(s);
  if (isNaN(d)) return esc(s);
  return d.toLocaleDateString(LOCALE, { year: 'numeric', month: 'long', day: 'numeric' });
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString(LOCALE, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtTime12(t) {
  if (!t || !/^\d{1,2}:\d{2}/.test(t)) return t || '—';
  const [h, m] = t.split(':').map(Number);
  return pad(h % 12 || 12) + ':' + pad(m) + (h < 12 ? ' ص' : ' م');
}
function fmtBytes(n) {
  if (!n && n !== 0) return '';
  return n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' ك.ب' : (n / 1048576).toFixed(1) + ' م.ب';
}
const ltr = s => '<bdi class="ltr" dir="ltr">' + esc(s) + '</bdi>';
function coordsText(c) { return Number(c.lat).toFixed(6) + ', ' + Number(c.lng).toFixed(6); }
function locText(c) {
  if (c.place && c.place.trim()) return esc(c.place.trim());
  if (hasCoords(c)) return ltr(Number(c.lat).toFixed(5) + ', ' + Number(c.lng).toFixed(5));
  return 'لم يحدد الموقع';
}
function badge(status) {
  const s = STATUS[status] || { label: status, cls: 'b-neutral' };
  return '<span class="badge ' + s.cls + '">' + esc(s.label) + '</span>';
}
function uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function sortRecent(list) {
  return list.slice().sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}
function clone(o) { return typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)); }

/* ------------------------------------------------------------------ *
 * Storage (localStorage, same key as the original prototype)
 * ------------------------------------------------------------------ */
let cache = null;

function normalize(raw) {
  const c = Object.assign({}, raw);
  c.id = String(c.id || uid('MECC-LEGACY-'));
  if (!STATUS[c.status]) c.status = 'submitted';
  // photos: legacy = array of data-URL strings
  c.photos = (Array.isArray(c.photos) ? c.photos : []).map((p, i) => {
    if (typeof p === 'string') return { id: 'legacy' + i, preview: p, thumb: null, caption: '', category: 'field', legacy: true };
    return Object.assign({ caption: '', category: 'field' }, p, { category: PHOTO_CAT[p && p.category] ? p.category : 'field' });
  }).filter(p => p && p.preview);
  // violations: official numbers; map legacy labels where possible
  if (!Array.isArray(c.violationNos)) {
    c.violationNos = (Array.isArray(c.violations) ? c.violations : []).map(v => {
      const i = LEGACY_VIOLATIONS.indexOf(v);
      if (i >= 0) return i + 1;
      const o = VIOLATIONS.find(x => x.text === v);
      return o ? o.no : null;
    });
  }
  c.violationNos = Array.from(new Set(c.violationNos.map(Number).filter(n => VBY[n]))).sort((a, b) => a - b);
  c.legacyViolations = (Array.isArray(c.violations) ? c.violations : []).filter(v => typeof v === 'string' && !LEGACY_VIOLATIONS.includes(v) && !VIOLATIONS.some(x => x.text === v));
  c.chips = (Array.isArray(c.chips) ? c.chips : []).map(x => String(x)).filter(x => x.trim());
  c.offenderType = c.offenderType === 'company' ? 'company' : 'person';
  c.signature = SIGNATURE[c.signature] ? c.signature : 'unspecified';
  ['offenderSig', 'inspectorSig'].forEach(k => { c[k] = typeof c[k] === 'string' && c[k].indexOf('data:image/') === 0 ? c[k] : ''; });
  c.settlement = Object.prototype.hasOwnProperty.call(SETTLEMENT, c.settlement || '') ? (c.settlement || '') : '';
  ['date', 'time', 'place', 'notes', 'person', 'qid', 'phone', 'address', 'section', 'inspectorName', 'inspectorNo', 'managerNote'].forEach(k => { c[k] = c[k] == null ? '' : String(c[k]); });
  ['lat', 'lng', 'accuracy'].forEach(k => { c[k] = (c[k] === null || c[k] === undefined || c[k] === '') ? null : Number(c[k]); if (Number.isNaN(c[k])) c[k] = null; });
  if (!LOC_SOURCE[c.locSource]) c.locSource = hasCoords(c) ? 'map' : null;
  if (!Array.isArray(c.returnComments)) {
    c.returnComments = (c.status === 'returned' && c.managerNote) ? [{ text: c.managerNote, at: c.reviewedAt || null, by: 'الإدارة' }] : [];
  }
  if (!Array.isArray(c.history)) {
    const h = [];
    if (c.createdAt) h.push({ action: 'created', at: c.createdAt, by: 'المفتش' });
    if (c.status !== 'draft') h.push({ action: 'submitted', at: c.createdAt || null, by: 'المفتش' });
    if (c.reviewedAt && (c.status === 'approved' || c.status === 'returned')) h.push({ action: c.status, at: c.reviewedAt, by: 'الإدارة', note: c.managerNote || '' });
    c.history = h;
    c.legacyHistory = true;
  }
  return c;
}
function readCases() {
  if (cache) return cache;
  let raw;
  try { raw = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { raw = []; }
  if (!Array.isArray(raw)) raw = [];
  cache = raw.filter(x => x && typeof x === 'object').map(normalize);
  return cache;
}
function writeCases(list) {
  localStorage.setItem(KEY, JSON.stringify(list)); // may throw (quota)
  cache = list;
  updateStorageUse();
}
function getCase(id) { return readCases().find(c => c.id === id) || null; }
function upsertCase(c) {
  const list = readCases().slice();
  const i = list.findIndex(x => x.id === c.id);
  if (i < 0) list.unshift(c); else list[i] = c;
  writeCases(list);
}
function removeCase(id) { writeCases(readCases().filter(c => c.id !== id)); }
function newId() {
  const ids = new Set(readCases().map(c => c.id));
  const base = 'MECC-' + new Date().getFullYear() + '-';
  let n = Number(String(Date.now()).slice(-7));
  while (ids.has(base + String(n).padStart(7, '0'))) n = (n + 1) % 10000000;
  return base + String(n).padStart(7, '0');
}
function getProfile() { try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') || {}; } catch (e) { return {}; } }
function setProfile(p) { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) { /* ignore */ } }
function isQuota(e) { return e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014 || /quota/i.test(e.message || '')); }
function updateStorageUse() {
  const el = $('#storageUse');
  if (!el) return;
  try {
    const n = (localStorage.getItem(KEY) || '').length * 2;
    el.textContent = 'التخزين المحلي المستخدم: ' + fmtBytes(n) + ' تقريباً';
  } catch (e) { el.textContent = ''; }
}

/* ------------------------------------------------------------------ *
 * Shell: navigation, drawer, toast, viewer
 * ------------------------------------------------------------------ */
const NAV = {
  inspector: [
    { h: '#home', k: 'home', label: 'الرئيسية', icon: 'home' },
    { h: '#reports', k: 'reports', label: 'تقاريري', icon: 'list' },
    { h: '#new', k: 'new', label: 'محضر جديد', icon: 'plus', accent: true }
  ],
  admin: [
    { h: '#admin', k: 'adash', label: 'لوحة الإدارة', icon: 'grid' },
    { h: '#admin-inbox', k: 'inbox', label: 'صندوق المحاضر', icon: 'inbox' }
  ]
};
const SWITCH = {
  inspector: { h: '#admin', k: 'admin', label: 'الإدارة', long: 'بوابة الإدارة', icon: 'shield' },
  admin: { h: '#home', k: 'home-switch', label: 'بوابة المفتش', long: 'بوابة المفتش', icon: 'user' }
};
function navKey(p) {
  if (p[0] === 'admin') return p[1] === 'inbox' || p[1] === 'review' ? 'inbox' : 'adash';
  if (p[0] === 'reports' || p[0] === 'view') return 'reports';
  if (p[0] === 'new' || p[0] === 'edit') return 'new';
  return 'home';
}
function renderShell(portal, p) {
  const key = navKey(p);
  const cur = it => it.k === key ? ' aria-current="page"' : '';
  document.body.dataset.portal = portal;
  $('#portalPill').innerHTML = '<span class="hide-xs">بوابة </span>' + (portal === 'admin' ? 'الإدارة' : 'المفتش');
  $('#portalPill').setAttribute('aria-label', portal === 'admin' ? 'البوابة الحالية: بوابة الإدارة' : 'البوابة الحالية: بوابة المفتش');
  $('#sidePortalLabel').textContent = portal === 'admin' ? 'بوابة الإدارة' : 'بوابة المفتش';
  $('#sideNav').innerHTML = NAV[portal].map(it => '<a href="' + it.h + '"' + cur(it) + '>' + icon(it.icon) + '<span>' + it.label + '</span></a>').join('');
  const sw = SWITCH[portal];
  $('#sideSwitch').innerHTML = '<a href="' + sw.h + '">' + icon(sw.icon) + '<span>' + sw.long + '</span></a>';
  const bn = NAV[portal].concat([sw]);
  $('#bottomnav').innerHTML = bn.map(it => '<a href="' + it.h + '"' + cur(it) + (it.accent ? ' class="accent"' : '') + '><span class="bn-icon">' + icon(it.icon) + '</span><span>' + it.label + '</span></a>').join('');
}
function openDrawer() {
  const sb = $('#sidebar');
  sb.classList.add('open');
  $('#backdrop').hidden = false;
  $('#menuBtn').setAttribute('aria-expanded', 'true');
  const first = $('#sideNav a', sb);
  setTimeout(() => (first || sb).focus(), 30);
}
function closeDrawer(restore) {
  const sb = $('#sidebar');
  if (!sb.classList.contains('open')) return;
  sb.classList.remove('open');
  $('#backdrop').hidden = true;
  $('#menuBtn').setAttribute('aria-expanded', 'false');
  if (restore) $('#menuBtn').focus();
}
let toastTimer = null;
function toast(text, kind) {
  const r = $('#toastRegion');
  r.innerHTML = '<div class="toast ' + (kind || 'ok') + '">' + icon(kind === 'bad' ? 'alert' : kind === 'info' ? 'info' : 'check') + '<span>' + esc(text) + '</span></div>';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { r.innerHTML = ''; }, 5200);
}
function openViewer(src, title, caption) {
  const d = $('#viewer');
  $('#viewerImg').src = src;
  $('#viewerImg').alt = title || 'صورة';
  $('#viewerTitle').textContent = title || 'معاينة الصورة';
  $('#viewerCap').textContent = caption || '';
  $('#viewerCap').hidden = !caption;
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
}
function closeViewer() {
  const d = $('#viewer');
  if (typeof d.close === 'function' && d.open) d.close(); else d.removeAttribute('open');
  $('#viewerImg').removeAttribute('src');
}
/* In-page confirmation (native confirm() is unavailable in embedded viewers). */
function askConfirm(title, body, okLabel, danger) {
  return new Promise(resolve => {
    const d = $('#confirmDlg');
    $('#confirmTitle').textContent = title;
    $('#confirmBody').textContent = body || '';
    $('#confirmBody').hidden = !body;
    const ok = $('#confirmOk');
    ok.textContent = okLabel || 'تأكيد';
    ok.className = 'btn lg ' + (danger ? 'danger' : 'primary');
    const prevFocus = document.activeElement;
    const finish = v => {
      ok.onclick = null; $('#confirmCancel').onclick = null; d.onclose = null;
      if (d.open) { if (typeof d.close === 'function') d.close(); else d.removeAttribute('open'); }
      if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
      resolve(v);
    };
    ok.onclick = () => finish(true);
    $('#confirmCancel').onclick = () => finish(false);
    d.onclose = () => finish(false);
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    $('#confirmCancel').focus();
  });
}
function updateNet() { $('#netState').hidden = navigator.onLine !== false; }

/* ------------------------------------------------------------------ *
 * Router
 * ------------------------------------------------------------------ */
/* Routes use plain "#name" hashes (letters, digits, hyphens) so they also work inside
   embedded viewers: #home, #reports-returned, #new, #edit-<id>, #view-<id>,
   #admin, #admin-inbox-<filter>, #admin-review-<id>. Old "#/a/b" links still parse. */
function parseRoute() {
  let h = location.hash.replace(/^#/, '');
  try { h = decodeURIComponent(h); } catch (e) { /* keep raw */ }
  if (h.charAt(0) === '/') return h.split('/').filter(Boolean);
  const m = h.match(/^(admin-review|admin-inbox|reports|edit|view)-(.+)$/);
  if (m) return m[1].split('-').concat([m[2]]);
  return h ? h.split('-') : [];
}
function render() {
  leaveWizard();
  closeDrawer();
  const p = parseRoute();
  const portal = p[0] === 'admin' ? 'admin' : 'inspector';
  renderShell(portal, p);
  const view = $('#view');
  let title;
  if (portal === 'admin') {
    if (p[1] === 'inbox') title = renderAdminInbox(view, p[2]);
    else if (p[1] === 'review' && p[2]) title = renderAdminReview(view, p[2]);
    else title = renderAdminHome(view);
  } else if (p[0] === 'reports') title = renderReports(view, p[1]);
  else if (p[0] === 'new') title = renderWizard(view, null);
  else if (p[0] === 'edit' && p[1]) title = renderWizard(view, p[1]);
  else if (p[0] === 'view' && p[1]) title = renderInspectorView(view, p[1]);
  else title = renderHome(view);
  document.title = (title || 'الرئيسية') + ' | محاضر الضبط القضائي';
  window.scrollTo(0, 0);
  const h = $('#view h1');
  if (h && renderCount++ > 0) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
}
let renderCount = 0;

/* ------------------------------------------------------------------ *
 * Shared fragments
 * ------------------------------------------------------------------ */
function emptyState(text, cta) {
  return '<div class="card empty"><p>' + esc(text) + '</p>' + (cta || '') + '</div>';
}
function notFound(backHref) {
  return '<div class="card empty"><h1>المحضر غير موجود</h1><p>ربما حُذف أو لم يُحفظ على هذا الجهاز.</p><a class="btn secondary" href="' + (backHref || '#home') + '">العودة</a></div>';
}
function latestReturn(c) { return c.returnComments.length ? c.returnComments[c.returnComments.length - 1] : null; }

function reportCard(c, mode) {
  const ret = c.status === 'returned' ? latestReturn(c) : null;
  const cls = c.status === 'returned' ? ' is-returned' : c.status === 'draft' ? ' is-draft' : '';
  let actions;
  if (mode === 'admin') {
    actions = '<a class="btn ' + (PENDING.includes(c.status) ? 'primary' : 'secondary') + ' block" href="#admin-review-' + enc(c.id) + '">' + icon('eye') + (PENDING.includes(c.status) ? 'فتح للمراجعة' : 'عرض المحضر') + '</a>';
  } else if (c.status === 'draft') {
    actions = '<a class="btn primary" href="#edit-' + enc(c.id) + '">' + icon('edit') + 'متابعة التحرير</a><button class="btn danger-outline" type="button" data-action="delete-draft" data-id="' + esc(c.id) + '">' + icon('trash') + 'حذف</button>';
  } else if (c.status === 'returned') {
    actions = '<a class="btn primary" href="#edit-' + enc(c.id) + '">' + icon('edit') + 'فتح وتعديل</a><a class="btn secondary" href="#view-' + enc(c.id) + '">عرض</a>';
  } else {
    actions = '<a class="btn secondary block" href="#view-' + enc(c.id) + '">' + icon('eye') + 'عرض المحضر</a>';
  }
  const vcount = c.violationNos.length + c.legacyViolations.length;
  return '<article class="rcard' + cls + '" aria-label="محضر ' + esc(c.id) + '">' +
    '<div class="rcard-head"><span class="rid">' + esc(c.id) + '</span>' + badge(c.status) + '</div>' +
    '<div class="rmeta">' +
      '<span>' + icon('pin') + '<span class="txt">' + locText(c) + '</span></span>' +
      '<span>' + icon('calendar') + '<span class="txt">' + fmtDate(c.date) + (c.time ? ' · ' + esc(fmtTime12(c.time)) : '') + '</span></span>' +
      (mode === 'admin' ? '<span>' + icon('user') + '<span class="txt">' + (c.person ? esc(c.person) : 'لم يحدد المخالف') + '</span></span>' : '') +
      '<span>' + icon('scale') + '<span class="txt">' + (vcount ? (vcount === 1 ? 'مخالفة واحدة' : vcount + ' مخالفات') + (c.violationNos.length ? ' (البند ' + c.violationNos.join('، ') + ')' : '') : 'لم تحدد المخالفات') + '</span></span>' +
    '</div>' +
    (ret ? '<div class="return-note"><b>ملاحظة الإدارة عند الإرجاع</b>' + esc(ret.text) + '</div>' : '') +
    '<div class="btn-row">' + actions + '</div>' +
  '</article>';
}

function kvRows(rows) {
  return '<dl class="kv">' + rows.filter(Boolean).map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>').join('') + '</dl>';
}

function detailSections(c, opts) {
  opts = opts || {};
  const osm = hasCoords(c) ? ' · <a href="https://www.openstreetmap.org/?mlat=' + c.lat + '&amp;mlon=' + c.lng + '#map=17/' + c.lat + '/' + c.lng + '" target="_blank" rel="noopener">عرض على الخريطة</a>' : '';
  const info = '<section class="card" aria-labelledby="sec-info"><h2 id="sec-info" class="review-sec-head">بيانات الضبط</h2>' + kvRows([
    ['رقم المحضر', ltr(c.id)],
    ['الحالة', badge(c.status)],
    ['تاريخ الضبط', fmtDate(c.date)],
    ['الساعة', esc(fmtTime12(c.time))],
    ['المفتش', esc(c.inspectorName || '—') + (c.inspectorNo ? ' · الرقم الوظيفي ' + ltr(c.inspectorNo) : '')],
    ['القسم', esc(c.section || '—')],
    ['وصف الموقع', esc(c.place || '—')],
    ['الإحداثيات', hasCoords(c) ? ltr(coordsText(c)) + osm : 'غير محددة'],
    hasCoords(c) ? ['مصدر الموقع', esc(LOC_SOURCE[c.locSource] || '—') + (c.accuracy != null ? ' · الدقة ±' + ltr(Math.round(c.accuracy)) + ' م' : '')] : null
  ]) + '</section>';

  const vlist = c.violationNos.map(n => '<li><span class="vnum">' + n + '</span><span>' + esc(VBY[n].text) + '</span></li>').join('') +
    c.legacyViolations.map(t => '<li><span class="vnum">—</span><span>' + esc(t) + ' <span class="muted">(بند من نسخة سابقة)</span></span></li>').join('');
  const viol = '<section class="card" aria-labelledby="sec-viol"><h2 id="sec-viol" class="review-sec-head">المخالفات المضبوطة</h2>' +
    (vlist ? '<ul class="vsum">' + vlist + '</ul>' : '<p class="muted">لم تحدد مخالفات.</p>') +
    (c.chips.length ? '<div style="margin-top:12px"><p class="label">أرقام شرائح الإبل</p><div class="chips-view">' + c.chips.map(x => '<span>' + esc(x) + '</span>').join('') + '</div></div>' : '') +
    '<div style="margin-top:12px"><p class="label">شرح المخالفة</p><p style="white-space:pre-wrap;overflow-wrap:anywhere">' + esc(c.notes || '—') + '</p></div>' +
    '<div class="legal-note" style="margin-top:12px">' + icon('info') + '<span>' + LEGAL_NOTE + '</span></div>' +
  '</section>';

  const off = '<section class="card" aria-labelledby="sec-off"><h2 id="sec-off" class="review-sec-head">بيانات المخالف</h2>' + kvRows([
    c.offenderType === 'company' ? ['نوع المخالف', OFFENDER_TYPE[c.offenderType]] : null,
    [c.offenderType === 'company' ? 'اسم الشركة' : 'اسم المخالف', esc(c.person || '—')],
    [c.offenderType === 'company' ? 'رقم السجل التجاري' : 'رقم البطاقة الشخصية', c.qid ? ltr(c.qid) : '—'],
    ['الهاتف', c.phone ? ltr(c.phone) : '—'],
    ['العنوان', esc(c.address || '—')],
    ['عرض الصلح', esc(SETTLEMENT[c.settlement])],
    ['حالة التوقيع', esc(SIGNATURE[c.signature])]
  ]) +
  '<div class="sig-view">' +
    '<figure><figcaption>توقيع المخالف</figcaption>' + (c.offenderSig ? '<img src="' + esc(c.offenderSig) + '" alt="توقيع المخالف">' : '<span class="muted">' + (c.signature === 'refused' ? 'رفض التوقيع' : 'لا يوجد توقيع') + '</span>') + '</figure>' +
    '<figure><figcaption>توقيع المفتش</figcaption>' + (c.inspectorSig ? '<img src="' + esc(c.inspectorSig) + '" alt="توقيع المفتش">' : '<span class="muted">لا يوجد توقيع</span>') + '</figure>' +
  '</div>' +
  '<p class="hint">' + SIGN_NOTE + '</p></section>';

  const ev = '<section class="card" aria-labelledby="sec-ev"><div class="review-sec-head"><h2 id="sec-ev">الأدلة والصور</h2><span class="counter">' + c.photos.length + ' / ' + MAX_PHOTOS + '</span></div>' +
    (c.photos.length ? '<div class="gallery">' + c.photos.map((ph, i) =>
      '<figure><button type="button" data-action="zoom" data-case="' + esc(c.id) + '" data-id="' + esc(ph.id) + '" aria-label="تكبير الصورة ' + (i + 1) + '"><img src="' + esc(ph.thumb || ph.preview) + '" alt="" loading="lazy" decoding="async"></button>' +
      '<figcaption><b>' + esc(PHOTO_CAT[ph.category]) + '</b>' + (ph.caption ? esc(ph.caption) : '<span class="muted">بدون وصف</span>') + '</figcaption></figure>').join('') + '</div>'
      : '<p class="muted">لا توجد صور مرفقة.</p>') +
  '</section>';

  const rets = c.returnComments.length ? '<section class="card" aria-labelledby="sec-ret"><h2 id="sec-ret" class="review-sec-head">ملاحظات الإرجاع السابقة (' + c.returnComments.length + ')</h2><ul class="timeline">' +
    c.returnComments.map((r, i) => '<li class="t-returned"><div class="t-act">الإرجاع رقم ' + (i + 1) + '</div><div class="t-meta">' + fmtDateTime(r.at) + ' · ' + esc(r.by || 'الإدارة') + '</div><div class="t-note">' + esc(r.text) + '</div></li>').join('') +
  '</ul></section>' : '';

  const hist = '<section class="card" aria-labelledby="sec-hist"><h2 id="sec-hist" class="review-sec-head">سجل الإجراءات</h2>' +
    (c.history.length ? '<ol class="timeline">' + c.history.map(h =>
      '<li class="t-' + esc(h.action) + '"><div class="t-act">' + esc(ACTIONS[h.action] || h.action) + '</div><div class="t-meta">' + fmtDateTime(h.at) + (h.by ? ' · ' + esc(h.by) : '') + '</div>' + (h.note ? '<div class="t-note">' + esc(h.note) + '</div>' : '') + '</li>').join('') + '</ol>'
      : '<p class="muted">لا توجد إجراءات مسجلة.</p>') +
    (c.legacyHistory ? '<p class="hint">سُجّل هذا المحضر في نسخة سابقة؛ السجل مُستنتج من البيانات المتوفرة.</p>' : '') +
  '</section>';

  return { info, viol, off, ev, rets, hist };
}

/* ------------------------------------------------------------------ *
 * Example data (clearly marked) for demonstrations
 * ------------------------------------------------------------------ */
const SAMPLE_FLAG = 'mecc_samples_loaded_v1';
function sampleCases() {
  const d = n => { const x = new Date(); x.setDate(x.getDate() - n); return x; };
  const iso = (n, h) => { const x = d(n); x.setHours(h, 15, 0, 0); return x.toISOString(); };
  const day = n => { const x = d(n); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };
  const base = { offenderType: 'person', phone: '', address: '', settlement: '', signature: 'unspecified', photos: [], inspectorName: 'مفتش تجريبي', inspectorNo: '000000', section: 'الشمال' };
  return [
    Object.assign({}, base, { id: 'MECC-DEMO-0000001', status: 'returned', date: day(3), time: '07:35', place: 'مثال: منطقة الخريب – روضة طبيعية', lat: 25.4495, lng: 51.2234, accuracy: 9, locSource: 'gps',
      violationNos: [1], chips: ['000000000000001'], notes: 'مثال تجريبي: رعي قطيع إبل داخل منطقة بيئة نباتية محمية.', person: 'مخالف تجريبي (مثال)', qid: '00000000000', signature: 'refused',
      createdAt: iso(3, 7), updatedAt: iso(1, 10), submittedAt: iso(3, 9), reviewedAt: iso(1, 10), managerNote: 'يرجى إرفاق صورة لقارئ الشريحة الإلكترونية وتوضيح حدود المنطقة المحمية.',
      returnComments: [{ text: 'يرجى إرفاق صورة لقارئ الشريحة الإلكترونية وتوضيح حدود المنطقة المحمية.', at: iso(1, 10), by: 'الإدارة' }],
      history: [{ action: 'created', at: iso(3, 7), by: 'مفتش تجريبي' }, { action: 'submitted', at: iso(3, 9), by: 'مفتش تجريبي' }, { action: 'returned', at: iso(1, 10), by: 'الإدارة', note: 'يرجى إرفاق صورة لقارئ الشريحة الإلكترونية وتوضيح حدود المنطقة المحمية.' }] }),
    Object.assign({}, base, { id: 'MECC-DEMO-0000002', status: 'submitted', date: day(1), time: '16:20', place: 'مثال: محيط روضة شمال الدوحة', lat: 25.62, lng: 51.41, accuracy: 15, locSource: 'gps',
      violationNos: [10, 14], notes: 'مثال تجريبي: إشعال نار ومرور مركبة خارج المسار.', person: 'مخالف تجريبي ثالث (مثال)', qid: '00000000002', settlement: 'offered', signature: 'signed',
      createdAt: iso(1, 16), updatedAt: iso(1, 17), submittedAt: iso(1, 17),
      returnComments: [], history: [{ action: 'created', at: iso(1, 16), by: 'مفتش تجريبي' }, { action: 'submitted', at: iso(1, 17), by: 'مفتش تجريبي' }] }),
    Object.assign({}, base, { id: 'MECC-DEMO-0000003', status: 'draft', date: day(0), time: '08:05', place: 'مثال: ساحل الغارية', lat: null, lng: null,
      violationNos: [17], notes: '', person: '', createdAt: iso(0, 8), updatedAt: iso(0, 8),
      returnComments: [], history: [{ action: 'created', at: iso(0, 8), by: 'مفتش تجريبي' }] }),
    Object.assign({}, base, { id: 'MECC-DEMO-0000004', status: 'approved', date: day(6), time: '10:40', place: 'مثال: مزرعة جنوب الخور', lat: 25.6, lng: 51.48, accuracy: 20, locSource: 'map',
      violationNos: [15], notes: 'مثال تجريبي: نقل أتربة من أرض زراعية.', person: 'مخالف تجريبي آخر (مثال)', qid: '00000000001',
      createdAt: iso(6, 10), updatedAt: iso(4, 12), submittedAt: iso(6, 12), reviewedAt: iso(4, 12), managerNote: 'تمت المراجعة.',
      returnComments: [], history: [{ action: 'created', at: iso(6, 10), by: 'مفتش تجريبي' }, { action: 'submitted', at: iso(6, 12), by: 'مفتش تجريبي' }, { action: 'approved', at: iso(4, 12), by: 'الإدارة', note: 'تمت المراجعة.' }] })
  ].map(c => Object.assign(c, { violations: c.violationNos.map(n => VBY[n].text) }));
}
function loadSamples() {
  try {
    const ids = new Set(readCases().map(c => c.id));
    writeCases(readCases().concat(sampleCases().filter(c => !ids.has(c.id)).map(normalize)));
    localStorage.setItem(SAMPLE_FLAG, '1');
    toast('تم تحميل محاضر تجريبية (أمثلة) على هذا الجهاز.', 'info');
  } catch (e) { toast('تعذر تحميل الأمثلة.', 'bad'); }
  render();
}
function removeSamples() {
  try { writeCases(readCases().filter(c => !/^MECC-DEMO-/.test(c.id))); toast('تم حذف المحاضر التجريبية.'); } catch (e) { toast('تعذر الحذف.', 'bad'); }
  render();
}
const sampleBtn = () => '<button class="btn secondary" type="button" data-action="load-samples">' + icon('list') + 'تحميل محاضر تجريبية</button>';
function samplesNote() {
  return readCases().some(c => /^MECC-DEMO-/.test(c.id))
    ? '<div class="msg info" style="margin-top:14px">' + icon('info') + '<div>المحاضر التي يبدأ رقمها بـ <bdi dir="ltr">MECC-DEMO</bdi> أمثلة تجريبية للعرض فقط. <button class="btn ghost sm" type="button" data-action="remove-samples">حذف الأمثلة</button></div></div>' : '';
}

/* ------------------------------------------------------------------ *
 * Inspector — home
 * ------------------------------------------------------------------ */
function greeting() { const h = new Date().getHours(); return h < 12 ? 'صباح الخير' : 'مساء الخير'; }
function renderHome(view) {
  const list = sortRecent(readCases());
  const name = getProfile().name;
  const action = list.filter(c => EDITABLE.includes(c.status));
  const review = list.filter(c => PENDING.includes(c.status));
  const approved = list.filter(c => c.status === 'approved');
  const returned = list.filter(c => c.status === 'returned');
  const recent = list.filter(c => c.status !== 'returned').slice(0, 4);
  view.innerHTML =
    '<section class="card hero">' +
      '<p class="eyebrow">بوابة المفتش · الضبط القضائي</p>' +
      '<h1>' + greeting() + (name ? '، ' + esc(name) : '') + '</h1>' +
      '<p class="lead">سجّل المخالفات البيئية ميدانياً، وتُحفظ على جهازك تلقائياً حتى تسليمها للمراجعة.</p>' +
      '<a class="btn primary xl" href="#new">' + icon('plus', 'ic-lg') + 'محضر جديد</a>' +
    '</section>' +
    '<div class="stats" role="list">' +
      '<a role="listitem" class="stat st-action" href="#reports-action"><span class="stat-label">تحتاج إجراء</span><strong>' + action.length + '</strong><span class="stat-sub">مسودات ومعادة</span></a>' +
      '<a role="listitem" class="stat st-review" href="#reports-review"><span class="stat-label">قيد المراجعة</span><strong>' + review.length + '</strong><span class="stat-sub">لدى الإدارة</span></a>' +
      '<a role="listitem" class="stat st-ok" href="#reports-approved"><span class="stat-label">معتمدة</span><strong>' + approved.length + '</strong><span class="stat-sub">للقراءة فقط</span></a>' +
    '</div>' +
    (returned.length ?
      '<div class="sec-head"><h2>' + icon('alert') + ' محاضر معادة للتعديل (' + returned.length + ')</h2></div>' +
      '<div class="cards grid-2">' + returned.map(c => reportCard(c)).join('') + '</div>' : '') +
    '<div class="sec-head"><h2>أحدث المحاضر</h2>' + (list.length ? '<a href="#reports">عرض الكل</a>' : '') + '</div>' +
    (recent.length ? '<div class="cards grid-2">' + recent.map(c => reportCard(c)).join('') + '</div>'
      : returned.length ? '' : emptyState('لا توجد محاضر بعد. ابدأ بإنشاء أول محضر، أو حمّل أمثلة لاستعراض سير العمل.', '<div class="btn-row" style="justify-content:center"><a class="btn primary" href="#new">' + icon('plus') + 'محضر جديد</a>' + sampleBtn() + '</div>')) +
    samplesNote();
  return 'الرئيسية';
}

/* ------------------------------------------------------------------ *
 * Inspector — my reports
 * ------------------------------------------------------------------ */
const R_FILTERS = [
  ['all', 'الكل', () => true],
  ['action', 'تحتاج إجراء', c => EDITABLE.includes(c.status)],
  ['returned', 'معادة', c => c.status === 'returned'],
  ['draft', 'مسودات', c => c.status === 'draft'],
  ['review', 'قيد المراجعة', c => PENDING.includes(c.status)],
  ['approved', 'معتمدة', c => c.status === 'approved']
];
function matchQuery(c, q) {
  if (!q) return true;
  q = latinDigits(q).toLowerCase();
  return [c.id, c.place, c.person, c.qid, c.section, c.notes].some(v => String(v || '').toLowerCase().includes(q));
}
function renderReports(view, f) {
  const filt = R_FILTERS.find(x => x[0] === f) || R_FILTERS[0];
  const all = sortRecent(readCases());
  view.innerHTML =
    '<div class="page-head"><div><p class="eyebrow">بوابة المفتش</p><h1>تقاريري</h1></div><a class="btn primary" href="#new">' + icon('plus') + 'محضر جديد</a></div>' +
    '<nav class="filters" aria-label="تصفية حسب الحالة">' + R_FILTERS.map(x =>
      '<a href="#reports-' + x[0] + '"' + (x === filt ? ' aria-current="true"' : '') + '>' + x[1] + ' <span class="count">(' + all.filter(x[2]).length + ')</span></a>').join('') + '</nav>' +
    '<div class="search"><label class="sr-only" for="q">بحث في المحاضر</label>' + icon('search') + '<input id="q" type="search" data-search="reports" placeholder="بحث برقم المحضر أو الموقع أو المخالف" autocomplete="off"></div>' +
    '<div id="reportList" aria-live="polite"></div>';
  view.dataset.filter = filt[0];
  fillReportList();
  return 'تقاريري';
}
function fillReportList() {
  const filt = R_FILTERS.find(x => x[0] === $('#view').dataset.filter) || R_FILTERS[0];
  const q = ($('#q') || {}).value || '';
  const list = sortRecent(readCases()).filter(filt[2]).filter(c => matchQuery(c, q.trim()));
  $('#reportList').innerHTML = list.length ? '<div class="cards grid-2">' + list.map(c => reportCard(c)).join('') + '</div>'
    : emptyState(q ? 'لا توجد نتائج مطابقة للبحث.' : 'لا توجد محاضر في هذه القائمة.');
}

/* ------------------------------------------------------------------ *
 * Inspector — read-only view
 * ------------------------------------------------------------------ */
function renderInspectorView(view, id) {
  const c = getCase(id);
  if (!c) { view.innerHTML = notFound('#reports'); return 'غير موجود'; }
  const s = detailSections(c);
  const ret = latestReturn(c);
  let banner = '';
  if (c.status === 'returned') banner = '<div class="msg warn" style="margin-bottom:14px">' + icon('alert') + '<div><strong>أعادت الإدارة هذا المحضر للتعديل</strong>' + esc(ret ? ret.text : '') + '<div style="margin-top:10px"><a class="btn primary" href="#edit-' + enc(c.id) + '">' + icon('edit') + 'فتح وتعديل ثم إعادة التسليم</a></div></div></div>';
  else if (c.status === 'approved') banner = '<div class="msg ok" style="margin-bottom:14px">' + icon('check') + '<div><strong>محضر معتمد — للقراءة فقط</strong>لا يمكن تعديل المحضر بعد اعتماده.</div></div>';
  else if (PENDING.includes(c.status)) banner = '<div class="msg info" style="margin-bottom:14px">' + icon('info') + '<div><strong>المحضر قيد المراجعة</strong>لا يمكن التعديل أثناء المراجعة. سيظهر هنا أي إرجاع أو اعتماد. (المراجعة تجريبية على هذا الجهاز ولم يُرسل المحضر إلى الوزارة.)</div></div>';
  else if (c.status === 'draft') banner = '<div class="msg info" style="margin-bottom:14px">' + icon('device') + '<div><strong>مسودة محفوظة محلياً</strong><a class="btn primary" style="margin-top:8px" href="#edit-' + enc(c.id) + '">متابعة التحرير</a></div></div>';
  view.innerHTML =
    '<div class="page-head"><div><a class="back-link" href="#reports">' + icon('prev') + 'العودة إلى تقاريري</a><h1>محضر ' + ltr(c.id) + '</h1></div>' +
    '<div class="btn-row">' + printButton(c.id) + '</div></div>' +
    banner +
    '<div class="stack">' + s.info + s.viol + s.off + s.ev + s.rets + s.hist + '</div>';
  return 'محضر ' + c.id;
}

/* ------------------------------------------------------------------ *
 * Inspector — report wizard
 * ------------------------------------------------------------------ */
let W = null;

function blankData() {
  const p = getProfile();
  return {
    date: todayISO(), time: nowTime(), inspectorName: p.name || '', inspectorNo: p.no || '',
    place: '', lat: null, lng: null, accuracy: null, locSource: null, locAt: null,
    violationNos: [], chips: [], notes: '', photos: [],
    offenderType: 'person', person: '', qid: '', phone: '', address: '', section: '', settlement: '', signature: 'unspecified',
    offenderSig: '', inspectorSig: ''
  };
}
function dataFromCase(c) {
  const d = blankData();
  Object.keys(d).forEach(k => { if (c[k] !== undefined) d[k] = clone(c[k]); });
  if (!d.date) d.date = todayISO();
  return d;
}
function needsChips() { return W.d.violationNos.some(n => CHIP_REQUIRED.includes(n)); }

function renderWizard(view, id) {
  let rec = null;
  if (id) {
    rec = getCase(id);
    if (!rec) { view.innerHTML = notFound('#reports'); return 'غير موجود'; }
    if (!EDITABLE.includes(rec.status)) { location.replace('#view-' + enc(id)); return 'محضر'; }
  }
  const d = rec ? dataFromCase(rec) : blankData();
  W = {
    id: rec ? rec.id : null, status: rec ? rec.status : 'draft', step: 1, d,
    raw: { lat: d.lat != null ? String(d.lat) : '', lng: d.lng != null ? String(d.lng) : '' },
    saveTimer: null, map: null, marker: null, busy: false, maxStep: rec ? 3 : 1, tried: false, errSteps: new Set()
  };
  if (needsChips() && !W.d.chips.length) W.d.chips = [''];
  document.body.classList.add('in-wizard');
  document.documentElement.classList.add('in-wizard');
  view.innerHTML = wizardHTML(rec);
  renderLocStatus();
  renderChips();
  renderPhotos();
  updateViolationUI();
  setSaveState(rec ? 'saved' : 'idle', rec ? rec.updatedAt : null);
  setStep(1, true);
  return rec ? 'تعديل محضر ' + rec.id : 'محضر جديد';
}

function wizardHTML(rec) {
  const d = W.d;
  const ret = rec && rec.status === 'returned' ? latestReturn(rec) : null;
  const older = rec ? rec.returnComments.slice(0, -1) : [];
  /* Camel chip numbers sit directly under the grazing violations (1–4) that require them. */
  const chipBox = '<div class="chip-box" id="chipBox" hidden>' +
      '<div class="card-head" style="margin-bottom:6px"><h3 id="chipH">' + icon('chip') + ' أرقام شرائح الإبل <span class="req">*</span></h3></div>' +
      '<p class="hint" style="margin:0 0 10px">مطلوبة لمخالفات الرعي (البنود 1–4). أضف رقماً لكل شريحة.</p>' +
      '<div id="chipList" role="group" aria-labelledby="chipH"></div>' +
      '<button class="btn secondary block" type="button" data-action="add-chip">' + icon('plus') + 'إضافة رقم شريحة</button>' +
    '</div>';
  const vgroups = Object.keys(CATS).map(cat => {
    const items = VIOLATIONS.filter(v => v.cat === cat);
    return '<p class="vgroup-title" aria-hidden="true">' + CATS[cat] + '</p>' + items.map(v =>
      '<label class="vcard" for="v' + v.no + '">' +
        '<input type="checkbox" id="v' + v.no + '" data-v="' + v.no + '"' + (d.violationNos.includes(v.no) ? ' checked' : '') + ' aria-describedby="vt' + v.no + '">' +
        '<span class="vnum" aria-hidden="true">' + v.no + '</span>' +
        '<span class="vbody"><span class="vtag">البند ' + v.no + ' · ' + CATS[v.cat] + '</span><span class="vtext" id="vt' + v.no + '">' + esc(v.text) + '</span></span>' +
        '<span class="vcheck" aria-hidden="true">' + icon('check') + '</span>' +
      '</label>').join('') + (cat === 'grazing' ? chipBox : '');
  }).join('');
  const legacyNote = rec && rec.legacyViolations.length ? '<div class="msg warn" style="margin-bottom:12px">' + icon('alert') + '<div><strong>بنود من نسخة سابقة</strong>كان هذا المحضر يتضمن: ' + esc(rec.legacyViolations.join('، ')) + '. يرجى اختيار البنود الرسمية المطابقة.</div></div>' : '';

  return '<div id="wizard">' +
  '<div class="wiz-head">' +
    '<div class="row"><div><p class="eyebrow">' + (rec ? (rec.status === 'returned' ? 'تعديل محضر معاد' : 'متابعة مسودة') + ' · ' + ltr(rec.id) : 'محضر ضبط جديد') + '</p>' +
    '<h1 id="wizTitle">' + (rec ? 'تعديل المحضر' : 'محضر جديد') + '</h1></div>' +
    '<a class="btn ghost sm" href="#home">حفظ والخروج</a></div>' +
    '<div class="row"><span id="saveState" class="save-state" role="status" aria-live="polite"></span></div>' +
  '</div>' +
  (ret ? '<div class="msg warn returned-banner">' + icon('alert') + '<div><strong>سبب الإرجاع من الإدارة</strong>' + esc(ret.text) +
    '<div class="hint" style="color:inherit">' + fmtDateTime(ret.at) + '</div>' +
    (older.length ? '<details class="prev-comments"><summary>ملاحظات إرجاع سابقة (' + older.length + ')</summary><ul>' + older.map(r => '<li>' + esc(r.text) + ' <span class="muted">— ' + fmtDateTime(r.at) + '</span></li>').join('') + '</ul></details>' : '') +
  '</div></div>' : '') +
  '<nav class="stepper" aria-label="خطوات المحضر">' +
    '<div class="stepper-compact"><span class="now" id="stepNow">الخطوة 1 من 3</span><span class="name" id="stepName">' + STEPS[0] + '</span></div>' +
    '<ol class="step-pills">' + STEPS.map((s, i) => '<li><button type="button" data-action="go-step" data-step="' + (i + 1) + '"><span class="n">' + (i + 1) + '</span><span class="lbl-long">' + s + '</span><span class="lbl-short">' + STEPS_SHORT[i] + '</span></button></li>').join('') + '</ol>' +
    '<p class="hint step-hint">يمكنك التنقل بين الخطوات بحرية؛ يتم التحقق من اكتمال البيانات عند التسليم.</p>' +
  '</nav>' +

  /* ---------- STEP 1 ---------- */
  '<section class="panel" id="panel1" aria-labelledby="ph1">' +
    '<h2 class="sr-only" id="ph1" tabindex="-1">الخطوة 1: الموقع والزمان</h2>' +
    '<div id="err1"></div>' +
    '<div class="card">' +
      '<h3 style="margin-bottom:12px">زمان الضبط</h3>' +
      '<div class="grid2">' +
        '<div class="field"><label for="f-date">تاريخ الضبط <span class="req">*</span></label><input id="f-date" type="date" data-f="date" value="' + esc(d.date) + '" max="' + todayISO() + '" required></div>' +
        '<div class="field"><label for="f-time">الساعة <span class="req">*</span></label><input id="f-time" type="time" data-f="time" value="' + esc(d.time) + '" required></div>' +
        '<div class="field"><label for="f-iname">اسم المفتش <span class="opt">(يُحفظ لهذا الجهاز)</span></label><input id="f-iname" type="text" data-f="inspectorName" value="' + esc(d.inspectorName) + '" autocomplete="name"></div>' +
        '<div class="field"><label for="f-ino">الرقم الوظيفي <span class="opt">(اختياري)</span></label><input id="f-ino" type="text" class="num-input" inputmode="numeric" data-f="inspectorNo" value="' + esc(d.inspectorNo) + '" autocomplete="off"></div>' +
      '</div>' +
    '</div>' +
    '<div class="card" id="locCard">' +
      '<div class="card-head"><h3 id="locH">موقع المخالفة <span class="req">*</span></h3><span id="locBadge"></span></div>' +
      '<button class="btn primary lg loc-btn" type="button" id="locBtn" data-action="locate">' + icon('locate') + '<span>استخدام موقعي</span></button>' +
      '<div id="locMsg" role="status" aria-live="polite"></div>' +
      '<div class="coord-grid">' +
        '<div class="field"><label for="f-lat">خط العرض (Latitude)</label><input id="f-lat" type="text" class="num-input" inputmode="decimal" data-f="lat" value="' + esc(W.raw.lat) + '" placeholder="25.285447" autocomplete="off" spellcheck="false"></div>' +
        '<div class="field"><label for="f-lng">خط الطول (Longitude)</label><input id="f-lng" type="text" class="num-input" inputmode="decimal" data-f="lng" value="' + esc(W.raw.lng) + '" placeholder="51.531040" autocomplete="off" spellcheck="false"></div>' +
        '<div class="field acc"><label for="f-acc">الدقة (متر)</label><input id="f-acc" type="text" class="num-input" readonly value="' + (d.accuracy != null ? '±' + Math.round(d.accuracy) : '') + '" placeholder="تُعبأ تلقائياً من GPS" aria-describedby="accHint"><p class="hint" id="accHint">تُحدَّد تلقائياً عند استخدام موقع الجهاز.</p></div>' +
      '</div>' +
      '<div class="loc-actions">' +
        (EMBEDDED ? '' : '<button class="btn secondary" type="button" data-action="open-map" id="mapBtn">' + icon('map') + 'تحديد على الخريطة</button>') +
        '<button class="btn ghost" type="button" data-action="clear-loc">' + icon('close') + 'مسح الإحداثيات</button>' +
      '</div>' +
      '<div class="map-box" id="mapBox" hidden><div class="map" id="map" role="application" aria-label="خريطة لتحديد موقع المخالفة"></div><p class="map-hint" id="mapHint">اضغط على الخريطة لوضع علامة موقع المخالفة. موقع الخريطة الافتراضي لا يُعتبر موقعاً محدداً.</p></div>' +
      '<div class="field" style="margin-top:14px"><label for="f-place">وصف الموقع</label><textarea id="f-place" data-f="place" rows="2" placeholder="مثال: منطقة الخريب – شمال الطريق الرئيسي بنحو 2 كم">' + esc(d.place) + '</textarea><p class="hint">مطلوب إذا تعذر تحديد الإحداثيات.</p></div>' +
    '</div>' +
  '</section>' +

  /* ---------- STEP 2 ---------- */
  '<section class="panel" id="panel2" aria-labelledby="ph2" hidden>' +
    '<h2 class="sr-only" id="ph2" tabindex="-1">الخطوة 2: المخالفات والأدلة</h2>' +
    '<div id="err2"></div>' +
    '<div class="card">' +
      '<div class="v-toolbar"><h3 id="vH">المخالفات المضبوطة <span class="req">*</span></h3><span class="v-count" id="vCount" aria-live="polite"></span></div>' +
      '<p class="hint" style="margin:-4px 0 12px">اضغط على البطاقة لاختيار المخالفة أو إلغاء اختيارها. يمكن اختيار أكثر من مخالفة.</p>' +
      legacyNote +
      '<div class="vlist" role="group" aria-labelledby="vH" id="vList" tabindex="-1">' + vgroups + '</div>' +
      '<div class="field" style="margin-top:16px"><label for="f-notes">شرح المخالفة</label><textarea id="f-notes" data-f="notes" rows="4" placeholder="وصف الواقعة كما شوهدت في الموقع">' + esc(d.notes) + '</textarea></div>' +
      '<details class="legal"><summary>' + icon('scale') + 'الإطار القانوني والعقوبات المقررة (للاطلاع فقط)</summary><div class="body">' +
        '<div class="legal-note" style="margin-bottom:10px">' + icon('info') + '<span>' + LEGAL_NOTE + '</span></div>' +
        '<p class="label">محضر ضبط مخالفة بموجب أحكام:</p><ul>' + LAWS.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>' +
        Object.values(PENALTIES).map(p => '<div class="pen"><b>' + p.range + '</b>' + esc(p.text) + '</div>').join('') +
      '</div></details>' +
    '</div>' +
    '<div class="card" id="evCard">' +
      '<div class="card-head"><h3 id="evH">الأدلة والصور</h3><span class="counter" id="photoCount">0 / ' + MAX_PHOTOS + '</span></div>' +
      '<p class="hint" style="margin:-4px 0 12px">حتى ' + MAX_PHOTOS + ' صور، بحد أقصى 10 م.ب للصورة الواحدة. الصيغ المقبولة: JPG وPNG وWEBP. تُحفظ نسخة عرض مصغّرة فقط.</p>' +
      '<div class="photo-actions">' +
        '<button class="btn primary lg" type="button" data-action="pick" data-target="camInput" id="camBtn">' + icon('camera', 'ic-lg') + 'التقاط صورة</button>' +
        '<button class="btn secondary lg" type="button" data-action="pick" data-target="fileInput" id="fileBtn">' + icon('image', 'ic-lg') + 'اختيار من الجهاز</button>' +
      '</div>' +
      '<input type="file" id="camInput" accept="image/*" capture="environment" data-photo-input hidden tabindex="-1">' +
      '<input type="file" id="fileInput" accept="image/jpeg,image/png,image/webp" multiple data-photo-input hidden tabindex="-1">' +
      '<div class="busy" id="photoBusy" hidden><span class="spinner" aria-hidden="true"></span><span>جارٍ تجهيز الصور…</span></div>' +
      '<div id="photoMsg" aria-live="assertive"></div>' +
      '<ul class="photo-list" id="photoList" aria-label="الصور المرفقة"></ul>' +
    '</div>' +
  '</section>' +

  /* ---------- STEP 3 ---------- */
  '<section class="panel" id="panel3" aria-labelledby="ph3" hidden>' +
    '<h2 class="sr-only" id="ph3" tabindex="-1">الخطوة 3: بيانات المخالف والمراجعة</h2>' +
    '<div id="err3"></div>' +
    '<div class="card">' +
      '<h3 style="margin-bottom:12px">بيانات المخالف</h3>' +
      '<div class="grid2">' +
        '<div class="field"><label for="f-person">اسم المخالف <span class="req">*</span></label><input id="f-person" type="text" data-f="person" value="' + esc(d.person) + '" autocomplete="off"></div>' +
        '<div class="field"><label for="f-qid">رقم البطاقة الشخصية</label><input id="f-qid" type="text" class="num-input" inputmode="numeric" data-f="qid" value="' + esc(d.qid) + '" autocomplete="off" spellcheck="false"></div>' +
        '<div class="field"><label for="f-phone">الهاتف <span class="opt">(اختياري)</span></label><input id="f-phone" type="tel" class="num-input" inputmode="tel" data-f="phone" value="' + esc(d.phone) + '" placeholder="+974 5000 0000" autocomplete="off"></div>' +
        '<div class="field"><label for="f-section">القسم <span class="opt">(اختياري)</span></label><input id="f-section" type="text" data-f="section" value="' + esc(d.section) + '" placeholder="مثال: الشمال"></div>' +
      '</div>' +
      '<div class="field"><label for="f-address">العنوان <span class="opt">(اختياري)</span></label><textarea id="f-address" data-f="address" rows="2">' + esc(d.address) + '</textarea></div>' +
      '<div class="field"><label for="f-settle">عرض الصلح <span class="opt">(اختياري)</span></label><select id="f-settle" data-f="settlement">' +
        Object.entries(SETTLEMENT).map(([k, v]) => '<option value="' + k + '"' + (d.settlement === k ? ' selected' : '') + '>' + v + '</option>').join('') +
      '</select></div>' +
    '</div>' +
    '<div class="card" id="sigCard">' +
      '<h3 style="margin-bottom:12px">التوقيعات</h3>' +
      '<fieldset class="field"><legend>حالة توقيع المخالف</legend><div class="opts">' +
        Object.entries(SIGNATURE).map(([k, v]) => '<label class="opt-card"><input type="radio" name="signature" data-f="signature" value="' + k + '"' + (d.signature === k ? ' checked' : '') + ' aria-describedby="signNote"><span class="radio" aria-hidden="true"></span>' + v + '</label>').join('') +
      '</div><p class="hint" id="signNote">' + SIGN_NOTE + '</p></fieldset>' +
      '<div id="offSigBox"' + (d.signature === 'signed' ? '' : ' hidden') + '>' + sigPadHTML('offenderSig', 'توقيع المخالف', true) + '</div>' +
      '<div id="refusedNote" class="msg warn"' + (d.signature === 'refused' ? '' : ' hidden') + '>' + icon('info') + '<div>سُجّل رفض المخالف للتوقيع. لا حاجة لتوقيع المخالف، ويُكتفى بتوقيع المفتش.</div></div>' +
      '<hr class="divider">' +
      sigPadHTML('inspectorSig', 'توقيع المفتش', true) +
    '</div>' +
    '<div class="card" id="reviewBox" aria-live="off"></div>' +
    '<div class="legal-note" style="margin-top:14px">' + icon('info') + '<span>' + LEGAL_NOTE + ' التسليم هنا ينقل المحضر إلى قائمة المراجعة على هذا الجهاز فقط ولا يرسله إلى الوزارة.</span></div>' +
  '</section>' +

  '<div class="action-bar" role="group" aria-label="التنقل بين خطوات المحضر">' +
    '<button class="btn secondary prev" type="button" data-action="prev" id="prevBtn">' + icon('prev') + 'السابق</button>' +
    '<span class="spacer"></span>' +
    '<button class="btn primary grow" type="button" data-action="next" id="nextBtn">التالي' + icon('next') + '</button>' +
    '<button class="btn success grow" type="button" data-action="submit" id="submitBtn" hidden>' + icon('check') + (rec && rec.status === 'returned' ? 'إعادة التسليم للمراجعة' : 'تسليم للمراجعة') + '</button>' +
  '</div>' +
  '</div>';
}

function setStep(n, initial) {
  W.step = n;
  W.maxStep = Math.max(W.maxStep, n);
  [1, 2, 3].forEach(i => { $('#panel' + i).hidden = i !== n; });
  $('#stepNow').textContent = 'الخطوة ' + n + ' من 3';
  $('#stepName').textContent = STEPS[n - 1];
  $$('.step-pills button').forEach((b, i) => {
    if (i + 1 === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    const bad = W.tried && W.errSteps.has(i + 1);
    b.classList.toggle('has-err', bad);
    b.setAttribute('aria-label', 'الخطوة ' + (i + 1) + ': ' + STEPS[i] + (bad ? ' (بيانات ناقصة)' : ''));
  });
  $('#prevBtn').hidden = n === 1;
  $('#nextBtn').hidden = n === 3;
  $('#submitBtn').hidden = n !== 3;
  if (n === 3) { renderReview(); setTimeout(mountPads, 0); }
  if (n === 1 && W.map) setTimeout(() => W && W.map && W.map.invalidateSize(), 60);
  if (!initial) {
    window.scrollTo(0, 0);
    const h = $('#ph' + n);
    if (h) h.focus({ preventScroll: true });
  }
}

/* ---------- save state ---------- */
function setSaveState(state, at) {
  const el = $('#saveState');
  if (!el) return;
  el.className = 'save-state' + (state === 'saved' ? ' saved' : state === 'error' ? ' error' : '');
  if (state === 'saved') {
    const t = at ? new Date(at) : new Date();
    el.innerHTML = icon('device') + 'تم الحفظ محلياً · ' + ltr(pad(t.getHours()) + ':' + pad(t.getMinutes())) + '<span class="sr-only"> — لم يتم الإرسال إلى الوزارة</span>';
  } else if (state === 'pending') el.innerHTML = icon('device') + 'جارٍ الحفظ محلياً…';
  else if (state === 'error') el.innerHTML = icon('alert') + (at || 'تعذر الحفظ محلياً');
  else el.innerHTML = icon('device') + 'يُحفظ تلقائياً على هذا الجهاز عند الإدخال';
}
function scheduleSave() {
  if (!W) return;
  setSaveState('pending');
  clearTimeout(W.saveTimer);
  W.saveTimer = setTimeout(saveNow, 600);
}
function serialize(d) {
  const lat = parseNum(W.raw.lat), lng = parseNum(W.raw.lng);
  const okCoords = validLat(lat) && validLng(lng);
  return {
    date: d.date, time: d.time, inspectorName: d.inspectorName.trim(), inspectorNo: latinDigits(d.inspectorNo).trim(),
    place: d.place, lat: okCoords ? lat : null, lng: okCoords ? lng : null,
    accuracy: okCoords ? d.accuracy : null, locSource: okCoords ? (d.locSource || 'manual') : null, locAt: okCoords ? d.locAt : null,
    section: d.section, violationNos: d.violationNos.slice().sort((a, b) => a - b),
    violations: d.violationNos.slice().sort((a, b) => a - b).map(n => VBY[n].text),
    chips: needsChips() ? d.chips.map(x => latinDigits(x).trim()).filter(Boolean) : [],
    notes: d.notes, photos: d.photos,
    offenderType: 'person', person: d.person.trim(), qid: latinDigits(d.qid).trim(), phone: latinDigits(d.phone).trim(),
    address: d.address, settlement: d.settlement, signature: d.signature,
    offenderSig: d.signature === 'signed' ? d.offenderSig : '', inspectorSig: d.inspectorSig
  };
}
function isEmptyDraft(d) {
  return !(d.place.trim() || W.raw.lat.trim() || W.raw.lng.trim() || d.violationNos.length || d.notes.trim() || d.photos.length ||
    d.person.trim() || d.qid.trim() || d.phone.trim() || d.address.trim() || d.section.trim());
}
function saveNow() {
  if (!W) return true;
  clearTimeout(W.saveTimer); W.saveTimer = null;
  const existing = W.id ? getCase(W.id) : null;
  if (existing && !EDITABLE.includes(existing.status)) {
    setSaveState('error', 'لا يمكن الحفظ: تغيرت حالة المحضر إلى «' + STATUS[existing.status].label + '»');
    return false;
  }
  if (!existing && isEmptyDraft(W.d)) { setSaveState('idle'); return true; }
  const now = new Date().toISOString();
  const base = existing ? clone(existing) : {
    id: newId(), status: 'draft', createdAt: now, managerNote: '', returnComments: [],
    history: [{ action: 'created', at: now, by: W.d.inspectorName.trim() || 'المفتش' }]
  };
  delete base.legacyViolations;
  const out = Object.assign(base, serialize(W.d), { updatedAt: now });
  try { upsertCase(normalize(out)); }
  catch (e) {
    setSaveState('error', isQuota(e) ? 'تعذر الحفظ: مساحة التخزين المحلي ممتلئة. احذف بعض الصور أو المسودات القديمة.' : 'تعذر الحفظ محلياً');
    return false;
  }
  const isNew = !W.id;
  W.id = out.id;
  setSaveState('saved', now);
  if (isNew) {
    history.replaceState(null, '', '#edit-' + enc(out.id));
    const eb = $('#wizard .eyebrow');
    if (eb) eb.innerHTML = 'مسودة · ' + ltr(out.id);
  }
  return true;
}
function leaveWizard() {
  if (!W) return;
  Object.keys(pads).forEach(k => delete pads[k]);
  if (W.saveTimer) saveNow();
  if (W.map) { try { W.map.remove(); } catch (e) { /* ignore */ } }
  W = null;
  document.body.classList.remove('in-wizard');
  document.documentElement.classList.remove('in-wizard');
}

/* ---------- field handling ---------- */
function onWizardField(t) {
  if (t.matches('[data-f]')) {
    const f = t.dataset.f;
    if (t.type === 'radio' && !t.checked) return;
    t.removeAttribute('aria-invalid');
    if (f === 'lat' || f === 'lng') {
      W.raw[f] = t.value;
      W.d.locSource = 'manual';
      W.d.accuracy = null;
      W.d.locAt = new Date().toISOString();
      $('#f-acc').value = '';
      renderLocStatus();
      syncMarker(false);
    } else {
      W.d[f] = t.value;
    }
    if (f === 'inspectorName' || f === 'inspectorNo') {
      const p = getProfile();
      p[f === 'inspectorName' ? 'name' : 'no'] = t.value.trim();
      setProfile(p);
    }
    if (f === 'signature') {
      $('#offSigBox').hidden = t.value !== 'signed';
      $('#refusedNote').hidden = t.value !== 'refused';
      if (t.value === 'signed') mountPads();
    }
    if (f === 'place') renderLocStatus();
    scheduleSave();
    refreshValidation();
  } else if (t.matches('[data-v]')) {
    toggleViolation(Number(t.dataset.v), t.checked);
  } else if (t.matches('[data-chip]')) {
    W.d.chips[Number(t.dataset.chip)] = t.value;
    t.removeAttribute('aria-invalid');
    scheduleSave();
    refreshValidation();
  } else if (t.matches('[data-pf]')) {
    const ph = W.d.photos.find(p => p.id === t.dataset.id);
    if (!ph) return;
    if (t.type === 'radio' && !t.checked) return;
    ph[t.dataset.pf] = t.value;
    scheduleSave();
  }
}

/* ---------- signature pads (drawn with finger, stylus or mouse) ---------- */
function sigPadHTML(key, label, required) {
  return '<div class="field sig-field" id="sigf-' + key + '">' +
    '<p class="label" id="sigl-' + key + '">' + label + (required ? ' <span class="req">*</span>' : '') + '</p>' +
    '<div class="sig-pad" id="sigbox-' + key + '">' +
      '<canvas id="pad-' + key + '" data-pad="' + key + '" tabindex="0" role="img" aria-labelledby="sigl-' + key + '" aria-describedby="sigh-' + key + '"></canvas>' +
      '<span class="sig-ph" aria-hidden="true">وقّع هنا بإصبعك أو بالقلم</span>' +
      '<span class="sig-line" aria-hidden="true"></span>' +
    '</div>' +
    '<div class="sig-actions"><span class="sig-state" id="sigs-' + key + '" aria-live="polite"></span>' +
    '<button class="btn ghost sm" type="button" data-action="clear-sig" data-key="' + key + '">' + icon('close') + 'مسح التوقيع</button></div>' +
    '<p class="hint" id="sigh-' + key + '">ارسم التوقيع داخل الإطار. يُحفظ التوقيع على هذا الجهاز مع المحضر.</p>' +
  '</div>';
}
const pads = {};
function mountPads() {
  if (!W) return;
  $$('canvas[data-pad]').forEach(cv => {
    if (!cv.offsetWidth) return;
    const key = cv.dataset.pad;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = cv.offsetWidth, h = cv.offsetHeight;
    if (pads[key] && pads[key].cv === cv && pads[key].w === w && pads[key].h === h) return;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1E1A1B';
    pads[key] = { cv, ctx, w, h, drawing: false, last: null, dirty: false };
    const src = W.d[key];
    if (src) {
      const im = new Image();
      im.onload = () => { const r = Math.min(w / im.width, h / im.height); ctx.drawImage(im, (w - im.width * r) / 2, (h - im.height * r) / 2, im.width * r, im.height * r); };
      im.src = src;
    }
    if (!cv.dataset.bound) {
      cv.dataset.bound = '1';
      const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      cv.addEventListener('pointerdown', e => {
        const pd = pads[key]; if (!pd) return;
        e.preventDefault();
        cv.setPointerCapture(e.pointerId);
        pd.drawing = true; pd.last = pos(e);
        pd.ctx.beginPath(); pd.ctx.arc(pd.last.x, pd.last.y, 1.2, 0, Math.PI * 2); pd.ctx.fillStyle = '#1E1A1B'; pd.ctx.fill();
        pd.dirty = true;
        $('#sigbox-' + key).classList.add('has-ink');
      });
      cv.addEventListener('pointermove', e => {
        const pd = pads[key]; if (!pd || !pd.drawing) return;
        e.preventDefault();
        const pts = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        pts.forEach(pe => { const p2 = pos(pe); pd.ctx.beginPath(); pd.ctx.moveTo(pd.last.x, pd.last.y); pd.ctx.lineTo(p2.x, p2.y); pd.ctx.stroke(); pd.last = p2; });
      });
      const end = () => { const pd = pads[key]; if (!pd || !pd.drawing) return; pd.drawing = false; commitSig(key); };
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', end);
      cv.addEventListener('lostpointercapture', end);
    }
    updateSigState(key);
  });
}
function commitSig(key) {
  const pd = pads[key];
  if (!pd || !W) return;
  // Export at a fixed, compact size with a transparent background.
  const out = document.createElement('canvas');
  out.width = 600; out.height = Math.round(600 * pd.h / pd.w);
  out.getContext('2d').drawImage(pd.cv, 0, 0, out.width, out.height);
  W.d[key] = out.toDataURL('image/png');
  updateSigState(key);
  $('#sigf-' + key).querySelector('.sig-pad').removeAttribute('aria-invalid');
  scheduleSave();
  refreshValidation();
}
function clearSig(key) {
  if (!W) return;
  W.d[key] = '';
  const pd = pads[key];
  if (pd) { pd.ctx.save(); pd.ctx.setTransform(1, 0, 0, 1, 0, 0); pd.ctx.clearRect(0, 0, pd.cv.width, pd.cv.height); pd.ctx.restore(); }
  updateSigState(key);
  scheduleSave();
  refreshValidation();
}
function updateSigState(key) {
  const has = !!(W && W.d[key]);
  const box = $('#sigbox-' + key);
  if (box) box.classList.toggle('has-ink', has);
  const st = $('#sigs-' + key);
  if (st) st.innerHTML = has ? '<span class="badge b-ok">تم التوقيع</span>' : '<span class="badge b-warn">لم يتم التوقيع</span>';
  const cv = $('#pad-' + key);
  if (cv) cv.setAttribute('aria-label', (key === 'offenderSig' ? 'توقيع المخالف' : 'توقيع المفتش') + (has ? ': تم التوقيع' : ': لم يتم التوقيع بعد'));
}
window.addEventListener('resize', () => { if (W && W.step === 3) { Object.keys(pads).forEach(k => delete pads[k]); mountPads(); } });

/* ---------- violations & chip numbers ---------- */
function toggleViolation(no, on) {
  setTimeout(refreshValidation, 0);
  const set = new Set(W.d.violationNos);
  if (on) set.add(no); else set.delete(no);
  W.d.violationNos = Array.from(set).sort((a, b) => a - b);
  updateViolationUI();
  if (needsChips()) {
    if (!W.d.chips.length) { W.d.chips = ['']; renderChips(); }
  } else if (W.d.chips.length) {
    const had = W.d.chips.some(x => String(x).trim());
    W.d.chips = [];
    renderChips();
    if (had) toast('أُزيلت أرقام شرائح الإبل لعدم اختيار أي من مخالفات الرعي (1–4).', 'info');
  }
  scheduleSave();
}
function updateViolationUI() {
  const n = W.d.violationNos.length;
  $$('#vList .vcard').forEach(l => { const i = $('input', l); l.classList.toggle('on', i.checked); });
  $('#vCount').textContent = n ? 'تم اختيار ' + n + (n === 1 ? ' مخالفة' : ' مخالفات') : 'لم يتم الاختيار';
  $('#chipBox').hidden = !needsChips();
  $('#vList').removeAttribute('aria-invalid');
}
function renderChips() {
  const box = $('#chipList');
  if (!box) return;
  box.innerHTML = W.d.chips.map((v, i) =>
    '<div class="chip-row"><label class="sr-only" for="chip' + i + '">رقم الشريحة ' + (i + 1) + '</label>' +
    '<input id="chip' + i + '" type="text" class="num-input" inputmode="numeric" data-chip="' + i + '" value="' + esc(v) + '" placeholder="مثال: 634097400062064" autocomplete="off" spellcheck="false">' +
    '<button class="icon-btn danger" type="button" data-action="del-chip" data-i="' + i + '" aria-label="حذف رقم الشريحة ' + (i + 1) + '">' + icon('trash') + '</button></div>').join('');
}

/* ---------- location ---------- */
function currentCoords() {
  const lat = parseNum(W.raw.lat), lng = parseNum(W.raw.lng);
  return { lat, lng, ok: validLat(lat) && validLng(lng) };
}
function renderLocStatus() {
  const c = currentCoords();
  const b = $('#locBadge');
  if (c.ok) {
    b.innerHTML = '<span class="badge b-ok">تم تحديد الموقع · ' + esc(LOC_SOURCE[W.d.locSource] || 'إدخال يدوي') + '</span>';
  } else if (W.d.place.trim()) {
    b.innerHTML = '<span class="badge b-neutral">وصف نصي فقط</span>';
  } else {
    b.innerHTML = '<span class="badge b-warn">لم يتم تحديد الموقع</span>';
  }
}
function locMsg(kind, html) {
  const el = $('#locMsg');
  if (!el) return;
  el.innerHTML = html ? '<div class="msg ' + kind + '">' + icon(kind === 'ok' ? 'check' : kind === 'info' ? 'info' : 'alert') + '<div>' + html + '</div></div>' : '';
}
function setLocation(lat, lng, acc, src) {
  W.raw.lat = lat.toFixed(6);
  W.raw.lng = lng.toFixed(6);
  W.d.accuracy = acc != null ? Math.round(acc) : null;
  W.d.locSource = src;
  W.d.locAt = new Date().toISOString();
  $('#f-lat').value = W.raw.lat;
  $('#f-lng').value = W.raw.lng;
  $('#f-lat').removeAttribute('aria-invalid');
  $('#f-lng').removeAttribute('aria-invalid');
  $('#f-acc').value = W.d.accuracy != null ? '±' + W.d.accuracy : '';
  renderLocStatus();
  syncMarker(src !== 'map');
  scheduleSave();
  refreshValidation();
}
function useMyLocation() {
  const btn = $('#locBtn');
  if (!('geolocation' in navigator)) {
    locMsg('bad', '<strong>تحديد الموقع غير متاح</strong>هذا الجهاز أو المتصفح لا يدعم خدمة تحديد الموقع. أدخل الإحداثيات يدوياً، أو حدد النقطة على الخريطة، أو اكتب وصفاً للموقع.');
    return;
  }
  if (window.isSecureContext === false) {
    locMsg('bad', '<strong>تحديد الموقع غير متاح في هذه الصفحة</strong>يتطلب المتصفح فتح التطبيق عبر اتصال آمن (https) أو كملف محلي. أدخل الإحداثيات يدوياً أو اكتب وصف الموقع.');
    return;
  }
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  btn.querySelector('span').textContent = 'جارٍ تحديد الموقع…';
  locMsg('info', 'جارٍ الحصول على موقعك من GPS… قد يستغرق ذلك حتى 20 ثانية. يُفضّل الوقوف في مكان مكشوف.');
  const wizard = W;
  const done = ok => {
    if (W !== wizard) return false;
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    btn.querySelector('span').textContent = ok ? 'تحديث موقعي' : 'استخدام موقعي';
    return true;
  };
  navigator.geolocation.getCurrentPosition(pos => {
    if (!done(true)) return;
    const { latitude, longitude, accuracy } = pos.coords;
    setLocation(latitude, longitude, accuracy, 'gps');
    const acc = Math.round(accuracy);
    if (acc > 100) locMsg('warn', '<strong>تم تحديد الموقع بدقة منخفضة (±' + acc + ' م)</strong>يمكنك إعادة المحاولة في مكان مكشوف، أو تعديل النقطة على الخريطة.');
    else locMsg('ok', 'تم تحديد موقعك بدقة تقارب ±' + acc + ' متر.');
    if (!inQatar(latitude, longitude)) locMsg('warn', '<strong>الموقع خارج حدود دولة قطر</strong>تحقق من صحة الموقع قبل المتابعة.');
  }, err => {
    if (!done(false)) return;
    if (EMBEDDED && err.code === 1) {
      // Device location is blocked by the hosting viewer itself, not by the inspector's settings.
      locMsg('info', '<strong>تحديد الموقع التلقائي غير متاح في نسخة العرض هذه</strong>أدخل خط العرض وخط الطول يدوياً (يمكن نسخهما من تطبيق الخرائط في الهاتف)، أو اكتب وصفاً للموقع. يعمل GPS عند فتح ملف التطبيق مباشرة في المتصفح.');
      const lat = $('#f-lat'); if (lat && !lat.value) lat.focus();
      return;
    }
    const M = {
      1: '<strong>تم رفض إذن الوصول إلى الموقع</strong>فعّل إذن الموقع لهذا المتصفح من إعدادات الجهاز ثم اضغط «استخدام موقعي» مرة أخرى، أو أدخل الإحداثيات يدوياً.',
      2: '<strong>تعذر تحديد الموقع حالياً</strong>إشارة GPS غير متوفرة. تأكد من تفعيل خدمة الموقع في الجهاز، أو انتقل إلى مكان مكشوف، أو أدخل الإحداثيات يدوياً.',
      3: '<strong>انتهت مهلة تحديد الموقع</strong>لم تصل إشارة GPS في الوقت المحدد. أعد المحاولة، أو أدخل الإحداثيات يدوياً، أو حدد النقطة على الخريطة.'
    };
    locMsg('bad', M[err.code] || '<strong>تعذر تحديد الموقع</strong>حدث خطأ غير متوقع. أدخل الإحداثيات يدوياً أو اكتب وصف الموقع.');
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
}
function clearLocation() {
  W.raw.lat = ''; W.raw.lng = '';
  W.d.accuracy = null; W.d.locSource = null; W.d.locAt = null;
  $('#f-lat').value = ''; $('#f-lng').value = ''; $('#f-acc').value = '';
  if (W.marker) { W.marker.remove(); W.marker = null; }
  locMsg('info', 'تم مسح الإحداثيات. لم يعد هناك موقع محدد.');
  renderLocStatus();
  scheduleSave();
}
let leafletPromise = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = LEAFLET_CSS;
    document.head.appendChild(link);
    const s = document.createElement('script');
    s.src = LEAFLET_JS; s.async = true;
    const timer = setTimeout(() => reject(new Error('timeout')), 15000);
    s.onload = () => { clearTimeout(timer); window.L ? resolve() : reject(new Error('no L')); };
    s.onerror = () => { clearTimeout(timer); reject(new Error('load')); };
    document.head.appendChild(s);
  }).catch(e => { leafletPromise = null; throw e; });
  return leafletPromise;
}
function openMap() {
  const box = $('#mapBox');
  if (!box.hidden && W.map) { box.hidden = true; $('#mapBtn').lastChild.textContent = 'تحديد على الخريطة'; return; }
  box.hidden = false;
  $('#mapBtn').lastChild.textContent = 'إخفاء الخريطة';
  if (W.map) { W.map.invalidateSize(); return; }
  if (navigator.onLine === false) {
    $('#map').innerHTML = '<div class="msg warn" style="margin:12px">' + icon('alert') + '<div>الخريطة تتطلب اتصالاً بالإنترنت. يمكنك المتابعة بإدخال الإحداثيات أو وصف الموقع.</div></div>';
    $('#map').style.height = 'auto';
    return;
  }
  $('#map').innerHTML = '<div class="busy" style="padding:16px"><span class="spinner"></span>جارٍ تحميل الخريطة…</div>';
  const wizard = W;
  loadLeaflet().then(() => {
    if (W !== wizard) return;
    const el = $('#map');
    el.innerHTML = ''; el.style.height = '';
    const c = currentCoords();
    W.map = L.map(el, { zoomControl: true, attributionControl: true }).setView(c.ok ? [c.lat, c.lng] : QATAR_CENTER, c.ok ? 15 : 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(W.map);
    W.map.on('click', e => {
      setLocation(e.latlng.lat, e.latlng.lng, null, 'map');
      locMsg('ok', 'تم تحديد الموقع على الخريطة. يمكنك سحب العلامة لتعديلها.');
    });
    syncMarker(false);
  }).catch(() => {
    if (W !== wizard) return;
    $('#map').style.height = 'auto';
    $('#map').innerHTML = '<div class="msg warn" style="margin:12px">' + icon('alert') + '<div>تعذر تحميل الخريطة (يتطلب اتصالاً بالإنترنت). يمكنك المتابعة بإدخال الإحداثيات أو وصف الموقع.</div></div>';
  });
}
function syncMarker(pan) {
  if (!W || !W.map || !window.L) return;
  const c = currentCoords();
  if (!c.ok) { if (W.marker) { W.marker.remove(); W.marker = null; } return; }
  if (W.marker) W.marker.setLatLng([c.lat, c.lng]);
  else {
    W.marker = L.marker([c.lat, c.lng], { draggable: true, keyboard: true, title: 'موقع المخالفة' }).addTo(W.map);
    W.marker.on('dragend', e => { const x = e.target.getLatLng(); setLocation(x.lat, x.lng, null, 'map'); });
  }
  if (pan) W.map.setView([c.lat, c.lng], Math.max(W.map.getZoom(), 15));
}

/* ---------- photos ---------- */
const MIME_ALIASES = { 'image/jpg': 'image/jpeg', 'image/pjpeg': 'image/jpeg', 'image/x-png': 'image/png' };
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
async function sniffType(file) {
  const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
  const ascii = String.fromCharCode.apply(null, buf);
  if (ascii.slice(0, 4) === 'RIFF' && ascii.slice(8, 12) === 'WEBP') return 'image/webp';
  if (ascii.slice(4, 12).match(/ftyp(heic|heix|mif1|msf1|hevc)/)) return 'image/heic';
  return null;
}
function decodeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const timer = setTimeout(() => { URL.revokeObjectURL(url); reject(new Error('timeout')); }, 20000);
    img.onload = () => { clearTimeout(timer); URL.revokeObjectURL(url); img.naturalWidth && img.naturalHeight ? resolve(img) : reject(new Error('empty')); };
    img.onerror = () => { clearTimeout(timer); URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}
function toJpeg(img, max, q) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(img.naturalWidth * scale));
  cv.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  const out = cv.toDataURL('image/jpeg', q);
  if (!out || out.length < 100) throw new Error('canvas');
  return out;
}
async function processImage(f) {
  if (f.size === 0) throw new Error('الملف فارغ أو تالف.');
  if (f.size > MAX_BYTES) throw new Error('حجم الملف ' + fmtBytes(f.size) + ' يتجاوز الحد المسموح (10 م.ب).');
  const declared = MIME_ALIASES[f.type] || f.type;
  const actual = await sniffType(f);
  if (declared === 'image/heic' || declared === 'image/heif' || actual === 'image/heic') throw new Error('صيغة HEIC غير مدعومة في المتصفح. اختر صورة JPG أو PNG، أو اضبط الكاميرا على صيغة «الأكثر توافقاً».');
  if (declared && !ALLOWED_MIME.includes(declared)) throw new Error('نوع الملف (' + (declared || 'غير معروف') + ') غير مسموح. الصيغ المقبولة: JPG وPNG وWEBP.');
  if (!actual) throw new Error('محتوى الملف ليس صورة صالحة أو أن الملف تالف.');
  if (declared && declared !== actual) throw new Error('نوع الملف المعلن لا يطابق محتواه الفعلي.');
  let img;
  try { img = await decodeImage(f); } catch (e) { throw new Error('تعذر قراءة الصورة؛ قد يكون الملف تالفاً.'); }
  if (img.naturalWidth > MAX_DIMENSION || img.naturalHeight > MAX_DIMENSION) throw new Error('أبعاد الصورة كبيرة جداً.');
  let preview, thumb;
  try { preview = toJpeg(img, PREVIEW_MAX, 0.72); thumb = toJpeg(img, THUMB_MAX, 0.7); }
  catch (e) { throw new Error('تعذر تجهيز معاينة الصورة.'); }
  return {
    id: uid('ph_'), preview, thumb, caption: '', category: 'field',
    name: f.name || 'صورة', type: actual, origSize: f.size, w: img.naturalWidth, h: img.naturalHeight, addedAt: new Date().toISOString()
  };
}
async function addPhotos(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length || !W) return;
  const wizard = W;
  const errors = [];
  let added = 0, skipped = 0;
  W.busy = true;
  $('#photoBusy').hidden = false;
  $('#camBtn').disabled = $('#fileBtn').disabled = true;
  for (const f of files) {
    if (W !== wizard) return;
    if (W.d.photos.length >= MAX_PHOTOS) { skipped++; continue; }
    try {
      const p = await processImage(f);
      if (W !== wizard) return;
      W.d.photos.push(p);
      added++;
      renderPhotos();
    } catch (e) { errors.push('«' + (f.name || 'صورة') + '»: ' + e.message); }
  }
  if (W !== wizard) return;
  W.busy = false;
  $('#photoBusy').hidden = true;
  updatePhotoButtons();
  if (skipped) errors.push('لم تُضف ' + skipped + (skipped === 1 ? ' صورة' : ' صور') + ' لبلوغ الحد الأقصى (' + MAX_PHOTOS + ' صور).');
  $('#photoMsg').innerHTML = errors.length ? '<div class="msg bad" style="margin-top:12px">' + icon('alert') + '<div><strong>تعذر إضافة بعض الملفات</strong><ul>' + errors.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul></div></div>'
    : added ? '<p class="sr-only">تمت إضافة ' + added + ' صورة.</p>' : '';
  if (added) {
    if (!saveNow()) {
      $('#photoMsg').insertAdjacentHTML('beforeend', '<div class="msg bad" style="margin-top:12px">' + icon('alert') + '<div>تعذر حفظ الصور محلياً بسبب امتلاء مساحة التخزين. احذف بعض الصور أو المسودات القديمة.</div></div>');
    }
  }
}
function updatePhotoButtons() {
  const full = W.d.photos.length >= MAX_PHOTOS;
  $('#camBtn').disabled = $('#fileBtn').disabled = full || W.busy;
  $('#photoCount').textContent = W.d.photos.length + ' / ' + MAX_PHOTOS;
}
function renderPhotos() {
  const ul = $('#photoList');
  if (!ul) return;
  ul.innerHTML = W.d.photos.map((p, i) => {
    const n = i + 1;
    return '<li class="pcard">' +
      '<button class="pthumb" type="button" data-action="zoom" data-id="' + esc(p.id) + '" aria-label="عرض الصورة ' + n + ' بحجم أكبر"><img src="' + esc(p.thumb || p.preview) + '" alt="" decoding="async"></button>' +
        '<div class="ptop"><span class="meta"><b>صورة ' + n + '</b>' + (p.origSize ? fmtBytes(p.origSize) + ' · ' : '') + (p.w ? ltr(p.w + '×' + p.h) : 'صورة سابقة') + '</span>' +
        '<button class="icon-btn danger" type="button" data-action="del-photo" data-id="' + esc(p.id) + '" aria-label="حذف الصورة ' + n + '">' + icon('trash') + '</button></div>' +
      '<div class="pbody">' +
        '<fieldset><legend class="sr-only">تصنيف الصورة ' + n + '</legend><div class="seg">' +
          Object.entries(PHOTO_CAT).map(([k, v]) => '<label><input type="radio" name="cat-' + esc(p.id) + '" data-pf="category" data-id="' + esc(p.id) + '" value="' + k + '"' + (p.category === k ? ' checked' : '') + '>' + v + '</label>').join('') +
        '</div></fieldset>' +
        '<label class="sr-only" for="cap-' + esc(p.id) + '">وصف الصورة ' + n + '</label>' +
        '<input type="text" id="cap-' + esc(p.id) + '" data-pf="caption" data-id="' + esc(p.id) + '" value="' + esc(p.caption) + '" placeholder="وصف مختصر للصورة (اختياري)">' +
      '</div></li>';
  }).join('');
  updatePhotoButtons();
}

/* ---------- validation ---------- */
function validateStep(s) {
  const e = [];
  const d = W.d;
  if (s === 1) {
    if (!d.date) e.push({ f: 'f-date', m: 'أدخل تاريخ الضبط.' });
    else if (d.date > todayISO()) e.push({ f: 'f-date', m: 'تاريخ الضبط لا يمكن أن يكون في المستقبل.' });
    if (!d.time) e.push({ f: 'f-time', m: 'أدخل ساعة الضبط.' });
    const lat = parseNum(W.raw.lat), lng = parseNum(W.raw.lng);
    if ((lat === null) !== (lng === null)) e.push({ f: lat === null ? 'f-lat' : 'f-lng', m: 'أدخل خط العرض وخط الطول معاً، أو امسح الإحداثيات.' });
    else if (lat !== null && !validLat(lat)) e.push({ f: 'f-lat', m: 'قيمة خط العرض غير صحيحة (يجب أن تكون بين ‎-90 و 90).' });
    else if (lng !== null && !validLng(lng)) e.push({ f: 'f-lng', m: 'قيمة خط الطول غير صحيحة (يجب أن تكون بين ‎-180 و 180).' });
    else if (lat === null && !d.place.trim()) e.push({ f: 'locBtn', m: 'لم يتم تحديد موقع المخالفة. استخدم «استخدام موقعي»، أو أدخل الإحداثيات، أو اكتب وصفاً للموقع.' });
  }
  if (s === 2) {
    if (!d.violationNos.length) e.push({ f: 'vList', m: 'اختر مخالفة واحدة على الأقل.' });
    if (needsChips() && !d.chips.some(x => String(x).trim())) e.push({ f: 'chip0', m: 'أدخل رقم شريحة إبل واحداً على الأقل لمخالفات الرعي (البنود 1–4).' });
    d.chips.forEach((x, i) => { if (String(x).trim() && !/^[0-9A-Za-z\- ]{3,30}$/.test(latinDigits(x).trim())) e.push({ f: 'chip' + i, m: 'رقم الشريحة ' + (i + 1) + ' يحتوي على رموز غير صالحة.' }); });
    if (W.busy) e.push({ f: 'camBtn', m: 'انتظر حتى ينتهي تجهيز الصور.' });
  }
  if (s === 3) {
    if (!d.person.trim()) e.push({ f: 'f-person', m: 'أدخل اسم المخالف.' });
    if (d.signature === 'signed' && !d.offenderSig) e.push({ f: 'pad-offenderSig', m: 'ارسم توقيع المخالف في المكان المخصص، أو غيّر حالة التوقيع.' });
    if (!d.inspectorSig) e.push({ f: 'pad-inspectorSig', m: 'ارسم توقيع المفتش في المكان المخصص.' });
    if (d.phone.trim() && !/^\+?[0-9][0-9\s-]{5,17}$/.test(latinDigits(d.phone).trim())) e.push({ f: 'f-phone', m: 'رقم الهاتف غير صحيح.' });
  }
  return e;
}
function showErrors(step, errs, quiet) {
  $$('[aria-invalid="true"]', $('#panel' + step)).forEach(x => x.removeAttribute('aria-invalid'));
  const box = $('#err' + step);
  if (!errs.length) { box.innerHTML = ''; return; }
  errs.forEach(x => {
    let el = document.getElementById(x.f);
    if (el && el.tagName === 'CANVAS') el = el.parentNode;
    if (el && el.tagName !== 'BUTTON') el.setAttribute('aria-invalid', 'true');
  });
  box.innerHTML = '<div class="error-summary" role="alert" tabindex="-1"><h2>يرجى استكمال ما يلي:</h2><ul>' +
    errs.map(x => '<li><button type="button" data-action="focus-field" data-f="' + esc(x.f) + '">' + esc(x.m) + '</button></li>').join('') + '</ul></div>';
  if (quiet) { $('.error-summary', box).removeAttribute('role'); return; }
  const s = $('.error-summary', box);
  s.scrollIntoView({ block: 'center' });
  s.focus({ preventScroll: true });
}
/* After a failed submit, keep each step's error list and step markers current as the inspector fixes them. */
function refreshValidation() {
  if (!W || !W.tried) return;
  W.errSteps = new Set();
  [1, 2, 3].forEach(s => {
    const e = validateStep(s);
    if (e.length) W.errSteps.add(s);
    const box = $('#err' + s);
    if (!e.length) box.innerHTML = '';
    else if (box.innerHTML) showErrors(s, e, true);
  });
  $$('.step-pills button').forEach((b, i) => {
    const bad = W.errSteps.has(i + 1);
    b.classList.toggle('has-err', bad);
    b.setAttribute('aria-label', 'الخطوة ' + (i + 1) + ': ' + STEPS[i] + (bad ? ' (بيانات ناقصة)' : ''));
  });
}

/* ---------- review (step 3) ---------- */
function renderReview() {
  const d = W.d;
  const c = currentCoords();
  const sec = (title, step, body) => '<div style="padding:12px 0;border-bottom:1px solid var(--line)"><div class="review-sec-head"><h3>' + title + '</h3><button class="btn ghost sm" type="button" data-action="go-step" data-step="' + step + '">' + icon('edit') + 'تعديل</button></div>' + body + '</div>';
  $('#reviewBox').innerHTML = '<h3 style="font-size:1.1rem">مراجعة المحضر قبل التسليم</h3>' +
    sec('الموقع والزمان', 1, kvRows([
      ['التاريخ', fmtDate(d.date) + ' · ' + esc(fmtTime12(d.time))],
      ['المفتش', esc(d.inspectorName || '—')],
      ['الموقع', esc(d.place || '—')],
      ['الإحداثيات', c.ok ? ltr(c.lat.toFixed(6) + ', ' + c.lng.toFixed(6)) + (d.accuracy != null ? ' · ±' + d.accuracy + ' م' : '') : 'غير محددة']
    ])) +
    sec('المخالفات والأدلة', 2,
      (d.violationNos.length ? '<ul class="vsum">' + d.violationNos.map(n => '<li><span class="vnum">' + n + '</span><span>' + esc(VBY[n].text) + '</span></li>').join('') + '</ul>' : '<p class="field-error">لم يتم اختيار مخالفات.</p>') +
      (needsChips() ? '<p style="margin-top:8px"><b>أرقام الشرائح:</b> ' + (d.chips.filter(x => String(x).trim()).map(x => ltr(latinDigits(x).trim())).join('، ') || '<span class="field-error">غير مدخلة</span>') + '</p>' : '') +
      '<p style="margin-top:8px"><b>الصور:</b> ' + d.photos.length + ' من ' + MAX_PHOTOS + (d.photos.length ? ' (' + d.photos.filter(p => p.category === 'field').length + ' ميدانية، ' + d.photos.filter(p => p.category === 'support').length + ' دليل داعم)' : '') + '</p>') +
    sec('التوقيعات', 3, kvRows([
      ['توقيع المخالف', d.signature === 'signed' ? (d.offenderSig ? 'تم التوقيع' : '<span class="field-error">لم يُرسم التوقيع</span>') : esc(SIGNATURE[d.signature])],
      ['توقيع المفتش', d.inspectorSig ? 'تم التوقيع' : '<span class="field-error">لم يُرسم التوقيع</span>']
    ])) +
    '<div style="padding-top:12px"><p class="hint">تأكد من صحة بيانات المخالف أعلاه قبل التسليم.</p></div>';
}

/* ---------- step navigation & submit ---------- */
function goStep(target) {
  if (target === W.step || target < 1 || target > 3) return;
  if (W.saveTimer) saveNow();
  setStep(target);
}
async function submitWizard() {
  W.tried = true;
  W.errSteps = new Set();
  const all = [1, 2, 3].map(s => validateStep(s));
  all.forEach((e, i) => { if (e.length) W.errSteps.add(i + 1); showErrors(i + 1, e, true); });
  const first = all.findIndex(e => e.length);
  if (first >= 0) {
    const total = all.reduce((n, e) => n + e.length, 0);
    if (first + 1 !== W.step) setStep(first + 1); else setStep(W.step, true);
    showErrors(first + 1, all[first]);
    toast('لا يمكن التسليم: ' + total + (total === 1 ? ' بيان ناقص' : ' بيانات ناقصة') + '. الخطوات المعلّمة بالأحمر تحتاج استكمال.', 'bad');
    return;
  }
  const resub = W.status === 'returned';
  const wizard = W;
  const ok = await askConfirm(resub ? 'إعادة تسليم المحضر للمراجعة؟' : 'تسليم المحضر للمراجعة؟',
    'سيُنقل المحضر إلى قائمة المراجعة على هذا الجهاز ولن يمكن تعديله إلا إذا أعادته الإدارة. هذه نسخة تجريبية: لا يتم الإرسال إلى الوزارة.',
    resub ? 'إعادة التسليم' : 'تسليم للمراجعة');
  if (!ok || W !== wizard) return;
  if (!saveNow()) { toast('تعذر حفظ المحضر محلياً. لم يتم التسليم.', 'bad'); return; }
  const c = clone(getCase(W.id));
  const now = new Date().toISOString();
  c.status = c.status === 'returned' ? 'resubmitted' : 'submitted';
  c.submittedAt = now;
  c.updatedAt = now;
  c.history.push({ action: c.status, at: now, by: c.inspectorName || 'المفتش' });
  try { upsertCase(c); } catch (e) { toast('تعذر حفظ المحضر محلياً. لم يتم التسليم.', 'bad'); return; }
  const id = c.id;
  clearTimeout(W.saveTimer); W.saveTimer = null;
  leaveWizard();
  toast(resub ? 'أعيد تسليم المحضر للمراجعة على هذا الجهاز. لم يُرسل إلى الوزارة.' : 'تم تسليم المحضر للمراجعة على هذا الجهاز. لم يُرسل إلى الوزارة.');
  location.hash = '#view-' + enc(id);
}

/* ------------------------------------------------------------------ *
 * Administration
 * ------------------------------------------------------------------ */
function adminList() { return readCases().filter(c => c.status !== 'draft'); }
function adminTable(list) {
  return '<div class="table-wrap"><table class="rows"><caption class="sr-only">قائمة المحاضر</caption><thead><tr>' +
    '<th scope="col">رقم المحضر</th><th scope="col">تاريخ الضبط</th><th scope="col">الموقع</th><th scope="col">المخالف</th><th scope="col">المخالفات</th><th scope="col">الحالة</th><th scope="col"><span class="sr-only">إجراء</span></th></tr></thead><tbody>' +
    list.map(c => '<tr' + (c.status === 'returned' ? ' class="is-returned"' : '') + '><td>' + ltr(c.id) + '</td><td>' + fmtDate(c.date) + '</td><td>' + locText(c) + '</td><td>' + esc(c.person || '—') + '</td><td>' + (c.violationNos.length ? ltr(c.violationNos.join(', ')) : '—') + '</td><td>' + badge(c.status) + '</td>' +
      '<td><a class="btn ' + (PENDING.includes(c.status) ? 'primary' : 'secondary') + ' sm" href="#admin-review-' + enc(c.id) + '">' + (PENDING.includes(c.status) ? 'مراجعة' : 'عرض') + '</a></td></tr>').join('') +
    '</tbody></table></div>';
}
function adminCollection(list, emptyText) {
  if (!list.length) return emptyState(emptyText);
  return adminTable(list) + '<div class="cards grid-2 mobile-only">' + list.map(c => reportCard(c, 'admin')).join('') + '</div>';
}
function renderAdminHome(view) {
  const list = sortRecent(adminList());
  const pending = list.filter(c => PENDING.includes(c.status)).sort((a, b) => String(a.submittedAt || a.createdAt || '').localeCompare(String(b.submittedAt || b.createdAt || '')));
  const n = s => list.filter(c => c.status === s).length;
  view.innerHTML =
    '<div class="page-head"><div><p class="eyebrow">بوابة الإدارة</p><h1>لوحة الإدارة</h1><p class="lead">مراجعة المحاضر المسلّمة واعتمادها أو إرجاعها للمفتش.</p></div></div>' +
    '<div class="stats four" role="list">' +
      '<a role="listitem" class="stat st-review" href="#admin-inbox-submitted"><span class="stat-label">بانتظار المراجعة</span><strong>' + n('submitted') + '</strong></a>' +
      '<a role="listitem" class="stat st-review2" href="#admin-inbox-resubmitted"><span class="stat-label">أعيد تسليمها</span><strong>' + n('resubmitted') + '</strong></a>' +
      '<a role="listitem" class="stat st-action" href="#admin-inbox-returned"><span class="stat-label">معادة للمفتش</span><strong>' + n('returned') + '</strong></a>' +
      '<a role="listitem" class="stat st-ok" href="#admin-inbox-approved"><span class="stat-label">معتمدة</span><strong>' + n('approved') + '</strong></a>' +
    '</div>' +
    '<div class="sec-head"><h2>تحتاج قراراً (' + pending.length + ')</h2><a href="#admin-inbox">صندوق المحاضر</a></div>' +
    (pending.length ? adminCollection(pending, '') : emptyState('لا توجد محاضر بانتظار المراجعة حالياً.', list.length ? '' : sampleBtn())) +
    samplesNote() +
    '<div class="legal-note" style="margin-top:16px">' + icon('info') + '<span>' + LEGAL_NOTE + '</span></div>';
  return 'لوحة الإدارة';
}
const A_FILTERS = [
  ['all', 'الكل', () => true],
  ['pending', 'تحتاج قراراً', c => PENDING.includes(c.status)],
  ['submitted', 'بانتظار المراجعة', c => c.status === 'submitted'],
  ['resubmitted', 'أعيد تسليمها', c => c.status === 'resubmitted'],
  ['returned', 'معادة', c => c.status === 'returned'],
  ['approved', 'معتمدة', c => c.status === 'approved']
];
function renderAdminInbox(view, f) {
  const filt = A_FILTERS.find(x => x[0] === f) || A_FILTERS[0];
  const all = adminList();
  view.innerHTML =
    '<div class="page-head"><div><p class="eyebrow">بوابة الإدارة</p><h1>صندوق المحاضر</h1></div></div>' +
    '<nav class="filters" aria-label="تصفية حسب الحالة">' + A_FILTERS.map(x =>
      '<a href="#admin-inbox-' + x[0] + '"' + (x === filt ? ' aria-current="true"' : '') + '>' + x[1] + ' <span class="count">(' + all.filter(x[2]).length + ')</span></a>').join('') + '</nav>' +
    '<div class="search"><label class="sr-only" for="q">بحث في المحاضر</label>' + icon('search') + '<input id="q" type="search" data-search="admin" placeholder="بحث برقم المحضر أو الموقع أو المخالف" autocomplete="off"></div>' +
    '<div id="reportList" aria-live="polite"></div>';
  view.dataset.filter = filt[0];
  fillAdminList();
  return 'صندوق المحاضر';
}
function fillAdminList() {
  const filt = A_FILTERS.find(x => x[0] === $('#view').dataset.filter) || A_FILTERS[0];
  const q = (($('#q') || {}).value || '').trim();
  $('#reportList').innerHTML = adminCollection(sortRecent(adminList()).filter(filt[2]).filter(c => matchQuery(c, q)), q ? 'لا توجد نتائج مطابقة للبحث.' : 'لا توجد محاضر في هذه القائمة.');
}
function renderAdminReview(view, id) {
  const c = getCase(id);
  if (!c || c.status === 'draft') { view.innerHTML = notFound('#admin-inbox'); return 'غير موجود'; }
  const s = detailSections(c, { admin: true });
  let decision;
  if (PENDING.includes(c.status)) {
    decision =
      '<p class="muted" style="margin-bottom:12px">راجع بيانات المحضر والأدلة وسجل الإجراءات قبل اتخاذ القرار.</p>' +
      (c.status === 'resubmitted' ? '<div class="msg info" style="margin-bottom:12px">' + icon('info') + '<div>أعاد المفتش تسليم هذا المحضر بعد التعديل. راجع ملاحظات الإرجاع السابقة.</div></div>' : '') +
      '<div class="field"><label for="decNote">ملاحظة الإدارة</label><textarea id="decNote" rows="4" aria-describedby="decHint decErr"></textarea>' +
      '<p class="hint" id="decHint">إلزامية عند إرجاع المحضر للمفتش، واختيارية عند الاعتماد. تُحفظ ضمن سجل الإجراءات.</p><p class="field-error" id="decErr" role="alert"></p></div>' +
      '<div class="btn-row"><button class="btn success lg" type="button" data-action="approve" data-id="' + esc(c.id) + '">' + icon('check') + 'اعتماد المحضر</button>' +
      '<button class="btn danger-outline lg" type="button" data-action="return" data-id="' + esc(c.id) + '">' + icon('prev') + 'إرجاع للمفتش</button></div>';
  } else if (c.status === 'approved') {
    const h = c.history.slice().reverse().find(x => x.action === 'approved');
    decision = '<div class="msg ok">' + icon('check') + '<div><strong>تم اعتماد المحضر</strong>' + fmtDateTime(h ? h.at : c.reviewedAt) + '<br>المحضر للقراءة فقط ولا يمكن تعديله.</div></div>';
  } else {
    decision = '<div class="msg warn">' + icon('alert') + '<div><strong>المحضر معاد للمفتش</strong>بانتظار تعديله وإعادة تسليمه. لا يمكن اتخاذ قرار حالياً.</div></div>';
  }
  view.innerHTML =
    '<div class="page-head"><div><a class="back-link" href="#admin-inbox">' + icon('prev') + 'العودة إلى صندوق المحاضر</a>' +
    '<h1>مراجعة محضر ' + ltr(c.id) + '</h1><div style="margin-top:6px">' + badge(c.status) + '</div></div>' +
    '<div class="btn-row">' + printButton(c.id) + '</div></div>' +
    '<div class="review-layout">' +
      '<div class="review-main stack">' + s.info + s.viol + s.off + s.ev + s.rets + s.hist + '</div>' +
      '<aside class="review-side" aria-labelledby="decH"><section class="card decision"><h2 id="decH">القرار الإداري</h2>' + decision +
        '<div class="legal-note" style="margin-top:14px">' + icon('info') + '<span>الاعتماد إجراء إداري لتوثيق المحضر فقط، ولا يتضمن تحديد عقوبة أو غرامة أو تقرير إدانة.</span></div>' +
      '</section></aside>' +
    '</div>';
  return 'مراجعة محضر ' + c.id;
}
async function decide(id, action) {
  const cur = getCase(id);
  if (!cur || !PENDING.includes(cur.status)) { toast('لا يمكن اتخاذ قرار: تغيرت حالة المحضر.', 'bad'); render(); return; }
  const noteEl = $('#decNote');
  const note = noteEl.value.trim();
  const err = $('#decErr');
  if (action === 'returned' && !note) {
    err.textContent = 'اكتب سبب الإرجاع؛ الملاحظة إلزامية عند إرجاع المحضر.';
    noteEl.setAttribute('aria-invalid', 'true');
    noteEl.focus();
    return;
  }
  const yes = action === 'approved'
    ? await askConfirm('اعتماد المحضر ' + id + '؟', 'بعد الاعتماد يصبح المحضر للقراءة فقط ولا يمكن تعديله.', 'اعتماد المحضر')
    : await askConfirm('إرجاع المحضر ' + id + ' للمفتش؟', 'سيظهر سبب الإرجاع للمفتش ويُحفظ في سجل الإجراءات.', 'إرجاع للمفتش', true);
  if (!yes) return;
  const latest = getCase(id);
  if (!latest || !PENDING.includes(latest.status)) { toast('لا يمكن اتخاذ قرار: تغيرت حالة المحضر.', 'bad'); render(); return; }
  const c = clone(latest);
  const now = new Date().toISOString();
  c.status = action;
  c.reviewedAt = now;
  c.updatedAt = now;
  c.managerNote = note;
  if (action === 'returned') c.returnComments.push({ text: note, at: now, by: 'الإدارة' });
  c.history.push({ action, at: now, by: 'الإدارة', note });
  try { upsertCase(c); } catch (e) { toast('تعذر حفظ القرار محلياً.', 'bad'); return; }
  toast(action === 'approved' ? 'تم اعتماد المحضر (تجريبياً على هذا الجهاز).' : 'تم إرجاع المحضر للمفتش (تجريبياً على هذا الجهاز).');
  render();
}

/* ------------------------------------------------------------------ *
 * Print (official paper layout, rendered into #printArea)
 * ------------------------------------------------------------------ */
function paperHTML(c) {
  const row = (k, v) => '<tr><th>' + k + '</th><td>' + v + '</td></tr>';
  return '<article class="paper">' +
    '<header class="p-head"><div><strong>دولة قطر</strong><div>وزارة البيئة والتغير المناخي</div><div>إدارة الحماية البرية</div></div>' +
    '<div class="no"><strong>محضر ضبط مخالفة</strong><div>رقم: ' + ltr(c.id) + '</div><div>الحالة: ' + esc(STATUS[c.status].label) + '</div></div></header>' +
    '<h1>محضر ضبط مخالفة بموجب أحكام</h1><ul class="laws">' + LAWS.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>' +
    '<h2>بيانات الضبط</h2><table>' +
      row('التاريخ / الساعة', fmtDate(c.date) + ' — ' + esc(fmtTime12(c.time))) +
      row('المفتش', esc(c.inspectorName || '—') + (c.inspectorNo ? ' — الرقم الوظيفي: ' + ltr(c.inspectorNo) : '')) +
      row('القسم', esc(c.section || '—')) +
      row('وصف الموقع', esc(c.place || '—')) +
      row('الإحداثيات', hasCoords(c) ? ltr('N ' + Number(c.lat).toFixed(6) + '  E ' + Number(c.lng).toFixed(6)) + (c.accuracy != null ? ' (±' + Math.round(c.accuracy) + ' م)' : '') : 'غير محددة') +
    '</table>' +
    '<h2>المخالفات المضبوطة</h2>' +
    (c.violationNos.length || c.legacyViolations.length ? '<ol>' + c.violationNos.map(n => '<li value="' + n + '">' + esc(VBY[n].text) + '</li>').join('') + c.legacyViolations.map(t => '<li>' + esc(t) + '</li>').join('') + '</ol>' : '<p>—</p>') +
    (c.chips.length ? '<p><b>أرقام شرائح الإبل:</b> ' + c.chips.map(ltr).join('، ') + '</p>' : '') +
    '<p><b>شرح المخالفة:</b> ' + esc(c.notes || '—') + '</p>' +
    '<h2>بيانات المخالف</h2><table>' +
      (c.offenderType === 'company' ? row('نوع المخالف', OFFENDER_TYPE[c.offenderType]) : '') +
      row(c.offenderType === 'company' ? 'اسم الشركة' : 'اسم المخالف', esc(c.person || '—')) +
      row(c.offenderType === 'company' ? 'رقم السجل التجاري' : 'رقم البطاقة الشخصية', c.qid ? ltr(c.qid) : '—') +
      row('الهاتف', c.phone ? ltr(c.phone) : '—') +
      row('العنوان', esc(c.address || '—')) +
      row('عرض الصلح', esc(SETTLEMENT[c.settlement])) +
      row('حالة التوقيع', esc(SIGNATURE[c.signature])) +
    '</table><p style="font-size:9pt">' + SIGN_NOTE + '</p>' +
    (c.photos.length ? '<h2>الأدلة المصورة (' + c.photos.length + ')</h2><div class="p-photos">' + c.photos.map((p, i) =>
      '<figure><img src="' + esc(p.preview) + '" alt=""><figcaption><b>' + (i + 1) + '. ' + esc(PHOTO_CAT[p.category]) + '</b>' + (p.caption ? ' — ' + esc(p.caption) : '') + '</figcaption></figure>').join('') + '</div>' : '') +
    (c.returnComments.length ? '<h2>ملاحظات الإرجاع</h2><ol>' + c.returnComments.map(r => '<li>' + esc(r.text) + ' (' + fmtDateTime(r.at) + ')</li>').join('') + '</ol>' : '') +
    (c.status === 'approved' && c.managerNote ? '<p><b>ملاحظة الإدارة عند الاعتماد:</b> ' + esc(c.managerNote) + '</p>' : '') +
    '<div class="p-sign">' +
      '<div>' + (c.offenderSig ? '<img src="' + esc(c.offenderSig) + '" alt="">' : c.signature === 'refused' ? '<em>رفض التوقيع</em>' : '') + '<span class="p-line">توقيع المخالف' + (c.person ? '<br>' + esc(c.person) : '') + '</span></div>' +
      '<div>' + (c.inspectorSig ? '<img src="' + esc(c.inspectorSig) + '" alt="">' : '') + '<span class="p-line">توقيع المفتش' + (c.inspectorName ? '<br>' + esc(c.inspectorName) : '') + '</span></div>' +
      '<div><span class="p-line">اعتماد الإدارة</span></div>' +
    '</div>' +
    '<p class="p-note">نموذج تجريبي غير معتمد — بيانات محفوظة محلياً ولم تُرسل إلى الوزارة. ' + LEGAL_NOTE + '</p>' +
  '</article>';
}
function printButton(id) {
  return EMBEDDED ? '' : '<button class="btn secondary" type="button" data-action="print" data-id="' + esc(id) + '">' + icon('print') + 'طباعة / PDF</button>';
}
function printCase(id) {
  const c = getCase(id);
  if (!c) return;
  $('#printArea').innerHTML = paperHTML(c);
  const imgs = $$('#printArea img');
  const ready = imgs.map(im => im.complete ? Promise.resolve() : new Promise(r => { im.onload = im.onerror = r; }));
  Promise.all(ready).then(() => window.print());
}

/* ------------------------------------------------------------------ *
 * Global event delegation
 * ------------------------------------------------------------------ */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;
  switch (a) {
    case 'menu': openDrawer(); break;
    case 'close-drawer': closeDrawer(true); break;
    case 'close-viewer': closeViewer(); break;
    case 'print': printCase(t.dataset.id); break;
    case 'zoom': {
      let ph, list;
      if (t.dataset.case) { const c = getCase(t.dataset.case); list = c ? c.photos : []; }
      else list = W ? W.d.photos : [];
      ph = list.find(p => p.id === t.dataset.id);
      if (ph) { const i = list.indexOf(ph) + 1; openViewer(ph.preview, 'صورة ' + i + ' · ' + PHOTO_CAT[ph.category], ph.caption); }
      break;
    }
    case 'delete-draft': {
      const c = getCase(t.dataset.id);
      if (!c || c.status !== 'draft') break;
      askConfirm('حذف المسودة؟', 'سيتم حذف المسودة ' + c.id + ' نهائياً من هذا الجهاز.', 'حذف المسودة', true).then(yes => {
        if (!yes) return;
        try { removeCase(c.id); toast('تم حذف المسودة.'); } catch (err) { toast('تعذر الحذف.', 'bad'); }
        render();
      });
      break;
    }
    case 'load-samples': loadSamples(); break;
    case 'remove-samples': removeSamples(); break;
    case 'approve': decide(t.dataset.id, 'approved'); break;
    case 'return': decide(t.dataset.id, 'returned'); break;
    case 'focus-field': {
      const el = document.getElementById(t.dataset.f);
      if (el) { el.scrollIntoView({ block: 'center' }); el.focus({ preventScroll: true }); }
      break;
    }
  }
  if (!W) return;
  switch (a) {
    case 'next': goStep(W.step + 1); break;
    case 'prev': goStep(W.step - 1); break;
    case 'go-step': goStep(Number(t.dataset.step)); break;
    case 'submit': submitWizard(); break;
    case 'locate': useMyLocation(); break;
    case 'clear-loc': clearLocation(); break;
    case 'clear-sig': clearSig(t.dataset.key); break;
    case 'open-map': openMap(); break;
    case 'add-chip': {
      W.d.chips.push('');
      renderChips();
      const inputs = $$('#chipList input');
      inputs[inputs.length - 1].focus();
      break;
    }
    case 'del-chip': {
      W.d.chips.splice(Number(t.dataset.i), 1);
      if (!W.d.chips.length && needsChips()) W.d.chips = [''];
      renderChips();
      scheduleSave();
      const first = $('#chipList input'); if (first) first.focus();
      break;
    }
    case 'pick': {
      if (W.d.photos.length >= MAX_PHOTOS) { toast('تم بلوغ الحد الأقصى (8 صور).', 'bad'); break; }
      document.getElementById(t.dataset.target).click();
      break;
    }
    case 'del-photo': {
      const pid = t.dataset.id, wizard = W;
      const i0 = W.d.photos.findIndex(p => p.id === pid);
      if (i0 < 0) break;
      askConfirm('حذف الصورة ' + (i0 + 1) + '؟', 'لا يمكن التراجع عن الحذف.', 'حذف الصورة', true).then(yes => {
      if (!yes || W !== wizard) return;
      const i = W.d.photos.findIndex(p => p.id === pid);
      if (i < 0) return;
      W.d.photos.splice(i, 1);
      renderPhotos();
      saveNow();
      $('#photoMsg').innerHTML = '<p class="sr-only">تم حذف الصورة.</p>';
      const next = $$('#photoList [data-action="del-photo"]')[Math.min(i, W.d.photos.length - 1)];
      (next || $('#camBtn')).focus();
      });
      break;
    }
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.matches('[data-search="reports"]')) { fillReportList(); return; }
  if (t.matches('[data-search="admin"]')) { fillAdminList(); return; }
  if (t.id === 'decNote') { t.removeAttribute('aria-invalid'); $('#decErr').textContent = ''; return; }
  if (W && t.closest('#wizard') && t.type !== 'file') onWizardField(t);
});
document.addEventListener('change', e => {
  const t = e.target;
  if (!W || !t.closest('#wizard')) return;
  if (t.matches('[data-photo-input]')) { addPhotos(t.files).finally(() => { t.value = ''; }); return; }
  if (t.type === 'radio' || t.type === 'checkbox' || t.tagName === 'SELECT') onWizardField(t);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#sidebar').classList.contains('open')) closeDrawer(true);
  // Enter inside a single-line wizard field should not submit anything; move to next field instead
  if (e.key === 'Enter' && W && e.target.matches('#wizard input[type=text], #wizard input[type=tel]')) {
    e.preventDefault();
    if (e.target.matches('[data-chip]')) { $('[data-action="add-chip"]').click(); return; }
    const fields = $$('#panel' + W.step + ' input:not([type=hidden]):not([readonly]):not([type=radio]):not([type=checkbox]), #panel' + W.step + ' textarea, #panel' + W.step + ' select');
    const i = fields.indexOf(e.target);
    if (fields[i + 1]) fields[i + 1].focus();
  }
});
$('#viewer').addEventListener('click', e => { if (e.target.id === 'viewer') closeViewer(); });
window.addEventListener('hashchange', render);
window.addEventListener('storage', e => { if (e.key === KEY || e.key === null) { cache = null; if (!W) render(); } });
window.addEventListener('pagehide', () => { if (W && W.saveTimer) saveNow(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && W && W.saveTimer) saveNow(); });
window.addEventListener('online', updateNet);
window.addEventListener('offline', updateNet);
window.addEventListener('afterprint', () => { $('#printArea').innerHTML = ''; });

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */
$('#menuBtn').innerHTML = icon('menu', 'ic-lg');
$('.side-head .icon-btn').innerHTML = icon('close', 'ic-lg');
$('#viewer .icon-btn').innerHTML = icon('close', 'ic-lg');
updateNet();
updateStorageUse();
if (!location.hash) history.replaceState(null, '', '#home');
// In an embedded viewer, open with marked example reports the first time so the workflow is visible.
try {
  if (EMBEDDED && !readCases().length && !localStorage.getItem(SAMPLE_FLAG)) {
    writeCases(sampleCases().map(normalize));
    localStorage.setItem(SAMPLE_FLAG, '1');
  }
} catch (e) { /* storage unavailable: start empty */ }
render();

})();
