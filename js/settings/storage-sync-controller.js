import { subscribeStorageChanges } from '../storage/storage-change-events.js';
import { SYNC_METADATA_ID, clearSyncBaseline } from '../storage/sync-metadata.js';
import {
    SYNC_CONFIG_ID,
    loadSyncConfig,
    setSyncTarget,
    clearSyncTarget,
    setSyncMode,
    markSyncInitialized
} from '../storage/sync-config.js';
import {
    isSyncDirectoryAvailable,
    chooseSyncDirectory,
    hasSyncDirectoryAccess,
    requestSyncDirectoryAccess,
    releaseSyncDirectory
} from '../storage/sync-directory.js';
import { inspectStorageSync } from '../storage/storage-sync-inspection.js';
import { pushStorageNow, pullStorageNow } from '../storage/storage-sync-merge.js';
import { syncStorageTargetNow } from '../storage/storage-target-sync.js';

// ============================================================
// INTERFACE DE SYNCHRONISATION V2
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
    [elements.folderButton, elements.disconnectButton, elements.modeAutoButton, elements.modeManualButton, elements.pushButton, elements.pullButton, elements.pairingPushButton, elements.pairingPullButton].forEach(button => {
        if (button) button.disabled = value;
    });
}

function formatConflict(result) {
    const conflicts = result?.conflicts ?? [];
    if (!conflicts.length) return '';
    const names = conflicts.slice(0, 3).map(item => `« ${item.label} »`);
    const suffix = conflicts.length > 3 ? ` et ${conflicts.length - 3} autre${conflicts.length - 3 > 1 ? 's' : ''}` : '';
    return `${names.join(', ')}${suffix}. « Envoyer » garde la version de cet appareil pour les conflits; « Récupérer » garde celle du dossier.`;
}

function isSuccessfulManualResult(result) {
    return result && !result.conflicts?.length && ['created', 'paired', 'merged', 'same', 'baseline-initialized'].includes(result.status);
}

async function runDirection(direction, { pairing = false } = {}) {
    if (busy) return;
    setBusy(true);
    setDetail('');
    setStatus(direction === 'push' ? 'Envoi vers le dossier...' : 'Récupération depuis le dossier...', 'syncing');

    try {
        const result = direction === 'push' ? await pushStorageNow() : await pullStorageNow();
        if (isSuccessfulManualResult(result)) await markSyncInitialized(true);
        if ((result?.imported ?? 0) > 0) await onDataImported(result);

        if (result?.status === 'missing-file') {
            setStatus('Aucune donnée Wilf à récupérer dans ce dossier.', 'warning');
            setDetail('Utilisez « Envoyer vers le dossier » pour créer la première copie synchronisée.');
        } else if (result?.conflicts?.length) {
            setStatus('Certaines données n’ont pas pu être synchronisées.', 'warning');
            setDetail('Utilisez Envoyer ou Récupérer pour choisir la copie à privilégier.');
        } else if (pairing && isSuccessfulManualResult(result)) {
            setStatus('Dossier connecté et synchronisé.', 'ok');
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
        const supported = isSyncDirectoryAvailable();
        const connected = Boolean(config.target);
        const access = connected ? await hasSyncDirectoryAccess(config.target, false) : false;

        elements.controls.hidden = !connected;
        elements.disconnectButton.hidden = !connected;
        elements.folderButton.disabled = !supported && !connected;
        elements.folderButton.textContent = connected ? (access ? 'Changer de dossier' : 'Autoriser l’accès') : 'Choisir un dossier';
        elements.folderStatus.textContent = connected
            ? `${access ? 'Dossier connecté' : 'Dossier mémorisé, autorisation requise'} : ${config.target.name}.`
            : supported
                ? 'Aucun dossier de synchronisation connecté.'
                : 'La sélection persistante d’un dossier n’est pas disponible dans ce navigateur. La sauvegarde manuelle reste disponible.';

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
            setDetail('');
            return;
        }

        if (!access) {
            elements.pairingPanel.hidden = true;
            elements.actions.hidden = true;
            setStatus('Autorisation requise pour accéder au dossier.', 'warning');
            setDetail('Cliquez sur « Autoriser l’accès ». Si l’autorisation ne peut plus être accordée, déconnectez puis choisissez le dossier de nouveau.');
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
                elements.pairingMessage.textContent = 'Ce dossier ne contient pas encore de données Wilf. Envoyez les données de cet appareil pour commencer.';
                setStatus('Initialisation du dossier requise.', 'warning');
            } else {
                elements.pairingMessage.textContent = 'Ce dossier contient déjà des données Wilf. Choisissez la copie à privilégier pour la première synchronisation; les éléments uniques des deux côtés seront conservés.';
                setStatus('Première synchronisation requise.', 'warning');
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
                setDetail(config.mode === 'manual' ? 'Utilisez « Envoyer vers le dossier » lorsque vous voulez publier ces modifications.' : '');
                break;
            case 'external-changed':
                setStatus(config.mode === 'automatic' ? 'Synchronisation...' : 'Modifications disponibles à récupérer.', config.mode === 'automatic' ? 'syncing' : 'warning');
                setDetail(config.mode === 'manual' ? 'Utilisez « Récupérer depuis le dossier » pour les appliquer sur cet appareil.' : '');
                break;
            case 'mergeable':
                setStatus(config.mode === 'automatic' ? 'Synchronisation...' : 'Modifications présentes des deux côtés.', config.mode === 'automatic' ? 'syncing' : 'warning');
                setDetail(config.mode === 'manual' ? 'Envoyer ou Récupérer fusionnera les éléments compatibles; le bouton choisi décide seulement en cas de conflit sur le même élément.' : '');
                break;
            case 'conflict':
                setStatus(`${inspection.conflicts.length} élément${inspection.conflicts.length > 1 ? 's' : ''} modifié${inspection.conflicts.length > 1 ? 's' : ''} sur les deux appareils.`, 'warning');
                setDetail(formatConflict(inspection));
                break;
            case 'missing-file':
                setStatus('Le fichier de synchronisation est introuvable.', 'warning');
                setDetail('Utilisez « Envoyer vers le dossier » pour recréer le fichier, ou changez de dossier.');
                break;
            case 'baseline-missing-equal':
                setStatus('Synchronisé.', 'ok');
                setDetail('La base de synchronisation sera recréée au prochain envoi ou à la prochaine récupération.');
                break;
            case 'baseline-missing-different':
                setStatus('Choix requis pour reprendre la synchronisation.', 'warning');
                setDetail('Envoyer privilégie cet appareil; Récupérer privilégie le dossier lorsque le même élément diffère.');
                break;
            default:
                setStatus('Synchronisation prête.');
                setDetail('');
        }
    } catch (error) {
        console.error('Impossible de vérifier la synchronisation :', error);
        setStatus('Impossible de vérifier la synchronisation.', 'error');
        setDetail(error?.message || 'Vérifiez l’accès au dossier puis réessayez.');
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
    elements.folderButton.addEventListener('click', async () => {
        if (busy) return;
        const config = await loadSyncConfig();

        if (config.target && !await hasSyncDirectoryAccess(config.target, false)) {
            try {
                if (await requestSyncDirectoryAccess(config.target)) {
                    await refreshStorageSyncInterface();
                    if (config.mode === 'automatic' && config.initialized) await syncStorageTargetNow({ force: true });
                    return;
                }
            } catch (error) {
                console.warn('Impossible de restaurer l’accès au dossier :', error);
            }
        }

        if (!isSyncDirectoryAvailable()) return;
        setBusy(true);
        try {
            const selected = await chooseSyncDirectory();
            if (!selected) return;
            const previous = config.target;
            await setSyncTarget(selected);
            await clearSyncBaseline();
            if (previous) {
                try { await releaseSyncDirectory(previous); } catch (error) { console.warn('Impossible de libérer l’ancien dossier :', error); }
            }
        } catch (error) {
            console.error('Impossible de choisir le dossier de synchronisation :', error);
            setStatus('Impossible d’utiliser ce dossier.', 'error');
            setDetail(error?.message || 'Choisissez un autre dossier.');
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
                try { await releaseSyncDirectory(config.target); } catch (error) { console.warn('Impossible de libérer le dossier :', error); }
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
