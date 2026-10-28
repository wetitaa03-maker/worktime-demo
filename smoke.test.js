const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(new URL('./script.js', `file://${process.cwd()}/`), 'utf8');

class Element {
  constructor(id='') { this.id=id; this.value=''; this.textContent=''; this.innerHTML=''; this.children=[]; this.listeners={}; this.disabled=false; this.hidden=false; this.open=false; this.dataset={}; this.classList={add(){},remove(){},toggle(){},contains(){return false;}}; this.options=[]; }
  addEventListener(type,fn,opts={}) { (this.listeners[type] ||= []).push({fn,once:opts.once}); }
  removeEventListener(type,fn) { this.listeners[type]=(this.listeners[type]||[]).filter(x=>x.fn!==fn); }
  dispatch(type,event={}) { event.preventDefault ||= ()=>{}; event.target ||= this; for(const x of [...(this.listeners[type]||[])]) { x.fn(event); if(x.once)this.removeEventListener(type,x.fn); } }
  replaceChildren(...items) { this.children=[...items]; this.options=[...items]; }
  append(...items) { this.children.push(...items); this.options.push(...items); }
  add(item) { this.append(item); }
  showModal(){this.open=true;}
  close(){this.open=false;this.dispatch('close');}
  remove(){this.removed=true;}
  reset(){for(const e of Object.values(elements))e.value='';}
  closest(selector){return this.matches?.[selector]||null;}
  click(){this.dispatch('click');}
}
const ids=`toast clockDate clockTime todayLabel attendanceClock attendanceDate statEmployees statPresent statAbsent statWorking statDone recentBody recentEmpty quickEmployee quickEmployeeInfo quickIn quickOut attendanceEmployee attendancePreview todayIn todayOut todayStatus attendanceIn attendanceOut employeesBody employeesEmpty employeeCount employeeSearch employeeDepartmentFilter employeeStatusFilter historySearch filterDate filterEndDate filterDepartment filterEmployee historyBody historyEmpty reportDate reportDepartment reportDateLabel reportPresent reportAbsent reportHours reportBody reportEmpty employeeDialog employeeForm employeeDialogTitle editEmployeeId empCode empName empDepartment empPosition empWorkStart empWorkEnd empStatus closeEmployeeDialog cancelEmployee confirmDialog confirmTitle confirmMessage confirmOk confirmCancel addEmployeeBtn clearFilters clearEmployeeFilters historyExport reportExport settingsForm workStart workEnd lateGrace resetSettings clearDemoBtn menuToggle pageCrumb topTitle sidebar brand`.split(' ');
const elements=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
const pageNames=['dashboard','attendance','employees','history','reports','settings'];
const pages=pageNames.map(n=>{const e=new Element('page-'+n);e.id='page-'+n;return e;});
const navs=pageNames.map(n=>{const e=new Element('nav-'+n);e.dataset.page=n;return e;});
const mockDoc={querySelector(s){return elements[s.slice(1)]||null;},querySelectorAll(s){return s==='.page'?pages:s==='.nav-link'?navs:s==='[data-go]'?[]:[];},createElement(tag){return new Element(tag);},body:new Element('body')};
class FakeOption {constructor(text,value){this.text=text;this.value=value;}}
const data=new Map();
let exportedBlob;
const ctx={document:mockDoc,Option:FakeOption,Intl,Date,Math,JSON,Number,String,Set,Array,Blob,URL:{createObjectURL(blob){exportedBlob=blob;return 'blob:test';},revokeObjectURL(){}},crypto:{randomUUID:()=>`id-${Math.random()}`},setTimeout,clearTimeout,setInterval(){},localStorage:{getItem(k){return data.has(k)?data.get(k):null;},setItem(k,v){data.set(k,v);}},console};
ctx.window=ctx; vm.runInNewContext(source,ctx,{filename:'script.js'});
const getEmployees=()=>JSON.parse(data.get('worktime_employees_v1'));
const getRecords=()=>JSON.parse(data.get('worktime_attendance_v1'));
assert.equal(getEmployees().length,5,'first run seeds employees');
assert.equal(getRecords().length,2,'first run seeds history once');
elements.quickEmployee.value='seed-3'; elements.quickEmployee.dispatch('change'); elements.quickOut.click(); assert.equal(getRecords().length,2,'checkout before check-in rejected');
elements.quickEmployee.value='seed-1'; elements.quickEmployee.dispatch('change');
elements.quickIn.click(); assert.equal(getRecords().length,3,'check-in saved');
elements.quickIn.click(); assert.equal(getRecords().length,3,'duplicate check-in blocked');
elements.quickOut.click(); assert.ok(getRecords()[2].checkOut,'check-out saved');
elements.quickOut.click(); assert.equal(getRecords().length,3,'duplicate check-out blocked');
elements.quickIn.click(); assert.equal(getRecords().length,3,'same-day second shift prevented');
assert.equal(elements.statDone.textContent,1,'dashboard counts completed employee');
elements.addEmployeeBtn.click();
elements.empCode.value='TEST100'; elements.empName.value='ผู้ทดสอบ ระบบ'; elements.empDepartment.value='ทดสอบ'; elements.empPosition.value='ผู้ทดสอบ'; elements.empWorkEnd.value='15:30'; elements.empStatus.value='active';
elements.employeeForm.dispatch('submit');
assert.equal(getEmployees().length,6,'employee create persisted');
assert.equal(getEmployees().find(e=>e.code==='TEST100').workEnd,'15:30','per-employee end time saved');
assert.equal(getEmployees().find(e=>e.code==='TEST100').workStart,'','optional unknown start accepted');
assert.ok(elements.employeesBody.children.some(r=>r.innerHTML.includes('ผู้ทดสอบ ระบบ')),'employee appears in table');
elements.quickEmployee.value=getEmployees().find(e=>e.code==='TEST100').id;elements.quickEmployee.dispatch('change');elements.quickIn.click();
assert.equal(getRecords().at(-1).workStart,'','unknown start snapshot retained');
assert.ok(elements.recentBody.children.some(r=>r.innerHTML.includes('ผู้ทดสอบ ระบบ')&&r.innerHTML.includes('เข้างานแล้ว')&&!r.innerHTML.includes('มาสาย')),'attendance status is entered without a late category');
elements.addEmployeeBtn.click(); elements.empCode.value='TEST100'; elements.empName.value='ซ้ำ'; elements.empDepartment.value='ทดสอบ'; elements.empPosition.value='ผู้ทดสอบ'; elements.employeeForm.dispatch('submit');
assert.match(elements.toast.textContent,/มีอยู่ในระบบแล้ว/,'duplicate employee code rejected');
let editButton=new Element(); editButton.matches={'[data-edit]':{dataset:{edit:getEmployees().find(e=>e.code==='TEST100').id}}}; elements.employeesBody.dispatch('click',{target:editButton});
elements.empName.value='ผู้ทดสอบ แก้ไข'; elements.employeeForm.dispatch('submit'); assert.equal(getEmployees().find(e=>e.code==='TEST100').name,'ผู้ทดสอบ แก้ไข','employee update persisted');
elements.employeeSearch.value='ไม่มีผลลัพธ์'; elements.employeeSearch.dispatch('input'); assert.equal(elements.employeesBody.children.length,0,'employee search empty state');
elements.employeeSearch.value=''; elements.employeeSearch.dispatch('input');
elements.employeeDepartmentFilter.value='การตลาด'; elements.employeeDepartmentFilter.dispatch('change'); assert.equal(elements.employeesBody.children.length,1,'employee department filter applied');
elements.employeeDepartmentFilter.value=''; elements.employeeStatusFilter.value='inactive'; elements.employeeStatusFilter.dispatch('change'); assert.equal(elements.employeesBody.children.length,0,'employee status filter applied');
elements.employeeStatusFilter.value=''; elements.clearEmployeeFilters.click(); assert.equal(elements.employeesBody.children.length,6,'employee filters clear');
elements.filterDate.value='2999-01-01'; elements.filterDate.dispatch('change'); assert.equal(elements.historyBody.children.length,0,'history date filter applied');
elements.filterDate.value=''; elements.filterDate.dispatch('change'); assert.ok(elements.historyBody.children.length>0,'clear date restores rows');
const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);const yesterdayIso=`${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
elements.filterDate.value=yesterdayIso;elements.filterEndDate.value=yesterdayIso;elements.filterDepartment.value='ทรัพยากรบุคคล';elements.filterDepartment.dispatch('change');assert.equal(elements.historyBody.children.length,1,'combined date range and department filters applied');
elements.clearFilters.click();assert.equal(elements.historyBody.children.length,4,'history filters clear');
elements.historyExport.click(); Promise.all([exportedBlob.text(),exportedBlob.arrayBuffer()]).then(([csv,buf])=>{assert.deepEqual([...new Uint8Array(buf).slice(0,3)],[0xef,0xbb,0xbf],'CSV has Excel UTF-8 BOM');assert.ok(csv.includes('"วันที่"'),'CSV header exists');assert.ok(csv.includes('EMP001'),'CSV includes saved attendance data');console.log('PASS: CSV export content and Excel encoding');});
elements.reportDate.value=new Date().toISOString().slice(0,10); elements.reportDate.dispatch('change'); assert.equal(Number(elements.reportPresent.textContent),2,'report counts employees present today');
const testEmp=getEmployees().find(e=>e.code==='EMP001');
const deleteClick=()=>{const btn=new Element();btn.matches={'[data-delete]':{dataset:{delete:testEmp.id}}};elements.employeesBody.dispatch('click',{target:btn});};
deleteClick(); assert.equal(elements.confirmDialog.open,true,'delete requires confirmation'); elements.confirmCancel.click(); assert.ok(getEmployees().some(e=>e.id===testEmp.id),'cancel deletion leaves employee intact');
deleteClick(); elements.confirmOk.click(); assert.ok(!getEmployees().some(e=>e.id===testEmp.id),'confirm deletion removes employee'); assert.ok(getRecords().some(r=>r.id==='sample-att-1'),'employee deletion retains attendance history');
elements.workStart.value='08:30'; elements.workEnd.value='17:30'; elements.lateGrace.value='10'; elements.settingsForm.dispatch('submit');
assert.equal(JSON.parse(data.get('worktime_settings_v1')).workStart,'08:30','settings saved');
for(const el of Object.values(elements))el.listeners={}; vm.runInNewContext(source,ctx,{filename:'script-refresh.js'});
assert.ok(getEmployees().some(e=>e.code==='TEST100'&&e.name==='ผู้ทดสอบ แก้ไข'),'employees persist across reload');
assert.ok(getRecords().some(r=>r.id==='sample-att-1'),'attendance persists across reload');
assert.equal(elements.workStart.value,'08:30','settings persist across reload');
const html=fs.readFileSync(new URL('./index.html', `file://${process.cwd()}/`),'utf8');
const jsIds=[...source.matchAll(/\$\('#([\w-]+)'\)/g)].map(m=>m[1]);
assert.deepEqual([...new Set(jsIds)].filter(id=>!html.includes(`id="${id}"`)),[],'all bound HTML IDs exist');
const damaged=new Map([['worktime_employees_v1','{bad'],['worktime_attendance_v1','not-json'],['worktime_settings_v1','null']]);
const damagedCtx={...ctx,localStorage:{getItem(k){return damaged.has(k)?damaged.get(k):null;},setItem(k,v){damaged.set(k,v);}}};
for(const el of Object.values(elements))el.listeners={};vm.runInNewContext(source,damagedCtx,{filename:'script-corrupt-storage.js'});
assert.equal(JSON.parse(damaged.get('worktime_employees_v1')).length,5,'malformed storage recovers without crashing');
console.log('PASS: first-run data, attendance validation, employee create/update/delete-confirm/cancel, duplicate rejection, search, date filters, report, settings and simulated reload persistence');
