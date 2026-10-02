const assert=require('node:assert/strict'),fs=require('node:fs');
const {matches,sortReports}=require('../assets/land-report-search.js'),data=require('../s4-startdash/reports/reports.json');
const people=Object.fromEntries(data.people.map(g=>[g.id,g]));
assert.equal(data.reports.length,15);assert.equal(data.selectable_generals.length,137);assert.equal(new Set(data.reports.map(r=>r.id)).size,15);
for(const r of data.reports){assert.equal(r.start-r.end,r.dead+r.wounded);assert(r.levels.length===r.allies.length);assert(people[r.enemy]);assert(r.allies.every(id=>people[id]));assert(fs.existsSync(r.image.split('?')[0]));assert(!r.image.includes('discord'));}
assert.equal(data.reports.filter(r=>matches(r,{level:5},people)).length,4);assert.equal(data.reports.filter(r=>matches(r,{level:6},people)).length,11);
assert.equal(data.reports.filter(r=>matches(r,{level:7},people)).length,0);assert.equal(data.reports.filter(r=>matches(r,{level:8},people)).length,0);
const all=data.reports.filter(r=>matches(r,{allies:['kakizakikageie','oichi'],match:'all'},people)),any=data.reports.filter(r=>matches(r,{allies:['kakizakikageie','oichi'],match:'any'},people));assert(any.length>all.length);
assert(all.every(r=>r.allies.includes('kakizakikageie')&&r.allies.includes('oichi')));
assert(data.reports.filter(r=>matches(r,{enemies:['mouriterumoto'],result:'引分'},people)).length===1);
assert.equal(data.reports.filter(r=>matches(r,{maxLevel:18},people)).length,4);
assert(data.reports.filter(r=>matches(r,{query:'追撃'},people)).length>0);
assert(sortReports(data.reports,'loss').every((r,i,a)=>!i||a[i-1].start-a[i-1].end<=r.start-r.end));
assert(sortReports(data.reports,'level').every((r,i,a)=>!i||Math.max(...a[i-1].levels)<=Math.max(...r.levels)));
for(const g of data.people)assert(fs.existsSync(g.portrait));
console.log('Land report data: 15 verified records, 137 selectable generals, all/any filters, enemies, result, level, sorting, data consistency, deployable images PASS');
