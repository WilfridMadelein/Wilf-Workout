package io.github.wilfridmadelein.wilfworkout;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

public class WilfTimerReceiver extends BroadcastReceiver {
    private static final String PROGRESS = "wilf_timer_progress_v1";
    private static final String ALERT = "wilf_timer_alert_v1";

    private static SharedPreferences storage(Context context) {
        return context.getSharedPreferences("wilf_timer_notifications", Context.MODE_PRIVATE);
    }

    private static NotificationManager manager(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel progress = new NotificationChannel(PROGRESS, "Minuteurs en cours", NotificationManager.IMPORTANCE_LOW);
            progress.setSound(null, null);
            manager.createNotificationChannel(progress);
            manager.createNotificationChannel(new NotificationChannel(ALERT, "Fin des minuteurs", NotificationManager.IMPORTANCE_HIGH));
        }
        return manager;
    }

    private static PendingIntent open(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent alarm(Context context, int id, long endAt) {
        Intent intent = new Intent(context, WilfTimerReceiver.class);
        intent.putExtra("id", id);
        intent.putExtra("endAt", endAt);
        return PendingIntent.getBroadcast(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static Notification.Builder builder(Context context, String channel) {
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(context, channel) : new Notification.Builder(context);
        return builder.setSmallIcon(android.R.drawable.ic_lock_idle_alarm).setContentIntent(open(context)).setCategory(Notification.CATEGORY_ALARM);
    }

    static synchronized void schedule(Context context, int id, String title, long endAt, boolean paused, int remainingSeconds) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        if (!paused && Build.VERSION.SDK_INT >= 31 && !alarms.canScheduleExactAlarms()) throw new SecurityException("Autorisation d'alarme precise requise.");
        alarms.cancel(alarm(context, id, endAt));
        // Commit avant l'alarme : le receiver peut demarrer dans un nouveau processus.
        storage(context).edit().putLong("end_" + id, paused ? 0 : endAt).putString("title_" + id, title).commit();
        NotificationManager notifications = manager(context);
        notifications.cancel(2000 + id);
        Notification.Builder notification = builder(context, PROGRESS).setContentTitle(title.replace("terminé", "en cours"))
            .setContentText(paused ? "En pause · " + Math.max(0, remainingSeconds) + " s restantes" : "Touchez pour revenir à l'entraînement")
            .setOngoing(true).setOnlyAlertOnce(true);
        if (!paused) notification.setWhen(endAt).setShowWhen(true).setUsesChronometer(true).setChronometerCountDown(true);
        notifications.notify(1000 + id, notification.build());
        if (!paused) {
            // Alarme utilisateur visible, reveillant Android meme lorsque la WebView est suspendue.
            alarms.setAlarmClock(new AlarmManager.AlarmClockInfo(Math.max(System.currentTimeMillis() + 100, endAt), open(context)), alarm(context, id, endAt));
        }
    }

    static synchronized void cancel(Context context, int id) {
        context.getSystemService(AlarmManager.class).cancel(alarm(context, id, 0));
        storage(context).edit().remove("end_" + id).remove("title_" + id).commit();
        NotificationManager notifications = manager(context);
        notifications.cancel(1000 + id);
        notifications.cancel(2000 + id);
    }

    static synchronized void complete(Context context, int id, long expectedEnd) {
        SharedPreferences preferences = storage(context);
        long endAt = preferences.getLong("end_" + id, 0);
        if (endAt == 0 || (expectedEnd != 0 && expectedEnd != endAt)) return;
        String title = preferences.getString("title_" + id, "Minuteur terminé");
        context.getSystemService(AlarmManager.class).cancel(alarm(context, id, 0));
        preferences.edit().remove("end_" + id).remove("title_" + id).commit();
        NotificationManager notifications = manager(context);
        notifications.cancel(1000 + id);
        if (WilfTimerNotificationsPlugin.foreground) return;
        Notification.Builder notification = builder(context, ALERT).setContentTitle(title)
            .setContentText("Le minuteur est terminé. Revenez à votre entraînement.").setAutoCancel(true);
        if (Build.VERSION.SDK_INT < 26) notification.setDefaults(Notification.DEFAULT_SOUND | Notification.DEFAULT_VIBRATE);
        notifications.notify(2000 + id, notification.build());
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        int id = intent.getIntExtra("id", 0);
        if (id != 1 && id != 2) return;
        try { complete(context, id, intent.getLongExtra("endAt", 0)); }
        catch (SecurityException ignored) { cancel(context, id); }
    }
}
