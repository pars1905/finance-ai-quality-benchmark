import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculate, median} from '../valuation.mjs';

const input={price:24,fcff:1800,fcfe:1300,ebitda:2800,netIncome:1400,
  bookEquity:10000,netDebt:4000,shares:1000,growth:8,wacc:13,
  costEquity:16,terminalGrowth:3,pe:18,evEbitda:9,pb:2,
  countryGrowthShift:0,countryRiskPremium:0,countryMultipleFactor:1};

test('five methods produce per-share values across three ordered scenarios',()=>{
  const {errors,scenarios}=calculate(input);
  assert.deepEqual(errors,[]);
  assert.equal(scenarios.length,3);
  for(const s of scenarios){
    assert.equal(Object.keys(s.methods).length,5);
    assert.equal(s.applicable,5);
  }
  for(const key of Object.keys(scenarios[1].methods)){
    assert.ok(scenarios[0].methods[key].value<scenarios[1].methods[key].value,key);
    assert.ok(scenarios[1].methods[key].value<scenarios[2].methods[key].value,key);
  }
  assert.equal(scenarios[1].methods.pe.value,25.2);
  assert.equal(scenarios[1].methods.evebitda.value,21.2);
  assert.equal(scenarios[1].methods.pb.value,20);
});

test('FCFF subtracts net debt, FCFE does not',()=>{
  const low=calculate(input).scenarios[1];
  const high=calculate({...input,netDebt:5000}).scenarios[1];
  assert.equal(low.methods.fcff.value-high.methods.fcff.value,1);
  assert.equal(low.methods.evebitda.value-high.methods.evebitda.value,1);
  assert.equal(low.methods.fcfe.value,high.methods.fcfe.value);
});

test('negative earnings and invalid terminal spread are not silently valued',()=>{
  const result=calculate({...input,netIncome:-100,bookEquity:-200,terminalGrowth:14});
  const base=result.scenarios[1];
  assert.equal(base.methods.pe.value,null);
  assert.equal(base.methods.pb.value,null);
  assert.equal(base.methods.fcff.value,null);
  assert.equal(base.methods.fcfe.value,Math.max(0,base.methods.fcfe.value));
  assert.equal(base.applicable,2);
  assert.ok(base.methods.fcff.reason.includes('İskonto'));
});

test('rejects zero shares and nonfinite inputs',()=>{
  assert.ok(calculate({...input,shares:0}).errors.length);
  assert.ok(calculate({...input,wacc:NaN}).errors.length);
  assert.equal(median([]),null);
  assert.equal(median([1,2,3,4]),2.5);
});

test('transparent country overlays change all five method estimates',()=>{
  const ordinary=calculate(input).scenarios[1];
  const conflict=calculate({...input,countryGrowthShift:-4,countryRiskPremium:4,countryMultipleFactor:0.7}).scenarios[1];
  const peace=calculate({...input,countryGrowthShift:2,countryRiskPremium:-1,countryMultipleFactor:1.1}).scenarios[1];
  for(const key of Object.keys(ordinary.methods)){
    assert.ok(conflict.methods[key].value<ordinary.methods[key].value,key);
    assert.ok(peace.methods[key].value>ordinary.methods[key].value,key);
  }
  assert.equal(conflict.assumptions.growth,4);
  assert.equal(conflict.assumptions.wacc,17);
  assert.equal(conflict.assumptions.multipleFactor,0.7);
});

test('downloadable one-file input template runs all methods',()=>{
  const template=JSON.parse(readFileSync(new URL('../sample-input.json',import.meta.url),'utf8'));
  assert.equal(template.units,'millions');
  assert.equal(template.company.includes('kurgusal'),true);
  assert.equal('wacc' in template,false);
  const output=calculate({...input,...template});
  assert.deepEqual(output.errors,[]);
  assert.equal(output.scenarios[1].applicable,5);
});
