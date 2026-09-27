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
}