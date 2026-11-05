const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[character]));

module.exports = tour => {
  const language = escape(tour.contentLanguage || 'en');
  const direction = ['ar','fa','ur','iw','he','ps','sd','ug','yi','ckb'].includes(tour.contentLanguage) ? 'rtl' : 'ltr';
  const days = [...(tour.itineraryDays || [])].sort((a,b) => a.dayNumber - b.dayNumber);
  const enquiry = '../index.html?lang='+language+'&amp;tour='+encodeURIComponent(tour.id)+'#plan';
  const list = (title,items) => items?.length
    ? '<h2>'+title+'</h2><ul data-catalogue lang="'+language+'">'+items.map(item=>'<li>'+escape(item)+'</li>').join('')+'</ul>'
    : '';
  return `<!doctype html>
<html lang="${language}" dir="${direction}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(tour.name)} | Carnivores Safaris</title>
<meta name="description" content="${escape(tour.shortDescription)}">
<meta name="robots" content="noindex,nofollow">
<meta property="og:title" content="${escape(tour.name)} | Carnivores Safaris">
<meta property="og:description" content="${escape(tour.shortDescription)}">
<link rel="icon" href="../assets/logo.png">
<style>
body{margin:0;background:#f6f3eb;color:#23392c;font:17px/1.7 system-ui}
main,header{max-width:1000px;margin:auto;padding:32px 6%}
header{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
header img{width:100px}
a{color:inherit}
h1{overflow-wrap:anywhere;font:clamp(36px,6vw,65px)/1.1 Georgia}
h2{font:32px Georgia;margin-top:45px}
.cover{width:100%;max-height:500px;object-fit:cover}
.cta{display:inline-block;background:#a64b2c;color:white;padding:15px 25px;text-decoration:none}
article{border-bottom:1px solid #ccd1c4;padding:12px 0}
.translation-note{font-size:13px;border-inline-start:3px solid #a64b2c;padding:12px;background:#ece7da}
[hidden]{display:none!important}
</style></head><body>
<header><a href="../index.html?lang=${language}"><img src="../assets/logo.png" alt="Carnivores Safaris"></a><a href="../index.html?lang=${language}#journeys">All journeys</a></header>
<main data-tour-language="${language}">
<p class="translation-note" data-translation-note data-tour-fallback="${Boolean(tour.translationMissingFields?.length)}" hidden>Tour descriptions and itineraries are currently available in English.</p>
<p><span>${tour.durationDays} days</span> · <span data-catalogue lang="${language}">${escape(tour.destination)}</span></p>
<h1 data-catalogue lang="${language}">${escape(tour.name)}</h1>
<img class="cover" src="${escape(tour.coverImageUrl||'../assets/carnivores-safari.jpg')}" alt="${escape(tour.name)}">
<p data-catalogue lang="${language}">${escape(tour.description)}</p>
<p>From ${escape(tour.currency)} ${tour.basePrice} per person. Final availability and pricing confirmed in your proposal.</p>
<a class="cta" href="${enquiry}">Enquire about this journey ↗</a>
${list('Highlights',tour.highlights)}
<h2>Your itinerary</h2>
${days.length<tour.durationDays?'<p>Ask our team for the complete day-by-day plan for your dates.</p>':''}
${days.map(day=>`<article><h3><span>Day ${day.dayNumber}</span> · <span data-catalogue lang="${language}">${escape(day.title)}</span></h3>
<p data-catalogue lang="${language}">${escape(day.description)}</p>
<p data-catalogue lang="${language}">${escape(day.accommodation)} · ${escape(day.meals)}</p></article>`).join('')}
${list('Included',tour.inclusions)}
${list('Not included',tour.exclusions)}
<p><a class="cta" href="${enquiry}">Plan this safari ↗</a></p>
<p><small>Catalogue information supplied by the reservations system. Confirm your travel arrangements with the team.</small></p>
</main><script src="/localisation.js"></script><script src="../analytics.js"></script></body></html>`;
};
