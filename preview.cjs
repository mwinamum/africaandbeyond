const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'dist'),base='https://enterprisedev.lodgebridge.com/tourbooking/api',tid='11111111-1111-1111-1111-111111111111';
const fields='id name slug description shortDescription destination country durationDays durationNights minGroupSize maxGroupSize basePrice currency highlights inclusions exclusions coverImageUrl itineraryDays'.split(' '),clean=t=>Object.fromEntries(fields.map(k=>[k,t[k]]));
const tourLocale=require('./tour-localisation.cjs');
const localeStore=require('./locale-store.cjs');
const seo=require('./seo.cjs'),redirects=require('./redirects.json');const counts=new Map();
const crypto=require('crypto'),ledgerPath=path.join(__dirname,'submission-ledger.json');let ledger={};try{ledger=JSON.parse(fs.readFileSync(ledgerPath,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
function remember(key,value){ledger[key]=value;const temp=ledgerPath+'.tmp';fs.writeFileSync(temp,JSON.stringify(ledger));fs.renameSync(temp,ledgerPath)}

async function api(route,options={}){return fetch(base+route+'?tenantSlug=default',{...options,headers:{'X-Tenant-Slug':'default','Content-Type':'application/json'},signal:AbortSignal.timeout(20000)})}
http.createServer(async(req,res)=>{res.setHeader('X-Robots-Tag','noindex, nofollow');const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};try{const url=new URL(req.url,'http://localhost');
if(req.method==='GET'&&url.pathname==='/api/locale'){
  const country=String(req.headers['cf-ipcountry']||'').toUpperCase();
  return send(200,{country:/^[A-Z]{2}$/.test(country)&&!['XX','T1'].includes(country)?country:null,languages:localeStore.languages(),countryLanguages:localeStore.countryLanguages});
}
if(req.method==='GET'&&url.pathname==='/api/localisation'){
  const language=localeStore.normalize(url.searchParams.get('lang'));
  return send(200,localeStore.ui(language));
}
if(req.method==='GET'&&redirects[url.pathname]){const target=redirects[url.pathname];if(typeof target==='string'&&target.startsWith('/')&&!target.startsWith('//')&&target!==url.pathname){res.writeHead(301,{Location:target});return res.end()}}
if(req.method==='GET'&&url.pathname==='/sitemap.xml'){const r=await api('/tours');if(!r.ok)return send(503,{message:'Catalogue unavailable'});const xml=seo.sitemap((await r.json()).filter(t=>t.tenantId===tid&&t.isActive&&!t.isDeleted));if(!xml)return send(404,{message:'Production origin not configured'});res.writeHead(200,{'Content-Type':'application/xml'});return res.end(xml)}

if(req.method==='GET'&&/^\/tours\/[a-z0-9-]+\.html$/.test(url.pathname)){const slug=url.pathname.split('/').pop().replace(/\.html$/,'');const r=await api('/tours/'+slug);if(!r.ok)return send(r.status===404?404:502,{message:'Journey unavailable'});const t=await r.json();if(t.tenantId!==tid||!t.isActive||t.isDeleted)return send(404,{message:'Journey unavailable'});res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});return res.end(seo.decorate(require('./render-tour.cjs')(tourLocale.localize(clean(t),url.searchParams.get('lang'))),url.pathname,clean(t)))}
if(req.method==='GET'&&(url.pathname==='/api/tours'||/^\/api\/tours\/[a-z0-9-]+$/.test(url.pathname))){const r=await api(url.pathname.slice(4));if(!r.ok)return send(502,{message:'Catalogue unavailable'});const data=await r.json(),valid=t=>t.tenantId===tid&&t.isActive&&!t.isDeleted;if(Array.isArray(data))return send(200,data.filter(valid).map(t=>tourLocale.localize(clean(t),url.searchParams.get('lang'))));return valid(data)?send(200,tourLocale.localize(clean(data),url.searchParams.get('lang'))):send(404,{message:'Journey unavailable'})}
if(req.method==='POST'&&url.pathname==='/api/track'){
if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return send(403,{message:'Invalid origin'});
const key='track:'+(req.headers['cf-connecting-ip']||req.socket.remoteAddress);const now=Date.now();let q=counts.get(key);if(!q||now-q.time>60000){q={time:now,count:0};counts.set(key,q)}if(++q.count>10)return send(429,{message:'Please wait a minute before trying again.'});
let body='';for await(const chunk of req){body+=chunk;if(body.length>2000)return send(413,{message:'Request too large'})}let d;try{d=JSON.parse(body)}catch{return send(400,{message:'Invalid request'})}if(!/^INQ-[0-9-]+$/.test(d.reference||'')||!/^\S+@\S+\.\S+$/.test(d.email||''))return send(400,{message:'Enter your enquiry reference and email.'});
const r=await fetch(base+'/inquiries/view/default/'+encodeURIComponent(d.reference)+'?tenantSlug=default&email='+encodeURIComponent(d.email.trim()),{headers:{'X-Tenant-Slug':'default'},signal:AbortSignal.timeout(15000)});if(!r.ok)return send(r.status===404?404:502,{message:'Unable to find this enquiry. Check the reference and email, or try again later.'});const result=await r.json();return send(200,{inquiryNumber:result.inquiryNumber,isConverted:result.isConverted,createdAt:result.createdAt});}
if(req.method==='POST'&&url.pathname==='/api/inquiries'){
if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return send(403,{message:'Invalid origin'});
const key=req.headers['cf-connecting-ip']||req.socket.remoteAddress,now=Date.now();let quota=counts.get(key);if(!quota||now-quota.time>3600000){quota={time:now,count:0};counts.set(key,quota)}if(quota.count>=8)return send(429,{message:'Too many enquiries. Contact the team directly.'});
let raw='';for await(const c of req){raw+=c;if(raw.length>20000)return send(413,{message:'Enquiry too large'})}let d;try{d=JSON.parse(raw)}catch{return send(400,{message:'Invalid enquiry'})}
if(typeof d.firstName!=='string'||!d.firstName.trim()||typeof d.lastName!=='string'||!d.lastName.trim()||!/^\S+@\S+\.\S+$/.test(d.email||'')||typeof d.phone!=='string'||!d.phone.trim()||!Number.isInteger(d.numberOfAdults)||d.numberOfAdults<1||d.numberOfAdults>50||!Number.isInteger(d.numberOfChildren)||d.numberOfChildren<0||d.numberOfChildren>30)return send(400,{message:'Please check your names, email, phone and traveller counts.'});
if(d.preferredStartDate&&(!Number.isFinite(Date.parse(d.preferredStartDate))||Date.parse(d.preferredStartDate)<Date.now()+3*86400000))return send(400,{message:'Choose a start date at least four days from today.'});
if(d.tourId){const r=await api('/tours');if(!r.ok)throw Error();const tours=await r.json();if(!tours.some(t=>t.id===d.tourId&&t.tenantId===tid&&t.isActive&&!t.isDeleted))return send(400,{message:'Choose an available journey.'})}
quota.count++;const payload={};for(const k of 'firstName lastName email phone tourId preferredDestination preferredStartDate preferredEndDate isDateFlexible numberOfAdults numberOfChildren specialRequirements budgetRange'.split(' '))payload[k]=d[k];Object.assign(payload,{tenantSlug:'default',preferredContact:'Email',referralSource:'Carnivores Safaris website'});const fingerprint=crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');const prior=ledger[fingerprint];if(prior&&Date.now()-prior.time<86400000){if(prior.reference)return send(200,{inquiryNumber:prior.reference});return send(409,{message:'This enquiry has already been sent for processing. Its outcome is not confirmed. Check your email or contact the team before submitting again.'})}
remember(fingerprint,{time:Date.now(),state:'pending'});
try{const r=await api('/inquiries/submit',{method:'POST',body:JSON.stringify(payload)});let result;try{result=await r.json()}catch{throw Error('Invalid response')}
if(!r.ok||!result.inquiryNumber){remember(fingerprint,{time:Date.now(),state:'uncertain'});return send(409,{message:'We could not confirm the outcome. Your enquiry may already be saved. Please check your email or contact the team; do not submit again.'})}
remember(fingerprint,{time:Date.now(),state:'confirmed',reference:result.inquiryNumber});return send(200,{inquiryNumber:result.inquiryNumber});
}catch{remember(fingerprint,{time:Date.now(),state:'uncertain'});return send(409,{message:'The connection was interrupted after sending. Your enquiry may already be saved. Check your email or contact the team before trying again.'})}}

if(url.pathname.startsWith('/api/'))return send(404,{message:'Not found'});if(!['GET','HEAD'].includes(req.method))return send(405,{message:'Method not allowed'});const name=decodeURIComponent(url.pathname),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep))return send(403,{message:'Forbidden'});if(path.extname(file)==='.mp4'){
let stat;try{stat=fs.statSync(file)}catch{return send(404,{message:'Not found'})}
const size=stat.size;let start=0,end=size-1,status=200;
if(req.headers.range){const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':'bytes */'+size});return res.end()}
if(!match[1])start=Math.max(0,size-Number(match[2]));else {start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]))}
if(start>end||start>=size){res.writeHead(416,{'Content-Range':'bytes */'+size});return res.end()}status=206;}
const headers={'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':end-start+1,'Cache-Control':'public, max-age=3600'};
if(status===206)headers['Content-Range']='bytes '+start+'-'+end+'/'+size;
res.writeHead(status,headers);if(req.method==='HEAD')return res.end();const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());return stream.pipe(res);
}
fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found')}const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg'};res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Referrer-Policy':'strict-origin-when-cross-origin','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:(file===path.join(root,'index.html')?seo.decorate(data.toString(),'/'):data))})
}catch{send(502,{message:'Connection interrupted. If you submitted an enquiry, contact the team before retrying to avoid a duplicate.'})}}).listen(8767,'127.0.0.1',()=>console.log('Integrated preview: http://127.0.0.1:8767'));
