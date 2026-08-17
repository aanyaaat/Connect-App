package com.aanya.connectapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.Vibrator;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class HeartbeatService extends Service {
    public static final String ALERT_CHANNEL_ID = "aanya_love_channel";
    public static final String FOREGROUND_CHANNEL_ID = "aanya_status_channel";
    private static final String SUPABASE_URL = "https://sipvivbfdjewxntlbpzt.supabase.co";
    private static final String SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcHZpdmJmZGpld3hudGxicHp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NjcwNjIsImV4cCI6MjEwMjU0MzA2Mn0.Lns7Z9NV27UV13vhM5mGthwhSfLJh0jQzCzjb8dwoUY";
    
    public static volatile boolean isAppInForeground = false;
    private boolean isRunning = false;
    private String lastNotifiedEventId = "";
    private Handler handler;
    private Runnable checkRunnable;
    private ScreenStateReceiver screenReceiver;
    private PowerManager powerManager;

    // Power button press tracking
    private final List<Long> powerPressTimestamps = new ArrayList<>();

    @Override
    public void onCreate() {
        super.onCreate();
        powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        createNotificationChannels();
        handler = new Handler(Looper.getMainLooper());
        
        // Immediately start foreground notification to guarantee 24/7 keep-alive
        try {
            Notification fgNotif = buildForegroundNotification();
            startForeground(1001, fgNotif);
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Register power button / screen on/off listener
        registerScreenStateReceiver();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!isRunning) {
            isRunning = true;
            startPollingDaemon();
        }
        return START_STICKY;
    }

    private void registerScreenStateReceiver() {
        try {
            if (screenReceiver == null) {
                screenReceiver = new ScreenStateReceiver();
                IntentFilter filter = new IntentFilter();
                filter.addAction(Intent.ACTION_SCREEN_ON);
                filter.addAction(Intent.ACTION_SCREEN_OFF);
                registerReceiver(screenReceiver, filter);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private class ScreenStateReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (Intent.ACTION_SCREEN_ON.equals(action) || Intent.ACTION_SCREEN_OFF.equals(action)) {
                handlePowerPress();
            }
        }
    }

    private synchronized void handlePowerPress() {
        long now = System.currentTimeMillis();
        powerPressTimestamps.add(now);

        // Retain only presses within last 2.5 seconds
        while (!powerPressTimestamps.isEmpty() && (now - powerPressTimestamps.get(0) > 2500)) {
            powerPressTimestamps.remove(0);
        }

        // If pressed 3 or more times -> Trigger Quick Message
        if (powerPressTimestamps.size() >= 3) {
            powerPressTimestamps.clear();
            triggerTriplePowerQuickMessage();
        }
    }

    private void triggerTriplePowerQuickMessage() {
        // Provide immediate physical haptic confirmation
        try {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) {
                v.vibrate(new long[]{0, 100, 80, 100, 80, 150}, -1);
            }
        } catch (Exception ignored) {}

        // Send chosen quick message in background thread
        new Thread(() -> {
            try {
                SharedPreferences prefs = getSharedPreferences("aanya_prefs", MODE_PRIVATE);
                String connectionId = prefs.getString("connection_id", "");
                String myUserId = prefs.getString("user_id", "");
                String message = prefs.getString("power_message_text", "Thinking of you right now ❤️");
                String emoji = prefs.getString("power_message_emoji", "❤️");

                if (connectionId.isEmpty() || myUserId.isEmpty()) return;

                JSONObject payload = new JSONObject();
                payload.put("id", UUID.randomUUID().toString());
                payload.put("connection_id", connectionId);
                payload.put("sender_id", myUserId);
                payload.put("type", "CUSTOM");
                payload.put("message", message);
                payload.put("emoji", emoji);
                payload.put("delivery_status", "sent");
                payload.put("created_offline", false);

                URL url = new URL(SUPABASE_URL + "/rest/v1/events");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("apikey", SUPABASE_KEY);
                conn.setRequestProperty("Authorization", "Bearer " + SUPABASE_KEY);
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Prefer", "return=minimal");
                conn.setDoOutput(true);
                conn.setConnectTimeout(4000);
                conn.setReadTimeout(4000);

                OutputStream os = conn.getOutputStream();
                os.write(payload.toString().getBytes("UTF-8"));
                os.flush();
                os.close();

                conn.getResponseCode();
                conn.disconnect();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
    }

    private Notification buildForegroundNotification() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getActivity(this, 0, intent, flags);

        SharedPreferences prefs = getSharedPreferences("aanya_prefs", MODE_PRIVATE);
        String partnerName = prefs.getString("partner_name", "Aanya");

        return new NotificationCompat.Builder(this, FOREGROUND_CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Connected to " + partnerName + " ❤️")
                .setContentText("Listening for live moments & messages 24/7")
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setVisibility(NotificationCompat.VISIBILITY_SECRET)
                .setOngoing(true)
                .setContentIntent(pi)
                .build();
    }

    private void startPollingDaemon() {
        checkRunnable = new Runnable() {
            @Override
            public void run() {
                new Thread(() -> {
                    checkLatestEvent();
                }).start();
                if (isRunning) {
                    handler.postDelayed(this, 3000); // Check every 3 seconds in background
                }
            }
        };
        handler.post(checkRunnable);
    }

    private void checkLatestEvent() {
        PowerManager.WakeLock partialLock = null;
        try {
            if (powerManager != null) {
                partialLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "aanya:check_event_lock");
                partialLock.acquire(4000);
            }

            SharedPreferences prefs = getSharedPreferences("aanya_prefs", MODE_PRIVATE);
            String connectionId = prefs.getString("connection_id", "");
            String myUserId = prefs.getString("user_id", "");
            String partnerName = prefs.getString("partner_name", "Aanya");

            if (connectionId.isEmpty() || myUserId.isEmpty()) {
                return;
            }

            String urlStr = SUPABASE_URL + "/rest/v1/events?connection_id=eq." + connectionId + "&order=occurred_at.desc&limit=1";
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("apikey", SUPABASE_KEY);
            conn.setRequestProperty("Authorization", "Bearer " + SUPABASE_KEY);
            conn.setRequestProperty("Accept", "application/json");
            conn.setConnectTimeout(4000);
            conn.setReadTimeout(4000);

            int code = conn.getResponseCode();
            if (code == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                reader.close();

                JSONArray arr = new JSONArray(sb.toString());
                if (arr.length() > 0) {
                    JSONObject latest = arr.getJSONObject(0);
                    String eventId = latest.optString("id", "");
                    String senderId = latest.optString("sender_id", "");
                    String message = latest.optString("message", "");
                    String emoji = latest.optString("emoji", "❤️");

                    // Check if new event sent by the partner
                    if (!eventId.isEmpty() && !eventId.equals(lastNotifiedEventId) && !senderId.equals(myUserId)) {
                        if (!lastNotifiedEventId.isEmpty()) {
                            // If the app is currently in the foreground, WebSocket handles it.
                            // Only pop heads-up notification if app is closed/backgrounded to prevent duplicate!
                            if (!isAppInForeground) {
                                showSystemNotification(emoji + " " + partnerName, message);
                            }
                        }
                        lastNotifiedEventId = eventId;
                    } else if (lastNotifiedEventId.isEmpty() && !eventId.isEmpty()) {
                        lastNotifiedEventId = eventId;
                    }
                }
            }
            conn.disconnect();
        } catch (Exception e) {
            // Ignore network timeouts silently
        } finally {
            if (partialLock != null && partialLock.isHeld()) {
                try {
                    partialLock.release();
                } catch (Exception ignored) {}
            }
        }
    }

    private void showSystemNotification(String title, String body) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        // 1. Physically illuminate and wake the phone screen on the lock screen
        try {
            if (powerManager != null) {
                @SuppressWarnings("deprecation")
                PowerManager.WakeLock screenLock = powerManager.newWakeLock(
                        PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                        "aanya:lockscreen_wakeup"
                );
                screenLock.acquire(5000); // Illuminate screen for 5 seconds
            }
        } catch (Exception ignored) {}

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getActivity(this, 0, intent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setFullScreenIntent(pi, true)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setLights(0xFFFF1493, 1000, 500)
                .setVibrate(new long[]{0, 300, 150, 300, 150, 450});

        int notifId = (int) (System.currentTimeMillis() % 1000000);
        nm.notify(notifId, builder.build());
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                // 1. Alert Channel (Max Importance, Sound, Vibration, Screen Lights, Public on Lockscreen)
                NotificationChannel alertChannel = new NotificationChannel(
                        ALERT_CHANNEL_ID,
                        "Aanya & Me Love & Moments",
                        NotificationManager.IMPORTANCE_HIGH
                );
                alertChannel.setDescription("Instant notifications when app is closed or locked");
                alertChannel.enableVibration(true);
                alertChannel.setVibrationPattern(new long[]{0, 300, 150, 300, 150, 450});
                alertChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                alertChannel.enableLights(true);
                alertChannel.setLightColor(0xFFFF1493);
                alertChannel.setBypassDnd(true);
                nm.createNotificationChannel(alertChannel);

                // 2. Silent Status Channel for 24/7 Foreground Connection
                NotificationChannel statusChannel = new NotificationChannel(
                        FOREGROUND_CHANNEL_ID,
                        "Connection Keep-Alive Service",
                        NotificationManager.IMPORTANCE_MIN
                );
                statusChannel.setDescription("Keeps connection alive 24/7 in background");
                statusChannel.setShowBadge(false);
                nm.createNotificationChannel(statusChannel);
            }
        }
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        if (handler != null && checkRunnable != null) {
            handler.removeCallbacks(checkRunnable);
        }
        if (screenReceiver != null) {
            try {
                unregisterReceiver(screenReceiver);
            } catch (Exception ignored) {}
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
