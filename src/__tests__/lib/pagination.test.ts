import { describe, it, expect } from 'vitest';
import {
    DEFAULT_PAGE_SIZE,
    SUPABASE_MAX_ROWS,
    isPossiblyTruncated,
    getPageRange,
    getTotalPages,
} from '@/lib/pagination';

describe('Constants', () => {
    it('has sensible defaults', () => {
        expect(DEFAULT_PAGE_SIZE).toBe(200);
        expect(SUPABASE_MAX_ROWS).toBe(1000);
    });
});

describe('isPossiblyTruncated', () => {
    it('returns true when data length matches limit', () => {
        expect(isPossiblyTruncated(1000)).toBe(true);     // default limit
        expect(isPossiblyTruncated(200, 200)).toBe(true);  // custom limit
    });

    it('returns true when data length exceeds limit', () => {
        expect(isPossiblyTruncated(1001)).toBe(true);
    });

    it('returns false when data is below the limit', () => {
        expect(isPossiblyTruncated(999)).toBe(false);
        expect(isPossiblyTruncated(0)).toBe(false);
    });
});

describe('getPageRange', () => {
    it('calculates correct range for page 0', () => {
        const { from, to } = getPageRange(0);
        expect(from).toBe(0);
        expect(to).toBe(199); // DEFAULT_PAGE_SIZE - 1
    });

    it('calculates correct range for page 1', () => {
        const { from, to } = getPageRange(1);
        expect(from).toBe(200);
        expect(to).toBe(399);
    });

    it('works with custom page size', () => {
        const { from, to } = getPageRange(2, 50);
        expect(from).toBe(100);
        expect(to).toBe(149);
    });

    it('page 0 always starts at 0', () => {
        expect(getPageRange(0, 10).from).toBe(0);
        expect(getPageRange(0, 100).from).toBe(0);
        expect(getPageRange(0, 1000).from).toBe(0);
    });
});

describe('getTotalPages', () => {
    it('returns 1 for empty data', () => {
        expect(getTotalPages(0)).toBe(1); // at least 1 page
    });

    it('returns 1 when count is less than page size', () => {
        expect(getTotalPages(100)).toBe(1);
        expect(getTotalPages(199)).toBe(1);
    });

    it('returns correct count for exact multiples', () => {
        expect(getTotalPages(200)).toBe(1);
        expect(getTotalPages(400)).toBe(2);
        expect(getTotalPages(1000)).toBe(5);
    });

    it('rounds up for partial pages', () => {
        expect(getTotalPages(201)).toBe(2);
        expect(getTotalPages(401)).toBe(3);
    });

    it('works with custom page size', () => {
        expect(getTotalPages(25, 10)).toBe(3);
        expect(getTotalPages(30, 10)).toBe(3);
        expect(getTotalPages(31, 10)).toBe(4);
    });
});
