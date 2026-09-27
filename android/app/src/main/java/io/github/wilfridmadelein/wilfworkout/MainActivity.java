package io.github.wilfridmadelein.wilfworkout;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WilfStoragePlugin.class);
        super.onCreate(savedInstanceState);
    }
}