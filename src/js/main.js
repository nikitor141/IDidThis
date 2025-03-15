'use strict'

import '@/scss/style.scss'

//theme switcher

const darkThemeMq = window.matchMedia('(prefers-color-scheme: dark)')
const dataset = document.documentElement.dataset
let currentTheme

function setTheme(newTheme) {
	if (!newTheme) {
		newTheme = localStorage.getItem('theme') || (darkThemeMq.matches ? 'dark' : 'light')
	}
	dataset.theme = newTheme
	currentTheme = newTheme
}

function switchTheme() {
	currentTheme = currentTheme === 'light' ? 'dark' : 'light'
	localStorage.setItem('theme', currentTheme)
	setTheme(currentTheme)
}

darkThemeMq.addEventListener('change', () => setTheme())
setTheme()

document.addEventListener('click', e => {
	if (e.target.closest('._themeSwitcher')) {
		darkThemeMq.removeEventListener('change', () => setTheme())
		switchTheme()
	}
	if (e.target.closest('._themeDefault')) {
		localStorage.removeItem('theme')
		darkThemeMq.addEventListener('change', () => setTheme())
		setTheme()
	}
})

const body = document.body

function setBodyCssVariables() {
	const rem = +parseFloat(getComputedStyle(document.documentElement).fontSize).toFixed(2)
}
setBodyCssVariables()

document.querySelectorAll('input, textarea').forEach(input => {
	input.addEventListener('focus', () => {
		setTimeout(() => input.scrollIntoView({ behavior: 'smooth', block: 'start' }), 75)
	})
})

const eventMixin = {
	/**
	 * @param {string} eventName - Имя события
	 * @param {function} handler - Обработчик события
	 * @description Подписаться на событие
	 * @example menu.on('select', function(item) { ... }
	 */
	on(eventName, handler) {
		if (!this._eventNames) this._eventNames = {}
		if (!this._eventNames[eventName]) this._eventNames[eventName] = []
		this._eventNames[eventName].push(handler)
	},
	/**
	 *	@param {string} eventName - Имя события
	 *	@param {function} handler - Обработчик события
	 * @description Отменить подписку на событие
	 * @example menu.off('select', handler)
	 */
	off(eventName, handler) {
		let handlers = this._eventNames?.[eventName]
		if (!handlers) return
		for (let i = 0; i < handlers.length; i++) {
			if (handlers[i] === handler) {
				handlers.splice(i--, 1)
			}
		}
	},
	/**
	 * @param {string} eventName - Имя события
	 * @param  {...any} args - Аргументы передаваемые обработчику события
	 * @description Сгенерировать событие с указанным именем и данными
	 * @example this.trigger('select', data1, data2);
	 */
	trigger(eventName, ...args) {
		try {
			if (!this._eventNames?.[eventName]) throw new SyntaxError('Нет такого события!')

			this._eventNames[eventName].forEach(handler => handler.apply(this, args))
		} catch (err) {
			console.error(err)
		}
	}
}

/**
 * @typedef {Object} Day
 * @property {Object} date - Дата дня
 * @property {string} date.string - Локализованная строка даты
 * @property {string} date.format - Дата в ISO формате
 * @property {number} date.dayTimestamp - Таймстамп дня (начало дня)
 * @property {Task[]} tasks - Список задач дня
 * @property {HTMLElement} [tasksEl] - Ссылка на DOM-элемент задач
 */

/**
 * @typedef {Object} Category
 * @property {string} name - Название категории
 * @property {string} id - Уникальный идентификатор категории
 */

/**
 * @typedef {Object} Task
 * @property {string} description - Описание задачи
 * @property {Category} category - Привязанная категория
 * @property {string} id - Уникальный идентификатор
 */

/**
 * Класс для управления задачами и категориями с сохранением состояния в localStorage
 * @class
 * @implements {eventMixin}
 */
class IDidIt {
	/**
	 * Элемент списка категорий
	 * @type {HTMLElement}
	 */
	categoriesEl = document.querySelector('.editor__categories-list')
	/**
	 * Список категорий из localStorage
	 * @type {Array<{name: string, id: string}>}
	 */
	categories = JSON.parse(localStorage.getItem('categories') ?? '[]')
	/**
	 * Элемент списка дней
	 * @type {HTMLElement}
	 */
	daysEl = document.querySelector('.days-list')
	/**
	 * Список дней из localStorage
	 * @type {Array<Day>}
	 */
	days = JSON.parse(localStorage.getItem('days') ?? '[]')
	/**
	 * Текущий день (сегодня)
	 * @type {Day|undefined}
	 */
	today = this.isToday() //undefined

	/**
	 * Конструктор инициализирует состояние приложения
	 * @constructor
	 * 1. Восстанавливает данные из localStorage
	 * 2. Инициализирует DOM-элементы
	 * 3. Устанавливает обработчики событий
	 * 4. Запускает первоначальный рендеринг
	 */
	constructor() {
		localStorage.setItem('categories', JSON.stringify(this.categories))
		localStorage.setItem('days', JSON.stringify(this.days))

		this.renderCategories()
		this.renderDays()

		this.on('categoryAdded', newCategory => this.renderCategory(newCategory))

		this.on('taskAdded', newTask => this.renderTask(newTask, this.today.tasksEl))

		this.on('dayAdded', newDay => {
			this.today = newDay
			this.renderDay(newDay)
		})

		categoriesAddButton.addEventListener('click', e => {
			e.preventDefault()
			this.addCategory()
		})
		categoriesRemoveButton.addEventListener('click', () => {
			this.removeCategory()
		})

		editorConfirmButton.addEventListener('click', () => {
			this.addTask()
		})
		clearHistoryButton.addEventListener('click', () => {
			if (confirm('Это действие необратимо! \n\nУдалить историю?')) this.clearHistory()
		})

		window.addEventListener('visibilitychange', () => {
			this.storage.sync()
		})
	}

	/**
	 * Добавляет новую категорию в список категорий
	 * @throws {SyntaxError} При достижении лимита категорий или невалидном имени
	 * @returns {IDidIt} Текущий экземпляр класса
	 */
	addCategory() {
		try {
			if (this.isMaxCategories()) throw new SyntaxError('Достигнут лимит категорий!')

			let name = this.getCategoryInput()
			if (this.categories.some(item => item.name === name) || name === '') {
				throw new SyntaxError('Введите уникальное имя!')
			}

			let newCategory = { name, id: this.createId() }
			this.categories.push(newCategory)
			this.clearCategoryInput()

			this.trigger('categoryAdded', newCategory)
		} catch (err) {
			alert(err.message)
		} finally {
			return this
		}
	}
	/**
	 * Добавляет новую задачу в текущий день
	 * @throws {SyntaxError} При отсутствии выбранной категории или пустом описании
	 * @returns {IDidIt} Текущий экземпляр класса
	 */
	addTask() {
		try {
			let description = this.getDayInput()
			let category = this.getSelectedCategory()

			if (!category) throw new SyntaxError('Выберите категорию!')
			if (!description) throw new SyntaxError('Напишите описание!')

			if (!this.isToday()) this.addDay()

			let newTask = { description, category, id: this.createId() }
			this.today.tasks.push(newTask)

			this.clearDayInput()
			this.trigger('taskAdded', newTask)
		} catch (err) {
			alert(err.message)
		} finally {
			return this
		}
	}
	/**
	 * Создает и добавляет новый день в список дней
	 * @returns {IDidIt} Текущий экземпляр класса
	 */
	addDay() {
		let date = new Date()
		date.setHours(0, 0, 0, 0)

		let newDay = {
			date: {
				string: date.toLocaleDateString('ru-ru', {
					weekday: 'long',
					month: 'long',
					day: 'numeric'
				}),
				format: date.toISOString(),
				dayTimestamp: date.getTime()
			},
			tasks: []
		}

		this.days.push(newDay)
		this.trigger('dayAdded', newDay)

		return this
	}

	/**
	 * Рендерит категорию в DOM
	 * @param {Category} category - Объект категории для отображения
	 * @returns {IDidIt} Текущий экземпляр класса
	 */
	renderCategory(category) {
		let categoryEl = editorCategoryItem.content.cloneNode(true)

		categoryEl.querySelector('label').append(category.name)
		categoryEl.querySelector('li').setAttribute('id', category.id)
		this.categoriesEl.prepend(categoryEl)

		return this
	}
	/**
	 * Рендерит задачу в DOM
	 * @param {Task} task - Объект задачи для отображения
	 * @param {HTMLElement} dayTasksEl - Контейнер для задач дня
	 * @returns {IDidIt} Текущий экземпляр класса для цепочки вызовов
	 */
	renderTask({ description, category, id }, dayTasksEl) {
		let newTaskEl = dayTasksEl.querySelector('#dayTask').content.cloneNode(true)

		newTaskEl.querySelector('.day__task-category').textContent = category.name
		newTaskEl.querySelector('.day__task-description').textContent = description
		newTaskEl.querySelector('.day__task').setAttribute('id', id)

		dayTasksEl.prepend(newTaskEl)
	}
	/**
	 * Рендерит день в интерфейсе
	 * @param {Day} newDay - Объект дня для отображения
	 * @returns {IDidIt} Текущий экземпляр класса
	 */
	renderDay(newDay = {}) {
		let newDayEl = document.querySelector('#dayTemplate').content.cloneNode(true)
		newDayEl.querySelector('time').textContent = newDay.date.string
		newDayEl.querySelector('time').setAttribute('datetime', newDay.date.format)

		newDay.tasksEl = newDayEl.querySelector('.day__tasks')

		this.renderTasks(newDay.tasks, newDay.tasksEl)

		this.daysEl.prepend(newDayEl)
	}

	/**
	 * Рендерит все категории
	 */
	renderCategories() {
		this.categories.forEach(category => this.renderCategory(category))
	}
	/**
	 * Рендерит список задач в указанный DOM-элемент
	 * @param {Task[]} tasks - Массив задач для отображения
	 * @param {HTMLElement} dayTasksEl - Целевой DOM-элемент
	 */
	renderTasks(tasks, dayTasksEl) {
		tasks.forEach(task => this.renderTask(task, dayTasksEl))
	}
	/**
	 * Рендерит все дни
	 */
	renderDays() {
		this.days.forEach(day => this.renderDay(day))
	}

	/**
	 * Получает значение из поля ввода категории
	 * @returns {string} Очищенное значение поля ввода
	 */
	getCategoryInput() {
		return addCategoryInput.value.replace(/^\s*(.*?)\s*$/, '$1')
	}
	/**
	 * Получает значение из поля ввода задачи
	 * @returns {string} Очищенное значение поля ввода
	 */
	getDayInput() {
		return editorDescriptionField.value.replace(/^\s*(.*?)\s*$/, '$1')
	}
	/**
	 * Находит выбранную категорию в DOM
	 * @returns {Category|undefined} Объект категории или undefined
	 */
	getSelectedCategory() {
		let selectedCategoryEl = this.categoriesEl.querySelector('input:checked')?.closest('li')
		let selectedCategory = this.categories.find(category => category.id === selectedCategoryEl?.getAttribute('id'))

		return selectedCategory
	}
	getElementById(id) {
		return document.querySelector(`#${id}`)
	}

	/**
	 * Очищает указанное поле ввода
	 * @param {HTMLInputElement} inputEl - Элемент поля ввода
	 * @returns {IDidIt} Возвращает текущий экземпляр класса
	 */
	clearInput(inputEl) {
		inputEl.value = ''
		return this
	}
	/**
	 * Очищает поле ввода категории.
	 * @type {Function}
	 */
	clearCategoryInput = this.clearInput.bind(this, addCategoryInput)
	/**
	 * Очищает поле ввода задачи.
	 * @type {Function}
	 */
	clearDayInput = this.clearInput.bind(this, editorDescriptionField)

	clearHistory() {
		this.removeElements(this.categoriesEl, this.daysEl)
		this.days = []
		this.categories = []
		this.today = this.isToday()
		this.storage.clear()
	}
	removeCategory() {
		try {
			let id = this.getSelectedCategory()?.id

			if (!id) throw new SyntaxError('Выберите категорию для удаления!')

			this.getElementById(id).remove()
			this.categories.splice(
				this.categories.findIndex(category => category.id === id),
				1
			)
		} catch (err) {
			alert(err.message)
		}
	}
	removeElements(...parentEls) {
		parentEls.forEach(parent => parent.querySelectorAll('li').forEach(el => el.remove()))
	}

	/**
	 * Генерирует уникальный ID
	 * @returns {string} Уникальный идентификатор
	 */
	createId() {
		return Date.now().toString(36) + Math.random().toString(36).substring(2)
	}
	/**
	 * Объект для синхронизации с localStorage
	 */
	storage = {
		sync: () => {
			localStorage.setItem('days', JSON.stringify(this.days))
			localStorage.setItem('categories', JSON.stringify(this.categories))
		},
		clear: () => {
			localStorage.clear()
		}
	}

	/**
	 * Проверяет наличие сегодняшнего дня в списке дней
	 * @returns {Day|undefined} Найденный день или undefined
	 */
	isToday() {
		return this.days.find(day => day.date.dayTimestamp === new Date().setHours(0, 0, 0, 0))
	}
	/**
	 * Проверяет достижение лимита категорий
	 * @returns {boolean} true - если достигнут лимит (24 категории)
	 */
	isMaxCategories() {
		return this.categories.length === 24
	}
}
Object.assign(IDidIt.prototype, eventMixin)
let app = new IDidIt()
