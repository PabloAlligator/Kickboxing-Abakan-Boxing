
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

// Для мобильных устройств: обработка кликов по карточкам
document.addEventListener('DOMContentLoaded', function() {
    const coachCards = document.querySelectorAll('.coach__inner');
    
    coachCards.forEach(card => {
        // Проверяем, мобильное ли устройство
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints;
        
        if (isTouchDevice) {
            let isFlipped = false;
            
            card.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Закрываем другие открытые карточки
                if (!isFlipped) {
                    coachCards.forEach(otherCard => {
                        if (otherCard !== card && otherCard.classList.contains('flipped')) {
                            otherCard.classList.remove('flipped');
                            otherCard.style.transform = 'rotateY(0deg)';
                        }
                    });
                }
                
                // Переключаем состояние текущей карточки
                isFlipped = !isFlipped;
                
                if (isFlipped) {
                    this.classList.add('flipped');
                    this.style.transform = 'rotateY(180deg)';
                } else {
                    this.classList.remove('flipped');
                    this.style.transform = 'rotateY(0deg)';
                }
            });
            
            // Закрыть карточку при клике вне ее
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

// Модальное окно для записи
document.addEventListener('DOMContentLoaded', function () {
  const modal = document.getElementById('signupModal');
  const openModalBtns = document.querySelectorAll('.header-btn');

  const closeModalBtn = document.querySelector('.modal-close');
  const modalForm = document.getElementById('signupForm');
  // Находим все кнопки "Записаться" на странице
  const signupButtons = document.querySelectorAll('.signup-btn');

  // Открытие модального окна
  function openModal(coachName = '', programType = '') {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Блокируем скролл страницы

    // Если передано имя тренера, заполняем соответствующее поле
    if (coachName && coachName.trim() !== '') {
      const coachSelect = modal.querySelector('select[aria-label="Выберите тренера"]');
      if (coachSelect) {
        // Ищем опцию с соответствующим текстом
        const options = coachSelect.querySelectorAll('option');
        let found = false;

        options.forEach(option => {
          if (option.textContent.includes(coachName)) {
            coachSelect.value = option.value;
            found = true;
          }
        });

        // Если не нашли точное совпадение, но есть имя тренера
        if (!found && coachName) {
          // Можно добавить логику для заполнения другого поля или показать подсказку
          console.log(`Тренер ${coachName} не найден в списке`);
        }
      }
    }

    // Если передан тип программы, заполняем соответствующее поле
    if (programType && programType.trim() !== '') {
      const programSelect = modal.querySelector('select[aria-label="Выберите программу"]');
      if (programSelect) {
        // Маппинг русских названий к значениям
        const programMap = {
          'бокс': 'boxing',
          'кикбоксинг': 'kickboxing',
          'детск': 'kids', // для "детская программа"
          'персонал': 'personal' // для "персональная тренировка"
        };

        const programLower = programType.toLowerCase();
        let programValue = '';

        // Ищем совпадение в маппинге
        for (const [key, value] of Object.entries(programMap)) {
          if (programLower.includes(key)) {
            programValue = value;
            break;
          }
        }

        if (programValue) {
          programSelect.value = programValue;
        }
      }
    }

    // Фокус на первом поле формы
    setTimeout(() => {
      const firstInput = modal.querySelector('input, select');
      if (firstInput) firstInput.focus();
    }, 100);
  }

  // Закрытие модального окна
  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = ''; // Восстанавливаем скролл
  }

  // Обработчики событий для кнопки в хедере
  // Обработчики событий для всех кнопок в хедере (десктоп + мобилка)
  if (openModalBtns.length) {
    openModalBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();

        // если клик из бургера — закрываем его
        const nav = document.querySelector('.header-nav');
        const burger = document.querySelector('.burger');

        if (nav?.classList.contains('active')) {
          nav.classList.remove('active');
          burger?.classList.remove('active');
          document.body.style.overflow = '';
        }
      });
    });
  }



  // Обработчики событий для всех кнопок "Записаться" на странице
  if (signupButtons.length > 0) {
    signupButtons.forEach(button => {
      button.addEventListener('click', function (e) {
        e.preventDefault();

        // Получаем данные из карточки тренера (если есть)
        let coachName = '';
        let programType = '';

        // Ищем ближайшую карточку тренера
        const coachCard = this.closest('.coach__block');
        if (coachCard) {
          // Получаем имя тренера
          const coachNameElement = coachCard.querySelector('h4');
          if (coachNameElement) {
            coachName = coachNameElement.textContent.trim();

            // Очищаем имя от лишних пробелов и переносов
            coachName = coachName.replace(/\s+/g, ' ').trim();

            // Если имя слишком длинное, берем только фамилию
            const nameParts = coachName.split(' ');
            if (nameParts.length >= 2) {
              // Берем только фамилию (первое слово)
              coachName = nameParts[0];
            }
          }

          // Получаем специализацию тренера
          const programElement = coachCard.querySelector('.front p');
          if (programElement) {
            programType = programElement.textContent.trim();

            // Извлекаем тип программы (бокс/кикбоксинг)
            if (programType.includes('БОКС') || programType.includes('КИКБОКСИНГ')) {
              programType = 'бокс';
            }
          }
        }

        // Открываем модальное окно с данными тренера
        openModal(coachName, programType);
      });
    });
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeModal);
  }

  // Закрытие по клику на оверлей
  modal.addEventListener('click', function (e) {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Закрытие по клавише Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  // Обработка отправки формы
  if (modalForm) {
    modalForm.addEventListener('submit', function (e) {
      e.preventDefault();

      // Собираем данные формы
      const formData = new FormData(modalForm);
      const data = Object.fromEntries(formData);

      // Валидация формы
      if (!validateForm()) {
        return;
      }

      // Показываем индикатор загрузки
      const submitBtn = modalForm.querySelector('.modal-submit-btn');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'ОТПРАВЛЯЕМ...';
      submitBtn.disabled = true;

      // Здесь должна быть отправка данных на сервер
      // Например, через fetch или XMLHttpRequest
      console.log('Данные для отправки:', data);

      // Имитация отправки на сервер (задержка 1.5 секунды)
      setTimeout(() => {
        // Восстанавливаем кнопку
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;

        // Показываем сообщение об успехе
        showSuccessMessage();

        // Закрываем модальное окно через 3 секунды
        setTimeout(() => {
          closeModal();
          modalForm.reset();
        }, 3000);
      }, 1500);
    });
  }

  // Функция валидации формы
  function validateForm() {
    const nameInput = modalForm.querySelector('input[placeholder="Ваше имя"]');
    const phoneInput = modalForm.querySelector('input[type="tel"]');
    const programSelect = modalForm.querySelector('select[aria-label="Выберите программу"]');
    const privacyCheckbox = modalForm.querySelector('#privacyPolicy');

    let isValid = true;

    // Валидация имени
    if (!nameInput.value.trim()) {
      showError(nameInput, 'Введите ваше имя');
      isValid = false;
    } else if (nameInput.value.trim().length < 2) {
      showError(nameInput, 'Имя должно содержать минимум 2 символа');
      isValid = false;
    } else {
      clearError(nameInput);
    }

    // Валидация телефона
    const phoneRegex = /^\+7\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/;
    if (!phoneInput.value.trim()) {
      showError(phoneInput, 'Введите номер телефона');
      isValid = false;
    } else if (!phoneRegex.test(phoneInput.value)) {
      showError(phoneInput, 'Введите номер в формате: +7 (999) 999-99-99');
      isValid = false;
    } else {
      clearError(phoneInput);
    }

    // Валидация выбора программы
    if (!programSelect.value) {
      showError(programSelect, 'Выберите программу тренировок');
      isValid = false;
    } else {
      clearError(programSelect);
    }

    // Валидация чекбокса
    if (!privacyCheckbox.checked) {
      showError(privacyCheckbox, 'Необходимо согласие с политикой конфиденциальности');
      isValid = false;
    } else {
      clearError(privacyCheckbox);
    }

    return isValid;
  }

  // Функция показа ошибки
  function showError(element, message) {
    // Убираем предыдущие ошибки для этого элемента
    clearError(element);

    // Добавляем класс ошибки
    element.classList.add('error');

    // Создаем элемент с сообщением об ошибке
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    errorElement.style.color = '#ff4757';
    errorElement.style.fontSize = '12px';
    errorElement.style.marginTop = '5px';
    errorElement.style.fontFamily = 'Inter, sans-serif';

    // Вставляем сообщение об ошибке после элемента
    element.parentNode.appendChild(errorElement);
  }

  // Функция очистки ошибки
  function clearError(element) {
    element.classList.remove('error');

    // Удаляем сообщение об ошибке
    const errorElement = element.parentNode.querySelector('.error-message');
    if (errorElement) {
      errorElement.remove();
    }
  }

  // Функция показа сообщения об успехе
  function showSuccessMessage() {
    // Создаем элемент для сообщения
    const successMsg = document.createElement('div');
    successMsg.className = 'success-message';
    successMsg.innerHTML = `
            <div class="success-content">
                <span class="success-icon">✓</span>
                <h3>Заявка отправлена!</h3>
                <p>Мы свяжемся с вами в течение 30 минут</p>
            </div>
        `;

    // Добавляем в модальное окно
    modal.querySelector('.modal-body').appendChild(successMsg);

    // Убираем форму
    modalForm.style.display = 'none';
  }

  // Добавляем валидацию телефона
  const phoneInput = modal.querySelector('input[type="tel"]');
  if (phoneInput) {
    phoneInput.addEventListener('input', function (e) {
      let value = e.target.value.replace(/\D/g, '');

      if (value.length > 0) {
        if (!value.startsWith('7')) {
          value = '7' + value;
        }

        let formatted = '+7 ';

        if (value.length > 1) {
          formatted += '(' + value.substring(1, 4);
        }
        if (value.length >= 4) {
          formatted += ') ' + value.substring(4, 7);
        }
        if (value.length >= 7) {
          formatted += '-' + value.substring(7, 9);
        }
        if (value.length >= 9) {
          formatted += '-' + value.substring(9, 11);
        }

        e.target.value = formatted.substring(0, 18); // Ограничиваем длину
      }
    });

    // Автоформатирование при потере фокуса
    phoneInput.addEventListener('blur', function () {
      const value = this.value.replace(/\D/g, '');
      if (value.length === 11) {
        let formatted = '+7 ';
        formatted += '(' + value.substring(1, 4);
        formatted += ') ' + value.substring(4, 7);
        formatted += '-' + value.substring(7, 9);
        formatted += '-' + value.substring(9, 11);
        this.value = formatted;
      }
    });
  }

  // Стили для ошибок (можно добавить в CSS, но оставлю здесь для удобства)
  const errorStyles = document.createElement('style');
  errorStyles.textContent = `
        .modal-input.error {
            border-color: #ff4757 !important;
            background: rgba(255, 71, 87, 0.05) !important;
        }
        
        .modal-checkbox.error {
            outline: 2px solid #ff4757;
            outline-offset: 2px;
        }
        
        .success-message {
            text-align: center;
            padding: 30px 20px;
            animation: fadeIn 0.5s ease;
        }
        
        .success-content {
            background: rgba(46, 125, 50, 0.1);
            border: 2px solid #2e7d32;
            border-radius: 8px;
            padding: 30px 20px;
        }
        
        .success-icon {
            display: inline-block;
            width: 60px;
            height: 60px;
            background: #2e7d32;
            color: white;
            border-radius: 50%;
            font-size: 32px;
            line-height: 60px;
            margin-bottom: 20px;
            animation: bounce 0.5s ease;
        }
        
        .success-content h3 {
            font-family: 'Russo One', sans-serif;
            color: white;
            font-size: 24px;
            margin-bottom: 10px;
        }
        
        .success-content p {
            color: rgba(255, 255, 255, 0.8);
            font-size: 16px;
        }
        
        @keyframes bounce {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
  document.head.appendChild(errorStyles);
});


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