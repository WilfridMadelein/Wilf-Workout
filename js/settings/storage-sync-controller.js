import { subscribeStorageChanges } from '../storage/storage-change-events.js';
import { SYNC_METADATA_ID, clearSyncBaseline } from '../storage/sync-metadata.js';
import { SYNC_CONFIG_ID, loadSyncConfig, setSyncTarget, clearSyncTarget, setSyncMode, markSyncInitialized } from '../storage/sync-config.js';
import {
    isSyncFileAccessAvailable,
    createSyncFileTarget,
    openSyncFileTarget,
    hasSyncFileAccess,
    requestSyncFileAccess,
    releaseSyncFile,
    readSyncFile
} from '../storage/sync-file-access.js';
import { parseStorageSnapshot } from '../storage/storage-snapshot.js';
import { inspectStorageSync } from '../storage/storage-sync-inspection.js';
import { pushStorageNow, pullStorageNow } from '../storage/storage-sync-merge.js';
import { syncStorageTargetNow } from '../storage/storage-target-sync.js';

// ============================================================
// INTERFACE DE SYNCHRONISATION V3 — FICHIER CANONIQUE
// ============================================================

let elements = {};
let onDataImported = async () => {};
let refreshTimer = null;
let busy = false;
let unsubscribeStorageChanges = null;

function configureStorageSyncController(dependencies) {
    ({ onDataImported = async () => {}, ...elements } = dependencies);
}

function setStatus(message, state = '') {
    elements.status.textContent = message;
    if (state) elements.status.dataset.state = state;
    else delete elements.status.dataset.state;
}

function setDetail(message = '') {
    elements.detail.textContent = message;
    elements.detail.hidden = !message;
}

function setBusy(value) {
    busy = value;
    [elements.createFileButton, elements.openFileButton, elements.authorizeButton, elements.disconnectButton, elements.modeAutoButton, elements.modeManualButton, elements.pushButton, elements.pullButton, elements.pairingPushButton, elements.pairingPullButton].forEach(button => {
        if (button) button.disabled = value;
    });
}

function formatConflict(result) {
    const conflicts = result?.conflicts ?? [];
    if (!conflicts.length) return '';
    const names = conflicts.slice(0, 3).map(item => `« ${item.label} »`);
    const suffix = conflicts.length > 3 ? ` et ${conflicts.length - 3} autre${conflicts.length - 3 > 1 ? 's' : ''}` : '';
    return `${names.join(', ')}${suffix}. « Envoyer » privilégie cet appareil uniquement pour ces conflits; « Récupérer » privilégie le fichier partagé.`;
}

function isSuccessfulManualResult(result) {
    return result && !result.conflicts?.length && ['created', 'paired', 'merged', 'same', 'baseline-initialized'].includes(result.status);
}

async function validateExistingTarget(target) {
    const { content } = await readSyncFile(target);
    if (!content.trim()) return false;
    parseStorageSnapshot(content);
    return true;
}

function isSameTarget(a, b) {
    if (!a || !b || a.kind !== b.kind) return false;
    if (a.kind === 'android-file') return a.fileUri === b.fileUri;
    return false;
}

async function replaceTarget(target, { initializeFromLocal = false } = {}) {
    const previous = (await loadSyncConfig()).target;
    await setSyncTarget(target);
    await clearSyncBaseline();

    if (initializeFromLocal) {
        const result = await pushStorageNow();
        if (!isSuccessfulManualResult(result)) throw new Error('Impossible d’initialiser le nouveau fichier de synchronisation.');
        await markSyncInitialized(true);
    }

    if (previous && !isSameTarget(previous, target)) {
        try { await releaseSyncFile(previous); } catch (error) { console.warn('Impossible de libérer l’ancien fichier de synchronisation :', error); }
    }
}

async function runDirection(direction, { pairing = false } = {}) {
    if (busy) return;
    setBusy(true);
    setDetail('');
    setStatus(direction === 'push' ? 'Envoi vers le fichier...' : 'Récupération depuis le fichier...', 'syncing');

    try {
        const result = direction === 'push' ? await pushStorageNow() : await pullStorageNow();
        if (isSuccessfulManualResult(result)) await markSyncInitialized(true);
        if ((result?.imported ?? 0) > 0) await onDataImported(result);

        if (result?.status === 'missing-file') {
            setStatus('Le fichier partagé est vide.', 'warning');
            setDetail('Utilisez « Envoyer vers le fichier » pour y placer les données de cet appareil.');
        } else if (result?.conflicts?.length) {
            setStatus('Certaines données n’ont pas pu être synchronisées.', 'warning');
            setDetail('Envoyer ou Récupérer permet de choisir la version à privilégier uniquement pour les éléments réellement en conflit.');
        } else if (pairing && isSuccessfulManualResult(result)) {
            setStatus('Fichier connecté et synchronisé.', 'ok');
        }
    } catch (error) {
        console.error('Synchronisation manuelle impossible :', error);
        setStatus('Impossible de synchroniser.', 'error');
        setDetail(error?.message || 'Une erreur est survenue pendant la synchronisation.');
    } finally {
        setBusy(false);
        await refreshStorageSyncInterface();
    }
}

async function refreshStorageSyncInterface() {
    if (busy) return;

    try {
        const config = await loadSyncConfig();
        const supported = isSyncFileAccessAvailable();
        const connected = Boolean(config.target);
        const access = connected ? await hasSyncFileAccess(config.target, false) : false;
        const canReauthorize = config.target?.kind === 'web-file';

        elements.controls.hidden = !connected;
        elements.disconnectButton.hidden = !connected;
        elements.authorizeButton.hidden = !connected || access || !canReauthorize;
        elements.createFileButton.disabled = !supported;
        elements.openFileButton.disabled = !supported;
        elements.fileStatus.textContent = connected
            ? `${access ? 'Fichier connecté' : 'Fichier mémorisé, autorisation requise'} : ${config.target.name}.`
            : supported
                ? 'Aucun fichier de synchronisation connecté.'
                : 'La sélection directe d’un fichier n’est pas disponible dans ce navigateur. La sauvegarde manuelle reste disponible.';

        elements.modeAutoButton.classList.toggle('active', config.mode === 'automatic');
        elements.modeManualButton.classList.toggle('active', config.mode === 'manual');
        elements.modeAutoButton.setAttribute('aria-pressed', String(config.mode === 'automatic'));
        elements.modeManualButton.setAttribute('aria-pressed', String(config.mode === 'manual'));
        elements.modeHelp.textContent = config.mode === 'automatic'
            ? 'Wilf synchronise après vos modifications et lorsque vous revenez dans l’application.'
            : 'Wilf garde les modifications localement jusqu’à ce que vous utilisiez Envoyer ou Récupérer.';

        if (!connected) {
            elements.pairingPanel.hidden = true;
            elements.actions.hidden = true;
            setStatus('Aucune synchronisation externe configurée.');
            setDetail('Créez un fichier partagé sur le premier appareil, puis utilisez exactement ce même fichier sur les autres appareils.');
            return;
        }

        if (!access) {
            elements.pairingPanel.hidden = true;
            elements.actions.hidden = true;
            setStatus('Autorisation requise pour accéder au fichier.', 'warning');
            setDetail(canReauthorize ? 'Cliquez sur « Autoriser l’accès ».' : 'Sélectionnez de nouveau ce fichier avec « Utiliser un fichier existant ».');
            return;
        }

        const inspection = await inspectStorageSync();
        const syncStatus = inspection.sync?.status;
        const pairing = !config.initialized;
        elements.pairingPanel.hidden = !pairing;
        elements.actions.hidden = pairing;
        elements.pairingPullButton.disabled = syncStatus === 'pairing-empty';

        if (pairing) {
            if (syncStatus === 'pairing-empty') {
                elements.pairingMessage.textContent = 'Ce fichier est vide. Envoyez les données de cet appareil pour commencer.';
                setStatus('Initialisation du fichier requise.', 'warning');
            } else {
                elements.pairingMessage.textContent = 'Ce fichier contient déjà des données Wilf. « Récupérer et fusionner » est recommandé pour ajouter cet appareil; les éléments uniques des deux côtés seront conservés.';
                setStatus('Première synchronisation sur cet appareil.', 'warning');
            }
            setDetail('');
            return;
        }

        switch (syncStatus) {
            case 'same':
                setStatus('Synchronisé.', 'ok');
                setDetail('');
                break;
            case 'local-changed':
                setStatus(config.mode === 'automatic' ? 'Synchronisation...' : 'Modifications locales à envoyer.', config.mode === 'automatic' ? 'syncing' : 'warning');
                setDetail(config.mode === 'manual' ? 'Utilisez « Envoyer vers le fichier » lorsque vous voulez publier ces modifications.' : '');
                break;
            case 'external-changed':
                setStatus(config.mode === 'automatic' ? 'Synchronisation...' : 'Modifications disponibles à récupérer.', config.mode === 'automatic' ? 'syncing' : 'warning');
                setDetail(config.mode === 'manual' ? 'Utilisez « Récupérer depuis le fichier » pour les appliquer sur cet appareil.' : '');
                break;
            case 'mergeable':
                setStatus(config.mode === 'automatic' ? 'Synchronisation...' : 'Modifications présentes des deux côtés.', config.mode === 'automatic' ? 'syncing' : 'warning');
                setDetail(config.mode === 'manual' ? 'Envoyer ou Récupérer fusionnera les éléments compatibles; le bouton choisi décide seulement si le même élément a été modifié des deux côtés.' : '');
                break;
            case 'conflict':
                setStatus(`${inspection.conflicts.length} élément${inspection.conflicts.length > 1 ? 's' : ''} modifié${inspection.conflicts.length > 1 ? 's' : ''} des deux côtés.`, 'warning');
                setDetail(formatConflict(inspection));
                break;
            case 'missing-file':
                setStatus('Le fichier de synchronisation est vide.', 'warning');
                setDetail('Utilisez « Envoyer vers le fichier » pour l’initialiser.');
                break;
            case 'baseline-missing-equal':
                setStatus('Synchronisé.', 'ok');
                setDetail('La base de synchronisation sera recréée au prochain envoi ou à la prochaine récupération.');
                break;
            case 'baseline-missing-different':
                setStatus('Choix requis pour reprendre la synchronisation.', 'warning');
                setDetail('Envoyer privilégie cet appareil; Récupérer privilégie le fichier lorsque le même élément diffère.');
                break;
            default:
                setStatus('Synchronisation prête.');
                setDetail('');
        }
    } catch (error) {
        console.error('Impossible de vérifier la synchronisation :', error);
        setStatus('Impossible de vérifier la synchronisation.', 'error');
        setDetail(error?.message || 'Vérifiez l’accès au fichier puis réessayez.');
    }
}

function scheduleStorageSyncInterfaceRefresh(delay = 3500) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
        refreshTimer = null;
        refreshStorageSyncInterface();
    }, delay);
}

async function setupStorageSyncController() {
    elements.createFileButton.addEventListener('click', async () => {
        if (busy || !isSyncFileAccessAvailable()) return;
        setBusy(true);
        try {
            const selected = await createSyncFileTarget();
            if (!selected) return;
            await replaceTarget(selected, { initializeFromLocal: true });
            setStatus('Nouveau fichier créé et synchronisé.', 'ok');
        } catch (error) {
            console.error('Impossible de créer le fichier de synchronisation :', error);
            setStatus('Impossible de créer le fichier.', 'error');
            setDetail(error?.message || 'Choisissez un autre emplacement.');
        } finally {
            setBusy(false);
            await refreshStorageSyncInterface();
        }
    });

    elements.openFileButton.addEventListener('click', async () => {
        if (busy || !isSyncFileAccessAvailable()) return;
        setBusy(true);
        try {
            const selected = await openSyncFileTarget();
            if (!selected) return;
            await validateExistingTarget(selected);
            await replaceTarget(selected);
            setStatus('Fichier connecté.', 'ok');
        } catch (error) {
            console.error('Impossible d’utiliser le fichier de synchronisation :', error);
            setStatus('Impossible d’utiliser ce fichier.', 'error');
            setDetail(error?.message || 'Sélectionnez un fichier de synchronisation Wilf valide.');
        } finally {
            setBusy(false);
            await refreshStorageSyncInterface();
        }
    });

    elements.authorizeButton.addEventListener('click', async () => {
        if (busy) return;
        setBusy(true);
        try {
            const config = await loadSyncConfig();
            if (config.target && !await requestSyncFileAccess(config.target)) throw new Error('Autorisation refusée.');
        } catch (error) {
            setStatus('Autorisation non accordée.', 'warning');
            setDetail(error?.message || 'Sélectionnez de nouveau le fichier si nécessaire.');
        } finally {
            setBusy(false);
            await refreshStorageSyncInterface();
        }
    });

    elements.disconnectButton.addEventListener('click', () => { elements.disconnectModal.hidden = false; });
    elements.disconnectCancelButton.addEventListener('click', () => { elements.disconnectModal.hidden = true; });
    elements.disconnectConfirmButton.addEventListener('click', async () => {
        if (busy) return;
        setBusy(true);
        try {
            const config = await loadSyncConfig();
            if (config.target) {
                try { await releaseSyncFile(config.target); } catch (error) { console.warn('Impossible de libérer le fichier :', error); }
            }
            await clearSyncTarget();
            await clearSyncBaseline();
            elements.disconnectModal.hidden = true;
        } finally {
            setBusy(false);
            await refreshStorageSyncInterface();
        }
    });
    elements.disconnectModal.addEventListener('click', event => {
        if (event.target === elements.disconnectModal) elements.disconnectModal.hidden = true;
    });

    elements.modeAutoButton.addEventListener('click', async () => {
        await setSyncMode('automatic');
        const config = await loadSyncConfig();
        if (config.target && config.initialized) await syncStorageTargetNow({ force: true });
        await refreshStorageSyncInterface();
    });
    elements.modeManualButton.addEventListener('click', async () => {
        await setSyncMode('manual');
        await refreshStorageSyncInterface();
    });

    elements.pushButton.addEventListener('click', () => runDirection('push'));
    elements.pullButton.addEventListener('click', () => runDirection('pull'));
    elements.pairingPushButton.addEventListener('click', () => runDirection('push', { pairing: true }));
    elements.pairingPullButton.addEventListener('click', () => runDirection('pull', { pairing: true }));

    if (!unsubscribeStorageChanges) {
        unsubscribeStorageChanges = subscribeStorageChanges(async change => {
            if (change?.store === 'settings' && [SYNC_METADATA_ID, SYNC_CONFIG_ID].includes(change?.id)) return;
            const config = await loadSyncConfig();
            if (config.target && config.initialized && config.mode === 'automatic') setStatus('Synchronisation...', 'syncing');
            scheduleStorageSyncInterfaceRefresh(config.mode === 'automatic' ? 3500 : 300);
        });
    }

    await refreshStorageSyncInterface();
}

export { configureStorageSyncController, setupStorageSyncController, refreshStorageSyncInterface };
