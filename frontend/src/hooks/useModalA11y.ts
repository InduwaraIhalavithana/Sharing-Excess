import { useEffect, useRef } from 'react';

/**
 * Makes a dialog box usable with a screen reader without rewriting its markup: marks it as a modal dialog (named by its
 * first heading) and ties every <label> in a .form-group to that group's input, so the label is announced and clicking
 * it focuses the field. Attach the returned ref to the .modal-box element.
 */
let counter = 0;
export function useModalA11y<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    const heading = box.querySelector('h2');
    if (heading) {
      heading.id = heading.id || `dlg-title-${++counter}`;
      box.setAttribute('aria-labelledby', heading.id);
    }
  });
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    box.querySelectorAll('.form-group').forEach((group) => {
      const label = group.querySelector('label');
      const control = group.querySelector('input:not([type=radio]):not([type=hidden]), select, textarea');
      if (!label || !control || label.hasAttribute('for')) return;
      control.id = control.id || `fld-${++counter}`;
      label.setAttribute('for', control.id);
    });
  });
  return ref;
}
