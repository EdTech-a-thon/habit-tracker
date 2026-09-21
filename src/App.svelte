<script lang="ts">
  import {
    HABIT_COLORS,
    STORAGE_KEY,
    addDays,
    createCsv,
    createHabit,
    dateKey,
    daysInMonth,
    fromDateKey,
    loadTrackerData,
    saveTrackerData,
    type Habit,
    type TrackerData,
  } from './lib/tracker'

  const today = new Date()
  const todayKey = dateKey(today)

  let data = $state<TrackerData | null>(loadTrackerData())
  let monthCursor = $state(new Date(today.getFullYear(), today.getMonth(), 1))
  let setupTitle = $state('My Habit Project')
  let setupDate = $state(todayKey)
  let setupHabits = $state(['', '', ''])
  let setupError = $state('')
  let settingsOpen = $state(false)
  let draftTitle = $state('')
  let draftHabits = $state<Habit[]>([])
  let settingsError = $state('')
  let toast = $state('')
  let toastTimer: ReturnType<typeof setTimeout> | undefined

  let monthDates = $derived(daysInMonth(monthCursor))
  let monthLabel = $derived(
    monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
  )
  let canGoNext = $derived(
    monthCursor.getFullYear() < today.getFullYear() ||
      (monthCursor.getFullYear() === today.getFullYear() && monthCursor.getMonth() < today.getMonth()),
  )
  let canGoPrevious = $derived.by(() => {
    if (!data) return false
    const start = fromDateKey(data.startDate)
    return (
      monthCursor.getFullYear() > start.getFullYear() ||
      (monthCursor.getFullYear() === start.getFullYear() && monthCursor.getMonth() > start.getMonth())
    )
  })
  let todayCompleted = $derived(data?.completions[todayKey]?.length ?? 0)
  let todayPercent = $derived(
    data?.habits.length ? Math.round((todayCompleted / data.habits.length) * 100) : 0,
  )
  let monthStats = $derived.by(() => {
    if (!data) return { done: 0, possible: 0, percent: 0 }
    let done = 0
    let possible = 0
    for (const date of monthDates) {
      const key = dateKey(date)
      if (key < data.startDate || key > todayKey) continue
      possible += data.habits.length
      const completed = new Set(data.completions[key] ?? [])
      done += data.habits.filter((habit) => completed.has(habit.id)).length
    }
    return { done, possible, percent: possible ? Math.round((done / possible) * 100) : 0 }
  })

  $effect(() => {
    if (data) saveTrackerData(data)
  })

  function isComplete(day: string, habitId: string): boolean {
    return data?.completions[day]?.includes(habitId) ?? false
  }

  function isAvailable(day: string): boolean {
    return !!data && day >= data.startDate && day <= todayKey
  }

  function toggleHabit(day: string, habitId: string): void {
    if (!data || !isAvailable(day)) return
    const current = data.completions[day] ?? []
    data.completions[day] = current.includes(habitId)
      ? current.filter((id) => id !== habitId)
      : [...current, habitId]
  }

  function habitStreak(habitId: string): number {
    if (!data) return 0
    let cursor = new Date(today)
    if (!isComplete(todayKey, habitId)) cursor = addDays(cursor, -1)
    let streak = 0
    while (dateKey(cursor) >= data.startDate && isComplete(dateKey(cursor), habitId)) {
      streak += 1
      cursor = addDays(cursor, -1)
    }
    return streak
  }

  function habitMonthPercent(habitId: string): number {
    if (!data) return 0
    let complete = 0
    let possible = 0
    for (const date of monthDates) {
      const key = dateKey(date)
      if (key < data.startDate || key > todayKey) continue
      possible += 1
      if (isComplete(key, habitId)) complete += 1
    }
    return possible ? Math.round((complete / possible) * 100) : 0
  }

  function finishSetup(event: SubmitEvent): void {
    event.preventDefault()
    const names = setupHabits.map((name) => name.trim())
    if (names.some((name) => !name)) {
      setupError = 'Give each of your three habits a short name.'
      return
    }
    if (new Set(names.map((name) => name.toLowerCase())).size !== names.length) {
      setupError = 'Choose three different habits so your tracker stays clear.'
      return
    }
    data = {
      version: 1,
      title: setupTitle.trim() || 'My Habit Project',
      startDate: setupDate,
      habits: names.map(createHabit),
      completions: {},
    }
    monthCursor = new Date(today.getFullYear(), today.getMonth(), 1)
  }

  function changeMonth(amount: number): void {
    monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + amount, 1)
  }

  function goToToday(): void {
    monthCursor = new Date(today.getFullYear(), today.getMonth(), 1)
  }

  function openSettings(): void {
    if (!data) return
    draftTitle = data.title
    draftHabits = data.habits.map((habit) => ({ ...habit }))
    settingsError = ''
    settingsOpen = true
  }

  function addHabit(): void {
    if (draftHabits.length >= 6) return
    draftHabits.push(createHabit('', draftHabits.length))
  }

  function saveSettings(): void {
    if (!data) return
    const names = draftHabits.map((habit) => habit.name.trim())
    if (!draftTitle.trim()) {
      settingsError = 'Give your project a name.'
      return
    }
    if (!draftHabits.length || names.some((name) => !name)) {
      settingsError = 'Keep at least one habit, and give every habit a name.'
      return
    }
    if (new Set(names.map((name) => name.toLowerCase())).size !== names.length) {
      settingsError = 'Each habit needs a different name.'
      return
    }
    const activeIds = new Set(draftHabits.map((habit) => habit.id))
    data.title = draftTitle.trim()
    data.habits = draftHabits.map((habit) => ({ ...habit, name: habit.name.trim() }))
    for (const [day, ids] of Object.entries(data.completions)) {
      data.completions[day] = ids.filter((id) => activeIds.has(id))
    }
    settingsOpen = false
    notify('Changes saved')
  }

  function resetTracker(): void {
    if (!confirm('Delete this habit project and all of its checkmarks? This cannot be undone.')) return
    localStorage.removeItem(STORAGE_KEY)
    data = null
    settingsOpen = false
    setupTitle = 'My Habit Project'
    setupDate = todayKey
    setupHabits = ['', '', '']
  }

  function exportCsv(): void {
    if (!data) return
    const blob = new Blob(['\ufeff', createCsv(data, today)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'habit-tracker'}-${todayKey}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    notify('CSV downloaded')
  }

  function notify(message: string): void {
    toast = message
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast = ''), 2600)
  }
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && (settingsOpen = false)} />

<svelte:head>
  <title>{data ? `${data.title} · Daily Habits` : 'Daily Habits'}</title>
  <meta
    name="description"
    content="A simple, private daily habit tracker for student projects. No account required."
  />
</svelte:head>

{#if !data}
  <main class="setup-page">
    <div class="setup-orbit orbit-one" aria-hidden="true"></div>
    <div class="setup-orbit orbit-two" aria-hidden="true"></div>
    <section class="setup-card" aria-labelledby="setup-heading">
      <div class="brand brand-centered">
        <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
        <span>Daily Habits</span>
      </div>

      <div class="setup-intro">
        <p class="eyebrow">Small steps, visible progress</p>
        <h1 id="setup-heading">Build a routine<br />one day at a time.</h1>
        <p>Choose three things you want to practice. Check them off each day and watch your consistency grow.</p>
      </div>

      <form class="setup-form" onsubmit={finishSetup}>
        <label>
          <span>Project name</span>
          <input bind:value={setupTitle} maxlength="60" autocomplete="off" />
        </label>

        <fieldset>
          <legend>Your three daily habits</legend>
          <p class="field-help">Keep them specific and doable.</p>
          <div class="habit-inputs">
            {#each setupHabits as _, index}
              <label class="habit-input">
                <span class="color-dot" style:--habit-color={HABIT_COLORS[index]}></span>
                <span class="sr-only">Habit {index + 1}</span>
                <input
                  bind:value={setupHabits[index]}
                  placeholder={['Read for 20 minutes', 'Drink 6 glasses of water', 'Practice an instrument'][index]}
                  maxlength="50"
                  autocomplete="off"
                />
              </label>
            {/each}
          </div>
        </fieldset>

        <label class="start-date-field">
          <span>First day of your project</span>
          <input type="date" bind:value={setupDate} max={todayKey} required />
        </label>

        {#if setupError}<p class="form-error" role="alert">{setupError}</p>{/if}

        <button class="primary-button setup-submit" type="submit">
          Start tracking
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </form>

      <p class="privacy-note">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2M6 10h12v10H6z" /></svg>
        No account needed. Your data stays in this browser.
      </p>
    </section>
  </main>
{:else}
  <div class="app-shell">
    <header class="site-header">
      <a class="brand" href="/" aria-label="Daily Habits home">
        <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
        <span>Daily Habits</span>
      </a>
      <div class="header-actions">
        <button class="button secondary-button" type="button" onclick={exportCsv}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" /></svg>
          <span>Export CSV</span>
        </button>
        <button class="icon-button" type="button" onclick={openSettings} aria-label="Open settings">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.57 19a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.2 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4h-.1v-4h.1A1.7 1.7 0 0 0 4.4 8.57a1.7 1.7 0 0 0-.34-1.88L4 6.63 6.83 3.8l.06.06A1.7 1.7 0 0 0 8.57 4.2a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1v-.1h4v.1A1.7 1.7 0 0 0 15 4.4a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 8.6a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.1v4h-.1a1.7 1.7 0 0 0-1.7 1Z" /></svg>
        </button>
      </div>
    </header>

    <main class="dashboard">
      <section class="welcome-row">
        <div>
          <p class="eyebrow">{today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1>{data.title}</h1>
          <p>Every checkmark is a vote for the person you want to become.</p>
        </div>
        <div class="today-ring" style:--progress={`${todayPercent * 3.6}deg`} aria-label={`${todayPercent}% complete today`}>
          <div><strong>{todayCompleted}/{data.habits.length}</strong><span>today</span></div>
        </div>
      </section>

      <section class="today-section" aria-labelledby="today-heading">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Daily check-in</p>
            <h2 id="today-heading">Today</h2>
          </div>
          {#if todayCompleted === data.habits.length}
            <span class="complete-badge">All done — nice work!</span>
          {/if}
        </div>

        <div class="today-grid">
          {#each data.habits as habit (habit.id)}
            {@const checked = isComplete(todayKey, habit.id)}
            <button
              class:checked
              class="habit-card"
              style:--habit-color={habit.color}
              type="button"
              onclick={() => toggleHabit(todayKey, habit.id)}
              aria-pressed={checked}
            >
              <span class="large-check" aria-hidden="true">
                {#if checked}<svg viewBox="0 0 24 24"><path d="m5 12 4.5 4.5L19 7" /></svg>{/if}
              </span>
              <span class="habit-card-copy">
                <strong>{habit.name}</strong>
                <span>{checked ? 'Completed today' : 'Mark as complete'}</span>
              </span>
              <span class="streak"><strong>{habitStreak(habit.id)}</strong> day streak</span>
            </button>
          {/each}
        </div>
      </section>

      <section class="tracker-section" aria-labelledby="tracker-heading">
        <div class="tracker-header">
          <div>
            <p class="eyebrow">Your record</p>
            <h2 id="tracker-heading">Monthly tracker</h2>
          </div>
          <div class="month-controls">
            <button class="icon-button small" type="button" onclick={() => changeMonth(-1)} disabled={!canGoPrevious} aria-label="Previous month">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button class="month-label" type="button" onclick={goToToday} title="Return to this month">{monthLabel}</button>
            <button class="icon-button small" type="button" onclick={() => changeMonth(1)} disabled={!canGoNext} aria-label="Next month">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
          <div class="month-score">
            <strong>{monthStats.percent}%</strong>
            <span>this month</span>
          </div>
        </div>

        <div class="tracker-scroll">
          <table>
            <thead>
              <tr>
                <th class="habit-column">Habit</th>
                {#each monthDates as day}
                  {@const key = dateKey(day)}
                  <th class:today={key === todayKey} class:weekend={day.getDay() === 0 || day.getDay() === 6}>
                    <span>{day.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                    <strong>{day.getDate()}</strong>
                  </th>
                {/each}
                <th class="score-column">Rate</th>
              </tr>
            </thead>
            <tbody>
              {#each data.habits as habit (habit.id)}
                <tr style:--habit-color={habit.color}>
                  <th class="habit-column"><span class="color-dot"></span><span>{habit.name}</span></th>
                  {#each monthDates as day}
                    {@const key = dateKey(day)}
                    {@const available = isAvailable(key)}
                    {@const checked = isComplete(key, habit.id)}
                    <td class:today={key === todayKey} class:weekend={day.getDay() === 0 || day.getDay() === 6}>
                      <button
                        class="day-check"
                        class:checked
                        type="button"
                        disabled={!available}
                        onclick={() => toggleHabit(key, habit.id)}
                        aria-label={`${checked ? 'Uncheck' : 'Check'} ${habit.name} on ${day.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`}
                        aria-pressed={checked}
                      >
                        {#if checked}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 4 4 8-9" /></svg>{/if}
                      </button>
                    </td>
                  {/each}
                  <td class="score-column"><strong>{habitMonthPercent(habit.id)}%</strong></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="tracker-footer">
          <p>Scroll sideways to see the full month.</p>
          <p><span class="mini-lock" aria-hidden="true">●</span> Future days unlock as you go.</p>
        </div>
      </section>

      <section class="data-note">
        <div class="data-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2M6 10h12v10H6z" /></svg>
        </div>
        <div><strong>Your progress belongs to you.</strong><p>It is saved only in this browser. Export a CSV anytime to turn in your work or keep a copy.</p></div>
        <button class="text-button" type="button" onclick={exportCsv}>Download my data <span aria-hidden="true">→</span></button>
      </section>
    </main>

    <footer><span>Daily Habits</span><span>Private by design · No sign-in · No ads</span></footer>
  </div>
{/if}

{#if settingsOpen && data}
  <div class="modal-backdrop" role="presentation" onclick={(event) => event.target === event.currentTarget && (settingsOpen = false)}>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabindex="-1">
      <div class="modal-header">
        <div><p class="eyebrow">Make it yours</p><h2 id="settings-title">Project settings</h2></div>
        <button class="icon-button" type="button" onclick={() => (settingsOpen = false)} aria-label="Close settings">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <label>
        <span>Project name</span>
        <input bind:value={draftTitle} maxlength="60" />
      </label>

      <fieldset>
        <legend>Daily habits</legend>
        <p class="field-help">You can track between one and six habits.</p>
        <div class="edit-habits">
          {#each draftHabits as habit, index (habit.id)}
            <div class="edit-habit">
              <div class="color-picker" aria-label={`Color for ${habit.name || `habit ${index + 1}`}`}>
                <button class="color-choice" style:--habit-color={habit.color} type="button" aria-label="Change habit color" onclick={() => (habit.color = HABIT_COLORS[(HABIT_COLORS.indexOf(habit.color) + 1) % HABIT_COLORS.length])}></button>
              </div>
              <label><span class="sr-only">Habit {index + 1}</span><input bind:value={habit.name} maxlength="50" /></label>
              <button class="remove-button" type="button" onclick={() => draftHabits.splice(index, 1)} disabled={draftHabits.length === 1} aria-label={`Remove ${habit.name || `habit ${index + 1}`}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>
              </button>
            </div>
          {/each}
        </div>
        <button class="add-button" type="button" onclick={addHabit} disabled={draftHabits.length >= 6}>+ Add another habit</button>
      </fieldset>

      {#if settingsError}<p class="form-error" role="alert">{settingsError}</p>{/if}

      <div class="modal-actions">
        <button class="danger-button" type="button" onclick={resetTracker}>Reset all data</button>
        <div>
          <button class="button secondary-button" type="button" onclick={() => (settingsOpen = false)}>Cancel</button>
          <button class="button primary-button" type="button" onclick={saveSettings}>Save changes</button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if toast}<div class="toast" role="status">{toast}</div>{/if}
