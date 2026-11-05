/* Provider-neutral, memory-only events. No email, names, phone or enquiry reference. */
window.safariEvents=[];
window.safariTrack=(event,properties={})=>{const item={event,...properties};window.safariEvents.push(item);if(window.safariEvents.length>100)window.safariEvents.shift();window.dispatchEvent(new CustomEvent('safari:analytics',{detail:item}))};
safariTrack('page_view',{path:location.pathname});
document.addEventListener('click',e=>{const a=e.target.closest('a,button');if(!a)return;if(a.dataset.filter)safariTrack('tour_filter',{filter:a.dataset.filter});if(a.dataset.slug)safariTrack('tour_quick_view',{slug:a.dataset.slug});if(a.matches('a[href*="#plan"]'))safariTrack('enquiry_cta');});
document.querySelector('#enquiry')?.addEventListener('input',function started(){safariTrack('enquiry_started');this.removeEventListener('input',started)});
