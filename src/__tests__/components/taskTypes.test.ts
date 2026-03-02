import { describe, it, expect } from 'vitest';
import {
    PRIORITY_CONFIG,
    STATUS_CONFIG,
    formatDeadline,
} from '@/components/tasks/taskTypes';

describe('PRIORITY_CONFIG', () => {
    it('has all 4 priority levels', () => {
        const keys = Object.keys(PRIORITY_CONFIG);
        expect(keys).toContain('urgente');
        expect(keys).toContain('alta');
        expect(keys).toContain('media');
        expect(keys).toContain('baja');
        expect(keys).toHaveLength(4);
    });

    it('each priority has label, color, bg, and icon', () => {
        Object.entries(PRIORITY_CONFIG).forEach(([_, cfg]) => {
            expect(cfg).toHaveProperty('label');
            expect(cfg).toHaveProperty('color');
            expect(cfg).toHaveProperty('bg');
            expect(cfg).toHaveProperty('icon');
        });
    });
});

describe('STATUS_CONFIG', () => {
    it('has all 4 status values', () => {
        const keys = Object.keys(STATUS_CONFIG);
        expect(keys).toContain('pendiente');
        expect(keys).toContain('en_progreso');
        expect(keys).toContain('completada');
        expect(keys).toContain('vencida');
        expect(keys).toHaveLength(4);
    });

    it('each status has label, color, and bg', () => {
        Object.entries(STATUS_CONFIG).forEach(([_, cfg]) => {
            expect(cfg).toHaveProperty('label');
            expect(cfg).toHaveProperty('color');
            expect(cfg).toHaveProperty('bg');
        });
    });
});

describe('formatDeadline', () => {
    it('returns an object with text, isOverdue, isUrgent', () => {
        const result = formatDeadline('2099-03-15T10:00:00Z');
        expect(result).toHaveProperty('text');
        expect(result).toHaveProperty('isOverdue');
        expect(result).toHaveProperty('isUrgent');
        expect(typeof result.text).toBe('string');
        expect(typeof result.isOverdue).toBe('boolean');
        expect(typeof result.isUrgent).toBe('boolean');
    });

    it('marks past deadlines as overdue', () => {
        const result = formatDeadline('2020-01-01T00:00:00Z');
        expect(result.isOverdue).toBe(true);
        expect(result.text).toContain('Venció');
    });

    it('marks far future as not overdue and not urgent', () => {
        const result = formatDeadline('2099-12-31T23:59:59Z');
        expect(result.isOverdue).toBe(false);
        expect(result.isUrgent).toBe(false);
    });
});
