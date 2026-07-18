import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStackBuilderStore } from '../stack-builder';
import { DEFAULT_TARGET_PROFILE_ID } from '../../lib/resource-profiles';

// Note: the test setup mocks `zustand/middleware` so `persist` is a no-op
// passthrough — runtime storage writes aren't observable here. The persisted
// field (`targetProfileId` in `partialize`) is verified by type-check and
// mirrors the other persisted stack fields.
describe('Stack Builder Store — target profile', () => {
  beforeEach(() => {
    useStackBuilderStore.getState().clearStack();
  });

  it('defaults to the default target profile', () => {
    const { result } = renderHook(() => useStackBuilderStore());
    expect(result.current.targetProfileId).toBe(DEFAULT_TARGET_PROFILE_ID);
  });

  it('updates the target profile without marking the stack dirty', () => {
    const { result } = renderHook(() => useStackBuilderStore());

    act(() => {
      result.current.setTargetProfile('rpi5');
    });

    expect(result.current.targetProfileId).toBe('rpi5');
    // Target profile is a builder preference, not stack content.
    expect(result.current.isDirty).toBe(false);
  });
});
