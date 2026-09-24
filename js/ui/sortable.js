// Moteur sans dépendance métier. L'adaptateur fournit les destinations,
// l'aperçu DOM réversible et la validation finale (aucune sauvegarde ici).
// Cible : { key stable, element, after, label, ...données de l'adaptateur }.
// onPreview déplace les nœuds existants; onFinish restaure ou valide l'aperçu.
// Appeler destroy avant de remplacer le DOM ou de désactiver le composant.
export function createSortable(root, {
    getSource, getTargets, getElements, onStart, onPreview, onFinish,
    createPreview, getDropElement, announce = () => {},
    hoverDelay = 140, animationDuration = 360
}) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Map();
    const listeners = new AbortController();
    let session = null;
    let frame = 0;
    let settling = false;

    function measure() {
        return new Map(getElements().map(element => [element, element.getBoundingClientRect()]));
    }

    function animateLayout(before) {
        const elements = getElements();
        animations.forEach(animation => animation.cancel());
        animations.clear();
        if (reducedMotion.matches) return;
        elements.forEach(element => {
            const previous = before.get(element);
            if (!previous) return;
            const next = element.getBoundingClientRect();
            if (!next.width || !next.height || !previous.width || !previous.height) return;
            const x = previous.left - next.left;
            const y = previous.top - next.top;
            if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5 && Math.abs(previous.height - next.height) < 1) return;
            const animation = element.animate([
                { transform: `translate(${x}px, ${y}px) scale(${previous.width / next.width}, ${previous.height / next.height})`, transformOrigin: "top left" },
                { transform: "none", transformOrigin: "top left" }
            ], { duration: animationDuration, easing: "cubic-bezier(.2,.8,.2,1)", composite: "replace" });
            animations.set(element, animation);
            animation.finished.then(() => {
                if (animations.get(element) === animation) animations.delete(element);
            }, () => {});
        });
    }

    function scrollContainer() {
        let element = root.parentElement;
        while (element && !(element.scrollHeight > element.clientHeight && /auto|scroll/.test(getComputedStyle(element).overflowY))) element = element.parentElement;
        return element ?? document.scrollingElement;
    }

    function changeLayout(change, anchor = null) {
        const before = measure();
        const anchorTop = anchor?.()?.getBoundingClientRect().top;
        const scroller = anchor ? scrollContainer() : null;
        change();
        const after = anchor?.();
        if (after?.isConnected && Number.isFinite(anchorTop)) scroller.scrollTop += after.getBoundingClientRect().top - anchorTop;
        animateLayout(before);
    }

    function positionPreview() {
        if (!session?.preview || session.keyboard) return;
        session.preview.style.transform = `translate3d(${session.x - session.offsetX}px, ${session.y - session.offsetY}px, 0)`;
    }

    function start() {
        if (!session || session.started) return;
        session.started = true;
        session.lastPreviewX = session.startX;
        session.lastPreviewY = session.startY;
        changeLayout(() => onStart(session.source), () => getDropElement(session.source));
        session.lockUntil = performance.now() + animationDuration;
        const element = getDropElement(session.source);
        const rect = element.getBoundingClientRect();
        session.preview = createPreview(session.source);
        session.preview.setAttribute("aria-hidden", "true");
        session.preview.inert = true;
        Object.assign(session.preview.style, {
            position: "fixed", left: "0", top: "0", margin: "0", pointerEvents: "none",
            zIndex: "10000", width: `${Math.min(rect.width, window.innerWidth - 24)}px`,
            maxHeight: "75vh", overflow: "hidden", transformOrigin: "top left"
        });
        document.body.appendChild(session.preview);
        session.offsetX = Math.min(24, rect.width / 2);
        session.offsetY = 24;
        if (session.keyboard) {
            session.preview.hidden = true;
        } else positionPreview();
        announce("Élément saisi. Flèches pour choisir une destination, Entrée pour déposer, Échap pour annuler.");
    }

    function previewTarget(target) {
        if (!session || !target || target.key === session.target?.key) return;
        changeLayout(() => onPreview(session.source, target));
        session.target = target;
        session.candidate = null;
        session.lockUntil = performance.now() + animationDuration;
        session.lastPreviewX = session.x;
        session.lastPreviewY = session.y;
        announce(`${target.label}. Entrée pour déposer, Échap pour annuler.`);
    }

    function locate(now) {
        const bounds = root.getBoundingClientRect();
        session.valid = session.x >= bounds.left - 35 && session.x <= bounds.right + 35 &&
            session.y >= bounds.top - 45 && session.y <= bounds.bottom + 45;
        if (!session.valid) { session.candidate = null; return; }
        if (now < session.lockUntil) return;
        // Ne pas osciller quand le réagencement déplace une cible sous un pointeur immobile.
        if (Math.hypot(session.x - session.lastPreviewX, session.y - session.lastPreviewY) < 12) {
            session.candidate = null;
            return;
        }
        const source = getDropElement(session.source);
        const sourceRect = source.getBoundingClientRect();
        let best = null;
        let distance = Infinity;
        const targets = getTargets(session.source);
        targets.forEach(target => {
            const rect = target.element.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            // Il faut entrer dans la cible, pas simplement passer près de son bord.
            const inset = Math.min(6, rect.width * 0.04);
            if (session.x < rect.left + inset || session.x > rect.right - inset ||
                session.y < rect.top || session.y > rect.bottom) return;
            let score;
            if (target.edgeOnly) {
                // Les sorties de Set restent réservées à l'en-tête et au bas du cadre.
                const overChild = targets.some(child => {
                    if (child.edgeOnly || child.element === target.element || !target.element.contains(child.element)) return false;
                    const childRect = child.element.getBoundingClientRect();
                    return session.x >= childRect.left && session.x <= childRect.right &&
                        session.y >= childRect.top && session.y <= childRect.bottom;
                });
                if (overChild) return;
                const edgeDistance = Math.abs(session.y - (target.after ? rect.bottom : rect.top));
                if (edgeDistance > 20) return;
                score = edgeDistance;
            } else {
                const sameContainer = source.parentElement === target.element.parentElement;
                const horizontal = sameContainer && Math.min(sourceRect.bottom, rect.bottom) - Math.max(sourceRect.top, rect.top) > Math.min(sourceRect.height, rect.height) / 2;
                const position = horizontal ? session.x : session.y;
                const center = horizontal ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
                const sourceCenter = horizontal ? sourceRect.left + sourceRect.width / 2 : sourceRect.top + sourceRect.height / 2;
                const margin = Math.min(16, (horizontal ? rect.width : rect.height) * 0.06);
                // Dépasser le centre avec une marge donne l'impression de pousser la carte.
                if (sameContainer && target.after !== (sourceCenter < center)) return;
                if (target.after ? position < center + margin : position > center - margin) return;
                score = Math.abs(position - center);
            }
            if (score < distance) { best = target; distance = score; }
        });
        if (!best || best.key === session.target?.key) { session.candidate = null; return; }
        if (best.key !== session.candidate?.key) {
            session.candidate = best;
            session.candidateSince = now;
        } else if (now - session.candidateSince >= hoverDelay) previewTarget(best);
    }

    function autoScroll(elapsed) {
        const scroller = scrollContainer();
        const element = scroller === document.scrollingElement ? null : scroller;
        const rect = element?.getBoundingClientRect();
        const top = Math.max(0, rect?.top ?? 0);
        const bottom = Math.min(window.innerHeight, rect?.bottom ?? window.innerHeight);
        if (session.x < (rect?.left ?? 0) || session.x > (rect?.right ?? window.innerWidth)) return;
        const edge = Math.min(60, (bottom - top) / 3);
        const speed = session.y < top + edge ? -Math.min(1, (top + edge - session.y) / edge)
            : session.y > bottom - edge ? Math.min(1, (session.y - bottom + edge) / edge) : 0;
        if (!speed) return;
        const previous = scroller.scrollTop;
        scroller.scrollTop += speed * elapsed * 0.65;
        if (scroller.scrollTop !== previous) session.lastPreviewY = NaN;
    }

    function tick(now) {
        if (!session || settling) return;
        if (!root.isConnected || !root.getClientRects().length) { finish(false); return; }
        if (!session.started && now - session.downAt >= 120) start();
        if (session.started && !session.keyboard) {
            if (session.hasMoved) autoScroll(Math.min(32, now - session.lastFrame));
            positionPreview();
            locate(now);
        }
        session.lastFrame = now;
        frame = requestAnimationFrame(tick);
    }

    function begin(handle, source, event, keyboard = false) {
        if (settling || session) return;
        const now = performance.now();
        session = { handle, source, keyboard, pointerId: event.pointerId, started: false,
            x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY,
            downAt: now, lastFrame: now, lockUntil: 0, valid: true, target: null };
        handle.focus({ preventScroll: true });
        handle.setAttribute("aria-pressed", "true");
        if (!keyboard) root.setPointerCapture(event.pointerId);
        if (keyboard) start();
        frame = requestAnimationFrame(tick);
    }

    async function finish(commit, immediately = false) {
        if (!session) return;
        if (settling && !immediately) {
            if (!commit) session.cancelled = true;
            return;
        }
        settling = true;
        cancelAnimationFrame(frame);
        const current = session;
        const accepted = commit && current.started && current.valid;
        // Le dépôt rejoint exclusivement la place déjà prévisualisée, jamais une cible en attente.
        if (current.preview && !current.keyboard && accepted && !reducedMotion.matches) {
            const rect = getDropElement(current.source).getBoundingClientRect();
            const from = current.preview.getBoundingClientRect();
            await current.preview.animate([
                { transform: current.preview.style.transform },
                { transform: `translate(${rect.left}px, ${rect.top}px) scale(${rect.width / from.width}, ${rect.height / from.height})` }
            ], { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" }).finished.catch(() => {});
        }
        if (session !== current) return;
        session = null;
        if (current.pointerId !== undefined && root.hasPointerCapture(current.pointerId)) root.releasePointerCapture(current.pointerId);
        current.preview?.getAnimations().forEach(animation => animation.cancel());
        current.preview?.remove();
        current.handle.setAttribute("aria-pressed", "false");
        const committed = accepted && !current.cancelled;
        if (current.started) changeLayout(
            () => onFinish(current.source, committed ? current.target : null, committed),
            () => getDropElement(current.source)
        );
        current.handle.focus({ preventScroll: true });
        announce(committed ? "Déplacement terminé." : "Déplacement annulé.");
        settling = false;
    }

    function keydown(event) {
        if (!session) {
            const source = getSource(event.target);
            if (source && ["Enter", " "].includes(event.key)) {
                event.preventDefault();
                begin(event.target, source, event, true);
            }
            return;
        }
        if (event.key === "Escape") { event.preventDefault(); finish(false); return; }
        if (!session.keyboard || settling) return;
        if (["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            const targets = getTargets(session.source);
            let index = targets.findIndex(target => target.key === session.target?.key);
            index += ["ArrowUp", "ArrowLeft"].includes(event.key) ? -1 : 1;
            if (event.key === "Home") index = 0;
            if (event.key === "End") index = targets.length - 1;
            const target = targets[Math.max(0, Math.min(index, targets.length - 1))];
            previewTarget(target);
            getDropElement(session.source).scrollIntoView({ block: "nearest" });
        } else if (["Enter", " "].includes(event.key)) { event.preventDefault(); finish(true); }
        else if (event.key === "Tab") finish(false);
    }

    function listen(element, name, handler) { element.addEventListener(name, handler, { signal: listeners.signal }); }
    listen(root, "pointerdown", event => {
        const source = getSource(event.target);
        if (!source || event.button !== 0 || !event.isPrimary) return;
        event.preventDefault();
        begin(event.target, source, event);
    });
    listen(root, "pointermove", event => {
        if (!session || session.keyboard || settling || event.pointerId !== session.pointerId) return;
        session.x = event.clientX;
        session.y = event.clientY;
        if (Math.hypot(session.x - session.startX, session.y - session.startY) > 5) {
            session.hasMoved = true;
            start();
        }
    });
    listen(root, "pointerup", event => {
        if (!session || session.keyboard || event.pointerId !== session.pointerId) return;
        const bounds = root.getBoundingClientRect();
        session.valid = event.clientX >= bounds.left - 35 && event.clientX <= bounds.right + 35 &&
            event.clientY >= bounds.top - 45 && event.clientY <= bounds.bottom + 45;
        finish(true);
    });
    listen(root, "pointercancel", () => finish(false));
    listen(root, "lostpointercapture", () => { if (!settling) finish(false); });
    listen(document, "keydown", keydown);
    listen(window, "blur", () => finish(false));
    listen(document, "visibilitychange", () => { if (document.hidden) finish(false); });
    listen(document, "pointerdown", event => {
        if (session && !root.contains(event.target)) finish(false);
    });
    listen(root, "click", event => {
        const source = getSource(event.target);
        if (source && event.detail === 0 && !session && !event.defaultPrevented) begin(event.target, source, event, true);
    });
    return {
        destroy() {
            finish(false, true);
            listeners.abort();
            animations.forEach(animation => animation.cancel());
            animations.clear();
        }
    };
}
