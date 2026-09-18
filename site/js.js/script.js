// window.addEventListener('load', () => {
//     const preloader = document.getElementById('preloader');
//     setTimeout(() => {
//         preloader.classList.add('hide');
//     }, 400);
// });

document.addEventListener('DOMContentLoaded', () => {
    const burger = document.querySelector('.burger');
    const nav = document.querySelector('.header-nav');

    if (!burger || !nav) {
        console.log('burger или nav не найден');
        return;
    }

    burger.addEventListener('click', (e) => {
        e.stopPropagation();

        burger.classList.toggle('active');
        nav.classList.toggle('active');

        document.body.style.overflow =
            nav.classList.contains('active') ? 'hidden' : '';
    });

    document.addEventListener('click', (e) => {
        if (
            nav.classList.contains('active') &&
            !nav.contains(e.target) &&
            !burger.contains(e.target)
        ) {
            burger.classList.remove('active');
            nav.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            burger.classList.remove('active');
            nav.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
});


// плавность прокуртки
// Плавная прокрутка по якорным ссылкам
document.addEventListener('DOMContentLoaded', function () {
    const navLinks = document.querySelectorAll('.nav-link[href^="#"]');

    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);

            if (targetSection) {
                // Закрываем бургер-меню если открыто
                const nav = document.querySelector('.header-nav');
                const burger = document.querySelector('.burger');
                if (nav?.classList.contains('active')) {
                    nav.classList.remove('active');
                    burger?.classList.remove('active');
                    document.body.style.overflow = '';
                }

                // Плавная прокрутка
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});

// Публичные контакты и расписание из Sodruzhestvo Control.
document.addEventListener('DOMContentLoaded', async function () {
    try {
        const [settingsResponse, scheduleResponse] = await Promise.all([
            fetch('/api/public/settings'),
            fetch('/api/public/schedule')
        ]);

        if (settingsResponse.ok) {
            const settings = await settingsResponse.json();
            document.querySelectorAll('.header-btn, .signup-btn, .footer-col__contacts a[href^="https://t.me/"], .fab-item.telegram, .burger-socmedia a:first-child')
                .forEach(link => { link.href = settings.telegramUrl; });
        }

        if (scheduleResponse.ok) {
            const { groups } = await scheduleResponse.json();
            if (groups.length) renderPublicSchedule(groups);
        }
    } catch {
        // Статическое расписание остаётся рабочим, если сервер временно недоступен.
    }
});

function renderPublicSchedule(groups) {
    const dayNames = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    const days = [1, 2, 3, 4, 5, 6, 7]
        .map(day => ({ day, groups: groups.filter(group => group.days.includes(day)) }))
        .filter(item => item.groups.length);
    const desktop = document.querySelector('[data-public-schedule-desktop]');
    const mobile = document.querySelector('[data-public-schedule-mobile]');

    if (desktop) {
        desktop.innerHTML = days.map(item => `
            <div class="schedule-row">
                <div class="schedule-col schedule-col--day"><span class="schedule-label">${dayNames[item.day]}</span></div>
                <div class="schedule-col schedule-col--time"><div class="time-group">
                    ${item.groups.map(group => `<span>${group.startTime} <span class="group-label">${escapePublicText(group.name)}</span></span>`).join('')}
                </div></div>
                <div class="schedule-col schedule-col--type"><span>Бокс/Кикбоксинг</span></div>
            </div>`).join('');
    }

    if (mobile) {
        mobile.innerHTML = days.map(item => `
            <div class="acc-item">
                <div class="acc-head"><span class="acc-day">${dayNames[item.day]}</span><span class="acc-icon">+</span></div>
                <div class="acc-content"><div class="acc-time"><div class="time-group">
                    ${item.groups.map(group => `<span>${group.startTime} <span class="group-type">${escapePublicText(group.name)}</span></span>`).join('')}
                </div></div><div class="acc-prog">Бокс/Кикбоксинг</div></div>
            </div>`).join('');
        bindScheduleAccordion(mobile.querySelectorAll('.acc-item'));
    }
}

function bindScheduleAccordion(items) {
    items.forEach(item => {
        item.querySelector('.acc-head')?.addEventListener('click', () => {
            items.forEach(other => {
                if (other !== item) {
                    other.classList.remove('active');
                    other.querySelector('.acc-content').style.maxHeight = null;
                }
            });
            const content = item.querySelector('.acc-content');
            item.classList.toggle('active');
            content.style.maxHeight = item.classList.contains('active') ? `${content.scrollHeight}px` : null;
        });
    });
}

function escapePublicText(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}


// Для мобильных устройств: обработка кликов по карточкам
document.addEventListener('DOMContentLoaded', function () {
    const coachCards = document.querySelectorAll('.coach__inner');

    coachCards.forEach(card => {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints;

        if (isTouchDevice) {
            let isFlipped = false;

            card.addEventListener('click', function (e) {
                if (e.target.closest('.signup-btn')) return;
                e.preventDefault();

                if (!isFlipped) {
                    coachCards.forEach(otherCard => {
                        if (otherCard !== card && otherCard.classList.contains('flipped')) {
                            otherCard.classList.remove('flipped');
                            otherCard.style.transform = 'rotateY(0deg)';
                        }
                    });
                }

                isFlipped = !isFlipped;

                if (isFlipped) {
                    this.classList.add('flipped');
                    this.style.transform = 'rotateY(180deg)';
                } else {
                    this.classList.remove('flipped');
                    this.style.transform = 'rotateY(0deg)';
                }
            });

            document.addEventListener('click', function (e) {
                if (!card.contains(e.target) && isFlipped) {
                    card.classList.remove('flipped');
                    card.style.transform = 'rotateY(0deg)';
                    isFlipped = false;
                }
            });
        }
    });
});

// Аккордеон для расписания
document.addEventListener('DOMContentLoaded', function () {
    const accItems = document.querySelectorAll('.acc-item');

    accItems.forEach(item => {
        const head = item.querySelector('.acc-head');

        head.addEventListener('click', () => {

            accItems.forEach(other => {
                if (other !== item && other.classList.contains('active')) {
                    other.classList.remove('active');
                    other.querySelector('.acc-content').style.maxHeight = null;
                }
            });

            const isActive = item.classList.contains('active');
            const content = item.querySelector('.acc-content');

            item.classList.toggle('active');

            if (!isActive) {
                content.style.maxHeight = content.scrollHeight + 'px';
            } else {
                content.style.maxHeight = null;
            }
        });
    });
});


// FAB (Floating Action Button)
document.addEventListener('DOMContentLoaded', function () {
    const fabToggle = document.querySelector('.fab-toggle');
    const fabMenu = document.querySelector('.fab-menu');

    if (fabToggle && fabMenu) {
        fabToggle.addEventListener('click', function () {
            this.classList.toggle('active');
            fabMenu.classList.toggle('active');
        });

        document.addEventListener('click', function (e) {
            if (!fabToggle.contains(e.target) && !fabMenu.contains(e.target)) {
                fabToggle.classList.remove('active');
                fabMenu.classList.remove('active');
            }
        });
    }
});



// news swiper

const newsSwiper = new Swiper('.news-slider', {

    slidesPerView: 3,
    spaceBetween: 30,

    loop: true,

    autoplay: {
        delay: 4500
    },

    pagination: {
        el: '.swiper-pagination',
        clickable: true
    },

    navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev'
    },

    breakpoints: {

        320: {
            slidesPerView: 1
        },

        768: {
            slidesPerView: 2
        },

        1024: {
            slidesPerView: 3
        }

    }

});
