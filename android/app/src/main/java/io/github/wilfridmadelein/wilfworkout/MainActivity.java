package io.github.wilfridmadelein.wilfworkout;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WilfStoragePlugin.class);
        registerPlugin(WilfTimerNotificationsPlugin.class);
        registerPlugin(WilfSharePlugin.class);
        registerPlugin(WilfUpdatesPlugin.class);
        super.onCreate(savedInstanceState);
    }
    @Override
    public void onResume() {
        super.onResume();
        WilfTimerNotificationsPlugin.foreground = true;
    }

    @Override
    public void onPause() {
        WilfTimerNotificationsPlugin.foreground = false;
        super.onPause();
    }
}
