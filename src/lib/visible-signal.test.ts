import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { visibleSignalRefresh } from './visible-signal';
let hidden=false;
beforeEach(()=>{vi.useFakeTimers();hidden=false;vi.spyOn(document,'visibilityState','get').mockImplementation(()=>hidden?'hidden':'visible');});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
it('coalesces duplicate events and never polls an unchanged view',async()=>{
  let changed!:()=>void;const refresh=vi.fn(async()=>{});const stop=vi.fn();
  const sub=visibleSignalRefresh(c=>{changed=c;return stop;},refresh,vi.fn());
  changed();changed();await vi.advanceTimersByTimeAsync(100);expect(refresh).toHaveBeenCalledTimes(1);
  expect(refresh).toHaveBeenCalledWith(true);
  await vi.advanceTimersByTimeAsync(120_000);expect(refresh).toHaveBeenCalledTimes(1);
  changed();await vi.advanceTimersByTimeAsync(100);expect(refresh).toHaveBeenCalledTimes(2);
  sub.stop();changed();await vi.advanceTimersByTimeAsync(100);expect(refresh).toHaveBeenCalledTimes(2);
});
it('hidden views detach, skip requests and reconcile when visible',async()=>{
  const stop=vi.fn(),refresh=vi.fn(async()=>{}),subscribe=vi.fn(()=>stop);
  const sub=visibleSignalRefresh(subscribe,refresh,vi.fn());await vi.advanceTimersByTimeAsync(100);
  hidden=true;document.dispatchEvent(new Event('visibilitychange'));await vi.advanceTimersByTimeAsync(10000);
  expect(refresh).toHaveBeenCalledTimes(1);expect(stop).toHaveBeenCalledTimes(1);
  hidden=false;document.dispatchEvent(new Event('visibilitychange'));await vi.advanceTimersByTimeAsync(100);
  expect(refresh).toHaveBeenCalledTimes(2);expect(subscribe).toHaveBeenCalledTimes(2);sub.stop();
});
it('serializes slow requests and retains changes arriving in flight',async()=>{
  let changed!:()=>void;let release!:()=>void;
  const refresh=vi.fn(()=>new Promise<void>(r=>{release=r;}));
  const sub=visibleSignalRefresh(c=>{changed=c;return()=>{};},refresh,vi.fn());
  await vi.advanceTimersByTimeAsync(100);changed();changed();await vi.advanceTimersByTimeAsync(100);
  expect(refresh).toHaveBeenCalledTimes(1);release();await vi.advanceTimersByTimeAsync(100);
  expect(refresh).toHaveBeenCalledTimes(2);sub.stop();release();
});
