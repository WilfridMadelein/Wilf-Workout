package io.github.wilfridmadelein.wilfworkout;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// ============================================================
// OUVERTURE DE LA PAGE OFFICIELLE DES MISES À JOUR
// ============================================================
@CapacitorPlugin(name = "WilfUpdates")
public class WilfUpdatesPlugin extends Plugin {
    private static final String RELEASES_URL = "https://github.com/WilfridMadelein/Wilf-Workout/releases/latest";

    @PluginMethod
    public void openReleasePage(PluginCall call) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(RELEASES_URL));
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException error) {
            call.reject("Aucun navigateur disponible pour ouvrir les mises à jour.", error);
        }
    }
}
