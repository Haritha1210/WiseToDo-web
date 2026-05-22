const API_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:3001/api'
    : 'https://wisetodo-web-1.onrender.com/api';
let authToken = localStorage.getItem('token');
let currentUsername = localStorage.getItem('username');
const defaultAvatar = 'https://ui-avatars.com/api/?name=User&background=fff&color=FA8072';

// Audio for completion
const completionSound = new Audio('https://actions.google.com/sounds/v1/ui/beep_short.ogg');

const centerTextPlugin = {
    id: 'centerText',
    beforeDraw(chart) {
        const { ctx, width, height } = chart;
        ctx.save();
        const fontSize = (height / 80).toFixed(2);
        ctx.font = `${fontSize}em sans-serif`;
        ctx.textBaseline = 'middle';
        const text = Math.round(chart.data.datasets[0].data[0]) + '%';
        const textX = Math.round((width - ctx.measureText(text).width) / 2);
        const textY = height / 2;
        ctx.fillStyle = '#1e293b';
        ctx.fillText(text, textX, textY);
        ctx.restore();
    }
};

Chart.register(centerTextPlugin);

// State
const state = {
    dashboardTasks: [],
    habits: [],
    rememberTasks: [],
    importantDays: [],
    todoList: [],
    stickyNotes: [],
    charts: {},
    profile: {},
    calendar: {
        year: new Date().getFullYear(),
        month: new Date().getMonth()
    }
};

const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const defaultStickyQuotes = [
    "Small steps every day lead to big results.",
    "Your future self will thank you for what you do today.",
    "Stay focused, stay positive, and keep moving forward.",
    "Make today productive — one task at a time.",
    "A strong routine is the secret to long-term success.",
    "Turn your ideas into action with consistency.",
    "A calm mind and steady habits create powerful progress.",
    "Keep growing by doing one meaningful task today.",
    "Good habits are the foundation of every success.",
    "Stay present, stay productive, and trust the process.",
    "Choose courage and keep your daily goals in sight.",
    "Every new day is a fresh chance to improve.",
    "Make the small wins count — one action at a time.",
    "Well-planned effort today builds a stronger tomorrow.",
    "Create momentum with consistent daily focus."
];

const stickyQuoteCount = 6;

function getRandomQuotes(count) {
    const quotes = [...defaultStickyQuotes];
    const result = [];
    while (result.length < count && quotes.length) {
        const index = Math.floor(Math.random() * quotes.length);
        result.push(quotes.splice(index, 1)[0]);
    }
    return result;
}

// DOM Elements
const landingView = document.getElementById('landing-view');
const authView = document.getElementById('auth-view');
const mainView = document.getElementById('main-view');
const authForm = document.getElementById('auth-form');
const authToggleLink = document.getElementById('auth-toggle-link');
const authErrorEl = document.getElementById('auth-error');
const usernameGroup = document.getElementById('username-group');
const sidebarUsername = document.getElementById('sidebar-username');
const sidebarEmail = document.getElementById('sidebar-email');
const userAvatar = document.getElementById('user-avatar');
const welcomeName = document.getElementById('welcome-name');
const currentDateEl = document.getElementById('current-date');

// Landing DOM Elements
const landingSignIn = document.getElementById('landing-signin');
const landingSignUp = document.getElementById('landing-signup');
const landingCta = document.getElementById('landing-cta-btn');

// Profile DOM Elements
const profileNameInput = document.getElementById('profile-name');
const profileEmailInput = document.getElementById('profile-email');
const profileAvatarEl = document.getElementById('profile-page-avatar');
const statStreak = document.getElementById('stat-streak');
const statPerformance = document.getElementById('stat-performance');

let isLoginMode = true;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const options = { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' };
    currentDateEl.textContent = new Date().toLocaleDateString('en-GB', options);

    if (authToken) showMainApp();
    else showLanding();
    
    setupNavigation();
});

// --- LANDING ---
function showLanding() {
    authView.classList.remove('active');
    mainView.classList.remove('active');
    landingView.classList.add('active');
}

landingSignIn.addEventListener('click', () => {
    setAuthMode(true);
    showAuthView();
});

landingSignUp.addEventListener('click', () => {
    setAuthMode(false);
    showAuthView();
});

landingCta.addEventListener('click', () => {
    setAuthMode(false);
    showAuthView();
});

// --- AUTHENTICATION ---
function setAuthMode(loginMode) {
    isLoginMode = loginMode;
    document.getElementById('auth-title').textContent = isLoginMode ? 'Welcome Back' : 'Create Account';
    document.getElementById('auth-subtitle').textContent = isLoginMode ? 'Please log in to your account.' : 'Sign up to get started.';
    document.getElementById('auth-submit-btn').textContent = isLoginMode ? 'Sign In' : 'Sign Up';
    document.getElementById('auth-toggle-text').textContent = isLoginMode ? "Don't have an account?" : "Already have an account?";
    authToggleLink.textContent = isLoginMode ? 'Sign Up' : 'Sign In';
    usernameGroup.style.display = isLoginMode ? 'none' : 'block';
}

authToggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    clearAuthError();
    setAuthMode(!isLoginMode);
});

function isStrongPassword(password) {
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const isLongEnough = password.length >= 8;
    return hasUppercase && hasLowercase && hasNumber && isLongEnough;
}

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthError();

    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const username = document.getElementById('auth-username').value.trim();
    
    if (!isLoginMode && !isStrongPassword(password)) {
        return showAuthError('Password must be at least 8 characters and include uppercase, lowercase, and a number.');
    }

    const btn = document.getElementById('auth-submit-btn');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Please wait...';

    const endpoint = isLoginMode ? '/login' : '/register';
    const payload = isLoginMode ? { email, password } : { username, email, password };
    
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeout);
        
        const data = await res.json();
        if (res.ok) {
            if (isLoginMode) {
                authToken = data.token;
                currentUsername = data.username;
                localStorage.setItem('token', authToken);
                localStorage.setItem('username', currentUsername);
                showMainApp();
            } else {
                showAuthError('Account created successfully! Please sign in with your credentials.');
                setAuthMode(true);
                document.getElementById('auth-password').value = '';
                document.getElementById('auth-username').value = '';
            }
        } else {
            showAuthError(data.error || 'Invalid credentials. Please check and try again.');
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            showAuthError('Request timed out. The backend may be starting up. Please try again.');
        } else {
            showAuthError('Cannot reach the server. Please check your connection and try again.');
        }
    } finally {
        btn.disabled = false;
        btn.textContent = origText;
    }
});

function showAuthError(message) {
    authErrorEl.textContent = message;
    authErrorEl.classList.add('active');
}

function clearAuthError() {
    authErrorEl.textContent = '';
    authErrorEl.classList.remove('active');
}

const passwordInput = document.getElementById('auth-password');
const passwordToggleBtn = document.getElementById('password-toggle-btn');

if (passwordToggleBtn) {
    passwordToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        passwordToggleBtn.innerHTML = isPassword ? '<i class="fa-regular fa-eye"></i>' : '<i class="fa-regular fa-eye-slash"></i>';
    });
}

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    authToken = null;
    showLanding();
});

function showAuthView() {
    landingView.classList.remove('active');
    mainView.classList.remove('active');
    authView.classList.add('active');
}

function showMainApp() {
    landingView.classList.remove('active');
    authView.classList.remove('active');
    mainView.classList.add('active');
    loadAllData();
}

// --- NAVIGATION ---
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link[data-target]');
    const pages = document.querySelectorAll('.page');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            pages.forEach(p => p.classList.remove('active'));
            const target = link.getAttribute('data-target');
            document.getElementById(`page-${target}`).classList.add('active');
            
            // if profile clicked, populate fields
            if(target === 'profile') populateProfileForm();
        });
    });
}

// --- API HELPERS ---
async function fetchResource(type) {
    try {
        const res = await fetch(`${API_URL}/data/${type}`, { headers: { 'Authorization': authToken } });
        if (!res.ok) return [];
        return await res.json();
    } catch {
        return [];
    }
}

async function loadAllData() {
    try {
        const profileRes = await fetch(`${API_URL}/profile`, { headers: { 'Authorization': authToken } });
        if (profileRes.ok) {
            state.profile = await profileRes.json();
        }
        
        const results = await Promise.allSettled([
            fetchResource('dashboardTasks'),
            fetchResource('habits'),
            fetchResource('rememberTasks'),
            fetchResource('importantDays'),
            fetchResource('todoList'),
            fetchResource('stickyNotes')
        ]);
        
        state.dashboardTasks = results[0].value || [];
        state.habits = results[1].value || [];
        state.rememberTasks = results[2].value || [];
        state.importantDays = results[3].value || [];
        state.todoList = results[4].value || [];
        state.stickyNotes = results[5].value || [];
        
        // Update sidebar
        const avatarUrl = state.profile.avatar || defaultAvatar;
        sidebarUsername.textContent = state.profile.username || 'User';
        welcomeName.textContent = state.profile.username || 'User';
        sidebarEmail.textContent = state.profile.email || '';
        userAvatar.src = avatarUrl;
        profileAvatarEl.src = avatarUrl;
        
        renderDashboard();
        renderHabits();
        renderRememberTasks();
        renderImportantDays();
        renderTodoList();
        renderStickyWall();
        renderImportantCalendar();
        fetchAIRecommendations();
        updateProfileStats();
    } catch (err) {
        console.error(err);
    }
}

// --- PROFILE ---
function populateProfileForm() {
    profileNameInput.value = state.profile.username;
    profileEmailInput.value = state.profile.email;
    updateProfileStats();
}

function updateProfileStats() {
    const totalStreaks = state.habits.reduce((acc, curr) => acc + (curr.streak || 0), 0);
    statStreak.textContent = totalStreaks;

    // Calc Performance % across Dashboard, Remember, Todo
    let totalItems = state.dashboardTasks.length + state.rememberTasks.length + state.todoList.length;
    let completedItems = 
        state.dashboardTasks.filter(t => t.completed).length +
        state.rememberTasks.filter(t => t.completed).length +
        state.todoList.filter(t => t.completed).length;
    
    let perf = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);
    statPerformance.textContent = `${perf}%`;
}

document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const res = await fetch(`${API_URL}/profile`, {
            method: 'PUT',
            headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: profileNameInput.value,
                email: profileEmailInput.value
            })
        });
        const data = await res.json();
        state.profile = data;
        loadAllData(); // refresh everything
        alert("Profile updated successfully!");
    } catch (err) {
        console.error(err);
    }
});

document.getElementById('avatar-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            try {
                await fetch(`${API_URL}/profile`, {
                    method: 'PUT',
                    headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ avatar: base64 })
                });
                loadAllData();
            } catch (err) {
                console.error(err);
            }
        };
        reader.readAsDataURL(file);
    }
});

// --- MODAL & FORMS ---
const modal = document.getElementById('global-modal');
const modalType = document.getElementById('modal-type');
const titleInput = document.getElementById('modal-input-title');
const dateInput = document.getElementById('modal-input-date');

window.openModal = (type, selectedDate = '') => {
    modalType.value = type;
    titleInput.value = '';
    dateInput.value = selectedDate;
    
    document.getElementById('modal-group-date').style.display = 'none';
    dateInput.required = false;
    
    if (type === 'dashboardTask') {
        document.getElementById('modal-title').textContent = 'Add Dashboard Task';
    } else if (type === 'habit') {
        document.getElementById('modal-title').textContent = 'Add Daily Habit';
    } else if (type === 'rememberTask' || type === 'importantDay') {
        document.getElementById('modal-title').textContent = type === 'rememberTask' ? 'Add Deadline Task' : 'Add Important Date';
        document.getElementById('modal-group-date').style.display = 'block';
        dateInput.required = true;
    } else if (type === 'todoList') {
        document.getElementById('modal-title').textContent = 'Add Todo Item';
    } else if (type === 'stickyNote') {
        document.getElementById('modal-title').textContent = 'Add Sticky Note';
    }
    
    modal.classList.add('active');
}

window.closeModal = () => { modal.classList.remove('active'); }

document.getElementById('global-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = modalType.value;
    const title = titleInput.value;
    const date = dateInput.value;
    
    let payload = { title, completed: false };
    if (type === 'rememberTask' || type === 'importantDay') payload.date = date;
    if (type === 'habit') {
        payload.streak = 0;
        payload.started = false;
    }
    if (type === 'stickyNote') payload.note = title;

    const backendMap = {
        'dashboardTask': 'dashboardTasks',
        'habit': 'habits',
        'rememberTask': 'rememberTasks',
        'importantDay': 'importantDays',
        'todoList': 'todoList',
        'stickyNote': 'stickyNotes'
    };
    
    const resourceType = backendMap[type];

    try {
        const res = await fetch(`${API_URL}/data/${resourceType}`, {
            method: 'POST',
            headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
            const data = await res.json();
            alert(data.error);
            return;
        }
        
        closeModal();
        loadAllData();
    } catch (err) { console.error(err); }
});

// Delete helper
window.deleteItem = async (type, id) => {
    await fetch(`${API_URL}/data/${type}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': authToken }
    });
    loadAllData();
}

// Toggle helper
window.toggleTaskStatus = async (type, id, checked) => {
    let payload = { completed: checked };
    if (type === 'dashboardTasks') {
        payload.status = checked ? 'Completed' : 'Not Started';
    }
    
    if (checked) {
        completionSound.currentTime = 0;
        completionSound.play().catch(e => console.log('Audio play failed:', e));
    }

    await fetch(`${API_URL}/data/${type}/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    loadAllData();
}

window.toggleHabitStatus = async (id, field, checked) => {
    const item = state.habits.find(h => h.id === id);
    if (!item) return;

    const payload = {};
    if (field === 'started') {
        payload.started = checked;
        if (!checked) {
            payload.completed = false;
        }
    }

    if (field === 'completed') {
        payload.completed = checked;
        if (checked) payload.started = true;
    }

    if ('completed' in payload && payload.completed) {
        payload.streak = (item.streak || 0) + 1;
    } else if ('completed' in payload && !payload.completed) {
        payload.streak = Math.max(0, item.streak || 0);
    }

    await fetch(`${API_URL}/data/habits/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    loadAllData();
}

// --- RENDERING ---
function renderDashboard() {
    const list = document.getElementById('dashboard-task-list');
    list.innerHTML = '';
    
    let completed = 0, inProgress = 0, notStarted = 0;

    state.dashboardTasks.forEach(task => {
        const status = task.status || (task.completed ? 'Completed' : 'Not Started');
        const isCompleted = status === 'Completed';
        const statusClass = status === 'Completed' ? 'completed' : status === 'In Progress' ? 'progress' : 'notstarted';

        if (isCompleted) completed++;
        else if (status === 'In Progress') inProgress++;
        else notStarted++;

        list.innerHTML += `
            <li class="task-card dashboard-task-card ${isCompleted ? 'task-completed' : ''}">
                <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleTaskStatus('dashboardTasks', '${task.id}', this.checked)">
                <div class="task-info" style="flex:1">
                    <h4 style="margin: 0; text-decoration: ${isCompleted ? 'line-through' : 'none'}; opacity: ${isCompleted ? '0.5' : '1'}">${escapeHTML(task.title)}</h4>
                    <select class="status-select ${statusClass}" onchange="updateDashboardStatus('${task.id}', this.value)">
                        <option value="Not Started" ${status === 'Not Started' ? 'selected' : ''}>Not Started</option>
                        <option value="In Progress" ${status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                        <option value="Completed" ${status === 'Completed' ? 'selected' : ''}>Completed</option>
                    </select>
                </div>
                <div class="task-actions">
                    <button class="add-btn delete-btn" onclick="deleteItem('dashboardTasks', '${task.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </li>
        `;
    });

    const total = Math.max(state.dashboardTasks.length, 1);
    updateChart('chart-completed', (completed/total)*100, '#10b981');
    updateChart('chart-progress', (inProgress/total)*100, '#3b82f6');
    updateChart('chart-notstarted', (notStarted/total)*100, '#ef4444');
}

window.updateDashboardStatus = async (id, status) => {
    const completed = status === 'Completed';
    await fetch(`${API_URL}/data/dashboardTasks/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, completed })
    });
    loadAllData();
};

function updateChart(id, percentage, color) {
    if (state.charts[id]) state.charts[id].destroy();
    
    const ctx = document.getElementById(id).getContext('2d');
    state.charts[id] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [percentage, Math.max(0, 100 - percentage)],
                backgroundColor: [color, '#f1f5f9'],
                borderWidth: 0
            }]
        },
        options: { cutout: '75%', responsive: true, plugins: { tooltip: { enabled: false } } }
    });
}

async function fetchAIRecommendations() {
    try {
        const res = await fetch(`${API_URL}/recommendations`, { headers: { 'Authorization': authToken } });
        const data = await res.json();
        
        const list = document.getElementById('ai-habits-list');
        list.innerHTML = '';
        data.forEach(habit => {
            list.innerHTML += `
                <li class="habit-item">
                    <span>${escapeHTML(habit)}</span>
                    <button onclick="addAIHabit('${escapeHTML(habit)}')">+</button>
                </li>
            `;
        });
    } catch(err) { console.error(err); }
}

window.addAIHabit = async (title) => {
    await fetch(`${API_URL}/data/habits`, {
        method: 'POST',
        headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, streak: 0, completed: false, started: false })
    });
    loadAllData();
}

function renderHabits() {
    const list = document.getElementById('my-habits-list');
    list.innerHTML = '';

    let notStartedCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;

    state.habits.forEach(h => {
        const completed = !!h.completed;
        const started = !!h.started || completed;
        const titleStyles = completed ? 'text-decoration: line-through; opacity: 0.5;' : '';
        const statusLabel = completed ? 'Completed' : started ? 'In Progress' : 'Not Started';

        if (completed) completedCount++;
        else if (started) inProgressCount++;
        else notStartedCount++;

        list.innerHTML += `
            <div class="habit-item">
                <div style="flex:1; min-width:0;">
                    <h4 style="margin:0; ${titleStyles}">${escapeHTML(h.title)}</h4>
                    <p style="margin:0.5rem 0 0; color:var(--accent); font-weight:600">🔥 ${h.streak || 0} Day Streak</p>
                    <p style="margin:0.5rem 0 0; color:var(--text-secondary); font-size:0.9rem">${statusLabel}</p>
                    <div class="habit-controls">
                        <label class="habit-control"><input type="checkbox" ${started ? 'checked' : ''} onchange="toggleHabitStatus('${h.id}', 'started', this.checked)"> Started</label>
                        <label class="habit-control"><input type="checkbox" ${completed ? 'checked' : ''} onchange="toggleHabitStatus('${h.id}', 'completed', this.checked)"> Completed</label>
                    </div>
                </div>
                <button class="add-btn" style="border:none" onclick="deleteItem('habits', '${h.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    });

    document.getElementById('habit-notstarted-count').textContent = notStartedCount;
    document.getElementById('habit-inprogress-count').textContent = inProgressCount;
    document.getElementById('habit-completed-count').textContent = completedCount;
}

function renderRememberTasks() {
    const list = document.getElementById('remember-task-list');
    list.innerHTML = '';
    state.rememberTasks.forEach(t => {
        list.innerHTML += `
            <li class="task-card">
                <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTaskStatus('rememberTasks', '${t.id}', this.checked)">
                <div class="task-info" style="flex:1; text-decoration: ${t.completed ? 'line-through' : 'none'}; opacity: ${t.completed ? '0.5' : '1'}">
                    <h4>${escapeHTML(t.title)}</h4>
                    <p style="color:var(--notstarted); font-weight:bold"><i class="fa-regular fa-clock"></i> Deadline: ${t.date}</p>
                </div>
                <button class="add-btn" style="border:none" onclick="deleteItem('rememberTasks', '${t.id}')"><i class="fa-solid fa-trash"></i></button>
            </li>
        `;
    });
}

function renderImportantDays() {
    const list = document.getElementById('important-days-list');
    list.innerHTML = '';

    if (state.importantDays.length === 0) {
        list.innerHTML = '<p class="empty-state">No pinned dates yet. Click a date in the calendar to add one.</p>';
        return;
    }

    state.importantDays.forEach(d => {
        list.innerHTML += `
            <div class="important-event-card">
                <div>
                    <h4>${escapeHTML(d.title)}</h4>
                    <p><i class="fa-regular fa-calendar"></i> ${d.date}</p>
                </div>
                <button class="delete-icon" onclick="deleteItem('importantDays', '${d.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    });
}

function renderImportantCalendar() {
    const monthLabel = new Date(state.calendar.year, state.calendar.month, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    document.getElementById('calendar-month-name').textContent = monthLabel;

    const grid = document.getElementById('important-calendar');
    grid.innerHTML = '';

    dayNames.forEach(day => {
        grid.innerHTML += `<div class="calendar-cell calendar-day-header">${day}</div>`;
    });

    const firstDay = new Date(state.calendar.year, state.calendar.month, 1).getDay();
    for (let i = 0; i < firstDay; i++) {
        grid.innerHTML += '<div class="calendar-cell empty"></div>';
    }

    const daysInMonth = new Date(state.calendar.year, state.calendar.month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
        const dateString = `${state.calendar.year}-${String(state.calendar.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateString === new Date().toISOString().slice(0, 10);
        const event = state.importantDays.find(item => item.date === dateString);
        const pinnedClass = event ? 'pinned' : '';

        grid.innerHTML += `
            <div class="calendar-cell ${pinnedClass} ${isToday ? 'today' : ''}" onclick="openModal('importantDay', '${dateString}')">
                <span class="calendar-day-number">${day}</span>
                ${event ? `<span class="event-dot" title="${escapeHTML(event.title)}"></span>` : ''}
            </div>
        `;
    }
}

window.changeImportantMonth = (direction) => {
    state.calendar.month += direction;
    if (state.calendar.month < 0) {
        state.calendar.month = 11;
        state.calendar.year -= 1;
    }
    if (state.calendar.month > 11) {
        state.calendar.month = 0;
        state.calendar.year += 1;
    }
    renderImportantCalendar();
};

window.openStickyNoteModal = () => {
    openModal('stickyNote');
};

function renderTodoList() {
    const list = document.getElementById('todo-list-items');
    list.innerHTML = '';
    state.todoList.forEach(t => {
        list.innerHTML += `
            <li class="task-card">
                <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTaskStatus('todoList', '${t.id}', this.checked)">
                <div class="task-info" style="flex:1; text-decoration: ${t.completed ? 'line-through' : 'none'}; opacity: ${t.completed ? '0.5' : '1'}">
                    <h4 style="margin:0">${escapeHTML(t.title)}</h4>
                </div>
                <button class="add-btn" style="border:none" onclick="deleteItem('todoList', '${t.id}')" data-html2canvas-ignore><i class="fa-solid fa-trash"></i></button>
            </li>
        `;
    });
}

window.exportPDF = () => {
    const element = document.getElementById('pdf-content');
    const opt = {
        margin:       1,
        filename:     'Todo-List.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
}

function renderStickyWall() {
    const wall = document.getElementById('sticky-wall');
    const userNotes = state.stickyNotes.map(note => ({ id: note.id, title: note.note || note.title, builtIn: false }));
    const dynamicQuotes = getRandomQuotes(stickyQuoteCount).map((quote, index) => ({ id: `dynamic-${index}-${Date.now()}`, title: quote, builtIn: true }));
    const notes = userNotes.length > 0 ? [...dynamicQuotes, ...userNotes] : dynamicQuotes;

    wall.innerHTML = notes.map(note => `
        <div class="sticky-note ${note.builtIn ? 'built-in' : ''}">
            <p>${escapeHTML(note.title)}</p>
            ${note.builtIn ? '' : `<button class="sticky-note-delete" onclick="deleteItem('stickyNotes', '${note.id}')"><i class="fa-solid fa-xmark"></i></button>`}
        </div>
    `).join('');
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}
