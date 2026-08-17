package com.aanya.connectapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

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

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
        handler = new Handler(Looper.getMainLooper());
        
        // Immediately start foreground notification to guarantee 24/7 keep-alive
        try {
            Notification fgNotif = buildForegroundNotification();
            startForeground(1001, fgNotif);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!isRunning) {
            isRunning = true;
            startPollingDaemon();
        }
        return START_STICKY;
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
        try {
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
        }
    }

    private void showSystemNotification(String title, String body) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

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
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setVibrate(new long[]{0, 250, 100, 250});

        int notifId = (int) (System.currentTimeMillis() % 1000000);
        nm.notify(notifId, builder.build());
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                // 1. Alert Channel (Max Importance, Sound, Vibration)
                NotificationChannel alertChannel = new NotificationChannel(
                        ALERT_CHANNEL_ID,
                        "Aanya & Me Love & Moments",
                        NotificationManager.IMPORTANCE_HIGH
                );
                alertChannel.setDescription("Instant notifications when app is closed");
                alertChannel.enableVibration(true);
                alertChannel.setVibrationPattern(new long[]{0, 250, 100, 250});
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
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
