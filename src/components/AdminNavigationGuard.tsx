import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

type State = { dirty: boolean; busy: boolean };
type Guard = { register: (id: symbol, state?: State) => void; leave: (action: () => void) => void };
const fallback: Guard = { register: () => {}, leave: (action) => action() };
const Context = createContext<Guard>(fallback);
export function AdminNavigationGuard({ children }: { children: ReactNode }) {
  const entries = useRef(new Map<symbol, State>());
  const guard = useMemo<Guard>(() => ({
    register: (id, state) => { if (state) entries.current.set(id, state); else entries.current.delete(id); },
    leave: (action) => {
      const states = [...entries.current.values()];
      if (states.some((state) => state.busy)) return;
      if (states.some((state) => state.dirty) && !window.confirm('未保存的修改将丢失。继续？')) return;
      action();
    },
  }), []);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if ([...entries.current.values()].some((state) => state.dirty || state.busy)) {
        event.preventDefault(); event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, []);
  return <Context.Provider value={guard}>{children}</Context.Provider>;
}
export function useAdminNavigation() { return useContext(Context).leave; }
export function useAdminEdits(dirty: boolean, busy = false) {
  const guard = useContext(Context);
  const id = useRef(Symbol());
  useEffect(() => { guard.register(id.current, { dirty, busy }); return () => guard.register(id.current); }, [guard, dirty, busy]);
}
