/* ===========================================================
   KT ACADEMY · SỔ QUẢN LÝ TÀI CHÍNH CÁ NHÂN — app.js
   Phong cách Money Lover. Lưu localStorage, chạy offline.
   =========================================================== */

const STORE_KEY = 'so-tai-chinh-v1';

const EXPENSE_CATS = [
  {name:'Ăn uống',icon:'🍜'},{name:'Đi chợ / Siêu thị',icon:'🛒'},
  {name:'Di chuyển / Xăng xe',icon:'⛽'},{name:'Mua sắm / Quần áo',icon:'🛍️'},
  {name:'Giải trí / Du lịch',icon:'🎬'},{name:'Sức khỏe / Làm đẹp',icon:'💊'},
  {name:'Hóa đơn & Tiện ích',icon:'🧾'},{name:'Nhà ở / Thuê nhà',icon:'🏠'},
  {name:'Trả góp / Trả nợ',icon:'💳'},{name:'Con cái / Học phí',icon:'🎓'},
  {name:'Giáo dục / Sách vở',icon:'📚'},{name:'Quà tặng / Hiếu hỉ',icon:'🎁'},
  {name:'Gia đình / Đồ dùng',icon:'🧺'},{name:'Bảo hiểm',icon:'🛡️'},
  {name:'Đầu tư / Tiết kiệm',icon:'📈'},{name:'Khác',icon:'📦'}
];
const INCOME_CATS = [
  {name:'Lương',icon:'💼'},{name:'Thưởng / Hoa hồng',icon:'🏆'},
  {name:'Thu nhập phụ / Freelance',icon:'💻'},{name:'Kinh doanh',icon:'🏪'},
  {name:'Lãi đầu tư / Tiết kiệm',icon:'📈'},{name:'Được tặng / Biếu',icon:'🎁'},
  {name:'Khác',icon:'💰'}
];
const KIND_LABEL = {'cp-bien-doi':'CP biến đổi','cp-co-dinh':'CP cố định','tai-san':'Tài sản','tieu-san':'Tiêu sản/Nợ'};
const REFLECT_Q = [
  'Khoản chi khiến bạn HỐI TIẾC nhất? Tại sao? Lần sau bạn sẽ xử lý thế nào?',
  'Khoản chi/đầu tư bạn thấy XỨNG ĐÁNG nhất? Tại sao?',
  'Điều gì đã ngăn cản bạn tiết kiệm được nhiều hơn?',
  'Tài sản ròng tháng này tăng hay giảm so với tháng trước? Lý do?',
  'Một thói quen tài chính TỐT bạn đã xây dựng được tháng này?',
  'Một thói quen tài chính XẤU cần loại bỏ?'
];
const COMMITMENTS = [
  'Ghi chép tài chính mỗi ngày (dù chỉ 5 phút)',
  'Không mua hàng "bốc đồng" không cần thiết',
  'Tiết kiệm ít nhất 20% thu nhập mỗi tháng',
  'Xem lại sổ vào cuối mỗi tuần'
];

/* ---------- STATE ---------- */
let state = load();
let curMonth = todayMonth();
let recordDay = todayISO();
let recordMode = 'expense';
let charts = {};

function blank(){ return { transactions:[], wallets:[], budgets:{}, recurring:[], balances:{}, goals:{}, reflections:{}, commits:{}, settings:{}, _updatedAt:0 }; }
function load(){
  let d;
  try{ d = JSON.parse(localStorage.getItem(STORE_KEY)); }catch(e){ d=null; }
  d = Object.assign(blank(), d||{});
  // --- migration: đảm bảo có ít nhất 1 ví, gán ví cho giao dịch cũ ---
  if(!d.wallets.length){ d.wallets=[{id:'w_cash',name:'Tiền mặt',icon:'💵',initial:0}]; }
  const defaultW = d.wallets[0].id;
  d.transactions.forEach(t=>{ if(!t.walletId) t.walletId=defaultW; });
  return d;
}
function save(){ state._updatedAt=Date.now(); localStorage.setItem(STORE_KEY, JSON.stringify(state)); if(typeof cloudPushDebounced==='function') cloudPushDebounced(); }

/* ---------- DATE HELPERS ---------- */
function todayISO(){ return new Date().toISOString().slice(0,10); }
function todayMonth(){ return todayISO().slice(0,7); }
function monthOf(iso){ return iso.slice(0,7); }
function prevMonthKey(m){ const [y,mo]=m.split('-').map(Number); return new Date(y,mo-2,1).toISOString().slice(0,7); }
function weekOfMonth(iso){ return Math.min(4, Math.ceil(Number(iso.slice(8,10))/7)); }
function fmtDateVN(iso){ const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; }

/* ---------- MONEY HELPERS ---------- */
function parseMoney(str){
  if(typeof str==='number') return str;
  if(!str) return 0;
  let s=String(str).toLowerCase().trim().replace(/\s/g,'').replace(/đ/g,'');
  let mult=1;
  if(/tr|triệu|trieu|m$/.test(s)){ mult=1e6; s=s.replace(/tr|triệu|trieu|m/g,''); }
  else if(/ty|tỷ|b$/.test(s)){ mult=1e9; s=s.replace(/ty|tỷ|b/g,''); }
  else if(/k|ng|nghìn|nghin/.test(s)){ mult=1e3; s=s.replace(/k|ng|nghìn|nghin/g,''); }
  // Chuẩn VN: '.' là phân cách hàng nghìn, ',' là dấu thập phân
  s=s.replace(/\./g,'').replace(/,/g,'.');
  const n=parseFloat(s.replace(/[^0-9.]/g,''));
  return isNaN(n)?0:Math.round(n*mult);
}
function formatThousands(d){ return d?String(d).replace(/\B(?=(\d{3})+(?!\d))/g,'.'):''; }
function attachMoneyInputs(){
  document.querySelectorAll('input[inputmode="numeric"]').forEach(el=>{
    if(el.dataset.moneyFmt) return; el.dataset.moneyFmt='1';
    el.addEventListener('input',()=>{
      if(/[a-z]/i.test(el.value)) return;            // đang gõ tắt (tr/k/ng...) → không tách nghìn
      const digits=el.value.replace(/[^\d]/g,'');
      const f=formatThousands(digits);
      if(f!==el.value) el.value=f;                   // tự chèn dấu . phân cách nghìn
    });
  });
}
function fmt(n){ return (Math.round(n||0)).toLocaleString('vi-VN')+' đ'; }
function fmtShort(n){
  n=Math.round(n||0); const a=Math.abs(n);
  if(a>=1e9) return (n/1e9).toFixed(1).replace('.0','')+' tỷ';
  if(a>=1e6) return (n/1e6).toFixed(1).replace('.0','')+' tr';
  if(a>=1e3) return Math.round(n/1e3)+'k';
  return n+'';
}
function catIcon(name){
  const c=EXPENSE_CATS.concat(INCOME_CATS).find(x=>x.name===name);
  return c?c.icon:'📦';
}

/* ===========================================================
   AGGREGATION
   =========================================================== */
function monthTx(m){ return state.transactions.filter(t=>monthOf(t.date)===m); }
function dayTx(iso){ return state.transactions.filter(t=>t.date===iso); }
function monthTotals(m){
  let income=0,expense=0;
  monthTx(m).forEach(t=>{ if(t.type==='income')income+=t.amount; else if(t.type==='expense')expense+=t.amount; });
  const saving=income-expense;
  return { income,expense,saving, rate: income?saving/income*100:0 };
}
function walletBalance(id){
  const w=state.wallets.find(x=>x.id===id); if(!w) return 0;
  let bal=w.initial||0;
  state.transactions.forEach(t=>{
    if(t.type==='income'&&t.walletId===id) bal+=t.amount;
    else if(t.type==='expense'&&t.walletId===id) bal-=t.amount;
    else if(t.type==='transfer'){ if(t.walletId===id) bal-=t.amount; if(t.toWalletId===id) bal+=t.amount; }
  });
  return bal;
}
function walletName(id){ const w=state.wallets.find(x=>x.id===id); return w?w.name:'(đã xóa)'; }
function walletIcon(id){ const w=state.wallets.find(x=>x.id===id); return w?w.icon:'👛'; }
function totalWallets(){ return state.wallets.reduce((s,w)=>s+walletBalance(w.id),0); }
function balanceOf(m){ return state.balances[m]||{assets:[],liabilities:[]}; }
function netWorthOf(m){
  const b=balanceOf(m);
  const a=b.assets.reduce((s,x)=>s+x.value,0), l=b.liabilities.reduce((s,x)=>s+x.value,0);
  return {assets:a,liab:l,net:a-l};
}
function catTotals(m){
  const map={};
  monthTx(m).filter(t=>t.type==='expense').forEach(t=>map[t.category]=(map[t.category]||0)+t.amount);
  return Object.entries(map).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
}
function catSpent(m,name){
  return monthTx(m).filter(t=>t.type==='expense'&&t.category===name).reduce((s,t)=>s+t.amount,0);
}

/* ===========================================================
   POPULATE SELECTS
   =========================================================== */
function fillCatSelects(){
  document.querySelectorAll('.cat-select').forEach(sel=>{
    const cur=sel.value;
    sel.innerHTML=EXPENSE_CATS.map(c=>`<option value="${c.name}">${c.icon} ${c.name}</option>`).join('');
    if(cur) sel.value=cur;
  });
  document.querySelectorAll('.cat-select-income').forEach(sel=>{
    sel.innerHTML=INCOME_CATS.map(c=>`<option value="${c.name}">${c.icon} ${c.name}</option>`).join('');
  });
}
function fillWalletSelects(){
  const opts=state.wallets.map(w=>`<option value="${w.id}">${w.icon} ${esc(w.name)}</option>`).join('');
  document.querySelectorAll('.wallet-select').forEach(sel=>{ const cur=sel.value; sel.innerHTML=opts; if(cur&&state.wallets.find(w=>w.id===cur))sel.value=cur; });
  const wf=document.getElementById('txFilterWallet');
  if(wf){ const cur=wf.value; wf.innerHTML='<option value="">Tất cả ví</option>'+opts; wf.value=cur; }
}

/* ===========================================================
   NAVIGATION
   =========================================================== */
document.querySelectorAll('.nav-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-'+btn.dataset.view).classList.add('active');
    document.getElementById('sidebar').classList.remove('open');
    renderAll();
  });
});
document.getElementById('menuToggle').addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));

const monthPicker=document.getElementById('monthPicker');
monthPicker.value=curMonth;
monthPicker.addEventListener('change',()=>{ curMonth=monthPicker.value; renderAll(); });

const recordDateEl=document.getElementById('recordDate');
recordDateEl.value=recordDay;
recordDateEl.addEventListener('change',()=>{ recordDay=recordDateEl.value; renderRecord(); });

/* segmented control */
document.querySelectorAll('#recordSeg .seg-btn').forEach(b=>{
  b.addEventListener('click',()=>{
    recordMode=b.dataset.mode;
    document.querySelectorAll('#recordSeg .seg-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    ['expense','income','transfer'].forEach(m=>document.getElementById('form-'+m).hidden=(m!==recordMode));
  });
});

/* ---------- TOAST ---------- */
let toastTimer;
function toast(msg,err){
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='toast show'+(err?' err':'');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.className='toast',2400);
}

/* ===========================================================
   RECORD: FORMS
   =========================================================== */
const incAmountInput=document.querySelector('#incomeForm input[name=amount]');
incAmountInput.addEventListener('input',()=>{
  const v=parseMoney(incAmountInput.value), box=document.getElementById('incomeSplitPreview');
  if(!v){ box.innerHTML=''; return; }
  box.innerHTML='Chia 6 lọ: '+getJars().map(j=>`${j.icon} <b>${fmtShort(v*(j.pct||0)/100)}</b>`).join(' · ');
});

document.getElementById('expenseForm').addEventListener('submit',e=>{
  e.preventDefault(); const f=e.target, amt=parseMoney(f.amount.value);
  if(amt<=0){ toast('Số tiền không hợp lệ',true); return; }
  state.transactions.push({id:uid(),date:recordDay,type:'expense',content:f.content.value.trim(),
    amount:amt,category:f.category.value,kind:f.kind.value,walletId:f.wallet.value,note:f.note.value.trim()});
  save(); f.reset(); fillCatSelects(); fillWalletSelects();
  toast('Đã ghi khoản chi '+fmt(amt)); renderRecord(); refreshActive();
});
document.getElementById('incomeForm').addEventListener('submit',e=>{
  e.preventDefault(); const f=e.target, amt=parseMoney(f.amount.value);
  if(amt<=0){ toast('Số tiền không hợp lệ',true); return; }
  state.transactions.push({id:uid(),date:recordDay,type:'income',source:f.source.value.trim(),
    amount:amt,category:f.category.value,walletId:f.wallet.value});
  save(); f.reset(); document.getElementById('incomeSplitPreview').innerHTML=''; fillCatSelects(); fillWalletSelects();
  toast('Đã ghi khoản thu '+fmt(amt)); renderRecord(); refreshActive();
});
document.getElementById('transferForm').addEventListener('submit',e=>{
  e.preventDefault(); const f=e.target, amt=parseMoney(f.amount.value);
  if(amt<=0){ toast('Số tiền không hợp lệ',true); return; }
  if(f.from.value===f.to.value){ toast('Hai ví phải khác nhau',true); return; }
  state.transactions.push({id:uid(),date:recordDay,type:'transfer',amount:amt,
    walletId:f.from.value,toWalletId:f.to.value,note:f.note.value.trim()});
  save(); f.reset(); fillWalletSelects();
  toast('Đã chuyển '+fmt(amt)); renderRecord(); refreshActive();
});

function renderRecord(){
  recordDateEl.value=recordDay;
  document.getElementById('recordDateLabel').textContent=fmtDateVN(recordDay);
  const tx=dayTx(recordDay); let din=0,dout=0;
  tx.forEach(t=>{ if(t.type==='income')din+=t.amount; else if(t.type==='expense')dout+=t.amount; });
  document.getElementById('daySummary').innerHTML=`
    <div class="ds-item ds-in"><span>Tổng thu hôm nay</span><strong>${fmt(din)}</strong></div>
    <div class="ds-item ds-out"><span>Tổng chi hôm nay</span><strong>${fmt(dout)}</strong></div>
    <div class="ds-item"><span>Chênh lệch</span><strong style="color:${din-dout>=0?'var(--green)':'var(--red)'}">${fmt(din-dout)}</strong></div>`;
  fillTxTable(document.querySelector('#dayTxTable tbody'), tx, false);
}

function txRow(t,withDate){
  const dcell=withDate?`<td>${fmtDateVN(t.date)}</td>`:'';
  const del=`<td class="right"><button class="del-btn" data-del="${t.id}">✕</button></td>`;
  if(t.type==='income') return `<tr>${dcell}<td><span class="tag tag-in">THU</span></td>
    <td>${esc(t.source)}</td><td class="muted">${catIcon(t.category)} ${esc(t.category||'')} · ${walletIcon(t.walletId)} ${esc(walletName(t.walletId))}</td>
    <td class="right amt-in">+${fmt(t.amount)}</td>${del}</tr>`;
  if(t.type==='transfer') return `<tr>${dcell}<td><span class="tag tag-tf">CHUYỂN</span></td>
    <td>${esc(t.note||'Chuyển tiền')}</td><td class="muted">${walletIcon(t.walletId)} ${esc(walletName(t.walletId))} → ${walletIcon(t.toWalletId)} ${esc(walletName(t.toWalletId))}</td>
    <td class="right amt-tf">${fmt(t.amount)}</td>${del}</tr>`;
  return `<tr>${dcell}<td><span class="tag tag-out">CHI</span></td>
    <td>${esc(t.content)}${t.note?` <small class="muted">· ${esc(t.note)}</small>`:''}</td>
    <td class="muted">${catIcon(t.category)} ${esc(t.category||'')} · ${walletIcon(t.walletId)} ${esc(walletName(t.walletId))}</td>
    <td class="right amt-out">−${fmt(t.amount)}</td>${del}</tr>`;
}
function fillTxTable(tb, tx, withDate){
  const span=withDate?6:5;
  if(!tx.length){ tb.innerHTML=`<tr><td colspan="${span}" class="muted center">Chưa có giao dịch.</td></tr>`; return; }
  tb.innerHTML=tx.map(t=>txRow(t,withDate)).join('');
  tb.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>delTx(b.dataset.del)));
}
function delTx(id){
  state.transactions=state.transactions.filter(t=>t.id!==id);
  save(); toast('Đã xóa giao dịch'); refreshActive();
}

/* ===========================================================
   CALENDAR
   =========================================================== */
function renderCalendar(){
  const [y,m]=curMonth.split('-').map(Number);
  const first=new Date(y,m-1,1), days=new Date(y,m,0).getDate();
  let lead=(first.getDay()+6)%7; // T2 = 0
  const grid=document.getElementById('calGrid');
  let html='';
  for(let i=0;i<lead;i++) html+='<div class="cal-cell empty"></div>';
  for(let d=1;d<=days;d++){
    const iso=`${curMonth}-${String(d).padStart(2,'0')}`;
    const tx=dayTx(iso); let din=0,dout=0;
    tx.forEach(t=>{ if(t.type==='income')din+=t.amount; else if(t.type==='expense')dout+=t.amount; });
    const today=iso===todayISO()?' today':'';
    html+=`<div class="cal-cell${today}" data-iso="${iso}">
      <span class="cd">${d}</span>
      ${din?`<span class="ci">+${fmtShort(din)}</span>`:''}
      ${dout?`<span class="ce">−${fmtShort(dout)}</span>`:''}</div>`;
  }
  grid.innerHTML=html;
  grid.querySelectorAll('.cal-cell[data-iso]').forEach(c=>c.addEventListener('click',()=>{
    recordDay=c.dataset.iso; gotoView('record');
  }));
}

/* ===========================================================
   ALL TRANSACTIONS (search/filter)
   =========================================================== */
['txSearch','txFilterType','txFilterWallet','txFilterScope'].forEach(id=>{
  const el=document.getElementById(id);
  el.addEventListener('input',renderTxns); el.addEventListener('change',renderTxns);
});
function renderTxns(){
  const q=document.getElementById('txSearch').value.trim().toLowerCase();
  const ty=document.getElementById('txFilterType').value;
  const wid=document.getElementById('txFilterWallet').value;
  const scope=document.getElementById('txFilterScope').value;
  let list=state.transactions.slice();
  if(scope==='month') list=list.filter(t=>monthOf(t.date)===curMonth);
  if(ty) list=list.filter(t=>t.type===ty);
  if(wid) list=list.filter(t=>t.walletId===wid||t.toWalletId===wid);
  if(q) list=list.filter(t=>((t.content||'')+(t.source||'')+(t.note||'')+(t.category||'')).toLowerCase().includes(q));
  list.sort((a,b)=> a.date<b.date?1:a.date>b.date?-1:0);
  let din=0,dout=0;
  list.forEach(t=>{ if(t.type==='income')din+=t.amount; else if(t.type==='expense')dout+=t.amount; });
  document.getElementById('txTotals').innerHTML=
    `<span>Số giao dịch: <b>${list.length}</b></span>
     <span class="amt-in">Thu: <b>${fmt(din)}</b></span>
     <span class="amt-out">Chi: <b>${fmt(dout)}</b></span>
     <span>Chênh lệch: <b style="color:${din-dout>=0?'var(--green)':'var(--red)'}">${fmt(din-dout)}</b></span>`;
  fillTxTable(document.querySelector('#allTxTable tbody'), list, true);
}

/* ===========================================================
   WALLETS
   =========================================================== */
document.getElementById('walletForm').addEventListener('submit',e=>{
  e.preventDefault(); const f=e.target;
  if(!f.name.value.trim()){ toast('Nhập tên ví',true); return; }
  state.wallets.push({id:uid(),name:f.name.value.trim(),icon:f.icon.value,initial:parseMoney(f.initial.value)});
  save(); f.reset(); fillWalletSelects(); renderWallets(); toast('Đã thêm ví');
});
function delWallet(id){
  if(state.wallets.length<=1){ toast('Phải còn ít nhất 1 ví',true); return; }
  const used=state.transactions.some(t=>t.walletId===id||t.toWalletId===id);
  if(used && !confirm('Ví này có giao dịch. Xóa ví sẽ KHÔNG xóa giao dịch (chúng sẽ hiển thị "đã xóa"). Tiếp tục?')) return;
  state.wallets=state.wallets.filter(w=>w.id!==id);
  save(); fillWalletSelects(); renderWallets(); toast('Đã xóa ví');
}
function renderWallets(){
  document.getElementById('walletGrandTotal').textContent=fmt(totalWallets());
  const grid=document.getElementById('walletGrid');
  grid.innerHTML=state.wallets.map(w=>{
    const bal=walletBalance(w.id);
    return `<div class="wallet-card">
      <button class="del-btn wc-del" data-delw="${w.id}">✕</button>
      <div class="wc-top"><div class="wc-ic">${w.icon}</div><div class="wc-name">${esc(w.name)}</div></div>
      <div class="wc-bal${bal<0?' neg':''}">${fmt(bal)}</div>
      <div class="wc-init">Số dư ban đầu: ${fmt(w.initial||0)}</div>
    </div>`;
  }).join('');
  grid.querySelectorAll('[data-delw]').forEach(b=>b.addEventListener('click',()=>delWallet(b.dataset.delw)));
}

/* ===========================================================
   BUDGET
   =========================================================== */
document.getElementById('budgetForm').addEventListener('submit',e=>{
  e.preventDefault(); const f=e.target, lim=parseMoney(f.limit.value);
  if(lim<=0){ toast('Hạn mức không hợp lệ',true); return; }
  if(!state.budgets[curMonth]) state.budgets[curMonth]={};
  state.budgets[curMonth][f.category.value]=lim;
  save(); f.reset(); fillCatSelects(); renderBudget(); toast('Đã lưu ngân sách');
});
function delBudget(cat){
  if(state.budgets[curMonth]) delete state.budgets[curMonth][cat];
  save(); renderBudget(); toast('Đã xóa ngân sách');
}
function budgetItemsHTML(){
  const bs=state.budgets[curMonth]||{};
  const keys=Object.keys(bs);
  if(!keys.length) return '';
  return keys.map(cat=>{
    const lim=bs[cat], spent=catSpent(curMonth,cat), pct=Math.min(100,spent/lim*100);
    const over=spent>lim;
    const col=over?'var(--red)':pct>80?'var(--gold)':'var(--green)';
    return `<div class="bl-item">
      <div class="bl-head"><span class="nm">${catIcon(cat)} ${esc(cat)}</span>
        <span>${fmt(spent)} / ${fmt(lim)} <button class="del-btn bl-del" data-delb="${esc(cat)}">✕</button></span></div>
      <div class="bl-bar"><div class="bl-fill" style="width:${pct}%;background:${col}"></div></div>
      <div class="bl-meta"><span>${pct.toFixed(0)}% đã dùng</span>
        <span style="color:${over?'var(--red)':'var(--muted)'}">${over?'⚠ Vượt '+fmt(spent-lim):'Còn lại '+fmt(lim-spent)}</span></div>
    </div>`;
  }).join('');
}
function renderBudget(){
  const html=budgetItemsHTML();
  const box=document.getElementById('budgetList');
  box.innerHTML=html||'<p class="muted center">Chưa đặt ngân sách nào cho tháng này.</p>';
  box.querySelectorAll('[data-delb]').forEach(b=>b.addEventListener('click',()=>delBudget(b.dataset.delb)));
}

/* ===========================================================
   RECURRING
   =========================================================== */
document.getElementById('recurringForm').addEventListener('submit',e=>{
  e.preventDefault(); const f=e.target, amt=parseMoney(f.amount.value);
  if(amt<=0){ toast('Số tiền không hợp lệ',true); return; }
  state.recurring.push({id:uid(),type:f.type.value,amount:amt,name:f.name.value.trim(),
    day:Math.min(31,Math.max(1,Number(f.day.value)||1)),category:f.category.value,walletId:f.wallet.value,lastApplied:''});
  save(); f.reset(); fillCatSelects(); fillWalletSelects(); renderRecurring(); toast('Đã thêm định kỳ');
});
function delRecurring(id){
  state.recurring=state.recurring.filter(r=>r.id!==id);
  save(); renderRecurring(); toast('Đã xóa định kỳ');
}
// Tự áp dụng các giao dịch định kỳ đến hạn (theo ngày thực tế)
function applyRecurring(){
  const tM=todayMonth(), tDay=Number(todayISO().slice(8,10));
  let n=0;
  state.recurring.forEach(r=>{
    if(r.lastApplied===tM) return;
    if(r.day>tDay) return;
    const lastDay=new Date(Number(tM.slice(0,4)),Number(tM.slice(5,7)),0).getDate();
    const iso=`${tM}-${String(Math.min(r.day,lastDay)).padStart(2,'0')}`;
    const tx={id:uid(),date:iso,type:r.type,amount:r.amount,walletId:r.walletId,category:r.category};
    if(r.type==='income') tx.source=r.name; else { tx.content=r.name; tx.kind='cp-co-dinh'; }
    tx.note='(Định kỳ)';
    state.transactions.push(tx); r.lastApplied=tM; n++;
  });
  if(n){ save(); toast(`Đã tự thêm ${n} giao dịch định kỳ tháng này`); }
}
function renderRecurring(){
  const box=document.getElementById('recurringList');
  if(!state.recurring.length){ box.innerHTML='<p class="muted center">Chưa có giao dịch định kỳ.</p>'; return; }
  box.innerHTML=state.recurring.map(r=>{
    const isIn=r.type==='income';
    return `<div class="rec-item">
      <div class="rec-ic">${catIcon(r.category)}</div>
      <div class="rec-main"><b>${esc(r.name)}</b>
        <small>Ngày ${r.day} hàng tháng · ${isIn?'Thu':'Chi'} · ${walletIcon(r.walletId)} ${esc(walletName(r.walletId))}${r.lastApplied?` · đã áp dụng ${r.lastApplied}`:''}</small></div>
      <div class="rec-amt ${isIn?'amt-in':'amt-out'}">${isIn?'+':'−'}${fmt(r.amount)}</div>
      <button class="del-btn" data-delr="${r.id}">✕</button>
    </div>`;
  }).join('');
  box.querySelectorAll('[data-delr]').forEach(b=>b.addEventListener('click',()=>delRecurring(b.dataset.delr)));
}

/* ===========================================================
   BALANCE
   =========================================================== */
function ensureBalance(m){
  if(!state.balances[m]){
    const prev=state.balances[prevMonthKey(m)];
    state.balances[m]=prev
      ?{assets:prev.assets.map(x=>({...x,id:uid()})),liabilities:prev.liabilities.map(x=>({...x,id:uid()}))}
      :{assets:[],liabilities:[]};
    save();
  }
  return state.balances[m];
}
document.getElementById('assetForm').addEventListener('submit',e=>addBS(e,'assets'));
document.getElementById('liabForm').addEventListener('submit',e=>addBS(e,'liabilities'));
function addBS(e,key){
  e.preventDefault(); const f=e.target, val=parseMoney(f.value.value);
  if(val<=0||!f.name.value.trim()){ toast('Dữ liệu không hợp lệ',true); return; }
  ensureBalance(curMonth)[key].push({id:uid(),name:f.name.value.trim(),value:val});
  save(); f.reset(); renderBalance(); toast('Đã thêm mục');
}
function delBS(key,id){
  const b=ensureBalance(curMonth); b[key]=b[key].filter(x=>x.id!==id);
  save(); renderBalance(); toast('Đã xóa');
}
document.getElementById('syncWalletsBtn').addEventListener('click',()=>{
  const b=ensureBalance(curMonth);
  b.assets=b.assets.filter(x=>!x.fromWallet);
  state.wallets.forEach(w=>{ const bal=walletBalance(w.id); if(bal>0) b.assets.push({id:uid(),name:`${w.icon} ${w.name} (số dư ví)`,value:bal,fromWallet:true}); });
  save(); renderBalance(); toast('Đã cập nhật số dư ví vào tài sản');
});
function renderBalance(){
  const b=ensureBalance(curMonth), nw=netWorthOf(curMonth);
  document.getElementById('balanceNetWorth').textContent=fmt(nw.net);
  const prevNw=netWorthOf(prevMonthKey(curMonth)).net, diff=nw.net-prevNw;
  document.getElementById('balanceNetWorthChange').textContent=
    prevNw?(diff>=0?'▲ Tăng ':'▼ Giảm ')+fmt(Math.abs(diff))+' so với tháng trước':'Chưa có dữ liệu tháng trước để so sánh';
  fillBS('assetTable','assets',b.assets); fillBS('liabTable','liabilities',b.liabilities);
  document.getElementById('totalAsset').textContent=fmt(nw.assets);
  document.getElementById('totalLiab').textContent=fmt(nw.liab);
}
function fillBS(tableId,key,arr){
  const tb=document.querySelector('#'+tableId+' tbody');
  if(!arr.length){ tb.innerHTML='<tr><td colspan="3" class="muted">Chưa có mục nào.</td></tr>'; return; }
  tb.innerHTML=arr.map(x=>`<tr><td>${esc(x.name)}</td><td class="right">${fmt(x.value)}</td>
    <td class="right"><button class="del-btn" data-k="${key}" data-id="${x.id}">✕</button></td></tr>`).join('');
  tb.querySelectorAll('[data-id]').forEach(btn=>btn.addEventListener('click',()=>delBS(btn.dataset.k,btn.dataset.id)));
}

/* ===========================================================
   REPORT
   =========================================================== */
function ratingFromRate(r){
  if(r>25) return {txt:'Xuất sắc',cls:'chip-good'};
  if(r>=15) return {txt:'Tốt',cls:'chip-good'};
  if(r>=10) return {txt:'Khá',cls:'chip-mid'};
  return {txt:'Cần cố gắng',cls:'chip-bad'};
}
function renderReport(){
  const tx=monthTx(curMonth);
  const weeks=[1,2,3,4].map(w=>({w,income:0,expense:0}));
  tx.forEach(t=>{ const wk=weeks[weekOfMonth(t.date)-1]; if(t.type==='income')wk.income+=t.amount; else if(t.type==='expense')wk.expense+=t.amount; });
  document.querySelector('#weekTable tbody').innerHTML=weeks.map(w=>{
    const left=w.income-w.expense, rate=w.income?left/w.income*100:0, r=ratingFromRate(rate), has=w.income||w.expense;
    return `<tr><td>Tuần ${w.w}</td><td class="right amt-in">${fmt(w.income)}</td><td class="right amt-out">${fmt(w.expense)}</td>
      <td class="right">${fmt(left)}</td><td class="right">${has?rate.toFixed(1)+'%':'—'}</td>
      <td>${has?`<span class="chip ${r.cls}">${r.txt}</span>`:'—'}</td></tr>`;
  }).join('');

  const mt=monthTotals(curMonth), nw=netWorthOf(curMonth);
  document.querySelector('#monthFlowTable tbody').innerHTML=`
    <tr><td>Tổng thu nhập</td><td class="amt-in">${fmt(mt.income)}</td></tr>
    <tr><td>Tổng chi tiêu</td><td class="amt-out">${fmt(mt.expense)}</td></tr>
    <tr><td>Tiền tiết kiệm (Thu − Chi)</td><td>${fmt(mt.saving)}</td></tr>
    <tr><td>Tỷ lệ tiết kiệm</td><td>${mt.rate.toFixed(1)}%</td></tr>
    <tr><td>Tài sản ròng cuối tháng</td><td>${fmt(nw.net)}</td></tr>`;

  const kinds={}; tx.filter(t=>t.type==='expense').forEach(t=>kinds[t.kind]=(kinds[t.kind]||0)+t.amount);
  const kEntries=Object.entries(kinds);
  document.querySelector('#kindTable tbody').innerHTML=kEntries.length
    ?kEntries.map(([k,v])=>`<tr><td>${KIND_LABEL[k]||k}</td><td>${fmt(v)}</td></tr>`).join('')
    :'<tr><td class="muted">Chưa có chi tiêu.</td><td></td></tr>';

  const cats=catTotals(curMonth), total=cats.reduce((s,c)=>s+c.value,0);
  document.querySelector('#catTable tbody').innerHTML=cats.length
    ?cats.map(c=>{ const pct=total?c.value/total*100:0;
      const lv=pct>30?{t:'Cao',c:'chip-bad'}:pct>15?{t:'Trung bình',c:'chip-mid'}:{t:'Thấp',c:'chip-good'};
      return `<tr><td>${catIcon(c.name)} ${esc(c.name)}</td><td class="right">${fmt(c.value)}</td>
        <td class="right">${pct.toFixed(1)}%</td><td><span class="chip ${lv.c}">${lv.t}</span></td></tr>`; }).join('')
    :'<tr><td colspan="4" class="muted center">Chưa có chi tiêu trong tháng.</td></tr>';
}

/* ===========================================================
   GOALS
   =========================================================== */
document.getElementById('goalsForm').addEventListener('submit',e=>{
  e.preventDefault(); const f=e.target;
  state.goals[curMonth]={incomeGoal:parseMoney(f.incomeGoal.value),savingGoal:parseMoney(f.savingGoal.value),
    debtGoal:parseMoney(f.debtGoal.value),rateGoal:Number(f.rateGoal.value)||0};
  save(); renderGoals(); toast('Đã lưu mục tiêu tháng');
});
function renderGoals(){
  const g=state.goals[curMonth]||{}, f=document.getElementById('goalsForm');
  f.incomeGoal.value=g.incomeGoal?fmtShort(g.incomeGoal):''; f.savingGoal.value=g.savingGoal?fmtShort(g.savingGoal):'';
  f.debtGoal.value=g.debtGoal?fmtShort(g.debtGoal):''; f.rateGoal.value=g.rateGoal||'';
  const mt=monthTotals(curMonth);
  const debtPaid=Math.max(0,netWorthOf(prevMonthKey(curMonth)).liab-netWorthOf(curMonth).liab);
  const bars=[
    {l:'Thu nhập',cur:mt.income,goal:g.incomeGoal,col:'var(--green)'},
    {l:'Tiết kiệm',cur:mt.saving,goal:g.savingGoal,col:'var(--gold)'},
    {l:'Giảm nợ',cur:debtPaid,goal:g.debtGoal,col:'var(--blue)'},
    {l:'Tỷ lệ tiết kiệm (%)',cur:mt.rate,goal:g.rateGoal,col:'var(--purple)',pct:true}
  ];
  document.getElementById('goalProgress').innerHTML=bars.map(b=>{
    if(!b.goal) return `<div class="gp"><div class="gp-head"><span>${b.l}</span><span class="muted">Chưa đặt mục tiêu</span></div><div class="gp-bar"><div class="gp-fill" style="width:0"></div></div></div>`;
    const p=Math.min(100,Math.max(0,b.cur/b.goal*100));
    const curTxt=b.pct?b.cur.toFixed(1)+'%':fmt(b.cur), goalTxt=b.pct?b.goal+'%':fmt(b.goal);
    return `<div class="gp"><div class="gp-head"><span>${b.l}</span><span>${curTxt} / ${goalTxt} (${p.toFixed(0)}%)</span></div>
      <div class="gp-bar"><div class="gp-fill" style="width:${p}%;background:${b.col}"></div></div></div>`;
  }).join('');

  const rBox=document.getElementById('reflectionBox'), saved=state.reflections[curMonth]||{};
  rBox.innerHTML=REFLECT_Q.map((q,i)=>`<div><p class="q">${i+1}. ${q}</p>
    <textarea data-ri="${i}" placeholder="Viết suy nghĩ của bạn...">${esc(saved[i]||'')}</textarea></div>`).join('');
  rBox.querySelectorAll('textarea').forEach(t=>t.addEventListener('change',()=>{
    if(!state.reflections[curMonth])state.reflections[curMonth]={};
    state.reflections[curMonth][t.dataset.ri]=t.value; save(); toast('Đã lưu');
  }));

  const cBox=document.getElementById('commitBox'), cs=state.commits[curMonth]||{};
  cBox.innerHTML=COMMITMENTS.map((c,i)=>`<label class="commit-item ${cs[i]?'done':''}">
    <input type="checkbox" data-ci="${i}" ${cs[i]?'checked':''}/> ${c}</label>`).join('');
  cBox.querySelectorAll('input').forEach(ip=>ip.addEventListener('change',()=>{
    if(!state.commits[curMonth])state.commits[curMonth]={};
    state.commits[curMonth][ip.dataset.ci]=ip.checked; save(); renderGoals();
  }));
}

/* ===========================================================
   DASHBOARD
   =========================================================== */
const PALETTE=['#22c55e','#3b82f6','#f59e0b','#ef4444','#a855f7','#06b6d4','#ec4899','#84cc16','#f97316','#14b8a6','#6366f1','#eab308','#94a3b8','#fb7185','#2dd4bf','#c084fc'];
function renderDashboard(){
  const mt=monthTotals(curMonth), nw=netWorthOf(curMonth), prevNet=netWorthOf(prevMonthKey(curMonth)).net;
  document.getElementById('dashSubtitle').textContent='Tháng '+curMonth.split('-').reverse().join('/');
  document.getElementById('streakDays').textContent=computeStreak();
  document.getElementById('kpiNetWorth').textContent=fmt(nw.net);
  const diff=nw.net-prevNet, nwc=document.getElementById('kpiNetWorthChange');
  if(prevNet){ nwc.textContent=(diff>=0?'▲ +':'▼ ')+fmt(Math.abs(diff))+' so tháng trước'; nwc.className='kpi-sub '+(diff>=0?'up':'down'); } else nwc.textContent='';
  document.getElementById('kpiWalletTotal').textContent=fmt(totalWallets());
  document.getElementById('kpiWalletCount').textContent=state.wallets.length+' ví';
  document.getElementById('kpiIncome').textContent=fmt(mt.income);
  document.getElementById('kpiExpense').textContent=fmt(mt.expense);
  document.getElementById('kpiSavingRate').textContent='Tỷ lệ TK: '+mt.rate.toFixed(1)+'%';

  document.getElementById('dashWallets').innerHTML=state.wallets.map(w=>{
    const bal=walletBalance(w.id);
    return `<div class="ws"><div class="nm"><span class="ic">${w.icon}</span> ${esc(w.name)}</div><b style="color:${bal<0?'var(--red)':'var(--txt)'}">${fmt(bal)}</b></div>`;
  }).join('')||'<p class="muted">Chưa có ví.</p>';

  renderFundsBox(mt.income,'dashJars',null);

  const bHtml=budgetItemsHTML();
  document.getElementById('dashBudget').innerHTML=bHtml||'<p class="empty">Chưa đặt ngân sách. Vào tab "Ngân sách" để thiết lập.</p>';

  const exp=monthTx(curMonth).filter(t=>t.type==='expense').sort((a,b)=>b.amount-a.amount).slice(0,3);
  document.getElementById('topExpenses').innerHTML=exp.length
    ?exp.map(t=>`<li><span>${catIcon(t.category)} ${esc(t.content)} <small class="muted">(${esc(t.category||'')})</small></span><b class="amt-out">${fmt(t.amount)}</b></li>`).join('')
    :'<li class="muted">Chưa có dữ liệu.</li>';
  drawCharts();
}
function fundRow(name,pct,val){ return `<div class="fund"><div class="fund-name">${name} <span class="fund-pct">${pct}</span></div><div class="fund-val">${fmt(val)}</div></div>`; }

/* ===========================================================
   6 LỌ (JARS) — tỷ lệ phân bổ thu nhập, chỉnh được
   =========================================================== */
const DEFAULT_JARS=[
  {key:'nec', icon:'🏠', name:'Thiết yếu (NEC)',         pct:55},
  {key:'ffa', icon:'💰', name:'Tự do tài chính (FFA)',   pct:10},
  {key:'ltss',icon:'🏦', name:'Tiết kiệm dài hạn (LTSS)',pct:10},
  {key:'edu', icon:'📚', name:'Giáo dục (EDU)',          pct:10},
  {key:'play',icon:'🎉', name:'Hưởng thụ (PLAY)',        pct:10},
  {key:'give',icon:'🎁', name:'Cho đi (GIVE)',           pct:5}
];
function getJars(){
  const j=state.settings&&state.settings.jars;
  return (Array.isArray(j)&&j.length)?j.map(x=>({...x})):DEFAULT_JARS.map(x=>({...x}));
}
function renderFundsBox(income, boxId, noteId){
  boxId=boxId||'fundsBox'; noteId=(noteId===undefined?'jarsNote':noteId);
  const jars=getJars(), sum=jars.reduce((a,j)=>a+(j.pct||0),0);
  const box=document.getElementById(boxId);
  if(box) box.innerHTML=jars.map(j=>fundRow(`${j.icon} ${esc(j.name)}`,(j.pct||0)+'%',income*(j.pct||0)/100)).join('');
  const note=noteId&&document.getElementById(noteId);
  if(note) note.innerHTML = sum===100 ? `Phân bổ ${fmt(income)} thu nhập tháng theo 6 lọ.` :
    `⚠ Tổng tỷ lệ đang là <b style="color:var(--gold-soft)">${sum}%</b> (nên = 100%). Hãy chỉnh ở mục bên dưới.`;
}

const JAR_INFO={
  nec:'Chi phí sống thiết yếu: ăn ở, đi lại, hóa đơn, nợ tối thiểu. Giữ ≤ 55% để không bị cuốn vào vòng "kiếm bao nhiêu tiêu hết bấy nhiêu".',
  ffa:'Con ngỗng đẻ trứng vàng — chỉ ĐẦU TƯ, KHÔNG BAO GIỜ tiêu. Tạo thu nhập thụ động đưa bạn đến tự do tài chính.',
  ltss:'Tiết kiệm cho mục tiêu lớn dài hạn: mua nhà, xe, quỹ khẩn cấp, kế hoạch lớn của gia đình.',
  edu:'Đầu tư vào chính mình: sách, khóa học, coaching. Năng lực tăng → thu nhập tăng.',
  play:'Hưởng thụ & tự thưởng mỗi tháng để giữ động lực. NÊN tiêu hết trong tháng — đây là phần thưởng cho nỗ lực.',
  give:'Cho đi, từ thiện, giúp đỡ người khác — nuôi dưỡng tâm thế đủ đầy và phước báu.'
};
const JAR_PRESETS=[
  {label:'JARS chuẩn',      pct:{nec:55,ffa:10,ltss:10,edu:10,play:10,give:5}},
  {label:'Tiết kiệm mạnh',  pct:{nec:50,ffa:15,ltss:15,edu:10,play:5,give:5}},
  {label:'Ưu tiên trả nợ',  pct:{nec:60,ffa:10,ltss:15,edu:5,play:5,give:5}},
  {label:'Kiểu 50/30/20',   pct:{nec:50,ffa:0,ltss:20,edu:0,play:30,give:0}}
];
function renderJarsView(){
  const income=monthTotals(curMonth).income;
  const jars=getJars();
  document.getElementById('jarsExplain').innerHTML=jars.map(j=>`
    <div class="jar-ex"><div class="jar-ex-h"><span class="jar-ex-ic">${j.icon}</span>
      <strong>${esc(j.name)}</strong><span class="jar-ex-pct">${j.pct||0}%</span></div>
      <p>${JAR_INFO[j.key]||''}</p></div>`).join('');
  renderFundsBox(income,'fundsBox','jarsNote');
  renderJarsPresets();
  renderJarsEditor();
}
function renderJarsPresets(){
  const box=document.getElementById('jarsPresets');
  box.innerHTML=JAR_PRESETS.map((p,i)=>`<button class="jpre" data-jpre="${i}">${esc(p.label)}</button>`).join('');
  box.querySelectorAll('[data-jpre]').forEach(b=>b.addEventListener('click',()=>{
    const p=JAR_PRESETS[+b.dataset.jpre];
    getJars().forEach((j,i)=>{ const inp=document.querySelector(`#jarsEdit input[data-ji="${i}"]`); if(inp) inp.value=p.pct[j.key]!==undefined?p.pct[j.key]:0; });
    const ev=new Event('input'); const first=document.querySelector('#jarsEdit input[data-ji]'); if(first) first.dispatchEvent(ev);
    toast('Đã áp mẫu "'+p.label+'". Bấm Lưu để áp dụng.');
  }));
}
function renderJarsEditor(){
  const jars=getJars(), el=document.getElementById('jarsEdit');
  el.innerHTML=jars.map((j,i)=>`<div class="jar-input">
      <label>${j.icon} ${esc(j.name)}</label>
      <div class="jar-pct"><input type="number" min="0" max="100" step="1" data-ji="${i}" value="${j.pct||0}"/><span>%</span></div>
    </div>`).join('')+
    `<div class="jars-sum" id="jarsSum"></div>
     <div class="jars-actions">
       <button class="btn btn-sm btn-primary" id="jarsSave">Lưu tỷ lệ</button>
       <button class="mini-btn" id="jarsReset">Khôi phục 6 lọ chuẩn</button>
     </div>`;
  const inputs=[...el.querySelectorAll('input[data-ji]')];
  const upd=()=>{ const s=inputs.reduce((a,x)=>a+(Number(x.value)||0),0);
    document.getElementById('jarsSum').innerHTML=`Tổng: <b style="color:${s===100?'var(--green)':'var(--gold-soft)'}">${s}%</b> ${s===100?'✓ hợp lệ':'(nên = 100%)'}`; };
  inputs.forEach(x=>x.addEventListener('input',upd)); upd();
  document.getElementById('jarsSave').addEventListener('click',()=>{
    const nj=getJars().map((j,i)=>({...j,pct:Math.max(0,Math.round(Number(inputs[i].value)||0))}));
    const s=nj.reduce((a,j)=>a+j.pct,0);
    if(s!==100 && !confirm(`Tổng tỷ lệ là ${s}%, không bằng 100%. Vẫn lưu?`)) return;
    if(!state.settings) state.settings={};
    state.settings.jars=nj; save(); renderJarsView(); toast('Đã lưu tỷ lệ 6 lọ');
  });
  document.getElementById('jarsReset').addEventListener('click',()=>{
    if(!state.settings) state.settings={};
    state.settings.jars=DEFAULT_JARS.map(j=>({...j})); save(); renderJarsView(); toast('Đã khôi phục tỷ lệ chuẩn');
  });
}

function drawCharts(){
  if(typeof Chart==='undefined') return;
  Chart.defaults.color='#8a98a8'; Chart.defaults.font.family="'Be Vietnam Pro',sans-serif";
  // category doughnut
  const cats=catTotals(curMonth), noCat=document.getElementById('noCatData'), catCv=document.getElementById('chartCategory');
  if(charts.cat){charts.cat.destroy();charts.cat=null;}
  if(cats.length){ noCat.hidden=true; catCv.style.display='';
    charts.cat=new Chart(catCv,{type:'doughnut',
      data:{labels:cats.map(c=>c.name),datasets:[{data:cats.map(c=>c.value),backgroundColor:PALETTE,borderColor:'#1c2531',borderWidth:2}]},
      options:{plugins:{legend:{position:'right',labels:{boxWidth:12,padding:8,font:{size:11}}}},cutout:'58%'}});
  } else { noCat.hidden=false; catCv.style.display='none'; }
  // income vs expense bars, last 6 months
  const months=lastMonths(curMonth,6);
  const incs=months.map(m=>monthTotals(m).income), exps=months.map(m=>monthTotals(m).expense);
  const flowCv=document.getElementById('chartFlow');
  if(charts.flow){charts.flow.destroy();charts.flow=null;}
  charts.flow=new Chart(flowCv,{type:'bar',
    data:{labels:months.map(m=>m.slice(5)+'/'+m.slice(2,4)),datasets:[
      {label:'Thu',data:incs,backgroundColor:'#22c55e',borderRadius:5},
      {label:'Chi',data:exps,backgroundColor:'#ef4444',borderRadius:5}]},
    options:{plugins:{legend:{labels:{boxWidth:12}}},scales:{y:{ticks:{callback:v=>fmtShort(v)}}}}});
}
function lastMonths(m,n){ const out=[]; let c=m; for(let i=0;i<n;i++){ out.unshift(c); c=prevMonthKey(c); } return out; }

/* ===========================================================
   RENDER ROUTER
   =========================================================== */
function activeView(){ return document.querySelector('.view.active').id.replace('view-',''); }
function gotoView(name){
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));
  renderAll();
}
function refreshActive(){ renderAll(); }
function renderAll(){
  monthPicker.value=curMonth;
  switch(activeView()){
    case 'dashboard': renderDashboard(); break;
    case 'jars': renderJarsView(); break;
    case 'record': renderRecord(); break;
    case 'calendar': renderCalendar(); break;
    case 'txns': renderTxns(); break;
    case 'wallets': renderWallets(); break;
    case 'budget': renderBudget(); break;
    case 'recurring': renderRecurring(); break;
    case 'balance': renderBalance(); break;
    case 'report': renderReport(); break;
    case 'goals': renderGoals(); break;
  }
}

/* ===========================================================
   IMPORT / EXPORT
   =========================================================== */
document.getElementById('exportBtn').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='kt-so-tai-chinh-'+todayISO()+'.json'; a.click(); toast('Đã xuất dữ liệu');
});
document.getElementById('importBtn').addEventListener('click',()=>document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change',e=>{
  const file=e.target.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=()=>{
    try{ const d=JSON.parse(r.result); if(!d.transactions) throw 0;
      state=Object.assign(blank(),d);
      if(!state.wallets.length) state.wallets=[{id:'w_cash',name:'Tiền mặt',icon:'💵',initial:0}];
      state.transactions.forEach(t=>{ if(!t.walletId)t.walletId=state.wallets[0].id; });
      save(); fillCatSelects(); fillWalletSelects(); renderAll(); toast('Đã nhập dữ liệu thành công');
    }catch(err){ toast('File không hợp lệ',true); }
  };
  r.readAsText(file);
});

/* ---------- UTIL ---------- */
let _seq=0;
function uid(){ _seq++; return 'x'+Math.abs(hashStr(Date.now()+'-'+_seq+'-'+performance.now())).toString(36); }
function hashStr(s){ let h=0; for(let i=0;i<s.length;i++){ h=(h<<5)-h+s.charCodeAt(i); h|=0; } return h; }
function esc(s){ return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ===========================================================
   STREAK (chuỗi ngày ghi chép liên tục)
   =========================================================== */
function computeStreak(){
  const set=new Set(state.transactions.map(t=>t.date));
  if(!set.size) return 0;
  const iso=d=>d.toISOString().slice(0,10);
  let d=new Date(), count=0;
  if(!set.has(iso(d))) d.setDate(d.getDate()-1); // hôm nay chưa ghi thì chưa tính là đứt
  while(set.has(iso(d))){ count++; d.setDate(d.getDate()-1); }
  return count;
}

/* ===========================================================
   QUICK ADD (1 chạm)
   =========================================================== */
const DEFAULT_PRESETS=[
  {icon:'☕',label:'Cà phê',amount:25000,category:'Ăn uống'},
  {icon:'🍚',label:'Ăn trưa',amount:50000,category:'Ăn uống'},
  {icon:'⛽',label:'Xăng xe',amount:50000,category:'Di chuyển / Xăng xe'},
  {icon:'🛒',label:'Đi chợ',amount:100000,category:'Đi chợ / Siêu thị'}
];
let quickMode='expense', quickCat=EXPENSE_CATS[0].name;
function initQuickAdd(){
  const fab=document.getElementById('fab'), ov=document.getElementById('quickOverlay');
  const open=()=>{ ov.hidden=false; renderQuickSheet(); setTimeout(()=>document.getElementById('quickAmount').focus(),50); };
  const close=()=>{ ov.hidden=true; };
  fab.addEventListener('click',open);
  document.getElementById('quickClose').addEventListener('click',close);
  ov.addEventListener('click',e=>{ if(e.target===ov) close(); });
  document.querySelectorAll('#quickSeg .seg-btn').forEach(b=>b.addEventListener('click',()=>{
    quickMode=b.dataset.qm;
    document.querySelectorAll('#quickSeg .seg-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active');
    quickCat=(quickMode==='expense'?EXPENSE_CATS:INCOME_CATS)[0].name; renderQuickCats();
  }));
  document.getElementById('quickSave').addEventListener('click',()=>{
    const amt=parseMoney(document.getElementById('quickAmount').value);
    if(amt<=0){ toast('Nhập số tiền hợp lệ',true); return; }
    quickAddTx(quickMode,amt,quickCat); document.getElementById('quickAmount').value=''; close();
  });
  document.getElementById('quickAmount').addEventListener('keydown',e=>{ if(e.key==='Enter') document.getElementById('quickSave').click(); });
}
function renderQuickSheet(){
  const pBox=document.getElementById('quickPresets');
  pBox.innerHTML=DEFAULT_PRESETS.map((p,i)=>`<button class="qp" data-qp="${i}">
    <span class="qp-ic">${p.icon}</span><span class="qp-meta"><b>${p.label}</b><small>${fmt(p.amount)} · Chi</small></span></button>`).join('');
  pBox.querySelectorAll('[data-qp]').forEach(b=>b.addEventListener('click',()=>{
    const p=DEFAULT_PRESETS[+b.dataset.qp]; quickAddTx('expense',p.amount,p.category);
    document.getElementById('quickOverlay').hidden=true;
  }));
  renderQuickCats();
}
function renderQuickCats(){
  const box=document.getElementById('quickCats');
  const list=quickMode==='expense'?EXPENSE_CATS:INCOME_CATS;
  box.innerHTML=list.map(c=>`<button class="qcat${c.name===quickCat?' active':''}" data-qc="${esc(c.name)}">${c.icon} ${esc(c.name)}</button>`).join('');
  box.querySelectorAll('[data-qc]').forEach(b=>b.addEventListener('click',()=>{ quickCat=b.dataset.qc; renderQuickCats(); }));
}
function quickAddTx(type,amount,category){
  const wId=(state.wallets[0]||{}).id;
  const t={id:uid(),date:todayISO(),type,amount,walletId:wId,category};
  if(type==='income') t.source=category; else { t.content=category; t.kind='cp-bien-doi'; }
  t.note='(Thêm nhanh)';
  state.transactions.push(t); save();
  toast((type==='income'?'+ Thu ':'− Chi ')+fmt(amount)+' · '+category);
  renderAll();
}

/* ===========================================================
   DAILY REMINDER
   =========================================================== */
let remTimer=null;
function initReminder(){
  const tgl=document.getElementById('reminderToggle'), time=document.getElementById('reminderTime');
  const s=state.settings||(state.settings={});
  tgl.checked=!!s.reminderOn;
  time.value=s.reminderTime||(window.KT_CONFIG&&KT_CONFIG.reminderTime)||'21:00';
  tgl.addEventListener('change',async()=>{
    if(tgl.checked){ const ok=await ensureNotifyPermission(); if(!ok){ tgl.checked=false; toast('Cần cho phép thông báo trong trình duyệt',true); return; } }
    state.settings.reminderOn=tgl.checked; state.settings.reminderTime=time.value; save(); scheduleReminder();
    toast(tgl.checked?'Đã bật nhắc nhở hằng ngày':'Đã tắt nhắc nhở');
  });
  time.addEventListener('change',()=>{ state.settings.reminderTime=time.value; save(); scheduleReminder(); });
  scheduleReminder();
}
async function ensureNotifyPermission(){
  if(!('Notification'in window)) return false;
  if(Notification.permission==='granted') return true;
  if(Notification.permission==='denied') return false;
  return (await Notification.requestPermission())==='granted';
}
function scheduleReminder(){
  clearTimeout(remTimer);
  const s=state.settings||{};
  if(!s.reminderOn||!('Notification'in window)||Notification.permission!=='granted') return;
  const [h,m]=(s.reminderTime||'21:00').split(':').map(Number);
  const now=new Date(), next=new Date(); next.setHours(h,m,0,0);
  if(next<=now) next.setDate(next.getDate()+1);
  remTimer=setTimeout(()=>{ fireReminder(); scheduleReminder(); }, next-now);
}
function fireReminder(){
  const has=state.transactions.some(t=>t.date===todayISO());
  const body=has?'Bạn đã ghi chép hôm nay rồi 🔥 Xem lại tổng kết ngày nhé!':'Bạn chưa ghi chép hôm nay. Dành 1 phút ghi lại để giữ streak!';
  try{
    if(navigator.serviceWorker&&navigator.serviceWorker.ready)
      navigator.serviceWorker.ready.then(r=>r.showNotification('KT · Sổ Tài Chính',{body,icon:'icon.svg',badge:'icon.svg'}));
    else new Notification('KT · Sổ Tài Chính',{body,icon:'icon.svg'});
  }catch(e){ toast(body); }
}

/* ===========================================================
   LEAD-MAGNET CTA LINKS
   =========================================================== */
function initCTALinks(){
  const links=(window.KT_CONFIG&&KT_CONFIG.links)||{};
  document.querySelectorAll('[data-link]').forEach(a=>{
    const url=links[a.dataset.link]||'#';
    if(url&&url!=='#'){ a.href=url; a.target='_blank'; a.rel='noopener'; }
    else a.addEventListener('click',e=>{ e.preventDefault(); toast('Liên kết khóa học chưa được cấu hình (sửa trong config.js)'); });
  });
}

/* ===========================================================
   PWA SERVICE WORKER
   =========================================================== */
function initPWA(){
  if('serviceWorker'in navigator)
    window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

/* ===========================================================
   AUTH + CLOUD SYNC (Supabase + Google)
   =========================================================== */
const CFG=window.KT_CONFIG||{};
const SB=(window.supabase&&CFG.supabaseUrl&&CFG.supabaseAnonKey)
  ? window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey) : null;
let currentUser=null, pushTimer=null;

function syncStatus(msg){ const e=document.getElementById('syncStatus'); if(e) e.textContent=msg||''; }
function cloudPushDebounced(){ if(!SB||!currentUser) return; clearTimeout(pushTimer); pushTimer=setTimeout(pushRemote,1500); }

function mergeById(a,b){ const m=new Map(); [...(a||[]),...(b||[])].forEach(x=>{ if(x&&x.id) m.set(x.id,x); }); return [...m.values()]; }
function mergeMap(a,b,aNewer){ return aNewer?Object.assign({},b||{},a||{}):Object.assign({},a||{},b||{}); }
function mergeStates(local,remote){
  const aNew=(local._updatedAt||0)>=(remote._updatedAt||0);
  return {
    transactions:mergeById(local.transactions,remote.transactions),
    wallets:mergeById(local.wallets,remote.wallets),
    recurring:mergeById(local.recurring,remote.recurring),
    budgets:mergeMap(local.budgets,remote.budgets,aNew),
    balances:mergeMap(local.balances,remote.balances,aNew),
    goals:mergeMap(local.goals,remote.goals,aNew),
    reflections:mergeMap(local.reflections,remote.reflections,aNew),
    commits:mergeMap(local.commits,remote.commits,aNew),
    settings:mergeMap(local.settings,remote.settings,aNew),
    _updatedAt:Math.max(local._updatedAt||0,remote._updatedAt||0)
  };
}
function adoptState(s){
  state=Object.assign(blank(),s);
  if(!state.wallets.length) state.wallets=[{id:'w_cash',name:'Tiền mặt',icon:'💵',initial:0}];
  state.transactions.forEach(t=>{ if(!t.walletId) t.walletId=state.wallets[0].id; });
  localStorage.setItem(STORE_KEY,JSON.stringify(state));
  fillCatSelects(); fillWalletSelects(); renderAll(); initReminder();
}

async function initAuth(){
  const loginBtn=document.getElementById('loginBtn'), logoutBtn=document.getElementById('logoutBtn');
  loginBtn.addEventListener('click',()=>{
    if(!SB){ toast('Chưa cấu hình Supabase — xem file config.js & hướng dẫn',true); return; }
    SB.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.href.split('#')[0]}});
  });
  logoutBtn.addEventListener('click',async()=>{ if(SB) await SB.auth.signOut(); currentUser=null; renderAccount(); syncStatus('Đã đăng xuất · lưu trên thiết bị'); });
  if(!SB){ syncStatus('💾 Lưu trên thiết bị (chưa bật cloud)'); return; }
  SB.auth.onAuthStateChange((_e,session)=>handleSession(session));
  try{ const {data}=await SB.auth.getSession(); handleSession(data.session); }catch(e){ syncStatus('Lỗi kết nối cloud'); }
}
async function handleSession(session){
  const u=session&&session.user||null;
  const changed=(u&&u.id)!==(currentUser&&currentUser.id);
  currentUser=u; renderAccount();
  if(currentUser&&changed){ await firstSync(); subscribeRealtime(); }
}
function renderAccount(){
  const info=document.getElementById('accountInfo'), btn=document.getElementById('loginBtn');
  if(currentUser){
    info.hidden=false; btn.hidden=true;
    const m=currentUser.user_metadata||{};
    document.getElementById('accName').textContent=m.full_name||m.name||'Tài khoản';
    document.getElementById('accEmail').textContent=currentUser.email||'';
    const av=document.getElementById('accAvatar');
    if(m.avatar_url){ av.src=m.avatar_url; av.hidden=false; } else av.hidden=true;
  } else { info.hidden=true; btn.hidden=false; }
}
async function firstSync(){
  syncStatus('⏳ Đang đồng bộ...');
  const remote=await pullRemote();
  if(remote) adoptState(mergeStates(state,remote));
  await pushRemote();
}
async function pullRemote(){
  try{
    const {data,error}=await SB.from('finance_data').select('data').eq('user_id',currentUser.id).maybeSingle();
    if(error) throw error; return data?data.data:null;
  }catch(e){ console.warn('pull',e); syncStatus('⚠ Lỗi tải dữ liệu cloud'); return null; }
}
async function pushRemote(){
  if(!SB||!currentUser) return;
  try{
    const {error}=await SB.from('finance_data').upsert({user_id:currentUser.id,data:state,updated_at:new Date().toISOString()});
    if(error) throw error;
    syncStatus('☁ Đã lưu '+new Date().toLocaleTimeString('vi-VN').slice(0,5));
  }catch(e){ console.warn('push',e); syncStatus('⚠ Lỗi lưu cloud'); }
}
function subscribeRealtime(){
  try{
    SB.channel('fin-'+currentUser.id)
      .on('postgres_changes',{event:'*',schema:'public',table:'finance_data',filter:'user_id=eq.'+currentUser.id},payload=>{
        const rd=payload.new&&payload.new.data;
        if(rd&&(rd._updatedAt||0)>(state._updatedAt||0)){ adoptState(rd); syncStatus('↻ Cập nhật từ thiết bị khác'); }
      }).subscribe();
  }catch(e){ console.warn('realtime',e); }
}

/* ---------- BOOT ---------- */
fillCatSelects();
fillWalletSelects();
applyRecurring();
renderAll();
attachMoneyInputs();
document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>gotoView(b.dataset.goto)));
initQuickAdd();
initReminder();
initCTALinks();
initPWA();
initAuth();
