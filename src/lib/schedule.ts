import { fsrs, generatorParameters, Rating, State, type Card as FCard, type Grade } from 'ts-fsrs';
import type { Card } from './state';
import { DAYMS, today } from './utils';

/** UI grades: 0 Again, 1 Hard, 2 Good, 3 Easy */
export type G = 0 | 1 | 2 | 3;
const RATING: Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];

// Day-based scheduling: in-session repeats handle "Again", so FSRS short-term steps are off.
const params = { request_retention: 0.9, maximum_interval: 365, enable_short_term: false };
const withFuzz = fsrs(generatorParameters({ ...params, enable_fuzz: true }));
const noFuzz = fsrs(generatorParameters({ ...params, enable_fuzz: false }));

function toF(c: Card | undefined, now: number): FCard {
  if (!c || c.st === 0) {
    return {
      due: new Date(now),
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      state: State.New,
    };
  }
  const last = c.last || now - Math.max(c.iv, 1) * DAYMS;
  return {
    due: new Date(now + (c.due - today(now)) * DAYMS),
    stability: Math.max(c.s, 0.1),
    difficulty: Math.min(10, Math.max(1, c.d)),
    elapsed_days: Math.max(0, Math.floor((now - last) / DAYMS)),
    scheduled_days: c.iv,
    learning_steps: 0,
    reps: c.reps,
    lapses: c.lapses,
    state: c.st as State,
    last_review: new Date(last),
  };
}

export interface SchedResult {
  card: Card;
  /** true when the card should come back in this session */
  again: boolean;
  /** days until next review */
  iv: number;
}

export function sched(c: Card | undefined, g: G, fuzz = true, now = Date.now()): SchedResult {
  const t = today(now);
  const f = (fuzz ? withFuzz : noFuzz).next(toF(c, now), new Date(now), RATING[g]).card;
  if (g === 0) {
    // Forgotten: due again today and repeated in this session.
    return {
      card: { due: t, iv: 0, s: f.stability, d: f.difficulty, st: f.state, reps: f.reps, lapses: f.lapses, last: now },
      again: true,
      iv: 0,
    };
  }
  const iv = Math.max(1, Math.min(365, f.scheduled_days));
  return {
    card: { due: t + iv, iv, s: f.stability, d: f.difficulty, st: State.Review, reps: f.reps, lapses: f.lapses, last: now },
    again: false,
    iv,
  };
}

/** Marks a word as already known (placement test / sweep): scheduled for one check-up 10–60 days out. */
export function placedCard(now = Date.now()): Card {
  const iv = 30 + Math.floor(Math.random() * 15);
  return { due: today(now) + 10 + Math.floor(Math.random() * 50), iv, s: iv, d: 3, st: State.Review, reps: 1, lapses: 0, last: now, placed: true };
}

/** Pulls a word into today's reviews (after a quiz miss or "Review today"). */
export function dueTodayCard(c: Card | undefined, now = Date.now()): Card {
  const t = today(now);
  if (!c) return { due: t, iv: 0, s: 0, d: 0, st: State.New, reps: 0, lapses: 0, last: now };
  const iv = c.iv >= 21 ? Math.max(1, Math.round(c.iv / 3)) : c.iv;
  return { ...c, due: Math.min(c.due, t), iv, s: c.iv >= 21 ? Math.max(1, c.s / 3) : c.s, last: now };
}
