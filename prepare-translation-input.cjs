const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const base='https://enterprisedev.lodgebridge.com/tourbooking/api/tours';
async function main(){
  const headers={'X-Tenant-Slug':'default'};
  const response=await fetch(base+'?tenantSlug=default',{headers,signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Tour catalogue request failed '+response.status);
  const items=(await response.json()).filter(t=>t.tenantId==='11111111-1111-1111-1111-111111111111'&&t.isActive&&!t.isDeleted);
  const tours=[];
  for(let index=0;index<items.length;index+=4){
    const details=await Promise.all(items.slice(index,index+4).map(async item=>{
      const response=await fetch(base+'/'+item.slug+'?tenantSlug=default',{headers,signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw Error('Tour detail request failed '+response.status);
      const tour=await response.json();
      if(tour.tenantId!=='11111111-1111-1111-1111-111111111111'||!tour.isActive||tour.isDeleted)throw Error('Tour changed during preparation');
      return tour;
    }));
    tours.push(...details);
  }
  const strings=new Set();
  const add=value=>{if(typeof value==='string'&&value.trim())strings.add(value)};
  tours.forEach(tour=>{
    for(const key of ['name','destination','country','description','shortDescription'])add(tour[key]);
    for(const key of ['highlights','inclusions','exclusions'])(tour[key]||[]).forEach(add);
    for(const day of tour.itineraryDays||[])for(const key of ['title','description','accommodation','meals'])add(day[key]);
  });
  const input={
    ui:Object.keys(require('./ui-translations.json').de),
    tours:[...strings],
    preserve:require('./tour-localisation.cjs').preservedNames,
    tourCount:tours.length,
    itineraryDayCount:tours.reduce((total,tour)=>total+(tour.itineraryDays||[]).length,0)
  };
  const directory=process.env.SAFARI_WORK_DIR||path.join(root,'work');
  const file=path.resolve(directory,'translation-input.json');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(input,null,2));
  console.log('Prepared '+input.tourCount+' tours and '+input.itineraryDayCount+' itinerary days.');
}
main().catch(()=>{console.error('Could not prepare the public catalogue for translation.');process.exitCode=1});
