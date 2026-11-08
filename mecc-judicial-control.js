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
  submitted: { label: 'بانتظار مراجعة الإدارة', cls: 'b-review' },
  resubmitted: { label: 'أعيد تسليمه للإدارة', cls: 'b-review2' },
  returned: { label: 'معاد للمفتش للتعديل', cls: 'b-returned' },
  forwarded: { label: 'بانتظار اعتماد المدير', cls: 'b-director' },
  director_returned: { label: 'أعاده المدير للإدارة', cls: 'b-returned' },
  approved: { label: 'معتمد', cls: 'b-approved' }
};
/* Workflow: inspector submits → الإدارة reviews (forward / return to inspector) → المدير approves (or returns to الإدارة). */
const ADMIN_PENDING = ['submitted', 'resubmitted', 'director_returned'];
const DIRECTOR_PENDING = ['forwarded'];
const PENDING = ADMIN_PENDING.concat(DIRECTOR_PENDING); // under review: locked for the inspector
const EDITABLE = ['draft', 'returned'];
const ACTIONS = {
  created: 'إنشاء مسودة المحضر',
  submitted: 'تسليم المحضر للمراجعة',
  resubmitted: 'إعادة التسليم بعد التعديل',
  returned: 'إرجاع المحضر للمفتش للتعديل',
  forwarded: 'مراجعة الإدارة وتحويل المحضر إلى المدير',
  director_returned: 'إعادة المحضر من المدير إلى الإدارة',
  approved: 'اعتماد المحضر'
};
const SIGNATURE = { unspecified: 'لم يحدد', signed: 'وقّع', refused: 'رفض التوقيع' };
const SETTLEMENT = { '': 'لم يحدد', offered: 'تم عرض الصلح', not_offered: 'لم يُعرض الصلح' };
const OFFENDER_TYPE = { person: 'شخص', company: 'شركة' };
const PHOTO_CAT = { field: 'صورة ميدانية', support: 'دليل داعم' };
const LOC_SOURCE = { gps: 'GPS الجهاز', photo: 'من بيانات الصورة', map: 'تحديد على الخريطة', manual: 'إدخال يدوي', mock: 'محاكاة GPS (تجريبي)' };
/* Security centres (المركز الأمني) with an approximate point in their area (used only to place demo/mock coordinates). */
const SECURITY_CENTERS = [
  ['إدارة أمن الشمال', 25.9500, 51.3000], ['إدارة أمن دخان', 25.4200, 50.8000], ['إدارة أمن الجنوب', 24.9800, 51.4800]
];
/* Suggestions only; any area name can be typed. */
const AREA_SUGGESTIONS = ['الغارية', 'الخريب', 'الجميلية', 'أم قرن', 'الكرعانة', 'سيلين', 'أبو سمرة', 'دخان', 'الزبارة', 'الرويس', 'الخويرية',
  'فويرط', 'العريش', 'روضة راشد', 'الخرسعة', 'العريق', 'أم باب', 'الكعبان', 'سميسمة', 'الذخيرة', 'الغويرية', 'مسيعيد', 'الوكير', 'أبو نخلة', 'الشيحانية'];
const MAX_LETTER_PAGES = 2;
const MAX_CHIP_PHOTOS = 8;
const STEPS = ['الموقع والزمان والصور', 'المخالفات', 'بيانات المخالف والمراجعة'];
const STEPS_SHORT = ['الموقع والصور', 'المخالفات', 'المخالف'];
/* Grazing reports: the inspector does not enter offender data (الإدارة retrieves it from the chip number). */
const STEPS_GRAZING = ['الموقع والزمان والصور', 'المخالفات', 'المراجعة والتسليم'];
const STEPS_SHORT_GRAZING = ['الموقع والصور', 'المخالفات', 'التسليم'];
function stepNames() { return W && needsChips() ? [STEPS_GRAZING, STEPS_SHORT_GRAZING] : [STEPS, STEPS_SHORT]; }

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
  logout: '<path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5"/><path d="M9 8l-4 4 4 4M5 12h11"/>',
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
  const named = [c.area, c.place].map(x => String(x || '').trim()).filter(Boolean);
  if (named.length) return esc(named.join(' — '));
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
  c.chips = (Array.isArray(c.chips) ? c.chips : []).map(x => String(x)).filter(x => x.trim()); // legacy typed numbers
  c.chipPhotos = (Array.isArray(c.chipPhotos) ? c.chipPhotos : []).filter(x => x && x.preview);
  c.chipLookup = c.chipLookup && typeof c.chipLookup === 'object' ? c.chipLookup : {};
  c.offenderSource = c.offenderSource === 'registry' ? 'registry' : '';
  // كتاب إدارة الثروة الحيوانية (camel chip certificate) — attached for grazing violations
  const lv = c.livestock && typeof c.livestock === 'object' ? c.livestock : null;
  c.livestock = lv ? { reqNo: String(lv.reqNo || ''), date: String(lv.date || ''), pages: (Array.isArray(lv.pages) ? lv.pages : []).filter(x => x && x.preview) } : null;
  c.offenderType = c.offenderType === 'company' ? 'company' : 'person';
  c.signature = SIGNATURE[c.signature] ? c.signature : 'unspecified';
  ['offenderSig', 'inspectorSig'].forEach(k => { c[k] = typeof c[k] === 'string' && c[k].indexOf('data:image/') === 0 ? c[k] : ''; });
  c.officerCard = (Array.isArray(c.officerCard) ? c.officerCard : []).filter(x => x && x.preview).slice(0, 2);
  c.settlement = Object.prototype.hasOwnProperty.call(SETTLEMENT, c.settlement || '') ? (c.settlement || '') : '';
  ['date', 'time', 'place', 'securityCenter', 'area', 'notes', 'person', 'qid', 'phone', 'address', 'section', 'inspectorName', 'inspectorNo', 'managerNote'].forEach(k => { c[k] = c[k] == null ? '' : String(c[k]); });
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
    { h: '#admin-inbox', k: 'inbox', label: 'المحاضر', icon: 'inbox' }
  ],
  director: [
    { h: '#director', k: 'ddash', label: 'لوحة المدير', icon: 'shield' },
    { h: '#director-inbox', k: 'dinbox', label: 'المحاضر', icon: 'inbox' }
  ]
};
const PORTALS = {
  inspector: { h: '#home', k: 'sw-inspector', label: 'المفتش', long: 'بوابة المفتش', icon: 'user' },
  admin: { h: '#admin', k: 'sw-admin', label: 'الإدارة', long: 'بوابة الإدارة', icon: 'grid' },
  director: { h: '#director', k: 'sw-director', label: 'المدير', long: 'بوابة المدير', icon: 'shield' }
};
const SWITCH = { inspector: ['admin', 'director'], admin: ['director', 'inspector'], director: ['admin', 'inspector'] };
function navKey(p) {
  if (p[0] === 'admin') return p[1] === 'inbox' || p[1] === 'review' ? 'inbox' : 'adash';
  if (p[0] === 'director') return p[1] === 'inbox' || p[1] === 'review' ? 'dinbox' : 'ddash';
  if (p[0] === 'reports' || p[0] === 'view') return 'reports';
  if (p[0] === 'new' || p[0] === 'edit') return 'new';
  return 'home';
}
function renderShell(portal, p) {
  const key = navKey(p);
  const cur = it => it.k === key ? ' aria-current="page"' : '';
  document.body.dataset.portal = portal;
  $('#portalPill').innerHTML = '<span class="hide-xs">بوابة </span>' + PORTALS[portal].label;
  $('#portalPill').setAttribute('aria-label', 'البوابة الحالية: ' + PORTALS[portal].long);
  $('#sidePortalLabel').textContent = PORTALS[portal].long;
  $('#sideNav').innerHTML = NAV[portal].map(it => '<a href="' + it.h + '"' + cur(it) + '>' + icon(it.icon) + '<span>' + it.label + '</span></a>').join('');
  const u = currentUser();
  $('#sideSwitch').innerHTML = u ? '<div class="side-user">' + icon('user', 'ic-lg') + '<span><b>' + esc(u.name) + '</b><small>' + esc(u.title) + '</small></span></div>' +
    '<a href="#systems">' + icon('grid') + '<span>تغيير النظام</span></a>' +
    '<a href="#" data-action="logout">' + icon('logout') + '<span>تسجيل الخروج</span></a>' : '';
  const bn = NAV[portal].concat([{ h: '#systems', k: 'systems', label: 'الأنظمة', icon: 'grid' }]);
  const cur0 = NAV[portal].find(it => it.k === key);
  $('#crumb').innerHTML = '<a href="#systems">نظام الرصد البيئي</a>' + icon('next') + '<span>نظام رصد المخالفات</span>' + icon('next') + '<a href="' + NAV[portal][0].h + '">' + esc(PORTALS[portal].long) + '</a>' +
    (cur0 && cur0 !== NAV[portal][0] ? icon('next') + '<span aria-current="page">' + esc(cur0.label) + '</span>' : '');
  $('#bottomnav').innerHTML = bn.map(it => '<a href="' + it.h + '"' + cur(it) + (it.accent ? ' class="accent"' : '') + (it.action ? ' data-action="' + it.action + '"' : '') + '><span class="bn-icon">' + icon(it.icon) + '</span><span>' + it.label + '</span></a>').join('');
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
  const dlg = document.querySelector('dialog.preview[open]');
  const r = dlg ? $('.dlg-toast', dlg) : $('#toastRegion');
  r.innerHTML = '<div class="toast ' + (kind || 'ok') + '" data-at="' + Date.now() + '">' + icon(kind === 'bad' ? 'alert' : kind === 'info' ? 'info' : 'check') + '<span>' + esc(text) + '</span></div>';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { r.innerHTML = ''; }, 3600);
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
/* ------------------------------------------------------------------ *
 * Mock sign-in (prototype only — no server, credentials are public demo values)
 * ------------------------------------------------------------------ */
const SESSION_KEY = 'mecc_session_v1';
const USERS = [
  { username: 'inspector', password: '1234', no: '16000001', name: 'مفتش تجريبي', role: 'inspector', title: 'مفتش ميداني' },
  { username: 'admin', password: '1234', no: '16000002', name: 'مراجع الإدارة', role: 'admin', title: 'الإدارة — المراجعة' },
  { username: 'director', password: '1234', no: '16000003', name: 'مدير الإدارة', role: 'director', title: 'المدير — الاعتماد' }
];
function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return s && USERS.some(u => u.username === s.username) ? s : null;
  } catch (e) { return memSession; }
}
let memSession = null;
function setSession(u) {
  const s = u ? { username: u.username, name: u.name, role: u.role, title: u.title, no: u.no, at: new Date().toISOString() } : null;
  memSession = s;
  try { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY); } catch (e) { /* keep in memory */ }
}
function currentUser() { return getSession() || memSession; }
function actorName(fallback) { const u = currentUser(); return u ? u.name : fallback; }
function findUser(id) {
  const k = latinDigits(id).trim().toLowerCase();
  return USERS.find(u => u.username === k || u.no === k) || null;
}
function signIn(u) {
  setSession(u);
  if (u.role === 'inspector') { const p = getProfile(); p.name = u.name; p.no = u.no; setProfile(p); }
  const target = '#systems';
  if (location.hash === target) render(); else location.hash = target;
  toast('مرحباً، ' + u.name + '. تم تسجيل الدخول (تجريبياً).');
}
async function signOut() {
  if (!(await askConfirm('تسجيل الخروج؟', 'ستعود إلى صفحة تسجيل الدخول. البيانات المحلية تبقى محفوظة على هذا الجهاز.', 'تسجيل الخروج'))) return;
  leaveWizard();
  setSession(null);
  if (location.hash === '#login') render(); else location.hash = '#login';
}
function renderLogin(view) {
  view.innerHTML =
    '<div class="login">' +
      '<section class="id-band login-band">' +
        '<div class="id-org"><span class="brand-mark" aria-hidden="true">MECC</span><span><strong>وزارة البيئة والتغير المناخي</strong><small>دولة قطر · إدارة الحماية البرية</small></span></div>' +
        '<h1>نظام الرصد البيئي</h1>' +
        '<p>رصد المخالفات البيئية والمخلفات البرية ميدانياً، ومتابعة المحاضر حتى اعتمادها.</p>' +
      '</section>' +
      '<div class="login-card">' +
        '<h2>تسجيل الدخول</h2>' +
        '<p class="lead">أدخل بيانات حسابك للمتابعة.</p>' +
        '<form id="loginForm" novalidate>' +
          '<div class="field"><label for="lg-user">اسم المستخدم أو الرقم الوظيفي</label><input id="lg-user" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" class="num-input" required></div>' +
          '<div class="field"><label for="lg-pass">كلمة المرور</label><div class="pass-wrap"><input id="lg-pass" type="password" autocomplete="current-password" class="num-input" required>' +
            '<button class="icon-btn" type="button" data-action="toggle-pass" aria-label="إظهار كلمة المرور" aria-pressed="false">' + icon('eye') + '</button></div></div>' +
          '<div id="loginErr" class="field-error" role="alert"></div>' +
          '<button class="btn primary lg block" type="submit" id="loginBtn">تسجيل الدخول</button>' +
        '</form>' +
        '<hr class="divider">' +
        '<p class="label">حسابات تجريبية — اضغط للدخول مباشرة</p>' +
        '<div class="demo-accounts">' + USERS.map(u =>
          '<button class="demo-acc" type="button" data-action="demo-login" data-user="' + u.username + '">' + icon(PORTALS[u.role].icon, 'ic-lg') +
          '<span><b>' + esc(PORTALS[u.role].long) + '</b><small>' + esc(u.title) + ' · <bdi dir="ltr">' + u.username + ' / ' + u.password + '</bdi></small></span></button>').join('') +
        '</div>' +
        '<p class="hint" style="margin-top:14px">تسجيل دخول تجريبي (وهمي): لا يتم التحقق عبر أي خادم، والحسابات أعلاه للعرض فقط.</p>' +
      '</div>' +
    '</div>';
  return 'تسجيل الدخول';
}
function submitLogin() {
  const u = $('#lg-user'), p = $('#lg-pass'), err = $('#loginErr'), btn = $('#loginBtn');
  [u, p].forEach(x => x.removeAttribute('aria-invalid'));
  if (!u.value.trim() || !p.value) {
    err.textContent = 'أدخل اسم المستخدم وكلمة المرور.';
    (u.value.trim() ? p : u).setAttribute('aria-invalid', 'true');
    (u.value.trim() ? p : u).focus();
    return;
  }
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>جارٍ التحقق…';
  setTimeout(() => {
    const user = findUser(u.value);
    if (!user || user.password !== latinDigits(p.value)) {
      btn.disabled = false; btn.textContent = 'تسجيل الدخول';
      err.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة.';
      p.value = ''; p.setAttribute('aria-invalid', 'true'); p.focus();
      return;
    }
    signIn(user);
  }, 450);
}

/* ------------------------------------------------------------------ *
 * نظام الرصد البيئي — system choice after sign-in
 * ------------------------------------------------------------------ */
/* رصد المخلفات البرية is a separate, completed system. Put its address here to show an
   "open" button on its page (e.g. 'https://...'); left empty, the page shows its title only. */
const WASTE_SYSTEM_URL = '';
function renderSystems(view, user) {
  view.innerHTML =
    '<section class="id-band hub-band"><p class="id-eyebrow">نظام الرصد البيئي</p><h1>' + greeting() + '، ' + esc(user.name) + '</h1>' +
      '<p>اختر نوع الرصد للمتابعة.</p></section>' +
    '<div class="sys-grid">' +
      '<a class="sys-card" href="#waste"><span class="sys-ic">' + icon('trash', 'ic-lg') + '</span>' +
        '<span class="sys-body"><h2>رصد المخلفات</h2><p>رصد المخلفات البرية.</p></span>' +
        '<span class="sys-go" aria-hidden="true">' + icon('next') + '</span></a>' +
      '<a class="sys-card main" href="' + PORTALS[user.role].h + '"><span class="sys-ic">' + icon('scale', 'ic-lg') + '</span>' +
        '<span class="sys-body"><h2>رصد المخالفات</h2><p>تحرير محاضر الضبط ومراجعتها واعتمادها.</p>' +
        '<small class="sys-role">الدخول إلى ' + esc(PORTALS[user.role].long) + '</small></span>' +
        '<span class="sys-go" aria-hidden="true">' + icon('next') + '</span></a>' +
    '</div>' +
    '<div class="hub-foot"><button class="btn ghost" type="button" data-action="logout">' + icon('logout') + 'تسجيل الخروج</button></div>';
  return 'اختيار النظام';
}
function renderWaste(view) {
  view.innerHTML =
    '<a class="back-link" href="#systems">' + icon('prev') + 'العودة إلى اختيار النظام</a>' +
    '<section class="card sys-page"><span class="sys-ic">' + icon('trash', 'ic-lg') + '</span>' +
      '<p class="eyebrow">نظام الرصد البيئي</p><h1>رصد المخلفات البرية</h1>' +
      '<p class="lead">نظام رصد المخلفات البرية نظام مستقل ومكتمل، ولا يتضمن هذا النموذج شاشاته.</p>' +
      (WASTE_SYSTEM_URL ? '<a class="btn primary lg" href="' + esc(WASTE_SYSTEM_URL) + '" target="_blank" rel="noopener">فتح نظام رصد المخلفات' + icon('next') + '</a>' : '') +
    '</section>';
  return 'رصد المخلفات البرية';
}

/* ------------------------------------------------------------------ *
 * Preview of the official report file (WPD/01) before export
 * ------------------------------------------------------------------ */
let pv = { c: null, zoom: 0 }; // zoom 0 = fit to width
function ensureWpdStyle() {
  if (!document.getElementById('wpdStyle')) {
    const st = document.createElement('style');
    st.id = 'wpdStyle';
    st.textContent = WPD_CSS;
    document.head.appendChild(st);
  }
}
function openPreview(c) {
  if (!c) return;
  ensureWpdStyle();
  pv.c = c; pv.zoom = 0;
  const d = $('#previewDlg');
  const approved = c.status === 'approved' && !!getCase(c.id);
  const pages = wpdPages(c);
  $('#previewSub').innerHTML = ltr(c.id) + ' · ' + esc(STATUS[c.status] ? STATUS[c.status].label : '') + ' · ' + pages.length + (pages.length === 1 ? ' صفحة' : ' صفحات');
  $('#pvNote').innerHTML = approved
    ? icon('check') + '<span>المحضر معتمد من المدير، والملف جاهز للتنزيل بصيغة PDF.</span>'
    : icon('info') + '<span>معاينة فقط: يمكن تنزيل الملف بعد اعتماد المدير.</span>';
  $('#pvNote').className = 'pv-note ' + (approved ? 'ok' : 'info');
  const dl = $('#pvDownload');
  dl.hidden = !approved;
  dl.dataset.id = c.id;
  const pr = $('#pvPrint');
  pr.hidden = !approved || EMBEDDED;
  pr.dataset.id = c.id;
  $('#pvBody').innerHTML = pages.map((h, i) => '<div class="pv-page" role="img" aria-label="الصفحة ' + (i + 1) + ' من ' + pages.length + '"><div class="pv-inner">' + h + '</div></div>').join('');
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  layoutPreview();
  $('#pvBody').scrollTop = 0;
}
function layoutPreview() {
  const body = $('#pvBody');
  if (!body || !pv.c) return;
  const fit = Math.min(1.25, Math.max(0.2, (body.clientWidth - 24) / WPD_W));
  const s = pv.zoom ? pv.zoom : fit;
  $('#pvZoom').textContent = Math.round(s * 100) + '%';
  $$('.pv-page', body).forEach(p => {
    p.style.width = WPD_W * s + 'px';
    p.style.height = WPD_H * s + 'px';
    p.firstChild.style.transform = 'scale(' + s + ')';
  });
}
function zoomPreview(step) {
  const body = $('#pvBody');
  const fit = Math.min(1.25, Math.max(0.2, (body.clientWidth - 24) / WPD_W));
  const cur = pv.zoom || fit;
  pv.zoom = step === 0 ? 0 : Math.min(2, Math.max(0.25, cur * (step > 0 ? 1.25 : 0.8)));
  layoutPreview();
}
function closePreview() {
  const d = $('#previewDlg');
  if (d.open) { if (typeof d.close === 'function') d.close(); else d.removeAttribute('open'); }
  $('#pvBody').innerHTML = '';
  pv.c = null;
}
window.addEventListener('resize', () => { if (pv.c) layoutPreview(); });

/* Routes use plain "#name" hashes (letters, digits, hyphens) so they also work inside
   embedded viewers: #home, #reports-returned, #new, #edit-<id>, #view-<id>,
   #admin, #admin-inbox-<filter>, #admin-review-<id>. Old "#/a/b" links still parse. */
function parseRoute() {
  let h = location.hash.replace(/^#/, '');
  try { h = decodeURIComponent(h); } catch (e) { /* keep raw */ }
  if (h.charAt(0) === '/') return h.split('/').filter(Boolean);
  const m = h.match(/^(admin-review|admin-inbox|director-review|director-inbox|reports|edit|view)-(.+)$/);
  if (m) return m[1].split('-').concat([m[2]]);
  return h ? h.split('-') : [];
}
let lastRouteHash = null;
function render() {
  if (lastRouteHash !== null && lastRouteHash !== location.hash) {
    // leave a just-shown toast visible for the page it refers to, but drop older ones
    setTimeout(() => { const t = $('#toastRegion .toast'); if (t && Date.now() - (Number(t.dataset.at) || 0) > 1500) $('#toastRegion').innerHTML = ''; }, 0);
  }
  lastRouteHash = location.hash;
  leaveWizard();
  closeDrawer();
  if (pv.c) closePreview();
  const view = $('#view');
  const user = currentUser();
  if (!user) {
    document.body.classList.add('auth');
    if (location.hash !== '#login') history.replaceState(null, '', '#login');
    document.title = renderLogin(view) + ' | نظام الرصد البيئي';
    window.scrollTo(0, 0);
    return;
  }
  document.body.classList.remove('auth');
  const p = parseRoute();
  if (!p.length || p[0] === 'login' || p[0] === 'systems' || p[0] === 'waste') {
    // نظام الرصد البيئي: choose between رصد المخلفات and رصد المخالفات (نظام رصد المخالفات)
    if (p[0] !== 'systems' && p[0] !== 'waste') history.replaceState(null, '', '#systems');
    document.body.classList.add('hub');
    document.body.classList.remove('auth');
    $('#brandSub').textContent = 'نظام الرصد البيئي';
    $('#portalPill').textContent = user.title;
    $('#portalPill').setAttribute('aria-label', 'المستخدم: ' + user.name + ' — ' + user.title);
    $('#bottomnav').innerHTML = '';
    const t = p[0] === 'waste' ? renderWaste(view) : renderSystems(view, user);
    document.title = t + ' | نظام الرصد البيئي';
    window.scrollTo(0, 0);
    const h1 = $('#view h1');
    if (h1 && renderCount++ > 0) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
    return;
  }
  document.body.classList.remove('hub');
  $('#brandSub').textContent = 'نظام الرصد البيئي · نظام رصد المخالفات';
  const portal = p[0] === 'admin' || p[0] === 'director' ? p[0] : 'inspector';
  // Each signed-in role sees only its own portal.
  if (portal !== user.role || p[0] === 'login') { location.replace(PORTALS[user.role].h); return; }
  renderShell(portal, p);
  let title;
  if (portal === 'admin') {
    if (p[1] === 'inbox') title = renderAdminInbox(view, p[2]);
    else if (p[1] === 'review' && p[2]) title = renderAdminReview(view, p[2]);
    else title = renderAdminHome(view);
  } else if (portal === 'director') {
    if (p[1] === 'inbox') title = renderRoleInbox(view, p[2], 'director');
    else if (p[1] === 'review' && p[2]) title = renderRoleReview(view, p[2], 'director');
    else title = renderDirectorHome(view);
  } else if (p[0] === 'reports') title = renderReports(view, p[1]);
  else if (p[0] === 'new') title = renderWizard(view, null);
  else if (p[0] === 'edit' && p[1]) title = renderWizard(view, p[1]);
  else if (p[0] === 'view' && p[1]) title = renderInspectorView(view, p[1]);
  else title = renderHome(view);
  document.title = (title || 'الرئيسية') + ' | نظام رصد المخالفات | نظام الرصد البيئي';
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
  const dret = mode && c.status === 'director_returned' ? c.history.slice().reverse().find(h => h.action === 'director_returned') : null;
  const cls = c.status === 'returned' || dret ? ' is-returned' : c.status === 'draft' ? ' is-draft' : '';
  let actions;
  if (mode === 'admin' || mode === 'director') {
    const pend = (mode === 'admin' ? ADMIN_PENDING : DIRECTOR_PENDING).includes(c.status);
    actions = '<a class="btn ' + (pend ? 'primary' : 'secondary') + ' block" href="#' + mode + '-review-' + enc(c.id) + '">' + icon('eye') + (pend ? (mode === 'admin' ? 'فتح للمراجعة' : 'فتح للاعتماد') : 'عرض المحضر') + '</a>';
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
      (mode ? '<span>' + icon('user') + '<span class="txt">' + (c.person ? esc(c.person) : 'لم يحدد المخالف') + '</span></span>' : '') +
      '<span>' + icon('scale') + '<span class="txt">' + (vcount ? (vcount === 1 ? 'مخالفة واحدة' : vcount + ' مخالفات') + (c.violationNos.length ? ' (البند ' + c.violationNos.join('، ') + ')' : '') : 'لم تحدد المخالفات') + '</span></span>' +
    '</div>' +
    (ret ? '<div class="return-note"><b>ملاحظة الإدارة عند الإرجاع</b>' + esc(ret.text) + '</div>' : '') +
    (dret && dret.note ? '<div class="return-note"><b>ملاحظة المدير عند الإعادة</b>' + esc(dret.note) + '</div>' : '') +
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
    ['بطاقة الضبطية', c.officerCard.length ? c.officerCard.map((pg, i) => '<button class="btn ghost sm" type="button" data-action="zoom" data-kind="oc" data-case="' + esc(c.id) + '" data-id="' + esc(pg.id) + '">' + icon('eye') + (i === 0 ? 'الوجه' : 'الظهر') + '</button>').join(' ') : '—'],
    ['القسم', esc(c.section || '—')],
    ['المركز الأمني', esc(c.securityCenter || '—')],
    ['المنطقة', esc(c.area || '—')],
    ['وصف الموقع', esc(c.place || '—')],
    ['الإحداثيات', hasCoords(c) ? ltr(coordsText(c)) + osm : 'غير محددة'],
    hasCoords(c) ? ['مصدر الموقع', esc(LOC_SOURCE[c.locSource] || '—') + (c.accuracy != null ? ' · الدقة ±' + ltr(Math.round(c.accuracy)) + ' م' : '')] : null
  ]) + '</section>';

  const vlist = c.violationNos.map(n => '<li><span class="vnum">' + n + '</span><span>' + esc(VBY[n].text) + '</span></li>').join('') +
    c.legacyViolations.map(t => '<li><span class="vnum">—</span><span>' + esc(t) + ' <span class="muted">(بند من نسخة سابقة)</span></span></li>').join('');
  const viol = '<section class="card" aria-labelledby="sec-viol"><h2 id="sec-viol" class="review-sec-head">المخالفات المضبوطة</h2>' +
    (vlist ? '<ul class="vsum">' + vlist + '</ul>' : '<p class="muted">لم تحدد مخالفات.</p>') +
    (c.chipPhotos.length ? '<div style="margin-top:12px"><p class="label">صور شرائح الإبل</p><div class="gallery">' + c.chipPhotos.map((ph, i) => '<figure><button type="button" data-action="zoom" data-kind="chip" data-case="' + esc(c.id) + '" data-id="' + esc(ph.id) + '" aria-label="تكبير صورة الشريحة ' + (i + 1) + '"><img src="' + esc(ph.thumb || ph.preview) + '" alt="" loading="lazy"></button><figcaption><b>شريحة ' + (i + 1) + '</b></figcaption></figure>').join('') + '</div></div>' : '') +
    (c.chips.length ? '<div style="margin-top:12px"><p class="label">أرقام شرائح الإبل</p><div class="chips-view">' + c.chips.map(x => '<span>' + esc(x) + '</span>').join('') + '</div></div>' : '') +
    (isGrazing(c) && !(c.livestock && c.livestock.pages.length) ? '<div style="margin-top:12px"><p class="label">كتاب إدارة الثروة الحيوانية</p><p class="hint" style="margin:0">' +
      (c.status === 'approved' ? 'لم يُرفق.' : 'يُرفق عند اعتماد المدير.') + '</p></div>' : '') +
    (c.livestock && c.livestock.pages.length ? '<div style="margin-top:12px"><p class="label">كتاب إدارة الثروة الحيوانية</p>' +
      '<p class="hint" style="margin:0 0 8px">' + (c.livestock.reqNo ? 'رقم طلب الإفادة: ' + ltr(c.livestock.reqNo) + ' · ' : '') + (c.livestock.date ? 'تاريخ الإفادة: ' + fmtDate(c.livestock.date) : '') + '</p>' +
      (c.livestock.pages.length ? '<div class="gallery">' + c.livestock.pages.map((ph, i) => '<figure><button type="button" data-action="zoom" data-kind="lv" data-case="' + esc(c.id) + '" data-id="' + esc(ph.id) + '" aria-label="تكبير صفحة الكتاب ' + (i + 1) + '"><img src="' + esc(ph.thumb || ph.preview) + '" alt="" loading="lazy"></button><figcaption><b>صفحة ' + (i + 1) + '</b></figcaption></figure>').join('') + '</div>'
        : '<p class="field-error">لم يُرفق الكتاب.</p>') + '</div>' : '') +
    '<div style="margin-top:12px"><p class="label">شرح المخالفة</p><p style="white-space:pre-wrap;overflow-wrap:anywhere">' + esc(c.notes || '—') + '</p></div>' +
    '<div class="legal-note" style="margin-top:12px">' + icon('info') + '<span>' + LEGAL_NOTE + '</span></div>' +
  '</section>';

  const off = '<section class="card" aria-labelledby="sec-off"><h2 id="sec-off" class="review-sec-head">بيانات المخالف</h2>' +
  (isGrazing(c) && !c.person ? '<p class="hint" style="margin:0 0 8px">مخالفة رعي: تستكمل الإدارة بيانات المخالف من رقم الشريحة.</p>' : '') +
  (c.offenderSource === 'registry' ? '<p class="hint" style="margin:0 0 8px">البيانات مسترجعة من سجل الثروة الحيوانية عبر رقم الشريحة (محاكاة).</p>' : '') + kvRows([
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
      returnComments: [], history: [{ action: 'created', at: iso(6, 10), by: 'مفتش تجريبي' }, { action: 'submitted', at: iso(6, 12), by: 'مفتش تجريبي' }, { action: 'forwarded', at: iso(5, 9), by: 'الإدارة', note: 'تمت المراجعة.' }, { action: 'approved', at: iso(4, 12), by: 'المدير', note: '' }] }),
    Object.assign({}, base, { id: 'MECC-DEMO-0000005', status: 'forwarded', date: day(2), time: '09:10', place: 'مثال: روضة جنوب الشمال', lat: 25.7, lng: 51.3, accuracy: 11, locSource: 'gps',
      violationNos: [6], notes: 'مثال تجريبي: قطع أشجار برية بدون ترخيص.', person: 'مخالف تجريبي رابع (مثال)', qid: '00000000003',
      createdAt: iso(2, 9), updatedAt: iso(1, 11), submittedAt: iso(2, 10),
      returnComments: [], history: [{ action: 'created', at: iso(2, 9), by: 'مفتش تجريبي' }, { action: 'submitted', at: iso(2, 10), by: 'مفتش تجريبي' }, { action: 'forwarded', at: iso(1, 11), by: 'الإدارة', note: 'البيانات مكتملة، مرفوع للاعتماد.' }] })
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
    '<section class="id-band hero">' +
      '<p class="id-eyebrow">بوابة المفتش · نظام رصد المخالفات</p>' +
      '<h1>' + greeting() + (name ? '، ' + esc(name) : '') + '</h1>' +
      '<p class="lead">سجّل المخالفات البيئية ميدانياً، وتُحفظ على جهازك تلقائياً حتى تسليمها للمراجعة.</p>' +
      '<a class="btn on-dark xl" href="#new">' + icon('plus', 'ic-lg') + 'محضر جديد</a>' +
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
  return [c.id, c.place, c.area, c.securityCenter, c.person, c.qid, c.section, c.notes].some(v => String(v || '').toLowerCase().includes(q));
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
  else if (c.status === 'approved') banner = '<div class="msg ok" style="margin-bottom:14px">' + icon('check') + '<div><strong>محضر معتمد — للقراءة فقط</strong>لا يمكن تعديل المحضر بعد اعتماده. يمكنك تنزيل المحضر الرسمي بصيغة PDF من الزر أعلاه.</div></div>';
  else if (PENDING.includes(c.status)) banner = '<div class="msg info" style="margin-bottom:14px">' + icon('info') + '<div><strong>' + (c.status === 'forwarded' ? 'راجعته الإدارة وحوّلته إلى المدير للاعتماد' : 'المحضر قيد مراجعة الإدارة') + '</strong>لا يمكن التعديل أثناء المراجعة. سيظهر هنا أي إرجاع أو اعتماد. (المراجعة تجريبية على هذا الجهاز ولم يُرسل المحضر إلى الوزارة.)</div></div>';
  else if (c.status === 'draft') banner = '<div class="msg info" style="margin-bottom:14px">' + icon('device') + '<div><strong>مسودة محفوظة محلياً</strong><a class="btn primary" style="margin-top:8px" href="#edit-' + enc(c.id) + '">متابعة التحرير</a></div></div>';
  view.innerHTML =
    '<div class="page-head"><div><a class="back-link" href="#reports">' + icon('prev') + 'العودة إلى تقاريري</a><h1>محضر ' + ltr(c.id) + '</h1></div>' +
    '<div class="btn-row">' + reportActions(c) + '</div></div>' +
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
    place: '', securityCenter: '', area: '', lat: null, lng: null, accuracy: null, locSource: null, locAt: null,
    livestock: { reqNo: '', date: '', pages: [] },
    violationNos: [], chips: [], chipPhotos: [], notes: '', photos: [],
    offenderType: 'person', person: '', qid: '', phone: '', address: '', section: '', settlement: '', signature: 'unspecified',
    offenderSig: '', inspectorSig: '', officerCard: (Array.isArray(p.officerCard) ? p.officerCard : []).slice(0, 2)
  };
}
function dataFromCase(c) {
  const d = blankData();
  Object.keys(d).forEach(k => { if (c[k] !== undefined) d[k] = clone(c[k]); });
  if (!d.date) d.date = todayISO();
  if (!d.livestock) d.livestock = { reqNo: '', date: '', pages: [] };
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
  document.body.classList.add('in-wizard');
  document.documentElement.classList.add('in-wizard');
  view.innerHTML = wizardHTML(rec);
  renderLocStatus();
  renderChips();
  renderPhotos();
  renderOfficerCard();
  updateViolationUI();
  setSaveState(rec ? 'saved' : 'idle', rec ? rec.updatedAt : null);
  setStep(1, true);
  return rec ? 'تعديل محضر ' + rec.id : 'محضر جديد';
}

function wizardHTML(rec) {
  const d = W.d;
  const ret = rec && rec.status === 'returned' ? latestReturn(rec) : null;
  const older = rec ? rec.returnComments.slice(0, -1) : [];
  const legacyChips = (d.chips || []).filter(x => String(x).trim()).join('، ');
  /* Camel chip photos (taken with the camera) sit directly under the ticked grazing violation (1–4). */
  const chipBox = '<div class="chip-box" id="chipBox" hidden>' +
      '<div class="card-head" style="margin-bottom:6px"><h3 id="chipH">' + icon('chip') + ' صور شرائح الإبل <span class="req">*</span></h3><span class="counter" id="chipCount">0 / ' + MAX_CHIP_PHOTOS + '</span></div>' +
      '<p class="hint" style="margin:0 0 10px">مطلوبة لمخالفات الرعي (البنود 1–4). التقط بالكاميرا صورة لكل شريحة أو لشاشة قارئ الشريحة.</p>' +
      (legacyChips ? '<p class="hint" style="margin:0 0 10px">أرقام مسجلة سابقاً: <bdi dir="ltr">' + esc(legacyChips) + '</bdi></p>' : '') +
      '<label class="btn primary block lg file-btn" id="chipCamBtn">' + icon('camera', 'ic-lg') + '<span>تصوير الشريحة بالكاميرا</span>' +
        '<input type="file" id="chipCam" accept="image/*" capture="environment" data-chip-input aria-label="تصوير شريحة الإبل بالكاميرا"></label>' +
      '<div class="busy" id="chipBusy" hidden><span class="spinner" aria-hidden="true"></span><span>جارٍ تجهيز الصورة…</span></div>' +
      '<div id="chipMsg" aria-live="assertive"></div>' +
      '<ul class="lv-list" id="chipList" aria-label="صور الشرائح"></ul>' +
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
  '</nav>' +

  /* ---------- STEP 1 ---------- */
  '<section class="panel" id="panel1" aria-labelledby="ph1">' +
    '<h2 class="sr-only" id="ph1" tabindex="-1">الخطوة 1: الموقع والزمان والصور</h2>' +
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
        '<div class="field"><label for="f-lat">خط العرض (Latitude)</label><input id="f-lat" type="text" class="num-input" inputmode="decimal" data-f="lat" value="' + esc(W.raw.lat) + '" placeholder="25.285447" autocomplete="off" spellcheck="false" aria-describedby="latHint"></div>' +
        '<div class="field"><label for="f-lng">خط الطول (Longitude)</label><input id="f-lng" type="text" class="num-input" inputmode="decimal" data-f="lng" value="' + esc(W.raw.lng) + '" placeholder="51.531040" autocomplete="off" spellcheck="false"></div>' +
        '<div class="field acc"><label for="f-acc">الدقة (متر)</label><input id="f-acc" type="text" class="num-input" readonly value="' + (d.accuracy != null ? '±' + Math.round(d.accuracy) : '') + '" placeholder="تُعبأ تلقائياً من GPS" aria-describedby="accHint"><p class="hint" id="accHint">تُحدَّد تلقائياً عند استخدام موقع الجهاز.</p></div>' +
      '</div>' +
      '<p class="hint" style="margin-top:-6px" id="latHint">يمكن لصق الإحداثيات معاً في حقل خط العرض، مثل <bdi dir="ltr">25.4495, 51.2234</bdi>، أو لصق رابط من الخرائط.</p>' +
      '<div class="loc-actions">' +
        (EMBEDDED ? '' : '<button class="btn secondary" type="button" data-action="open-map" id="mapBtn">' + icon('map') + 'تحديد على الخريطة</button>') +
        '<button class="btn ghost" type="button" data-action="clear-loc">' + icon('close') + 'مسح الإحداثيات</button>' +
      '</div>' +
      '<div class="map-box" id="mapBox" hidden><div class="map" id="map" role="application" aria-label="خريطة لتحديد موقع المخالفة"></div><p class="map-hint" id="mapHint">اضغط على الخريطة لوضع علامة موقع المخالفة. موقع الخريطة الافتراضي لا يُعتبر موقعاً محدداً.</p></div>' +
      '<div class="grid2" style="margin-top:14px">' +
        '<div class="field"><label for="f-center">المركز الأمني</label><select id="f-center" data-f="securityCenter"><option value="">اختر المركز الأمني</option>' +
          SECURITY_CENTERS.map(m => '<option' + (d.securityCenter === m[0] ? ' selected' : '') + '>' + m[0] + '</option>').join('') + '</select></div>' +
        '<div class="field"><label for="f-area">المنطقة</label><input id="f-area" type="text" data-f="area" list="areaList" value="' + esc(d.area) + '" placeholder="اختر من القائمة أو اكتب اسم المنطقة" autocomplete="off">' +
          '<datalist id="areaList">' + AREA_SUGGESTIONS.map(a => '<option value="' + a + '"></option>').join('') + '</datalist></div>' +
      '</div>' +
      '<div class="field"><label for="f-place">وصف الموقع</label><textarea id="f-place" data-f="place" rows="2" placeholder="مثال: منطقة الخريب – شمال الطريق الرئيسي بنحو 2 كم">' + esc(d.place) + '</textarea><p class="hint">مطلوب المنطقة أو الوصف إذا تعذر تحديد الإحداثيات.</p></div>' +
    '</div>' +
    '<div class="card" id="evCard">' +
      '<div class="card-head"><h3 id="evH">الأدلة والصور <span class="req">*</span></h3><span class="counter" id="photoCount">0 / ' + MAX_PHOTOS + '</span></div>' +
      '<p class="hint" style="margin:-4px 0 12px">حتى ' + MAX_PHOTOS + ' صور، بحد أقصى 10 م.ب للصورة الواحدة. الصيغ المقبولة: JPG وPNG وWEBP. تُحفظ نسخة عرض مصغّرة فقط.</p>' +
      '<div class="photo-actions">' +
        '<label class="btn primary lg file-btn" id="camBtn">' + icon('camera', 'ic-lg') + '<span>التقاط صورة</span>' +
          '<input type="file" id="camInput" accept="image/*" capture="environment" data-photo-input aria-label="التقاط صورة بالكاميرا"></label>' +
        '<label class="btn secondary lg file-btn" id="fileBtn">' + icon('image', 'ic-lg') + '<span>اختيار من الجهاز</span>' +
          '<input type="file" id="fileInput" accept="image/*" multiple data-photo-input aria-label="اختيار صور من الجهاز"></label>' +
      '</div>' +
      '<div class="busy" id="photoBusy" hidden><span class="spinner" aria-hidden="true"></span><span>جارٍ تجهيز الصور…</span></div>' +
      '<div id="photoMsg" aria-live="assertive"></div>' +
      '<ul class="photo-list" id="photoList" aria-label="الصور المرفقة"></ul>' +
    '</div>' +
  '</section>' +

  /* ---------- STEP 2 ---------- */
  '<section class="panel" id="panel2" aria-labelledby="ph2" hidden>' +
    '<h2 class="sr-only" id="ph2" tabindex="-1">الخطوة 2: المخالفات</h2>' +
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
  '</section>' +

  /* ---------- STEP 3 ---------- */
  '<section class="panel" id="panel3" aria-labelledby="ph3" hidden>' +
    '<h2 class="sr-only" id="ph3" tabindex="-1">الخطوة 3: بيانات المخالف والمراجعة</h2>' +
    '<div id="err3"></div>' +
    '<div class="msg info" id="grazeNote" hidden style="margin-bottom:14px">' + icon('info') + '<div><strong>مخالفة رعي: لا يُدخل المفتش بيانات المخالف</strong>تستكمل الإدارة بيانات المخالف من رقم الشريحة الظاهر في صورة الشريحة. يكفي التوقيع ثم التسليم.</div></div>' +
    '<div class="card" id="offCard">' +
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
      '<div id="offSignWrap">' +
      '<fieldset class="field"><legend>حالة توقيع المخالف</legend><div class="opts">' +
        Object.entries(SIGNATURE).map(([k, v]) => '<label class="opt-card"><input type="radio" name="signature" data-f="signature" value="' + k + '"' + (d.signature === k ? ' checked' : '') + ' aria-describedby="signNote"><span class="radio" aria-hidden="true"></span>' + v + '</label>').join('') +
      '</div><p class="hint" id="signNote">' + SIGN_NOTE + '</p></fieldset>' +
      '<div id="offSigBox"' + (d.signature === 'signed' ? '' : ' hidden') + '>' + sigPadHTML('offenderSig', 'توقيع المخالف', true) + '</div>' +
      '<div id="refusedNote" class="msg warn"' + (d.signature === 'refused' ? '' : ' hidden') + '>' + icon('info') + '<div>سُجّل رفض المخالف للتوقيع. لا حاجة لتوقيع المخالف، ويُكتفى بتوقيع المفتش.</div></div>' +
      '<hr class="divider">' +
      '</div>' +
      sigPadHTML('inspectorSig', 'توقيع المفتش', true) +
      '<hr class="divider">' +
      '<div class="oc-box">' +
        '<div class="card-head" style="margin-bottom:4px"><h3 id="ocH">' + icon('user') + ' بطاقة الضبطية القضائية للمفتش <span class="opt">(اختياري)</span></h3><span class="counter" id="ocCount">0 / 2</span></div>' +
        '<p class="hint" style="margin:0 0 10px">صورة الوجه والظهر. تُحفظ على هذا الجهاز وتُرفق تلقائياً بمحاضرك القادمة، وتظهر في آخر صفحة من ملف المحضر.</p>' +
        '<div class="photo-actions">' +
          '<label class="btn secondary file-btn">' + icon('camera') + '<span>تصوير البطاقة</span><input type="file" id="ocCam" accept="image/*" capture="environment" data-oc-input aria-label="تصوير بطاقة الضبطية القضائية"></label>' +
          '<label class="btn secondary file-btn">' + icon('image') + '<span>اختيار من الجهاز</span><input type="file" id="ocFile" accept="image/*" multiple data-oc-input aria-label="اختيار بطاقة الضبطية القضائية من الجهاز"></label>' +
        '</div>' +
        '<div id="ocMsg" aria-live="assertive"></div>' +
        '<ul class="lv-list" id="ocList" aria-label="صور البطاقة"></ul>' +
      '</div>' +
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
  const [names] = stepNames();
  $('#stepName').textContent = names[n - 1];
  $$('.step-pills button').forEach((b, i) => {
    if (i + 1 === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    const bad = W.tried && W.errSteps.has(i + 1);
    b.classList.toggle('has-err', bad);
    b.setAttribute('aria-label', 'الخطوة ' + (i + 1) + ': ' + names[i] + (bad ? ' (بيانات ناقصة)' : ''));
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
    place: d.place, securityCenter: d.securityCenter, area: d.area.trim(), lat: okCoords ? lat : null, lng: okCoords ? lng : null,
    accuracy: okCoords ? d.accuracy : null, locSource: okCoords ? (d.locSource || 'manual') : null, locAt: okCoords ? d.locAt : null,
    section: d.section, violationNos: d.violationNos.slice().sort((a, b) => a - b),
    violations: d.violationNos.slice().sort((a, b) => a - b).map(n => VBY[n].text),
    chips: needsChips() ? d.chips.map(x => latinDigits(x).trim()).filter(Boolean) : [],
    chipPhotos: needsChips() ? d.chipPhotos : [],
    notes: d.notes, photos: d.photos,
    offenderType: 'person', person: d.person.trim(), qid: latinDigits(d.qid).trim(), phone: latinDigits(d.phone).trim(),
    address: d.address, settlement: d.settlement, signature: needsChips() ? 'unspecified' : d.signature,
    offenderSig: !needsChips() && d.signature === 'signed' ? d.offenderSig : '', inspectorSig: d.inspectorSig, officerCard: d.officerCard
  };
}
function isEmptyDraft(d) {
  return !(d.place.trim() || d.area.trim() || d.securityCenter || W.raw.lat.trim() || W.raw.lng.trim() || d.violationNos.length || d.notes.trim() || d.photos.length || d.chipPhotos.length ||
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
      const both = /[,،;\s]\s*-?\d/.test(latinDigits(t.value).trim()) ? parseCoordText(t.value) : null;
      if (both) {
        setLocation(both.lat, both.lng, null, 'manual');
        locMsg('ok', 'تم إدخال الإحداثيات: خط العرض ' + ltr(both.lat.toFixed(6)) + ' وخط الطول ' + ltr(both.lng.toFixed(6)) + '.');
        return;
      }
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
    if (f === 'place' || f === 'area') renderLocStatus();
    scheduleSave();
    refreshValidation();
  } else if (t.matches('[data-v]')) {
    toggleViolation(Number(t.dataset.v), t.checked);
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
  if (on && CHIP_REQUIRED.includes(no)) W.lastGrazing = no;
  updateViolationUI();
  if (!needsChips() && (W.d.chipPhotos.length || W.d.chips.length)) {
    const had = W.d.chipPhotos.length > 0;
    W.d.chipPhotos = [];
    W.d.chips = [];
    renderChips();
    if (had) toast('أُزيلت صور شرائح الإبل لعدم اختيار أي من مخالفات الرعي (1–4).', 'info');
  }
  scheduleSave();
}
function updateViolationUI() {
  const n = W.d.violationNos.length;
  $$('#vList .vcard').forEach(l => { const i = $('input', l); l.classList.toggle('on', i.checked); });
  $('#vCount').textContent = n ? 'تم اختيار ' + n + (n === 1 ? ' مخالفة' : ' مخالفات') : 'لم يتم الاختيار';
  $('#chipBox').hidden = !needsChips();
  placeChipBox();
  applyGrazingMode();
  $('#vList').removeAttribute('aria-invalid');
}
/* Show/hide the inspector's offender section depending on grazing, and rename step 3. */
function applyGrazingMode() {
  if (!W || !$('#offCard')) return;
  const g = needsChips();
  $('#offCard').hidden = g;
  $('#offSignWrap').hidden = g;
  $('#grazeNote').hidden = !g;
  const [names, short] = stepNames();
  $$('.step-pills button').forEach((b, i) => { $('.lbl-long', b).textContent = names[i]; $('.lbl-short', b).textContent = short[i]; });
  if (W.step) $('#stepName').textContent = names[W.step - 1];
  $('#ph3').textContent = 'الخطوة 3: ' + names[2];
}
/* Camel chip numbers appear directly under the ticked grazing violation (1–4):
   the most recently ticked one, or the last ticked grazing item still selected. */
function placeChipBox() {
  const box = $('#chipBox');
  const sel = W.d.violationNos.filter(n => CHIP_REQUIRED.includes(n));
  if (!sel.length) return;
  const n = sel.includes(W.lastGrazing) ? W.lastGrazing : sel[sel.length - 1];
  const card = $('label[for="v' + n + '"]');
  if (card && card.nextElementSibling !== box) {
    const focused = box.contains(document.activeElement) ? document.activeElement : null;
    card.after(box);
    if (focused) focused.focus({ preventScroll: true });
  }
  box.setAttribute('aria-label', 'أرقام شرائح الإبل — البند ' + n);
}
function renderChips() {
  const box = $('#chipList');
  if (!box) return;
  const list = W.d.chipPhotos;
  box.innerHTML = list.map((pg, i) => '<li class="lv-item"><button class="pthumb" type="button" data-action="zoom-chip" data-id="' + esc(pg.id) + '" aria-label="عرض صورة الشريحة ' + (i + 1) + '"><img src="' + esc(pg.thumb || pg.preview) + '" alt=""></button>' +
    '<span class="meta"><b>شريحة ' + (i + 1) + '</b>' + (pg.origSize ? fmtBytes(pg.origSize) : '') + '</span>' +
    '<button class="icon-btn danger" type="button" data-action="del-chip" data-id="' + esc(pg.id) + '" aria-label="حذف صورة الشريحة ' + (i + 1) + '">' + icon('trash') + '</button></li>').join('');
  $('#chipCount').textContent = list.length + ' / ' + MAX_CHIP_PHOTOS;
  const i = $('#chipCam'), full = list.length >= MAX_CHIP_PHOTOS;
  if (i) { i.disabled = full; i.parentNode.classList.toggle('is-disabled', full); }
}
async function addChipPhotos(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length || !W) return;
  const wizard = W, errors = [];
  $('#chipBusy').hidden = false;
  for (const f of files) {
    if (W !== wizard) return;
    if (W.d.chipPhotos.length >= MAX_CHIP_PHOTOS) { errors.push('الحد الأقصى ' + MAX_CHIP_PHOTOS + ' صور للشرائح.'); break; }
    try { const pg = await processImage(f, 1400); delete pg.gps; W.d.chipPhotos.push(pg); }
    catch (e) { errors.push('«' + (f.name || 'صورة') + '»: ' + e.message); }
  }
  if (W !== wizard) return;
  $('#chipBusy').hidden = true;
  renderChips();
  $('#chipMsg').innerHTML = errors.length ? '<div class="msg bad" style="margin-top:10px">' + icon('alert') + '<div><ul>' + errors.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul></div></div>' : '';
  refreshValidation();
  if (!saveNow()) toast('تعذر حفظ صورة الشريحة محلياً: مساحة التخزين ممتلئة.', 'bad');
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
  } else if (W.d.place.trim() || W.d.area.trim()) {
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
/* Demo location: used where the device location cannot be reached (e.g. inside claude.ai). */
function mockLocate(reason) {
  const btn = $('#locBtn');
  const wizard = W;
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  btn.querySelector('span').textContent = 'جارٍ تحديد الموقع…';
  locMsg('info', 'جارٍ تحديد الموقع (محاكاة)…');
  setTimeout(() => {
    if (W !== wizard) return;
    btn.disabled = false; btn.removeAttribute('aria-busy'); btn.querySelector('span').textContent = 'تحديث موقعي';
    const m = SECURITY_CENTERS.find(x => x[0] === W.d.securityCenter);
    const base = m ? [m[1], m[2]] : [25.4495, 51.2234];
    const j = () => (Math.random() - 0.5) * (m ? 0.03 : 0.01);
    setLocation(base[0] + j(), base[1] + j(), 6 + Math.round(Math.random() * 10), 'mock');
    locMsg('warn', '<strong>موقع تجريبي (محاكاة GPS)</strong>' + esc(reason) + ' وُلِّدت إحداثيات تجريبية' + (m ? ' ضمن نطاق ' + esc(m[0]) : '') +
      ' لأغراض العرض فقط، وتظهر في المحضر بوصف «محاكاة GPS». للموقع الحقيقي: التقط صورة تحفظ الموقع، أو الصق الإحداثيات من الخرائط.');
  }, 1100);
}
/* True where the device location cannot be used: inside an embedded viewer, on the claude.ai
   artifact host, or when the page's permissions policy disallows geolocation. */
function geolocationBlocked() {
  try {
    const pol = document.permissionsPolicy || document.featurePolicy;
    if (pol && typeof pol.allowsFeature === 'function' && !pol.allowsFeature('geolocation')) return true;
  } catch (e) { /* ignore */ }
  if (EMBEDDED) return true;
  if (window.claude && typeof window.claude.use === 'function') return true;
  return /(^|\.)claude\.(ai|site)$|claudeusercontent|anthropic/i.test(location.hostname || '');
}
function useMyLocation() {
  const btn = $('#locBtn');
  // The button always ends with a location: real GPS where possible, otherwise a clearly marked demo location.
  if (geolocationBlocked()) { mockLocate('المنصة تمنع الوصول إلى موقع الجهاز داخل claude.ai؛'); return; }
  if (!('geolocation' in navigator)) { mockLocate('هذا المتصفح لا يدعم خدمة تحديد الموقع؛'); return; }
  if (window.isSecureContext === false) { mockLocate('تحديد الموقع يتطلب فتح التطبيق عبر https؛'); return; }
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  btn.querySelector('span').textContent = 'جارٍ تحديد الموقع…';
  locMsg('info', 'جارٍ الحصول على موقعك من GPS… يُفضّل الوقوف في مكان مكشوف.');
  const wizard = W;
  let settled = false;
  const finish = () => {
    if (settled || W !== wizard) return false;
    settled = true;
    clearTimeout(watchdog);
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    btn.querySelector('span').textContent = 'تحديث موقعي';
    return true;
  };
  // Some in-app browsers never answer a location request: fall back after 12 seconds.
  const watchdog = setTimeout(() => { if (finish()) mockLocate('لم يستجب الجهاز لطلب الموقع؛'); }, 12000);
  try {
    navigator.geolocation.getCurrentPosition(pos => {
      if (!finish()) return;
      const { latitude, longitude, accuracy } = pos.coords;
      setLocation(latitude, longitude, accuracy, 'gps');
      const acc = Math.round(accuracy);
      if (acc > 100) locMsg('warn', '<strong>تم تحديد الموقع بدقة منخفضة (±' + acc + ' م)</strong>يمكنك إعادة المحاولة في مكان مكشوف، أو تعديل النقطة على الخريطة.');
      else locMsg('ok', 'تم تحديد موقعك بدقة تقارب ±' + acc + ' متر.');
      if (!inQatar(latitude, longitude)) locMsg('warn', '<strong>الموقع خارج حدود دولة قطر</strong>تحقق من صحة الموقع قبل المتابعة.');
    }, err => {
      if (!finish()) return;
      const R = {
        1: 'تم رفض إذن الوصول إلى الموقع (يمكن تفعيله من إعدادات المتصفح)؛',
        2: 'إشارة GPS غير متوفرة حالياً؛',
        3: 'انتهت مهلة تحديد الموقع قبل وصول إشارة GPS؛'
      };
      mockLocate(R[err && err.code] || 'تعذر تحديد موقع الجهاز؛');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  } catch (e) {
    if (finish()) mockLocate('تعذر طلب موقع الجهاز؛');
  }
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
/* Read GPS coordinates stored by the camera in a JPEG (EXIF). Returns {lat,lng} or null. */
async function readExifGps(file) {
  try {
    const v = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null;
    let off = 2;
    while (off + 4 <= v.byteLength) {
      const marker = v.getUint16(off);
      if ((marker & 0xFF00) !== 0xFF00 || marker === 0xFFDA) return null;
      const size = v.getUint16(off + 2);
      if (marker === 0xFFE1 && off + 10 <= v.byteLength && v.getUint32(off + 4) === 0x45786966) return parseExifGps(v, off + 10);
      off += 2 + size;
    }
  } catch (e) { /* no usable EXIF */ }
  return null;
}
function parseExifGps(v, t) {
  const le = v.getUint16(t) === 0x4949;
  const u16 = o => v.getUint16(t + o, le), u32 = o => v.getUint32(t + o, le);
  const ifd0 = u32(4);
  let gps = 0;
  for (let i = 0, n = u16(ifd0); i < n; i++) { const e = ifd0 + 2 + i * 12; if (u16(e) === 0x8825) gps = u32(e + 8); }
  if (!gps) return null;
  const tags = {};
  for (let i = 0, n = u16(gps); i < n; i++) {
    const e = gps + 2 + i * 12, tag = u16(e), type = u16(e + 2), cnt = u32(e + 4);
    if (type === 2) tags[tag] = String.fromCharCode(v.getUint8(t + e + 8));
    else if (type === 5) { const o = u32(e + 8); tags[tag] = Array.from({ length: Math.min(cnt, 3) }, (_, k) => u32(o + k * 8) / (u32(o + k * 8 + 4) || 1)); }
  }
  if (!tags[2] || !tags[4] || tags[2].length < 3 || tags[4].length < 3) return null;
  const dms = a => a[0] + a[1] / 60 + a[2] / 3600;
  let lat = dms(tags[2]), lng = dms(tags[4]);
  if (tags[1] === 'S') lat = -lat;
  if (tags[3] === 'W') lng = -lng;
  if (!validLat(lat) || !validLng(lng) || (Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6)) return null;
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, acc: tags[31] ? Math.round(tags[31][0]) : null };
}
/* Accepts "25.4495, 51.2234", "N 25.4495 E 51.2234", or a Google/Apple Maps link. */
function parseCoordText(text) {
  const t = latinDigits(String(text || '')).replace(/[٫]/g, '.').replace(/،/g, ',');
  const m = t.match(/@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/) || t.match(/[?&](?:q|query|ll|daddr|center)=(-?\d{1,2}\.\d+)(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i) ||
    t.match(/(-?\d{1,2}\.\d{3,})\s*°?\s*[NnSs]?\s*[,;\s]\s*[EeWw]?\s*(-?\d{1,3}\.\d{3,})/) || t.match(/[Nn]\s*(-?\d{1,2}\.\d+)[^\d-]+[Ee]\s*(-?\d{1,3}\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  return validLat(lat) && validLng(lng) ? { lat, lng } : null;
}
function locationBlockedHelp() {
  return '<strong>تحديد الموقع التلقائي غير متاح داخل claude.ai</strong>' +
    'المنصة تمنع الصفحات المنشورة من الوصول إلى موقع الجهاز، ولا يوجد إعداد يغيّر ذلك. البدائل:' +
    '<ul><li><b>من الصورة:</b> التقط صورة المخالفة أدناه؛ إذا كانت الكاميرا تحفظ الموقع تُملأ الإحداثيات تلقائياً.</li>' +
    '<li><b>من الخرائط:</b> افتح <a href="https://www.google.com/maps" target="_blank" rel="noopener">خرائط Google</a>، اضغط مطولاً على موقعك وانسخ الإحداثيات، ثم الصقها في حقل خط العرض (يُملأ الحقلان معاً).</li>' +
    '<li>أو اكتب وصف الموقع. يعمل GPS مباشرة عند فتح التطبيق من ملفه أو من رابط https.</li></ul>';
}
async function processImage(f, maxPx) {
  if (f.size === 0) throw new Error('الملف فارغ أو تالف.');
  if (f.size > MAX_BYTES) throw new Error('حجم الملف ' + fmtBytes(f.size) + ' يتجاوز الحد المسموح (10 م.ب). خفّض دقة الكاميرا (مثل 12 ميغابكسل) ثم أعد الالتقاط.');
  const declared = (f.type === 'application/octet-stream') ? '' : (MIME_ALIASES[f.type] || f.type);
  const actual = await sniffType(f);
  if (declared === 'image/heic' || declared === 'image/heif' || actual === 'image/heic') throw new Error('صيغة HEIC غير مدعومة في المتصفح. اختر صورة JPG أو PNG، أو اضبط الكاميرا على صيغة «الأكثر توافقاً».');
  if (declared && !ALLOWED_MIME.includes(declared)) throw new Error('نوع الملف (' + (declared || 'غير معروف') + ') غير مسموح. الصيغ المقبولة: JPG وPNG وWEBP.');
  if (!actual) throw new Error('محتوى الملف ليس صورة صالحة أو أن الملف تالف.');
  if (declared && declared !== actual) throw new Error('نوع الملف المعلن لا يطابق محتواه الفعلي.');
  let img;
  try { img = await decodeImage(f); } catch (e) { throw new Error('تعذر قراءة الصورة؛ قد يكون الملف تالفاً.'); }
  if (img.naturalWidth > MAX_DIMENSION || img.naturalHeight > MAX_DIMENSION) throw new Error('أبعاد الصورة كبيرة جداً.');
  let preview, thumb;
  try { preview = toJpeg(img, maxPx || PREVIEW_MAX, maxPx ? 0.8 : 0.72); thumb = toJpeg(img, THUMB_MAX, 0.7); }
  catch (e) { throw new Error('تعذر تجهيز معاينة الصورة.'); }
  return {
    id: uid('ph_'), preview, thumb, caption: '', category: 'field',
    name: f.name || 'صورة', type: actual, origSize: f.size, w: img.naturalWidth, h: img.naturalHeight, addedAt: new Date().toISOString(),
    gps: actual === 'image/jpeg' ? await readExifGps(f) : null
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
  setPhotoInputsDisabled(true);
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
    const withGps = W.d.photos.slice(-added).find(ph => ph.gps);
    if (withGps && !currentCoords().ok) {
      setLocation(withGps.gps.lat, withGps.gps.lng, withGps.gps.acc, 'photo');
      locMsg('ok', '<strong>تم تحديد الموقع من بيانات الصورة</strong>الإحداثيات مأخوذة من الموقع الذي حفظته الكاميرا داخل الصورة. تحقق منها قبل المتابعة.');
    }
    refreshValidation();
    if (!saveNow()) {
      $('#photoMsg').insertAdjacentHTML('beforeend', '<div class="msg bad" style="margin-top:12px">' + icon('alert') + '<div>تعذر حفظ الصور محلياً بسبب امتلاء مساحة التخزين. احذف بعض الصور أو المسودات القديمة.</div></div>');
    }
  }
}
/* Letter pages (كتاب إدارة الثروة الحيوانية): kept larger so the text stays readable. */
/* Mock Animal Resources registry: returns a clearly fictional owner for a chip number.
   Stands in for the real lookup service; nothing leaves the device. */
function mockRegistryLookup(chip) {
  return new Promise(resolve => setTimeout(() => {
    const digits = latinDigits(chip).replace(/\D/g, '');
    if (digits.length < 8) { resolve({ ok: false, reason: 'رقم الشريحة غير مكتمل (8 أرقام على الأقل).' }); return; }
    let h = 0;
    for (const ch of digits) h = (h * 31 + Number(ch)) % 100003;
    if (h % 10 === 7) { resolve({ ok: false, reason: 'لم يُعثر على الشريحة في سجل الثروة الحيوانية.' }); return; }
    resolve({ ok: true, owner: {
      name: 'مالك تجريبي ' + digits.slice(-4) + ' (بيانات تجريبية)',
      qid: '2' + String(h).padStart(5, '0') + digits.slice(-5),
      phone: '5' + String(h * 7 % 10000000).padStart(7, '0'),
      area: AREA_SUGGESTIONS[h % AREA_SUGGESTIONS.length]
    } });
  }, 700));
}
function updateCaseOwner(id, fn) {
  const cur = getCase(id);
  if (!cur || !ADMIN_PENDING.includes(cur.status)) { toast('لا يمكن التعديل: تغيرت حالة المحضر.', 'bad'); return false; }
  const c = clone(cur);
  fn(c);
  c.updatedAt = new Date().toISOString();
  try { upsertCase(c); return true; } catch (e) { toast('تعذر الحفظ محلياً.', 'bad'); return false; }
}
function ownerBoxHTML(c) {
  const id = esc(c.id);
  const rows = Math.max(c.chipPhotos.length, c.chips.length, 1);
  let html = '<div class="lv-box owner-box" id="ownerBox">' +
    '<div class="card-head" style="margin-bottom:4px"><h3>' + icon('user') + ' بيانات المخالف من رقم الشريحة <span class="req">*</span></h3></div>' +
    '<p class="hint" style="margin:0 0 10px">اقرأ رقم الشريحة من الصورة وأدخله، ثم اضغط «استرجاع» لجلب بيانات المالك من سجل الثروة الحيوانية (محاكاة).</p>';
  for (let i = 0; i < rows; i++) {
    const ph = c.chipPhotos[i], no = c.chips[i] || '', res = no ? c.chipLookup[no] : null;
    html += '<div class="owner-row">' +
      (ph ? '<button class="pthumb" type="button" data-action="zoom" data-kind="chip" data-case="' + id + '" data-id="' + esc(ph.id) + '" aria-label="تكبير صورة الشريحة ' + (i + 1) + '"><img src="' + esc(ph.thumb || ph.preview) + '" alt=""></button>' : '') +
      '<div class="owner-main"><label for="chipno' + i + '">رقم الشريحة ' + (i + 1) + '</label>' +
        '<div class="owner-in"><input id="chipno' + i + '" type="text" class="num-input" inputmode="numeric" data-chipno="' + i + '" data-id="' + id + '" value="' + esc(no) + '" placeholder="مثال: 634097400062064" autocomplete="off" spellcheck="false">' +
        '<button class="btn secondary" type="button" data-action="lookup-chip" data-i="' + i + '" data-id="' + id + '">استرجاع</button></div>' +
        (res ? (res.ok
          ? '<div class="owner-res ok"><b>' + esc(res.owner.name) + '</b><span>الرقم الشخصي: ' + ltr(res.owner.qid) + ' · الهاتف: ' + ltr(res.owner.phone) + ' · ' + esc(res.owner.area) + '</span>' +
            (c.person === res.owner.name ? '<em>معتمد كمخالف</em>' : '<button class="btn ghost sm" type="button" data-action="use-owner" data-chip="' + esc(no) + '" data-id="' + id + '">اعتماد كمخالف</button>') + '</div>'
          : '<div class="owner-res bad">' + esc(res.reason) + ' يمكن إدخال البيانات يدوياً أدناه.</div>') : '') +
      '</div></div>';
  }
  html += '<div class="grid2" style="margin-top:10px">' +
      '<div class="field"><label for="own-person">اسم المخالف <span class="req">*</span></label><input id="own-person" type="text" data-own="person" data-id="' + id + '" value="' + esc(c.person) + '"></div>' +
      '<div class="field"><label for="own-qid">رقم البطاقة الشخصية</label><input id="own-qid" type="text" class="num-input" inputmode="numeric" data-own="qid" data-id="' + id + '" value="' + esc(c.qid) + '"></div>' +
      '<div class="field"><label for="own-phone">الهاتف</label><input id="own-phone" type="tel" class="num-input" data-own="phone" data-id="' + id + '" value="' + esc(c.phone) + '"></div>' +
      '<div class="field"><label for="own-address">العنوان</label><input id="own-address" type="text" data-own="address" data-id="' + id + '" value="' + esc(c.address) + '"></div>' +
    '</div></div>';
  return html;
}
function refreshOwnerBox(id) {
  const box = $('#ownerBox'), c = getCase(id);
  if (!box || !c) return;
  const note = $('#decNote') ? $('#decNote').value : '';
  box.outerHTML = ownerBoxHTML(c);
  if ($('#decNote')) $('#decNote').value = note;
  const err = $('#decErr'); if (err) err.textContent = '';
}
async function lookupChip(id, i, btn) {
  const input = document.getElementById('chipno' + i);
  const no = latinDigits(input ? input.value : '').replace(/\s/g, '');
  if (!no) { input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
  btn.disabled = true; btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>جارٍ الاسترجاع…';
  const res = await mockRegistryLookup(no);
  updateCaseOwner(id, c => {
    c.chips[i] = no;
    c.chips = c.chips.filter(Boolean);
    c.chipLookup[no] = res;
    if (res.ok && !c.person) { applyOwner(c, res.owner); }
  });
  refreshOwnerBox(id);
}
function applyOwner(c, o) {
  c.person = o.name; c.qid = o.qid; c.phone = o.phone; c.address = o.area; c.offenderSource = 'registry';
}

/* كتاب إدارة الثروة الحيوانية: attached by the director when approving a grazing report. */
function isGrazing(c) { return c.violationNos.some(n => CHIP_REQUIRED.includes(n)); }
function updateCaseLetter(id, fn) {
  const cur = getCase(id);
  if (!cur || cur.status !== 'forwarded') { toast('لا يمكن تعديل الكتاب: تغيرت حالة المحضر.', 'bad'); return false; }
  const c = clone(cur);
  c.livestock = c.livestock || { reqNo: '', date: '', pages: [] };
  fn(c.livestock);
  c.updatedAt = new Date().toISOString();
  try { upsertCase(c); return true; } catch (e) { toast(isQuota(e) ? 'تعذر الحفظ: مساحة التخزين المحلي ممتلئة.' : 'تعذر الحفظ محلياً.', 'bad'); return false; }
}
function letterBoxHTML(c) {
  const lv = c.livestock || { reqNo: '', date: '', pages: [] };
  const full = lv.pages.length >= MAX_LETTER_PAGES;
  const id = esc(c.id);
  return '<div class="lv-box" id="lvBox">' +
    '<div class="card-head" style="margin-bottom:4px"><h3 id="lvH">' + icon('inbox') + ' كتاب إدارة الثروة الحيوانية <span class="req">*</span></h3><span class="counter">' + lv.pages.length + ' / ' + MAX_LETTER_PAGES + '</span></div>' +
    '<p class="hint" style="margin:0 0 10px">مخالفة رعي: أرفق إفادة إدارة الثروة الحيوانية حول شريحة الإبل' + (c.chips.length ? ' (<bdi dir="ltr">' + esc(c.chips.join('، ')) + '</bdi>)' : c.chipPhotos.length ? ' (صور الشرائح مرفقة في المحضر: ' + c.chipPhotos.length + ')' : '') + ' قبل الاعتماد.</p>' +
    '<div class="grid2">' +
      '<div class="field"><label for="lv-req">رقم طلب الإفادة <span class="opt">(اختياري)</span></label><input id="lv-req" type="text" class="num-input" inputmode="numeric" data-lvr="reqNo" data-id="' + id + '" value="' + esc(lv.reqNo) + '" autocomplete="off"></div>' +
      '<div class="field"><label for="lv-date">تاريخ الإفادة <span class="opt">(اختياري)</span></label><input id="lv-date" type="date" data-lvr="date" data-id="' + id + '" value="' + esc(lv.date) + '"></div>' +
    '</div>' +
    '<div class="photo-actions">' +
      '<label class="btn secondary file-btn' + (full ? ' is-disabled' : '') + '">' + icon('camera') + '<span>تصوير الكتاب</span><input type="file" id="lvCam" accept="image/*" capture="environment" data-lv-input data-id="' + id + '"' + (full ? ' disabled' : '') + ' aria-label="تصوير كتاب الثروة الحيوانية"></label>' +
      '<label class="btn secondary file-btn' + (full ? ' is-disabled' : '') + '">' + icon('image') + '<span>اختيار من الجهاز</span><input type="file" id="lvFile" accept="image/*" multiple data-lv-input data-id="' + id + '"' + (full ? ' disabled' : '') + ' aria-label="اختيار كتاب الثروة الحيوانية من الجهاز"></label>' +
    '</div>' +
    '<div id="lvMsg" aria-live="assertive"></div>' +
    '<ul class="lv-list" aria-label="صفحات الكتاب المرفقة">' + lv.pages.map((pg, i) =>
      '<li class="lv-item"><button class="pthumb" type="button" data-action="zoom" data-kind="lv" data-case="' + id + '" data-id="' + esc(pg.id) + '" aria-label="عرض صفحة الكتاب ' + (i + 1) + '"><img src="' + esc(pg.thumb || pg.preview) + '" alt=""></button>' +
      '<span class="meta"><b>صفحة ' + (i + 1) + '</b>' + (pg.origSize ? fmtBytes(pg.origSize) : '') + '</span>' +
      '<button class="icon-btn danger" type="button" data-action="del-lv" data-case="' + id + '" data-id="' + esc(pg.id) + '" aria-label="حذف صفحة الكتاب ' + (i + 1) + '">' + icon('trash') + '</button></li>').join('') + '</ul>' +
  '</div>';
}
function refreshLetterBox(id, msgHtml) {
  const box = $('#lvBox'), c = getCase(id);
  if (!box || !c) return;
  box.outerHTML = letterBoxHTML(c);
  if (msgHtml) $('#lvMsg').innerHTML = msgHtml;
  const err = $('#decErr'); if (err) err.textContent = '';
}
async function addLetterPages(id, fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const errors = [];
  for (const f of files) {
    const c = getCase(id);
    if (!c || c.status !== 'forwarded') break;
    if ((c.livestock ? c.livestock.pages.length : 0) >= MAX_LETTER_PAGES) { errors.push('الحد الأقصى ' + MAX_LETTER_PAGES + ' صفحات للكتاب.'); break; }
    try { const pg = await processImage(f, 1600); delete pg.gps; if (!updateCaseLetter(id, lv => lv.pages.push(pg))) break; }
    catch (e) { errors.push('«' + (f.name || 'صورة') + '»: ' + e.message); }
  }
  refreshLetterBox(id, errors.length ? '<div class="msg bad" style="margin-top:10px">' + icon('alert') + '<div><ul>' + errors.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul></div></div>' : '');
}
async function addOfficerCard(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length || !W) return;
  const wizard = W, errors = [];
  for (const f of files) {
    if (W !== wizard) return;
    if (W.d.officerCard.length >= 2) { errors.push('يكفي وجه البطاقة وظهرها (صورتان).'); break; }
    try { const pg = await processImage(f, 1400); delete pg.gps; W.d.officerCard.push(pg); }
    catch (e) { errors.push('«' + (f.name || 'صورة') + '»: ' + e.message); }
  }
  if (W !== wizard) return;
  saveOfficerCardProfile();
  renderOfficerCard();
  $('#ocMsg').innerHTML = errors.length ? '<div class="msg bad" style="margin-top:10px">' + icon('alert') + '<div><ul>' + errors.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul></div></div>' : '';
  if (!saveNow()) toast('تعذر حفظ صورة البطاقة محلياً: مساحة التخزين ممتلئة.', 'bad');
}
function saveOfficerCardProfile() {
  const pr = getProfile();
  pr.officerCard = W.d.officerCard;
  setProfile(pr);
}
function renderOfficerCard() {
  const ul = $('#ocList');
  if (!ul || !W) return;
  const list = W.d.officerCard;
  const label = i => (i === 0 ? 'وجه البطاقة' : 'ظهر البطاقة');
  ul.innerHTML = list.map((pg, i) => '<li class="lv-item"><button class="pthumb" type="button" data-action="zoom-oc" data-id="' + esc(pg.id) + '" aria-label="عرض ' + label(i) + '"><img src="' + esc(pg.thumb || pg.preview) + '" alt=""></button>' +
    '<span class="meta"><b>' + label(i) + '</b>' + (pg.origSize ? fmtBytes(pg.origSize) : '') + '</span>' +
    '<button class="icon-btn danger" type="button" data-action="del-oc" data-id="' + esc(pg.id) + '" aria-label="حذف ' + label(i) + '">' + icon('trash') + '</button></li>').join('');
  $('#ocCount').textContent = list.length + ' / 2';
  ['ocCam', 'ocFile'].forEach(id => { const i = document.getElementById(id); if (i) { i.disabled = list.length >= 2; i.parentNode.classList.toggle('is-disabled', list.length >= 2); } });
}
function setPhotoInputsDisabled(off) {
  ['camInput', 'fileInput'].forEach(id => { const i = document.getElementById(id); if (i) { i.disabled = off; i.parentNode.classList.toggle('is-disabled', off); } });
}
function updatePhotoButtons() {
  const full = W.d.photos.length >= MAX_PHOTOS;
  setPhotoInputsDisabled(full || W.busy);
  $('#photoCount').textContent = W.d.photos.length + ' / ' + MAX_PHOTOS;
}
function renderPhotos() {
  const ul = $('#photoList');
  if (!ul) return;
  ul.innerHTML = W.d.photos.map((p, i) => {
    const n = i + 1;
    return '<li class="pcard">' +
      '<button class="pthumb" type="button" data-action="zoom" data-id="' + esc(p.id) + '" aria-label="عرض الصورة ' + n + ' بحجم أكبر"><img src="' + esc(p.thumb || p.preview) + '" alt="" decoding="async"></button>' +
        '<div class="ptop"><span class="meta"><b>صورة ' + n + '</b>' + (p.origSize ? fmtBytes(p.origSize) + ' · ' : '') + (p.w ? ltr(p.w + '×' + p.h) : 'صورة سابقة') +
          (p.gps ? '<button class="pgps" type="button" data-action="photo-loc" data-id="' + esc(p.id) + '">' + icon('pin') + 'استخدام موقع الصورة</button>' : '') + '</span>' +
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
    else if (lat === null && !d.place.trim() && !d.area.trim()) e.push({ f: 'locBtn', m: 'لم يتم تحديد موقع المخالفة. استخدم «استخدام موقعي»، أو أدخل الإحداثيات، أو اختر المنطقة.' });
    if (W.busy) e.push({ f: 'camInput', m: 'انتظر حتى ينتهي تجهيز الصور.' });
    else if (!d.photos.length) e.push({ f: 'camInput', m: 'أرفق صورة واحدة على الأقل للمخالفة (التقاط صورة أو اختيار من الجهاز).' });
  }
  if (s === 2) {
    if (!d.violationNos.length) e.push({ f: 'vList', m: 'اختر مخالفة واحدة على الأقل.' });
    if (needsChips() && !d.chipPhotos.length) e.push({ f: 'chipCam', m: 'التقط بالكاميرا صورة لشريحة الإبل (صورة واحدة على الأقل) لمخالفات الرعي (البنود 1–4).' });
  }
  if (s === 3) {
    if (!needsChips() && !d.person.trim()) e.push({ f: 'f-person', m: 'أدخل اسم المخالف.' });
    if (!needsChips() && d.signature === 'signed' && !d.offenderSig) e.push({ f: 'pad-offenderSig', m: 'ارسم توقيع المخالف في المكان المخصص، أو غيّر حالة التوقيع.' });
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
    sec('الموقع والزمان والصور', 1, kvRows([
      ['التاريخ', fmtDate(d.date) + ' · ' + esc(fmtTime12(d.time))],
      ['المفتش', esc(d.inspectorName || '—')],
      ['المركز الأمني', esc(d.securityCenter || '—')],
      ['المنطقة', esc(d.area || '—')],
      ['الموقع', esc(d.place || '—')],
      ['الإحداثيات', c.ok ? ltr(c.lat.toFixed(6) + ', ' + c.lng.toFixed(6)) + (d.accuracy != null ? ' · ±' + d.accuracy + ' م' : '') : 'غير محددة'],
      ['الصور', d.photos.length ? d.photos.length + ' من ' + MAX_PHOTOS + ' (' + d.photos.filter(p => p.category === 'field').length + ' ميدانية، ' + d.photos.filter(p => p.category === 'support').length + ' دليل داعم)' : '<span class="field-error">لا توجد صور</span>']
    ])) +
    sec('المخالفات', 2,
      (d.violationNos.length ? '<ul class="vsum">' + d.violationNos.map(n => '<li><span class="vnum">' + n + '</span><span>' + esc(VBY[n].text) + '</span></li>').join('') + '</ul>' : '<p class="field-error">لم يتم اختيار مخالفات.</p>') +
      (needsChips() ? '<p style="margin-top:8px"><b>صور الشرائح:</b> ' + (d.chipPhotos.length ? d.chipPhotos.length + (d.chipPhotos.length === 1 ? ' صورة' : ' صور') : '<span class="field-error">لم تُلتقط</span>') + '</p>' +
        '<p class="hint" style="margin-top:4px">يُرفق كتاب إدارة الثروة الحيوانية عند اعتماد المدير.</p>' : '')) +
    (needsChips() ? sec('بيانات المخالف', 3, '<p class="hint" style="margin:0">تستكملها الإدارة من رقم الشريحة.</p>') : '') +
    sec('التوقيعات', 3, kvRows([
      needsChips() ? null : ['توقيع المخالف', d.signature === 'signed' ? (d.offenderSig ? 'تم التوقيع' : '<span class="field-error">لم يُرسم التوقيع</span>') : esc(SIGNATURE[d.signature])],
      ['توقيع المفتش', d.inspectorSig ? 'تم التوقيع' : '<span class="field-error">لم يُرسم التوقيع</span>']
    ])) +
    '<div style="padding-top:12px"><p class="hint">' + (needsChips() ? 'تأكد من صور الشرائح والتوقيع قبل التسليم.' : 'تأكد من صحة بيانات المخالف أعلاه قبل التسليم.') + '</p>' +
    '<button class="btn secondary" type="button" data-action="wiz-preview" style="margin-top:10px">' + icon('eye') + 'معاينة المحضر بصيغة النموذج</button></div>';
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
/* Reviewer roles: الإدارة reviews and forwards; المدير approves. */
const ROLES = {
  admin: { name: 'الإدارة', portal: 'بوابة الإدارة', home: 'لوحة الإدارة', inbox: 'صندوق المحاضر', pending: ADMIN_PENDING, prefix: 'admin' },
  director: { name: 'المدير', portal: 'بوابة المدير', home: 'لوحة المدير', inbox: 'محاضر المدير', pending: DIRECTOR_PENDING, prefix: 'director' }
};
function lastAction(c, action) { return c.history.slice().reverse().find(h => h.action === action) || null; }
function roleList(role) {
  const all = readCases().filter(c => c.status !== 'draft');
  if (role === 'director') return all.filter(c => ['forwarded', 'approved', 'director_returned'].includes(c.status) || c.history.some(h => h.action === 'forwarded'));
  return all;
}
function adminTable(list, role) {
  const R = ROLES[role];
  return '<div class="table-wrap"><table class="rows"><caption class="sr-only">قائمة المحاضر</caption><thead><tr>' +
    '<th scope="col">رقم المحضر</th><th scope="col">تاريخ الضبط</th><th scope="col">الموقع</th><th scope="col">المخالف</th><th scope="col">المخالفات</th><th scope="col">الحالة</th><th scope="col"><span class="sr-only">إجراء</span></th></tr></thead><tbody>' +
    list.map(c => {
      const pend = R.pending.includes(c.status);
      return '<tr' + (c.status === 'returned' || c.status === 'director_returned' ? ' class="is-returned"' : '') + '><td>' + ltr(c.id) + '</td><td>' + fmtDate(c.date) + '</td><td>' + locText(c) + '</td><td>' + esc(c.person || '—') + '</td><td>' + (c.violationNos.length ? ltr(c.violationNos.join(', ')) : '—') + '</td><td>' + badge(c.status) + '</td>' +
        '<td><a class="btn ' + (pend ? 'primary' : 'secondary') + ' sm" href="#' + R.prefix + '-review-' + enc(c.id) + '">' + (pend ? (role === 'admin' ? 'مراجعة' : 'اعتماد') : 'عرض') + '</a></td></tr>';
    }).join('') +
    '</tbody></table></div>';
}
function adminCollection(list, emptyText, role) {
  if (!list.length) return emptyState(emptyText);
  return adminTable(list, role) + '<div class="cards grid-2 mobile-only">' + list.map(c => reportCard(c, role)).join('') + '</div>';
}
const byQueueTime = (a, b) => String(a.updatedAt || a.createdAt || '').localeCompare(String(b.updatedAt || b.createdAt || ''));
function renderAdminHome(view) {
  const list = sortRecent(roleList('admin'));
  const pending = list.filter(c => ADMIN_PENDING.includes(c.status)).sort(byQueueTime);
  const n = (...s) => list.filter(c => s.includes(c.status)).length;
  view.innerHTML =
    '<div class="page-head"><div><p class="eyebrow">بوابة الإدارة</p><h1>لوحة الإدارة</h1><p class="lead">مراجعة المحاضر المسلّمة من المفتشين، ثم تحويلها إلى المدير للاعتماد أو إرجاعها للمفتش.</p></div></div>' +
    '<div class="stats four" role="list">' +
      '<a role="listitem" class="stat st-review" href="#admin-inbox-pending"><span class="stat-label">بانتظار مراجعتك</span><strong>' + n('submitted', 'resubmitted', 'director_returned') + '</strong></a>' +
      '<a role="listitem" class="stat st-review2" href="#admin-inbox-forwarded"><span class="stat-label">لدى المدير</span><strong>' + n('forwarded') + '</strong></a>' +
      '<a role="listitem" class="stat st-action" href="#admin-inbox-returned"><span class="stat-label">معادة للمفتش</span><strong>' + n('returned') + '</strong></a>' +
      '<a role="listitem" class="stat st-ok" href="#admin-inbox-approved"><span class="stat-label">معتمدة</span><strong>' + n('approved') + '</strong></a>' +
    '</div>' +
    '<div class="sec-head"><h2>بانتظار مراجعتك (' + pending.length + ')</h2><a href="#admin-inbox">صندوق المحاضر</a></div>' +
    (pending.length ? adminCollection(pending, '', 'admin') : emptyState('لا توجد محاضر بانتظار المراجعة حالياً.', list.length ? '' : sampleBtn())) +
    samplesNote() +
    '<div class="legal-note" style="margin-top:16px">' + icon('info') + '<span>' + LEGAL_NOTE + '</span></div>';
  return 'لوحة الإدارة';
}
function renderDirectorHome(view) {
  const list = sortRecent(roleList('director'));
  const pending = list.filter(c => c.status === 'forwarded').sort(byQueueTime);
  const n = s => list.filter(c => c.status === s).length;
  view.innerHTML =
    '<div class="page-head"><div><p class="eyebrow">بوابة المدير</p><h1>لوحة المدير</h1><p class="lead">اعتماد المحاضر التي راجعتها الإدارة وحوّلتها إليك، أو إعادتها إلى الإدارة.</p></div></div>' +
    '<div class="stats" role="list">' +
      '<a role="listitem" class="stat st-review2" href="#director-inbox-pending"><span class="stat-label">بانتظار اعتمادك</span><strong>' + n('forwarded') + '</strong></a>' +
      '<a role="listitem" class="stat st-ok" href="#director-inbox-approved"><span class="stat-label">معتمدة</span><strong>' + n('approved') + '</strong></a>' +
      '<a role="listitem" class="stat st-action" href="#director-inbox-director_returned"><span class="stat-label">أعيدت للإدارة</span><strong>' + n('director_returned') + '</strong></a>' +
    '</div>' +
    '<div class="sec-head"><h2>بانتظار اعتمادك (' + pending.length + ')</h2><a href="#director-inbox">كل المحاضر</a></div>' +
    (pending.length ? adminCollection(pending, '', 'director') : emptyState('لا توجد محاضر بانتظار الاعتماد حالياً.')) +
    '<div class="legal-note" style="margin-top:16px">' + icon('info') + '<span>' + LEGAL_NOTE + '</span></div>';
  return 'لوحة المدير';
}
const FILTERS = {
  admin: [
    ['all', 'الكل', () => true],
    ['pending', 'بانتظار مراجعتك', c => ADMIN_PENDING.includes(c.status)],
    ['forwarded', 'لدى المدير', c => c.status === 'forwarded'],
    ['director_returned', 'أعادها المدير', c => c.status === 'director_returned'],
    ['returned', 'معادة للمفتش', c => c.status === 'returned'],
    ['approved', 'معتمدة', c => c.status === 'approved']
  ],
  director: [
    ['all', 'الكل', () => true],
    ['pending', 'بانتظار اعتمادك', c => c.status === 'forwarded'],
    ['approved', 'معتمدة', c => c.status === 'approved'],
    ['director_returned', 'أعيدت للإدارة', c => c.status === 'director_returned']
  ]
};
function renderRoleInbox(view, f, role) {
  const R = ROLES[role];
  const list = FILTERS[role];
  const filt = list.find(x => x[0] === f) || list[0];
  const all = roleList(role);
  view.innerHTML =
    '<div class="page-head"><div><p class="eyebrow">' + R.portal + '</p><h1>' + R.inbox + '</h1></div></div>' +
    '<nav class="filters" aria-label="تصفية حسب الحالة">' + list.map(x =>
      '<a href="#' + R.prefix + '-inbox-' + x[0] + '"' + (x === filt ? ' aria-current="true"' : '') + '>' + x[1] + ' <span class="count">(' + all.filter(x[2]).length + ')</span></a>').join('') + '</nav>' +
    '<div class="search"><label class="sr-only" for="q">بحث في المحاضر</label>' + icon('search') + '<input id="q" type="search" data-search="admin" placeholder="بحث برقم المحضر أو الموقع أو المخالف" autocomplete="off"></div>' +
    '<div id="reportList" aria-live="polite"></div>';
  view.dataset.filter = filt[0];
  view.dataset.role = role;
  fillAdminList();
  return R.inbox;
}
function renderAdminInbox(view, f) { return renderRoleInbox(view, f, 'admin'); }
function fillAdminList() {
  const role = $('#view').dataset.role || 'admin';
  const list = FILTERS[role];
  const filt = list.find(x => x[0] === $('#view').dataset.filter) || list[0];
  const q = (($('#q') || {}).value || '').trim();
  $('#reportList').innerHTML = adminCollection(sortRecent(roleList(role)).filter(filt[2]).filter(c => matchQuery(c, q)), q ? 'لا توجد نتائج مطابقة للبحث.' : 'لا توجد محاضر في هذه القائمة.', role);
}
function noteMsg(kind, title, h) {
  return h && h.note ? '<div class="msg ' + kind + '" style="margin-bottom:12px">' + icon(kind === 'warn' ? 'alert' : 'info') + '<div><strong>' + title + '</strong>' + esc(h.note) + '<div class="hint" style="color:inherit">' + fmtDateTime(h.at) + '</div></div></div>' : '';
}
function decisionField(label, hint) {
  return '<div class="field"><label for="decNote">' + label + '</label><textarea id="decNote" rows="4" aria-describedby="decHint decErr"></textarea>' +
    '<p class="hint" id="decHint">' + hint + '</p><p class="field-error" id="decErr" role="alert"></p></div>';
}
function approvedPanel(c) {
  const h = lastAction(c, 'approved');
  return '<div class="msg ok">' + icon('check') + '<div><strong>تم اعتماد المحضر' + (h && h.by ? ' — ' + esc(h.by) : '') + '</strong>' + fmtDateTime(h ? h.at : c.reviewedAt) + '<br>المحضر للقراءة فقط ولا يمكن تعديله.</div></div>' +
    '<div class="btn-row" style="margin-top:12px"><button class="btn primary block" type="button" data-action="official-preview" data-id="' + esc(c.id) + '">' + icon('eye') + 'معاينة وتنزيل المحضر الرسمي</button></div>' +
    '<p class="hint">ملف بصيغة نموذج WPD/01: الصفحة الأولى للمحضر، تليها صفحات الأدلة المصورة.</p>';
}
function renderAdminReview(view, id) { return renderRoleReview(view, id, 'admin'); }
function renderRoleReview(view, id, role) {
  const R = ROLES[role];
  const c = getCase(id);
  if (!c || c.status === 'draft' || (role === 'director' && !roleList('director').some(x => x.id === id))) { view.innerHTML = notFound('#' + R.prefix + '-inbox'); return 'غير موجود'; }
  const s = detailSections(c, { admin: true });
  let decision;
  if (c.status === 'approved') decision = approvedPanel(c);
  else if (role === 'admin' && ADMIN_PENDING.includes(c.status)) {
    decision =
      noteMsg('warn', 'ملاحظة المدير عند الإعادة', c.status === 'director_returned' ? lastAction(c, 'director_returned') : null) +
      (c.status === 'resubmitted' ? '<div class="msg info" style="margin-bottom:12px">' + icon('info') + '<div>أعاد المفتش تسليم هذا المحضر بعد التعديل. راجع ملاحظات الإرجاع السابقة.</div></div>' : '') +
      '<p class="muted" style="margin-bottom:12px">راجع بيانات المحضر والأدلة، ثم حوّله إلى المدير للاعتماد أو أعده للمفتش.</p>' +
      (isGrazing(c) ? ownerBoxHTML(c) : '') +
      decisionField('ملاحظة المراجعة', 'إلزامية عند الإرجاع للمفتش، واختيارية عند التحويل (تظهر للمدير). تُحفظ ضمن سجل الإجراءات.') +
      '<div class="btn-row"><button class="btn primary lg" type="button" data-action="forward" data-id="' + esc(c.id) + '">' + icon('next') + 'تحويل إلى المدير</button>' +
      '<button class="btn danger-outline lg" type="button" data-action="return" data-id="' + esc(c.id) + '">' + icon('prev') + 'إرجاع للمفتش</button></div>';
  } else if (role === 'director' && c.status === 'forwarded') {
    decision =
      noteMsg('info', 'ملاحظة الإدارة عند التحويل', lastAction(c, 'forwarded')) +
      '<p class="muted" style="margin-bottom:12px">راجعت الإدارة هذا المحضر وحوّلته إليك للاعتماد.</p>' +
      (isGrazing(c) ? letterBoxHTML(c) : '') +
      decisionField('ملاحظة المدير', 'إلزامية عند الإعادة إلى الإدارة، واختيارية عند الاعتماد.') +
      '<div class="btn-row"><button class="btn success lg" type="button" data-action="approve" data-id="' + esc(c.id) + '">' + icon('check') + 'اعتماد المحضر</button>' +
      '<button class="btn danger-outline lg" type="button" data-action="director-return" data-id="' + esc(c.id) + '">' + icon('prev') + 'إعادة إلى الإدارة</button></div>';
  } else if (c.status === 'forwarded') {
    decision = '<div class="msg info">' + icon('info') + '<div><strong>محال إلى المدير</strong>تمت المراجعة وتحويل المحضر إلى المدير، وهو بانتظار الاعتماد.</div></div>';
  } else if (c.status === 'director_returned') {
    decision = noteMsg('warn', 'أعدتَ هذا المحضر إلى الإدارة', lastAction(c, 'director_returned')) + '<div class="msg info">' + icon('info') + '<div>بانتظار مراجعة الإدارة وتحويله مجدداً.</div></div>';
  } else if (c.status === 'returned') {
    decision = '<div class="msg warn">' + icon('alert') + '<div><strong>المحضر معاد للمفتش</strong>بانتظار تعديله وإعادة تسليمه.</div></div>';
  } else {
    decision = '<div class="msg info">' + icon('info') + '<div><strong>' + esc(STATUS[c.status].label) + '</strong>لا يوجد إجراء مطلوب منك حالياً.</div></div>';
  }
  view.innerHTML =
    '<div class="page-head"><div><a class="back-link" href="#' + R.prefix + '-inbox">' + icon('prev') + 'العودة إلى ' + R.inbox + '</a>' +
    '<h1>' + (role === 'director' ? 'اعتماد محضر ' : 'مراجعة محضر ') + ltr(c.id) + '</h1><div style="margin-top:6px">' + badge(c.status) + '</div></div>' +
    '<div class="btn-row">' + reportActions(c) + '</div></div>' +
    '<div class="review-layout">' +
      '<div class="review-main stack">' + s.info + s.viol + s.off + s.ev + s.rets + s.hist + '</div>' +
      '<aside class="review-side" aria-labelledby="decH"><section class="card decision"><h2 id="decH">' + (role === 'director' ? 'قرار المدير' : 'قرار المراجعة') + '</h2>' + decision +
        '<div class="legal-note" style="margin-top:14px">' + icon('info') + '<span>الاعتماد إجراء إداري لتوثيق المحضر فقط، ولا يتضمن تحديد عقوبة أو غرامة أو تقرير إدانة.</span></div>' +
      '</section></aside>' +
    '</div>';
  return (role === 'director' ? 'اعتماد محضر ' : 'مراجعة محضر ') + c.id;
}
const TRANSITIONS = {
  forwarded: { from: ADMIN_PENDING, by: 'الإدارة', needNote: false,
    ask: id => ['تحويل المحضر ' + id + ' إلى المدير؟', 'سيظهر المحضر في بوابة المدير للاعتماد.', 'تحويل إلى المدير', false],
    done: 'تم تحويل المحضر إلى المدير (تجريبياً على هذا الجهاز).' },
  returned: { from: ADMIN_PENDING, by: 'الإدارة', needNote: true,
    ask: id => ['إرجاع المحضر ' + id + ' للمفتش؟', 'سيظهر سبب الإرجاع للمفتش ويُحفظ في سجل الإجراءات.', 'إرجاع للمفتش', true],
    done: 'تم إرجاع المحضر للمفتش (تجريبياً على هذا الجهاز).' },
  approved: { from: ['forwarded'], by: 'المدير', needNote: false,
    ask: id => ['اعتماد المحضر ' + id + '؟', 'بعد الاعتماد يصبح المحضر للقراءة فقط، ويمكن تنزيل المحضر الرسمي بصيغة PDF.', 'اعتماد المحضر', false],
    done: 'تم اعتماد المحضر (تجريبياً على هذا الجهاز).' },
  director_returned: { from: ['forwarded'], by: 'المدير', needNote: true,
    ask: id => ['إعادة المحضر ' + id + ' إلى الإدارة؟', 'ستظهر ملاحظتك للإدارة لمراجعة المحضر مجدداً.', 'إعادة إلى الإدارة', true],
    done: 'تمت إعادة المحضر إلى الإدارة (تجريبياً على هذا الجهاز).' }
};
async function decide(id, action) {
  const T = TRANSITIONS[action];
  const cur = getCase(id);
  if (!T || !cur || !T.from.includes(cur.status)) { toast('لا يمكن اتخاذ القرار: تغيرت حالة المحضر.', 'bad'); render(); return; }
  const noteEl = $('#decNote');
  const note = noteEl.value.trim();
  if (T.needNote && !note) {
    $('#decErr').textContent = 'اكتب سبب الإعادة؛ الملاحظة إلزامية في هذه الحالة.';
    noteEl.setAttribute('aria-invalid', 'true');
    noteEl.focus();
    return;
  }
  if (action === 'forwarded' && isGrazing(cur) && (!cur.chips.length || !cur.person.trim())) {
    $('#decErr').textContent = 'مخالفة رعي: أدخل رقم الشريحة واسترجع بيانات المخالف (أو أدخلها يدوياً) قبل التحويل إلى المدير.';
    const box = $('#ownerBox'); if (box) { box.scrollIntoView({ block: 'center' }); const i = $('#chipno0'); if (i) i.focus({ preventScroll: true }); }
    return;
  }
  if (action === 'approved' && isGrazing(cur) && !(cur.livestock && cur.livestock.pages.length)) {
    $('#decErr').textContent = 'أرفق كتاب إدارة الثروة الحيوانية قبل اعتماد مخالفة الرعي.';
    const box = $('#lvBox'); if (box) { box.scrollIntoView({ block: 'center' }); const i = $('#lvCam'); if (i) i.focus({ preventScroll: true }); }
    return;
  }
  const a = T.ask(id);
  if (!(await askConfirm(a[0], a[1], a[2], a[3]))) return;
  const latest = getCase(id);
  if (!latest || !T.from.includes(latest.status)) { toast('لا يمكن اتخاذ القرار: تغيرت حالة المحضر.', 'bad'); render(); return; }
  const c = clone(latest);
  const now = new Date().toISOString();
  c.status = action;
  c.updatedAt = now;
  if (action === 'approved') { c.reviewedAt = now; c.managerNote = note; }
  if (action === 'returned') { c.reviewedAt = now; c.managerNote = note; c.returnComments.push({ text: note, at: now, by: 'الإدارة' }); }
  const extra = action === 'forwarded' && isGrazing(c) ? 'بيانات المخالف ' + (c.offenderSource === 'registry' ? 'مسترجعة من سجل الثروة الحيوانية' : 'مدخلة من الإدارة') + ' (الشريحة ' + c.chips.join('، ') + ').' :
    action === 'approved' && isGrazing(c) && c.livestock && c.livestock.pages.length ? 'أُرفق كتاب إدارة الثروة الحيوانية (' + c.livestock.pages.length + (c.livestock.pages.length === 1 ? ' صفحة' : ' صفحات') + ').' : '';
  c.history.push({ action, at: now, by: T.by + ' — ' + actorName(T.by), note: [note, extra].filter(Boolean).join(' ') });
  try { upsertCase(c); } catch (e) { toast('تعذر حفظ القرار محلياً.', 'bad'); return; }
  toast(T.done);
  render();
}

/* ------------------------------------------------------------------ *
 * Print (official paper layout, rendered into #printArea)
 * ------------------------------------------------------------------ */
function paperHTML(c) {
  const row = (k, v) => '<tr><th>' + k + '</th><td>' + v + '</td></tr>';
  return '<article class="paper">' +
    '<header class="p-head"><div style="display:flex;align-items:center;gap:10px">' + (OFFICIAL_LOGO ? '<img src="' + OFFICIAL_LOGO + '" alt="شعار وزارة البيئة والتغير المناخي" style="height:56px;width:auto">' : '') + '<div><strong>دولة قطر</strong><div>وزارة البيئة والتغير المناخي</div><div>إدارة الحماية البرية</div></div></div>' +
    '<div class="no"><strong>محضر ضبط مخالفة</strong><div>رقم: ' + ltr(c.id) + '</div><div>الحالة: ' + esc(STATUS[c.status].label) + '</div></div></header>' +
    '<h1>محضر ضبط مخالفة بموجب أحكام</h1><ul class="laws">' + LAWS.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>' +
    '<h2>بيانات الضبط</h2><table>' +
      row('التاريخ / الساعة', fmtDate(c.date) + ' — ' + esc(fmtTime12(c.time))) +
      row('المفتش', esc(c.inspectorName || '—') + (c.inspectorNo ? ' — الرقم الوظيفي: ' + ltr(c.inspectorNo) : '')) +
      row('القسم', esc(c.section || '—')) +
      row('المركز الأمني', esc(c.securityCenter || '—')) +
      row('المنطقة', esc(c.area || '—')) +
      row('وصف الموقع', esc(c.place || '—')) +
      row('الإحداثيات', hasCoords(c) ? ltr('N ' + Number(c.lat).toFixed(6) + '  E ' + Number(c.lng).toFixed(6)) + (c.accuracy != null ? ' (±' + Math.round(c.accuracy) + ' م)' : '') : 'غير محددة') +
    '</table>' +
    '<h2>المخالفات المضبوطة</h2>' +
    (c.violationNos.length || c.legacyViolations.length ? '<ol>' + c.violationNos.map(n => '<li value="' + n + '">' + esc(VBY[n].text) + '</li>').join('') + c.legacyViolations.map(t => '<li>' + esc(t) + '</li>').join('') + '</ol>' : '<p>—</p>') +
    (c.chips.length ? '<p><b>أرقام شرائح الإبل:</b> ' + c.chips.map(ltr).join('، ') + '</p>' : '') +
    (c.chipPhotos.length ? '<p><b>صور شرائح الإبل:</b> ' + c.chipPhotos.length + ' (مرفقة)</p>' : '') +
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
/* ------------------------------------------------------------------ *
 * Official form WPD/01 — generated after administrative approval.
 * Reproduces the paper form layout (page 1) followed by evidence pages,
 * then exports a PDF built in the browser (no library): every page is
 * rendered from HTML to an image and written into a minimal PDF file.
 * ------------------------------------------------------------------ */
/* Ministry emblem for the report header (cropped from the scanned WPD/01 form, transparent PNG).
   Set to '' to show the ministry name only. */
const OFFICIAL_LOGO = 'data:image/png;base64,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';
const WPD_W = 794, WPD_H = 1123; // A4 at 96 dpi
const WPD_CSS = `
.wpd-page{width:${WPD_W}px;height:${WPD_H}px;box-sizing:border-box;padding:22px 30px 14px;background:#fff;color:#111;font-family:"Segoe UI",Tahoma,"Noto Naskh Arabic","Geeza Pro",Arial,sans-serif;font-size:12px;line-height:1.45;direction:rtl;position:relative;overflow:hidden;display:flex;flex-direction:column}
.wpd-page *{box-sizing:border-box}
.wpd-page .ltr{direction:ltr;unicode-bidi:isolate;display:inline-block}
.w-head{display:flex;justify-content:space-between;align-items:flex-start}
.w-min{display:flex;align-items:center;gap:10px}
.w-min img{height:66px;width:auto;display:block}
.w-min b{font-size:16px;color:#222;display:block;letter-spacing:.2px}
.w-min .en{font-size:12.5px;color:#222;direction:ltr;text-align:right}
.w-min .st{font-size:9.5px;color:#444;direction:ltr;text-align:right}
.w-dept{text-align:left}
.w-dept b{font-size:16px;color:#8A1538;display:block;text-align:left}
.w-dept .en{font-size:12.5px;color:#8A1538;font-weight:700;direction:ltr}
.w-dept .code{font-size:12px;color:#222;direction:ltr;font-weight:700}
.w-row2{display:flex;justify-content:space-between;align-items:flex-end;margin-top:4px;padding-bottom:2px}
.w-sec{display:flex;align-items:flex-end;gap:6px;min-width:250px}
.w-sec .fill{min-width:150px;border-bottom:1px solid #555;font-size:16px;color:#1a2a8a;text-align:center;padding:0 6px}
.w-no{font-size:13px;font-weight:700;display:flex;align-items:flex-end;gap:16px}
.w-no .red{color:#C8102E;font-size:19px;letter-spacing:1px;direction:ltr}
.w-date{display:flex;align-items:center;gap:6px;font-size:11px}
.w-boxes{display:inline-flex;gap:2px;direction:ltr}
.w-boxes span{display:inline-block;width:16px;height:19px;border:1px solid #777;text-align:center;font-size:12px;line-height:17px;color:#1a2a8a;font-weight:600}
.w-boxes .gap{border:0;width:8px}
.w-banner{background:#E8C8D0;border-radius:4px;margin-top:6px;padding:4px 14px 5px}
.w-banner h1{text-align:center;font-size:15px;margin:0 0 2px;font-weight:700}
.w-laws{display:grid;grid-template-columns:1fr 1fr;font-size:9.6px;line-height:1.35}
.w-laws div:first-child{border-left:1.5px solid #fff;padding-left:12px}
.w-laws div:last-child{padding-right:12px}
.w-laws p{margin:0 0 1px}
.w-fields{margin-top:4px}
.w-line{display:flex;align-items:flex-end;gap:6px;min-height:21px;font-size:11.5px;margin-bottom:1px}
.w-line .lbl{white-space:nowrap;font-weight:600}
.w-line .fill{flex:1;border-bottom:1px dotted #777;color:#1a2a8a;font-size:13px;padding:0 6px;min-height:18px;line-height:18px;white-space:nowrap;overflow:hidden}
.w-line .fill.sh{flex:0 0 150px}
.w-line .tag{font-size:11px;direction:ltr}
.w-circ{display:inline-block;border:1.5px solid #1a2a8a;border-radius:50%;padding:0 4px;line-height:1.2}
.w-intro{font-weight:700;font-size:11.5px;margin:2px 0}
table.w-tbl{width:100%;border-collapse:collapse;font-size:9.5px;line-height:1.33}
.w-tbl th{background:#D9D9D9;font-size:11px;padding:1px;border:1px solid #888}
.w-tbl td{border-bottom:1px solid #888;padding:2px 4px;vertical-align:middle}
.w-tbl td.n{width:26px;text-align:center;font-size:10px;direction:ltr}
.w-tbl td.cb{width:22px;text-align:center}
.w-tbl td.cb i{display:inline-block;width:12px;height:12px;border:1.2px solid #333;position:relative;vertical-align:middle}
.w-tbl td.cb i.on::after{content:"";position:absolute;left:3px;top:-2px;width:5px;height:10px;border:solid #1a2a8a;border-width:0 2.2px 2.2px 0;transform:rotate(45deg)}
.w-tbl td.pen{width:215px;border:1px solid #888;text-align:center;font-size:9.4px;line-height:1.45;padding:3px 7px}
.w-tbl tr.sel td.t{color:#000;font-weight:600}
.w-tbl{border:1px solid #888}
.w-expl{margin-top:4px;font-size:11.5px;display:flex;gap:6px;align-items:flex-start}
.w-expl .lbl{font-weight:600}
.w-expl .lbl{white-space:nowrap}
.w-expl .lines{flex:1;min-height:40px;color:#1a2a8a;font-size:11.5px;padding:0 6px;line-height:20px;background-image:repeating-linear-gradient(to bottom,transparent 0,transparent 19px,#999 19px,#999 20px)}
.w-sulh{background:#D9D9D9;margin-top:5px;padding:4px 12px;font-size:10px;font-weight:600;line-height:1.5}
.w-off{margin-top:4px}
.w-off .row{display:flex;align-items:flex-end;gap:10px;min-height:26px;font-size:11.5px}
.w-off .fill{flex:1;border-bottom:1px dotted #777;color:#1a2a8a;font-size:13px;padding:0 6px;min-height:20px}
.w-sig{height:38px;max-width:170px;object-fit:contain;display:block}
.w-chk{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.w-chk i{display:inline-block;width:14px;height:14px;border:1.2px solid #333;position:relative}
.w-chk i.on::after{content:"";position:absolute;left:3px;top:-2px;width:5px;height:10px;border:solid #1a2a8a;border-width:0 2.2px 2.2px 0;transform:rotate(45deg)}
.w-bar{background:#E8C8D0;margin-top:5px;padding:3px 12px;font-weight:700;font-size:11.5px}
.w-insp{display:flex;align-items:flex-end;gap:10px;min-height:36px;margin-top:0;font-size:11.5px}
.w-insp .fill{flex:1;border-bottom:1px dotted #777;color:#1a2a8a;font-size:14px;padding:0 6px;min-height:22px}
.w-foot{margin-top:auto;text-align:center;font-size:11px;font-weight:600;padding-top:4px}
.w-wm{position:absolute;top:44%;left:50%;transform:translate(-50%,-50%) rotate(-28deg);font-size:56px;font-weight:700;color:rgba(161,35,43,.14);white-space:nowrap;pointer-events:none;z-index:5}
.w-meta{display:flex;justify-content:space-between;font-size:8.5px;color:#777;margin-top:4px;direction:rtl}
.w-ph-head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #8A1538;padding-bottom:6px;margin-bottom:12px;font-size:12px}
.w-ph-head b{color:#8A1538;font-size:14px}
.w-ph{flex:1;display:flex;flex-direction:column;gap:14px}
.w-ph figure,.w-grid figure,.w-side figure{margin:0;flex:none;display:flex;flex-direction:column;min-width:0}
.w-grid{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:12px 12px;align-content:start}
.w-side{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:12px;align-content:start}
.w-grid .img,.w-side .img{background:#f3f3f3;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid #ccc}
.w-grid img,.w-side img{width:100%;height:100%;object-fit:contain;display:block}
.w-grid figcaption,.w-side figcaption{font-size:10.5px;padding-top:3px}
.w-ph .img{background:#f3f3f3;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid #ccc}
.w-ph img{width:100%;height:100%;object-fit:contain;display:block}
.w-ph figcaption{font-size:11px;padding-top:4px}
.w-lv-meta{font-size:11px;margin:0 0 8px;color:#333}
.w-lv{height:960px;border:1px solid #ccc;background:#f6f6f6;display:flex;align-items:center;justify-content:center;overflow:hidden}
.w-lv img{width:100%;height:100%;object-fit:contain;display:block}
`;
function wpdBoxes(str, n, groups) {
  const chars = latinDigits(str || '').replace(/\s/g, '').split('').slice(0, n);
  let out = '';
  for (let i = 0; i < n; i++) {
    if (groups && groups.includes(i)) out += '<span class="gap"></span>';
    out += '<span>' + esc(chars[i] || '') + '</span>';
  }
  return '<span class="w-boxes">' + out + '</span>';
}
function wpdSerial(c) { const m = String(c.id).match(/(\d{5})$/); return m ? m[1] : String(c.id).slice(-5); }
function wpdApprovedAt(c) {
  const h = c.history.slice().reverse().find(x => x.action === 'approved');
  return h ? h.at : c.reviewedAt;
}
function wpdWatermark(c) { return c.status === 'approved' ? '' : '<div class="w-wm">غير معتمد — للمعاينة فقط</div>'; }
function wpdPage1(c) {
  const d = c.date ? new Date(c.date + 'T00:00:00') : null;
  const weekday = d && !isNaN(d) ? d.toLocaleDateString('ar-QA', { weekday: 'long' }) : '';
  const ymd = d && !isNaN(d) ? d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() : '';
  const dateBoxes = d && !isNaN(d) ? pad(d.getDate()) + pad(d.getMonth() + 1) + d.getFullYear() : '';
  let tm = '', am = null;
  if (/^\d{1,2}:\d{2}/.test(c.time || '')) { const [hh, mm] = c.time.split(':').map(Number); tm = (hh % 12 || 12) + ':' + pad(mm); am = hh < 12; }
  const sel = new Set(c.violationNos);
  const groups = { A: [1, 14], B: [15, 15], C: [16, 19], D: [20, 20] };
  const rows = VIOLATIONS.map(v => {
    const g = groups[v.pen];
    const pen = v.no === g[0] ? '<td class="pen" rowspan="' + (g[1] - g[0] + 1) + '">' + esc(PENALTIES[v.pen].text) + '</td>' : '';
    return '<tr' + (sel.has(v.no) ? ' class="sel"' : '') + '><td class="n">' + v.no + '.</td><td class="cb"><i' + (sel.has(v.no) ? ' class="on"' : '') + '></i></td><td class="t">' + esc(v.text) + '</td>' + pen + '</tr>';
  }).join('');
  const notes = [c.notes ? c.notes.trim() : '', c.chips.length ? 'أرقام شرائح الإبل: ' + c.chips.join('، ') : '', c.chipPhotos.length ? 'مرفق صور شرائح الإبل (' + c.chipPhotos.length + ')' : ''].filter(Boolean).join(' — ');
  const logo = OFFICIAL_LOGO ? '<img src="' + esc(OFFICIAL_LOGO) + '" alt="">' : '';
  const sulh = c.settlement === 'offered'
    ? 'هذا وقد تم عرض الصلح على المخالف في المخالفات التي يجوز فيها الصلح، وأقر المسؤول بمخالفته لأحكام القانون، وطُلب منه مراجعة الإدارة لاستكمال إجراءات الصلح.'
    : c.settlement === 'not_offered' ? 'لم يُعرض الصلح على المخالف.' : 'عرض الصلح: لم يحدد.';
  return '<div class="wpd-page">' + wpdWatermark(c) +
    '<div class="w-head">' +
      '<div class="w-min">' + logo + '<div><b>وزارة البيئة والتغيـر المناخي</b><div class="en">Ministry of Environment and Climate Change</div><div class="st">State of Qatar · دولة قطر</div></div></div>' +
      '<div class="w-dept"><b>إدارة الحماية البريـة</b><div class="en">Wild Protection Department</div><div class="code">WPD/01/</div></div>' +
    '</div>' +
    '<div class="w-row2">' +
      '<div class="w-sec"><span>قسم</span><span class="fill">' + esc(c.section || '') + '</span></div>' +
      '<div class="w-no"><span class="ltr">Section</span><span class="ltr">№ <span class="red">' + esc(wpdSerial(c)) + '</span></span></div>' +
      '<div class="w-date"><span>التاريخ</span>' + wpdBoxes(dateBoxes, 8, [2, 4]) + '<span class="ltr">Date</span></div>' +
    '</div>' +
    '<div class="w-banner"><h1>محضر ضبط مخالفة بموجب أحكام:</h1><div class="w-laws">' +
      '<div><p>- ' + esc(LAWS[0]) + '</p><p>- ' + esc(LAWS[1]) + '</p><p>- ' + esc(LAWS[2]) + '</p></div>' +
      '<div><p>- ' + esc(LAWS[3]) + '</p><p>- ' + esc(LAWS[4]) + '</p></div>' +
    '</div></div>' +
    '<div class="w-fields">' +
      '<div class="w-line"><span class="lbl">إنه في يوم/ التاريخ/ الساعة :</span><span class="fill">' + esc(weekday) + '&#160;&#160;&#160;<span class="ltr">' + esc(ymd) + '</span>&#160;&#160;&#160;<span class="ltr">' + esc(tm) + '</span></span>' +
        '<span class="tag">' + (am === true ? '<span class="w-circ">ص</span> / م' : am === false ? 'ص / <span class="w-circ">م</span>' : 'ص / م') + '</span></div>' +
      '<div class="w-line"><span class="lbl">حرر هذا المحضر بمعرفة المفتش السيد/</span><span class="fill">' + esc(c.inspectorName) + '</span><span class="lbl">وظيفة رقم:</span><span class="fill sh"><span class="ltr">' + esc(c.inspectorNo) + '</span></span></div>' +
      '<div class="w-line"><span class="lbl">حيث وجد أن الشركة/ السيد:</span><span class="fill">' + esc(c.person) + '</span><span class="lbl">جوال رقم :</span><span class="fill sh"><span class="ltr">' + esc(c.phone) + '</span></span></div>' +
      '<div class="w-line"><span class="lbl">بطاقة شخصية رقم:</span>' + wpdBoxes(c.qid, 11) + '</div>' +
      '<div class="w-line"><span class="lbl">منطقة</span><span class="fill">' + esc(c.area || c.place) + '</span><span class="lbl">الإحداثيات:</span>' +
        '<span class="fill sh" style="flex-basis:120px"><span class="ltr">E ' + (hasCoords(c) ? Number(c.lng).toFixed(6) : '') + '</span></span>' +
        '<span class="fill sh" style="flex-basis:120px"><span class="ltr">N ' + (hasCoords(c) ? Number(c.lat).toFixed(6) : '') + '</span></span></div>' +
    '</div>' +
    '<p class="w-intro">يقوم بأعمال مخالفة للقانون وتم ضبط المخالفات التالية:</p>' +
    '<table class="w-tbl"><thead><tr><th colspan="3">المخالفة</th><th>العقوبة المقررة</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<div class="w-expl"><span class="lbl">شرح المخالفة:</span><div class="lines">' + esc(notes) + '</div></div>' +
    '<div class="w-sulh">' + esc(sulh) + '</div>' +
    '<div class="w-off">' +
      '<div class="row"><span class="lbl">اسم المخالف</span><span class="fill">' + esc(c.person) + '</span><span class="lbl">رقم البطاقة الشخصية</span>' + wpdBoxes(c.qid, 11) + '</div>' +
      '<div class="row"><span class="lbl">توقيع المخالف</span><span class="fill">' + (c.offenderSig ? '<img class="w-sig" src="' + esc(c.offenderSig) + '" alt="">' : '') + '</span>' +
        '<span class="w-chk"><i' + (c.signature === 'refused' ? ' class="on"' : '') + '></i>رفض التوقيع</span></div>' +
    '</div>' +
    '<div class="w-bar">المفتش</div>' +
    '<div class="w-insp"><span class="lbl">الاسم</span><span class="fill">' + esc(c.inspectorName) + '</span><span class="lbl">التوقيع</span><span class="fill">' + (c.inspectorSig ? '<img class="w-sig" src="' + esc(c.inspectorSig) + '" alt="">' : '') + '</span></div>' +
    '<div class="w-foot">توزيع النسخ : &#160; أبيض : الإدارة &#160;-&#160; أزرق : المخالف &#160;-&#160; أحمر : الدفتر</div>' +
    '<div class="w-meta"><span>رقم المحضر: <span class="ltr">' + esc(c.id) + '</span>' + (c.status === 'approved' ? ' · اعتمده المدير: ' + esc(fmtDateTime(wpdApprovedAt(c))) : ' · الحالة: ' + esc(STATUS[c.status] ? STATUS[c.status].label : '')) + (c.locSource === 'mock' ? ' · الإحداثيات محاكاة (تجريبي)' : '') + '</span><span>مُولَّد من النموذج التجريبي — بيانات محلية</span></div>' +
  '</div>';
}
/* File order follows the paper file: form → field photos → Animal Resources letter (grazing)
   → supporting evidence (e.g. chip-reader screens) → inspector's judicial officer card. */
const WPD_FOOT = '<span>مُولَّد من النموذج التجريبي — بيانات محلية</span>';
function wpdSheet(c, title, body, no) {
  return '<div class="wpd-page">' + wpdWatermark(c) +
    '<div class="w-ph-head"><b>' + title + '</b><span>محضر رقم <span class="ltr">' + esc(c.id) + '</span> · <span class="ltr">WPD/01</span></span></div>' +
    body +
    '<div class="w-meta"><span>صفحة ' + no + '</span>' + WPD_FOOT + '</div>' +
  '</div>';
}
function wpdFig(src, cap, h) {
  return '<figure><div class="img" style="height:' + h + 'px"><img src="' + esc(src) + '" alt=""></div>' + (cap ? '<figcaption>' + cap + '</figcaption>' : '') + '</figure>';
}
function photoCap(p, n) { return '<b>' + n + '. ' + esc(PHOTO_CAT[p.category]) + '</b>' + (p.caption ? ' — ' + esc(p.caption) : ''); }
function wpdPages(c) {
  const pages = [wpdPage1(c)];
  const next = () => pages.length + 1;
  const field = c.photos.filter(ph => ph.category !== 'support');
  const support = c.photos.filter(ph => ph.category === 'support');
  const num = ph => c.photos.indexOf(ph) + 1;
  // field photos: first page two large, then four per page
  const groups = [];
  if (field.length) groups.push(field.slice(0, 2));
  for (let i = 2; i < field.length; i += 4) groups.push(field.slice(i, i + 4));
  groups.forEach(g => {
    const body = g.length > 2
      ? '<div class="w-grid">' + g.map(ph => wpdFig(ph.preview, photoCap(ph, num(ph)), 452)).join('') + '</div>'
      : '<div class="w-ph">' + g.map(ph => wpdFig(ph.preview, photoCap(ph, num(ph)), 462)).join('') + '</div>';
    pages.push(wpdSheet(c, 'الأدلة المصورة', body, next()));
  });
  // Animal Resources letter (grazing)
  if (c.livestock && c.livestock.pages.length) {
    const n = c.livestock.pages.length;
    c.livestock.pages.forEach((pg, i) => pages.push(wpdSheet(c, 'كتاب إدارة الثروة الحيوانية — إفادة حول شريحة الإبل الإلكترونية',
      '<p class="w-lv-meta">' + (c.livestock.reqNo ? 'رقم طلب الإفادة: <span class="ltr">' + esc(c.livestock.reqNo) + '</span> · ' : '') + (c.livestock.date ? 'تاريخ الإفادة: ' + esc(fmtDate(c.livestock.date)) + ' · ' : '') +
        (c.chips.length ? 'أرقام الشرائح: <span class="ltr">' + esc(c.chips.join('، ')) + '</span>' : 'صور الشرائح مرفقة (' + c.chipPhotos.length + ')') + (n > 1 ? ' · صفحة ' + (i + 1) + ' من ' + n : '') + '</p>' +
      '<div class="w-lv"><img src="' + esc(pg.preview) + '" alt=""></div>', next())));
  }
  // camel chip photos (camera): portrait pairs side by side, otherwise stacked
  for (let i = 0; i < c.chipPhotos.length; i += 2) {
    const g = c.chipPhotos.slice(i, i + 2);
    const portrait = g.every(ph => (ph.h || 0) > (ph.w || 0));
    const cap = ph => '<b>شريحة ' + (c.chipPhotos.indexOf(ph) + 1) + '</b>';
    const body = portrait && g.length === 2
      ? '<div class="w-side">' + g.map(ph => wpdFig(ph.preview, cap(ph), 930)).join('') + '</div>'
      : '<div class="w-ph">' + g.map(ph => wpdFig(ph.preview, cap(ph), 462)).join('') + '</div>';
    pages.push(wpdSheet(c, 'صور شرائح الإبل', body, next()));
  }
  // supporting evidence: portrait pairs side by side, otherwise stacked
  for (let i = 0; i < support.length; i += 2) {
    const g = support.slice(i, i + 2);
    const portrait = g.every(ph => (ph.h || 0) > (ph.w || 0));
    const body = portrait && g.length === 2
      ? '<div class="w-side">' + g.map(ph => wpdFig(ph.preview, photoCap(ph, num(ph)), 930)).join('') + '</div>'
      : '<div class="w-ph">' + g.map(ph => wpdFig(ph.preview, photoCap(ph, num(ph)), 462)).join('') + '</div>';
    pages.push(wpdSheet(c, 'أدلة داعمة', body, next()));
  }
  // inspector's judicial officer card
  if (c.officerCard && c.officerCard.length) {
    pages.push(wpdSheet(c, 'بطاقة الضبطية القضائية للمفتش' + (c.inspectorName ? ' — ' + esc(c.inspectorName) : ''),
      '<div class="w-ph">' + c.officerCard.map((pg, i) => wpdFig(pg.preview, '<b>' + (i === 0 ? 'وجه البطاقة' : 'ظهر البطاقة') + '</b>', c.officerCard.length > 1 ? 462 : 940)).join('') + '</div>', next()));
  }
  return pages;
}

/* Render one page of HTML to a JPEG via SVG <foreignObject> (keeps correct Arabic shaping). */
const BLANK_PX = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
function loadImg(src) {
  return new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = reject; im.src = src; });
}
/* Render one page: text and lines via SVG <foreignObject> (keeps correct Arabic shaping);
   photos and signatures are measured in the live layout and drawn directly on the canvas,
   so they appear in every browser (some engines drop images inside foreignObject). */
async function rasterizePage(html, scale) {
  const box = document.createElement('div');
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText = 'position:fixed;left:-20000px;top:0;width:' + WPD_W + 'px;height:' + WPD_H + 'px;overflow:hidden;pointer-events:none';
  box.setAttribute('dir', 'rtl');
  box.innerHTML = '<style>' + WPD_CSS + '</style>' + html;
  document.body.appendChild(box);
  try {
    const imgs = Array.from(box.querySelectorAll('img'));
    await Promise.all(imgs.map(im => im.decode ? im.decode().catch(() => {}) : Promise.resolve()));
    const page = box.querySelector('.wpd-page').getBoundingClientRect();
    const items = imgs.map(im => {
      const r = im.getBoundingClientRect();
      const it = { src: im.getAttribute('src'), x: r.left - page.left, y: r.top - page.top, w: r.width, h: r.height };
      im.style.width = r.width + 'px'; im.style.height = r.height + 'px';
      im.setAttribute('src', BLANK_PX);
      return it;
    }).filter(it => it.w > 0 && it.h > 0);
    const host = document.createElement('div');
    host.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    host.setAttribute('dir', 'rtl');
    host.setAttribute('lang', 'ar');
    host.innerHTML = box.innerHTML;
    const xhtml = new XMLSerializer().serializeToString(host);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + WPD_W + '" height="' + WPD_H + '"><foreignObject x="0" y="0" width="100%" height="100%">' + xhtml + '</foreignObject></svg>';
    const base = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    const cv = document.createElement('canvas');
    cv.width = Math.round(WPD_W * scale); cv.height = Math.round(WPD_H * scale);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(base, 0, 0, cv.width, cv.height);
    for (const it of items) {
      const im = await loadImg(it.src);
      const r = Math.min(it.w / im.naturalWidth, it.h / im.naturalHeight); // object-fit: contain
      const w = im.naturalWidth * r, h = im.naturalHeight * r;
      ctx.drawImage(im, (it.x + (it.w - w) / 2) * scale, (it.y + (it.h - h) / 2) * scale, w * scale, h * scale);
    }
    const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.9));
    if (!blob) throw new Error('blob');
    return { bytes: new Uint8Array(await blob.arrayBuffer()), w: cv.width, h: cv.height };
  } finally {
    box.remove();
  }
}
/* Minimal PDF writer: one full-page JPEG per A4 page. */
function makePdf(pages) {
  const te = new TextEncoder();
  const parts = []; let len = 0; const offs = [];
  const push = x => { const b = typeof x === 'string' ? te.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (id, body) => { offs[id] = len; push(id + ' 0 obj\n' + body + '\nendobj\n'); };
  const W = 595.28, H = 841.89;
  push('%PDF-1.4\n%âãÏÓ\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [' + pages.map((_, i) => (3 + 3 * i) + ' 0 R').join(' ') + '] /Count ' + pages.length + ' >>');
  pages.forEach((im, i) => {
    const p = 3 + 3 * i;
    obj(p, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /XObject << /Im' + i + ' ' + (p + 2) + ' 0 R >> >> /Contents ' + (p + 1) + ' 0 R >>');
    const cs = 'q ' + W + ' 0 0 ' + H + ' 0 0 cm /Im' + i + ' Do Q';
    obj(p + 1, '<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream');
    offs[p + 2] = len;
    push((p + 2) + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.bytes.length + ' >>\nstream\n');
    push(im.bytes);
    push('\nendstream\nendobj\n');
  });
  const size = 3 + 3 * pages.length;
  const xref = len;
  let x = 'xref\n0 ' + size + '\n0000000000 65535 f \n';
  for (let i = 1; i < size; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  push(x + 'trailer\n<< /Size ' + size + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  return new Blob(parts, { type: 'application/pdf' });
}
async function buildOfficialPdf(c) {
  const pages = [];
  for (const html of wpdPages(c)) pages.push(await rasterizePage(html, 2));
  return makePdf(pages);
}
let pdfBusy = false;
async function downloadOfficial(id, btn) {
  const c = getCase(id);
  if (!c || c.status !== 'approved' || pdfBusy) return;
  pdfBusy = true;
  const label = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>جارٍ تجهيز الملف…'; }
  const restore = () => { pdfBusy = false; if (btn && document.contains(btn)) { btn.disabled = false; btn.innerHTML = label; } };
  let blob;
  try { blob = await buildOfficialPdf(c); }
  catch (e) {
    restore();
    toast(EMBEDDED ? 'تعذر إنشاء ملف PDF على هذا المتصفح.' : 'تعذر إنشاء ملف PDF؛ استخدم «طباعة النموذج الرسمي» ثم اختر الحفظ بصيغة PDF.', 'bad');
    return;
  }
  const filename = 'WPD01-' + c.id + '.pdf';
  const host = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('downloads').catch(() => null) : null;
  if (host) {
    try { await host.save({ filename, data: blob }); toast('تم حفظ المحضر الرسمي (PDF).'); restore(); return true; }
    catch (e) { if (!e || e.code !== 'declined') toast('تعذر حفظ الملف في هذا العرض.', 'bad'); }
    restore();
    return;
  }
  if (EMBEDDED) { restore(); toast('تنزيل الملفات غير متاح في هذا العرض.', 'bad'); return; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
  toast('تم تنزيل المحضر الرسمي (PDF).');
  restore();
  return true;
}
/* Local (not embedded): vector print of the same official form; choose "Save as PDF" in the dialog. */
function printOfficial(id) {
  const c = getCase(id);
  if (!c || c.status !== 'approved') return;
  let st = document.getElementById('wpdPrintStyle');
  if (!st) { st = document.createElement('style'); st.id = 'wpdPrintStyle'; document.head.appendChild(st); }
  st.textContent = WPD_CSS + '@media print{@page{size:A4;margin:0}.wpd-page{break-after:page;page-break-after:always}.wpd-page:last-child{break-after:auto;page-break-after:auto}}';
  $('#printArea').innerHTML = wpdPages(c).join('');
  const imgs = $$('#printArea img');
  Promise.all(imgs.map(im => im.complete ? Promise.resolve() : new Promise(r => { im.onload = im.onerror = r; }))).then(() => window.print());
}
function reportActions(c) {
  let out = '';
  if (c.status !== 'draft') out += '<button class="btn ' + (c.status === 'approved' ? 'primary' : 'secondary') + '" type="button" data-action="official-preview" data-id="' + esc(c.id) + '">' + icon('eye') + (c.status === 'approved' ? 'معاينة وتنزيل المحضر الرسمي' : 'معاينة المحضر الرسمي') + '</button>';
  if (!EMBEDDED && c.status !== 'approved') out += '<button class="btn secondary" type="button" data-action="print" data-id="' + esc(c.id) + '">' + icon('print') + 'طباعة / PDF</button>';
  return out;
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
    case 'logout': e.preventDefault(); closeDrawer(); signOut(); break;
    case 'demo-login': { const u = USERS.find(x => x.username === t.dataset.user); if (u) signIn(u); break; }
    case 'toggle-pass': {
      const inp = $('#lg-pass'); const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      t.setAttribute('aria-pressed', String(show));
      t.setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
      break;
    }
    case 'official-preview': openPreview(getCase(t.dataset.id)); break;
    case 'pv-zoom': zoomPreview(Number(t.dataset.z)); break;
    case 'pv-close': closePreview(); break;
    case 'pv-download': downloadOfficial(t.dataset.id, t).then(ok => { if (ok) closePreview(); }); break;
    case 'pv-print': { const id = t.dataset.id; closePreview(); printOfficial(id); break; }
    case 'close-drawer': closeDrawer(true); break;
    case 'close-viewer': closeViewer(); break;
    case 'print': printCase(t.dataset.id); break;
    case 'official-pdf': downloadOfficial(t.dataset.id, t); break;
    case 'official-print': printOfficial(t.dataset.id); break;
    case 'zoom': {
      let ph, list;
      if (t.dataset.case) { const c = getCase(t.dataset.case); list = c ? (t.dataset.kind === 'lv' ? (c.livestock ? c.livestock.pages : []) : t.dataset.kind === 'oc' ? c.officerCard : t.dataset.kind === 'chip' ? c.chipPhotos : c.photos) : []; }
      else list = W ? W.d.photos : [];
      ph = list.find(p => p.id === t.dataset.id);
      if (ph) {
        const i = list.indexOf(ph) + 1;
        if (t.dataset.kind === 'lv') openViewer(ph.preview, 'كتاب الثروة الحيوانية — صفحة ' + i, '');
        else if (t.dataset.kind === 'chip') openViewer(ph.preview, 'صورة الشريحة ' + i, '');
        else if (t.dataset.kind === 'oc') openViewer(ph.preview, i === 1 ? 'بطاقة الضبطية — الوجه' : 'بطاقة الضبطية — الظهر', '');
        else openViewer(ph.preview, 'صورة ' + i + ' · ' + PHOTO_CAT[ph.category], ph.caption);
      }
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
    case 'lookup-chip': lookupChip(t.dataset.id, Number(t.dataset.i), t); break;
    case 'use-owner': {
      const cid = t.dataset.id, no = t.dataset.chip;
      if (updateCaseOwner(cid, c => { const r = c.chipLookup[no]; if (r && r.ok) applyOwner(c, r.owner); })) refreshOwnerBox(cid);
      break;
    }
    case 'del-lv': {
      const cid = t.dataset.case, pid = t.dataset.id;
      askConfirm('حذف صفحة الكتاب؟', '', 'حذف', true).then(yes => {
        if (yes && updateCaseLetter(cid, lv => { lv.pages = lv.pages.filter(x => x.id !== pid); })) refreshLetterBox(cid);
      });
      break;
    }
    case 'forward': decide(t.dataset.id, 'forwarded'); break;
    case 'director-return': decide(t.dataset.id, 'director_returned'); break;
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
    case 'wiz-preview': {
      const base = W.id ? getCase(W.id) : null;
      openPreview(normalize(Object.assign({ id: W.id || 'MECC-DRAFT', status: W.status || 'draft', createdAt: new Date().toISOString() },
        base ? { history: base.history, returnComments: base.returnComments } : { history: [], returnComments: [] }, serialize(W.d))));
      break;
    }
    case 'locate': useMyLocation(); break;
    case 'clear-loc': clearLocation(); break;
    case 'clear-sig': clearSig(t.dataset.key); break;
    case 'del-oc': {
      W.d.officerCard = W.d.officerCard.filter(x => x.id !== t.dataset.id);
      saveOfficerCardProfile(); renderOfficerCard(); saveNow();
      break;
    }
    case 'zoom-oc': {
      const i = W.d.officerCard.findIndex(x => x.id === t.dataset.id);
      if (i >= 0) openViewer(W.d.officerCard[i].preview, i === 0 ? 'وجه البطاقة' : 'ظهر البطاقة', '');
      break;
    }
    case 'mock-loc': mockLocate('تعذر الحصول على موقع الجهاز؛'); break;
    case 'photo-loc': {
      const ph = W.d.photos.find(x => x.id === t.dataset.id);
      if (ph && ph.gps) {
        setLocation(ph.gps.lat, ph.gps.lng, ph.gps.acc, 'photo');
        locMsg('ok', '<strong>تم تحديد الموقع من بيانات الصورة</strong>تحقق من الإحداثيات قبل المتابعة.');
        $('#locCard').scrollIntoView({ block: 'start' });
      }
      break;
    }
    case 'open-map': openMap(); break;
    case 'del-chip': {
      W.d.chipPhotos = W.d.chipPhotos.filter(x => x.id !== t.dataset.id);
      renderChips(); saveNow(); refreshValidation();
      $('#chipCam').focus();
      break;
    }
    case 'zoom-chip': {
      const i = W.d.chipPhotos.findIndex(x => x.id === t.dataset.id);
      if (i >= 0) openViewer(W.d.chipPhotos[i].preview, 'صورة الشريحة ' + (i + 1), '');
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
      refreshValidation();
      $('#photoMsg').innerHTML = '<p class="sr-only">تم حذف الصورة.</p>';
      const next = $$('#photoList [data-action="del-photo"]')[Math.min(i, W.d.photos.length - 1)];
      (next || $('#camInput')).focus();
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
document.addEventListener('paste', e => {
  const t = e.target;
  if (!W || !(t.id === 'f-lat' || t.id === 'f-lng' || t.id === 'f-place')) return;
  const text = (e.clipboardData || window.clipboardData).getData('text');
  const c = parseCoordText(text);
  if (!c || (t.id === 'f-place' && !/maps|@-?\d|[?&](q|ll)=/i.test(text))) return;
  e.preventDefault();
  setLocation(c.lat, c.lng, null, 'manual');
  locMsg('ok', 'تم لصق الإحداثيات: خط العرض ' + ltr(c.lat.toFixed(6)) + ' وخط الطول ' + ltr(c.lng.toFixed(6)) + '.');
});
document.addEventListener('submit', e => {
  if (e.target.id === 'loginForm') { e.preventDefault(); submitLogin(); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches('[data-lv-input]')) { const files = Array.from(t.files || []); t.value = ''; addLetterPages(t.dataset.id, files); return; }
  if (t.matches('[data-chipno]')) { const i = Number(t.dataset.chipno), v = latinDigits(t.value).replace(/\s/g, ''); updateCaseOwner(t.dataset.id, c => { c.chips[i] = v; c.chips = c.chips.filter(Boolean); }); return; }
  if (t.matches('[data-own]')) { const k = t.dataset.own, v = t.value.trim(); updateCaseOwner(t.dataset.id, c => { c[k] = k === 'qid' || k === 'phone' ? latinDigits(v) : v; if (k === 'person') c.offenderSource = ''; }); return; }
  if (t.matches('[data-lvr]')) { const k = t.dataset.lvr, v = latinDigits(t.value).trim(); updateCaseLetter(t.dataset.id, lv => { lv[k] = k === 'date' ? t.value : v; }); return; }
  if (!W || !t.closest('#wizard')) return;
  if (t.matches('[data-photo-input]')) { addPhotos(t.files).finally(() => { t.value = ''; }); return; }
  if (t.matches('[data-chip-input]')) { addChipPhotos(t.files).finally(() => { t.value = ''; }); return; }
  if (t.matches('[data-oc-input]')) { addOfficerCard(t.files).finally(() => { t.value = ''; }); return; }
  if (t.type === 'radio' || t.type === 'checkbox' || t.tagName === 'SELECT') onWizardField(t);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#sidebar').classList.contains('open')) closeDrawer(true);
  // Enter inside a single-line wizard field should not submit anything; move to next field instead
  if (e.key === 'Enter' && W && e.target.matches('#wizard input[type=text], #wizard input[type=tel]')) {
    e.preventDefault();
    const fields = $$('#panel' + W.step + ' input:not([type=hidden]):not([readonly]):not([type=radio]):not([type=checkbox]), #panel' + W.step + ' textarea, #panel' + W.step + ' select');
    const i = fields.indexOf(e.target);
    if (fields[i + 1]) fields[i + 1].focus();
  }
});
$('#viewer').addEventListener('click', e => { if (e.target.id === 'viewer') closeViewer(); });
$('#previewDlg').addEventListener('close', () => { $('#pvBody').innerHTML = ''; pv.c = null; });
window.addEventListener('hashchange', render);
window.addEventListener('storage', e => { if (e.key === KEY || e.key === null) { cache = null; if (!W) render(); } });
window.addEventListener('pagehide', () => { if (W && W.saveTimer) saveNow(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && W && W.saveTimer) saveNow(); });
window.addEventListener('online', updateNet);
window.addEventListener('offline', updateNet);
window.addEventListener('afterprint', () => { $('#printArea').innerHTML = ''; const st = document.getElementById('wpdPrintStyle'); if (st) st.remove(); });

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */
$('#menuBtn').innerHTML = icon('menu', 'ic-lg');
$('.side-head .icon-btn').innerHTML = icon('close', 'ic-lg');
$('#viewer .icon-btn').innerHTML = icon('close', 'ic-lg');
updateNet();
updateStorageUse();
if (!location.hash) history.replaceState(null, '', currentUser() ? '#systems' : '#login');
// In an embedded viewer, open with marked example reports the first time so the workflow is visible.
try {
  if (EMBEDDED && !readCases().length && !localStorage.getItem(SAMPLE_FLAG)) {
    writeCases(sampleCases().map(normalize));
    localStorage.setItem(SAMPLE_FLAG, '1');
  }
} catch (e) { /* storage unavailable: start empty */ }
render();

})();
