export const SCENARIOS = [
  {key:'bear',name:'Kötümser',growthShift:-3,discountShift:2,terminalShift:-0.5,multipleFactor:0.8,operatingFactor:0.9,bookFactor:0.95},
  {key:'base',name:'Baz',growthShift:0,discountShift:0,terminalShift:0,multipleFactor:1,operatingFactor:1,bookFactor:1},
  {key:'bull',name:'İyimser',growthShift:3,discountShift:-2,terminalShift:0.5,multipleFactor:1.2,operatingFactor:1.1,bookFactor:1.05}
];

export const COUNTRY_PRESETS = [
  {key:'normal',name:'Olağan koşullar',growthShift:0,riskPremium:0,multipleFactor:1},
  {key:'conflict',name:'Savaş / çatışma',growthShift:-4,riskPremium:4,multipleFactor:0.7},
  {key:'ceasefire',name:'Ateşkes',growthShift:0.5,riskPremium:-0.5,multipleFactor:1.05},
  {key:'peace',name:'Barış anlaşması',growthShift:2,riskPremium:-1,multipleFactor:1.1}
];

export const METHODS = [
  {key:'fcff',name:'FCFF DCF',type:'İçsel değer',formula:'5 yıllık firma serbest nakit akışı + terminal değer − net borç'},
  {key:'fcfe',name:'FCFE DCF',type:'İçsel değer',formula:'5 yıllık özkaynak serbest nakit akışı + terminal değer'},
  {key:'pe',name:'F/K çarpanı',type:'Göreli değer',formula:'Net kâr × benzer şirket F/K çarpanı'},
  {key:'evebitda',name:'FD/FAVÖK çarpanı',type:'Göreli değer',formula:'FAVÖK × benzer şirket FD/FAVÖK − net borç'},
  {key:'pb',name:'PD/DD çarpanı',type:'Göreli değer',formula:'Özkaynak defter değeri × benzer şirket PD/DD'}
];

export function median(values){
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!sorted.length)return null;
  const n=sorted.length,mid=Math.floor(n/2);
  return n%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
}

function dcf(initial,growth,discount,terminal){
  const g=growth/100,r=discount/100,t=terminal/100;
  if(initial<=0)return {value:null,reason:'Pozitif serbest nakit akışı gerekli.'};
  if(g<=-1||r<=0||r<=t||t<=-1)return {value:null,reason:'İskonto oranı terminal büyümeden yüksek olmalı.'};
  let pv=0,cf=initial;
  for(let year=1;year<=5;year++){
    cf*=1+g;
    pv+=cf/(1+r)**year;
  }
  const terminalValue=cf*(1+t)/(r-t);
  return {value:pv+terminalValue/(1+r)**5,reason:null,terminalShare:(terminalValue/(1+r)**5)/(pv+terminalValue/(1+r)**5)};
}

export function calculate(input){
  const numeric=['price','fcff','fcfe','ebitda','netIncome','bookEquity','netDebt','shares','growth','wacc','costEquity','terminalGrowth','pe','evEbitda','pb','countryGrowthShift','countryRiskPremium','countryMultipleFactor'];
  const errors=numeric.filter(k=>!Number.isFinite(input[k])).map(k=>`${k}: geçerli sayı girin.`);
  if(errors.length)return {errors,scenarios:[]};
  if(input.shares<=0)errors.push('Seyreltilmiş pay sayısı sıfırdan büyük olmalı.');
  if(input.price<0)errors.push('Piyasa fiyatı negatif olamaz.');
  if(input.growth+input.countryGrowthShift<=-97)errors.push('Büyüme varsayımı senaryoların tümünde -%100 üzerinde olmalı.');
  if(input.wacc+input.countryRiskPremium<=2||input.costEquity+input.countryRiskPremium<=2)errors.push('Ülke etkisi sonrası iskonto oranları iyimser senaryoda da pozitif olmalı.');
  if(input.pe<=0||input.evEbitda<=0||input.pb<=0)errors.push('Benzer şirket çarpanları sıfırdan büyük olmalı.');
  if(input.countryMultipleFactor<=0)errors.push('Ülke çarpan katsayısı sıfırdan büyük olmalı.');
  if(errors.length)return {errors,scenarios:[]};

  const scenarios=SCENARIOS.map(s=>{
    const growth=input.growth+input.countryGrowthShift+s.growthShift,
      wacc=input.wacc+input.countryRiskPremium+s.discountShift,
      equityRate=input.costEquity+input.countryRiskPremium+s.discountShift,
      terminal=input.terminalGrowth+s.terminalShift,
      combinedMultiple=s.multipleFactor*input.countryMultipleFactor;
    const enterprise=dcf(input.fcff,growth,wacc,terminal);
    const equity=dcf(input.fcfe,growth,equityRate,terminal);
    const result={};
    function value(key,raw,reason,terminalShare){
      if(reason){result[key]={value:null,reason};return}
      if(raw<0){result[key]={value:0,reason:'Net borç firma değerini aşıyor; hisse başına değer 0 tabanına çekildi.'};return}
      result[key]={value:raw/input.shares,reason:null,terminalShare};
    }
    value('fcff',enterprise.value===null?null:enterprise.value-input.netDebt,enterprise.reason,enterprise.terminalShare);
    value('fcfe',equity.value,equity.reason,equity.terminalShare);
    value('pe',input.netIncome>0?input.netIncome*s.operatingFactor*input.pe*combinedMultiple:null,
      input.netIncome>0?null:'Pozitif net kâr gerekli.');
    value('evebitda',input.ebitda>0?input.ebitda*s.operatingFactor*input.evEbitda*combinedMultiple-input.netDebt:null,
      input.ebitda>0?null:'Pozitif FAVÖK gerekli.');
    value('pb',input.bookEquity>0?input.bookEquity*s.bookFactor*input.pb*combinedMultiple:null,
      input.bookEquity>0?null:'Pozitif özkaynak defter değeri gerekli.');
    const estimates=METHODS.map(m=>result[m.key].value);
    return {key:s.key,name:s.name,assumptions:{growth,wacc,equityRate,terminal,multipleFactor:combinedMultiple,operatingFactor:s.operatingFactor,bookFactor:s.bookFactor},methods:result,median:median(estimates),applicable:estimates.filter(Number.isFinite).length};
  });
  return {errors:[],scenarios};
}
