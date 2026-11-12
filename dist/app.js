import {
  createEmptyState, addRoom, addCard, applyReview, getDueCards,
  getOverconfidentMisses, getClozeParts, exportBackup, parseBackup,
} from './lib/core.js';
import { createStore } from './lib/store.js';

// UI integration authored with Codex. The imported study core and store are
// implemented separately with Kiro; this module never substitutes mock results.
const STORAGE_KEY = 'recall-mansion-v1';
const MAX_IMPORT_BYTES = 4 * 1024 * 1024;
const confidenceValues = new Set(['unsure', 'maybe', 'confident']);
const ratingValues = new Set(['again', 'hard', 'remembered']);
const $ = id => document.getElementById(id);
const nodes = Object.fromEntries([
  'rooms-grid', 'rooms-empty', 'room-count', 'card-count', 'reviewed-count',
  'due-count', 'start-review', 'review-availability', 'load-sample',
  'overconfident-list', 'overconfident-count', 'overconfident-empty', 'overconfident-summary',
  'new-room-dialog', 'new-room-form', 'room-title-input', 'room-note-input', 'new-room-error',
  'room-dialog', 'room-dialog-title', 'room-note', 'card-form', 'card-phrase',
  'card-occurrence', 'selection-start', 'selection-end', 'cloze-preview',
  'card-answer-preview', 'card-error', 'room-cards', 'room-cards-empty', 'review-room',
  'review-dialog', 'review-room-name', 'review-progress', 'review-progress-bar',
  'review-card-status', 'review-prompt', 'answer-section', 'review-answer',
  'confidence-fieldset', 'reveal-answer', 'rating-section', 'remembered-interval',
  'review-feedback', 'review-error', 'next-card', 'import-dialog', 'backup-file',
  'import-summary', 'import-error', 'confirm-import', 'export-backup',
  'app-status', 'app-error', 'storage-status', 'how-it-works-dialog', 'room-card-template',
].map(id => [id, $(id)]));

let state = createEmptyState();
let stateReady = false;
let activeRoomId = null;
let review = null;
let pendingImport = null;
let importGeneration = 0;
let toastTimer;
let dueTimer;

// Accessing localStorage can itself throw. Delay access until the adapter call
// so startup failures enter the same fail-closed path as invalid saved data.
const store = createStore({
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
}, STORAGE_KEY);

const cardStatus = document.createElement('p');
cardStatus.id = 'card-save-status';
cardStatus.className = 'field-hint';
cardStatus.setAttribute('role', 'status');
cardStatus.setAttribute('aria-live', 'polite');
nodes['card-form'].append(cardStatus);

function newId(prefix) {
  const suffix = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function errorText(error) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function showMessage(id, text) {
  nodes[id].textContent = text;
  nodes[id].hidden = !text;
}

function toast(message) {
  clearTimeout(toastTimer);
  showMessage('app-status', message);
  toastTimer = setTimeout(() => showMessage('app-status', ''), 6000);
}

function localDate(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function concise(text, max = 100) {
  const characters = Array.from(text.replace(/\s+/gu, ' ').trim());
  return characters.length > max ? `${characters.slice(0, max).join('')}…` : characters.join('');
}

function requireReady() {
  if (!stateReady) throw new Error('Saved data could not be loaded. Restore a checked backup before making changes.');
}

function setStorageStatus(text) {
  nodes['storage-status'].replaceChildren();
  const dot = document.createElement('span');
  dot.className = 'status-dot';
  dot.setAttribute('aria-hidden', 'true');
  nodes['storage-status'].append(dot, document.createTextNode(text));
}

function storageFailure(error) {
  stateReady = false;
  setStorageStatus('Storage needs attention');
  showMessage('app-error', `Your saved notes could not be loaded: ${errorText(error)} Existing data has not been changed. New saves are disabled. You can restore a valid backup to replace it explicitly.`);
  renderHome();
}

function persist(nextState, { recovery = false } = {}) {
  if (!recovery) {
    requireReady();
    // Refuse a stale write if another tab has changed the durable state.
    // The storage event handler refreshes the UI; this is a second check at save.
    const currentSaved = store.load();
    if (JSON.stringify(currentSaved) !== JSON.stringify(state)) {
      throw new Error('Your saved notes changed in another tab. Reload this page before saving so neither version is overwritten.');
    }
  }
  store.save(nextState);
  // In-memory state advances only after the durable write succeeds.
  state = nextState;
  stateReady = true;
  setStorageStatus('Saved on this device');
  showMessage('app-error', '');
  renderHome();
}

function showDialog(dialog) {
  document.querySelectorAll('dialog[open]').forEach(other => {
    if (other !== dialog) other.close();
  });
  if (!dialog.open) dialog.showModal();
}

function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
}

function renderHome() {
  const focusedRoomId = nodes['rooms-grid'].contains(document.activeElement)
    ? document.activeElement?.closest('.room-card')?.dataset.roomId : null;
  const now = Date.now();
  const due = stateReady ? getDueCards(state, now) : [];
  nodes['room-count'].textContent = String(state.rooms.length);
  nodes['card-count'].textContent = String(state.cards.length);
  nodes['reviewed-count'].textContent = String(state.reviewEvents.length);
  nodes['due-count'].textContent = String(due.length);
  nodes['start-review'].disabled = !stateReady || due.length === 0;
  document.querySelectorAll('[data-action="new-room"]').forEach(button => { button.disabled = !stateReady; });
  document.querySelectorAll('[data-action="export-backup"]').forEach(button => {
    button.disabled = !stateReady;
  });
  const hasSample = state.rooms.some(room => room.isSample);
  nodes['load-sample'].disabled = !stateReady || hasSample;
  nodes['load-sample'].textContent = hasSample ? 'Sample rooms added' : 'Explore a sample ↗';
  if (!stateReady) {
    nodes['review-availability'].textContent = 'Restore a valid backup to use your mansion again.';
  } else if (due.length) {
    nodes['review-availability'].textContent = `${due.length} ${due.length === 1 ? 'small return is' : 'small returns are'} ready when you are.`;
  } else if (!state.cards.length) {
    nodes['review-availability'].textContent = 'Create a card to begin your first review.';
  } else {
    const next = Math.min(...state.cards.map(card => card.dueAt));
    nodes['review-availability'].textContent = `All caught up. Next review: ${localDate(next)}.`;
  }

  nodes['rooms-grid'].replaceChildren();
  nodes['rooms-empty'].hidden = state.rooms.length > 0;
  for (const room of state.rooms) {
    const fragment = nodes['room-card-template'].content.cloneNode(true);
    const button = fragment.querySelector('.room-card');
    const cards = state.cards.filter(card => card.roomId === room.id);
    const roomDue = due.filter(card => card.roomId === room.id);
    const nextDue = cards.length ? Math.min(...cards.map(card => card.dueAt)) : null;
    button.dataset.roomId = room.id;
    button.dataset.state = !cards.length ? 'empty' : roomDue.length ? 'due' : 'complete';
    button.querySelector('.room-card-kicker').textContent = room.isSample ? 'Sample room' : 'A room in your mansion';
    button.querySelector('.room-card-title').textContent = room.title;
    const meta = button.querySelector('.room-card-meta');
    meta.textContent = `${cards.length} ${cards.length === 1 ? 'card' : 'cards'} kept`;
    if (nextDue !== null) {
      const next = document.createElement('span');
      next.className = 'room-next-due';
      next.textContent = nextDue <= now ? 'Next review: ready now' : `Next review: ${localDate(nextDue)}`;
      meta.append(next);
    }
    const status = !cards.length ? 'Keep your first phrase'
      : roomDue.length ? `${roomDue.length} ${roomDue.length === 1 ? 'ghost · card' : 'ghosts · cards'} due`
        : 'Light is on · all caught up';
    button.querySelector('.room-card-state').textContent = status;
    button.setAttribute('aria-label', `${room.title}. ${cards.length} cards. ${status}. Open room.`);
    if (nextDue !== null) button.title = `Next review: ${localDate(nextDue)}`;
    nodes['rooms-grid'].append(fragment);
  }
  if (focusedRoomId) {
    [...nodes['rooms-grid'].querySelectorAll('.room-card')]
      .find(button => button.dataset.roomId === focusedRoomId)?.focus({ preventScroll: true });
  }

  renderSecondLook();
  if (nodes['room-dialog'].open && activeRoomId) renderRoomCards();
  scheduleDueRefresh();
}

function renderSecondLook() {
  const events = stateReady ? getOverconfidentMisses(state) : [];
  const seen = new Set();
  const unique = events.filter(event => {
    if (seen.has(event.cardId)) return false;
    seen.add(event.cardId);
    return true;
  });
  nodes['overconfident-count'].textContent = String(unique.length);
  nodes['overconfident-empty'].hidden = unique.length > 0;
  nodes['overconfident-summary'].hidden = unique.length === 0;
  nodes['overconfident-summary'].textContent = unique.length > 5
    ? `5 most recent of ${unique.length} cards` : `${unique.length} ${unique.length === 1 ? 'card' : 'cards'} to revisit`;
  nodes['overconfident-list'].replaceChildren();
  for (const event of unique.slice(0, 5)) {
    const card = state.cards.find(item => item.id === event.cardId);
    if (!card) continue;
    const room = state.rooms.find(item => item.id === card.roomId);
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = 'open-room';
    button.dataset.roomId = card.roomId;
    button.textContent = concise(getClozeParts(card).answer, 62);
    const meta = document.createElement('small');
    meta.textContent = `${room?.title ?? 'Room'} · confident, then Again · ${localDate(event.at)}`;
    button.append(meta);
    li.append(button);
    nodes['overconfident-list'].append(li);
  }
}

function scheduleDueRefresh() {
  clearTimeout(dueTimer);
  if (!stateReady) return;
  const now = Date.now();
  const future = state.cards.map(card => card.dueAt).filter(at => at > now);
  const untilNext = future.length ? Math.min(...future) - now + 100 : 60000;
  dueTimer = setTimeout(renderHome, Math.max(250, Math.min(60000, untilNext)));
}

function openNewRoom() {
  requireReady();
  nodes['new-room-form'].reset();
  showMessage('new-room-error', '');
  showDialog(nodes['new-room-dialog']);
  nodes['room-title-input'].focus();
}

function openRoom(roomId) {
  requireReady();
  const room = state.rooms.find(item => item.id === roomId);
  if (!room) throw new Error('That room is no longer available.');
  activeRoomId = room.id;
  nodes['room-dialog-title'].textContent = room.title;
  nodes['room-note'].value = room.note;
  nodes['card-form'].reset();
  nodes['selection-start'].value = '';
  nodes['selection-end'].value = '';
  showMessage('card-error', '');
  cardStatus.textContent = '';
  updateCardPreview();
  renderRoomCards();
  showDialog(nodes['room-dialog']);
}

function renderRoomCards() {
  const cards = state.cards.filter(card => card.roomId === activeRoomId)
    .sort((a, b) => a.dueAt - b.dueAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const now = Date.now();
  const due = getDueCards(state, now, activeRoomId);
  nodes['room-cards'].replaceChildren();
  nodes['room-cards-empty'].hidden = cards.length > 0;
  nodes['review-room'].disabled = due.length === 0;
  nodes['review-room'].textContent = due.length ? `Review ${due.length} due ${due.length === 1 ? 'card' : 'cards'} ↗` : 'No cards due now';
  for (const card of cards) {
    const li = document.createElement('li');
    const content = document.createElement('div');
    content.className = 'card-text';
    const answer = document.createElement('strong');
    answer.textContent = concise(getClozeParts(card).answer, 120);
    const meta = document.createElement('small');
    meta.textContent = card.dueAt <= now ? 'Due now' : `Next review: ${localDate(card.dueAt)}`;
    content.append(answer, meta);
    li.append(content);
    nodes['room-cards'].append(li);
  }
}

function phraseMatches(note, phrase) {
  if (!phrase || !phrase.trim()) return [];
  const positions = [];
  let from = 0;
  while (from <= note.length) {
    const start = note.indexOf(phrase, from);
    if (start < 0) break;
    positions.push(start);
    from = start + 1; // Include overlapping occurrences; offsets remain UTF-16.
  }
  return positions;
}

function textareaRepresentation(note) {
  // Textareas normalize CRLF and lone CR. Keep a boundary map so imported
  // notes still produce exact ranges into the original UTF-16 snapshot.
  let text = '';
  const offsets = [0];
  for (let index = 0; index < note.length;) {
    if (note[index] === '\r') {
      text += '\n';
      index += note[index + 1] === '\n' ? 2 : 1;
    } else {
      text += note[index];
      index += 1;
    }
    offsets.push(index);
  }
  return { text, offsets };
}

function selectedRange() {
  const room = state.rooms.find(item => item.id === activeRoomId);
  if (!room) throw new Error('Open a room before creating a card.');
  const phrase = nodes['card-phrase'].value;
  if (!phrase.trim()) throw new Error('Choose a phrase with at least one visible character.');
  if (phrase.length > 500) throw new Error('Choose a phrase of 500 characters or fewer.');
  const occurrence = Number(nodes['card-occurrence'].value);
  if (!Number.isInteger(occurrence) || occurrence < 1) throw new Error('Enter an occurrence number starting at 1.');
  const displayed = textareaRepresentation(room.note);
  const positions = phraseMatches(displayed.text, phrase);
  if (!positions.length) throw new Error('That exact phrase does not appear in this note.');
  if (occurrence > positions.length) throw new Error(`This phrase appears ${positions.length} ${positions.length === 1 ? 'time' : 'times'}. Choose an occurrence in that range.`);
  const position = positions[occurrence - 1];
  return { room, start: displayed.offsets[position], end: displayed.offsets[position + phrase.length] };
}

function appendCloze(element, parts) {
  const blank = document.createElement('span');
  blank.className = 'cloze-blank';
  blank.textContent = ' · · · ';
  blank.setAttribute('aria-label', 'blank');
  element.replaceChildren(document.createTextNode(parts.before), blank, document.createTextNode(parts.after));
}

function updateCardPreview() {
  try {
    const { room, start, end } = selectedRange();
    const parts = getClozeParts({
      id: 'preview', roomId: room.id, noteSnapshot: room.note, start, end,
      dueAt: 0, step: 0, createdAt: 0,
    });
    nodes['selection-start'].value = String(start);
    nodes['selection-end'].value = String(end);
    appendCloze(nodes['cloze-preview'], parts);
    nodes['card-answer-preview'].textContent = parts.answer;
  } catch (error) {
    nodes['selection-start'].value = '';
    nodes['selection-end'].value = '';
    nodes['cloze-preview'].textContent = nodes['card-phrase'].value ? errorText(error) : 'Choose a phrase to see the question.';
    nodes['card-answer-preview'].textContent = '—';
  }
}

function useSelection() {
  const input = nodes['room-note'];
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const phrase = input.value.slice(start, end);
  if (start === end || !phrase.trim()) {
    showMessage('card-error', 'Select a phrase in the note first, or type it into the phrase field.');
    return;
  }
  if (phrase.length > 500) {
    showMessage('card-error', 'Choose a shorter phrase: 500 characters or fewer.');
    return;
  }
  nodes['card-phrase'].value = phrase;
  const positions = phraseMatches(input.value, phrase);
  nodes['card-occurrence'].value = String(positions.indexOf(start) + 1);
  showMessage('card-error', '');
  cardStatus.textContent = '';
  updateCardPreview();
  nodes['card-phrase'].focus();
}

function loadSample() {
  requireReady();
  if (state.rooms.some(room => room.isSample)) {
    toast('Your sample rooms are already in the mansion.');
    return;
  }
  const now = Date.now();
  const samples = [
    {
      title: 'Moonlit observatory',
      note: 'The Moon reflects sunlight rather than producing its own light. A lunar eclipse happens when Earth passes between the Sun and the Moon.',
      phrases: ['reflects sunlight', 'Earth'],
    },
    {
      title: 'Small writing rituals',
      note: 'A first draft makes an idea visible. Revision is a separate task: replace a vague word with one concrete detail.',
      phrases: ['one concrete detail'],
    },
    {
      title: 'The kitchen notebook',
      note: "For a calmer morning, set out a cup and prepare tomorrow's bag before bed. A small routine is easier to repeat when its first step is obvious.",
      phrases: ['its first step'],
    },
  ];
  let next = state;
  for (const sample of samples) {
    const id = newId('sample-room');
    next = addRoom(next, { id, title: sample.title, note: sample.note, now, isSample: true });
    for (const phrase of sample.phrases) {
      const start = sample.note.indexOf(phrase);
      next = addCard(next, { id: newId('sample-card'), roomId: id, start, end: start + phrase.length, now });
    }
  }
  persist(next); // One durable append, only after every sample record validates.
  toast('Three sample rooms are ready. Your existing rooms are still here.');
  nodes['rooms-grid'].querySelector('button')?.focus();
}

function startReview(roomId = null) {
  requireReady();
  const queue = getDueCards(state, Date.now(), roomId ?? undefined).map(card => card.id);
  if (!queue.length) {
    renderHome();
    toast('There are no cards due in this queue right now.');
    return;
  }
  review = { queue, index: 0, completed: 0, confidence: null, revealed: false, committed: false, pendingEvent: null, saving: false };
  showDialog(nodes['review-dialog']);
  showReviewCard();
}

function showReviewCard() {
  if (!review) return;
  let card;
  while (review.index < review.queue.length) {
    card = state.cards.find(item => item.id === review.queue[review.index]);
    if (card && card.dueAt <= Date.now()) break;
    review.index += 1;
  }
  if (review.index >= review.queue.length) {
    const count = review.completed;
    closeDialog(nodes['review-dialog']);
    renderHome();
    toast(`${count} ${count === 1 ? 'review' : 'reviews'} kept. A little more light in the mansion.`);
    return;
  }
  review.confidence = null;
  review.revealed = false;
  review.committed = false;
  review.pendingEvent = null;
  review.saving = false;
  const room = state.rooms.find(item => item.id === card.roomId);
  nodes['review-room-name'].textContent = room?.title ?? 'The reading room';
  nodes['review-progress'].textContent = `Card ${review.index + 1} of ${review.queue.length}`;
  nodes['review-card-status'].textContent = 'Due for a visit';
  nodes['review-progress-bar'].max = review.queue.length;
  nodes['review-progress-bar'].value = review.completed;
  appendCloze(nodes['review-prompt'], getClozeParts(card));
  nodes['review-answer'].textContent = '';
  nodes['answer-section'].hidden = true;
  nodes['rating-section'].hidden = true;
  nodes['next-card'].hidden = true;
  nodes['confidence-fieldset'].disabled = false;
  nodes['confidence-fieldset'].querySelectorAll('input').forEach(input => { input.checked = false; });
  nodes['reveal-answer'].hidden = false;
  nodes['reveal-answer'].disabled = true;
  nodes['rating-section'].querySelectorAll('button').forEach(button => { button.disabled = false; });
  // Display labels reflect the documented schedule; applyReview computes the
  // authoritative next time only when the user actually commits a rating.
  const days = [1, 3, 7, 14, 30][card.step];
  nodes['remembered-interval'].textContent = `In ${days} ${days === 1 ? 'day' : 'days'}`;
  showMessage('review-feedback', '');
  showMessage('review-error', '');
  nodes['confidence-fieldset'].querySelector('input')?.focus();
}

function revealAnswer() {
  if (!review || review.revealed || review.committed || !confidenceValues.has(review.confidence)) return;
  const card = state.cards.find(item => item.id === review.queue[review.index]);
  if (!card) throw new Error('This card is no longer available. Please restart the review.');
  review.revealed = true;
  nodes['confidence-fieldset'].disabled = true;
  nodes['review-answer'].textContent = getClozeParts(card).answer;
  nodes['answer-section'].hidden = false;
  nodes['reveal-answer'].hidden = true;
  nodes['rating-section'].hidden = false;
  nodes['rating-section'].querySelector('button')?.focus();
}

function rateCard(rating) {
  if (!review || !review.revealed || review.committed || review.saving || !ratingValues.has(rating)) return;
  if (review.pendingEvent && review.pendingEvent.rating !== rating) return;
  if (!review.pendingEvent) {
    review.pendingEvent = {
      id: newId('review'), cardId: review.queue[review.index], at: Date.now(),
      confidence: review.confidence, rating,
    };
  }
  const currentReview = review;
  currentReview.saving = true;
  nodes['rating-section'].querySelectorAll('button').forEach(button => { button.disabled = true; });
  try {
    const next = applyReview(state, currentReview.pendingEvent);
    persist(next);
    currentReview.committed = true;
    nodes['rating-section'].hidden = true;
    nodes['review-card-status'].textContent = 'Review saved';
    nodes['review-progress-bar'].value = currentReview.completed + 1;
    const updated = state.cards.find(card => card.id === currentReview.pendingEvent.cardId);
    showMessage('review-error', '');
    showMessage('review-feedback', `Saved. This card returns ${localDate(updated.dueAt)}.`);
    const last = currentReview.index >= currentReview.queue.length - 1;
    nodes['next-card'].textContent = last ? 'Back to the mansion →' : 'Next small return →';
    nodes['next-card'].hidden = false;
    nodes['next-card'].focus();
  } catch (error) {
    showMessage('review-error', `This review has not been confirmed saved. ${errorText(error)} Retry the same rating to save this exact review once.`);
    nodes['rating-section'].querySelectorAll('button').forEach(button => {
      button.disabled = button.dataset.rating !== currentReview.pendingEvent.rating;
    });
  } finally {
    currentReview.saving = false;
  }
}

function nextCard() {
  if (!review?.committed) return;
  review.completed += 1;
  review.index += 1;
  showReviewCard();
}

function downloadBackup() {
  requireReady();
  const text = exportBackup(state, Date.now());
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `recall-mansion-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Your backup download is ready. Keep it somewhere you can find again.');
}

function openImport() {
  importGeneration += 1;
  pendingImport = null;
  nodes['backup-file'].value = '';
  nodes['confirm-import'].disabled = true;
  nodes['import-summary'].replaceChildren();
  nodes['import-summary'].hidden = true;
  showMessage('import-error', '');
  showDialog(nodes['import-dialog']);
}

async function inspectImport() {
  const generation = ++importGeneration;
  const file = nodes['backup-file'].files?.[0];
  pendingImport = null;
  nodes['confirm-import'].disabled = true;
  nodes['import-summary'].hidden = true;
  showMessage('import-error', '');
  if (!file) return;
  try {
    if (file.size > MAX_IMPORT_BYTES) throw new Error('Choose a backup no larger than 4 MiB.');
    if (file.size === 0) throw new Error('This file is empty.');
    const text = await file.text();
    if (generation !== importGeneration || !nodes['import-dialog'].open) return;
    const checked = parseBackup(text);
    pendingImport = { state: checked, name: file.name };
    nodes['import-summary'].textContent = `${file.name}: ${checked.rooms.length} rooms, ${checked.cards.length} cards, and ${checked.reviewEvents.length} reviews. Checked and ready. Your current data will only be replaced if you choose the button below.`;
    nodes['import-summary'].hidden = false;
    nodes['confirm-import'].disabled = false;
  } catch (error) {
    if (generation !== importGeneration) return;
    showMessage('import-error', `${errorText(error)} Your existing saved data has not been changed.`);
  }
}

function confirmImport() {
  if (!pendingImport) return;
  nodes['confirm-import'].disabled = true;
  try {
    // This named confirmation button is the only replacement path. Validation
    // already finished; store.save validates again before its atomic setItem.
    persist(pendingImport.state, { recovery: true });
    pendingImport = null;
    activeRoomId = null;
    review = null;
    closeDialog(nodes['import-dialog']);
    toast('Backup restored. Your mansion is ready to return to.');
  } catch (error) {
    showMessage('import-error', `The backup could not be saved. ${errorText(error)} Your existing saved data has not been replaced.`);
    nodes['confirm-import'].disabled = false;
  }
}

nodes['new-room-form'].addEventListener('submit', event => {
  event.preventDefault();
  const submit = nodes['new-room-form'].querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    requireReady();
    const id = newId('room');
    const next = addRoom(state, {
      id, title: nodes['room-title-input'].value.trim(), note: nodes['room-note-input'].value, now: Date.now(),
    });
    persist(next);
    closeDialog(nodes['new-room-dialog']);
    openRoom(id);
  } catch (error) {
    showMessage('new-room-error', `The room was not saved. ${errorText(error)}`);
  } finally {
    submit.disabled = false;
  }
});

nodes['card-form'].addEventListener('submit', event => {
  event.preventDefault();
  const submit = nodes['card-form'].querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    requireReady();
    const { room, start, end } = selectedRange();
    const next = addCard(state, { id: newId('card'), roomId: room.id, start, end, now: Date.now() });
    persist(next);
    showMessage('card-error', '');
    cardStatus.textContent = 'Card kept. It is ready for its first review.';
    nodes['card-form'].reset();
    nodes['selection-start'].value = '';
    nodes['selection-end'].value = '';
    updateCardPreview();
    renderRoomCards();
    nodes['card-phrase'].focus();
  } catch (error) {
    cardStatus.textContent = '';
    showMessage('card-error', `The card was not saved. ${errorText(error)}`);
  } finally {
    submit.disabled = false;
  }
});

for (const id of ['card-phrase', 'card-occurrence']) {
  nodes[id].addEventListener('input', () => {
    cardStatus.textContent = '';
    showMessage('card-error', '');
    updateCardPreview();
  });
}

nodes['confidence-fieldset'].addEventListener('change', event => {
  if (!review || review.revealed || review.committed || !confidenceValues.has(event.target.value)) return;
  review.confidence = event.target.value;
  nodes['reveal-answer'].disabled = false;
});
nodes['backup-file'].addEventListener('change', inspectImport);

document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-action]');
  if (!button || button.disabled) return;
  try {
    switch (button.dataset.action) {
      case 'new-room': openNewRoom(); break;
      case 'load-sample': loadSample(); break;
      case 'open-room': openRoom(button.dataset.roomId); break;
      case 'use-selection': useSelection(); break;
      case 'start-review': startReview(); break;
      case 'review-room': startReview(activeRoomId); break;
      case 'reveal-answer': revealAnswer(); break;
      case 'rate-card': rateCard(button.dataset.rating); break;
      case 'next-card': nextCard(); break;
      case 'show-help': showDialog(nodes['how-it-works-dialog']); break;
      case 'open-import': openImport(); break;
      case 'confirm-import': confirmImport(); break;
      case 'export-backup': downloadBackup(); break;
      case 'close-dialog': closeDialog(button.closest('dialog')); break;
      default: break;
    }
  } catch (error) {
    const dialog = button.closest('dialog');
    const message = errorText(error);
    if (dialog === nodes['room-dialog']) showMessage('card-error', message);
    else if (dialog === nodes['review-dialog']) showMessage('review-error', message);
    else showMessage('app-error', message);
  }
});

nodes['review-dialog'].addEventListener('close', () => {
  if (!nodes['review-dialog'].open) review = null;
});
nodes['room-dialog'].addEventListener('close', () => {
  if (!nodes['room-dialog'].open) activeRoomId = null;
});
nodes['import-dialog'].addEventListener('close', () => {
  if (!nodes['import-dialog'].open) {
    importGeneration += 1;
    pendingImport = null;
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderHome();
});
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  review = null;
  activeRoomId = null;
  try {
    state = store.load();
    stateReady = true;
    setStorageStatus('Updated from another tab');
    showMessage('app-error', '');
    renderHome();
    toast('Your mansion changed in another tab. The latest saved version is now shown.');
  } catch (error) {
    storageFailure(error);
  }
});

try {
  state = store.load();
  stateReady = true;
  setStorageStatus('On this device');
  renderHome();
} catch (error) {
  storageFailure(error);
}
