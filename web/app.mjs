import {calculate, COUNTRY_PRESETS, METHODS, SCENARIOS} from './valuation.mjs';

const $=id=>document.getElementById(id);
const numeric=['price','fcff','fcfe','ebitda','netIncome','bookEquity','netDebt','shares','growth','wacc','costEquity','terminalGrowth','pe','evEbitda','pb','countryGrowthShift','countryRiskPremium','countryMultipleFactor'];
const requiredFinancial=['price','fcff','fcfe','ebitda','netIncome','bookEquity','netDebt','shares'];
const sampleDefaults=Object.fromEntries([...numeric,'company','ticker','currency','asOf','countryState'].map(key=>[key,$(key).value]));
let selected='base',last=null,uploadedSource='';
const money=(n,c)=>n===null||!Number.isFinite(n)?'—':new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)+' '+c;
const decimal=n=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2}).format(n);
function element(tag,cls,content){const n=document.createElement(tag);if(cls)n.className=cls;if(content!==undefined)n.textContent=content;return n}
function readInput(){
  const input={company:$('company').value.trim()||'İsimsiz şirket',ticker:$('ticker').value.trim().toUpperCase()||'—',currency:$('currency').value,asOf:$('asOf').value,countryState:$('countryState').value,dataMode:$('dataMode').value,source:uploadedSource};
  for(const key of numeric){const v=$(key).value.trim();input[key]=v===''?NaN:Number(v)}
  return input;
}
function showErrors(errors){const box=$('errors');box.hidden=!errors.length;box.replaceChildren();if(errors.length){box.append(element('strong','','Lütfen girdileri düzeltin:'));const list=element('ul');errors.forEach(t=>list.append(element('li','',t)));box.append(list)}}
function render(reveal=false){
  const input=readInput(),output=calculate(input);
  const errors=[...output.errors];
  if(input.dataMode==='own'&&(!$('company').value.trim()||!$('ticker').value.trim()||!input.asOf))errors.unshift('Şirket adı, borsa kodu ve veri tarihi gerekli.');
  showErrors(errors);if(errors.length){$('results').hidden=true;last=null;if(reveal)$('advanced').open=true;return}
  $('results').hidden=false;
  last={input,...output};
  $('resultCompany').textContent=input.company;
  $('resultMeta').textContent=input.ticker+' · '+(input.asOf||'Tarih belirtilmedi')+' · '+(input.dataMode==='sample'?'Kurgusal örnek':'Kullanıcı verisi')+' · Ülke koşulu: '+(COUNTRY_PRESETS.find(x=>x.key===input.countryState)?.name||'Özel');
  $('resultPrice').textContent=money(input.price,input.currency);
  const cards=$('scenarioCards');cards.replaceChildren();
  for(const s of output.scenarios){
    const button=element('button','scenario-card'+(selected===s.key?' active':''));button.type='button';button.setAttribute('aria-pressed',selected===s.key?'true':'false');
    button.append(element('span','',s.name),element('b','',money(s.median,input.currency)),element('small','',s.applicable+'/5 yöntem kullanılabilir'));
    if(s.median!==null&&input.price>0){const pct=(s.median/input.price-1)*100;button.append(element('i',pct<0?'negative':'','Piyasa fiyatına göre '+(pct>=0?'+':'')+decimal(pct)+'% fark'))}
    button.addEventListener('click',()=>{selected=s.key;render()});cards.append(button)
  }
  const rows=$('valuationRows');rows.replaceChildren();
  for(const m of METHODS){
    const tr=element('tr'),label=element('td'),name=element('span','method-name',m.name);
    label.append(name,element('span','method-type',m.type));tr.append(label);
    for(const s of output.scenarios){const item=s.methods[m.key],td=element('td',item.value===null?'na':'',money(item.value,input.currency));td.title=item.reason||m.formula;tr.append(td)}
    rows.append(tr);
  }
  const med=element('tr','median-row');med.append(element('td','','Yöntem medyanı (gösterim amaçlı)'));
  for(const s of output.scenarios)med.append(element('td','',money(s.median,input.currency)));rows.append(med);
  const focus=output.scenarios.find(x=>x.key===selected);
  $('detailTitle').textContent=focus.name+' senaryo · kullanılan varsayımlar';
  const metrics=$('detailMetrics');metrics.replaceChildren();
  const pairs=[['Nakit akışı büyümesi',decimal(focus.assumptions.growth)+'%'],['FCFF iskonto (WACC)',decimal(focus.assumptions.wacc)+'%'],['FCFE iskonto',decimal(focus.assumptions.equityRate)+'%'],['Terminal büyüme',decimal(focus.assumptions.terminal)+'%'],['Çarpan etkisi','×'+decimal(focus.assumptions.multipleFactor)],['Kâr / FAVÖK etkisi','×'+decimal(focus.assumptions.operatingFactor)]];
  for(const [label,value] of pairs){const box=element('div','metric');box.append(element('small','',label),element('strong','',value));metrics.append(box)}
  $('detailText').textContent='Ülke etkisi: büyümeye '+decimal(input.countryGrowthShift)+' puan, iskonto oranlarına '+decimal(input.countryRiskPremium)+' puan, çarpanlara ×'+decimal(input.countryMultipleFactor)+'. Senaryo farkı ayrıca eklenir. Defter değeri kötümserde ×0,95, bazda ×1, iyimserde ×1,05 alınır.';
  const formulas=$('formulaList');formulas.replaceChildren();
  for(const m of METHODS){const li=element('li');li.append(element('b','',m.name+' — '),document.createTextNode(m.formula));formulas.append(li)}
  const warnings=$('methodWarnings');warnings.replaceChildren();
  for(const m of METHODS){const item=focus.methods[m.key];if(item.reason)warnings.append(element('div','warning',m.name+': '+item.reason));if(item.terminalShare>0.75)warnings.append(element('div','warning',m.name+': değerin '+decimal(item.terminalShare*100)+'% kadarı terminal değere dayanıyor; büyüme ve iskonto varsayımlarını ayrıca sınayın.'))}
}
function modeChanged(){
  const own=$('dataMode').value==='own';$('uploadBox').hidden=!own;
  $('company').readOnly=!own;$('ticker').readOnly=!own;
  if(own){
    $('company').value='';$('ticker').value='';$('price').value='';$('asOf').value='';$('dataFile').value='';
    for(const key of ['fcff','fcfe','ebitda','netIncome','bookEquity','netDebt','shares'])$(key).value='';
    uploadedSource='';$('dataStatus').textContent='Finansal özet dosyanızı yükleyin veya ayrıntılı alanları açıp verileri girin.';
    $('results').hidden=true;showErrors([]);last=null;
  }else{
    for(const [key,value] of Object.entries(sampleDefaults))$(key).value=value;
    $('advanced').open=false;uploadedSource='';$('dataStatus').textContent='Kurgusal örnek verilerle hesaplanıyor.';render()
  }
}
$('dataMode').addEventListener('change',modeChanged);
$('dataFile').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>1000000)throw Error('Dosya 1 MB sınırını aşıyor.');
    const data=JSON.parse(await file.text());
    if(!data||Array.isArray(data)||typeof data!=='object')throw Error('Dosyada tek bir JSON nesnesi olmalı.');
    if(data.units!=='millions')throw Error('Dosyada units alanı millions olmalı; tutarlar ve pay sayısı milyon cinsinden girilmeli.');
    if(!['TRY','USD','EUR'].includes(data.currency))throw Error('Para birimi TRY, USD veya EUR olmalı.');
    $('company').value=String(data.company||'');$('ticker').value=String(data.ticker||'');$('currency').value=data.currency;$('asOf').value=String(data.asOf||'');
    const country=COUNTRY_PRESETS.find(p=>p.key===data.countryState)||COUNTRY_PRESETS[0];
    $('countryState').value=country.key;
    const countryDefaults={countryGrowthShift:country.growthShift,countryRiskPremium:country.riskPremium,countryMultipleFactor:country.multipleFactor};
    for(const key of numeric)$(key).value=data[key]??(requiredFinancial.includes(key)?'':countryDefaults[key]??sampleDefaults[key]);
    uploadedSource=String(data.source||file.name);$('dataStatus').textContent='Yüklendi: '+file.name+' · Dosyada olmayan büyüme, iskonto ve çarpan varsayımları örnek değerlerle dolduruldu. Bunları kontrol edin.';
    render(true);
  }catch(err){uploadedSource='';$('results').hidden=true;last=null;showErrors([err.message]);$('advanced').open=true}
});
$('countryState').addEventListener('change',()=>{
  const p=COUNTRY_PRESETS.find(x=>x.key===$('countryState').value);
  $('countryGrowthShift').value=p.growthShift;$('countryRiskPremium').value=p.riskPremium;$('countryMultipleFactor').value=p.multipleFactor;
  render();
});
$('form').addEventListener('submit',event=>{event.preventDefault();render(true)});
$('reset').addEventListener('click',()=>{$('form').reset();selected='base';$('advanced').open=false;modeChanged()});
$('price').addEventListener('change',()=>{if($('dataMode').value==='sample'||last)render()});
$('print').addEventListener('click',()=>window.print());
$('download').addEventListener('click',()=>{
  if(!last)return;
  const payload={tool:'Finance AI Quality Benchmark demo',note:'Manuel verili varsayım aracı; yatırım tavsiyesi değildir.',...last};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='valuation-'+(last.input.ticker||'sample').replace(/[^a-zA-Z0-9_-]/g,'')+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
render();
