package io.github.wilfridmadelein.wilfworkout;

import android.app.Activity;
import android.content.Intent;
import android.content.UriPermission;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

import android.content.ContentResolver;
import android.database.Cursor;
import android.provider.DocumentsContract;

// ============================================================
// STOCKAGE ANDROID — STORAGE ACCESS FRAMEWORK
// ============================================================

@CapacitorPlugin(name = "WilfStorage")
public class WilfStoragePlugin extends Plugin {

    @PluginMethod
    public void chooseDirectory(PluginCall call) {
        Intent intent =
            new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);

        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION |
            Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION |
            Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
        );

        startActivityForResult(
            call,
            intent,
            "chooseDirectoryResult"
        );
    }

    @ActivityCallback
    private void chooseDirectoryResult(
        PluginCall call,
        ActivityResult result
    ) {
        if (call == null) return;

        Intent data = result.getData();

        if (
            result.getResultCode() != Activity.RESULT_OK ||
            data == null ||
            data.getData() == null
        ) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }

        Uri uri = data.getData();

        int takeFlags =
            data.getFlags() &
            (
                Intent.FLAG_GRANT_READ_URI_PERMISSION |
                Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            );

        if (
            (takeFlags & Intent.FLAG_GRANT_WRITE_URI_PERMISSION) == 0
        ) {
            call.reject(
                "Le dossier sélectionné n'accorde pas l'accès en écriture."
            );
            return;
        }

        try {
            getContext()
                .getContentResolver()
                .takePersistableUriPermission(
                    uri,
                    takeFlags
                );
        } catch (SecurityException error) {
            call.reject(
                "Impossible de conserver l'autorisation du dossier.",
                error
            );
            return;
        }

        JSObject response = new JSObject();
        response.put("cancelled", false);
        response.put("uri", uri.toString());

        call.resolve(response);
    }

    @PluginMethod
    public void hasDirectoryAccess(PluginCall call) {
        String uriValue = call.getString("uri");

        if (uriValue == null || uriValue.isBlank()) {
            call.reject("URI du dossier manquante.");
            return;
        }

        Uri uri = Uri.parse(uriValue);
        boolean granted = false;

        for (
            UriPermission permission :
            getContext()
                .getContentResolver()
                .getPersistedUriPermissions()
        ) {
            if (
                permission.getUri().equals(uri) &&
                permission.isReadPermission() &&
                permission.isWritePermission()
            ) {
                granted = true;
                break;
            }
        }

        JSObject response = new JSObject();
        response.put("granted", granted);

        call.resolve(response);
    }

    @PluginMethod
    public void releaseDirectory(PluginCall call) {
        String uriValue = call.getString("uri");

        if (uriValue == null || uriValue.isBlank()) {
            call.resolve();
            return;
        }

        Uri uri = Uri.parse(uriValue);
        int flags = 0;

        for (
            UriPermission permission :
            getContext()
                .getContentResolver()
                .getPersistedUriPermissions()
        ) {
            if (!permission.getUri().equals(uri)) continue;

            if (permission.isReadPermission()) {
                flags |= Intent.FLAG_GRANT_READ_URI_PERMISSION;
            }

            if (permission.isWritePermission()) {
                flags |= Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
            }
        }

        if (flags != 0) {
            try {
                getContext()
                    .getContentResolver()
                    .releasePersistableUriPermission(
                        uri,
                        flags
                    );
            } catch (SecurityException error) {
                call.reject(
                    "Impossible de libérer l'autorisation du dossier.",
                    error
                );
                return;
            }
        }

        call.resolve();
    }

    @PluginMethod
    public void saveTextFile(PluginCall call) {
        String fileName = call.getString("fileName");
        String content = call.getString("content");
        String mimeType =
            call.getString(
                "mimeType",
                "application/octet-stream"
            );

        if (fileName == null || fileName.isBlank()) {
            call.reject("Nom du fichier manquant.");
            return;
        }

        if (content == null) content = "";

        Intent intent =
            new Intent(Intent.ACTION_CREATE_DOCUMENT);

        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(
            Intent.EXTRA_TITLE,
            fileName
        );

        startActivityForResult(
            call,
            intent,
            "saveTextFileResult"
        );
    }

    @ActivityCallback
    private void saveTextFileResult(
        PluginCall call,
        ActivityResult result
    ) {
        if (call == null) return;

        Intent data = result.getData();

        if (
            result.getResultCode() != Activity.RESULT_OK ||
            data == null ||
            data.getData() == null
        ) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }

        Uri uri = data.getData();
        String content =
            call.getString("content", "");

        try (
            OutputStream output =
                getContext()
                    .getContentResolver()
                    .openOutputStream(uri, "wt")
        ) {
            if (output == null) {
                call.reject(
                    "Impossible d'ouvrir le fichier en écriture."
                );
                return;
            }

            output.write(
                content.getBytes(
                    StandardCharsets.UTF_8
                )
            );

            output.flush();
        } catch (
            IOException |
            SecurityException error
        ) {
            call.reject(
                "Impossible d'enregistrer le fichier.",
                error
            );
            return;
        }

        JSObject response = new JSObject();
        response.put("cancelled", false);
        response.put("uri", uri.toString());

        call.resolve(response);
    }

@PluginMethod
public void writeDirectoryTextFile(
    PluginCall call
) {
    String directoryUriValue =
        call.getString("directoryUri");

    String fileUriValue =
        call.getString("fileUri");

    String fileName =
        call.getString("fileName");

    String content =
        call.getString("content", "");

    String mimeType =
        call.getString(
            "mimeType",
            "application/json"
        );

    if (
        directoryUriValue == null ||
        directoryUriValue.isBlank()
    ) {
        call.reject(
            "URI du dossier manquante."
        );
        return;
    }

    if (
        fileName == null ||
        fileName.isBlank()
    ) {
        call.reject(
            "Nom du fichier manquant."
        );
        return;
    }

    Uri treeUri =
        Uri.parse(directoryUriValue);

    ContentResolver resolver =
        getContext()
            .getContentResolver();

    try {
        Uri fileUri = null;

        /*
         * Si Wilf connaît déjà exactement son fichier,
         * on le réutilise directement.
         */
        if (
            fileUriValue != null &&
            !fileUriValue.isBlank()
        ) {
            fileUri =
                Uri.parse(fileUriValue);

            writeTextToUri(
                resolver,
                fileUri,
                content
            );
        } else {
            /*
             * Première écriture seulement :
             * recherche ou création du fichier.
             */
            fileUri =
                findDirectoryFile(
                    resolver,
                    treeUri,
                    fileName
                );

            if (fileUri == null) {
                String treeDocumentId =
                    DocumentsContract
                        .getTreeDocumentId(
                            treeUri
                        );

                Uri parentUri =
                    DocumentsContract
                        .buildDocumentUriUsingTree(
                            treeUri,
                            treeDocumentId
                        );

                fileUri =
                    DocumentsContract
                        .createDocument(
                            resolver,
                            parentUri,
                            mimeType,
                            fileName
                        );
            }

            if (fileUri == null) {
                call.reject(
                    "Impossible de créer le fichier de données."
                );
                return;
            }

            writeTextToUri(
                resolver,
                fileUri,
                content
            );
        }

        JSObject response =
            new JSObject();

        response.put(
            "uri",
            fileUri.toString()
        );

        call.resolve(response);
    } catch (
        IOException |
        SecurityException error
    ) {
        call.reject(
            "Impossible d'écrire la copie durable des données.",
            error
        );
    }
}

private void writeTextToUri(
    ContentResolver resolver,
    Uri fileUri,
    String content
) throws IOException {
    try (
        OutputStream output =
            resolver.openOutputStream(
                fileUri,
                "wt"
            )
    ) {
        if (output == null) {
            throw new IOException(
                "Impossible d'ouvrir le fichier en écriture."
            );
        }

        output.write(
            content.getBytes(
                StandardCharsets.UTF_8
            )
        );

        output.flush();
    }
}

private Uri findDirectoryFile(
    ContentResolver resolver,
    Uri treeUri,
    String fileName
) {
    String treeDocumentId =
        DocumentsContract
            .getTreeDocumentId(
                treeUri
            );

    Uri childrenUri =
        DocumentsContract
            .buildChildDocumentsUriUsingTree(
                treeUri,
                treeDocumentId
            );

    String[] projection = {
        DocumentsContract.Document
            .COLUMN_DOCUMENT_ID,

        DocumentsContract.Document
            .COLUMN_DISPLAY_NAME
    };

    try (
        Cursor cursor =
            resolver.query(
                childrenUri,
                projection,
                null,
                null,
                null
            )
    ) {
        if (cursor == null) return null;

        int idIndex =
            cursor.getColumnIndex(
                DocumentsContract.Document
                    .COLUMN_DOCUMENT_ID
            );

        int nameIndex =
            cursor.getColumnIndex(
                DocumentsContract.Document
                    .COLUMN_DISPLAY_NAME
            );

        while (cursor.moveToNext()) {
            String currentName =
                cursor.getString(
                    nameIndex
                );

            if (
                !fileName.equals(
                    currentName
                )
            ) {
                continue;
            }

            String documentId =
                cursor.getString(
                    idIndex
                );

            return DocumentsContract
                .buildDocumentUriUsingTree(
                    treeUri,
                    documentId
                );
        }
    } catch (Exception error) {
        return null;
    }

    return null;
}  
}