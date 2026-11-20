import { describe, expect, it } from 'vitest';
import { isOverdue, todayInLima } from './schedule-overdue.js';

describe('schedule-overdue', () => {
  it('is overdue when the end date passed and it is not completed', () => {
    expect(isOverdue({ status: 'PENDING', endDate: '2027-03-14' }, '2027-03-15')).toBe(true);
    expect(isOverdue({ status: 'IN_PROGRESS', endDate: '2027-03-14' }, '2027-03-15')).toBe(true);
  });

  it('is not overdue on the end date itself', () => {
    expect(isOverdue({ status: 'PENDING', endDate: '2027-03-15' }, '2027-03-15')).toBe(false);
    expect(isOverdue({ status: 'IN_PROGRESS', endDate: '2027-03-15' }, '2027-03-15')).toBe(false);
  });

  it('is not overdue when completed', () => {
    expect(isOverdue({ status: 'COMPLETED', endDate: '2027-03-10' }, '2027-03-15')).toBe(false);
  });

  it('is not overdue without an end date', () => {
    expect(isOverdue({ status: 'PENDING', endDate: null }, '2027-03-15')).toBe(false);
  });

  it('computes today in America/Lima near midnight UTC', () => {
    // 03:30 UTC del 16 de marzo equivale a 22:30 del 15 de marzo en America/Lima (UTC-5)
    const lateEveningLima = new Date('2027-03-16T03:30:00.000Z');
    expect(todayInLima(lateEveningLima)).toBe('2027-03-15');
  });
});
