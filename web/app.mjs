import {calculate, COUNTRY_PRESETS, METHODS, SCENARIOS} from './valuation.mjs';

const $=id=>document.getElementById(id);
const numeric=['price','fcff','fcfe','ebitda','netIncome','bookEquity','netDebt','shares','growth','wacc','costEquity','terminalGrowth','pe','evEbitda','pb','countryGrowthShift','countryRiskPremium','countryMultipleFactor'];
let selected='base',last=null;
const money=(n,c)=>n===null||!Number.isFinite(n)?'—':new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)+' '+c;
const decimal=n=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2}).format(n);
function element(tag,cls,content){const n=document.createElement(tag);if(cls)n.className=cls;if(content!==undefined)n.textContent=content;return n}
function readInput(){
  const input={company:$('company').value.trim()||'İsimsiz şirket',ticker:$('ticker').value.trim().toUpperCase()||'—',currency:$('currency').value,asOf:$('asOf').value,countryState:$('countryState').value};
  for(const key of numeric){const v=$(key).value.trim();input[key]=v===''?NaN:Number(v)}
  return input;
}
function showErrors(errors){const box=$('errors');box.hidden=!errors.length;box.replaceChildren();if(errors.length){box.append(element('strong','','Lütfen girdileri düzeltin:'));const list=element('ul');errors.forEach(t=>list.append(element('li','',t)));box.append(list)}}
function render(){
  const input=readInput(),output=calculate(input);showErrors(output.errors);if(output.errors.length)return;
  last={input,...output};
  $('resultCompany').textContent=input.company;
  $('resultMeta').textContent=input.ticker+' · '+(input.asOf||'Tarih belirtilmedi')+' · Ülke koşulu: '+(COUNTRY_PRESETS.find(x=>x.key===input.countryState)?.name||'Özel');
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
$('countryState').addEventListener('change',()=>{
  const p=COUNTRY_PRESETS.find(x=>x.key===$('countryState').value);
  $('countryGrowthShift').value=p.growthShift;$('countryRiskPremium').value=p.riskPremium;$('countryMultipleFactor').value=p.multipleFactor;
  render();
});
$('form').addEventListener('submit',event=>{event.preventDefault();render()});
$('reset').addEventListener('click',()=>{$('form').reset();selected='base';render()});
$('print').addEventListener('click',()=>window.print());
$('download').addEventListener('click',()=>{
  if(!last)return;
  const payload={tool:'Finance AI Quality Benchmark demo',note:'Manuel verili varsayım aracı; yatırım tavsiyesi değildir.',...last};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='valuation-'+(last.input.ticker||'sample').replace(/[^a-zA-Z0-9_-]/g,'')+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
render();
