// رابط الهوست الخاص بسيرفرك (بدون / في الآخر)
const SERVER_HOST = "http://max4k.xyz";

let userData = null;
let currentSection = 'live';
let allCategories = [];
let allItems = [];
let hls = null;

// التحقق من وجود تسجيل دخول سابق
window.onload = () => {
    const savedUser = localStorage.getItem('iptv_user');
    const savedPass = localStorage.getItem('iptv_pass');
    if (savedUser && savedPass) {
        document.getElementById('username').value = savedUser;
        document.getElementById('password').value = savedPass;
        login(savedUser, savedPass);
    }
};

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    login(user, pass);
});

async function login(username, password) {
    const btn = document.getElementById('login-btn');
    const errBox = document.getElementById('login-error');
    btn.innerText = "جاري الاتصال بالسيرفر...";
    btn.disabled = true;
    errBox.classList.add('hidden');

    try {
        const res = await fetch(`${SERVER_HOST}/player_api.php?username=${username}&password=${password}`);
        const data = await res.json();

        if (data.user_info && data.user_info.auth === 1) {
            userData = { username, password, info: data.user_info };
            localStorage.setItem('iptv_user', username);
            localStorage.setItem('iptv_pass', password);

            // عرض تاريخ الانتهاء
            if (data.user_info.exp_date) {
                const date = new Date(data.user_info.exp_date * 1000);
                document.getElementById('exp-date').innerText = `ينتهي: ${date.toLocaleDateString('ar-EG')}`;
            }

            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('main-screen').classList.remove('hidden');
            switchSection('live');
        } else {
            throw new Error("بيانات الدخول غير صحيحة أو الاشتراك منتهي");
        }
    } catch (err) {
        errBox.innerText = err.message || "فشل الاتصال بالسيرفر، تأكد من الإنترنت والبيانات";
        errBox.classList.remove('hidden');
    } finally {
        btn.innerText = "دخول";
        btn.disabled = false;
    }
}

function logout() {
    localStorage.removeItem('iptv_user');
    localStorage.removeItem('iptv_pass');
    closePlayer();
    document.getElementById('main-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
}

async function switchSection(section) {
    currentSection = section;
    document.getElementById('search-input').value = '';

    // تحديث شكل الأزرار
    ['live', 'vod', 'series'].forEach(tab => {
        const el = document.getElementById(`tab-${tab}`);
        if (tab === section) {
            el.className = "active-tab py-2.5 rounded-xl font-bold text-sm transition";
        } else {
            el.className = "bg-slate-800 text-slate-300 py-2.5 rounded-xl font-bold text-sm transition";
        }
    });

    const catAction = section === 'live' ? 'get_live_categories' : section === 'vod' ? 'get_vod_categories' : 'get_series_categories';
    const itemsAction = section === 'live' ? 'get_live_streams' : section === 'vod' ? 'get_vod_streams' : 'get_series';

    document.getElementById('categories-bar').innerHTML = '<span class="text-xs text-slate-400">جاري تحميل الباقات...</span>';
    document.getElementById('content-grid').innerHTML = '<div class="col-span-full text-center text-slate-400 py-10">جاري التحميل...</div>';

    try {
        const [catRes, itemsRes] = await Promise.all([
            fetch(`${SERVER_HOST}/player_api.php?username=${userData.username}&password=${userData.password}&action=${catAction}`),
            fetch(`${SERVER_HOST}/player_api.php?username=${userData.username}&password=${userData.password}&action=${itemsAction}`)
        ]);

        allCategories = await catRes.json();
        allItems = await itemsRes.json();

        renderCategories();
        renderItems(allItems.slice(0, 100)); // عرض أول 100 عنصر لسرعة الأداء
    } catch (e) {
        document.getElementById('content-grid').innerHTML = '<div class="col-span-full text-center text-red-400 py-10">حدث خطأ أثناء جلب البيانات</div>';
    }
}

function renderCategories() {
    const bar = document.getElementById('categories-bar');
    bar.innerHTML = `<button onclick="selectCategory('all', this)" class="cat-btn bg-blue-600 text-white text-xs px-3.5 py-1.5 rounded-full font-medium">الكل</button>`;
    
    allCategories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = "cat-btn bg-slate-800 text-slate-300 text-xs px-3.5 py-1.5 rounded-full font-medium hover:bg-slate-700";
        btn.innerText = cat.category_name;
        btn.onclick = () => selectCategory(cat.category_id, btn);
        bar.appendChild(btn);
    });
}

function selectCategory(catId, btnElement) {
    document.querySelectorAll('.cat-btn').forEach(b => {
        b.classList.remove('bg-blue-600', 'text-white');
        b.classList.add('bg-slate-800', 'text-slate-300');
    });
    btnElement.classList.remove('bg-slate-800', 'text-slate-300');
    btnElement.classList.add('bg-blue-600', 'text-white');

    if (catId === 'all') {
        renderItems(allItems.slice(0, 150));
    } else {
        const filtered = allItems.filter(item => item.category_id == catId);
        renderItems(filtered);
    }
}

function filterItems() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const filtered = allItems.filter(item => (item.name || '').toLowerCase().includes(query));
    renderItems(filtered.slice(0, 100));
}

function renderItems(items) {
    const grid = document.getElementById('content-grid');
    grid.innerHTML = '';

    if (!items || items.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center text-slate-500 py-10">لا توجد نتائج</div>';
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = "bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col items-center text-center cursor-pointer active:scale-95 transition hover:border-blue-500/50";
        
        const imgUrl = item.stream_icon || item.cover || '';
        const fallbackImg = 'https://via.placeholder.com/150x150/1e293b/94a3b8?text=TV';

        card.innerHTML = `
            <img src="${imgUrl}" onerror="this.src='${fallbackImg}'" class="w-16 h-16 object-contain rounded-lg mb-2 bg-slate-950 p-1">
            <span class="text-xs font-medium text-slate-200 line-clamp-2">${item.name}</span>
        `;

        card.onclick = () => handleItemClick(item);
        grid.appendChild(card);
    });
}

function handleItemClick(item) {
    if (currentSection === 'live') {
        const url = `${SERVER_HOST}/live/${userData.username}/${userData.password}/${item.stream_id}.m3u8`;
        playStream(url, item.name, true);
    } else if (currentSection === 'vod') {
        const ext = item.container_extension || 'mp4';
        const url = `${SERVER_HOST}/movie/${userData.username}/${userData.password}/${item.stream_id}.${ext}`;
        playStream(url, item.name, false);
    } else if (currentSection === 'series') {
        openSeriesDetails(item);
    }
}

function playStream(url, title, isLive) {
    const container = document.getElementById('player-container');
    const video = document.getElementById('video-player');
    document.getElementById('now-playing').innerText = title;
    container.classList.remove('hidden');

    if (hls) {
        hls.destroy();
        hls = null;
    }

    if (isLive && Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
    } else {
        video.src = url;
        video.play();
    }
}

function closePlayer() {
    const video = document.getElementById('video-player');
    video.pause();
    video.src = "";
    if (hls) { hls.destroy(); hls = null; }
    document.getElementById('player-container').classList.add('hidden');
}

async function openSeriesDetails(series) {
    const modal = document.getElementById('series-modal');
    const list = document.getElementById('episodes-list');
    document.getElementById('series-modal-title').innerText = series.name;
    list.innerHTML = '<p class="text-center text-slate-400 text-sm">جاري تحميل الحلقات...</p>';
    modal.classList.remove('hidden');

    try {
        const res = await fetch(`${SERVER_HOST}/player_api.php?username=${userData.username}&password=${userData.password}&action=get_series_info&series_id=${series.series_id}`);
        const data = await res.json();
        list.innerHTML = '';

        const episodesObj = data.episodes || {};
        Object.keys(episodesObj).forEach(seasonNum => {
            const seasonHeader = document.createElement('div');
            seasonHeader.className = "text-xs font-bold text-blue-400 pt-2 pb-1";
            seasonHeader.innerText = `الموسم ${seasonNum}`;
            list.appendChild(seasonHeader);

            episodesObj[seasonNum].forEach(ep => {
                const epBtn = document.createElement('button');
                epBtn.className = "w-full text-right bg-slate-800 hover:bg-slate-700 p-3 rounded-xl text-xs flex justify-between items-center";
                epBtn.innerHTML = `<span>${ep.title || 'حلقة ' + ep.episode_num}</span><span class="text-blue-400">▶ تشغيل</span>`;
                epBtn.onclick = () => {
                    const ext = ep.container_extension || 'mp4';
                    const url = `${SERVER_HOST}/series/${userData.username}/${userData.password}/${ep.id}.${ext}`;
                    closeSeriesModal();
                    playStream(url, `${series.name} - ${ep.title}`, false);
                };
                list.appendChild(epBtn);
            });
        });
    } catch (e) {
        list.innerHTML = '<p class="text-center text-red-400 text-sm">فشل تحميل الحلقات</p>';
    }
}

function closeSeriesModal() {
    document.getElementById('series-modal').classList.add('hidden');
}
