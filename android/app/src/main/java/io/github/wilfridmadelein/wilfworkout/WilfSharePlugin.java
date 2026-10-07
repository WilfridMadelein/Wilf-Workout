package io.github.wilfridmadelein.wilfworkout;

import android.content.Intent;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// ============================================================
// PARTAGE NATIF ANDROID
// ============================================================

@CapacitorPlugin(name = "WilfShare")
public class WilfSharePlugin extends Plugin {

    @PluginMethod
    public void share(PluginCall call) {
        String text = call.getString("text");
        String title = call.getString("title", "Partager avec");
        if (text == null || text.isBlank()) { call.reject("Texte à partager manquant."); return; }

        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_TEXT, text);
        intent.putExtra(Intent.EXTRA_SUBJECT, title);

        ClipboardManager clipboard = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
        clipboard.setPrimaryClip(ClipData.newPlainText(title, text));
        getActivity().startActivity(Intent.createChooser(intent, title));
        call.resolve(new JSObject());
    }
}
