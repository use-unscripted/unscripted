// Inspired by react-hot-toast library
import { useState, useEffect } from "react";

// Three is what fits on a 393px phone without burying the page. The upstream
// default was 20, which on a phone is a wall of cards over the whole screen.
const TOAST_LIMIT = 3;

// How long a toast sits on screen before it takes itself away.
const TOAST_DURATION = 5000;

// An error is something a student actually has to read, so it stays longer.
const TOAST_DURATION_DESTRUCTIVE = 8000;

// Gap between "closed" and unmounting, so the slide-out animation gets to run.
// Upstream ships 1000000 here, which is 16 minutes and is why toasts never left.
const TOAST_REMOVE_DELAY = 300;

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
};

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_VALUE;
  return count.toString();
}

const toastTimeouts = new Map();
const dismissTimeouts = new Map();

const addToRemoveQueue = (toastId) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: actionTypes.REMOVE_TOAST,
      toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

const clearFromRemoveQueue = (toastId) => {
  const timeout = toastTimeouts.get(toastId);
  if (timeout) {
    clearTimeout(timeout);
    toastTimeouts.delete(toastId);
  }
};

// The countdown that closes a toast on its own, so nobody has to find the X.
const addToDismissQueue = (toastId, duration) => {
  if (dismissTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    dismissTimeouts.delete(toastId);
    dispatch({
      type: actionTypes.DISMISS_TOAST,
      toastId,
    });
  }, duration);

  dismissTimeouts.set(toastId, timeout);
};

const clearFromDismissQueue = (toastId) => {
  const timeout = dismissTimeouts.get(toastId);
  if (timeout) {
    clearTimeout(timeout);
    dismissTimeouts.delete(toastId);
  }
};

const forgetToast = (toastId) => {
  clearFromDismissQueue(toastId);
  clearFromRemoveQueue(toastId);
};

export const reducer = (state, action) => {
  switch (action.type) {
    case actionTypes.ADD_TOAST: {
      const next = [action.toast, ...state.toasts];
      // Anything pushed off the end is gone from the screen, so drop its
      // pending timers too rather than leaving them to fire at nothing.
      next.slice(TOAST_LIMIT).forEach((t) => forgetToast(t.id));
      return {
        ...state,
        toasts: next.slice(0, TOAST_LIMIT),
      };
    }

    case actionTypes.UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };

    case actionTypes.DISMISS_TOAST: {
      const { toastId } = action;

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        clearFromDismissQueue(toastId);
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          clearFromDismissQueue(toast.id);
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      };
    }
    case actionTypes.REMOVE_TOAST:
      if (action.toastId === undefined) {
        state.toasts.forEach((t) => forgetToast(t.id));
        return {
          ...state,
          toasts: [],
        };
      }
      forgetToast(action.toastId);
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners = [];

let memoryState = { toasts: [] };

function dispatch(action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

function toast({ ...props }) {
  const id = genId();

  const update = (props) =>
    dispatch({
      type: actionTypes.UPDATE_TOAST,
      toast: { ...props, id },
    });

  const dismiss = () =>
    dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id });

  dispatch({
    type: actionTypes.ADD_TOAST,
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  addToDismissQueue(
    id,
    props.variant === "destructive"
      ? TOAST_DURATION_DESTRUCTIVE
      : TOAST_DURATION
  );

  return {
    id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = useState(memoryState);

  useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId) => dispatch({ type: actionTypes.DISMISS_TOAST, toastId }),
  };
}

export { useToast, toast }; 