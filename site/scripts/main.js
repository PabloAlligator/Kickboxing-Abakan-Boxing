// Public contact data comes from server configuration so phone/Telegram are not hardcoded in markup.
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/public/config', { credentials: 'same-origin' });
        if (!response.ok) return;
        const config = await response.json();

        document.querySelectorAll('[data-club-phone]').forEach((link) => {
            if (!config.phoneHref) {
                link.hidden = true;
                return;
            }
            link.href = config.phoneHref;
            link.hidden = false;
            if (link.hasAttribute('data-club-phone-text') && config.phoneDisplay) {
                link.textContent = config.phoneDisplay;
                link.setAttribute('aria-label', `Позвонить по номеру ${config.phoneDisplay}`);
            }
        });

        document.querySelectorAll('[data-club-telegram]').forEach((link) => {
            if (!config.telegramUrl) {
                link.hidden = true;
                return;
            }
            link.href = config.telegramUrl;
            link.hidden = false;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        });
    } catch {
        // Контакты скрываются только если сервер явно вернул пустую конфигурацию.
    }
});

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

// Публичное расписание из Sodruzhestvo Control.
document.addEventListener('DOMContentLoaded', async function () {
    try {
        const scheduleResponse = await fetch('/api/public/schedule');

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



// Новостной слайдер без внешних CDN/библиотек.
document.addEventListener('DOMContentLoaded', () => {
    const slider = document.querySelector('.news-slider');
    const track = slider?.querySelector('.swiper-wrapper');
    const slides = track ? [...track.querySelectorAll('.swiper-slide')] : [];
    const prev = document.querySelector('.swiper-button-prev');
    const next = document.querySelector('.swiper-button-next');
    const pagination = slider?.querySelector('.swiper-pagination');

    if (!slider || !track || !slides.length) return;

    let current = 0;
    let autoplayTimer = null;

    const scrollToSlide = (index, behavior = 'smooth') => {
        current = (index + slides.length) % slides.length;
        track.scrollTo({ left: slides[current].offsetLeft, behavior });
        updatePagination();
    };

    const updatePagination = () => {
        if (!pagination) return;
        [...pagination.children].forEach((bullet, index) => {
            bullet.classList.toggle('swiper-pagination-bullet-active', index === current);
            bullet.setAttribute('aria-current', index === current ? 'true' : 'false');
        });
    };

    const syncCurrentFromScroll = () => {
        let nearest = 0;
        let distance = Number.POSITIVE_INFINITY;
        slides.forEach((slide, index) => {
            const delta = Math.abs(slide.offsetLeft - track.scrollLeft);
            if (delta < distance) {
                distance = delta;
                nearest = index;
            }
        });
        current = nearest;
        updatePagination();
    };

    if (pagination) {
        pagination.innerHTML = slides.map((_, index) =>
            `<button class="swiper-pagination-bullet${index === 0 ? ' swiper-pagination-bullet-active' : ''}" type="button" aria-label="Новость ${index + 1}" data-news-slide="${index}"></button>`
        ).join('');
        pagination.addEventListener('click', (event) => {
            const bullet = event.target.closest('[data-news-slide]');
            if (bullet) scrollToSlide(Number(bullet.dataset.newsSlide));
        });
    }

    prev?.addEventListener('click', () => scrollToSlide(current - 1));
    next?.addEventListener('click', () => scrollToSlide(current + 1));
    track.addEventListener('scroll', () => window.requestAnimationFrame(syncCurrentFromScroll), { passive: true });

    const startAutoplay = () => {
        window.clearInterval(autoplayTimer);
        autoplayTimer = window.setInterval(() => scrollToSlide(current + 1), 4500);
    };

    slider.addEventListener('mouseenter', () => window.clearInterval(autoplayTimer));
    slider.addEventListener('mouseleave', startAutoplay);
    slider.addEventListener('focusin', () => window.clearInterval(autoplayTimer));
    slider.addEventListener('focusout', startAutoplay);
    startAutoplay();
});
