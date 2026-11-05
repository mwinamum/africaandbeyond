const catalogue=document.querySelector('#cards'),selector=document.querySelector('#journey');
const escapeText=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let tours=[],tourRequest=0;
function imageUrl(v){if(!v)return 'assets/carnivores-safari.jpg';try{const u=new URL(v,location.origin);if(u.hostname==='images.unsplash.com'){u.searchParams.set('auto','format');u.searchParams.set('fit','crop');u.searchParams.set('w','800');u.searchParams.set('q','75')}return ['https:','http:'].includes(u.protocol)?u.href:'assets/carnivores-safari.jpg'}catch{return 'assets/carnivores-safari.jpg'}}
function updateSelectedTrip(){const box=document.querySelector('#selectedTrip'),t=tours.find(t=>t.id===selector.value);box.hidden=!t;if(!t){box.replaceChildren();return}box.innerHTML=`<img src="${escapeText(imageUrl(t.coverImageUrl||'assets/carnivores-safari.jpg'))}" alt="${escapeText(t.name)}" width="76" height="76"><div><strong data-catalogue lang="${escapeText(t.contentLanguage||'en')}">${escapeText(t.name)}</strong><small>${t.durationDays} days · <span data-catalogue lang="${escapeText(t.contentLanguage||'en')}">${escapeText(t.destination)}</span></small></div><button type="button" aria-label="Remove selected trip">×</button>`;box.querySelector('img').onerror=e=>{e.target.onerror=null;e.target.src='assets/carnivores-safari.jpg'};box.querySelector('button').onclick=()=>{if(selector.disabled)return;selector.value='';updateSelectedTrip();selector.focus()}}
selector.addEventListener('change',updateSelectedTrip);
function summarizeCatalogue(items){const durations=items.map(t=>Number(t.durationDays)).filter(n=>Number.isFinite(n)&&n>0);const places=[...new Set(items.map(t=>(t.destination||'').trim()).filter(Boolean))];return {count:items.length,duration:durations.length?(Math.min(...durations)===Math.max(...durations)?String(Math.min(...durations)):Math.min(...durations)+'–'+Math.max(...durations)):null,places}}
function updateHeroSummary(){const summary=summarizeCatalogue(tours),box=document.querySelector('#heroStats');box.hidden=!summary.count;if(!summary.count){box.replaceChildren();return}box.innerHTML=`<div><strong>${summary.count}</strong><span>${summary.count===1?'Journey':'Journeys'} to explore</span></div>${summary.duration?'<div><strong>'+escapeText(summary.duration)+' days</strong><span>Trip lengths</span></div>':''}<div><strong>Locally planned</strong><span>With our Arusha team</span></div>`;}
function category(t){if(t.tourCategory)return t.tourCategory;return /climb|trek|kilimanjaro|meru/i.test(t.name)?'mountain':/zanzibar|beach|coast/i.test(t.destination+' '+t.name)?'coast':'wildlife'}
const search = document.querySelector('#tour-search');
const clearSearch = document.querySelector('#clear-tour-search');
const pages = document.querySelector('#tour-pages');
const count = document.querySelector('#catalogue-count');
const pageSize = 9;
let filter = 'all', page = 1;

function render(){
  clearSearch.hidden = !search.value;
  const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = tours.filter(tour => {
    if(filter !== 'all' && category(tour) !== filter) return false;
    const searchable = [tour.name, tour.destination, tour.country, tour.shortDescription, tour.sourceSearchText, ...(tour.highlights || [])].join(' ').toLowerCase();
    return terms.every(term => searchable.includes(term));
  });
  const pageCount = Math.ceil(matches.length / pageSize);
  page = Math.min(page, Math.max(1, pageCount));
  const start = (page - 1) * pageSize;
  const visible = matches.slice(start, start + pageSize);
  count.textContent = matches.length ? `Showing ${start + 1}–${start + visible.length} of ${matches.length} ${matches.length === 1 ? 'tour' : 'tours'}` : 'No matching tours';
  renderPages(pageCount);
  catalogue.innerHTML=visible.map(t=>`<article class="card"><div class="photo"><img decoding="async" width="800" height="600" loading="lazy" src="${escapeText(imageUrl(t.coverImageUrl))}" alt="${escapeText(t.name)}"></div><div class="card-copy"><p><small>${t.durationDays} DAYS · <span data-catalogue lang="${escapeText(t.contentLanguage||'en')}">${escapeText(t.destination)}</span></small></p><h3 data-catalogue lang="${escapeText(t.contentLanguage||'en')}">${escapeText(t.name)}</h3><p data-catalogue lang="${escapeText(t.contentLanguage||'en')}">${escapeText(t.shortDescription)}</p><p class="price">${Number(t.basePrice)>0 && t.currency ? `From <strong>${escapeText(t.currency)} ${(window.safariNumber||String)(Number(t.basePrice))}</strong> per person` : "Price on request"}</p><div class="card-actions"><a href="tours/${escapeText(t.slug)}.html?lang=${window.safariLocale||'en'}">View itinerary ↗</a><button data-slug="${escapeText(t.slug)}">Quick view</button></div></div></article>`).join('')||'<p>No tours match your search and filters. Try a different search or select All journeys.</p>';catalogue.querySelectorAll('[data-slug]').forEach(b=>b.onclick=()=>openTour(b.dataset.slug))}
async function openTour(slug){const request=++tourRequest,cta=document.querySelector('#tripPlan');cta.hidden=true;const modal=document.querySelector('#trip');document.querySelector('#tripTitle').removeAttribute('data-catalogue');document.querySelector('#tripTitle').textContent='Loading journey…';currentTourSlug=slug;document.querySelector('#tripIntro').textContent='';document.querySelector('#tripDays').textContent='';if(!modal.open)modal.showModal();try{const r=await fetch('/api/tours/'+encodeURIComponent(slug)+'?lang='+(window.safariLocale||'en'));if(!r.ok)throw Error();const t=await r.json();if(request!==tourRequest)return;document.querySelector('#tripTitle').textContent=t.name;document.querySelector('#tripTitle').dataset.catalogue='';document.querySelector('#tripTitle').lang=t.contentLanguage;document.querySelector('#tripIntro').lang=t.contentLanguage;document.querySelector('#tripIntro').textContent=t.description;cta.hidden=false;cta.onclick=()=>{selector.value=t.id;updateSelectedTrip();modal.close()};const list=(title,items)=>items?.length?`<h3>${title}</h3><ul>${items.map(i=>`<li data-catalogue lang="${escapeText(t.contentLanguage||'en')}">${escapeText(i)}</li>`).join('')}</ul>`:'';document.querySelector('#tripDays').innerHTML=list('Highlights',t.highlights)+(t.itineraryDays?.length?t.itineraryDays.sort((a,b)=>a.dayNumber-b.dayNumber).map(d=>`<h3 data-catalogue lang="${escapeText(t.contentLanguage||'en')}">Day ${d.dayNumber}: ${escapeText(d.title)}</h3><p data-catalogue lang="${escapeText(t.contentLanguage||'en')}">${escapeText(d.description)}</p><p data-catalogue lang="${escapeText(t.contentLanguage||'en')}">${escapeText(d.accommodation||'')} ${escapeText(d.meals||'')}</p>`).join(''):'<p>Ask for a day-by-day itinerary tailored to your dates.</p>')+list('Included',t.inclusions)+list('Not included',t.exclusions)}catch{if(request!==tourRequest)return;cta.hidden=true;document.querySelector('#tripTitle').textContent='Journey unavailable';document.querySelector('#tripIntro').textContent='Please try again or contact the team.'}}
function renderPages(pageCount){
  pages.hidden = pageCount < 2;
  pages.replaceChildren();
  if(pages.hidden) return;
  function add(label, target, disabled = false){
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled = disabled;
    if(typeof label === 'number'){
      button.setAttribute('aria-label', 'Page ' + label);
      if(label === page) button.setAttribute('aria-current', 'page');
    }
    button.onclick = () => {
      page = target;
      render();
      catalogue.scrollIntoView({block:'start'});
      count.tabIndex = -1;
      count.focus({preventScroll:true});
    };
    pages.append(button);
  }
  add('Previous', page - 1, page === 1);
  for(let number = 1; number <= pageCount; number++) add(number, number);
  add('Next', page + 1, page === pageCount);
}

clearSearch.onclick = () => {
  search.value = '';
  page = 1;
  render();
  search.focus();
};
search.addEventListener('input', () => {
  page = 1;
  render();
});
document.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => {
  if(search.disabled) return;
  filter = button.dataset.filter;
  page = 1;
  document.querySelectorAll('[data-filter]').forEach(item => {
    item.classList.toggle('active', item === button);
    item.setAttribute('aria-pressed', String(item === button));
  });
  render();
});
let catalogueRequest = 0;
let currentTourSlug = null;
async function loadTours(){
  const request = ++catalogueRequest;
  const selected = selector.value || new URLSearchParams(location.search).get('tour');
  const language = window.safariLocale || 'en';
  search.disabled = true;
  catalogue.innerHTML = '<p>Loading our journeys…</p>';
  pages.hidden = true;
  count.textContent = '';
  try {
    const response = await fetch('/api/tours?lang='+language);
    if(!response.ok) throw Error();
    const data = await response.json();
    if(request !== catalogueRequest) return;
    tours = data;
    search.disabled = false;
    document.querySelectorAll('[data-tour-link]').forEach(link => {
      link.hidden = !tours.some(tour => tour.slug === link.dataset.tourLink);
      link.href = '/tours/'+link.dataset.tourLink+'.html?lang='+language;
    });
    document.querySelectorAll('[data-filter]').forEach(button => {
      button.hidden = button.dataset.filter !== 'all' && !tours.some(tour => category(tour) === button.dataset.filter);
    });
    document.querySelectorAll('[data-translation-note]').forEach(note => {
      note.dataset.tourFallback = String(tours.some(tour => tour.translationMissingFields?.length));
    });
    selector.replaceChildren(new Option('Help me choose',''));
    tours.forEach(tour => {
      const option = new Option(tour.name,tour.id);
      option.dataset.catalogue = '';
      option.lang = tour.contentLanguage;
      selector.add(option);
    });
    if(tours.some(tour => tour.id === selected)) selector.value = selected;
    render();
    updateHeroSummary();
    updateSelectedTrip();
    if(document.querySelector('#trip').open && currentTourSlug) openTour(currentTourSlug);
  } catch {
    if(request !== catalogueRequest) return;
    catalogue.innerHTML = '<p>Our journey catalogue is temporarily unavailable. You can still send a tailor-made enquiry in the trip planner.</p>';
  }
}
Promise.resolve(window.safariLocaleReady).then(loadTours);
const form=document.querySelector('#enquiry'),status=document.querySelector('#sendOptions');status.classList.remove('hidden');status.textContent='';status.setAttribute('role','status');
form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button[type=submit]');if(button.disabled)return;button.disabled=true;button.textContent='Sending…';status.textContent='';const d=new FormData(form);const payload={firstName:d.get('firstName'),lastName:d.get('lastName'),email:d.get('email'),phone:d.get('phone'),tourId:d.get('journey')||null,preferredDestination:tours.find(t=>t.id===d.get('journey'))?.destination||'Tanzania',preferredStartDate:d.get('date')?d.get('date')+'T00:00:00Z':null,preferredEndDate:null,isDateFlexible:!d.get('date'),numberOfAdults:Number(d.get('travellers')),numberOfChildren:Number(d.get('children')),specialRequirements:d.get('message'),budgetRange:d.get('budget'),preferredContact:'Email',referralSource:'Carnivores Safaris website'};try{const r=await fetch('/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await r.json();if(!r.ok)throw Object.assign(new Error(result.message||'Your enquiry could not be confirmed. Please contact the team before retrying.'),{uncertain:r.status===409});if(!result.inquiryNumber)throw Error('No enquiry reference was returned. Please contact the team.');status.textContent='Thank you. Your enquiry reference is '+result.inquiryNumber+'. Keep this reference for your correspondence.';const link=document.createElement('a');link.href='track.html?reference='+encodeURIComponent(result.inquiryNumber);link.textContent='Track this enquiry ↗';link.className='text-link';status.append(document.createElement('br'),link);window.safariTrack?.('enquiry_confirmed');button.textContent='Enquiry received';form.querySelectorAll('input,textarea,select,#selectedTrip button').forEach(el=>el.disabled=true)}catch(err){status.textContent=err.message;button.disabled=!!err.uncertain;button.textContent=err.uncertain?'Awaiting confirmation':'Send my enquiry ↗'}};


document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.classList.contains('active'))));



window.addEventListener('safari-language', () => { if(catalogueRequest) loadTours(); });
