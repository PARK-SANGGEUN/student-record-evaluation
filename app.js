// app.js
const D = window.APP_DATA;

const elComboButtons = document.getElementById("comboButtons");
const elCustomSubjects = document.getElementById("customSubjects");
const elApplyCustom = document.getElementById("applyCustom");
const elResetCustom = document.getElementById("resetCustom");

const elTrendTable = document.getElementById("trendTable");
const elActiveComboBadge = document.getElementById("activeComboBadge");
const elChartTitle = document.getElementById("chartTitle");

const elCourseTable = document.getElementById("courseTable");

const elSepecList = document.getElementById("sepecList");
const elSepecPreview = document.getElementById("sepecPreview");

const elCaTabs = document.getElementById("caTabs");
const elCaContent = document.getElementById("caContent");
const elBehaviorNote = document.getElementById("behaviorNote");

const elKpiBar = document.getElementById("kpiBar");

const commentBox = document.getElementById("commentBox");
const btnSave = document.getElementById("btnSave");
const btnClear = document.getElementById("btnClear");

const phrase1 = document.getElementById("btnPhrase1");
const phrase2 = document.getElementById("btnPhrase2");
const phrase3 = document.getElementById("btnPhrase3");

// ------- KPI -------
function renderKpis(){
  elKpiBar.innerHTML = "";
  D.kpis.forEach(k=>{
    const div = document.createElement("div");
    div.className = "kpi";
    div.innerHTML = `<div class="kpi__label">${k.label}</div><div class="kpi__value">${k.value}</div>`;
    elKpiBar.appendChild(div);
  });
}

// ------- Courses -------
function statusBadge(status){
  if(status === "이수") return `<span class="badge">✔ 이수</span>`;
  if(status === "미이수") return `<span class="badge" style="border-color:rgba(245,158,11,.35);background:rgba(245,158,11,.10);color:#b45309">⚠ 미이수</span>`;
  return `<span class="badge">○ ${status}</span>`;
}

function renderCourses(){
  elCourseTable.innerHTML = `
    <tr>
      <th>과목</th><th>상태</th><th>구분</th>
    </tr>
    ${D.courses.map(c=>`
      <tr>
        <td>${c.course}</td>
        <td>${statusBadge(c.status)}</td>
        <td>${c.note}</td>
      </tr>
    `).join("")}
  `;
}

// ------- Sepec -------
let activeSepecIndex = 0;

function renderSepecList(){
  elSepecList.innerHTML = "";
  D.sepec.forEach((s, idx)=>{
    const div = document.createElement("div");
    div.className = "item" + (idx===activeSepecIndex ? " active" : "");
    div.innerHTML = `
      <div class="item__top">
        <div class="item__title">${s.subject}</div>
        <div class="item__meta">${s.term}</div>
      </div>
      <div class="item__meta" style="margin-top:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
        ${s.text}
      </div>
    `;
    div.onclick = ()=>{
      activeSepecIndex = idx;
      renderSepecList();
      renderSepecPreview();
      // 세특 클릭 시: 해당 과목을 커스텀 조합에 체크(사용자 체감 강화)
      autoCheckCustomSubject(s.subject);
    };
    elSepecList.appendChild(div);
  });
}

function renderSepecPreview(){
  const s = D.sepec[activeSepecIndex];
  elSepecPreview.innerHTML = `
    <b>${s.subject} (${s.term})</b><br><br>
    ${s.text}
  `;
}

// ------- CA -------
function renderCa(kind){
  const list = D.ca[kind] || [];
  elCaContent.innerHTML = list.map(x=>`
    <div class="ca__block">
      <div class="ca__tag">${x.tag}</div>
      <div>${x.text}</div>
    </div>
  `).join("");
}

elCaTabs.addEventListener("click", (e)=>{
  const btn = e.target.closest(".tab");
  if(!btn) return;
  elCaTabs.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
  btn.classList.add("active");
  renderCa(btn.dataset.ca);
});

// ------- Behavior -------
function renderBehavior(){
  elBehaviorNote.textContent = D.behavior;
}

// ------- Combo Buttons & Custom -------
let activeComboKey = "국영수"; // default
let customSelected = new Set();

function renderComboButtons(){
  elComboButtons.innerHTML = "";
  D.combos.forEach(c=>{
    const b = document.createElement("button");
    b.className = "segBtn" + (c.key===activeComboKey ? " active" : "");
    b.textContent = c.label;
    b.onclick = ()=>{
      activeComboKey = c.key;
      renderComboButtons();
      applyCombo(c.key);
    };
    elComboButtons.appendChild(b);
  });
}

function renderCustomSubjects(){
  elCustomSubjects.innerHTML = "";
  D.subjects.forEach(sub=>{
    const wrap = document.createElement("label");
    wrap.className = "pillCheck";
    const checked = customSelected.has(sub);
    wrap.innerHTML = `<input type="checkbox" ${checked?"checked":""} /> <span>${sub}</span>`;
    const cb = wrap.querySelector("input");
    cb.onchange = ()=> {
      if(cb.checked) customSelected.add(sub);
      else customSelected.delete(sub);
    };
    elCustomSubjects.appendChild(wrap);
  });
}

function autoCheckCustomSubject(subject){
  customSelected.add(subject);
  renderCustomSubjects();
}

elApplyCustom.onclick = ()=>{
  activeComboKey = "커스텀";
  renderComboButtons();
  applyCombo("커스텀", Array.from(customSelected));
};

elResetCustom.onclick = ()=>{
  customSelected = new Set();
  renderCustomSubjects();
};

// ------- Trend Computation -------
function avgOfSubjects(subjects){
  // 학기별 평균: null은 제외
  const values = D.terms.map((_,i)=>{
    const arr = [];
    subjects.forEach(s=>{
      const v = D.gradesBySubject[s]?.[i];
      if(v !== null && v !== undefined) arr.push(v);
    });
    if(arr.length===0) return null;
    const sum = arr.reduce((a,b)=>a+b,0);
    return +(sum/arr.length).toFixed(2);
  });
  return values;
}

function refLineFor(key){
  return D.refAvg[key] || D.refAvg["커스텀"];
}

// ------- Chart -------
let chart;

function renderChart(studentLine, refLine){
  const ctx = document.getElementById("trendChart");
  if(chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: D.terms,
      datasets: [
        {
          label: "학생",
          data: studentLine,
          borderWidth: 3,
          tension: 0.3
        },
        {
          label: "유사집단 평균(예시)",
          data: refLine,
          borderWidth: 2,
          borderDash: [6,6],
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          reverse: true,  // 등급은 낮을수록 우수
          suggestedMin: 1,
          suggestedMax: 6,
          ticks: { stepSize: 0.5 }
        }
      }
    }
  });
}

// ------- Table -------
function renderTrendTable(studentLine, refLine){
  // 평균대비 = (ref - student) : 클수록 우수(학생 등급이 더 낮음)
  const rows = D.terms.map((t,i)=>{
    const s = studentLine[i];
    const r = refLine[i];
    const diff = (s==null || r==null) ? "" : +(r - s).toFixed(2);
    const cls = (diff !== "" && diff >= 1.0) ? 'style="font-weight:1000;color:#0f766e"' :
                (diff !== "" && diff >= 0.5) ? 'style="font-weight:900;color:#1d4ed8"' :
                '';
    return `
      <tr>
        <td>${t}</td>
        <td>${s==null? "-" : s}</td>
        <td>${r==null? "-" : r}</td>
        <td ${cls}>${diff===""? "-" : "+"+diff}</td>
      </tr>
    `;
  }).join("");

  elTrendTable.innerHTML = `
    <tr>
      <th>학기</th>
      <th>학생 평균등급</th>
      <th>유사집단 평균</th>
      <th>평균 대비</th>
    </tr>
    ${rows}
  `;
}

// ------- Apply Combo -------
function applyCombo(key, customList){
  let subjects;
  if(key === "커스텀"){
    subjects = (customList && customList.length) ? customList : ["국어","영어","수학Ⅰ"];
  } else {
    subjects = D.combos.find(c=>c.key===key)?.subjects ?? ["국어","영어","수학Ⅰ"];
  }

  const studentLine = avgOfSubjects(subjects);
  const refLine = refLineFor(key);

  elActiveComboBadge.textContent = (key==="커스텀")
    ? `커스텀: ${subjects.slice(0,4).join(", ")}${subjects.length>4?"…":""}`
    : `선택: ${key}`;

  elChartTitle.textContent = `학기별 등급 추이 · (${key==="커스텀"?"커스텀 조합":"조합: "+key})`;

  renderChart(studentLine, refLine);
  renderTrendTable(studentLine, refLine);
}

// ------- Rubric Clicks -------
document.querySelectorAll(".rubric__opts").forEach(group=>{
  group.addEventListener("click",(e)=>{
    const btn = e.target.closest(".chip");
    if(!btn) return;
    group.querySelectorAll(".chip").forEach(c=>c.classList.remove("active"));
    btn.classList.add("active");
  });
});

// ------- Phrases -------
phrase1.onclick = ()=>{
  commentBox.value += (commentBox.value ? "\n" : "") +
    "성취 추이에서 학기별 개선 경향이 확인되며, 유사집단 평균 대비 우수한 구간이 존재함.";
};
phrase2.onclick = ()=>{
  commentBox.value += (commentBox.value ? "\n" : "") +
    "세특 기록에서 가정–정식화–해석의 논리 흐름이 명확하고, 탐구 과정의 타당성이 확인됨.";
};
phrase3.onclick = ()=>{
  commentBox.value += (commentBox.value ? "\n" : "") +
    "전공 권장 과목 이수 현황이 양호하며, 관련 활동(동아리/진로)과의 연계가 비교적 분명함.";
};

// ------- Save / Load -------
const STORAGE_KEY = "allteachers_eval_comment_v1";

function loadSaved(){
  const saved = localStorage.getItem(STORAGE_KEY);
  if(saved) commentBox.value = saved;
}
btnSave.onclick = ()=>{
  localStorage.setItem(STORAGE_KEY, commentBox.value);
  alert("저장되었습니다(이 브라우저/기기에서만 유지).");
};
btnClear.onclick = ()=>{
  if(confirm("의견/선택을 초기화할까요?")){
    commentBox.value = "";
    document.querySelectorAll(".chip.active").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".risk input[type=checkbox]").forEach(x=>x.checked=false);
  }
};

// ------- Init -------
function init(){
  renderKpis();
  renderCourses();

  renderSepecList();
  renderSepecPreview();

  renderCa("autonomous");
  renderBehavior();

  renderComboButtons();
  renderCustomSubjects();

  applyCombo(activeComboKey);

  loadSaved();
}
init();
