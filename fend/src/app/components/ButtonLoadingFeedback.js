"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const ACTION_SELECTOR = 'button, [role="button"], a.MuiButtonBase-root';
const LOADING_ATTRIBUTE = "data-button-action-loading";
const FALLBACK_RELEASE_MS = 2200;

function findActionTarget(target) {
  if (!(target instanceof Element)) return null;

  const action = target.closest(ACTION_SELECTOR);
  if (!action || action.closest('[data-button-loading-ignore="true"]')) return null;
  if (action.hasAttribute("disabled")) return null;
  if (action.getAttribute("aria-disabled") === "true" && action.dataset.buttonActionLoading !== "true") return null;
  if (action.dataset.buttonLoadingManaged === "true") return null;
  return action;
}

export default function ButtonLoadingFeedback() {
  const pathname = usePathname();
  const activeActions = useRef(new Set());
  const disableTimers = useRef(new Map());
  const releaseTimers = useRef(new Map());
  const originalAttributes = useRef(new WeakMap());

  useEffect(() => {
    const release = (action) => {
      if (!action) return;

      const timer = releaseTimers.current.get(action);
      if (timer) window.clearTimeout(timer);
      releaseTimers.current.delete(action);
      const disableTimer = disableTimers.current.get(action);
      if (disableTimer) window.clearTimeout(disableTimer);
      disableTimers.current.delete(action);
      activeActions.current.delete(action);

      const original = originalAttributes.current.get(action);
      if (original?.ariaBusy == null) action.removeAttribute("aria-busy");
      else action.setAttribute("aria-busy", original.ariaBusy);
      if (original?.ariaDisabled == null) action.removeAttribute("aria-disabled");
      else action.setAttribute("aria-disabled", original.ariaDisabled);
      action.removeAttribute(LOADING_ATTRIBUTE);
      if (action.getAttribute("data-button-feedback-disabled") === "true") {
        action.disabled = false;
        action.removeAttribute("data-button-feedback-disabled");
      }
      originalAttributes.current.delete(action);
    };

    const releaseAll = () => {
      [...activeActions.current].forEach(release);
    };

    const markLoading = (action) => {
      if (!action || activeActions.current.has(action)) return;

      originalAttributes.current.set(action, {
        ariaBusy: action.getAttribute("aria-busy"),
        ariaDisabled: action.getAttribute("aria-disabled"),
      });
      activeActions.current.add(action);
      action.setAttribute(LOADING_ATTRIBUTE, "true");
      action.setAttribute("aria-busy", "true");
      action.setAttribute("aria-disabled", "true");
      if (action instanceof HTMLButtonElement) {
        // Let React's current click handler finish before setting disabled.
        const disableTimer = window.setTimeout(() => {
          if (activeActions.current.has(action) && action.isConnected) {
            action.disabled = true;
            action.setAttribute("data-button-feedback-disabled", "true");
          }
        }, 0);
        disableTimers.current.set(action, disableTimer);
      }

      const timer = window.setTimeout(() => release(action), FALLBACK_RELEASE_MS);
      releaseTimers.current.set(action, timer);
    };

    const handleClick = (event) => {
      const action = findActionTarget(event.target);
      if (!action) return;
      // Form submits are marked by handleSubmit after the click has completed.
      if (action instanceof HTMLButtonElement && action.type === "submit") return;

      if (activeActions.current.has(action)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Mark synchronously so a rapid second click is blocked, while allowing
      // the current React handler to finish normally.
      markLoading(action);
    };

    const handleSubmit = (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      const submitter = event.submitter || form.querySelector('button[type="submit"], input[type="submit"]');
      const action = findActionTarget(submitter);
      if (action && activeActions.current.has(action)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (action) markLoading(action);
    };

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
      releaseAll();
    };
  }, []);

  useEffect(() => {
    [...activeActions.current].forEach((action) => {
      const timer = releaseTimers.current.get(action);
      if (timer) window.clearTimeout(timer);
      releaseTimers.current.delete(action);
      const disableTimer = disableTimers.current.get(action);
      if (disableTimer) window.clearTimeout(disableTimer);
      disableTimers.current.delete(action);
      activeActions.current.delete(action);
      action.removeAttribute(LOADING_ATTRIBUTE);
      action.removeAttribute("aria-busy");
      action.removeAttribute("aria-disabled");
      if (action.getAttribute("data-button-feedback-disabled") === "true") {
        action.disabled = false;
        action.removeAttribute("data-button-feedback-disabled");
      }
      originalAttributes.current.delete(action);
    });
  }, [pathname]);

  return null;
}
