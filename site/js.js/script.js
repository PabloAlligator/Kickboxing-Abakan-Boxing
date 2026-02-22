window.addEventListener('load', () => {
  const preloader = document.getElementById('preloader');
  setTimeout(() => {
    preloader.classList.add('hide');
  }, 400);
});

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
document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
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


// Для мобильных устройств: обработка кликов по карточкам
document.addEventListener('DOMContentLoaded', function() {
    const coachCards = document.querySelectorAll('.coach__inner');
    
    coachCards.forEach(card => {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints;
        
        if (isTouchDevice) {
            let isFlipped = false;
            
            card.addEventListener('click', function(e) {
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
            
            document.addEventListener('click', function(e) {
                if (!card.contains(e.target) && isFlipped) {
                    card.classList.remove('flipped');
                    card.style.transform = 'rotateY(0deg)';
                    isFlipped = false;
                }
            });
        }
    });
});

// Кнопки "Записаться" - прокрутка к форме с автозаполнением
document.addEventListener('DOMContentLoaded', function () {
    const signupButtons = document.querySelectorAll('.header-btn, .signup-btn');

    signupButtons.forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.preventDefault();

            // Закрываем бургер-меню если открыто
            const nav = document.querySelector('.header-nav');
            const burger = document.querySelector('.burger');
            if (nav?.classList.contains('active')) {
                nav.classList.remove('active');
                burger?.classList.remove('active');
                document.body.style.overflow = '';
            }

            // Получаем имя тренера если клик из карточки
            let coachName = '';
            const coachCard = this.closest('.coach__block');
            
            if (coachCard) {
                const coachNameElement = coachCard.querySelector('h4');
                if (coachNameElement) {
                    coachName = coachNameElement.textContent.trim();
                    // Очищаем от переносов строк и лишних пробелов
                    coachName = coachName.replace(/\s+/g, ' ').trim();
                }
            }

            // Прокрутка к форме
            const targetSection = document.querySelector('#raspisanie');
            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });

                // Автозаполнение имени тренера в комментарий (если есть поле)
                // Или можно добавить скрытое поле и заполнить его
                if (coachName) {
                    // Сохраняем в sessionStorage чтобы использовать после прокрутки
                    sessionStorage.setItem('selectedCoach', coachName);
                    
                    // Показываем уведомление
                    showCoachNotification(coachName);
                }
            }
        });
    });
});

// Показать уведомление о выбранном тренере
function showCoachNotification(coachName) {
    // Удаляем старое уведомление если есть
    const oldNotification = document.querySelector('.coach-notification');
    if (oldNotification) {
        oldNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'coach-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <span>Вы выбрали: <strong>${coachName}</strong></span>
            <button onclick="this.parentElement.parentElement.remove()">✕</button>
        </div>
    `;
    
    // Стили для уведомления
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #db2727 0%, #ff4757 100%);
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        z-index: 9999;
        box-shadow: 0 4px 20px rgba(219, 39, 39, 0.4);
        animation: slideDown 0.3s ease;
    `;
    
    notification.querySelector('.notification-content').style.cssText = `
        display: flex;
        align-items: center;
        gap: 15px;
    `;
    
    notification.querySelector('button').style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    // Добавляем анимацию
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Автоматически скрыть через 5 секунд
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Аккордеон для расписания
document.addEventListener('DOMContentLoaded', function() {
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


// отправка
// Инициализация EmailJS
(function() {
    emailjs.init("r0VmzggkXuhBsXCeb");
})();

const form = document.getElementById('signupForm');
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');
const submitBtn = document.getElementById('submitBtn');
const btnText = submitBtn.querySelector('.btn-text');

form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    submitBtn.disabled = true;
    btnText.textContent = 'Отправка...';
    
    emailjs.sendForm('shum.pasha.03@gmail.com', 'template_npg3ias', form)
        .then(function() {
            form.style.display = 'none';
            successMessage.style.display = 'block';
            errorMessage.style.display = 'none';
            sessionStorage.removeItem('selectedCoach');
        }, function(error) {
            console.log('Ошибка:', error);
            form.style.display = 'none';
            errorMessage.style.display = 'block';
            successMessage.style.display = 'none';
        })
        .finally(function() {
            submitBtn.disabled = false;
            btnText.textContent = 'ЗАПИСАТЬСЯ БЕСПЛАТНО';
        });
});

function resetForm() {
    form.reset();
    successMessage.style.display = 'none';
    errorMessage.style.display = 'none';
    form.style.display = 'flex';
    sessionStorage.removeItem('selectedCoach');
}

// FAB (Floating Action Button)
document.addEventListener('DOMContentLoaded', function() {
    const fabToggle = document.querySelector('.fab-toggle');
    const fabMenu = document.querySelector('.fab-menu');
    
    if (fabToggle && fabMenu) {
        fabToggle.addEventListener('click', function() {
            this.classList.toggle('active');
            fabMenu.classList.toggle('active');
        });

        document.addEventListener('click', function(e) {
            if (!fabToggle.contains(e.target) && !fabMenu.contains(e.target)) {
                fabToggle.classList.remove('active');
                fabMenu.classList.remove('active');
            }
        });
    }
});