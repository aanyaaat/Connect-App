package com.aanya.connectapp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.UserManager;
import androidx.core.content.ContextCompat;

/**
 * Receiver for restoring the 24/7 background service and lock-screen controls
 * after device boot, quick boot, or app package update.
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String action = intent.getAction();

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {

            // Check if device storage is unlocked before reading SharedPreferences
            boolean canAccessStorage = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                UserManager um = (UserManager) context.getSystemService(Context.USER_SERVICE);
                if (um != null) {
                    canAccessStorage = um.isUserUnlocked();
                }
            }

            if (canAccessStorage) {
                try {
                    SharedPreferences prefs = context.getSharedPreferences("aanya_prefs", Context.MODE_PRIVATE);
                    boolean controlsEnabled = prefs.getBoolean("lock_controls_enabled", true);
                    boolean doodleEnabled = prefs.getBoolean("lock_doodle_enabled", true);
                    if (!controlsEnabled && !doodleEnabled) {
                        return; // User explicitly disabled all lock-screen cards
                    }
                } catch (Exception ignored) {}
            }

            Intent serviceIntent = new Intent(context, HeartbeatService.class);
            try {
                ContextCompat.startForegroundService(context, serviceIntent);
            } catch (Exception e) {
                // Catch any ForegroundServiceStartNotAllowedException gracefully
                e.printStackTrace();
            }
        }
    }
}
