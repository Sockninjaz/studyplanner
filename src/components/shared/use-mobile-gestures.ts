'use client';

import { useEffect, useRef } from 'react';

/**
 * Native-like mobile back gesture interceptor.
 * When an input/textarea is focused, swiping from the edge or pressing system back
 * collapses the virtual keyboard and blurs the input instead of navigating away.
 */
export function useMobileKeyboardBack() {
  const isPushedRef = useRef(false);
  const isSilentBackRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleFocusIn = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') {
        if (!isPushedRef.current) {
          isPushedRef.current = true;
          window.history.pushState({ __subState: 'keyboard' }, '');
        }
      }
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        const active = document.activeElement;
        const stillInput = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA';
        if (!stillInput && isPushedRef.current) {
          isPushedRef.current = false;
          isSilentBackRef.current = true;
          window.history.back();
        }
      }, 80);
    };

    const handlePopState = () => {
      if (isSilentBackRef.current) {
        isSilentBackRef.current = false;
        return;
      }

      if (isPushedRef.current) {
        isPushedRef.current = false;
        const active = document.activeElement;
        if (active instanceof HTMLElement && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
          active.blur();
        }
      }
    };

    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
      window.removeEventListener('popstate', handlePopState);
      if (isPushedRef.current) {
        isPushedRef.current = false;
        window.history.back();
      }
    };
  }, []);
}
