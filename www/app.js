// رابط ملف الإعدادات المركزي (لتعديل الهوست مستقبلاً بدون تغيير الـ APK)
const CONFIG_URL = "https://raw.githubusercontent.com/ziadsia/max-iptv-app/main/config.json";

let SERVER_HOST = "http://max4k.xyz"; 
let userData = null;
let currentSection = 'live';
let allCategories = [];
let allItems = [];
let hls = null;

window.onload = async () => {
    await fetchServerConfig();
    const savedUser = localStorage.getItem('iptv_user');
    const savedPass = localStorage.getItem('iptv_pass');
    if (savedUser && savedPass) {
        document.getElementById('username').value = savedUser;
        document.getElementById('password').value = savedPass;
        login(savedUser, savedPass);
    }
};

async function fetchServerConfig() {
    try {
        const res = await fetch(CONFIG_URL + "?t=" + new Date().getTime());
        const data = await res.json();
        if (data.server_host) {
            SERVER_HOST = data.server_host;
        }
    } catch (e) {
        console.log("استخدام الهوست الافتراضي");
    }
}

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    login(user, pass);
});

async function login(username, password) {
    const btn = document.getElementById('login-btn');
    const errBox = document.getElementById('login-error');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin ml-2"></i> جاري الاتصال...';
    btn.disabled = true;
    errBox.classList.add('hidden');

    try {
        await fetchServerConfig();
        const res = await fetch(`${SERVER_HOST}/player_api.php?username=${username}&password=${password}`);
        const data = await res.json();

        if (data.user_info && data.user_info.auth === 1) {
            userData = { username, password, info: data.user_info };
            localStorage.setItem('iptv_user', username);
            localStorage.setItem('iptv_pass', password);

            if (data.user_info.exp_date) {
                const date = new Date(data.user_info.exp_date * 1000);
                document.getElementById('exp-date').innerText = `${date.toLocaleDateString('ar-EG')} `;
            } else {
                 document.getElementById('exp-date').innerText = "غير محدود";
            }

            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('main-screen').classList.remove('hidden');
            switchSection('live');
        } else {
            throw new Error("بيانات الدخول غير صحيحة");
        }
    } catch (err) {
        errBox.innerText = err.message || "فشل الاتصال بالسيرفر";
        errBox.classList.remove('hidden');
    } finally {
        btn.innerText = "تسجيل الدخول";
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

    ['live', 'vod', 'series'].forEach(tab => {
        const el = document.getElementById(`tab-${tab}`);
        const icon = el.querySelector('i');
        if (tab === section) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
    
    const titles = { live: 'القنوات', vod: 'الأفلام', series: 'المسلسلات' };
    document.getElementById('sidebar-title').innerText = titles[section];

    const catAction = section === 'live' ? 'get_live_categories' : section === 'vod' ? 'get_vod_categories' : 'get_series_categories';
    const itemsAction = section === 'live' ? 'get_live_streams' : section === 'vod' ? 'get_vod_streams' : 'get_series';

    document.getElementById('categories-bar').innerHTML = '<div class="text-center text-gray-500 p-4 text-sm"><i class="fa-solid fa-circle-notch fa-spin"></i> جاري تحميل الباقات...</div>';
    document.getElementById('content-grid').innerHTML = '<div class="col-span-full text-center text-gray-500 py-10 text-sm"><i class="fa-solid fa-satellite-dish fa-2x mb-2"></i><br>اختر باقة من القائمة الجانبية</div>';
    document.getElementById('items-count').innerText = '0';

    try {
        const [catRes, itemsRes] = await Promise.all([
            fetch(`${SERVER_HOST}/player_api.php?username=${userData.username}&password=${userData.password}&action=${catAction}`),
            fetch(`${SERVER_HOST}/player_api.php?username=${userData.username}&password=${userData.password}&action=${itemsAction}`)
        ]);

        allCategories = await catRes.json();
        allItems = await itemsRes.json();

        renderCategories();
        // عند الدخول أول مرة، لا نعرض كل العناصر لتسريع الأداء، ننتظر اختيار باقة
        document.getElementById('content-grid').innerHTML = '<div class="col-span-full text-center text-gray-400 py-16"><i class="fa-regular fa-folder-open fa-3x"></i><p class="mt-4">اختر باقة من القائمة الجانبية لعرض المحتوى</p></div>';
    } catch (e) {
        document.getElementById('content-grid').innerHTML = '<div class="col-span-full text-center text-red-400 py-10"><i class="fa-solid fa-triangle-exclamation"></i> حدث خطأ أثناء جلب البيانات</div>';
    }
}

function renderCategories() {
    const bar = document.getElementById('categories-bar');
    bar.innerHTML = '';
    
    // زر "الكل"
    const allBtn = document.createElement('button');
    allBtn.className = "cat-btn active w-full"; // نجعلها نشطة افتراضياً
    allBtn.innerHTML = '<i class="fa-solid fa-layer-group ml-2 text-xs"></i> الكل';
    allBtn.onclick = () => selectCategory('all', allBtn);
    bar.appendChild(allBtn);

    if (Array.isArray(allCategories)) {
        allCategories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = "cat-btn w-full truncate";
            btn.innerHTML = `<i class="fa-regular fa-folder ml-2 text-xs"></i> ${cat.category_name}`;
            btn.onclick = () => selectCategory(cat.category_id, btn);
            bar.appendChild(btn);
        });
    }
}

function selectCategory(catId, btnElement) {
    // تحديث الأزرار النشطة
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');

    let filtered = [];
    if (catId === 'all') {
        filtered = allItems;
    } else {
        filtered = allItems.filter(item => item.category_id == catId);
    }
    
    renderItems(filtered);
    document.getElementById('items-count').innerText = filtered.length;
}

function filterItems() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const filtered = allItems.filter(item => (item.name || '').toLowerCase().includes(query));
    renderItems(filtered);
    document.getElementById('items-count').innerText = filtered.length;
}

function renderItems(items) {
    const grid = document.getElementById('content-grid');
    grid.innerHTML = '';

    if (!items || items.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10"><i class="fa-solid fa-search fa-2x mb-2"></i><br>لا توجد نتائج</div>';
        return;
    }

    // تحسين الأداء: عدم عرض أكثر من 200 عنصر في المرة الواحدة
    const displayItems = items.slice(0, 200);

    displayItems.forEach(item => {
        const card = document.createElement('div');
        // تغيير تنسيق البطاقة لتكون مربعة ومناسبة للواجهة
        card.className = "item-card bg-card-bg rounded-2xl p-3 flex flex-col items-center text-center cursor-pointer border border-gray-700";
        
        const imgUrl = item.stream_icon || item.cover || '';
        const fallbackImg = 'https://via.placeholder.com/200x300/1e293b/94a3b8?text=' + encodeURIComponent(item.name.substring(0,2));

        card.innerHTML = `
            <div class="w-full aspect-[2/3] rounded-xl mb-3 overflow-hidden bg-gray-950 flex items-center justify-center border border-gray-600/50">
                <img src="${imgUrl}" onerror="this.src='${fallbackImg}'" class="w-full h-full object-cover group-hover:scale-110 transition duration-500" loading="lazy">
            </div>
            <span class="text-sm font-semibold text-gray-200 line-clamp-2 px-1 leading-tight">${item.name}</span>
            ${item.rating ? `<div class="text-yellow-400 text-xs mt-1"><i class="fa-solid fa-star"></i> ${item.rating}</div>` : ''}
            ${item.year ? `<div class="text-gray-500 text-xs mt-0.5">${item.year}</div>` : ''}
        `;

        card.onclick = () => handleItemClick(item);
        grid.appendChild(card);
    });
    
    if (items.length > 200) {
        const moreNotice = document.createElement('div');
        moreNotice.className = "col-span-full text-center text-gray-600 text-xs py-4";
        moreNotice.innerText = `+${items.length - 200} عنصر إضافي (تم عرض أول 200 فقط للسرعة)`;
        grid.appendChild(moreNotice);
    }
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

    if (hls) { hls.destroy(); hls = null; }

    if (isLive && Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
    } else {
        video.src = url;
        video.play();
    }
    
    // تحريك الشاشة للأعلى للتركيز على المشغل
    window.scrollTo(0,0);
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
    list.innerHTML = '<div class="text-center text-gray-400 p-10"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل الحلقات...</div>';
    modal.classList.remove('hidden');

    try {
        const res = await fetch(`${SERVER_HOST}/player_api.php?username=${userData.username}&password=${userData.password}&action=get_series_info&series_id=${series.series_id}`);
        const data = await res.json();
        list.innerHTML = '';

        const episodesObj = data.episodes || {};
        const seasons = Object.keys(episodesObj).sort((a,b) => parseInt(b) - parseInt(a)); // ترتيب المواسم من الأحدث للأقدم

        if (seasons.length === 0) {
             list.innerHTML = '<div class="text-center text-gray-400 p-6">لا توجد حلقات متوفرة لهذا المسلسل</div>';
             return;
        }

        seasons.forEach(seasonNum => {
            const seasonContainer = document.createElement('div');
            seasonContainer.className = "bg-gray-950 rounded-2xl p-5 border border-gray-800";
            
            const seasonHeader = document.createElement('button');
            seasonHeader.className = "w-full flex justify-between items-center text-lg font-bold text-primary pb-3 mb-3 border-b border-gray-800";
            seasonHeader.innerHTML = `<span>الموسم ${seasonNum} <span class='text-sm text-gray-400 mr-2'>(${episodesObj[seasonNum].length} حلقة)</span></span> <i class="fa-solid fa-chevron-down text-sm"></i>`;
            seasonHeader.onclick = () => {
                const epContent = document.getElementById(`season-eps-${seasonNum}`);
                epContent.classList.toggle('hidden');
                seasonHeader.querySelector('i').classList.toggle('fa-chevron-up');
            };
            seasonContainer.appendChild(seasonHeader);

            const episodesContent = document.createElement('div');
            episodesContent.id = `season-eps-${seasonNum}`;
            episodesContent.className = "grid grid-cols-1 sm:grid-cols-2 gap-3"; 
            // إخفاء المواسم القديمة افتراضياً
            if (seasonNum !== seasons[0]) { episodesContent.classList.add('hidden'); seasonHeader.querySelector('i').classList.add('fa-chevron-up'); }


            episodesObj[seasonNum].sort((a,b) => a.episode_num - b.episode_num).forEach(ep => {
                const epBtn = document.createElement('button');
                epBtn.className = "w-full text-right bg-card-bg hover:bg-gray-700 p-4 rounded-xl text-sm flex items-center gap-3 border border-gray-700 hover:border-primary group transition";
                epBtn.innerHTML = `
                    <div class="bg-gray-700 group-hover:bg-primary text-white w-10 h-10 rounded-lg flex items-center justify-center font-bold">${ep.episode_num}</div>
                    <div class="flex-1 truncate">
                        <div class="text-gray-200 font-semibold truncate group-hover:text-white">${ep.title || 'حلقة ' + ep.episode_num}</div>
                        ${ep.duration ? `<div class="text-gray-400 text-xs">${Math.round(ep.duration / 60)} دقيقة</div>` : ''}
                    </div>
                     <i class="fa-solid fa-play text-primary opacity-70 group-hover:opacity-100 group-hover:scale-110 transition"></i>
                `;
                epBtn.onclick = () => {
                    const ext = ep.container_extension || 'mp4';
                    const url = `${SERVER_HOST}/series/${userData.username}/${userData.password}/${ep.id}.${ext}`;
                    closeSeriesModal();
                    playStream(url, `${series.name} - الموسم ${seasonNum} - حلقة ${ep.episode_num} (${ep.title})`, false);
                };
                episodesContent.appendChild(epBtn);
            });
            
            seasonContainer.appendChild(episodesContent);
            list.appendChild(seasonContainer);
        });
    } catch (e) {
        list.innerHTML = '<p class="text-center text-red-400 text-sm p-6">فشل تحميل الحلقات</p>';
    }
}

function closeSeriesModal() {
    document.getElementById('series-modal').classList.add('hidden');
}
