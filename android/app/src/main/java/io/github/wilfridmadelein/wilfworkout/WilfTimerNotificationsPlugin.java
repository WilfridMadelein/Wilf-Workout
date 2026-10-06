package io.github.wilfridmadelein.wilfworkout;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name = "WilfTimerNotifications", permissions = {
    @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
})
public class WilfTimerNotificationsPlugin extends Plugin {
    static volatile boolean foreground = false;

    private boolean granted() {
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        return manager.areNotificationsEnabled() && (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED);
    }

    @PluginMethod
    public void status(PluginCall call) {
        AlarmManager alarms = getContext().getSystemService(AlarmManager.class);
        JSObject result = new JSObject();
        result.put("granted", granted());
        result.put("exact", Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms());
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationPermissionResult");
        } else status(call);
    }

    @PermissionCallback
    private void notificationPermissionResult(PluginCall call) { status(call); }

    @PluginMethod
    public void requestAlarmAccess(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 31) {
            Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        int id = call.getInt("id", 0);
        Object raw = call.getData().opt("endAt");
        double value = raw instanceof Number ? ((Number) raw).doubleValue() : Double.NaN;
        boolean paused = call.getBoolean("paused", false);
        if ((id != 1 && id != 2) || !Double.isFinite(value) || value < 0 || value > System.currentTimeMillis() + 86400000L) {
            call.reject("Minuteur invalide.");
            return;
        }
        if (!granted()) { call.reject("Notifications non autorisees."); return; }
        try {
            String title = call.getString("title", "Minuteur termine");
            WilfTimerReceiver.schedule(getContext(), id, title, (long) value, paused, call.getInt("remainingSeconds", 0));
            call.resolve();
        } catch (Exception error) { call.reject("Impossible de programmer l'alarme.", error); }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        int id = call.getInt("id", 0);
        if (id != 1 && id != 2) { call.reject("Minuteur invalide."); return; }
        WilfTimerReceiver.cancel(getContext(), id);
        call.resolve();
    }

    @PluginMethod
    public void complete(PluginCall call) {
        int id = call.getInt("id", 0);
        if (id != 1 && id != 2) { call.reject("Minuteur invalide."); return; }
        WilfTimerReceiver.complete(getContext(), id, 0);
        call.resolve();
    }
}
