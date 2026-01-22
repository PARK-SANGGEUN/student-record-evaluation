// app.js
const DATA = window.ALLTEACHERS_DATA;

const $ = (id)=>document.getElementById(id);

const keywordInput = $("keywordInput");
const majorSelect = $("majorSelect");
const candidateSelect = $("candidateSelect");
const btnLoadCandidate = $("btnLoadCandidate");
const applicantLine = $("applicantLine");

const recordOverview = $("recordOverview");
const recordCurriculum = $("recordCurriculum");
const recordGradesTable = $("recordGradesTable");
const recordSepec = $("recordSepec");
const recordCA = $("recordCA");
const recordBehavior = $("recordBehavior");
const activeTermTag = $("activeTermTag");

const growthBadge = $("growthBadge");
const comboBadge = $("comboBadge");
const coreSummary = $("coreSummary");
const coreTable = $("coreTable");
const coreWarn = $("coreWarn");
const termTable = $("termTable");

const sepecPreview = $("sepecPreview");
const sepecCompare = $("sepecCompare");
const compareA = $("compareA");
const compareB = $("compareB");

const kpiGrid = $("kpiGrid");
const rubricBox = $("rubricBox");
const riskSummary = $("riskSummary");

const memo = $("memo");
const btnSave = $("btnSave");
const btnClear = $("btnClear");
const btnPhrase1 = $("btnPhrase1");
const btnPhrase2 = $("btnPhrase2");
const btnPhrase3 = $("btnPhrase3");

const compareCandidate = $("compareCandidate");
const toggleCompare = $("toggleCompare");
const comparePanel = $("comparePanel");

let currentCandidate = DATA.candidates[0];
let currentMajor = DATA.majors[0];
let activeTerm = "ALL";
let activeSubject = null;
let compareShown = false;
let keyword = "";

const STORAGE_KEY = "allteachers_eval_memo_v2";

function escapeHtml(s){
  return s.replace(/[&<>"']/g, (m)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
}
function applyMark(text){
  if(!keyword) return escapeHtml(text);
  const safe = escapeHtml(text);
  const k = escapeHtml(keyword);
  const re = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return safe.replace(re, (m)=>`<mark>${m}</mark>`);
}
function isCommonText(text){
  return DATA.COMMON_PHRASES.some(p=>text.includes(p));
}

function gradeToDiffClass(diff){
  if(diff >= 1.0) return "good";
  if(diff >= 0.5) return "mid";
  if(diff <= -0.2) return "bad";
  return "";
}

function getAllSubjects(candidate){
  const set = new Set(Object.keys(candidate.gradesBySubject || {}));
  candidate.sepec.forEach(s=>set.add(s.subject));
  (candidate.gradeRecords||[]).forEach(r=>set.add(r.subject));
  return Array.from(set);
}

function computeTermAvgFromRecords(candidate){
  // 간단 KPI용: 각 term 평균 등급(gradeBySubject 기반)
  const subjects = Object.keys(candidate.gradesBySubject);
  const termAvg = DATA.terms.map((_,i)=>{
    const arr = [];
    subjects.forEach(s=>{
      const v = candidate.gradesBySubject[s]?.[i];
      if(v!=null) arr.push(v);
    });
    if(!arr.length) return null;
    return +(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(2);
  });
  return termAvg;
}

function trendType(values){
  // null 제외 후 마지막-첫값 비교(등급은 낮을수록 우수)
  const arr = values.filter(v=>v!=null);
  if(arr.length < 3) return "자료 제한";
  const delta = arr[0] - arr[arr.length-1];
  if(delta >= 0.5) return "📈 성장형";
  if(delta <= -0.3) return "📉 하락형";
  return "➖ 유지형";
}

function buildMajorOptions(){
  majorSelect.innerHTML = DATA.majors.map(m=>`<option value="${m.key}">${m.label}</option>`).join("");
  majorSelect.value = DATA.majors[0].key;
}
function buildCandidateOptions(){
  candidateSelect.innerHTML = DATA.candidates.map(c=>`<option value="${c.id}">${c.schoolLine}</option>`).join("");
  candidateSelect.value = DATA.candidates[0].id;

  compareCandidate.innerHTML = DATA.candidates.map(c=>`<option value="${c.id}">${c.schoolLine}</option>`).join("");
  compareCandidate.value = DATA.candidates[1].id;
}

function setCurrentMajor(key){
  currentMajor = DATA.majors.find(m=>m.key===key) || DATA.majors[0];
  renderAll();
}

function setCurrentCandidate(id){
  currentCandidate = DATA.candidates.find(c=>c.id===id) || DATA.candidates[0];
  activeSubject = null;
  activeTerm = "ALL";
  renderAll();
}

function renderTop(){
  applicantLine.textContent = `지원자 : ${currentCandidate.schoolLine}`;
}

function renderOverview(){
  const lines = currentCandidate.overview.map(x=>`• ${applyMark(x)}`).join("<br>");
  recordOverview.innerHTML = `
    <div class="note">${lines}</div>
    <div class="hint">※ 인적사항(실명/주소/연락처 등)은 제외된 가상 구성입니다.</div>
  `;
}

function renderCurriculum(){
  const taken = new Set(currentCandidate.takenCourses || []);
  const blocks = currentMajor.coreGroups.map(g=>{
    const req = g.required.map(s=>{
      const ok = taken.has(s) ? "✔" : "❌";
      return `<div>${ok} <b>${escapeHtml(s)}</b></div>`;
    }).join("");
    const opt = (g.optional||[]).map(s=>{
      const ok = taken.has(s) ? "✔" : "○";
      return `<div>${ok} ${escapeHtml(s)}</div>`;
    }).join("");

    return `
      <div class="caBlock">
        <div class="caTag">${escapeHtml(g.group)}</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div>
            <b>필수(가상 기준)</b><br>${req}
          </div>
          <div>
            <b>선택권장</b><br>${opt || "-"}
          </div>
        </div>
      </div>
    `;
  }).join("");

  recordCurriculum.innerHTML = blocks;
}

function renderGradesTable(){
  const rows = (currentCandidate.gradeRecords || [])
    .filter(r => activeTerm==="ALL" ? true : r.term===activeTerm)
    .map(r=>{
      const diff = +(r.raw - r.avg).toFixed(0);
      const cls = diff >= 10 ? "good" : diff >= 5 ? "mid" : "";
      return `
        <tr>
          <td>${r.term}</td>
          <td class="linkCell" data-sub="${escapeHtml(r.subject)}">${escapeHtml(r.subject)}</td>
          <td>${r.unit}</td>
          <td>${r.raw}</td>
          <td>${r.avg}</td>
          <td class="${cls}">${diff>=0? "+"+diff : diff}</td>
          <td>${r.ach}</td>
          <td>${r.aRate}%</td>
          <td>${r.n}</td>
        </tr>
      `;
    }).join("");

  recordGradesTable.innerHTML = `
    <tr>
      <th>학기</th><th>과목</th><th>단위</th><th>원점수</th><th>과목평균</th><th>평균대비</th><th>성취도</th><th>A비율</th><th>수강자</th>
    </tr>
    ${rows || `<tr><td colspan="9">선택된 학기 자료가 없습니다.</td></tr>`}
  `;

  // 과목 클릭 연동
  recordGradesTable.querySelectorAll(".linkCell").forEach(td=>{
    td.addEventListener("click", ()=>{
      activeSubject = td.dataset.sub;
      renderSepecLists();
      updateDistribution();
      renderSepecPreviewFromActive();
      scrollIntoCenterPreview();
    });
  });
}

function renderRecordSepec(){
  const list = currentCandidate.sepec
    .filter(s => activeTerm==="ALL" ? true : s.term===activeTerm)
    .map(s=>{
      const common = isCommonText(s.text) ? " common" : "";
      const head = `<b>${escapeHtml(s.subject)}</b> <span class="itemMeta">(${s.term})</span>`;
      return `
        <div class="caBlock${common}">
          ${head}<br><br>
          ${applyMark(s.text)}
        </div>
      `;
    }).join("");

  recordSepec.innerHTML = list || `<div class="note">선택된 학기 기준으로 표시할 세특이 없습니다.</div>`;
}

function renderRecordCA(){
  const ca = currentCandidate.ca || {autonomous:[],club:[],career:[]};
  const build = (arr)=>arr.map(x=>`
    <div class="caBlock">
      <div class="caTag">${escapeHtml(x.tag)}</div>
      <div>${applyMark(x.text)}</div>
    </div>
  `).join("");

  recordCA.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr; gap:10px;">
      <div><b>자율활동</b><br>${build(ca.autonomous)}</div>
      <div><b>동아리활동</b><br>${build(ca.club)}</div>
      <div><b>진로활동</b><br>${build(ca.career)}</div>
    </div>
  `;
}

function renderBehavior(){
  recordBehavior.innerHTML = `<div class="note">${applyMark(currentCandidate.behavior || "")}</div>`;
}

// LEFT list (interactive)
function renderSepecLists(){
  const listEl = document.querySelector("#secSepec");
  // no-op; kept as section anchor
}

function renderSepecSidebarList(){
  const box = $("sepecPreview");
  if(!box) return;

  // Sidebar list is in LEFT card: we render it from recordSepec? Actually list is not there.
  // We'll render interactive list in a "card" by creating items from candidate.sepec:
  // But index.html list is on LEFT? It's in record; interactive list isn't there.
  // So we use "recordSepec" in left record as long text, and CENTER preview/compare.
  // We'll provide a compact list in CENTER? We'll use the compare selects + preview.
}

function renderSepecPreviewFromActive(){
  const fallback = `<div class="note">좌측 ‘교과학습발달상황’에서 과목을 클릭하거나, 아래 비교에서 과목을 선택하세요.</div>`;
  if(!activeSubject){
    sepecPreview.innerHTML = fallback;
    return;
  }
  const found = currentCandidate.sepec
    .filter(s=>s.subject===activeSubject)
    .filter(s=>activeTerm==="ALL" ? true : s.term===activeTerm)[0]
    || currentCandidate.sepec.find(s=>s.subject===activeSubject);

  if(!found){
    sepecPreview.innerHTML = `<div class="note"><b>${escapeHtml(activeSubject)}</b> 세특이 없습니다(가상 데이터 기준).</div>`;
    return;
  }
  const common = isCommonText(found.text);
  sepecPreview.innerHTML = `
    <div class="note ${common ? "common":""}">
      <b>${escapeHtml(found.subject)}</b> <span class="small">(${found.term})</span><br><br>
      ${applyMark(found.text)}
    </div>
  `;
}

function scrollIntoCenterPreview(){
  const el = $("sepecPreview");
  if(el) el.scrollIntoView({behavior:"smooth", block:"start"});
}

// CENTER tables/charts
let miniTrendChart, comboChart, radarChart, distChart;

function renderGrowthBadge(){
  const termAvg = computeTermAvgFromRecords(currentCandidate);
  growthBadge.textContent = trendType(termAvg);
}

function calcComboAvg(selectedSubs){
  const series = DATA.terms.map((_,i)=>{
    const arr = [];
    selectedSubs.forEach(s=>{
      const v = currentCandidate.gradesBySubject[s]?.[i];
      if(v!=null) arr.push(v);
    });
    if(!arr.length) return null;
    return +(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(2);
  });
  return series;
}

function renderTermTable(){
  const studentAvg = computeTermAvgFromRecords(currentCandidate);
  const rows = DATA.terms.map((t,i)=>{
    const s = studentAvg[i];
    const r = DATA.refAvg[i];
    const diff = (s==null) ? null : +(r - s).toFixed(2); // +면 학생이 더 우수(등급 낮음)
    const cls = diff==null ? "" : gradeToDiffClass(diff);
    return `
      <tr>
        <td>${t}</td>
        <td>${s==null? "-" : s}</td>
        <td>${r}</td>
        <td class="${cls}">${diff==null? "-" : "+"+diff}</td>
      </tr>
    `;
  }).join("");

  termTable.innerHTML = `
    <tr><th>학기</th><th>학생 평균등급(예시)</th><th>유사집단 평균</th><th>평균 대비</th></tr>
    ${rows}
  `;
}

function renderKpis(){
  // 간단 KPI: 교과 평균, 전공관련 평균(major 기준 핵심 과목 평균), 평균대비(유사집단 대비), 수강자 평균
  const termAvg = computeTermAvgFromRecords(currentCandidate).filter(v=>v!=null);
  const overall = termAvg.length ? +(termAvg.reduce((a,b)=>a+b,0)/termAvg.length).toFixed(2) : "-";

  const majorCore = currentMajor.coreGroups.flatMap(g=>g.required);
  const coreSeries = calcComboAvg(majorCore.filter(s=>currentCandidate.gradesBySubject[s]));
  const coreAvgArr = coreSeries.filter(v=>v!=null);
  const coreAvg = coreAvgArr.length ? +(coreAvgArr.reduce((a,b)=>a+b,0)/coreAvgArr.length).toFixed(2) : "-";

  // 평균대비: 마지막 학기 기준 비교
  const lastIdx = DATA.terms.length-1;
  const studentLast = computeTermAvgFromRecords(currentCandidate)[lastIdx];
  const diff = (studentLast!=null) ? +(DATA.refAvg[lastIdx] - studentLast).toFixed(2) : "-";

  const recs = currentCandidate.gradeRecords || [];
  const nAvg = recs.length ? Math.round(recs.reduce((a,b)=>a+b.n,0)/recs.length) : "-";

  const kpis = [
    { label:"교과 평균", value: overall },
    { label:"전공핵심 평균", value: coreAvg },
    { label:"평균 대비(최근)", value: diff==="-"? "-" : "+"+diff },
    { label:"수강자(평균)", value: nAvg==="-"? "-" : `${nAvg}명` }
  ];

  kpiGrid.innerHTML = kpis.map(k=>`
    <div class="kpi">
      <div class="kpiLabel">${k.label}</div>
      <div class="kpiValue">${k.value}</div>
    </div>
  `).join("");
}

function destroyChart(ch){ if(ch) ch.destroy(); return null; }

function renderMiniTrend(){
  const series = computeTermAvgFromRecords(currentCandidate);
  miniTrendChart = destroyChart(miniTrendChart);

  miniTrendChart = new Chart($("miniTrend"),{
    type:"line",
    data:{
      labels: DATA.terms,
      datasets:[{
        label:"학기 평균(예시)",
        data: series,
        borderWidth:3,
        tension:0.3
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ legend:{ display:false }},
      scales:{ y:{ reverse:true, suggestedMin:1, suggestedMax:6 } },
      onClick: (evt)=>{
        const points = miniTrendChart.getElementsAtEventForMode(evt, 'nearest', { intersect:true }, true);
        if(!points.length) return;
        const idx = points[0].index;
        activeTerm = DATA.terms[idx];
        activeTermTag.textContent = `학기 선택: ${activeTerm}`;
        renderAll(false);
      }
    }
  });
}

function renderComboTrend(){
  // 기본 체크: 전공 핵심 과목(필수) 중 이수 과목에 해당하는 것들
  const defaultSel = currentMajor.coreGroups.flatMap(g=>g.required).filter(s=>currentCandidate.gradesBySubject[s]);
  const series = calcComboAvg(defaultSel);
  comboBadge.textContent = defaultSel.length ? `조합: ${defaultSel.slice(0,4).join(", ")}${defaultSel.length>4?"…":""}` : "조합: (선택 필요)";

  comboChart = destroyChart(comboChart);
  comboChart = new Chart($("comboTrend"),{
    type:"line",
    data:{
      labels: DATA.terms,
      datasets:[
        { label:"학생(조합)", data: series, borderWidth:3, tension:0.3 },
        { label:"유사집단", data: DATA.refAvg, borderWidth:2, borderDash:[6,6], tension:0.3 }
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ legend:{ display:false }},
      scales:{ y:{ reverse:true, suggestedMin:1, suggestedMax:6 } }
    }
  });
}

function renderRadar(initial=false){
  const labels = currentMajor.radarLabels || ["학업역량","진로역량","공동체역량","탐구역량","학업태도","성장가능성"];
  const init = currentCandidate.rubricInit || { academic:"B", career:"B", community:"B", inquiry:"B", attitude:"B", growth:"B" };

  // rubric state store
  if(!window.__RUBRIC_STATE || initial){
    window.__RUBRIC_STATE = {...init};
  }

  const map = { A:4, B:3, C:2, D:1 };
  const vals = [
    map[window.__RUBRIC_STATE.academic]||3,
    map[window.__RUBRIC_STATE.career]||3,
    map[window.__RUBRIC_STATE.community]||3,
    map[window.__RUBRIC_STATE.inquiry]||3,
    map[window.__RUBRIC_STATE.attitude]||3,
    map[window.__RUBRIC_STATE.growth]||3
  ];

  radarChart = destroyChart(radarChart);
  radarChart = new Chart($("radarChart"),{
    type:"radar",
    data:{
      labels,
      datasets:[{
        label:"역량(체험)",
        data: vals,
        borderWidth:2,
        backgroundColor:"rgba(78,67,118,.22)"
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ legend:{ display:false }},
      scales:{ r:{ min:0, max:4, ticks:{ stepSize:1 } } }
    }
  });
}

function renderDistribution(){
  // 기본: activeSubject or 첫 세특 과목
  updateDistribution();
}
function updateDistribution(){
  const sub = activeSubject || (currentCandidate.sepec[0]?.subject) || "수학Ⅰ";
  const dist = DATA.distributionBySubject[sub] || {A:18,B:44,C:38,n:160};

  distChart = destroyChart(distChart);
  distChart = new Chart($("distChart"),{
    type:"bar",
    data:{
      labels:["A","B","C"],
      datasets:[{
        label:`${sub} (n=${dist.n})`,
        data:[dist.A, dist.B, dist.C],
        borderWidth:1
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ legend:{ display:false }},
      scales:{ y:{ suggestedMin:0, suggestedMax:100, ticks:{ callback:(v)=>v+"%" } } }
    }
  });
}

function renderCoreCheck(){
  const taken = new Set(currentCandidate.takenCourses || []);
  const groups = currentMajor.coreGroups;

  function statusFor(req){
    const count = req.filter(s=>taken.has(s)).length;
    if(count === req.length) return "충족";
    if(count > 0) return "부분충족";
    return "미충족";
  }

  const rows = groups.map(g=>{
    const st = statusFor(g.required);
    const cls = st==="충족" ? "good" : st==="부분충족" ? "mid" : "bad";
    const takenReq = g.required.filter(s=>taken.has(s));
    return `
      <tr>
        <td>${escapeHtml(g.group)}</td>
        <td class="${cls}">${st==="충족"?"✔":"⚠"} ${st}</td>
        <td style="text-align:left">
          <b>필수</b>: ${escapeHtml(g.required.join(", "))}<br>
          <b>이수</b>: ${escapeHtml(takenReq.join(", ") || "-")}<br>
          <b>선택권장</b>: ${escapeHtml((g.optional||[]).join(", ") || "-")}
        </td>
      </tr>
    `;
  }).join("");

  coreTable.innerHTML = `
    <tr><th>영역</th><th>판정</th><th>세부</th></tr>
    ${rows}
  `;

  const summary = groups.map(g=>statusFor(g.required));
  const miss = summary.filter(s=>s==="미충족").length;
  const partial = summary.filter(s=>s==="부분충족").length;

  if(miss===0 && partial===0){
    coreSummary.textContent = "✔ 핵심과목 충족";
    coreWarn.innerHTML = "";
  }else{
    coreSummary.textContent = `⚠ 미충족 ${miss} · 부분충족 ${partial}`;
    const missGroups = groups.filter(g=>statusFor(g.required)==="미충족").map(g=>g.group);
    coreWarn.innerHTML = missGroups.length
      ? `전공 핵심과목 미충족 영역: <b>${escapeHtml(missGroups.join(", "))}</b><br>※ 진로역량/전공적합성 평가에서 불리하게 해석될 수 있습니다(체험용 안내).`
      : `핵심과목 일부가 부분충족입니다. 선택권장 과목 이수/연계 활동의 근거가 중요합니다.`;
  }
}

function buildRubricUI(){
  const labels = [
    { key:"academic", name:"학업역량" },
    { key:"career", name:"진로역량" },
    { key:"community", name:"공동체역량" },
    { key:"inquiry", name:"탐구역량" },
    { key:"attitude", name:"학업태도" },
    { key:"growth", name:"성장가능성" }
  ];
  const grades = ["A","B","C","D"];

  rubricBox.innerHTML = labels.map(l=>{
    const init = window.__RUBRIC_STATE?.[l.key] || "B";
    return `
      <div class="rubricRow">
        <div class="rubricLabel">${l.name}</div>
        <div class="rubricOpts" data-key="${l.key}">
          ${grades.map(g=>`<button class="chip ${init===g?'active':''}" data-v="${g}">${g}</button>`).join("")}
        </div>
      </div>
    `;
  }).join("");

  rubricBox.querySelectorAll(".rubricOpts").forEach(group=>{
    group.addEventListener("click",(e)=>{
      const btn = e.target.closest(".chip");
      if(!btn) return;
      const key = group.dataset.key;
      group.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      window.__RUBRIC_STATE[key] = btn.dataset.v;
      renderRadar(false);
      renderRiskSummary();
    });
  });
}

function renderRiskSummary(){
  const checks = Array.from(document.querySelectorAll('.risk input[type="checkbox"]'));
  const on = checks.filter(c=>c.checked).map(c=>c.parentElement.textContent.trim());

  // 자동 힌트: 핵심과목 미충족이면 ‘전공 핵심과목 부족’ 체크를 유도(자동 체크는 X)
  const hintCore = coreSummary.textContent.includes("미충족") ? "⚠ 핵심과목 미충족/부분충족 존재" : "✔ 핵심과목 양호";

  // 성취 추이 자동 힌트
  const trend = computeTermAvgFromRecords(currentCandidate);
  const ttype = trendType(trend);
  const hintTrend = ttype.includes("하락") ? "⚠ 성취 추이 하락형" : ttype.includes("성장") ? "✔ 성취 추이 성장형" : "➖ 성취 추이 유지형";

  // 공통문구 힌트
  const commonCount = currentCandidate.sepec.filter(s=>isCommonText(s.text)).length;
  const hintCommon = commonCount ? `⚠ 공통문구 가능성 ${commonCount}건(체험판 탐지)` : "✔ 공통문구 징후 낮음(체험판 기준)";

  riskSummary.innerHTML = `
    <b>자동 요약</b><br>
    • ${hintCore}<br>
    • ${hintTrend}<br>
    • ${hintCommon}<br><br>
    <b>수동 체크(선택)</b><br>
    ${on.length ? on.map(x=>`• ${escapeHtml(x)}`).join("<br>") : "• (선택된 위험요소 없음)"}
  `;
}

function buildCompareSelects(){
  const subs = getAllSubjects(currentCandidate);
  const options = subs.map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  compareA.innerHTML = options;
  compareB.innerHTML = options;

  // 기본 세팅: 전공핵심 vs 국어(비교 체감)
  compareA.value = subs.includes("미적분") ? "미적분" : subs[0];
  compareB.value = subs.includes("국어") ? "국어" : subs[1] || subs[0];

  compareA.onchange = renderSepecCompare;
  compareB.onchange = renderSepecCompare;
}

function sepecTextFor(subject){
  // term 우선, 없으면 아무 term
  const list = currentCandidate.sepec
    .filter(s=>s.subject===subject)
    .filter(s=>activeTerm==="ALL" ? true : s.term===activeTerm);
  const pick = list[0] || currentCandidate.sepec.find(s=>s.subject===subject);
  return pick ? pick.text : "(해당 과목 세특이 없습니다 — 가상 데이터 기준)";
}

function renderSepecCompare(){
  const a = compareA.value;
  const b = compareB.value;
  const ta = sepecTextFor(a);
  const tb = sepecTextFor(b);

  sepecCompare.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
      <div class="note ${isCommonText(ta)?'common':''}">
        <b>${escapeHtml(a)}</b><br><br>${applyMark(ta)}
      </div>
      <div class="note ${isCommonText(tb)?'common':''}">
        <b>${escapeHtml(b)}</b><br><br>${applyMark(tb)}
      </div>
    </div>
  `;
}

function loadMemo(){
  const saved = localStorage.getItem(STORAGE_KEY);
  if(saved) memo.value = saved;
}
function bindMemoButtons(){
  btnSave.onclick = ()=>{
    localStorage.setItem(STORAGE_KEY, memo.value);
    alert("저장되었습니다(이 브라우저/기기에서만 유지).");
  };
  btnClear.onclick = ()=>{
    if(confirm("메모/선택을 초기화할까요?")){
      memo.value = "";
      // 리스크 체크 해제
      document.querySelectorAll('.risk input[type="checkbox"]').forEach(c=>c.checked=false);
      renderRiskSummary();
    }
  };

  btnPhrase1.onclick = ()=>{
    memo.value += (memo.value? "\n":"") + "성취 추이에서 학기별 개선 경향이 확인되며, 유사집단 평균 대비 우수한 구간이 존재함(체험판 예시).";
  };
  btnPhrase2.onclick = ()=>{
    memo.value += (memo.value? "\n":"") + "세특 기록에서 가정–정식화–해석 흐름이 비교적 명확하며, 탐구 과정의 타당성이 확인됨(체험판 예시).";
  };
  btnPhrase3.onclick = ()=>{
    memo.value += (memo.value? "\n":"") + "핵심과목 이수 및 활동 연계 근거가 평가의 핵심이며, 미충족 영역은 보완 설계가 필요함(체험판 안내).";
  };
}

function bindRiskChecks(){
  document.querySelectorAll('.risk input[type="checkbox"]').forEach(c=>{
    c.addEventListener("change", renderRiskSummary);
  });
}

function bindCompareMode(){
  toggleCompare.addEventListener("click", ()=>{
    compareShown = !compareShown;
    comparePanel.classList.toggle("hidden", !compareShown);
    if(compareShown) renderComparePanel();
  });
  compareCandidate.addEventListener("change", ()=>{
    if(compareShown) renderComparePanel();
  });
}

function renderComparePanel(){
  const other = DATA.candidates.find(c=>c.id===compareCandidate.value) || DATA.candidates[1];
  const major = currentMajor;

  // 핵심과목 충족 요약만 비교
  const takenA = new Set(currentCandidate.takenCourses||[]);
  const takenB = new Set(other.takenCourses||[]);

  function coreScore(taken){
    let miss=0, partial=0;
    major.coreGroups.forEach(g=>{
      const cnt = g.required.filter(s=>taken.has(s)).length;
      if(cnt===g.required.length) return;
      if(cnt>0) partial++;
      else miss++;
    });
    return { miss, partial };
  }
  const a = coreScore(takenA);
  const b = coreScore(takenB);

  // 성취 추이 간단 비교
  const ta = computeTermAvgFromRecords(currentCandidate);
  const tb = computeTermAvgFromRecords(other);

  comparePanel.innerHTML = `
    <b>비교 대상</b><br>
    • A(현재): ${escapeHtml(currentCandidate.schoolLine)}<br>
    • B(비교): ${escapeHtml(other.schoolLine)}<br><br>

    <b>핵심과목(모집단위: ${escapeHtml(major.label)})</b><br>
    • A: 미충족 ${a.miss}, 부분 ${a.partial}<br>
    • B: 미충족 ${b.miss}, 부분 ${b.partial}<br><br>

    <b>성취 추이(학기 평균 등급, 예시)</b><br>
    • A: ${ta.map(x=>x==null?"-":x).join(" / ")} (${trendType(ta)})<br>
    • B: ${tb.map(x=>x==null?"-":x).join(" / ")} (${trendType(tb)})<br><br>

    <b>세특 관찰 포인트(체험용)</b><br>
    • 전공 관련 과목(수학/과학/정보 등)의 ‘탐구 근거(과정·검증·오차)’가 반복적으로 등장하는지<br>
    • 과목 간 연결(수학→과학, 데이터→해석)과 학기 간 연속성이 있는지<br>
  `;
}

function bindKeyword(){
  keywordInput.addEventListener("input", ()=>{
    keyword = keywordInput.value.trim();
    renderAll(false);
  });
}

function renderAll(resetRubric=true){
  // term tag
  activeTermTag.textContent = `학기 선택: ${activeTerm==="ALL" ? "전체" : activeTerm}`;

  // top
  renderTop();

  // record
  renderOverview();
  renderCurriculum();
  renderGradesTable();
  renderRecordSepec();
  renderRecordCA();
  renderBehavior();

  // analytics
  renderGrowthBadge();
  renderTermTable();
  renderKpis();
  renderMiniTrend();
  renderComboTrend();

  renderCoreCheck();

  renderRadar(resetRubric);
  buildRubricUI();
  bindRiskChecks();
  renderRiskSummary();

  renderSepecPreviewFromActive();
  buildCompareSelects();
  renderSepecCompare();

  // distribution
  renderDistribution();
}

function init(){
  // majors
  buildMajorOptions();
  majorSelect.addEventListener("change", ()=>setCurrentMajor(majorSelect.value));

  // candidates
  buildCandidateOptions();
  btnLoadCandidate.addEventListener("click", ()=>setCurrentCandidate(candidateSelect.value));

  // keyword
  bindKeyword();

  // memo
  loadMemo();
  bindMemoButtons();

  // compare
  bindCompareMode();

  // initial
  renderAll(true);
}

init();
