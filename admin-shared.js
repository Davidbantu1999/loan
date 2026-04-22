/* ══ LOADER ══ */
var ldBarEl=document.getElementById('ldBar'),ldPctEl=document.getElementById('ldPct'),ldSubEl=document.getElementById('ldSub'),ldEl=document.getElementById('loader'),loaderHidden=false;
function setLD(p,l){if(l)ldSubEl.textContent=l;ldBarEl.style.width=p+'%';ldPctEl.textContent=p+'%';}
function hideLoader(){if(loaderHidden)return;loaderHidden=true;setLD(100,'Ready!');ldEl.classList.add('hide');setTimeout(function(){ldEl.style.display='none';},450);}
setLD(25,'Authenticating��');

/* ══ AUTH ══ */
var _u=localStorage.getItem('srUser');
if(!_u){window.location.href='login.html';}
var CU=(_u&&_u!=='undefined')?JSON.parse(_u):{name:'Admin',role:'admin'};
if(CU.role!=='admin'){window.location.href='money-collection.html';}
function ini(n){return(n||'A').split(/\s+/).map(function(x){return x[0]||'';}).join('').toUpperCase().slice(0,2)||'A';}
var adminIni=ini(CU.name);
document.getElementById('hdrSub').textContent='Admin: '+CU.name;
document.getElementById('sbAv').textContent=adminIni;
document.getElementById('sbName').textContent=CU.name;
document.getElementById('topAv').textContent=adminIni;

/* ══ FIREBASE ══ */
var FC={
  apiKey:"AIzaSyDQlQzo1yVfQOYYgNCrOcqBwLEAXKfZWCE",
  authDomain:"loan-17784.firebaseapp.com",
  databaseURL:"https://loan-17784-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:"loan-17784",
  storageBucket:"loan-17784.firebasestorage.app",
  messagingSenderId:"30800980008",
  appId:"1:30800980008:web:9869d2e63a61b2e7022d1d"
};
firebase.initializeApp(FC);
var db=firebase.database();
setLD(40,'Loading data…');

/* ══ STATE ══ */
var AC={},AP={},DL=[],EX=[],PX=[];
var aLoc='',aFilter='all';
var apC=null,apPend=0;
var dpCid=null,dpKey=null;
var odCid=null,detCid=null,editCid=null,delCustCid=null,cpPh='',nlCustId=null;
var dataReady=false,prevDelCount=0;
var curPage=1,PAGE_SIZE=30;
var MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var charts={};
var NEEDED=2,loadCount=0;

function checkLoaded(){
  loadCount++;var pct=Math.min(90,40+loadCount*25);setLD(pct,'Loading…');
  if(loadCount>=NEEDED&&!dataReady){dataReady=true;hideLoader();uAll();}
}
setTimeout(function(){if(!dataReady){dataReady=true;hideLoader();uAll();}},4000);

/* ══ HELPERS ══ */
function fmtM(n){return'₹'+Number(n||0).toLocaleString('en-IN');}
function fmtD(s){if(!s)return'—';var d=new Date(s);return isNaN(d.getTime())?s:d.getDate()+' '+MO[d.getMonth()]+' '+d.getFullYear();}
function fmtISO(d){return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());}
function pad2(n){return String(n).padStart(2,'0');}
function fmtDS(d){return d.getDate()+' '+MO[d.getMonth()];}
function E(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function SK(id){return String(id||'').replace(/[.$#[\]/]/g,'_');}
function SI(s){return String(s||'').replace(/[^a-zA-Z0-9]/g,'_');}
function ini2(n){return(n||'?').split(/\s+/).map(function(x){return x[0]||'';}).join('').toUpperCase().slice(0,2)||'?';}

/* ══ DATE RANGES ══ */
function getWB(d){var s=new Date(d);var dy=s.getDay();var df=dy===0?6:dy-1;s.setDate(s.getDate()-df);s.setHours(0,0,0,0);var e=new Date(s);e.setDate(e.getDate()+6);e.setHours(23,59,59,999);return{s:s,e:e};}
function getTodayR(){var s=new Date();s.setHours(0,0,0,0);var e=new Date();e.setHours(23,59,59,999);return{s:s,e:e};}
function getRangeFor(key){
  var now=new Date();
  if(key==='today')return getTodayR();
  if(key==='week')return getWB(now);
  if(key==='month')return{s:new Date(now.getFullYear(),now.getMonth(),1),e:new Date(now.getFullYear(),now.getMonth()+1,0,23,59,59,999)};
  if(key==='custom'){
    var fv=document.getElementById('reportFrom').value;var tv=document.getElementById('reportTo').value;
    var s=fv?new Date(fv):new Date(2020,0,1);s.setHours(0,0,0,0);
    var e=tv?new Date(tv):new Date(2099,0,1);e.setHours(23,59,59,999);return{s:s,e:e};
  }
  return{s:new Date(2020,0,1),e:new Date(2099,0,1)};
}

/* ══ PAYMENT HELPERS ══ */
function gPays(id){var k=SK(id);var p=AP[k];if(!p||typeof p!=='object')return[];return Object.entries(p).map(function(e){return Object.assign({},e[1],{_key:e[0]});});}
function gPaid(id){return gPays(id).reduce(function(s,p){return s+(Number(p.amount)||0);},0);}
function allPays(){var r=[];Object.entries(AP).forEach(function(e){var ps=e[1];if(ps&&typeof ps==='object'){Object.entries(ps).forEach(function(e2){if(e2[1]&&typeof e2[1]==='object')r.push(Object.assign({},e2[1],{_key:e2[0],_ck:e[0]}));});}});return r;}
function paysInRange(s,e){return allPays().filter(function(p){var d=new Date(p.date);return!isNaN(d.getTime())&&d>=s&&d<=e;});}
function getTodayTotal(){var r=getTodayR();return paysInRange(r.s,r.e).reduce(function(t,p){return t+(Number(p.amount)||0);},0);}
function isTodayPaid(id){var ts=fmtISO(new Date());return gPays(id).some(function(p){return p.date===ts;});}
function getTodayPay(id){var ts=fmtISO(new Date());return gPays(id).filter(function(p){return p.date===ts;}).reduce(function(s,p){return s+(Number(p.amount)||0);},0);}
function getLastPayDate(id){var ps=gPays(id);if(!ps.length)return null;return ps.sort(function(a,b){return new Date(b.date)-new Date(a.date);})[0].date;}
function getCust(id){return AC[SK(id)]||null;}
function isOD(c){
  if(c.isOverdue)return true;var pd=gPaid(c.customerId);var t=c.totalPayable||0;
  if(t<=0||pd>=t)return false;var ps=gPays(c.customerId);
  var last=c.date?new Date(c.date):null;
  if(c.savedAt&&(!last||new Date(c.savedAt)>last))last=new Date(c.savedAt);
  ps.forEach(function(x){var d=new Date(x.date);if(!last||d>last)last=d;});
  if(!last)return false;return Math.floor((Date.now()-last.getTime())/864e5)>=30;
}

/* ══ FIREBASE LISTENERS ══ */
db.ref('settings/prefixes').on('value',function(s){PX=Array.isArray(s.val())&&s.val().length?s.val():[];if(dataReady)uAll();},function(){PX=[];});
db.ref('customers').on('value',function(s){AC=s.val()||{};checkLoaded();if(dataReady)uAll();},function(){AC={};checkLoaded();});
db.ref('payments').on('value',function(s){AP=s.val()||{};checkLoaded();if(dataReady)uAll();},function(){AP={};checkLoaded();});
db.ref('expenses').on('value',function(s){EX=s.val()?Object.values(s.val()):[];if(dataReady&&document.getElementById('chartExp'))updateExpensesChart();});
db.ref('deletedPayments').on('value',function(s){
  var raw=s.val()||{};DL=Object.values(raw);var nc=DL.length;
  var cnt=document.getElementById('delCount');
  if(cnt){if(nc>0){cnt.textContent=nc;cnt.classList.add('show');}else{cnt.classList.remove('show');}}
  prevDelCount=nc;if(dataReady)renderDelLog();
});
db.ref('onlineUsers').on('value',function(s){renderOnlineUsers(s.val()||{});});

/* ══ ONLINE USERS ══ */
function markOnline(){
  var key=SK(CU.name);var ref=db.ref('onlineUsers/'+key);
  ref.set({name:CU.name,role:CU.role||'user',lastSeen:Date.now()});
  ref.onDisconnect().remove();
  setInterval(function(){ref.update({lastSeen:Date.now()});},30000);
}
function renderOnlineUsers(ou){
  var list=document.getElementById('onlineList'),cnt=document.getElementById('onlineCount');
  if(!list)return;var now=Date.now();
  var active=Object.values(ou).filter(function(u){return(now-(u.lastSeen||0))<120000;});
  cnt.textContent=active.length;
  if(!active.length){list.innerHTML='<div class="online-empty">No users online</div>';return;}
  list.innerHTML=active.map(function(u){
    var ago=Math.floor((now-(u.lastSeen||0))/1000);var agoStr=ago<60?ago+'s ago':Math.floor(ago/60)+'m ago';
    return'<div class="online-item"><div class="online-av">'+ini(u.name||'?')+'</div><div><div class="online-name">'+E(u.name||'?')+'</div><div class="online-time">'+E(u.role||'user')+' · '+agoStr+'</div></div></div>';
  }).join('');
}
function doLogout(){try{db.ref('onlineUsers/'+SK(CU.name)).remove();}catch(x){}localStorage.removeItem('srUser');window.location.href='login.html';}

/* ══ uAll ══ */
function uAll(){
  markOnline();initDateLabels();
  if(document.getElementById('stTotal'))updateStats();
  if(document.getElementById('cvToday'))updateCollStrips();
  if(document.getElementById('chartExp'))updateExpensesChart();
  if(document.getElementById('liveFeed'))renderLive();
  if(document.getElementById('locTabs'))renderLocTabs();
  if(document.getElementById('custGrid')){applyUrlParams();renderCust();}
  if(document.getElementById('reportStats'))buildReport();
  if(document.getElementById('delLogList'))renderDelLog();
  if(document.getElementById('chartTrend'))updateCharts();
}

/* ══ DATE LABELS ══ */
function setTxt(id,v){var el=document.getElementById(id);if(el)el.textContent=v;}
function initDateLabels(){
  var now=new Date();var tw=getWB(now);var ln=new Date(now);ln.setDate(ln.getDate()-7);var lw=getWB(ln);
  var ms=new Date(now.getFullYear(),now.getMonth(),1);var me=new Date(now.getFullYear(),now.getMonth()+1,0);
  setTxt('csToday',fmtD(fmtISO(now)));
  setTxt('csWeek',fmtDS(tw.s)+' – '+fmtDS(tw.e));
  setTxt('csLast',fmtDS(lw.s)+' – '+fmtDS(lw.e));
  setTxt('csMonth',fmtDS(ms)+' – '+fmtDS(me));
  setTxt('stDate',fmtD(fmtISO(now)));
  setTxt('reportDateLbl','Generated: '+fmtD(fmtISO(now)));
  var mp=document.getElementById('monthPicker');if(mp&&!mp.value)mp.value=now.getFullYear()+'-'+pad2(now.getMonth()+1);
}
initDateLabels();

/* ══ SIDEBAR & BOTTOM NAV ══ */
function tSB(){document.getElementById('sbMenu').classList.toggle('show');document.getElementById('sbOv').classList.toggle('show');document.body.style.overflow=document.getElementById('sbMenu').classList.contains('show')?'hidden':'';}
function setActiveBN(el){document.querySelectorAll('.bn-item').forEach(function(b){b.classList.remove('active');});if(el)el.classList.add('active');}

/* ══ TABS ══ */
function switchTab(name,el){
  document.querySelectorAll('.nav-tab').forEach(function(t){t.classList.remove('active');});
  if(el)el.classList.add('active');
  document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.toggle('active',p.id==='tab-'+name);});
  if(name==='dashboard')setTimeout(updateCharts,120);
  if(name==='customers'){curPage=1;renderLocTabs();renderCust();}
  if(name==='reports')buildReport();
  if(name==='dellog'){renderDelLog();document.getElementById('delCount').classList.remove('show');}
}
function onSrchTb(){
  var v=document.getElementById('srchTb').value;
  if(document.getElementById('custGrid')){
    var srch=document.getElementById('srch');if(srch)srch.value=v;curPage=1;renderCust();
  } else if(v){
    window.location.href='admin-customers.html?search='+encodeURIComponent(v);
  }
}

/* ══ STATS ══ */
function updateStats(){
  var cs=Object.values(AC);var paid=0,notPaid=0,overdue=0,completed=0;
  cs.forEach(function(c){var pd=gPaid(c.customerId);var t=c.totalPayable||0;if(t>0&&pd>=t)completed++;else if(isOD(c))overdue++;else if(isTodayPaid(c.customerId))paid++;else notPaid++;});
  document.getElementById('stTotal').textContent=cs.length;
  document.getElementById('stPaid').textContent=paid;
  document.getElementById('stNotPaid').textContent=notPaid;
  document.getElementById('stOverdue').textContent=overdue;
  document.getElementById('stCompleted').textContent=completed;
  document.getElementById('stTodayAmt').textContent=fmtM(getTodayTotal());
}

/* ══ COLLECTION STRIPS ══ */
function updateCollStrips(){
  var now=new Date();var tr=getTodayR();var tw=getWB(now);var ln=new Date(now);ln.setDate(ln.getDate()-7);var lw=getWB(ln);
  var ms=new Date(now.getFullYear(),now.getMonth(),1);var me=new Date(now.getFullYear(),now.getMonth()+1,0,23,59,59,999);
  document.getElementById('cvToday').textContent=fmtM(paysInRange(tr.s,tr.e).reduce(function(t,p){return t+(Number(p.amount)||0);},0));
  document.getElementById('cvWeek').textContent=fmtM(paysInRange(tw.s,tw.e).reduce(function(t,p){return t+(Number(p.amount)||0);},0));
  document.getElementById('cvLast').textContent=fmtM(paysInRange(lw.s,lw.e).reduce(function(t,p){return t+(Number(p.amount)||0);},0));
  document.getElementById('cvMonth').textContent=fmtM(paysInRange(ms,me).reduce(function(t,p){return t+(Number(p.amount)||0);},0));
  updateMonthPick();
}
function updateMonthPick(){var v=document.getElementById('monthPicker').value;if(!v)return;var parts=v.split('-');var y=Number(parts[0]);var m=Number(parts[1]);var s=new Date(y,m-1,1);var e=new Date(y,m,0,23,59,59,999);document.getElementById('monthPickVal').textContent=fmtM(paysInRange(s,e).reduce(function(t,p){return t+(Number(p.amount)||0);},0));}

/* ══ EXPENSES CHART ══ */
function updateExpensesChart(){
  var range=document.getElementById('expRange').value;
  var cr=document.getElementById('expCustomRow');cr.style.display=range==='custom'?'flex':'none';
  var labels=[],data=[],total=0,subTxt='';var now=new Date();
  if(range==='today'){
    var ts=fmtISO(now);var te=EX.filter(function(x){return x.date===ts;});total=te.reduce(function(t,x){return t+(Number(x.amount)||0);},0);
    var hours=Array(24).fill(0);te.forEach(function(x){var h=x.timestamp?new Date(x.timestamp).getHours():0;hours[h]+=(Number(x.amount)||0);});
    for(var i=0;i<24;i++){labels.push(i+':00');data.push(hours[i]);}subTxt='Today by hour';
  } else if(range==='custom'){
    var fv=document.getElementById('expFrom').value,tv=document.getElementById('expTo').value;
    if(!fv||!tv){document.getElementById('expTotal').textContent=fmtM(0);document.getElementById('expSub').textContent='Select date range';return;}
    var s=new Date(fv);s.setHours(0,0,0,0);var e=new Date(tv);e.setHours(23,59,59,999);
    var days=Math.max(1,Math.ceil((e-s)/864e5));
    for(var i=0;i<days;i++){var d=new Date(s);d.setDate(d.getDate()+i);var ds=fmtISO(d);var amt=EX.filter(function(x){return x.date===ds;}).reduce(function(t,x){return t+(Number(x.amount)||0);},0);labels.push(d.getDate()+' '+MO[d.getMonth()]);data.push(amt);total+=amt;}
    subTxt=fmtD(fv)+' – '+fmtD(tv);
  } else {
    var nDays=range==='30'?30:7;
    for(var i=nDays-1;i>=0;i--){var d=new Date(now);d.setDate(d.getDate()-i);var ds=fmtISO(d);var amt=EX.filter(function(x){return x.date===ds;}).reduce(function(t,x){return t+(Number(x.amount)||0);},0);labels.push(d.getDate()+' '+MO[d.getMonth()]);data.push(amt);total+=amt;}
    subTxt=range==='30'?'Last 30 Days':'Last 7 Days';
  }
  document.getElementById('expTotal').textContent=fmtM(total);document.getElementById('expSub').textContent=subTxt;
  if(charts['exp']){charts['exp'].destroy();delete charts['exp'];}
  var ctx=document.getElementById('chartExp').getContext('2d');
  var grad=ctx.createLinearGradient(0,0,0,180);grad.addColorStop(0,'rgba(244,63,94,.4)');grad.addColorStop(1,'rgba(244,63,94,.02)');
  charts['exp']=new Chart(ctx,{type:'line',data:{labels:labels,datasets:[{label:'Expenses',data:data,borderColor:'#f43f5e',backgroundColor:grad,borderWidth:2.5,pointBackgroundColor:'#f43f5e',pointRadius:3,fill:true,tension:.4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#0e1527',titleColor:'#e2e8f0',bodyColor:var_('--muted'),borderColor:'rgba(124,109,250,.2)',borderWidth:1,callbacks:{label:function(c){return' ₹'+Number(c.raw).toLocaleString('en-IN');}}}},
    scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#6b7a99',font:{size:9}}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#6b7a99',font:{size:9},callback:function(v){return'₹'+Number(v).toLocaleString('en-IN');}}}}}});
}
function var_(k){return getComputedStyle(document.documentElement).getPropertyValue(k).trim();}

/* ══ LIVE FEED ══ */
function renderLive(){
  var feed=document.getElementById('liveFeed');var ts=fmtISO(new Date());
  var tp=allPays().filter(function(p){return p.date===ts;}).sort(function(a,b){return(b.timestamp||0)-(a.timestamp||0);});
  document.getElementById('liveCount').textContent=tp.length;
  if(!tp.length){feed.innerHTML='<div class="live-empty">No payments today yet</div>';return;}
  feed.innerHTML=tp.slice(0,40).map(function(p){
    var c=getCust(p.customerId);var nm=c?c.name:(p.customerName||p.customerId||'?');
    var tm=p.timestamp?new Date(p.timestamp).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}):'';
    return'<div class="live-item"><div class="live-dot"></div><div style="flex:1;min-width:0"><div class="live-name">'+E(nm)+'</div><div class="live-meta">'+E(p.customerId||'')+(tm?' · '+tm:'')+(p.collectedBy?' · '+E(p.collectedBy):'')+'</div></div><div class="live-amt">'+fmtM(p.amount)+'</div></div>';
  }).join('');
}
/* ══ CHARTS ══ */
var LCOLS=['#7c6dfa','#22c55e','#f59e0b','#a78bfa','#f43f5e','#06b6d4','#f97316','#ec4899'];
function dChart(k){if(charts[k]){charts[k].destroy();delete charts[k];}}
var TT={backgroundColor:'#0e1527',titleColor:'#e2e8f0',bodyColor:'#6b7a99',borderColor:'rgba(124,109,250,.2)',borderWidth:1,padding:10,cornerRadius:8};
var GX={color:'rgba(255,255,255,.04)'};var TK={color:'#6b7a99',font:{size:10}};

function updateCharts(){buildTrend();buildLocChart();buildPieChart();buildLocStat();}

function buildTrend(){
  var days=parseInt(document.getElementById('trendDays').value)||7;var labels=[],data=[];var now=new Date();
  for(var i=days-1;i>=0;i--){var d=new Date(now);d.setDate(d.getDate()-i);d.setHours(0,0,0,0);var de=new Date(d);de.setHours(23,59,59,999);labels.push(d.getDate()+' '+MO[d.getMonth()]);data.push(paysInRange(d,de).reduce(function(t,p){return t+(Number(p.amount)||0);},0));}
  dChart('trend');
  var ctx=document.getElementById('chartTrend').getContext('2d');
  var grad=ctx.createLinearGradient(0,0,0,260);
  grad.addColorStop(0,'rgba(124,109,250,.7)');grad.addColorStop(1,'rgba(124,109,250,.05)');
  charts['trend']=new Chart(ctx,{type:'bar',
    data:{labels:labels,datasets:[{label:'₹',data:data,backgroundColor:grad,borderColor:'#7c6dfa',borderWidth:2,borderRadius:8}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:Object.assign({},TT,{callbacks:{label:function(c){return' ₹'+Number(c.raw).toLocaleString('en-IN');}}})},
      scales:{x:{grid:GX,ticks:TK},y:{grid:GX,ticks:{color:'#6b7a99',font:{size:10},callback:function(v){return'₹'+Number(v).toLocaleString('en-IN');}}}}}
  });
}

function buildLocChart(){
  var range=document.getElementById('locRange').value;
  var r=getRangeFor(range);var pays=paysInRange(r.s,r.e);
  var locs=PX.length?PX:['ALL'];var labels=[],data=[];
  locs.forEach(function(p){
    var total=0;
    pays.forEach(function(pay){
      if(!PX.length){total+=Number(pay.amount)||0;return;}
      var c=getCust(pay.customerId);
      if(c&&(c.customerId||'').split('-')[0]===p)total+=Number(pay.amount)||0;
    });
    labels.push(p);data.push(total);
  });
  dChart('loc');
  var ctx=document.getElementById('chartLoc').getContext('2d');
  charts['loc']=new Chart(ctx,{type:'bar',
    data:{labels:labels,datasets:[{label:'Collected',data:data,
      backgroundColor:labels.map(function(_,i){return LCOLS[i%LCOLS.length]+'55';}),
      borderColor:labels.map(function(_,i){return LCOLS[i%LCOLS.length];}),
      borderWidth:2,borderRadius:6}]},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',
      plugins:{legend:{display:false},tooltip:Object.assign({},TT,{callbacks:{label:function(c){return' ₹'+Number(c.raw).toLocaleString('en-IN');}}})},
      scales:{x:{grid:GX,ticks:{color:'#6b7a99',font:{size:10},callback:function(v){return'₹'+Number(v).toLocaleString('en-IN');}}},y:{grid:{display:false},ticks:{color:'#e2e8f0',font:{size:11,weight:'700'}}}}}
  });
}

function buildPieChart(){
  var cs=Object.values(AC);var paid=0,notPaid=0,overdue=0,completed=0;
  cs.forEach(function(c){
    var pd=gPaid(c.customerId);var t=c.totalPayable||0;
    if(t>0&&pd>=t)completed++;
    else if(isOD(c))overdue++;
    else if(isTodayPaid(c.customerId))paid++;
    else notPaid++;
  });
  var labels=['Paid Today','Not Paid','Overdue','Completed'];
  var data=[paid,notPaid,overdue,completed];
  var colors=['#22c55e','#f59e0b','#f43f5e','#7c6dfa'];
  dChart('pie');
  var ctx=document.getElementById('chartPie').getContext('2d');
  charts['pie']=new Chart(ctx,{type:'doughnut',
    data:{labels:labels,datasets:[{data:data,backgroundColor:colors.map(function(c){return c+'88';}),borderColor:colors,borderWidth:2.5,hoverOffset:10}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'60%',
      plugins:{legend:{display:false},tooltip:Object.assign({},TT,{callbacks:{label:function(c){return' '+c.label+': '+c.raw;}}})}}
  });
  document.getElementById('pieLegend').innerHTML=labels.map(function(l,i){
    return'<div class="leg-item"><div class="leg-dot" style="background:'+colors[i]+'"></div><span>'+l+': <b style="color:'+colors[i]+'">'+data[i]+'</b></span></div>';
  }).join('');
}

function buildLocStat(){
  var range=document.getElementById('locStatRange').value;
  var r=getRangeFor(range);
  var locs=PX.length?PX:['ALL'];
  var paidData=[],notData=[];
  locs.forEach(function(p){
    var pc=0,nc=0;
    Object.values(AC).forEach(function(c){
      var lpfx=(c.customerId||'').split('-')[0];
      if(PX.length&&lpfx!==p)return;
      var pd=gPaid(c.customerId);var t=c.totalPayable||0;
      if(t>0&&pd>=t)return;
      var has=gPays(c.customerId).some(function(pay){var d=new Date(pay.date);return d>=r.s&&d<=r.e;});
      if(has)pc++;else nc++;
    });
    paidData.push(pc);notData.push(nc);
  });
  dChart('locstat');
  var ctx=document.getElementById('chartLocStat').getContext('2d');
  charts['locstat']=new Chart(ctx,{type:'bar',
    data:{labels:locs,datasets:[
      {label:'Paid',data:paidData,backgroundColor:'rgba(34,197,94,.55)',borderColor:'#22c55e',borderWidth:2,borderRadius:6},
      {label:'Not Paid',data:notData,backgroundColor:'rgba(244,63,94,.45)',borderColor:'#f43f5e',borderWidth:2,borderRadius:6}
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#e2e8f0',font:{size:11,weight:'700'},boxWidth:12},position:'top'},tooltip:TT},
      scales:{x:{grid:GX,ticks:{color:'#e2e8f0',font:{size:11,weight:'700'}}},y:{grid:GX,ticks:{color:'#6b7a99',font:{size:10},stepSize:1}}}}
  });
}

/* ══ GOTO CUSTOMERS ══ */
function goCust(f){window.location.href='admin-customers.html?filter='+f;}

/* ══ URL PARAMS (customers page) ══ */
function applyUrlParams(){
  var params=new URLSearchParams(window.location.search);
  var f=params.get('filter');var q=params.get('search');
  if(f&&f!=='all'){
    aFilter=f;
    document.querySelectorAll('.ftab').forEach(function(t){t.classList.toggle('active',t.dataset.f===f);});
  }
  if(q){
    var srchEl=document.getElementById('srch');if(srchEl)srchEl.value=q;
    var srchTbEl=document.getElementById('srchTb');if(srchTbEl)srchTbEl.value=q;
  }
}

/* ══ LOCATION TABS ══ */
function renderLocTabs(){
  var wrap=document.getElementById('locTabs');wrap.innerHTML='';
  var allBtn=document.createElement('button');
  allBtn.className='loc-tab'+(aLoc===''?' active':'');
  allBtn.innerHTML='All <span class="tc">'+Object.keys(AC).length+'</span>';
  allBtn.onclick=function(){aLoc='';curPage=1;renderLocTabs();renderCust();};
  wrap.appendChild(allBtn);
  PX.forEach(function(p){
    var cnt=Object.values(AC).filter(function(c){return(c.customerId||'').split('-')[0]===p;}).length;
    var t=document.createElement('button');
    t.className='loc-tab'+(aLoc===p?' active':'');
    t.innerHTML=E(p)+' <span class="tc">'+cnt+'</span>';
    t.onclick=function(){aLoc=p;curPage=1;renderLocTabs();renderCust();};
    wrap.appendChild(t);
  });
}

/* ══ FILTER ══ */
function setF(f){
  aFilter=f;curPage=1;
  document.querySelectorAll('.ftab').forEach(function(t){t.classList.toggle('active',t.dataset.f===f);});
  renderCust();
}
function onSrch(){curPage=1;renderCust();}

/* ══ FILTER & SORT ══ */
function filterAndSortCusts(){
  var q=(document.getElementById('srch').value||'').trim().toLowerCase();
  var cs=Object.values(AC);
  if(aLoc)cs=cs.filter(function(c){return(c.customerId||'').split('-')[0]===aLoc;});
  cs=cs.map(function(c){
    var pd=gPaid(c.customerId);var t=c.totalPayable||0;
    var pct=t>0?Math.min(100,Math.round((pd/t)*100)):0;
    var dn=t>0&&pd>=t;var ov=!dn&&isOD(c);var tp=isTodayPaid(c.customerId);
    var ta=getTodayPay(c.customerId);
    var st='pending';
    if(dn)st='completed';else if(ov)st='overdue';else if(tp)st='paid';
    return Object.assign({},c,{_pd:pd,_pn:Math.max(0,t-pd),_pct:pct,_dn:dn,_ov:ov,_tp:tp,_ta:ta,_st:st});
  });
  if(aFilter==='paid')cs=cs.filter(function(c){return c._tp&&!c._dn;});
  else if(aFilter==='notpaid')cs=cs.filter(function(c){return!c._tp&&!c._dn&&!c._ov;});
  else if(aFilter==='overdue')cs=cs.filter(function(c){return c._ov;});
  else if(aFilter==='completed')cs=cs.filter(function(c){return c._dn;});
  else if(aFilter==='done')cs=cs.filter(function(c){return c._pct>=100;});
  if(q)cs=cs.filter(function(c){
    return(c.name||'').toLowerCase().includes(q)||(c.customerId||'').toLowerCase().includes(q)||(c.phone||'').includes(q);
  });
  cs.sort(function(a,b){return(parseInt((b.customerId||'').split('-').pop())||0)-(parseInt((a.customerId||'').split('-').pop())||0);});
  return cs;
}

/* ══ RENDER CUSTOMERS ══ */
function renderCust(){
  var grid=document.getElementById('custGrid');
  var lcEl=document.getElementById('listCount');
  var pagWrap=document.getElementById('pagWrap');
  if(!Object.keys(AC).length){
    lcEl.style.display='none';pagWrap.style.display='none';
    grid.innerHTML='<div class="nd" style="grid-column:1/-1"><div class="nd-icon"><i class="fas fa-inbox"></i></div><div class="nd-txt">No customers in database</div></div>';
    return;
  }
  var cs=filterAndSortCusts();
  if(!cs.length){
    lcEl.style.display='none';pagWrap.style.display='none';
    grid.innerHTML='<div class="nd" style="grid-column:1/-1"><div class="nd-icon"><i class="fas fa-search"></i></div><div class="nd-txt">No customers match this filter</div></div>';
    return;
  }
  var totalPages=Math.ceil(cs.length/PAGE_SIZE);
  if(curPage>totalPages)curPage=totalPages;if(curPage<1)curPage=1;
  var start=(curPage-1)*PAGE_SIZE;var pageCs=cs.slice(start,start+PAGE_SIZE);
  lcEl.style.display='block';
  lcEl.innerHTML='Showing <b>'+(start+1)+'–'+Math.min(start+PAGE_SIZE,cs.length)+'</b> of <b>'+cs.length+'</b> customers';
  grid.innerHTML=pageCs.map(function(c){
    var sid=SI(c.customerId);
    var bc=c._pct>=100?'green':c._pct>=50?'orang':'red';
    var pcc=c._pct>=100?'var(--green)':c._pct>=50?'var(--yellow)':'var(--red)';
    var badgeCls='cbx',badgeTxt='Pending';
    if(c._dn){badgeCls='cbb';badgeTxt='Done';}
    else if(c._ov){badgeCls='cbr';badgeTxt='Overdue';}
    else if(c._tp){badgeCls='cbg';badgeTxt='Paid';}
    var stCls=c._dn?'st-completed':c._ov?'st-overdue':c._tp?'st-paid':'st-pending';
    var avCls=c._dn?'blue':c._ov?'red':c._tp?'green':'warn';
    var sd=c.date?fmtD(c.date):(c.savedAt?fmtD(new Date(c.savedAt).toISOString().split('T')[0]):'—');
    var ps=gPays(c.customerId).sort(function(a,b){return new Date(b.date)-new Date(a.date);});
    var ptl=(c.paymentType||'monthly')==='weekly'?'Weekly':'Monthly';
    var loanNum=c.loanNumber||1;
    var loanBadge=loanNum>1?'<span style="background:rgba(167,139,250,.15);color:var(--purple);border:1px solid rgba(167,139,250,.3);border-radius:20px;font-size:9px;font-weight:900;padding:2px 7px;margin-left:4px">Loan:'+String(loanNum).padStart(2,'0')+'</span>':'';
    var gridCols=c._dn?'grid-template-columns:1fr 1fr 1fr':'grid-template-columns:1fr 1fr 1fr 1fr';
    return(
      '<div class="cc '+stCls+'" id="cc-'+sid+'">'+
        '<div class="cc-strip"></div>'+
        '<div class="cc-head">'+
          '<div class="cc-av '+avCls+'">'+ini2(c.name)+'</div>'+
          '<div class="cc-head-mid">'+
            '<div class="cc-name">'+E(c.name||'—')+loanBadge+'</div>'+
            '<div class="cc-id">'+E(c.customerId)+' · '+ptl+'</div>'+
          '</div>'+
          '<span class="cc-badge '+badgeCls+'">'+badgeTxt+'</span>'+
        '</div>'+
        '<div class="cc-body">'+
          '<div class="cc-start"><i class="fas fa-calendar-alt" style="color:var(--accent);margin-right:4px"></i>Started: '+sd+'</div>'+
          '<div class="cc-prog">'+
            '<div class="cc-pr"><span class="cc-pr-l">Paid</span><span class="cc-pr-v" style="color:var(--green)">'+fmtM(c._pd)+'</span></div>'+
            '<div class="cc-pr"><span class="cc-pr-l">Pending</span><span class="cc-pr-v" style="color:'+(c._pn>0?'var(--yellow)':'var(--green)')+'">'+fmtM(c._pn)+'</span></div>'+
            '<div class="pbw"><div class="pb '+bc+'" style="width:'+c._pct+'%"></div></div>'+
            '<div class="pbp" style="color:'+pcc+'">'+c._pct+'% · '+fmtM(c._pd)+' of '+fmtM(c.totalPayable||0)+'</div>'+
            (c._ta>0?'<div class="cc-today">Today: <b>'+fmtM(c._ta)+'</b></div>':'')+
          '</div>'+
        '</div>'+
        '<div class="cc-acts" style="'+gridCols+'">'+
          (!c._dn?'<button class="cc-act pay" onclick="openPay(\''+E(c.customerId)+'\','+c._pn+')"><i class="fas fa-rupee-sign"></i> Pay</button>':'')+
          '<button class="cc-act det" onclick="openDet(\''+E(c.customerId)+'\')"><i class="fas fa-info-circle"></i> Info</button>'+
          '<button class="cc-act call" onclick="openCall(this)" data-name="'+E(c.name||'')+'" data-phone="'+E(c.phone||'')+'"><i class="fas fa-phone-alt"></i> Call</button>'+
          (c._dn
            ?'<button class="cc-act newloan" onclick="openNewLoan(\''+E(c.customerId)+'\')"><i class="fas fa-plus"></i> New Loan</button>'
            :c._ov
              ?'<button class="cc-act clr" onclick="rmOD(\''+E(c.customerId)+'\')"><i class="fas fa-check"></i> Clear OD</button>'
              :'<button class="cc-act od" onclick="openOD(\''+E(c.customerId)+'\')"><i class="fas fa-exclamation"></i> OD</button>')+
        '</div>'+
        '<button onclick="tH(\''+sid+'\')" style="width:calc(100% - 22px);margin:0 11px 10px;border-radius:10px;border:1px solid rgba(124,109,250,.2);background:rgba(124,109,250,.07);color:var(--accent);padding:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif;display:flex;align-items:center;justify-content:center;gap:5px">'+
          '<i class="fas fa-history"></i> Payment History ('+ps.length+')'+
        '</button>'+
        '<div class="cc-hist" id="h-'+sid+'">'+
          '<div class="hist-title"><i class="fas fa-list"></i> Payment History</div>'+
          (ps.length===0?'<div style="text-align:center;color:var(--muted);font-size:11px;padding:10px">No payments yet</div>':
            ps.map(function(p){
              return(
                '<div class="hist-item">'+
                  '<div>'+
                    '<div class="hist-date">'+fmtD(p.date)+'</div>'+
                    '<div class="hist-by">'+(p.timestamp?new Date(p.timestamp).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}):'')+' · '+E(p.collectedBy||'—')+'</div>'+
                  '</div>'+
                  '<div class="hist-r">'+
                    '<span class="hist-amt">'+fmtM(p.amount)+'</span>'+
                    '<button class="hist-del" onclick="openDelPay(\''+E(c.customerId)+'\',\''+E(p._key)+'\',\''+p.date+'\','+p.amount+')"><i class="fas fa-trash"></i></button>'+
                  '</div>'+
                '</div>'
              );
            }).join('')
          )+
          '<button class="btn bg2 bsm bf" style="margin-top:6px" onclick="tH(\''+sid+'\')">✕ Close</button>'+
        '</div>'+
      '</div>'
    );
  }).join('');
  renderPagination(totalPages);
}

function renderPagination(totalPages){
  var pagWrap=document.getElementById('pagWrap');
  if(totalPages<=1){pagWrap.style.display='none';return;}
  pagWrap.style.display='flex';
  var html='<button class="pag-btn" onclick="goPage('+(curPage-1)+')" '+(curPage<=1?'disabled':'')+'>◀</button>';
  html+='<div class="pag-pages" id="pagPages">';
  for(var i=1;i<=totalPages;i++){html+='<button class="pag-btn'+(i===curPage?' active':'')+'" onclick="goPage('+i+')">'+i+'</button>';}
  html+='</div>';
  html+='<button class="pag-btn" onclick="goPage('+(curPage+1)+')" '+(curPage>=totalPages?'disabled':'')+'>▶</button>';
  pagWrap.innerHTML=html;
  setTimeout(function(){var pp=document.getElementById('pagPages');var active=pp&&pp.querySelector('.pag-btn.active');if(active)active.scrollIntoView({inline:'center',behavior:'smooth'});},50);
}

function goPage(p){
  var cs=filterAndSortCusts();var total=Math.ceil(cs.length/PAGE_SIZE);
  if(p<1||p>total)return;curPage=p;renderCust();
  document.getElementById('custGrid').scrollIntoView({behavior:'smooth',block:'start'});
}

function tH(sid){
  var h=document.getElementById('h-'+sid);if(!h)return;
  h.classList.toggle('show');
  if(h.classList.contains('show'))setTimeout(function(){h.scrollIntoView({behavior:'smooth',block:'nearest'});},100);
}

/* ══ CALL ══ */
function openCall(btn){
  var nm=btn.getAttribute('data-name')||'Unknown';var ph=btn.getAttribute('data-phone')||'';
  cpPh=ph;document.getElementById('callName').textContent=nm;
  document.getElementById('callNum').textContent=ph||'No phone number';
  document.getElementById('callLink').href='tel:'+ph;oM('callM');
}
function cpPhone(){
  if(!cpPh)return;
  navigator.clipboard.writeText(cpPh).then(function(){sT('📋 Copied!');}).catch(function(){
    var ta=document.createElement('textarea');ta.value=cpPh;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);sT('📋 Copied!');
  });
}

/* ══ PAY ══ */
function openPay(id,pend){
  apC=id;apPend=Number(pend)||0;var c=getCust(id);
  document.getElementById('payInfo').textContent=(c?c.name:id)+' — '+id;
  document.getElementById('payDt').value=fmtISO(new Date());
  document.getElementById('payAmt').value='';
  var inst=c&&c.installmentAmount?Number(c.installmentAmount):0;
  var html='';
  if(inst>0)html+='<button class="qa-btn" onclick="qaSet('+inst+',this)">₹'+Number(inst).toLocaleString('en-IN')+' Inst</button>';
  html+='<button class="qa-btn" onclick="qaSet(500,this)">₹500</button>';
  html+='<button class="qa-btn" onclick="qaSet(1000,this)">₹1K</button>';
  html+='<button class="qa-btn" onclick="qaSet(2000,this)">₹2K</button>';
  if(apPend>0&&apPend!==inst)html+='<button class="qa-btn pend" onclick="qaSet('+apPend+',this)">₹'+Number(apPend).toLocaleString('en-IN')+' Full</button>';
  document.getElementById('qaRow').innerHTML=html;
  oM('payM');setTimeout(function(){document.getElementById('payAmt').focus();},200);
}
function qaSet(v,el){
  document.getElementById('payAmt').value=v;
  document.querySelectorAll('.qa-btn').forEach(function(b){b.classList.remove('active');});el.classList.add('active');
}
function savePay(){
  if(!apC)return;var a=Number(document.getElementById('payAmt').value);var d=document.getElementById('payDt').value;
  if(!a||a<=0){sT('⚠️ Enter valid amount');return;}if(!d){sT('⚠️ Select date');return;}
  var c=getCust(apC);var savedCid=apC;
  db.ref('payments/'+SK(apC)).push({customerId:apC,customerName:c?c.name:'',amount:a,date:d,timestamp:Date.now(),collectedBy:CU.name})
    .then(function(){cM('payM');showPayAnim(a,savedCid);apC=null;sT('💰 Payment added!');})
    .catch(function(){sT('⚠️ Failed, try again');});
}

/* ══ DELETE PAYMENT ══ */
function openDelPay(id,key,date,amt){
  dpCid=id;dpKey=key;var c=getCust(id);
  document.getElementById('delPayInfo').textContent='Delete '+fmtM(amt)+' paid on '+fmtD(date)+' for '+(c?c.name:id)+'?';
  oM('delPayM');
}
function confirmDelPay(){
  if(!dpCid||!dpKey)return;
  var ref=db.ref('payments/'+SK(dpCid)+'/'+dpKey);
  ref.once('value').then(function(snap){
    var p=snap.val();if(!p){cM('delPayM');return Promise.resolve();}
    var log={customerId:dpCid,customerName:(getCust(dpCid)||{}).name||dpCid,amount:p.amount,date:p.date,originalTimestamp:p.timestamp||null,collectedBy:p.collectedBy||'—',deletedBy:CU.name,deletedByRole:CU.role||'admin',deletedAt:Date.now()};
    return ref.remove().then(function(){return db.ref('deletedPayments').push(log);});
  }).then(function(){cM('delPayM');dpCid=null;dpKey=null;sT('🗑 Deleted & logged!');})
  .catch(function(){sT('⚠️ Failed');});
}

/* ══ OVERDUE ══ */
function openOD(id){odCid=id;var c=getCust(id);document.getElementById('odInfo').textContent='Mark "'+(c?c.name:id)+'" ('+id+') as overdue?';oM('odM');}
function confirmOD(){if(!odCid)return;db.ref('customers/'+SK(odCid)).update({isOverdue:true,overdueAt:Date.now()}).then(function(){cM('odM');odCid=null;sT('🔴 Marked Overdue');}).catch(function(){sT('⚠️ Failed');});}
function rmOD(id){db.ref('customers/'+SK(id)).update({isOverdue:false,overdueAt:null}).then(function(){sT('✅ Overdue Cleared');}).catch(function(){sT('⚠️ Failed');});}

/* ══ DETAIL MODAL ══ */
function openDet(id){
  detCid=id;var c=getCust(id);if(!c)return;
  var pd=gPaid(id);var t=c.totalPayable||0;var pn=Math.max(0,t-pd);var pct=t>0?Math.min(100,Math.round((pd/t)*100)):0;
  var sd=c.date?fmtD(c.date):(c.savedAt?fmtD(new Date(c.savedAt).toISOString().split('T')[0]):'—');
  document.getElementById('detTitle').textContent=c.name||id;
  document.getElementById('detContent').innerHTML=
    '<div class="det-grid">'+
      '<div class="det-item"><div class="dl">ID</div><div class="dv" style="color:var(--accent)">'+E(id)+'</div><button class="cpb" onclick="cpT(\''+E(id)+'\',this)"><i class="fas fa-copy"></i></button></div>'+
      '<div class="det-item"><div class="dl">Started</div><div class="dv">'+sd+'</div></div>'+
      '<div class="det-item"><div class="dl">Name</div><div class="dv">'+E(c.name||'—')+'</div><button class="cpb" onclick="cpT(\''+E(c.name||'')+'\',this)"><i class="fas fa-copy"></i></button></div>'+
      '<div class="det-item"><div class="dl">Parent</div><div class="dv">'+E(c.parentName||'—')+'</div></div>'+
      '<div class="det-item"><div class="dl">Phone</div><div class="dv"><a href="tel:'+E(c.phone||'')+'" style="color:var(--green);text-decoration:none;font-weight:700">'+E(c.phone||'—')+'</a></div><button class="cpb" onclick="cpT(\''+E(c.phone||'')+'\',this)"><i class="fas fa-copy"></i></button></div>'+
      '<div class="det-item"><div class="dl">Aadhar</div><div class="dv">'+E(c.aadhar||'—')+'</div><button class="cpb" onclick="cpT(\''+E(c.aadhar||'')+'\',this)"><i class="fas fa-copy"></i></button></div>'+
      '<div class="det-item full"><div class="dl">Address</div><div class="dv">'+E([c.address,c.city,c.state].filter(Boolean).join(', ')||'—')+'</div></div>'+
    '</div>'+
    '<div class="dsec"><div class="dsec-t" style="color:var(--accent)"><i class="fas fa-rupee-sign"></i> Loan Details</div>'+
      '<div class="dsr"><span class="dl2">Loan Amount</span><span class="dv2">'+fmtM(c.loanAmount)+'</span></div>'+
      '<div class="dsr"><span class="dl2">Commission</span><span class="dv2" style="color:var(--red)">- '+fmtM(c.commissionFee||0)+'</span></div>'+
      '<div class="dsr"><span class="dl2">Customer Receives</span><span class="dv2" style="color:var(--green)">'+fmtM(c.customerReceives||0)+'</span></div>'+
      '<div class="dsr"><span class="dl2">Interest ('+(c.interestRate||0)+'%)</span><span class="dv2">'+fmtM(c.interestAmount||0)+'</span></div>'+
      '<div class="dsr"><span class="dl2">Total Payable</span><span class="dv2" style="color:var(--accent);font-size:15px">'+fmtM(t)+'</span></div>'+
    '</div>'+
    '<div class="dsec"><div class="dsec-t" style="color:var(--green)"><i class="fas fa-check-circle"></i> Payment Status</div>'+
      '<div class="dsr"><span class="dl2">Total Paid</span><span class="dv2" style="color:var(--green)">'+fmtM(pd)+'</span></div>'+
      '<div class="dsr"><span class="dl2">Remaining</span><span class="dv2" style="color:var(--yellow)">'+fmtM(pn)+'</span></div>'+
      '<div class="dsr"><span class="dl2">Progress</span><span class="dv2" style="color:'+(pct>=100?'var(--green)':pct>=50?'var(--yellow)':'var(--red)')+'">'+pct+'%</span></div>'+
      '<div class="dsr"><span class="dl2">Last Payment</span><span class="dv2">'+fmtD(getLastPayDate(id))+'</span></div>'+
      '<div style="margin-top:8px"><div class="pbw" style="height:8px;border-radius:4px"><div class="pb '+(pct>=100?'green':pct>=50?'orang':'red')+'" style="width:'+pct+'%;border-radius:4px"></div></div></div>'+
    '</div>'+
    '<div class="dsec"><div class="dsec-t" style="color:var(--purple)"><i class="fas fa-calendar-alt"></i> Payment Plan</div>'+
      '<div class="dsr"><span class="dl2">Type</span><span class="dv2">'+((c.paymentType||'monthly').charAt(0).toUpperCase()+(c.paymentType||'monthly').slice(1))+'</span></div>'+
      '<div class="dsr"><span class="dl2">Installment</span><span class="dv2">'+fmtM(c.installmentAmount||0)+'</span></div>'+
      '<div class="dsr"><span class="dl2">Total Installments</span><span class="dv2">'+(c.numberOfInstallments||0)+'</span></div>'+
      '<div class="dsr"><span class="dl2">Paid Installments</span><span class="dv2" style="color:var(--green)">'+((c.installmentAmount||0)>0?Math.floor(pd/(c.installmentAmount||1)):0)+'</span></div>'+
      '<div class="dsr"><span class="dl2">Remaining</span><span class="dv2" style="color:var(--yellow)">'+((c.installmentAmount||0)>0?Math.max(0,Math.ceil(pn/(c.installmentAmount||1))):0)+'</span></div>'+
    '</div>';
  oM('detM');
}

/* ══ EDIT ══ */
function openEditFromDet(){
  if(!detCid)return;editCid=detCid;var c=getCust(editCid);if(!c)return;
  var parts=(c.customerId||'').split('-');
  document.getElementById('ecPfx').value=parts[0]||'';document.getElementById('ecNum').value=parts[parts.length-1]||'';
  updateEcIdPreview();document.getElementById('ecN').value=c.name||'';document.getElementById('ecPN').value=c.parentName||'';
  document.getElementById('ecPh').value=c.phone||'';document.getElementById('ecAd').value=c.aadhar||'';
  document.getElementById('ecAdr').value=c.address||'';document.getElementById('ecSt').value=c.state||'';
  document.getElementById('ecCt').value=c.city||'';document.getElementById('ecLA').value=c.loanAmount||'';
  document.getElementById('ecIR').value=c.interestRate||'';document.getElementById('ecInA').value=c.installmentAmount||'';
  document.getElementById('ecPT').value=c.paymentType||'monthly';
  cM('detM');oM('editM');
}
(function(){var el=document.getElementById('ecPfx');if(el)el.addEventListener('input',updateEcIdPreview);el=document.getElementById('ecNum');if(el)el.addEventListener('input',updateEcIdPreview);})();
function updateEcIdPreview(){
  var pfx=(document.getElementById('ecPfx').value||'').trim().toUpperCase();
  var num=(document.getElementById('ecNum').value||'').trim();
  var c=editCid?getCust(editCid):null;
  var mid=c?(c.customerId||'').split('-').slice(1,-1).join('-'):'';
  var newId=pfx;if(mid)newId+='-'+mid;if(num)newId+='-'+num;
  document.getElementById('ecIdPreview').textContent=newId||'—';
}
function saveEdit(){
  if(!editCid)return;
  var la=Number(document.getElementById('ecLA').value)||0;var ir=Number(document.getElementById('ecIR').value)||0;
  var ia=Number(document.getElementById('ecInA').value)||0;
  var cm=Math.floor(la/5000)*100;var rc=Math.max(0,la-cm);var int_amt=(la*ir)/100;var tp=la+int_amt;var ni=ia>0?Math.ceil(tp/ia):0;
  var pfx=(document.getElementById('ecPfx').value||'').trim().toUpperCase();var num=(document.getElementById('ecNum').value||'').trim();
  var c=getCust(editCid);var mid=c?(c.customerId||'').split('-').slice(1,-1).join('-'):'';
  var newId=pfx;if(mid)newId+='-'+mid;if(num)newId+='-'+num;
  var updates={name:document.getElementById('ecN').value.trim(),parentName:document.getElementById('ecPN').value.trim(),phone:document.getElementById('ecPh').value.trim(),aadhar:document.getElementById('ecAd').value.trim(),address:document.getElementById('ecAdr').value.trim(),state:document.getElementById('ecSt').value.trim(),city:document.getElementById('ecCt').value.trim(),loanAmount:la,interestRate:ir,installmentAmount:ia,paymentType:document.getElementById('ecPT').value,commissionFee:cm,customerReceives:rc,interestAmount:int_amt,totalPayable:tp,numberOfInstallments:ni,editedAt:Date.now()};
  if(newId&&newId!==editCid)updates.customerId=newId;
  var saveKey=newId&&newId!==editCid?SK(newId):SK(editCid);
  var promises=[db.ref('customers/'+saveKey).update(updates)];
  if(newId&&newId!==editCid&&saveKey!==SK(editCid)){
    var oldPays=gPays(editCid);
    oldPays.forEach(function(p){var pp=Object.assign({},p);delete pp._key;promises.push(db.ref('payments/'+saveKey).push(pp));promises.push(db.ref('payments/'+SK(editCid)+'/'+p._key).remove());});
    promises.push(db.ref('customers/'+SK(editCid)).remove());
  }
  Promise.all(promises).then(function(){cM('editM');editCid=null;sT('✅ Customer updated!');}).catch(function(){sT('⚠️ Failed');});
}

/* ══ DELETE CUSTOMER ══ */
function openDeleteCustomer(){delCustCid=editCid;document.getElementById('delCustPin').value='';document.getElementById('delCustPinErr').style.display='none';oM('delCustM');}
function confirmDeleteCustomer(){
  var pin=(document.getElementById('delCustPin').value||'').trim();
  if(pin!=='2026'){document.getElementById('delCustPinErr').style.display='block';document.getElementById('delCustPin').value='';return;}
  if(!delCustCid)return;var k=SK(delCustCid);
  Promise.all([db.ref('customers/'+k).remove(),db.ref('payments/'+k).remove()])
    .then(function(){cM('delCustM');cM('editM');delCustCid=null;editCid=null;sT('🗑 Customer deleted!');})
    .catch(function(){sT('⚠️ Delete failed');});
}

/* ══ NEW LOAN ══ */
function openNewLoan(id){
  nlCustId=id;var c=getCust(id);if(!c)return;
  var baseId=id.replace(/-L\d+$/,'');
  var loanCount=Object.values(AC).filter(function(cx){return(cx.customerId||'').replace(/-L\d+$/,'')===baseId;}).length;
  document.getElementById('nlCustName').textContent=c.name||id;document.getElementById('nlCustId').textContent=id;
  document.getElementById('nlLoanNum').textContent=String(loanCount+1).padStart(2,'0');
  document.getElementById('nlPrefix').value=(baseId.split('-')[0]||'SR');
  document.getElementById('nlAmt').value='';document.getElementById('nlIR').value='20';
  document.getElementById('nlInstAmt').value=c.installmentAmount||'';
  document.getElementById('nlPT').value=c.paymentType||'monthly';
  document.getElementById('nlDate').value=fmtISO(new Date());
  document.getElementById('nlCalc').style.display='none';
  updateNlIdPreview();oM('newLoanM');
}
(function(){var el=document.getElementById('nlPrefix');if(el)el.addEventListener('input',updateNlIdPreview);})();
function updateNlIdPreview(){
  if(!nlCustId)return;var baseId=nlCustId.replace(/-L\d+$/,'');
  var loanCount=Object.values(AC).filter(function(cx){return(cx.customerId||'').replace(/-L\d+$/,'')===baseId;}).length;
  var pfx=(document.getElementById('nlPrefix').value||'').trim().toUpperCase()||baseId.split('-')[0];
  var numPart=baseId.split('-').slice(1).join('-');
  var newId=numPart?pfx+'-'+numPart+'-L'+String(loanCount+1).padStart(2,'0'):pfx+'-L'+String(loanCount+1).padStart(2,'0');
  document.getElementById('nlIdPreview').textContent=newId;
  document.getElementById('nlLoanNum').textContent=String(loanCount+1).padStart(2,'0');
}
function nlQAmt(v){document.getElementById('nlAmt').value=v;calcNL();}
function calcNL(){
  var la=Number(document.getElementById('nlAmt').value)||0;var ir=Number(document.getElementById('nlIR').value)||0;var ia=Number(document.getElementById('nlInstAmt').value)||0;
  if(!la){document.getElementById('nlCalc').style.display='none';return;}
  var cm=Math.floor(la/5000)*100;var rc=Math.max(0,la-cm);var int_amt=(la*ir)/100;var tp=la+int_amt;var ni=ia>0?Math.ceil(tp/ia):0;
  document.getElementById('nlCalc').style.display='block';
  document.getElementById('nlCalcLA').textContent=fmtM(la);document.getElementById('nlCalcCm').textContent='-'+fmtM(cm);
  document.getElementById('nlCalcRc').textContent=fmtM(rc);document.getElementById('nlCalcInt').textContent=fmtM(int_amt);
  document.getElementById('nlCalcNi').textContent=ni;document.getElementById('nlCalcTP').textContent=fmtM(tp);
}
function saveNewLoan(){
  if(!nlCustId)return;var la=Number(document.getElementById('nlAmt').value)||0;var ir=Number(document.getElementById('nlIR').value)||0;var ia=Number(document.getElementById('nlInstAmt').value)||0;
  var pt=document.getElementById('nlPT').value;var nd=document.getElementById('nlDate').value;
  if(!la||la<=0){sT('⚠️ Enter loan amount');return;}if(!nd){sT('⚠️ Select start date');return;}
  var newId=document.getElementById('nlIdPreview').textContent;if(!newId||newId==='—'){sT('⚠️ Invalid ID');return;}
  var baseId=nlCustId.replace(/-L\d+$/,'');var loanCount=Object.values(AC).filter(function(cx){return(cx.customerId||'').replace(/-L\d+$/,'')===baseId;}).length;
  var cm=Math.floor(la/5000)*100;var rc=Math.max(0,la-cm);var int_amt=(la*ir)/100;var tp=la+int_amt;var ni=ia>0?Math.ceil(tp/ia):0;
  var origC=getCust(nlCustId);
  db.ref('customers/'+SK(newId)).set({customerId:newId,name:origC?origC.name:'',parentName:origC?origC.parentName||'':'',phone:origC?origC.phone||'':'',aadhar:origC?origC.aadhar||'':'',address:origC?origC.address||'':'',state:origC?origC.state||'':'',city:origC?origC.city||'':'',loanAmount:la,interestRate:ir,installmentAmount:ia,paymentType:pt,commissionFee:cm,customerReceives:rc,interestAmount:int_amt,totalPayable:tp,numberOfInstallments:ni,date:nd,savedAt:Date.now(),loanNumber:loanCount+1,originalCustomerId:nlCustId})
    .then(function(){cM('newLoanM');nlCustId=null;sT('✅ New loan created: '+newId);})
    .catch(function(){sT('⚠️ Failed');});
}

/* ══ DELETED LOG ══ */
function renderDelLog(){
  var wrap=document.getElementById('delLogList');if(!wrap)return;
  if(!DL.length){wrap.innerHTML='<div class="nd" style="grid-column:1/-1"><div class="nd-icon"><i class="fas fa-trash"></i></div><div class="nd-txt">No deleted payments yet</div></div>';return;}
  var sorted=DL.slice().sort(function(a,b){return(b.deletedAt||0)-(a.deletedAt||0);});
  wrap.innerHTML=sorted.map(function(d){
    var delAt=d.deletedAt?new Date(d.deletedAt).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
    var payAt=d.originalTimestamp?new Date(d.originalTimestamp).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
    return(
      '<div class="del-card">'+
        '<div class="del-card-strip"></div>'+
        '<div class="del-card-head">'+
          '<div><div class="del-cname">'+E(d.customerName||d.customerId||'?')+'</div>'+
          '<div class="del-cid"><i class="fas fa-id-card" style="margin-right:3px"></i>'+E(d.customerId||'—')+'</div></div>'+
          '<div class="del-amt">- '+fmtM(d.amount)+'</div>'+
        '</div>'+
        '<div class="del-card-body">'+
          '<div class="del-field"><div class="del-field-lbl">Payment Date</div><div class="del-field-val">'+fmtD(d.date)+'</div></div>'+
          '<div class="del-field"><div class="del-field-lbl">Amount</div><div class="del-field-val" style="color:var(--red)">'+fmtM(d.amount)+'</div></div>'+
          '<div class="del-field"><div class="del-field-lbl">Added At</div><div class="del-field-val">'+payAt+'</div></div>'+
          '<div class="del-field"><div class="del-field-lbl">Deleted At</div><div class="del-field-val" style="color:var(--red)">'+delAt+'</div></div>'+
          '<div class="del-field"><div class="del-field-lbl">Deleted By</div><div class="del-field-val" style="color:var(--red);font-weight:900">'+E(d.deletedBy||'—')+'</div></div>'+
          '<div class="del-field"><div class="del-field-lbl">Collected By</div><div class="del-field-val">'+E(d.collectedBy||'—')+'</div></div>'+
        '</div>'+
        '<div class="del-card-badges">'+
          '<span class="del-badge" style="background:rgba(244,63,94,.1);color:var(--red);border-color:rgba(244,63,94,.25)"><i class="fas fa-trash"></i> Deleted: '+E(d.deletedBy||'—')+'</span>'+
          '<span class="del-badge" style="background:var(--accent-soft);color:var(--accent);border-color:rgba(124,109,250,.25)"><i class="fas fa-user"></i> Collected: '+E(d.collectedBy||'—')+'</span>'+
        '</div>'+
      '</div>'
    );
  }).join('');
}

/* ══ REPORTS ══ */
function onReportRangeChange(){var v=document.getElementById('reportRange').value;document.getElementById('customDateFields').style.display=v==='custom'?'flex':'none';buildReport();}
function getReportRange(){return getRangeFor(document.getElementById('reportRange').value);}
function buildReport(){
  var se=getReportRange();var s=se.s;var e=se.e;
  var rng=document.getElementById('reportRange').value;
  var lbl={today:'Today',week:'This Week',month:'This Month',all:'All Time',custom:'Custom Range'};
  document.getElementById('reportDateLbl').textContent=(lbl[rng]||rng)+' · Generated: '+new Date().toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  var cs=Object.values(AC);var pays=paysInRange(s,e);
  var totalCollected=pays.reduce(function(t,p){return t+(Number(p.amount)||0);},0);
  var paidC=cs.filter(function(c){return isTodayPaid(c.customerId);}).length;
  var overdueC=cs.filter(function(c){return isOD(c);}).length;
  var completedC=cs.filter(function(c){var pd=gPaid(c.customerId);return(c.totalPayable||0)>0&&pd>=(c.totalPayable||0);}).length;
  document.getElementById('reportStats').innerHTML=
    '<div class="scard c-accent"><div class="scard-icon" style="color:var(--accent)"><i class="fas fa-users"></i></div><div class="scard-val">'+cs.length+'</div><div class="scard-lbl">Total</div></div>'+
    '<div class="scard c-cyan"><div class="scard-icon" style="color:var(--cyan)"><i class="fas fa-rupee-sign"></i></div><div class="scard-val" style="font-size:15px">'+fmtM(totalCollected)+'</div><div class="scard-lbl">Collected</div></div>'+
    '<div class="scard c-green"><div class="scard-icon" style="color:var(--green)"><i class="fas fa-check-circle"></i></div><div class="scard-val">'+paidC+'</div><div class="scard-lbl">Paid Today</div></div>'+
    '<div class="scard c-red"><div class="scard-icon" style="color:var(--red)"><i class="fas fa-exclamation-circle"></i></div><div class="scard-val">'+overdueC+'</div><div class="scard-lbl">Overdue</div></div>'+
    '<div class="scard c-purple"><div class="scard-icon" style="color:var(--purple)"><i class="fas fa-flag-checkered"></i></div><div class="scard-val">'+completedC+'</div><div class="scard-lbl">Completed</div></div>'+
    '<div class="scard c-yellow"><div class="scard-icon" style="color:var(--yellow)"><i class="fas fa-receipt"></i></div><div class="scard-val">'+pays.length+'</div><div class="scard-lbl">Payments</div></div>';
  var userMap={};
  pays.forEach(function(p){var by=p.collectedBy||'Unknown';if(!userMap[by])userMap[by]={name:by,count:0,total:0};userMap[by].count++;userMap[by].total+=Number(p.amount)||0;});
  var users=Object.values(userMap).sort(function(a,b){return b.total-a.total;});
  document.getElementById('userTableBody').innerHTML=users.length?users.map(function(u,i){
    return'<tr><td><span class="user-rank">'+(i+1)+'</span></td>'+
      '<td style="font-weight:700;color:var(--white)"><i class="fas fa-user-circle" style="color:var(--accent);margin-right:5px"></i>'+E(u.name)+'</td>'+
      '<td><span style="background:var(--accent-soft);color:var(--accent);border:1px solid rgba(124,109,250,.25);border-radius:50px;padding:3px 10px;font-size:11px;font-weight:900">'+u.count+'</span></td>'+
      '<td class="user-amt">'+fmtM(u.total)+'</td></tr>';
  }).join(''):'<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px">No payments in this range</td></tr>';
  var sorted=cs.slice().sort(function(a,b){return(parseInt((b.customerId||'').split('-').pop())||0)-(parseInt((a.customerId||'').split('-').pop())||0);});
  document.getElementById('reportBody').innerHTML=sorted.map(function(c,i){
    var pd=gPaid(c.customerId);var t=c.totalPayable||0;var pn=Math.max(0,t-pd);var pct=t>0?Math.min(100,Math.round((pd/t)*100)):0;
    var dn=t>0&&pd>=t;var ov=!dn&&isOD(c);var tp2=isTodayPaid(c.customerId);var todayAmt=getTodayPay(c.customerId);
    var status='Pending';var stColor='var(--yellow)';
    if(dn){status='Completed';stColor='var(--accent)';}else if(ov){status='Overdue';stColor='var(--red)';}else if(tp2){status='Paid';stColor='var(--green)';}
    var lastPay=getLastPayDate(c.customerId);var sd=c.date?fmtD(c.date):(c.savedAt?fmtD(new Date(c.savedAt).toISOString().split('T')[0]):'—');
    return'<tr>'+
      '<td style="color:var(--muted)">'+(i+1)+'</td>'+
      '<td class="rt-id">'+E(c.customerId)+'</td>'+
      '<td style="font-weight:700;color:var(--white)">'+E(c.name||'—')+'</td>'+
      '<td style="color:var(--muted)">'+E(c.parentName||'—')+'</td>'+
      '<td style="color:var(--muted)">'+E(c.phone||'—')+'</td>'+
      '<td style="color:var(--muted);max-width:110px;overflow:hidden;text-overflow:ellipsis">'+E([c.address,c.city,c.state].filter(Boolean).join(', ')||'—')+'</td>'+
      '<td style="color:var(--white);font-weight:700">'+fmtM(c.loanAmount)+'</td>'+
      '<td style="color:var(--muted)">'+(c.interestRate||0)+'%</td>'+
      '<td style="color:var(--red)">'+fmtM(c.commissionFee||0)+'</td>'+
      '<td style="color:var(--green)">'+fmtM(c.customerReceives||0)+'</td>'+
      '<td style="color:var(--yellow)">'+fmtM(c.interestAmount||0)+'</td>'+
      '<td style="color:var(--accent);font-weight:900">'+fmtM(t)+'</td>'+
      '<td style="color:var(--white)">'+fmtM(c.installmentAmount||0)+'</td>'+
      '<td style="color:var(--muted)">'+((c.paymentType||'monthly').charAt(0).toUpperCase()+(c.paymentType||'monthly').slice(1))+'</td>'+
      '<td style="color:var(--green);font-weight:900">'+fmtM(pd)+'</td>'+
      '<td style="color:'+(pn>0?'var(--yellow)':'var(--green)')+';font-weight:700">'+fmtM(pn)+'</td>'+
      '<td><span style="font-weight:900;color:'+(pct>=100?'var(--green)':pct>=50?'var(--yellow)':'var(--red)')+'">'+pct+'%</span></td>'+
      '<td><span class="rt-status" style="background:rgba(0,0,0,.2);color:'+stColor+';border-color:'+stColor+'44">'+status+'</span></td>'+
      '<td style="color:var(--muted)">'+fmtD(lastPay)+'</td>'+
      '<td style="color:var(--muted)">'+sd+'</td>'+
      '<td style="color:'+(todayAmt>0?'var(--green)':'var(--muted)')+';font-weight:'+(todayAmt>0?'900':'400')+'">'+fmtM(todayAmt)+'</td>'+
    '</tr>';
  }).join('');
}

/* ══ DOWNLOAD REPORT CSV ══ */
function downloadReportCSV(){
  var se=getReportRange();var pays=paysInRange(se.s,se.e);var cs=Object.values(AC);
  var rng=document.getElementById('reportRange').value;
  var rngLabel={today:'Today',week:'This Week',month:'This Month',all:'All Time',custom:'Custom'}[rng]||rng;
  var userMap={};
  pays.forEach(function(p){var by=p.collectedBy||'Unknown';if(!userMap[by])userMap[by]={name:by,count:0,total:0};userMap[by].count++;userMap[by].total+=Number(p.amount)||0;});
  var csv='SR Finance — Collection Report\nRange: '+rngLabel+'\nGenerated: '+new Date().toLocaleString('en-IN')+'\n\n';
  csv+='=== COLLECTION BY USER ===\n#,Collector,Payments,Total\n';
  Object.values(userMap).sort(function(a,b){return b.total-a.total;}).forEach(function(u,i){csv+=(i+1)+',"'+u.name+'",'+u.count+','+u.total+'\n';});
  csv+='\n=== CUSTOMER DETAILS ===\n';
  var hdr=['#','ID','Name','Parent','Phone','Address','State','City','Loan','Int%','Commission','Receives','Int Amt','Total Payable','Installment','Type','Paid','Pending','Progress%','Status','Last Payment','Start Date','Today Paid'];
  csv+=hdr.map(function(h){return'"'+h+'"';}).join(',')+'\n';
  var sorted=cs.slice().sort(function(a,b){return(parseInt((b.customerId||'').split('-').pop())||0)-(parseInt((a.customerId||'').split('-').pop())||0);});
  sorted.forEach(function(c,i){
    var pd=gPaid(c.customerId);var t=c.totalPayable||0;var pn=Math.max(0,t-pd);var pct=t>0?Math.min(100,Math.round((pd/t)*100)):0;
    var dn=t>0&&pd>=t;var ov=!dn&&isOD(c);var tp2=isTodayPaid(c.customerId);var todayAmt=getTodayPay(c.customerId);
    var status='Pending';if(dn)status='Completed';else if(ov)status='Overdue';else if(tp2)status='Paid';
    var lp=getLastPayDate(c.customerId)||'';var sd=c.date||(c.savedAt?fmtISO(new Date(c.savedAt)):'');
    var row=[i+1,c.customerId||'',c.name||'',c.parentName||'',c.phone||'',[c.address,c.city,c.state].filter(Boolean).join('; '),c.state||'',c.city||'',c.loanAmount||0,c.interestRate||0,c.commissionFee||0,c.customerReceives||0,c.interestAmount||0,t,c.installmentAmount||0,c.paymentType||'monthly',pd,pn,pct,status,lp,sd,todayAmt];
    csv+=row.map(function(v){return'"'+String(v).replace(/"/g,'""')+'"';}).join(',')+'\n';
  });
  var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});var url=URL.createObjectURL(blob);
  var link=document.createElement('a');link.href=url;link.download='SR-Finance-Report-'+fmtISO(new Date())+'.csv';link.click();URL.revokeObjectURL(url);
  sT('✅ Report downloaded!');
}

/* ══ EXPORT CUSTOMERS CSV ══ */
function exportCSV(){
  var cs=Object.values(AC);if(!cs.length){sT('⚠️ No customers');return;}
  var hdr=['ID','Name','Parent Name','Phone','Aadhar','Address','State','City','Loan Amount','Interest Rate','Commission','Customer Receives','Interest Amount','Total Payable','Installment Amount','Payment Type','Total Paid','Pending','Progress%','Status','Start Date'];
  var rows=cs.map(function(c){
    var pd=gPaid(c.customerId);var t=c.totalPayable||0;var pn=Math.max(0,t-pd);var pct=t>0?Math.min(100,Math.round((pd/t)*100)):0;
    var dn=t>0&&pd>=t;var ov=!dn&&isOD(c);var tp=isTodayPaid(c.customerId);
    var status='Pending';if(dn)status='Completed';else if(ov)status='Overdue';else if(tp)status='Paid Today';
    return[c.customerId||'',c.name||'',c.parentName||'',c.phone||'',c.aadhar||'',(c.address||'').replace(/,/g,';'),c.state||'',c.city||'',c.loanAmount||0,c.interestRate||0,c.commissionFee||0,c.customerReceives||0,c.interestAmount||0,t,c.installmentAmount||0,c.paymentType||'monthly',pd,pn,pct,status,c.date||c.savedAt||''].map(function(v){return'"'+String(v).replace(/"/g,'""')+'"';}).join(',');
  });
  var csv=[hdr.join(',')].concat(rows).join('\n');
  var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});var url=URL.createObjectURL(blob);
  var link=document.createElement('a');link.href=url;link.download='SR-Finance-Customers-'+fmtISO(new Date())+'.csv';link.click();URL.revokeObjectURL(url);
  sT('✅ Exported '+cs.length+' customers!');
}

/* ══ IMPORT ══ */
function openImport(){document.getElementById('importFile').value='';document.getElementById('importPreview').textContent='';oM('importM');}
(function(){var _f=document.getElementById('importFile');if(!_f)return;_f.addEventListener('change',function(){
  var file=this.files[0];if(!file)return;
  var reader=new FileReader();
  reader.onload=function(e){var lines=e.target.result.split('\n').filter(function(l){return l.trim();});document.getElementById('importPreview').textContent='✅ Found '+(lines.length-1)+' rows. Click Import.';};
  reader.readAsText(file);
});})();
function doImport(){
  var file=document.getElementById('importFile').files[0];if(!file){sT('⚠️ Select a CSV file');return;}
  var reader=new FileReader();
  reader.onload=function(e){
    var lines=e.target.result.split('\n').filter(function(l){return l.trim();});if(lines.length<2){sT('⚠️ File is empty');return;}
    var headers=lines[0].split(',').map(function(h){return h.replace(/"/g,'').trim().toLowerCase();});
    var count=0;var promises=[];
    for(var i=1;i<lines.length;i++){
      var vals=lines[i].match(/(".*?"|[^,]+)(?=,|$)/g)||[];var row={};
      headers.forEach(function(h,j){row[h]=(vals[j]||'').replace(/"/g,'').trim();});
      var id=row['id']||row['customer id']||row['customerid'];if(!id)continue;
      promises.push(db.ref('customers/'+SK(id)).set({customerId:id,name:row['name']||'',parentName:row['parent name']||'',phone:row['phone']||'',aadhar:row['aadhar']||'',address:row['address']||'',state:row['state']||'',city:row['city']||'',loanAmount:Number(row['loan amount'])||0,interestRate:Number(row['interest rate'])||0,installmentAmount:Number(row['installment amount'])||0,paymentType:row['payment type']||'monthly',importedAt:Date.now(),importedBy:CU.name}));
      count++;
    }
    Promise.all(promises).then(function(){cM('importM');sT('✅ Imported '+count+'!');}).catch(function(){sT('⚠️ Import failed');});
  };
  reader.readAsText(file);
}

/* ══ COPY ══ */
function cpT(t,b){
  if(!t)return;
  navigator.clipboard.writeText(t).then(function(){
    if(b){b.classList.add('copied');b.innerHTML='<i class="fas fa-check"></i>';setTimeout(function(){b.classList.remove('copied');b.innerHTML='<i class="fas fa-copy"></i>';},1500);}
    sT('📋 Copied!');
  }).catch(function(){
    var ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
    if(b){b.classList.add('copied');b.innerHTML='<i class="fas fa-check"></i>';setTimeout(function(){b.classList.remove('copied');b.innerHTML='<i class="fas fa-copy"></i>';},1500);}
    sT('📋 Copied!');
  });
}

/* ══ UTILS ══ */
function cM(id){var el=document.getElementById(id);if(el)el.classList.remove('show');}
function oM(id){var el=document.getElementById(id);if(el)el.classList.add('show');}
function showPayAnim(amt,cid){
  var ov=document.getElementById('payAnimOv');if(!ov)return;
  document.getElementById('payAnimAmt').textContent=fmtM(amt||0);
  var c=getCust(cid||'');
  document.getElementById('payAnimName').textContent=c?(c.name||''):'';
  document.getElementById('payAnimId').textContent=c?(c.customerId||''):'';
  ov.style.display='flex';setTimeout(function(){ov.style.display='none';},2800);
}
function sT(m){var t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(function(){t.classList.remove('show');},2800);}

/* ══ RESET ══ */
function openResetModal(){
  if(!CU||CU.role!=='admin'){sT('⛔ Only admin can reset');return;}
  document.getElementById('resetPin').value='';document.getElementById('resetPinErr').style.display='none';
  oM('resetM');setTimeout(function(){document.getElementById('resetPin').focus();},200);
}
function closeResetModal(){cM('resetM');document.getElementById('resetPin').value='';document.getElementById('resetPinErr').style.display='none';}
function confirmReset(){
  var pin=(document.getElementById('resetPin').value||'').trim();
  if(pin!=='2026'){document.getElementById('resetPinErr').style.display='block';document.getElementById('resetPin').value='';return;}
  cM('resetM');
  Promise.all([db.ref('customers').remove(),db.ref('payments').remove(),db.ref('deletedPayments').remove()])
    .then(function(){sT('✅ All data reset');}).catch(function(){sT('❌ Reset failed');});
}

/* ══ EVENT LISTENERS ══ */
document.querySelectorAll('.modal').forEach(function(m){
  m.addEventListener('click',function(e){if(e.target===m)m.classList.remove('show');});
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    document.querySelectorAll('.modal.show').forEach(function(m){m.classList.remove('show');});
    if(document.getElementById('sbMenu').classList.contains('show'))tSB();
  }
});
