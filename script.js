// ============================================================
//  DATA MANAGER — абстракция для лёгкого перехода на сервер
// ============================================================
const DataManager = {
    _prefix: 'rpg_',

    _get(key) {
        try {
            const raw = localStorage.getItem(this._prefix + key);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    },

    _set(key, value) {
        try {
            localStorage.setItem(this._prefix + key, JSON.stringify(value));
        } catch { /* ignore */ }
    },

    // --- Public API ---
    load() {
        return this._get('state') || null;
    },

    save(state) {
        this._set('state', state);
    },

    clear() {
        localStorage.removeItem(this._prefix + 'state');
    },

    // Для экспорта/импорта
    exportData() {
        return this._get('state');
    },

    importData(data) {
        if (data && typeof data === 'object') {
            this._set('state', data);
            return true;
        }
        return false;
    }
};

// ============================================================
//  SOUND ENGINE (Web Audio API)
// ============================================================
const Sound = {
    _ctx: null,

    _init() {
        if (!this._ctx) {
            try {
                this._ctx = new(window.AudioContext || window.webkitAudioContext)();
            } catch { /* no audio */ }
        }
        return this._ctx;
    },

    _playTone(freq, duration, type = 'sine', volume = 0.2) {
        const ctx = this._init();
        if (!ctx) return;
        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(volume, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration);
        } catch { /* ignore */ }
    },

    ding() {
        this._playTone(880, 0.15, 'sine', 0.15);
        setTimeout(() => this._playTone(1100, 0.12, 'sine', 0.12), 120);
    },

    levelUp() {
        this._playTone(523, 0.12, 'sine', 0.18);
        setTimeout(() => this._playTone(659, 0.12, 'sine', 0.16), 130);
        setTimeout(() => this._playTone(784, 0.18, 'sine', 0.20), 260);
        setTimeout(() => this._playTone(1047, 0.25, 'sine', 0.22), 400);
    },

    questComplete() {
        this._playTone(660, 0.1, 'sine', 0.12);
        setTimeout(() => this._playTone(880, 0.14, 'sine', 0.14), 100);
    }
};

// ============================================================
//  APP STATE
// ============================================================
const DEFAULT_STATE = {
    name: '',
    avatar: '😎',
    skills: {
        strength: { value: 1, xp: 0 },
        intelligence: { value: 1, xp: 0 },
        charisma: { value: 1, xp: 0 },
        endurance: { value: 1, xp: 0 }
    },
    totalXp: 0,
    streak: 0,
    lastCompletionDate: null, // 'YYYY-MM-DD'
    completedQuests: [], // quest IDs completed today
    skippedQuests: [], // quest IDs skipped today
    skipsUsed: 0,
    lastResetDate: null, // 'YYYY-MM-DD'
    dailyQuests: [], // generated for today
    userQuests: [], // custom quests [{id, name, category, skillReward, xpReward}]
    questHistory: [], // [{date, category}] for stats
    levelHistory: [], // [{date, level}] for chart
    settings: {
        theme: 'dark'
    }
};

// Предустановленные задания (≥25)
const PREDEFINED_QUESTS = [
    // Физические 🏋️
    { id: 'p1', name: 'Отжимания', desc: 'Сделай 30 отжиманий', category: 'physical', skillReward: 'strength',
        xpReward: 10 },
    { id: 'p2', name: 'Приседания', desc: 'Сделай 50 приседаний', category: 'physical', skillReward: 'strength',
        xpReward: 10 },
    { id: 'p3', name: 'Планка', desc: 'Держи планку 60 секунд', category: 'physical', skillReward: 'endurance',
        xpReward: 10 },
    { id: 'p4', name: 'Бег', desc: 'Пробеги 2 км', category: 'physical', skillReward: 'endurance', xpReward: 10 },
    { id: 'p5', name: 'Бёрпи', desc: 'Сделай 20 бёрпи', category: 'physical', skillReward: 'strength', xpReward: 10 },
    { id: 'p6', name: 'Растяжка', desc: 'Выполни комплекс растяжки 10 мин', category: 'physical',
        skillReward: 'endurance', xpReward: 10 },
    { id: 'p7', name: 'Подтягивания', desc: 'Сделай 10 подтягиваний', category: 'physical', skillReward: 'strength',
        xpReward: 10 },
    { id: 'p8', name: 'Скакалка', desc: 'Попрыгай на скакалке 5 мин', category: 'physical', skillReward: 'endurance',
        xpReward: 10 },
    // Ментальные 📚
    { id: 'm1', name: 'Чтение', desc: 'Прочитай 20 страниц книги', category: 'mental', skillReward: 'intelligence',
        xpReward: 10 },
    { id: 'm2', name: 'Головоломка', desc: 'Реши 5 логических задач', category: 'mental', skillReward: 'intelligence',
        xpReward: 10 },
    { id: 'm3', name: 'Медитация', desc: 'Медитируй 10 минут', category: 'mental', skillReward: 'intelligence',
        xpReward: 10 },
    { id: 'm4', name: 'Изучение языка', desc: 'Выучи 10 новых слов', category: 'mental', skillReward: 'intelligence',
        xpReward: 10 },
    { id: 'm5', name: 'Кодинг', desc: 'Напиши код 30 минут', category: 'mental', skillReward: 'intelligence',
        xpReward: 10 },
    { id: 'm6', name: 'Шахматы', desc: 'Сыграй партию в шахматы', category: 'mental', skillReward: 'intelligence',
        xpReward: 10 },
    { id: 'm7', name: 'Дневник', desc: 'Напиши 3 страницы в дневник', category: 'mental',
        skillReward: 'intelligence', xpReward: 10 },
    { id: 'm8', name: 'Память', desc: 'Выучи 15 фактов наизусть', category: 'mental', skillReward: 'intelligence',
        xpReward: 10 },
    // Социальные 🗣️
    { id: 's1', name: 'Комплимент', desc: 'Сделай 3 искренних комплимента', category: 'social',
        skillReward: 'charisma', xpReward: 10 },
    { id: 's2', name: 'Знакомство', desc: 'Познакомься с новым человеком', category: 'social',
        skillReward: 'charisma', xpReward: 10 },
    { id: 's3', name: 'Помощь', desc: 'Помоги кому-то в течение дня', category: 'social', skillReward: 'charisma',
        xpReward: 10 },
    { id: 's4', name: 'Публичное выступление', desc: 'Произнеси речь перед 5+ людьми', category: 'social',
        skillReward: 'charisma', xpReward: 10 },
    { id: 's5', name: 'Волонтёрство', desc: 'Потрать 1 час на волонтёрство', category: 'social',
        skillReward: 'charisma', xpReward: 10 },
    { id: 's6', name: 'Нетворкинг', desc: 'Обсуди с коллегой профессиональную тему', category: 'social',
        skillReward: 'charisma', xpReward: 10 },
    { id: 's7', name: 'Благодарность', desc: 'Напиши 3 письма благодарности', category: 'social',
        skillReward: 'charisma', xpReward: 10 },
    { id: 's8', name: 'Коучинг', desc: 'Дай полезный совет кому-то', category: 'social', skillReward: 'charisma',
        xpReward: 10 },
    { id: 's9', name: 'Семейный ужин', desc: 'Проведи время с семьёй без гаджетов', category: 'social',
        skillReward: 'charisma', xpReward: 10 },
];

// Мотивационные цитаты
const QUOTES = [
    '«Каждый день — новый уровень»',
    '«Путь героя начинается с первого шага»',
    '«Ты сильнее, чем думаешь»',
    '«Маленькие победы ведут к большим»',
    '«Будь героем своей жизни»',
    '«Упорство превращает мечты в реальность»',
    '«Каждое действие имеет значение»',
    '«Сила воли — твой главный навык»',
    '«Сегодня ты лучше, чем вчера»',
    '«Игроки не сдаются»',
    '«Опыт — лучший учитель»',
    '«Повышай свои характеристики каждый день»',
    '«Ты — главный герой этой истории»',
    '«Даже 1% прогресса — это победа»',
    '«Собери свою команду и действуй»',
    '«Никто не становится легендой за один день»',
];

// ============================================================
//  APP CONTROLLER
// ============================================================
const App = {
    state: null,
    _levelUpPending: false,

    // --- Инициализация ---
    init() {
        this._loadState();
        this._checkDayReset();
        this._ensureDailyQuests();
        this._applyTheme();
        this._renderAll();
        this._bindEvents();
        this._showDailyQuote();
        this._updateStatsCharts();

        // Если пользователь есть — показываем main
        if (this.state.name) {
            document.getElementById('auth-screen').classList.remove('active');
            document.getElementById('main-app').classList.add('active');
        } else {
            document.getElementById('auth-screen').classList.add('active');
            document.getElementById('main-app').classList.remove('active');
        }
    },

    // --- Загрузка / сохранение ---
    _loadState() {
        const saved = DataManager.load();
        if (saved) {
            // Глубокое слияние с дефолтами
            this.state = this._mergeDeep(JSON.parse(JSON.stringify(DEFAULT_STATE)), saved);
            // Убедимся, что все поля есть
            if (!this.state.settings) this.state.settings = { theme: 'dark' };
            if (!this.state.levelHistory) this.state.levelHistory = [];
            if (!this.state.questHistory) this.state.questHistory = [];
            if (!this.state.userQuests) this.state.userQuests = [];
            if (!this.state.skippedQuests) this.state.skippedQuests = [];
            if (this.state.skipsUsed === undefined) this.state.skipsUsed = 0;
        } else {
            this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
        }
        // Приводим типы
        for (const sk of ['strength', 'intelligence', 'charisma', 'endurance']) {
            if (!this.state.skills[sk]) this.state.skills[sk] = { value: 1, xp: 0 };
            if (this.state.skills[sk].value === undefined) this.state.skills[sk].value = 1;
            if (this.state.skills[sk].xp === undefined) this.state.skills[sk].xp = 0;
        }
    },

    _mergeDeep(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this._mergeDeep(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        return result;
    },

    _save() {
        DataManager.save(this.state);
    },

    // --- Day reset logic ---
    _checkDayReset() {
        const today = this._today();
        const lastReset = this.state.lastResetDate;

        if (lastReset !== today) {
            // Новый день!
            // Сброс выполненных и пропущенных заданий
            this.state.completedQuests = [];
            this.state.skippedQuests = [];
            this.state.skipsUsed = 0;
            this.state.dailyQuests = [];

            // Обновляем streak: если вчера было выполнение — инкремент, иначе сброс
            if (this.state.lastCompletionDate) {
                const yesterday = this._yesterday();
                if (this.state.lastCompletionDate === yesterday) {
                    this.state.streak += 1;
                } else if (this.state.lastCompletionDate !== today) {
                    // Если lastCompletionDate не сегодня и не вчера — сброс
                    this.state.streak = 0;
                }
                // Если lastCompletionDate === сегодня, ничего не меняем (уже учтено)
            } else {
                this.state.streak = 0;
            }

            // Если lastCompletionDate был сегодня, но мы всё равно сбрасываем — оставляем стрик
            // Но если lastCompletionDate !== today и !== yesterday, сброс уже сделан

            this.state.lastResetDate = today;
            this._save();
        }
    },

    _today() {
        return new Date().toISOString().slice(0, 10);
    },
    _yesterday() {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().slice(0, 10);
    },

    // --- Daily quests generation ---
    _ensureDailyQuests() {
        const today = this._today();
        // Если dailyQuests пуст или не для сегодня — генерируем
        if (!this.state.dailyQuests || this.state.dailyQuests.length === 0) {
            this._generateDailyQuests();
        } else {
            // Проверим, что quests не устарели (по дате в id или просто перегенерим)
            // Для простоты — если dailyQuests есть, считаем что они актуальны
            // Но если пользователь добавил новые userQuests, можно перегенерировать
            // Проверяем, все ли quests валидны
            const valid = this.state.dailyQuests.every(q => q && q.id);
            if (!valid || this.state.dailyQuests.length !== 6) {
                this._generateDailyQuests();
            }
        }
    },

    _generateDailyQuests() {
        const allQuests = [...PREDEFINED_QUESTS];
        // Добавляем пользовательские
        for (const uq of this.state.userQuests) {
            allQuests.push({
                id: 'user_' + uq.id,
                name: uq.name,
                desc: uq.desc || 'Пользовательское задание',
                category: uq.category || 'physical',
                skillReward: uq.skillReward || 'strength',
                xpReward: uq.xpReward || 10,
                isUser: true
            });
        }

        // Группируем по категориям
        const physical = allQuests.filter(q => q.category === 'physical');
        const mental = allQuests.filter(q => q.category === 'mental');
        const social = allQuests.filter(q => q.category === 'social');

        const pick = (arr, n) => {
            const shuffled = [...arr].sort(() => Math.random() - 0.5);
            return shuffled.slice(0, n);
        };

        // Берём по 2 из каждой категории (итого 6)
        const selected = [
            ...pick(physical, 2),
            ...pick(mental, 2),
            ...pick(social, 2)
        ];

        // Если в какой-то категории меньше 2, добиваем из других
        while (selected.length < 6) {
            const extra = pick(allQuests, 1);
            if (extra.length) selected.push(extra[0]);
            else break;
        }

        // Добавляем уникальный id для каждого выбранного
        this.state.dailyQuests = selected.map((q, idx) => ({
            ...q,
            dailyId: `d${this._today()}_${idx}_${q.id}`,
            completed: false
        }));

        // Отмечаем уже выполненные
        for (const q of this.state.dailyQuests) {
            if (this.state.completedQuests.includes(q.dailyId)) {
                q.completed = true;
            }
        }

        this._save();
    },

    // --- Theme ---
    _applyTheme() {
        const theme = this.state.settings.theme || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        const toggle = document.getElementById('theme-toggle');
        const label = document.getElementById('theme-label');
        if (theme === 'light') {
            toggle.classList.add('active');
            label.textContent = 'Светлая';
        } else {
            toggle.classList.remove('active');
            label.textContent = 'Тёмная';
        }
    },

    toggleTheme() {
        const current = this.state.settings.theme || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        this.state.settings.theme = next;
        this._applyTheme();
        this._save();
    },

    // --- Quote ---
    _showDailyQuote() {
        const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
        const idx = dayOfYear % QUOTES.length;
        document.getElementById('daily-quote').textContent = '✨ ' + QUOTES[idx];
    },

    // ============================================================
    //  RENDER
    // ============================================================
    _renderAll() {
        this._renderHeader();
        this._renderSkills();
        this._renderQuests();
        this._renderXP();
        this._renderSettings();
        this._updateStatsCharts();
    },

    _renderHeader() {
        document.getElementById('h-avatar').textContent = this.state.avatar || '😎';
        document.getElementById('h-name').textContent = this.state.name || 'Герой';
        const level = this._calcLevel();
        document.getElementById('h-level').textContent = `🏅 Ур. ${level}`;
        document.getElementById('h-streak').textContent = `🔥 ${this.state.streak}`;
    },

    _renderXP() {
        const level = this._calcLevel();
        const xpForNext = this._xpForLevel(level);
        const totalXp = this.state.totalXp || 0;
        const progress = Math.min(totalXp / xpForNext, 1);
        document.getElementById('xp-fill').style.width = (progress * 100) + '%';
        document.getElementById('xp-text').textContent = `${totalXp} / ${xpForNext}`;
    },

    _calcLevel() {
        const skills = this.state.skills;
        const vals = ['strength', 'intelligence', 'charisma', 'endurance'].map(k => skills[k]?.value || 1);
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        return Math.max(1, Math.floor(avg));
    },

    _xpForLevel(level) {
        // Формула: 100 + (level-1) * 50
        return 100 + (level - 1) * 50;
    },

    _renderSkills() {
        const grid = document.getElementById('skills-grid');
        const skills = this.state.skills;
        const skillNames = {
            strength: { label: 'Сила', emoji: '💪', color: '#FF6B6B' },
            intelligence: { label: 'Интеллект', emoji: '🧠', color: '#4ECDC4' },
            charisma: { label: 'Харизма', emoji: '💬', color: '#FFD93D' },
            endurance: { label: 'Выносливость', emoji: '🏃', color: '#6C5CE7' }
        };

        let html = '';
        for (const [key, data] of Object.entries(skills)) {
            const info = skillNames[key];
            const value = data.value || 1;
            const xp = data.xp || 0;
            const xpNeeded = this._xpForSkillLevel(value);
            const progress = Math.min(xp / xpNeeded, 1);
            const circumference = 2 * Math.PI * 45; // r=45
            const offset = circumference * (1 - progress);

            html += `
                        <div class="skill-card skill-${key}">
                            <div class="skill-circle">
                                <svg viewBox="0 0 100 100">
                                    <circle class="bg-circle" cx="50" cy="50" r="45" />
                                    <circle class="progress-circle" cx="50" cy="50" r="45"
                                        stroke-dasharray="${circumference}"
                                        stroke-dashoffset="${offset}" />
                                </svg>
                                <div class="center-text">
                                    ${value}
                                    <small>${info.emoji}</small>
                                </div>
                            </div>
                            <div class="skill-name">${info.label}</div>
                            <div class="skill-xp-bar">
                                <div class="skill-xp-fill" style="width:${progress * 100}%"></div>
                            </div>
                            <div class="skill-xp-text">${xp} / ${xpNeeded} XP</div>
                        </div>
                    `;
        }
        grid.innerHTML = html;
    },

    _xpForSkillLevel(level) {
        return 50 + (level - 1) * 30;
    },

    _renderQuests() {
        const list = document.getElementById('quest-list');
        const count = document.getElementById('quests-count');
        const skipsLeft = document.getElementById('skips-left');

        const quests = this.state.dailyQuests || [];
        const completed = this.state.completedQuests || [];
        const skipped = this.state.skippedQuests || [];
        const available = quests.filter(q => !completed.includes(q.dailyId) && !skipped.includes(q.dailyId));
        const doneCount = completed.length;

        count.textContent = `${doneCount}/6`;
        const skipsRemaining = Math.max(0, 3 - (this.state.skipsUsed || 0));
        skipsLeft.textContent = `⏭️ Пропусков: ${skipsRemaining}`;

        if (quests.length === 0) {
            list.innerHTML = `<div class="text-muted" style="padding:16px;text-align:center;">Нет заданий на сегодня. Перезагрузите страницу.</div>`;
            return;
        }

        const categoryEmoji = {
            physical: '🏋️',
            mental: '📚',
            social: '🗣️'
        };
        const categoryLabel = {
            physical: 'Физические',
            mental: 'Ментальные',
            social: 'Социальные'
        };
        const skillEmoji = {
            strength: '💪',
            intelligence: '🧠',
            charisma: '💬',
            endurance: '🏃'
        };

        let html = '';
        for (const q of quests) {
            const isCompleted = completed.includes(q.dailyId);
            const isSkipped = skipped.includes(q.dailyId);
            const isAvailable = !isCompleted && !isSkipped;

            const catEmoji = categoryEmoji[q.category] || '📌';
            const skillEm = skillEmoji[q.skillReward] || '⭐';

            html += `
                        <div class="quest-card ${isCompleted || isSkipped ? 'completed' : ''}" data-id="${q.dailyId}">
                            <span class="q-icon">${catEmoji}</span>
                            <div class="q-info">
                                <div class="q-title">${q.name}</div>
                                <div class="q-desc">${q.desc || ''}</div>
                            </div>
                            <span class="q-category">${categoryLabel[q.category] || q.category}</span>
                            <span class="q-reward">${skillEm} +${q.xpReward || 5} XP</span>
                            <div class="q-actions">
                                ${isAvailable ? `
                                    <button class="btn btn-sm btn-complete" data-id="${q.dailyId}">✅ Выполнить</button>
                                    ${skipsRemaining > 0 ? `<button class="btn btn-sm btn-skip" data-id="${q.dailyId}">⏭️</button>` : ''}
                                ` : `
                                    <span style="font-size:0.8rem;color:var(--text-muted);">${isCompleted ? '✓ Выполнено' : '⏭️ Пропущено'}</span>
                                `}
                            </div>
                        </div>
                    `;
        }
        list.innerHTML = html;

        // Привязываем события
        list.querySelectorAll('.btn-complete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.dataset.id;
                this._completeQuest(id);
            });
        });
        list.querySelectorAll('.btn-skip').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.dataset.id;
                this._skipQuest(id);
            });
        });
    },

    _renderSettings() {
        // Имя
        document.getElementById('settings-name').value = this.state.name || '';
        // Аватары в настройках
        const container = document.getElementById('settings-avatars');
        container.querySelectorAll('.avatar-option').forEach(el => {
            el.classList.toggle('selected', el.dataset.avatar === this.state.avatar);
        });
        // Пользовательские задания
        this._renderUserQuests();
    },

    _renderUserQuests() {
        const container = document.getElementById('user-quests-list');
        const uqs = this.state.userQuests || [];
        if (uqs.length === 0) {
            container.innerHTML =
            `<div class="text-muted" style="padding:8px 0;">Нет пользовательских заданий</div>`;
            return;
        }
        const catLabel = { physical: '🏋️ Физические', mental: '📚 Ментальные', social: '🗣️ Социальные' };
        const skillEmoji = { strength: '💪', intelligence: '🧠', charisma: '💬', endurance: '🏃' };
        let html = '';
        for (const uq of uqs) {
            html += `
                        <div class="user-quest-item" data-id="${uq.id}">
                            <span>${uq.name}</span>
                            <span class="q-meta">${catLabel[uq.category] || uq.category} · ${skillEmoji[uq.skillReward] || '⭐'} +${uq.xpReward || 5}</span>
                            <button class="btn btn-sm btn-remove-uq" data-id="${uq.id}">✕</button>
                        </div>
                    `;
        }
        container.innerHTML = html;
        container.querySelectorAll('.btn-remove-uq').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                this._removeUserQuest(id);
            });
        });
    },

    // ============================================================
    //  ACTIONS
    // ============================================================

    // --- Auth ---
    startGame(name, avatar) {
        if (!name.trim()) {
            this._toast('⚠️ Введите имя', 'warning');
            return;
        }
        this.state.name = name.trim();
        this.state.avatar = avatar || '😎';
        this.state.lastResetDate = this._today();
        this._generateDailyQuests();
        this._save();
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('main-app').classList.add('active');
        this._renderAll();
        this._toast(`👋 Добро пожаловать, ${this.state.name}!`, 'success');
    },

    // --- Complete quest ---
    _completeQuest(dailyId) {
        const quest = this.state.dailyQuests.find(q => q.dailyId === dailyId);
        if (!quest) return;
        if (this.state.completedQuests.includes(dailyId)) return;
        if (this.state.skippedQuests.includes(dailyId)) return;

        // Отмечаем выполненным
        this.state.completedQuests.push(dailyId);

        // Начисляем XP навыку
        const skillKey = quest.skillReward || 'strength';
        const skill = this.state.skills[skillKey];
        if (skill) {
            const xpGain = quest.xpReward || 5;
            skill.xp = (skill.xp || 0) + xpGain;
            // Проверяем повышение уровня навыка
            const xpNeeded = this._xpForSkillLevel(skill.value || 1);
            while (skill.xp >= xpNeeded && skill.value < 100) {
                skill.value += 1;
                skill.xp -= xpNeeded;
                this._toast(`⬆️ ${this._skillLabel(skillKey)} достигла ${skill.value}!`, 'levelup');
                Sound.questComplete();
            }
            if (skill.value >= 100) skill.xp = 0;
        }

        // Начисляем общий XP
        this.state.totalXp = (this.state.totalXp || 0) + (quest.xpReward || 5);

        // Обновляем стрик (только если это первое задание сегодня)
        const today = this._today();
        if (this.state.lastCompletionDate !== today) {
            // Проверяем, было ли вчера
            const yesterday = this._yesterday();
            if (this.state.lastCompletionDate === yesterday) {
                this.state.streak += 1;
            } else if (this.state.lastCompletionDate !== today) {
                this.state.streak = 1; // или 0? По логике: если сегодня первый раз, стрик = 1
                // Но если не было вчера, то сбрасываем до 1 (сегодняшний день)
                if (this.state.lastCompletionDate && this.state.lastCompletionDate !== yesterday) {
                    this.state.streak = 1;
                } else if (!this.state.lastCompletionDate) {
                    this.state.streak = 1;
                }
            }
            this.state.lastCompletionDate = today;
        }

        // Записываем в историю для статистики
        if (quest.category) {
            this.state.questHistory.push({ date: today, category: quest.category });
        }

        // Проверяем повышение общего уровня
        const oldLevel = this._calcLevel();
        this._save();
        const newLevel = this._calcLevel();

        if (newLevel > oldLevel) {
            this._onLevelUp(oldLevel, newLevel);
        }

        // Записываем в историю уровней
        this.state.levelHistory.push({ date: today, level: newLevel });
        // Оставляем только последние 30 записей
        if (this.state.levelHistory.length > 30) {
            this.state.levelHistory = this.state.levelHistory.slice(-30);
        }

        this._save();
        this._renderAll();
        this._updateStatsCharts();

        // Toast
        const skillEmoji = { strength: '💪', intelligence: '🧠', charisma: '💬', endurance: '🏃' };
        const emoji = skillEmoji[skillKey] || '⭐';
        this._toast(`✅ «${quest.name}» +${quest.xpReward || 5} XP (${emoji})`, 'success');
        Sound.questComplete();

        // Проверка на уровень навыка (уже сделано выше)
    },

    _skillLabel(key) {
        const map = { strength: 'Сила', intelligence: 'Интеллект', charisma: 'Харизма', endurance: 'Выносливость' };
        return map[key] || key;
    },

    // --- Skip quest ---
    _skipQuest(dailyId) {
        const quest = this.state.dailyQuests.find(q => q.dailyId === dailyId);
        if (!quest) return;
        if (this.state.completedQuests.includes(dailyId)) return;
        if (this.state.skippedQuests.includes(dailyId)) return;
        if ((this.state.skipsUsed || 0) >= 3) {
            this._toast('⛔ Лимит пропусков на сегодня исчерпан', 'warning');
            return;
        }

        this.state.skippedQuests.push(dailyId);
        this.state.skipsUsed = (this.state.skipsUsed || 0) + 1;
        this._save();
        this._renderAll();
        this._toast(`⏭️ Задание «${quest.name}» пропущено`, 'info');
    },

    // --- Level up ---
    _onLevelUp(oldLevel, newLevel) {
        Sound.levelUp();
        // Показываем модалку
        const modal = document.getElementById('modal-overlay');
        document.getElementById('modal-icon').textContent = '🎉';
        document.getElementById('modal-title').textContent = `🏆 Уровень ${newLevel}!`;
        document.getElementById('modal-desc').textContent =
            `Поздравляем! Вы повысили уровень с ${oldLevel} до ${newLevel}. Продолжайте в том же духе!`;
        modal.classList.add('active');

        // Конфетти (простое)
        const box = document.getElementById('modal-box');
        const colors = ['#FF6B6B', '#FFD93D', '#4ECDC4', '#6C5CE7', '#FFA500', '#FF6B35'];
        for (let i = 0; i < 30; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = (10 + Math.random() * 80) + '%';
            piece.style.top = (10 + Math.random() * 40) + '%';
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            piece.style.width = (6 + Math.random() * 8) + 'px';
            piece.style.height = (6 + Math.random() * 8) + 'px';
            piece.style.animationDelay = (Math.random() * 0.6) + 's';
            piece.style.position = 'absolute';
            piece.style.pointerEvents = 'none';
            box.appendChild(piece);
            setTimeout(() => piece.remove(), 1200);
        }

        // Закрытие по кнопке
        document.getElementById('modal-btn').onclick = () => {
            modal.classList.remove('active');
        };
        // Закрытие по клику на оверлей
        modal.onclick = (e) => {
            if (e.target === modal) modal.classList.remove('active');
        };
    },

    // --- Settings: update name ---
    updateName(name) {
        if (!name.trim()) {
            this._toast('⚠️ Имя не может быть пустым', 'warning');
            return;
        }
        this.state.name = name.trim();
        this._save();
        this._renderAll();
        this._toast('✅ Имя обновлено', 'success');
    },

    // --- Settings: update avatar ---
    updateAvatar(avatar) {
        this.state.avatar = avatar;
        this._save();
        this._renderAll();
        this._toast('✅ Аватар обновлён', 'success');
    },

    // --- Settings: user quests ---
    addUserQuest(name, category, skillReward, xpReward) {
        if (!name.trim()) {
            this._toast('⚠️ Введите название задания', 'warning');
            return;
        }
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        this.state.userQuests.push({
            id,
            name: name.trim(),
            desc: 'Пользовательское задание',
            category: category || 'physical',
            skillReward: skillReward || 'strength',
            xpReward: Math.min(20, Math.max(1, parseInt(xpReward) || 5))
        });
        this._save();
        // Перегенерируем daily quests, чтобы включить новые
        this._generateDailyQuests();
        this._renderAll();
        this._toast('✅ Пользовательское задание добавлено', 'success');
    },

    _removeUserQuest(id) {
        this.state.userQuests = this.state.userQuests.filter(q => q.id !== id);
        this._save();
        this._generateDailyQuests();
        this._renderAll();
        this._toast('🗑️ Задание удалено', 'info');
    },

    // --- Settings: reset ---
    resetProgress() {
        if (confirm('⚠️ Вы уверены, что хотите сбросить весь прогресс? Это действие необратимо.')) {
            if (confirm('Ещё раз подтвердите: сбросить все данные?')) {
                DataManager.clear();
                this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
                this.state.lastResetDate = this._today();
                this._generateDailyQuests();
                this._save();
                this._renderAll();
                this._toast('🗑️ Прогресс сброшен', 'warning');
                // Возвращаем на экран авторизации
                document.getElementById('auth-screen').classList.add('active');
                document.getElementById('main-app').classList.remove('active');
                document.getElementById('auth-name').value = '';
                document.querySelectorAll('#auth-avatars .avatar-option').forEach(el => el.classList.remove(
                'selected'));
                document.querySelector('#auth-avatars .avatar-option')?.classList.add('selected');
            }
        }
    },

    // --- Export / Import ---
    exportData() {
        const data = DataManager.exportData();
        if (!data) {
            this._toast('⚠️ Нет данных для экспорта', 'warning');
            return;
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rpg_save_${this._today()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this._toast('📤 Данные экспортированы', 'success');
    },

    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (DataManager.importData(data)) {
                    this._loadState();
                    this._checkDayReset();
                    this._ensureDailyQuests();
                    this._applyTheme();
                    this._renderAll();
                    this._updateStatsCharts();
                    this._toast('📥 Данные импортированы успешно', 'success');
                } else {
                    this._toast('⚠️ Ошибка импорта', 'error');
                }
            } catch (err) {
                this._toast('⚠️ Неверный формат файла', 'error');
            }
        };
        reader.readAsText(file);
    },

    // ============================================================
    //  STATS & CHARTS
    // ============================================================
    _updateStatsCharts() {
        this._renderLevelChart();
        this._renderCategoryChart();
    },

    _renderLevelChart() {
        const canvas = document.getElementById('level-chart');
        const ctx = canvas.getContext('2d');
        const rect = canvas.parentElement.getBoundingClientRect();
        const width = canvas.parentElement.clientWidth - 32;
        const height = 200;
        canvas.width = width * 2;
        canvas.height = height * 2;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(2, 2);

        const w = width;
        const h = height;
        const pad = { top: 20, bottom: 28, left: 28, right: 16 };

        // Данные: последние 7 дней
        const history = this.state.levelHistory || [];
        const today = this._today();
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            days.push(key);
        }

        // Собираем уровни для каждого дня
        const levels = days.map(day => {
            const entry = history.find(h => h.date === day);
            return entry ? entry.level : null;
        });

        // Заполняем пропуски последним известным или 1
        let lastKnown = 1;
        const filled = levels.map((v, idx) => {
            if (v !== null) {
                lastKnown = v;
                return v;
            }
            // Если в будущем — используем последний известный
            return lastKnown;
        });

        const data = filled;
        const maxVal = Math.max(1, ...data) + 2;
        const minVal = Math.max(1, Math.min(...data) - 2);

        const chartW = w - pad.left - pad.right;
        const chartH = h - pad.top - pad.bottom;

        ctx.clearRect(0, 0, w, h);

        // Задний фон
        ctx.fillStyle = 'transparent';

        // Оси
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.left, pad.top);
        ctx.lineTo(pad.left, h - pad.bottom);
        ctx.lineTo(w - pad.right, h - pad.bottom);
        ctx.stroke();

        // Подписи
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#777';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        const todayIdx = new Date().getDay();
        const startIdx = (todayIdx + 6) % 7; // 6 дней назад
        for (let i = 0; i < 7; i++) {
            const x = pad.left + (i / 6) * chartW;
            const label = dayLabels[(startIdx + i) % 7];
            ctx.fillText(label, x, h - pad.bottom + 4);
        }

        // Линия
        if (data.length > 1) {
            const points = data.map((v, i) => {
                const x = pad.left + (i / (data.length - 1)) * chartW;
                const y = pad.top + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;
                return { x, y, v };
            });

            // Градиент под линией
            const grad = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
            const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() ||
            '#FFA500';
            grad.addColorStop(0, accent + '55');
            grad.addColorStop(1, accent + '05');
            ctx.beginPath();
            ctx.moveTo(points[0].x, h - pad.bottom);
            for (const p of points) {
                ctx.lineTo(p.x, p.y);
            }
            ctx.lineTo(points[points.length - 1].x, h - pad.bottom);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();

            // Линия
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.strokeStyle = accent;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Точки
            for (const p of points) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = accent;
                ctx.fill();
                ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-card')
                    .trim() || '#1E1E1E';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Значение
                ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text')
                    .trim() || '#EEE';
                ctx.font = '9px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(p.v, p.x, p.y - 6);
            }
        } else {
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() ||
                '#777';
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Нет данных', w / 2, h / 2);
        }
    },

    _renderCategoryChart() {
        const canvas = document.getElementById('category-chart');
        const ctx = canvas.getContext('2d');
        const rect = canvas.parentElement.getBoundingClientRect();
        const width = canvas.parentElement.clientWidth - 32;
        const height = 200;
        canvas.width = width * 2;
        canvas.height = height * 2;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(2, 2);

        const w = width;
        const h = height;
        const pad = 8;

        // Данные: подсчёт по категориям за всё время
        const history = this.state.questHistory || [];
        const counts = { physical: 0, mental: 0, social: 0 };
        for (const entry of history) {
            if (counts.hasOwnProperty(entry.category)) {
                counts[entry.category] += 1;
            }
        }
        const total = Object.values(counts).reduce((a, b) => a + b, 0);

        const colors = ['#FF6B6B', '#4ECDC4', '#FFD93D'];
        const labels = ['🏋️ Физические', '📚 Ментальные', '🗣️ Социальные'];
        const data = [counts.physical, counts.mental, counts.social];

        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(w, h) / 2 - 28;

        ctx.clearRect(0, 0, w, h);

        if (total === 0) {
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() ||
                '#777';
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Нет выполненных заданий', w / 2, h / 2);
            return;
        }

        let startAngle = -Math.PI / 2;
        const sliceData = data.map((val, idx) => {
            const angle = (val / total) * Math.PI * 2;
            const endAngle = startAngle + angle;
            const slice = { start: startAngle, end: endAngle, color: colors[idx], label: labels[idx], value: val };
            startAngle = endAngle;
            return slice;
        });

        // Рисуем сектора
        for (const slice of sliceData) {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, slice.start, slice.end);
            ctx.closePath();
            ctx.fillStyle = slice.color;
            ctx.fill();
            ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-card')
                .trim() || '#1E1E1E';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Легенда (внизу)
        const legendY = h - 16;
        const legendX = pad + 4;
        const itemW = (w - pad * 2 - 16) / 3;
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        for (let i = 0; i < sliceData.length; i++) {
            const x = legendX + i * (itemW + 4);
            ctx.fillStyle = sliceData[i].color;
            ctx.fillRect(x, legendY, 10, 10);
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#EEE';
            const pct = total > 0 ? Math.round((sliceData[i].value / total) * 100) : 0;
            ctx.fillText(`${sliceData[i].label} ${pct}%`, x + 14, legendY);
        }
    },

    // ============================================================
    //  TOAST
    // ============================================================
    _toast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const el = document.createElement('div');
        el.className = 'toast';
        const icons = { success: '✅', warning: '⚠️', error: '❌', info: '💡', levelup: '⬆️' };
        el.innerHTML = `<span class="toast-icon">${icons[type] || '💡'}</span> ${message}`;
        container.appendChild(el);
        setTimeout(() => {
            el.classList.add('hide');
            setTimeout(() => el.remove(), 300);
        }, 2800);
    },

    // ============================================================
    //  BIND EVENTS
    // ============================================================
    _bindEvents() {
        // --- Auth ---
        document.getElementById('auth-start').addEventListener('click', () => {
            const name = document.getElementById('auth-name').value;
            const selected = document.querySelector('#auth-avatars .avatar-option.selected');
            const avatar = selected ? selected.dataset.avatar : '😎';
            this.startGame(name, avatar);
        });
        document.getElementById('auth-name').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('auth-start').click();
        });

        // Avatar selection in auth
        document.querySelectorAll('#auth-avatars .avatar-option').forEach(el => {
            el.addEventListener('click', () => {
                document.querySelectorAll('#auth-avatars .avatar-option').forEach(e => e.classList
                    .remove('selected'));
                el.classList.add('selected');
            });
        });
        // Select first by default
        document.querySelector('#auth-avatars .avatar-option')?.classList.add('selected');

        // --- Settings: avatars ---
        document.querySelectorAll('#settings-avatars .avatar-option').forEach(el => {
            el.addEventListener('click', () => {
                document.querySelectorAll('#settings-avatars .avatar-option').forEach(e => e
                    .classList.remove('selected'));
                el.classList.add('selected');
                this.updateAvatar(el.dataset.avatar);
            });
        });

        // --- Settings: name ---
        document.getElementById('settings-update-name').addEventListener('click', () => {
            const name = document.getElementById('settings-name').value;
            this.updateName(name);
        });
        document.getElementById('settings-name').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('settings-update-name').click();
        });

        // --- Theme toggle ---
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // --- Panels toggle ---
        document.getElementById('btn-stats').addEventListener('click', () => {
            this._togglePanel('stats-panel');
            this._updateStatsCharts();
        });
        document.getElementById('btn-settings').addEventListener('click', () => {
            this._togglePanel('settings-panel');
            this._renderSettings();
        });
        document.querySelectorAll('.close-panel').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.close;
                document.getElementById(id).classList.remove('active');
            });
        });

        // --- User quest add ---
        document.getElementById('uq-add').addEventListener('click', () => {
            const name = document.getElementById('uq-name').value;
            const category = document.getElementById('uq-category').value;
            const skill = document.getElementById('uq-skill').value;
            const amount = parseInt(document.getElementById('uq-amount').value) || 5;
            this.addUserQuest(name, category, skill, amount);
            document.getElementById('uq-name').value = '';
        });
        document.getElementById('uq-name').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('uq-add').click();
        });

        // --- Reset ---
        document.getElementById('reset-data').addEventListener('click', () => {
            this.resetProgress();
        });

        // --- Export ---
        document.getElementById('export-data').addEventListener('click', () => {
            this.exportData();
        });

        // --- Import ---
        document.getElementById('import-data').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
        document.getElementById('import-file').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.importData(e.target.files[0]);
                e.target.value = '';
            }
        });

        // --- Modal close ---
        document.getElementById('modal-btn').addEventListener('click', () => {
            document.getElementById('modal-overlay').classList.remove('active');
        });
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                document.getElementById('modal-overlay').classList.remove('active');
            }
        });

        // --- Keyboard shortcuts ---
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.panel.active').forEach(p => p.classList.remove('active'));
                document.getElementById('modal-overlay').classList.remove('active');
            }
        });
    },

    _togglePanel(id) {
        const panel = document.getElementById(id);
        const isActive = panel.classList.contains('active');
        // Закрываем все панели
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        if (!isActive) {
            panel.classList.add('active');
        }
    }
};

// ============================================================
//  START
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});