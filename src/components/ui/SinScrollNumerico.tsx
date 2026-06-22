'use client';

import { useEffect } from 'react';

// Evita que la rueda del mouse / trackpad modifique el valor de un campo
// numérico enfocado (comportamiento por defecto molesto de
// <input type="number">, que sumaba/restaba céntimos al hacer scroll). Al
// detectar el scroll sobre un campo numérico enfocado, lo desenfoca: el valor
// no cambia y la página sigue desplazándose con normalidad.
export function SinScrollNumerico() {
  useEffect(() => {
    const alScroll = () => {
      const el = document.activeElement as HTMLInputElement | null;
      if (el && el.tagName === 'INPUT' && el.type === 'number') el.blur();
    };
    document.addEventListener('wheel', alScroll, { passive: true });
    return () => document.removeEventListener('wheel', alScroll);
  }, []);
  return null;
}
