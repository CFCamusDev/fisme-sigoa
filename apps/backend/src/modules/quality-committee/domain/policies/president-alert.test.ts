import { describe, expect, it } from 'vitest';
import { computePresidentAlerts } from './president-alert.js';

describe('president-alert (T-025-11)', () => {
  it('alerts a role holder who is not the current president', () => {
    const alerts = computePresidentAlerts({
      roleHolders: [
        { userId: 'usr-old', fullName: 'Pedro Salas' },
        { userId: 'usr-new', fullName: 'Ana Torres' },
      ],
      committeeMembers: [
        { position: 'PRESIDENT', userId: 'usr-new' },
        { position: 'MEMBER', userId: 'usr-old' },
      ],
    });

    expect(alerts).toEqual([{ userId: 'usr-old', fullName: 'Pedro Salas' }]);
  });

  it('does not alert the current president', () => {
    const alerts = computePresidentAlerts({
      roleHolders: [{ userId: 'usr-1', fullName: 'Ana Torres' }],
      committeeMembers: [{ position: 'PRESIDENT', userId: 'usr-1' }],
    });

    expect(alerts).toEqual([]);
  });

  it('alerts every holder when no committee is in force', () => {
    const alerts = computePresidentAlerts({
      roleHolders: [
        { userId: 'usr-2', fullName: 'Luis Rojas' },
        { userId: 'usr-1', fullName: 'Ana Torres' },
      ],
      committeeMembers: null,
    });

    expect(alerts).toEqual([
      { userId: 'usr-1', fullName: 'Ana Torres' },
      { userId: 'usr-2', fullName: 'Luis Rojas' },
    ]);
  });

  it('alerts the holder when the president has no linked user', () => {
    const alerts = computePresidentAlerts({
      roleHolders: [{ userId: 'usr-old', fullName: 'Pedro Salas' }],
      committeeMembers: [{ position: 'PRESIDENT', userId: null }],
    });

    expect(alerts).toEqual([{ userId: 'usr-old', fullName: 'Pedro Salas' }]);
  });

  it('orders alerts by name', () => {
    const alerts = computePresidentAlerts({
      roleHolders: [
        { userId: 'usr-c', fullName: 'Carlos Méndez' },
        { userId: 'usr-a', fullName: 'Ana Torres' },
        { userId: 'usr-b', fullName: 'Beatriz Vega' },
      ],
      committeeMembers: null,
    });

    expect(alerts.map((alert) => alert.fullName)).toEqual([
      'Ana Torres',
      'Beatriz Vega',
      'Carlos Méndez',
    ]);
  });

  it('returns no alerts without role holders', () => {
    expect(
      computePresidentAlerts({
        roleHolders: [],
        committeeMembers: [{ position: 'PRESIDENT', userId: 'usr-1' }],
      }),
    ).toEqual([]);
  });
});
