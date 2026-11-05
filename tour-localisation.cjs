const dictionaries = require('./tour-translations.json');
const localeStore = require('./locale-store.cjs');
const textFields = ['name', 'destination', 'country', 'description', 'shortDescription'];
const dayFields = ['title', 'description', 'accommodation', 'meals'];
const identity = new Set([
  'Serengeti', 'Tarangire', 'Ruaha', 'Katavi', 'Kigoma', 'Nyerere', 'Saadani', 'Karatu',
  'Mikumi, Udzungwa', 'Tarangire, Ngorongoro', 'Kogatende, Serengeti', 'Ndutu, Serengeti',
  'Socialist Peak', 'Stone Town',
  'Sangaiwe Tented Lodge', 'Seronera Campsite', 'Tortilis Camp', 'Tarangire Safari Lodge',
  'Serengeti Sopa Lodge', 'Ngorongoro Sopa Lodge', 'Rufiji River Camp', 'Miriakamba Hut', 'Saddle Hut',
  'Shira 1 Camp (3,500m)', 'Shira 2 Camp (3,850m)', 'Barranco Camp (3,960m)',
  'Karanga Camp (4,035m)', 'Barafu Camp (4,640m)', 'Mweka Camp (3,100m)'
]);
const templates = Object.keys(dictionaries.de).filter(key => key.includes('{')).map(key => {
  const names = [];
  const expression = key.split(/(\{[a-z]+\})/).map(part => {
    if (/^\{[a-z]+\}$/.test(part)) {
      names.push(part.slice(1,-1));
      return '(.+?)';
    }
    return part.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  }).join('');
  return {key, names, expression:new RegExp('^'+expression+'$')};
});

function language(value) {
  return localeStore.normalize(value);
}

function translate(text, lang, dictionary = localeStore.tours(lang)) {
  if (!text || lang === 'en' || identity.has(text)) return {text, missing:false};
  if (Object.hasOwn(dictionary,text)) return {text:dictionary[text], missing:false};
  for (const template of templates) {
    if (!dictionary[template.key]) continue;
    const match = text.match(template.expression);
    if (!match) continue;
    let result = dictionary[template.key];
    let missing = false;
    template.names.forEach((name,index) => {
      const value = name === 'destination' ? translate(match[index+1],lang,dictionary) : {text:match[index+1]};
      missing ||= Boolean(value.missing);
      result = result.replace('{'+name+'}',value.text);
    });
    return {text:result,missing};
  }
  return {text,missing:true};
}

function localize(tour, requestedLanguage) {
  const lang = language(requestedLanguage);
  const dictionary = localeStore.tours(lang);
  const missingFields = [];
  function field(value, name) {
    const result = translate(value,lang,dictionary);
    if (result.missing) missingFields.push(name);
    return result.text;
  }
  const result = {...tour};
  textFields.forEach(name => result[name] = field(tour[name],name));
  for (const name of ['highlights','inclusions','exclusions']) {
    result[name] = (tour[name] || []).map((value,index) => field(value,name+'.'+index));
  }
  result.itineraryDays = (tour.itineraryDays || []).map((day,index) => {
    const translated = {...day};
    dayFields.forEach(name => translated[name] = field(day[name],'itineraryDays.'+index+'.'+name));
    return translated;
  });
  // Keep stable identifiers, prices, ordering and source search terms across languages.
  result.sourceSearchText = [tour.name,tour.destination,tour.country,tour.shortDescription,...(tour.highlights||[])].join(' ');
  result.tourCategory = /climb|trek|kilimanjaro|meru/i.test(tour.name) ? 'mountain'
    : /zanzibar|beach|coast|island/i.test(tour.destination+' '+tour.name) ? 'coast' : 'wildlife';
  result.contentLanguage = lang;
  result.translationMissingFields = missingFields;
  return result;
}

module.exports = {language, localize, translate, preservedNames:[...identity]};
