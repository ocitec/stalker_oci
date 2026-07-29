import { describe, it, expect } from '@jest/globals';
import { UserRole } from '@prisma/client';
import {
  requiredApprovalLevels, roleForLevel, nextApproverRole, canApproveLevel,
} from './approval-workflow.util';

describe('approval-workflow.util', () => {
  describe('requiredApprovalLevels', () => {
    it('requires a single level below the CFO threshold', () => {
      expect(requiredApprovalLevels(0)).toBe(1);
      expect(requiredApprovalLevels(500_000)).toBe(1);
      expect(requiredApprovalLevels(999_999)).toBe(1);
    });

    it('requires two levels at or above the CFO threshold', () => {
      expect(requiredApprovalLevels(1_000_000)).toBe(2);
      expect(requiredApprovalLevels(5_000_000)).toBe(2);
    });

    it('never returns fewer than one level', () => {
      expect(requiredApprovalLevels(-10)).toBe(1);
    });
  });

  describe('roleForLevel', () => {
    it('maps levels to the configured ladder roles', () => {
      expect(roleForLevel(1)).toBe(UserRole.FINANCE);
      expect(roleForLevel(2)).toBe(UserRole.CFO);
    });

    it('returns null for an undefined level', () => {
      expect(roleForLevel(99)).toBeNull();
    });
  });

  describe('nextApproverRole', () => {
    it('returns the level-1 role when nothing is cleared', () => {
      expect(nextApproverRole(0, 750_000)).toBe(UserRole.FINANCE);
    });

    it('returns null once required levels are cleared (small value → 1 level)', () => {
      expect(nextApproverRole(1, 750_000)).toBeNull();
    });

    it('advances to CFO for a large value after level 1', () => {
      expect(nextApproverRole(1, 2_000_000)).toBe(UserRole.CFO);
      expect(nextApproverRole(2, 2_000_000)).toBeNull();
    });
  });

  describe('canApproveLevel', () => {
    it('lets the exact role approve its level', () => {
      expect(canApproveLevel(UserRole.FINANCE, 1)).toBe(true);
      expect(canApproveLevel(UserRole.CFO, 2)).toBe(true);
    });

    it('lets a more senior role approve a junior level', () => {
      expect(canApproveLevel(UserRole.CFO, 1)).toBe(true);
      expect(canApproveLevel(UserRole.ADMIN, 2)).toBe(true);
    });

    it('blocks a junior role from a senior level', () => {
      expect(canApproveLevel(UserRole.FINANCE, 2)).toBe(false);
      expect(canApproveLevel(UserRole.SALES, 1)).toBe(false);
    });

    it('returns false for an undefined level', () => {
      expect(canApproveLevel(UserRole.ADMIN, 99)).toBe(false);
    });
  });
});
