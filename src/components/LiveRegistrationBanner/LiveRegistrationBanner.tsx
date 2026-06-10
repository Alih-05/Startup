import './LiveRegistrationBanner.css';
import { useState, useEffect } from 'react';

/**
 * LiveRegistrationBanner
 *
 * Отображает строку с анимированным числом людей,
 * которые "прямо сейчас" пытаются зарегистрироваться.
 *
 * Как это работает:
 *  - Стартовое значение — случайное число в диапазоне [BASE_MIN, BASE_MAX].
 *  - Каждые TICK_INTERVAL мс счётчик чуть меняется (±DRIFT),
 *    оставаясь в заданном коридоре. Это создаёт эффект живого потока.
 *  - При первом появлении число «отсчитывается» вверх (анимация входа).
 */

const BASE_MIN = 120;   // минимум «живых» пользователей
const BASE_MAX = 210;   // максимум
const DRIFT     = 7;    // максимальное изменение за тик
const TICK_INTERVAL = 3500; // мс между обновлениями

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function LiveRegistrationBanner() {
  const [count, setCount] = useState<number | null>(null);
  const [prev, setPrev]   = useState<number | null>(null);
  const [flash, setFlash] = useState(false);

  // Инициализация — анимируем «заполнение» числа от 0 до стартового значения
  useEffect(() => {
    const start = randomBetween(BASE_MIN, BASE_MAX);
    let current = 0;
    const step = Math.ceil(start / 30);

    const interval = setInterval(() => {
      current = Math.min(current + step, start);
      setCount(current);
      if (current >= start) clearInterval(interval);
    }, 30);

    return () => clearInterval(interval);
  }, []);

  // Периодическое обновление числа
  useEffect(() => {
    if (count === null) return;

    const timer = setInterval(() => {
      setCount(prev => {
        if (prev === null) return prev;
        const delta = randomBetween(-DRIFT, DRIFT);
        const next  = clamp(prev + delta, BASE_MIN, BASE_MAX);
        setPrev(prev);
        setFlash(true);
        setTimeout(() => setFlash(false), 600);
        return next;
      });
    }, TICK_INTERVAL);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count !== null]);

  if (count === null) return null;

  const trend = prev !== null ? (count > prev ? 'up' : count < prev ? 'down' : 'same') : 'same';

  return (
    <div
      className="live-registration-banner"
      role="status"
      aria-live="polite"
      aria-label={`${count} человек регистрируются прямо сейчас`}
    >
      {/* Пульсирующая зелёная точка */}
      <span className="live-dot" aria-hidden="true" />

      {/* Счётчик */}
      <span
        className={`live-count ${flash ? 'live-count--flash' : ''}`}
        aria-hidden="true"
      >
        {count.toLocaleString('ru-RU')}
      </span>

      {/* Стрелка тренда */}
      {trend !== 'same' && (
        <span
          className={`live-trend live-trend--${trend}`}
          aria-hidden="true"
        >
          {trend === 'up' ? '▲' : '▼'}
        </span>
      )}

      <span className="live-label">
        человек сейчас регистрируются
      </span>
    </div>
  );
}
