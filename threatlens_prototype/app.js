// ThreatLens - shared prototype logic
// Data is stored in localStorage so inputs remain connected across pages.

const APP_VERSION = "2.4";

const defaultClasses = [];

const defaultUser = {
  name: "Learner",
  role: "student",
  focus: "all",
  xp: 0,
  level: 1,
  badges: 0,
  streak: 0,
  classCode: "",
  classJoined: false,
  completedTopics: [],
  completedMissions: 0,
  completedMissionIds: [],
  quizCorrect: 0,
  createdAt: ""
};

function profileKey(name, role) {
  return `${String(name || "Learner").trim().toLowerCase()}::${role || "student"}`;
}

function getProfiles() {
  try { return JSON.parse(localStorage.getItem("threatLensProfiles") || "{}"); }
  catch { return {}; }
}

function saveProfiles(profiles) {
  localStorage.setItem("threatLensProfiles", JSON.stringify(profiles));
}

function getUser() {
  try {
    const storedVersion = localStorage.getItem("threatLensVersion");
    if (storedVersion !== APP_VERSION) {
      localStorage.removeItem("threatLensUser");
      localStorage.removeItem("threatLensProfiles");
      localStorage.setItem("threatLensVersion", APP_VERSION);
    }
    const active = JSON.parse(localStorage.getItem("threatLensUser") || "null");
    if (!active) return { ...defaultUser };
    const profiles = getProfiles();
    const key = profileKey(active.name, active.role);
    const saved = profiles[key] || active;
    return { ...defaultUser, ...saved };
  } catch {
    return { ...defaultUser };
  }
}

function saveUser(user) {
  const normalized = { ...defaultUser, ...user, createdAt: user.createdAt || new Date().toISOString() };
  localStorage.setItem("threatLensUser", JSON.stringify(normalized));
  const profiles = getProfiles();
  profiles[profileKey(normalized.name, normalized.role)] = normalized;
  saveProfiles(profiles);
}

function switchToProfile(name, role, focus) {
  const profiles = getProfiles();
  const key = profileKey(name, role);
  const existing = profiles[key];
  const user = existing ? { ...defaultUser, ...existing, focus: focus || existing.focus || "all" } : { ...defaultUser, name, role, focus: focus || "all", createdAt: new Date().toISOString() };
  saveUser(user);
  return user;
}

function addXP(points) {
  const user = getUser();
  user.xp += points;
  user.level = Math.max(1, Math.floor(user.xp / 200) + 1);
  if (points > 0) user.streak = Math.max(1, user.streak || 0);
  saveUser(user);
  return user;
}

function setupUserUI() {
  const user = getUser();
  const name = user.name || "Learner";
  const initials = name.trim().charAt(0).toUpperCase();

  document.querySelectorAll("#dashboardName").forEach(el => el.textContent = name);
  document.querySelectorAll("#badgeName").forEach(el => el.textContent = name);
  document.querySelectorAll("#avatar").forEach(el => el.textContent = initials);
  const badgeAvatar = document.getElementById("badgeAvatar");
  if (badgeAvatar) badgeAvatar.textContent = initials;

  const rolePill = document.getElementById("rolePill");
  if (rolePill) rolePill.textContent = user.role === "teacher" ? "Teacher" : user.role === "individual" ? "Individual Learner" : "Student";

  const levelText = document.getElementById("levelText");
  if (levelText) levelText.textContent = `Level ${user.level}`;

  const xpText = document.getElementById("xpText");
  if (xpText) xpText.textContent = user.xp;

  const badgeCount = document.getElementById("badgeCount");
  if (badgeCount) badgeCount.textContent = user.badges;

  document.querySelectorAll("#streakText").forEach(el => el.textContent = `${user.streak || 0} day${(user.streak || 0) === 1 ? "" : "s"}`);
  const badgeLevel = document.getElementById("badgeLevel");
  const badgeXP = document.getElementById("badgeXP");
  const badgeXP2 = document.getElementById("badgeXP2");
  const badgeProgress = document.getElementById("badgeProgress");
  if (badgeLevel) badgeLevel.textContent = user.level;
  if (badgeXP) badgeXP.textContent = user.xp;
  if (badgeXP2) badgeXP2.textContent = user.xp % 200;
  if (badgeProgress) badgeProgress.style.width = `${(user.xp % 200) / 2}%`;
  const badgeUnlockedText = document.getElementById("badgeUnlockedText");
  if (badgeUnlockedText) badgeUnlockedText.textContent = `${user.badges} / 6 unlocked`;

  const missionIds = user.completedMissionIds || [];
  const topicMissionMap = {
    phishing: ["student-phish", "teacher-phish", "common-scam"],
    privacy: ["student-privacy", "teacher-privacy", "common-password", "common-post"],
    cyberbullying: ["student-bully", "teacher-bully", "common-support"]
  };
  const topicProgress = {};
  Object.entries(topicMissionMap).forEach(([topic, ids]) => {
    const done = ids.filter(id => missionIds.includes(id)).length;
    const lessonDone = (user.completedTopics || []).includes(topic) ? 20 : 0;
    topicProgress[topic] = Math.min(100, Math.round((done / ids.length) * 80) + lessonDone);
  });
  document.querySelectorAll("[data-topic-progress]").forEach(el => {
    const topic = el.dataset.topicProgress;
    const value = topicProgress[topic] || 0;
    const bar = el.querySelector(".progress-bar i");
    const label = el.querySelector("small");
    if (bar) bar.style.width = `${value}%`;
    if (label) label.textContent = `${value}% complete`;
  });

  document.querySelectorAll("[data-profile-role]").forEach(el => el.textContent = user.role === "teacher" ? "Teacher" : user.role === "individual" ? "Individual Learner" : "Student");
  document.querySelectorAll("[data-profile-class]").forEach(el => el.textContent = user.role === "individual" ? "Independent learning" : (user.classJoined ? (user.classCode || "Joined class") : "Individual learner"));
  const joinNav = document.getElementById("joinClassNav");
  if (joinNav) joinNav.classList.toggle("hidden", user.role === "individual");

  document.querySelectorAll("#teacherNav").forEach(el => {
    el.classList.toggle("hidden", user.role !== "teacher");
  });

  // Teacher-only learning extensions: students keep the same learning page,
  // while teachers get extra teaching guidance and classroom activities.
  document.querySelectorAll(".teacher-only").forEach(el => {
    el.classList.toggle("hidden", user.role !== "teacher");
  });
}

function setupProfileForm() {
  const form = document.getElementById("profileForm");
  if (!form) return;

  const passwordFields = document.getElementById("individualPasswordFields");
  const password = document.getElementById("individualPassword");
  const passwordConfirm = document.getElementById("individualPasswordConfirm");
  const roleInputs = document.querySelectorAll('input[name="role"]');

  const syncPasswordFields = () => {
    const role = document.querySelector('input[name="role"]:checked').value;
    const individual = role === "individual";
    if (passwordFields) passwordFields.classList.toggle("hidden", !individual);
    if (password) password.required = individual;
    if (passwordConfirm) passwordConfirm.required = individual;
    if (!individual) {
      if (password) password.value = "";
      if (passwordConfirm) passwordConfirm.value = "";
    }
  };
  roleInputs.forEach(input => input.addEventListener("change", syncPasswordFields));
  syncPasswordFields();

  const existing = getUser();
  document.getElementById("userName").value = existing.name === "Learner" ? "" : existing.name;
  document.getElementById("focusTopic").value = existing.focus || "all";

  form.addEventListener("submit", e => {
    e.preventDefault();
    const role = document.querySelector('input[name="role"]:checked').value;
    const name = document.getElementById("userName").value.trim();
    const focus = document.getElementById("focusTopic").value;

    if (role === "individual") {
      const pass = password?.value || "";
      const confirm = passwordConfirm?.value || "";
      if (pass.length < 6) return alert("Individual Learner password must be at least 6 characters.");
      if (pass !== confirm) return alert("Passwords do not match.");

      const profiles = getProfiles();
      const key = profileKey(name || "Learner", role);
      const existingIndividual = profiles[key];
      if (existingIndividual?.password && existingIndividual.password !== pass) {
        return alert("Incorrect password for this Individual Learner profile.");
      }
    }

    const previous = getUser();
    if (previous.name && previous.name !== "Learner") saveUser(previous);
    const user = switchToProfile(name || "Learner", role, focus);
    if (role === "individual") {
      user.password = password.value;
      saveUser(user);
    }

    window.location.href = role === "teacher" ? "teacher.html" : "dashboard.html";
  });
}

function getClasses() {
  try { return JSON.parse(localStorage.getItem("threatLensClasses") || "[]"); }
  catch { return []; }
}

function saveClasses(classes) {
  localStorage.setItem("threatLensClasses", JSON.stringify(classes));
}

function requireRole(role) {
  const user = getUser();
  if (user.role !== role) { window.location.href = user.role === "teacher" ? "teacher.html" : "dashboard.html"; return false; }
  return true;
}

function requireLearnerRole() {
  const user = getUser();
  if (user.role !== "student" && user.role !== "individual") { window.location.href = "teacher.html"; return false; }
  return true;
}

function getAssignments() {
  try { return JSON.parse(localStorage.getItem("threatLensAssignments") || "[]"); } catch { return []; }
}
function saveAssignments(items) { localStorage.setItem("threatLensAssignments", JSON.stringify(items)); }

function setupAssignments() {
  const form = document.getElementById("assignmentForm");
  if (!form || !requireRole("teacher")) return;
  const classSelect = document.getElementById("assignmentClass");
  const studentSelect = document.getElementById("assignmentStudent");
  const list = document.getElementById("assignmentList");
  const refreshStudents = () => {
    const cls = getClasses().find(c => c.code === classSelect.value);
    studentSelect.innerHTML = '<option value="all">All students in class</option>' + (cls?.students || []).map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
  };
  const refreshClasses = () => {
    const classes = getClasses().filter(c => c.teacher === getUser().name);
    classSelect.innerHTML = '<option value="">Select class</option>' + classes.map(c => `<option value="${c.code}">${escapeHtml(c.name)} (${c.students.length})</option>`).join("");
    refreshStudents();
  };
  refreshClasses();
  classSelect.addEventListener("change", refreshStudents);
  form.addEventListener("submit", e => {
    e.preventDefault();
    const cls = getClasses().find(c => c.code === classSelect.value);
    if (!cls) return alert("Select a valid class.");
    if (!cls.students.length) return alert("No students have joined this class yet. Share the class code first.");
    const title = document.getElementById("assignmentTitle").value.trim();
    const task = { id: Date.now().toString(), teacher: getUser().name, classCode: cls.code, className: cls.name, student: studentSelect.value, title, topic: document.getElementById("assignmentTopic").value, due: document.getElementById("assignmentDue").value, completedBy: [] };
    const assignments = getAssignments(); assignments.push(task); saveAssignments(assignments);
    form.reset(); refreshClasses(); renderAssignments(); alert("Task assigned successfully ✓");
  });
  function renderAssignments() {
    if (!list) return;
    const mine = getAssignments().filter(a => a.teacher === getUser().name);
    list.innerHTML = mine.length ? mine.slice().reverse().map(a => `<div class="quick-card"><span>📝</span><div><b>${escapeHtml(a.title)}</b><small>${escapeHtml(a.className)} • ${a.student === "all" ? "All students" : escapeHtml(a.student)} • ${escapeHtml(a.topic)}${a.due ? " • Due " + escapeHtml(a.due) : ""}</small></div></div>`).join("") : '<div class="empty-state">No tasks assigned yet.</div>';
  }
  window.renderAssignments = renderAssignments;
  renderAssignments();
}

function setupStudentTasks() {
  const box = document.getElementById("studentTasks");
  if (!box) return;
  const user = getUser();
  if (user.role !== "student") { box.innerHTML = '<article class="table-card"><span class="eyebrow">INDEPENDENT LEARNING</span><h2>No teacher tasks</h2><p class="muted">Individual Learners can follow missions and quizzes independently.</p></article>'; return; }
  const mine = getAssignments().filter(a => a.classCode === user.classCode && (a.student === "all" || a.student === user.name));
  box.innerHTML = mine.length ? mine.map(a => { const done = (a.completedBy || []).includes(user.name); return `<article class="table-card"><span class="eyebrow">${escapeHtml(a.topic)} ${a.due ? "• DUE " + escapeHtml(a.due) : ""}</span><h3>${escapeHtml(a.title)}</h3><p class="muted">Assigned by ${escapeHtml(a.teacher)} • ${escapeHtml(a.className)}</p><button class="btn" data-task-id="${a.id}" ${done ? "disabled" : ""}>${done ? "Completed ✓" : "Mark Task Complete +20 XP"}</button></article>`; }).join("") : '<article class="table-card"><span class="eyebrow">NO ASSIGNED TASKS</span><h2>You are all caught up 🎉</h2><p class="muted">Tasks from your teacher will appear here after they are assigned.</p></article>';
  box.querySelectorAll("[data-task-id]").forEach(btn => btn.addEventListener("click", () => {
    const assignments = getAssignments(); const a = assignments.find(x => x.id === btn.dataset.taskId);
    if (!a || (a.completedBy || []).includes(user.name)) return;
    a.completedBy = a.completedBy || []; a.completedBy.push(user.name); saveAssignments(assignments); addXP(20); setupStudentTasks();
  }));
}


function createClass() {
  if (!requireRole("teacher")) return;
  const nameInput = document.getElementById("newClassName");
  if (!nameInput) return;
  const name = nameInput.value.trim();
  if (!name) { alert("Please enter a class name."); return; }
  const classes = getClasses();
  let code;
  do { code = "TL-" + Math.random().toString(36).slice(2, 7).toUpperCase(); } while (classes.some(c => c.code === code));
  classes.push({ id: Date.now().toString(), name, code, teacher: getUser().name, students: [] });
  saveClasses(classes);
  nameInput.value = "";
  renderTeacherClasses();
}

function renderTeacherClasses() {
  const box = document.getElementById("teacherClasses");
  if (!box || !requireRole("teacher")) return;
  const allClasses = getClasses();
  const classes = allClasses.filter(c => c.teacher === getUser().name);
  if (!classes.length) {
    box.innerHTML = `<article class="table-card"><span class="eyebrow">NO CLASSES YET</span><h2>Create your first class</h2><p class="muted">New classes start with <b>0 students</b>. Students appear here only after they join using the generated class code.</p></article>`;
    return;
  }
  box.innerHTML = classes.map(c => `
    <article class="table-card">
      <div class="row-heading"><div><span class="eyebrow">CLASS CODE</span><h2>${escapeHtml(c.name)}</h2></div><span class="pill">${c.code}</span></div>
      <p class="muted"><b>${c.students.length}</b> student${c.students.length === 1 ? "" : "s"} joined</p>
      ${c.students.length ? `<div class="student-list">${c.students.map((st,i)=>`<div class="quick-card"><span>🎓</span><div><b>${escapeHtml(st)}</b><small>Joined student</small></div></div>`).join("")}</div>` : `<div class="empty-state">No students have joined yet.</div>`}
    </article>`).join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function setupClassForm() {
  const form = document.getElementById("classForm");
  if (!form) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    if (!requireRole("student")) return;
    const code = document.getElementById("classCode").value.trim().toUpperCase();
    const success = document.getElementById("classSuccess");
    const details = document.getElementById("classDetails");
    const classes = getClasses();
    const found = classes.find(c => c.code === code);
    if (!found) { alert("Class code not found. Ask your teacher for the correct code."); return; }
    const user = getUser();
    if (!found.students.includes(user.name)) found.students.push(user.name);
    saveClasses(classes);
    saveUser({ ...user, classCode: code, classJoined: true });
    if (success) success.classList.remove("hidden");
    if (details) details.textContent = `${found.name} • Teacher: ${found.teacher} • ${found.students.length} student${found.students.length === 1 ? "" : "s"} joined`;
    form.classList.add("hidden");
    const demo = document.querySelector(".demo-code"); if (demo) demo.classList.add("hidden");
  });
}

function setupMission() {
  const list = document.getElementById("missionList");
  const workspace = document.getElementById("missionWorkspace");
  const choicesBox = document.getElementById("missionChoices");
  const result = document.getElementById("decisionResult");
  const hintBtn = document.getElementById("hintBtn");
  const hintBox = document.getElementById("hintBox");
  if (!list || !workspace) return;

  const user = getUser();
  const missions = [
    {id:"student-phish", role:"student", tag:"STUDENT", icon:"🎣", topic:"Phishing", title:"Fake Internship", desc:"A message promises an internship but creates urgency and uses a suspicious domain.", xp:40, sender:"career@google-internship.xyz", meta:"Student • Phishing", risk:"HIGH RISK", body:"<h3>Congratulations! 🎉</h3><p>You have been selected for an internship.</p><p>Complete your registration within <b>30 minutes</b>.</p><p>Click here: <u>google-internship-verify.xyz</u></p>", hint:"Check the sender address, domain and urgency before clicking.", choices:[["⚡ Click the link immediately.",false],["🔎 Check the sender and link carefully.",true],["📤 Share it with friends first.",false],["👍 Trust it because it uses a company name.",false]], explanation:"The sender, unusual domain and urgency are warning signs."},
    {id:"student-privacy", role:"student", tag:"STUDENT", icon:"🔐", topic:"Privacy", title:"Oversharing Location", desc:"A social post is about to reveal your live location and other personal details.", xp:40, sender:"Social App • New Post", meta:"Student • Privacy", risk:"PRIVACY RISK", body:"<h3>Before you post... 📱</h3><p>Your post currently includes your <b>live location</b>, phone number and birthday.</p><p>What should you do before sharing?</p>", hint:"Ask yourself whether strangers need access to each piece of information.", choices:[["🌍 Keep everything public.",false],["🔒 Remove sensitive details and review visibility.",true],["📲 Add your exact daily routine too.",false],["📤 Share it with everyone first.",false]], explanation:"Review visibility and remove sensitive information before posting."},
    {id:"student-bully", role:"student", tag:"STUDENT", icon:"💬", topic:"Cyberbullying", title:"Support, Don't Amplify", desc:"A group chat is repeatedly targeting a student and sharing an embarrassing post.", xp:40, sender:"College Group • 24 members", meta:"Student • Cyberbullying", risk:"SAFETY RISK", body:"<h3>Group chat situation</h3><p>A student is being repeatedly mocked and an embarrassing image is being shared without consent.</p><p>What is a safer response?</p>", hint:"Think about actions that stop the spread and help the person affected.", choices:[["📢 Forward the post to more people.",false],["🛡️ Save evidence, report/block and support the student.",true],["😡 Reply with insults.",false],["😂 Join in so you don't stand out.",false]], explanation:"Don't amplify harassment. Preserve evidence, report/block and support the person."},
    {id:"teacher-phish", role:"teacher", tag:"TEACHER", icon:"👩‍🏫", topic:"Phishing", title:"Classroom Phishing Alert", desc:"Several students receive the same suspicious scholarship message during class.", xp:50, sender:"scholarships@support-award.xyz", meta:"Teacher • Phishing", risk:"HIGH RISK", body:"<h3>Multiple students received this message</h3><p>It asks students to click a link and submit personal information before a short deadline.</p><p>What should you do first as the teacher?</p>", hint:"Focus on stopping further interaction and guiding students to verify safely.", choices:[["🔗 Ask students to click it together.",false],["🛑 Tell students not to interact and teach them how to verify it.",true],["📤 Forward it to another class.",false],["🔓 Ask students to share passwords to check their accounts.",false]], explanation:"Pause interaction, avoid the suspicious link and use the situation as a safe teaching moment."},
    {id:"teacher-privacy", role:"teacher", tag:"TEACHER", icon:"🔐", topic:"Privacy", title:"Protect Student Data", desc:"A class spreadsheet contains student contact details and is about to be shared publicly.", xp:50, sender:"Class File • Sharing", meta:"Teacher • Privacy", risk:"PRIVACY RISK", body:"<h3>Class data check</h3><p>A spreadsheet contains student names, phone numbers and other contact details.</p><p>Someone suggests posting the file in a public group for convenience.</p>", hint:"Consider who actually needs access and what information is necessary.", choices:[["🌐 Post the full file publicly.",false],["🔒 Restrict access and share only necessary information.",true],["📲 Add more personal details for context.",false],["📤 Send the link to everyone online.",false]], explanation:"Student data should be shared only with appropriate people and only when necessary."},
    {id:"teacher-bully", role:"teacher", tag:"TEACHER", icon:"💬", topic:"Cyberbullying", title:"Teacher Intervention", desc:"A student reports repeated online harassment connected to a class group.", xp:50, sender:"Student Report • Class Group", meta:"Teacher • Cyberbullying", risk:"SAFETY RISK", body:"<h3>A student asks for help</h3><p>The student reports repeated hurtful messages and says screenshots are available.</p><p>What is an appropriate first response?</p>", hint:"Listen calmly, preserve relevant evidence and follow your school's reporting/support process.", choices:[["📢 Post the screenshots publicly.",false],["🤝 Listen, preserve evidence and follow the support/reporting process.",true],["😶 Tell the student to handle it alone.",false],["🔥 Encourage a public argument.",false]], explanation:"A calm, supportive response plus the appropriate reporting process helps protect students."},
    {id:"common-scam", role:"common", tag:"EVERYONE", icon:"🔍", topic:"Phishing", title:"Spot the Scam", desc:"A message says your account will be closed today unless you verify immediately.", xp:30, sender:"security-alert@account-check.xyz", meta:"Everyone • Phishing", risk:"HIGH RISK", body:"<h3>Urgent account alert</h3><p>Your account will be suspended today.</p><p>Verify now using the link in this message.</p>", hint:"Urgency plus an unfamiliar domain deserves verification through an official channel.", choices:[["⚡ Click immediately.",false],["🔎 Verify through the official app or website.",true],["📤 Forward it to everyone.",false],["🔑 Reply with your password.",false]], explanation:"Use an official channel to verify alerts instead of trusting the message link."},
    {id:"common-password", role:"common", tag:"EVERYONE", icon:"🔑", topic:"Privacy", title:"Password Check", desc:"Choose the safer everyday account-security habit.", xp:30, sender:"Security Habit • Quick Check", meta:"Everyone • Privacy", risk:"SAFETY CHECK", body:"<h3>Which habit is safer?</h3><p>You use several online accounts every week.</p><p>Choose the action that protects your accounts better.</p>", hint:"Think about unique passwords and extra protection for important accounts.", choices:[["🔁 Reuse one password everywhere.",false],["🛡️ Use unique passwords and enable multi-factor authentication where available.",true],["📋 Share passwords with friends for backup.",false],["📝 Post passwords in a private social group.",false]], explanation:"Unique passwords and multi-factor authentication reduce the impact of a compromised password."},
    {id:"common-post", role:"common", tag:"EVERYONE", icon:"📱", topic:"Privacy", title:"Before You Post", desc:"A photo contains more information than you first notice.", xp:30, sender:"Social Media • Draft Post", meta:"Everyone • Privacy", risk:"PRIVACY CHECK", body:"<h3>One more look...</h3><p>Your photo reveals your location, a school/office badge and the people around you.</p><p>What should you do?</p>", hint:"Check the image and audience, not just the caption.", choices:[["🚀 Post immediately.",false],["🔍 Review the image, remove unnecessary details and check the audience.",true],["📍 Add your exact location.",false],["📤 Tag everyone nearby.",false]], explanation:"Photos can reveal location and other information even when the caption seems harmless."},
    {id:"common-support", role:"common", tag:"EVERYONE", icon:"🤝", topic:"Cyberbullying", title:"What Would You Do?", desc:"You see a hurtful post targeting someone you know.", xp:30, sender:"Social Feed • Public Post", meta:"Everyone • Cyberbullying", risk:"SAFETY CHECK", body:"<h3>A harmful post is spreading</h3><p>You notice a post targeting another person. Others are adding comments.</p><p>Choose a safer action.</p>", hint:"Avoid adding to the harm. Consider support and reporting options.", choices:[["📢 Share it for more attention.",false],["🤝 Don't amplify it; support the person and use report tools when appropriate.",true],["😡 Add an insult.",false],["😂 Encourage others to comment.",false]], explanation:"Don't amplify harmful content. Support the person and use appropriate reporting tools."}
  ];

  let current = null;
  let filter = "all";
  const roleAllowed = m => m.role === "common" || m.role === user.role;
  const labelFor = m => m.role === "common" ? "Everyone" : m.role === "teacher" ? "Teacher" : "Student";

  function renderList() {
    const visible = missions.filter(m => roleAllowed(m) && (filter === "all" || m.role === filter));
    list.innerHTML = visible.map(m => `<button class="mission-card" data-id="${m.id}"><div class="mission-card-top"><span class="mission-icon">${m.icon}</span><span class="mission-tag">${m.tag}</span></div><h3>${m.title}</h3><p>${m.desc}</p><div class="mission-card-footer"><span>${m.topic} • +${m.xp} XP</span><span>Start →</span></div></button>`).join("");
    document.getElementById("missionCounter").textContent = `${visible.length} missions available`;
    list.querySelectorAll(".mission-card").forEach(card => card.addEventListener("click", () => openMission(card.dataset.id)));
  }

  function openMission(id) {
    current = missions.find(m => m.id === id);
    if (!current) return;
    workspace.classList.remove("hidden");
    list.classList.add("hidden");
    document.getElementById("missionTitle").textContent = current.title;
    document.getElementById("missionCounter").textContent = `${labelFor(current)} • ${current.topic} • +${current.xp} XP`;
    document.getElementById("missionIcon").textContent = current.icon;
    document.getElementById("sender").textContent = current.sender;
    document.getElementById("missionMeta").textContent = current.meta;
    document.getElementById("riskLabel").textContent = current.risk;
    document.getElementById("messageBody").innerHTML = current.body;
    choicesBox.innerHTML = current.choices.map((c,i) => `<button class="choice" data-index="${i}"> ${c[0]}</button>`).join("");
    result.className = "result-box hidden";
    result.innerHTML = "";
    hintBox.className = "hint-box hidden";
    hintBox.innerHTML = "";
    hintBtn.classList.remove("hidden");
    hintBtn.textContent = "Give me a hint";
    choicesBox.querySelectorAll(".choice").forEach(btn => btn.addEventListener("click", () => answerMission(Number(btn.dataset.index))));
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function answerMission(index) {
    const buttons = choicesBox.querySelectorAll(".choice");
    const correct = current.choices[index][1];
    buttons.forEach(b => b.classList.remove("correct","wrong"));
    buttons[index].classList.add(correct ? "correct" : "wrong");
    result.className = `result-box ${correct ? "success" : "error"}`;
    if (correct) {
      buttons.forEach(b => b.disabled = true);
      const existing = getUser();
      const alreadyDone = (existing.completedMissionIds || []).includes(current.id);
      const u = alreadyDone ? existing : addXP(current.xp);
      if (!alreadyDone) {
        u.completedMissions = (u.completedMissions || 0) + 1;
        u.completedMissionIds = [...new Set([...(u.completedMissionIds || []), current.id])];
        u.completedTopics = [...new Set([...(u.completedTopics || []), current.topic.toLowerCase() === "privacy" ? "privacy" : current.topic.toLowerCase() === "cyberbullying" ? "cyberbullying" : "phishing"])];
        if (u.completedMissions >= 6) u.badges = Math.max(u.badges, 1);
        saveUser(u);
      }
      result.innerHTML = alreadyDone ? `<b>Mission already completed ✓</b><br>Your progress is already saved for this profile.<br>${current.explanation}` : `<b>Great decision! +${current.xp} XP</b><br>${current.explanation}`;
    } else {
      result.innerHTML = `<b>Try again.</b><br>${current.explanation}`;
    }
  }

  hintBtn.addEventListener("click", () => {
    if (!current) return;
    hintBox.classList.remove("hidden");
    hintBox.innerHTML = `<b>Hint:</b> ${current.hint}`;
    hintBtn.textContent = "Hint unlocked ✓";
  });

  document.querySelectorAll(".mission-filter").forEach(btn => btn.addEventListener("click", () => {
    document.querySelectorAll(".mission-filter").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    filter = btn.dataset.missionFilter;
    workspace.classList.add("hidden");
    list.classList.remove("hidden");
    hintBtn.classList.add("hidden");
    renderList();
  }));

  renderList();
}
const quizQuestions = [
  {
    topic: "PHISHING",
    question: "Which of these is a common phishing warning sign?",
    options: ["An official domain name", "An urgent request + suspicious link", "A normal greeting", "A company logo"],
    answer: 1,
    explanation: "Urgency and suspicious links are common warning signs in phishing messages."
  },
  {
    topic: "PRIVACY",
    question: "Which information should you avoid sharing publicly?",
    options: ["Your favorite color", "A public hobby", "Your OTP or password", "A general interest"],
    answer: 2,
    explanation: "Passwords and OTPs are sensitive information and should never be shared."
  },
  {
    topic: "CYBERBULLYING",
    question: "What is a safer response to repeated online harassment?",
    options: ["Share it with more people", "Reply with insults", "Save evidence and report/block", "Ignore every situation"],
    answer: 2,
    explanation: "Preserving evidence and using platform reporting/blocking tools can help address harmful behavior."
  },
  {
    topic: "PHISHING",
    question: "What should you do before clicking a suspicious link?",
    options: ["Click quickly", "Verify the sender and destination", "Forward it", "Disable security settings"],
    answer: 1,
    explanation: "Verify who sent it and where the link actually leads before interacting with it."
  },
  {
    topic: "PRIVACY",
    question: "Why should you review app permissions?",
    options: ["To make apps faster", "To control what data an app can access", "To increase followers", "To earn badges"],
    answer: 1,
    explanation: "Reviewing permissions helps you control access to personal data such as location, camera or contacts."
  }
];

let quizIndex = 0;
let quizScore = 0;

function renderQuiz() {
  const questionText = document.getElementById("questionText");
  const optionsBox = document.getElementById("options");
  if (!questionText || !optionsBox) return;

  const q = quizQuestions[quizIndex];
  document.getElementById("quizTopic").textContent = q.topic;
  document.getElementById("quizCounter").textContent = `Question ${quizIndex + 1} / ${quizQuestions.length}`;
  document.getElementById("quizProgress").style.width = `${((quizIndex + 1) / quizQuestions.length) * 100}%`;
  questionText.textContent = q.question;
  optionsBox.innerHTML = "";

  q.options.forEach((option, index) => {
    const btn = document.createElement("button");
    btn.className = "quiz-option";
    btn.textContent = `${String.fromCharCode(65 + index)}. ${option}`;
    btn.addEventListener("click", () => selectQuizAnswer(index));
    optionsBox.appendChild(btn);
  });

  document.getElementById("quizFeedback").className = "result-box hidden";
  document.getElementById("nextQuestion").classList.add("hidden");
}

function selectQuizAnswer(index) {
  const q = quizQuestions[quizIndex];
  const buttons = document.querySelectorAll(".quiz-option");
  buttons.forEach(b => b.disabled = true);
  buttons[index].classList.add(index === q.answer ? "correct" : "wrong");
  if (index !== q.answer) buttons[q.answer].classList.add("correct");

  const feedback = document.getElementById("quizFeedback");
  feedback.classList.remove("hidden");
  feedback.className = `result-box ${index === q.answer ? "success" : "error"}`;

  if (index === q.answer) {
    quizScore++;
    const user = addXP(20);
    user.quizCorrect = (user.quizCorrect || 0) + 1;
    if (user.quizCorrect >= 5) user.badges = Math.max(user.badges, 1);
    saveUser(user);
    feedback.innerHTML = `<b>Correct! +20 XP</b><br>${q.explanation}`;
  } else {
    feedback.innerHTML = `<b>Good attempt.</b><br>${q.explanation}`;
  }

  const next = document.getElementById("nextQuestion");
  next.classList.remove("hidden");
  next.textContent = quizIndex === quizQuestions.length - 1 ? "See Result →" : "Next Question →";
}

function setupQuiz() {
  const next = document.getElementById("nextQuestion");
  if (!next) return;
  renderQuiz();

  next.addEventListener("click", () => {
    if (quizIndex < quizQuestions.length - 1) {
      quizIndex++;
      renderQuiz();
    } else {
      document.getElementById("questionText").textContent = `Quiz complete! You scored ${quizScore}/${quizQuestions.length}.`;
      document.getElementById("options").innerHTML = "";
      document.getElementById("quizTopic").textContent = "RESULT";
      document.getElementById("quizCounter").textContent = "Completed";
      document.getElementById("quizFeedback").className = "result-box success";
      document.getElementById("quizFeedback").innerHTML = `Great work! Your score has been added to your learning journey. <a href="dashboard.html" class="text-link">Go to dashboard →</a>`;
      next.classList.add("hidden");
    }
  });
}

const aiReplies = {
  "fake internship": "Check the sender domain, the website address and the urgency. A legitimate recruiter should not pressure you to share passwords or OTPs.",
  "privacy tips": "Keep passwords, OTPs, exact location, financial details and other sensitive information private. Review social-media visibility and app permissions regularly.",
  "cyberbullying": "Don't join the harassment. Save relevant evidence, use block/report tools, support the person affected and involve a trusted adult or appropriate authority when needed.",
  "check a link": "Look at the actual domain, not just the words shown in the message. Be cautious with misspellings, unusual domains, shortened links and urgent requests.",
  "default": "A good cyber-safety habit is to pause, verify the source, identify what information is being requested, and use official channels before acting."
};

function getAIReply(question) {
  const q = question.toLowerCase();
  for (const key of Object.keys(aiReplies)) {
    if (key !== "default" && q.includes(key)) return aiReplies[key];
  }
  if (q.includes("phish") || q.includes("scam")) return aiReplies["fake internship"];
  if (q.includes("private") || q.includes("data") || q.includes("share")) return aiReplies["privacy tips"];
  if (q.includes("bully") || q.includes("harass")) return aiReplies["cyberbullying"];
  if (q.includes("link")) return aiReplies["check a link"];
  return aiReplies.default;
}

function appendChat(text, type) {
  const messages = document.getElementById("chatMessages");
  const row = document.createElement("div");
  row.className = `chat-row ${type}`;
  row.innerHTML = type === "bot"
    ? `<div class="chat-avatar">🤖</div><div class="bubble">${text}</div>`
    : `<div class="bubble">${text}</div>`;
  messages.appendChild(row);
  messages.scrollTop = messages.scrollHeight;
}

function setupCoach() {
  const form = document.getElementById("chatForm");
  if (!form) return;

  const input = document.getElementById("chatInput");
  document.querySelectorAll(".suggestions button").forEach(btn => {
    btn.addEventListener("click", () => {
      const q = btn.dataset.question;
      appendChat(q, "user");
      setTimeout(() => appendChat(getAIReply(q), "bot"), 250);
    });
  });

  form.addEventListener("submit", e => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    appendChat(q, "user");
    input.value = "";
    setTimeout(() => appendChat(getAIReply(q), "bot"), 250);
  });
}


function setupProfilePage() {
  const root = document.getElementById("profilePage");
  if (!root) return;
  const user = getUser();
  const missionIds = user.completedMissionIds || [];
  const topicMissionMap = { phishing: ["student-phish", "teacher-phish", "common-scam"], privacy: ["student-privacy", "teacher-privacy", "common-password", "common-post"], cyberbullying: ["student-bully", "teacher-bully", "common-support"] };
  const progress = {};
  Object.entries(topicMissionMap).forEach(([topic, ids]) => {
    progress[topic] = Math.min(100, Math.round(ids.filter(id => missionIds.includes(id)).length / ids.length * 80) + ((user.completedTopics || []).includes(topic) ? 20 : 0));
  });
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set("profilePageName", user.name || "Learner");
  set("profilePageRole", user.role === "teacher" ? "Teacher" : user.role === "individual" ? "Individual Learner" : "Student");
  set("profilePageLevel", `Level ${user.level}`);
  set("profilePageXP", user.xp);
  const xpBar = document.getElementById("profilePageXPBar");
  if (xpBar) xpBar.style.width = `${(user.xp % 200) / 2}%`;
  set("profilePageMissions", user.completedMissions || 0);
  set("profilePageQuiz", user.quizCorrect || 0);
  set("profilePageStreak", `${user.streak || 0} day${(user.streak || 0) === 1 ? "" : "s"}`);
  set("profilePageClass", user.classJoined ? user.classCode : "Individual learning");
  const initial = (user.name || "L").trim().charAt(0).toUpperCase();
  set("profilePageAvatar", initial);
  Object.entries(progress).forEach(([topic, value]) => {
    const bar = document.querySelector(`[data-profile-progress="${topic}"]`);
    if (bar) bar.style.width = `${value}%`;
    const label = document.querySelector(`[data-profile-label="${topic}"]`);
    if (label) label.textContent = `${value}% complete`;
  });
  const badgeCount = Math.min(6, (user.completedMissions >= 1 ? 1 : 0) + (user.completedMissions >= 2 ? 1 : 0) + (user.completedMissions >= 3 ? 1 : 0) + (user.quizCorrect >= 5 ? 1 : 0) + (Object.values(progress).every(v => v >= 60) ? 1 : 0) + (user.completedMissions >= 6 ? 1 : 0));
  set("profilePageBadges", badgeCount);
}

document.addEventListener("DOMContentLoaded", () => {
  setupUserUI();
  setupProfileForm();
  setupClassForm();
  renderTeacherClasses();
  setupMission();
  setupQuiz();
  setupCoach();
  setupProfilePage();
  setupStudentTasks();
});
