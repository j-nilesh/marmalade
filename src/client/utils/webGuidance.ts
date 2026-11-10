import type React from 'react';

/**
 * Progressive enhancement & ARIA sync for :user-valid / :user-invalid
 * (per modern-web-guidance `validate-input-after-interaction`).
 */
export function initUserInvalidValidation(root: Document | HTMLElement = document): () => void {
  const dirtyState = new WeakMap<
    Element,
    { hasInteracted: boolean; hasBlurred: boolean }
  >();
  const supportsNative =
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('selector(:user-invalid)');

  const syncAria = (el: Element | null) => {
    if (!el || !('checkValidity' in el)) return;
    const input = el as HTMLInputElement;
    if (supportsNative) {
      try {
        input.setAttribute(
          'aria-invalid',
          input.matches(':user-invalid') ? 'true' : 'false'
        );
      } catch {
        // Ignore if selector unsupported
      }
    } else {
      const isValid = input.checkValidity();
      input.classList.toggle('user-invalid-fallback', !isValid);
      input.classList.toggle('user-valid-fallback', isValid);
      if (!isValid) {
        input.setAttribute('aria-invalid', 'true');
      } else {
        input.removeAttribute('aria-invalid');
      }
    }
  };

  const handleEvent = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (event.type === 'reset' && 'elements' in target) {
      const controls = Array.from((target as HTMLFormElement).elements);
      for (const control of controls) {
        dirtyState.delete(control);
        control.classList.remove('user-invalid-fallback', 'user-valid-fallback');
        control.removeAttribute('aria-invalid');
      }
      return;
    }

    if (!('checkValidity' in target)) return;

    if (event.type === 'input' || event.type === 'change') {
      const state = dirtyState.get(target) || {
        hasInteracted: false,
        hasBlurred: false,
      };
      state.hasInteracted = true;
      dirtyState.set(target, state);
      if (state.hasBlurred || target.hasAttribute('aria-invalid')) {
        syncAria(target);
      }
    } else if (event.type === 'blur') {
      const state = dirtyState.get(target) || {
        hasInteracted: false,
        hasBlurred: false,
      };
      state.hasBlurred = true;
      dirtyState.set(target, state);
      if (state.hasInteracted) {
        syncAria(target);
      }
    }
  };

  root.addEventListener('blur', handleEvent, true);
  root.addEventListener('input', handleEvent);
  root.addEventListener('change', handleEvent);
  root.addEventListener('reset', handleEvent, true);

  return () => {
    root.removeEventListener('blur', handleEvent, true);
    root.removeEventListener('input', handleEvent);
    root.removeEventListener('change', handleEvent);
    root.removeEventListener('reset', handleEvent, true);
  };
}

/**
 * Attaches light-dismiss fallback to a <dialog closedby="any"> element
 * for browsers without native `HTMLDialogElement.prototype.closedBy` support
 * (per modern-web-guidance `dialog` & `light-dismiss-a-dialog`).
 */
export function attachDialogLightDismissFallback(
  dialog: HTMLDialogElement | null
): () => void {
  if (!dialog) return () => {};

  const handleClose = () => {
    dialog.returnValue = '';
  };
  dialog.addEventListener('close', handleClose);

  if (
    typeof HTMLDialogElement !== 'undefined' &&
    'closedBy' in HTMLDialogElement.prototype
  ) {
    return () => {
      dialog.removeEventListener('close', handleClose);
    };
  }

  let pressedOutside = false;
  const isOutside = (e: PointerEvent) => {
    const r = dialog.getBoundingClientRect();
    return (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    );
  };

  const onPointerDown = (e: PointerEvent) => {
    pressedOutside = isOutside(e);
  };
  const onPointerUp = (e: PointerEvent) => {
    if (pressedOutside && isOutside(e)) {
      dialog.close();
    }
  };

  dialog.addEventListener('pointerdown', onPointerDown);
  dialog.addEventListener('pointerup', onPointerUp);

  return () => {
    dialog.removeEventListener('close', handleClose);
    dialog.removeEventListener('pointerdown', onPointerDown);
    dialog.removeEventListener('pointerup', onPointerUp);
  };
}

/**
 * Creates an IME-safe Enter-to-submit handler for a <textarea>
 * (per modern-web-guidance `ime-safe-enter-submit`).
 */
export function createImeSafeEnterHandlers(formRef: React.RefObject<HTMLFormElement | null>) {
  let lastCompositionEndAt: number | null = null;

  const onCompositionEnd = (event: React.CompositionEvent<HTMLTextAreaElement>) => {
    lastCompositionEndAt = event.nativeEvent.timeStamp;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();

      const native = event.nativeEvent;
      if (native.isComposing || (native as any).keyCode === 229) {
        return;
      }

      if (
        lastCompositionEndAt !== null &&
        Math.abs(native.timeStamp - lastCompositionEndAt) < 50
      ) {
        return;
      }

      formRef.current?.requestSubmit();
    }
  };

  return { onCompositionEnd, onKeyDown };
}
