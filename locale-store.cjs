const fs = require('node:fs');
const path = require('node:path');
const baseUi = require('./ui-translations.json');
const baseTours = require('./tour-translations.json');
const overrides = require('./translation-overrides.json');
const file = path.join(__dirname, 'generated-locales.json');
let cached = {};
let modified = null;

function generated() {
  let stat;
  try { stat = fs.statSync(file); } catch (error) {
    if(error.code === 'ENOENT') return {};
    throw error;
  }
  if(stat.mtimeMs !== modified) {
    cached = JSON.parse(fs.readFileSync(file,'utf8'));
    modified = stat.mtimeMs;
  }
  return cached;
}

const countryLanguages = {
  CN:['zh-CN','zh-TW'], TW:['zh-TW'], HK:['zh-TW','en'], MO:['zh-TW','pt'],
  JP:['ja'], KR:['ko'], KP:['ko'], IN:['hi','bn','te','mr','ta','ur','gu','kn','ml','pa','or','as','en'],
  BD:['bn'], PK:['ur','pa','sd','ps','en'], LK:['si','ta'], NP:['ne'], BT:['dz'],
  TH:['th'], VN:['vi'], LA:['lo'], KH:['km'], MM:['my'], ID:['id','jv','su'],
  MY:['ms','en'], SG:['en','zh-CN','ms','ta'], PH:['tl','fil','ceb','ilo','en'],
  MN:['mn'], KZ:['kk','ru'], KG:['ky','ru'], UZ:['uz','ru'], TJ:['tg','ru'], TM:['tk'],
  AF:['ps','fa'], IR:['fa'], IQ:['ar','ku'], TR:['tr'], AM:['hy'], AZ:['az'], GE:['ka'],
  SA:['ar'], AE:['ar','en'], QA:['ar','en'], KW:['ar'], BH:['ar'], OM:['ar'], YE:['ar'],
  JO:['ar'], LB:['ar','fr'], SY:['ar'], IL:['iw','he','ar'], PS:['ar'],
  DE:['de'], AT:['de'], LI:['de'], CH:['de','fr','it'], FR:['fr'], MC:['fr'],
  BE:['nl','fr','de'], LU:['fr','de','lb'], IT:['it'], SM:['it'], VA:['it'],
  ES:['es','ca','eu','gl'], PT:['pt'], NL:['nl'], DK:['da'], SE:['sv'], NO:['no','nb'],
  FI:['fi','sv'], IS:['is'], IE:['en','ga'], GB:['en','cy','gd'], MT:['mt','en'],
  PL:['pl'], CZ:['cs'], SK:['sk'], HU:['hu'], RO:['ro'], MD:['ro'], BG:['bg'],
  GR:['el'], CY:['el','tr'], HR:['hr'], SI:['sl'], RS:['sr'], BA:['bs','hr','sr'],
  ME:['sr'], MK:['mk'], AL:['sq'], XK:['sq','sr'], EE:['et'], LV:['lv'], LT:['lt'],
  UA:['uk'], BY:['be','ru'], RU:['ru'],
  US:['en','es'], CA:['en','fr'], MX:['es'], BR:['pt-BR','pt'], AR:['es'], CL:['es'], CO:['es'],
  PE:['es','qu'], EC:['es'], UY:['es'], PY:['es','gn'], BO:['es','ay','qu'], VE:['es'],
  CR:['es'], PA:['es'], GT:['es'], HN:['es'], SV:['es'], NI:['es'], CU:['es'], DO:['es'],
  HT:['ht','fr'], JM:['en'], TT:['en'], BZ:['en','es'], GY:['en'], SR:['nl'],
  AU:['en'], NZ:['en','mi'], FJ:['en','fj'], PG:['en'], WS:['sm','en'], TO:['to','en'],
  TZ:['sw','en'], KE:['sw','en'], UG:['en','sw','lg'], RW:['rw','en','fr'], BI:['rn','fr','sw'],
  ZA:['en','af','zu','xh','st','tn','ts'], ET:['am','om','ti'], ER:['ti','ar'],
  SO:['so','ar'], DJ:['fr','ar','so'], EG:['ar'], LY:['ar'], TN:['ar','fr'],
  DZ:['ar','fr'], MA:['ar','fr'], SD:['ar','en'], SS:['en'],
  NG:['en','ha','yo','ig'], GH:['en','ak'], SN:['fr','wo'], GM:['en'],
  CI:['fr'], CM:['fr','en'], CD:['fr','ln','sw'], CG:['fr','ln'], GA:['fr'],
  BJ:['fr'], TG:['fr'], BF:['fr'], ML:['fr','bm'], NE:['fr','ha'], TD:['ar','fr'],
  GN:['fr'], GW:['pt'], SL:['en'], LR:['en'], AO:['pt'], MZ:['pt'],
  ZM:['en'], ZW:['en','sn','nd'], BW:['en','tn'], NA:['en','af'], LS:['st','en'],
  SZ:['en','ss'], MW:['en','ny'], MG:['mg','fr'], MU:['en','fr'], SC:['fr','en'],
  CV:['pt'], ST:['pt'], GQ:['es','fr','pt'], KM:['ar','fr'], MR:['ar'], CF:['fr']
};
const names = {
  en:'English', de:'Deutsch', fr:'Français', it:'Italiano', sw:'Kiswahili',
  'zh-CN':'简体中文', 'zh-TW':'繁體中文', ja:'日本語', ko:'한국어', hi:'हिन्दी', bn:'বাংলা',
  ta:'தமிழ்', te:'తెలుగు', mr:'मराठी', gu:'ગુજરાતી', kn:'ಕನ್ನಡ', ml:'മലയാളം', pa:'ਪੰਜਾਬੀ',
  ur:'اردو', ar:'العربية', fa:'فارسی', iw:'עברית', he:'עברית', id:'Bahasa Indonesia',
  ms:'Bahasa Melayu', th:'ไทย', vi:'Tiếng Việt', tl:'Filipino', my:'မြန်မာ', km:'ខ្មែរ',
  lo:'ລາວ', ne:'नेपाली', si:'සිංහල', es:'Español', pt:'Português', ru:'Русский',
  nl:'Nederlands', pl:'Polski', sv:'Svenska', da:'Dansk', no:'Norsk', fi:'Suomi',
  tr:'Türkçe', uk:'Українська', el:'Ελληνικά', cs:'Čeština', ro:'Română', hu:'Magyar',
  am:'አማርኛ', af:'Afrikaans', zu:'isiZulu', so:'Soomaali'
};
Object.assign(names, {
  az:'Azərbaycan dili', bg:'Български', ca:'Català', eo:'Esperanto', et:'Eesti', eu:'Euskara',
  ga:'Gaeilge', gl:'Galego', ky:'Кыргызча', lt:'Lietuvių', lv:'Latviešu',
  'pt-BR':'Português (Brasil)', sk:'Slovenčina', sl:'Slovenščina', sq:'Shqip'
});
const rtl = new Set(['ar','fa','ur','iw','he','ps','sd','ug','yi','ckb']);

function languages() {
  const result = Object.assign(Object.create(null), {en:names.en});
  for(const code of Object.keys(baseUi)) result[code] = names[code];
  for(const [code, record] of Object.entries(generated())) {
    if(record.complete && record.ui && record.tours) result[code] = names[code] || record.name;
  }
  return result;
}

function normalize(value) {
  const requested = String(value || '').replace(/_/g,'-').toLowerCase();
  const available = languages();
  const aliases = {'zh':'zh-CN','zh-hans':'zh-CN','zh-hant':'zh-TW','zh-hk':'zh-TW','zh-tw':'zh-TW','zh-sg':'zh-CN','he':'iw','fil':'tl','nb':'no'};
  const base = requested.split('-')[0];
  const chinese = requested.startsWith('zh-') ? (/hant|tw|hk/.test(requested) ? 'zh-TW' : 'zh-CN') : null;
  const alias = chinese || aliases[requested] || aliases[base];
  if(alias && available[alias]) return alias;
  const exact = Object.keys(available).find(code=>code.toLowerCase()===requested);
  if(exact) return exact;
  return available[base] ? base : 'en';
}

function ui(language) {
  return {...generated()[language]?.ui,...baseUi[language],...overrides[language]?.ui};
}
function tours(language) {
  return {...generated()[language]?.tours,...baseTours[language],...overrides[language]?.tours};
}
module.exports = {languages, normalize, ui, tours, countryLanguages, names, rtl};
