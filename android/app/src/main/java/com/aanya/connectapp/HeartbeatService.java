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
import android.os.IBinder;
import android.os.PowerManager;
import android.os.Vibrator;
import androidx.core.app.NotificationCompat;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
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
import java.util.concurrent.TimeUnit;

public class HeartbeatService extends Service {
    public static final String ALERT_CHANNEL_ID = "aanya_love_channel";
    public static final String FOREGROUND_CHANNEL_ID = "aanya_lock_controls_v2";
    private static final String SUPABASE_URL = "https://sipvivbfdjewxntlbpzt.supabase.co";
    private static final String SUPABASE_WS_URL = "wss://sipvivbfdjewxntlbpzt.supabase.co/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcHZpdmJmZGpld3hudGxicHp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NjcwNjIsImV4cCI6MjEwMjU0MzA2Mn0.Lns7Z9NV27UV13vhM5mGthwhSfLJh0jQzCzjb8dwoUY&vsn=1.0.0";
    private static final String SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcHZpdmJmZGpld3hudGxicHp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NjcwNjIsImV4cCI6MjEwMjU0MzA2Mn0.Lns7Z9NV27UV13vhM5mGthwhSfLJh0jQzCzjb8dwoUY";

    public static volatile boolean isAppInForeground = false;
    private boolean isRunning = false;
    private String lastNotifiedEventId = "";
    private ScreenStateReceiver screenReceiver;
    private PowerManager powerManager;
    private PowerManager.WakeLock serviceWakeLock;

    // Modern Native WebSocket Stream Engine (Instagram/Telegram-grade 0ms push stream)
    private OkHttpClient okHttpClient;
    private WebSocket webSocket;
    private Thread fallbackThread;
    private Thread heartbeatThread;

    // Power button press tracking
    private final List<Long> powerPressTimestamps = new ArrayList<>();

    @Override
    public void onCreate() {
        super.onCreate();
        powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);

        // 1. Acquire persistent service WakeLock to prevent deep-sleep freeze on lockscreen
        try {
            if (powerManager != null && (serviceWakeLock == null || !serviceWakeLock.isHeld())) {
                serviceWakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "aanya:service_daemon_lock");
                serviceWakeLock.acquire();
            }
        } catch (Exception ignored) {}

        createNotificationChannels();

        // 2. Start foreground notification for 24/7 keep-alive
        try {
            Notification fgNotif = buildForegroundNotification();
            startForeground(1001, fgNotif);
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 3. Register power button / screen on/off listener
        registerScreenStateReceiver();

        // 4. Initialize Modern OkHttpClient with automatic TCP keep-alive
        okHttpClient = new OkHttpClient.Builder()
                .pingInterval(20, TimeUnit.SECONDS)
                .readTimeout(0, TimeUnit.MILLISECONDS)
                .retryOnConnectionFailure(true)
                .build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!isRunning) {
            isRunning = true;
            // Connect to Realtime WebSocket stream
            connectRealtimeWebSocket();
            // Start heartbeat ping thread
            startHeartbeatPing();
            // Start fast fallback health check daemon
            startFallbackDaemon();
        }
        return START_STICKY;
    }

    // =========================================================================
    // ⚡ 1. MODERN NATIVE REALTIME WEBSOCKET STREAM (0ms Latency, Zero Battery Drain)
    // =========================================================================
    private synchronized void connectRealtimeWebSocket() {
        if (!isRunning) return;

        try {
            if (webSocket != null) {
                webSocket.close(1000, "reconnecting");
            }

            Request request = new Request.Builder()
                    .url(SUPABASE_WS_URL)
                    .build();

            webSocket = okHttpClient.newWebSocket(request, new WebSocketListener() {
                @Override
                public void onOpen(WebSocket ws, Response response) {
                    // Subscribe to Realtime Postgres Insert Events
                    try {
                        JSONObject joinMsg = new JSONObject();
                        joinMsg.put("topic", "realtime:public:events");
                        joinMsg.put("event", "phx_join");
                        
                        JSONObject payload = new JSONObject();
                        JSONObject config = new JSONObject();
                        config.put("broadcast", new JSONObject().put("self", false));
                        JSONArray pgChanges = new JSONArray();
                        JSONObject changeRule = new JSONObject();
                        changeRule.put("event", "INSERT");
                        changeRule.put("schema", "public");
                        changeRule.put("table", "events");
                        pgChanges.put(changeRule);
                        config.put("postgres_changes", pgChanges);
                        payload.put("config", config);
                        
                        joinMsg.put("payload", payload);
                        joinMsg.put("ref", "1");
                        ws.send(joinMsg.toString());
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }

                @Override
                public void onMessage(WebSocket ws, String text) {
                    handleWebSocketMessage(text);
                }

                @Override
                public void onClosing(WebSocket ws, int code, String reason) {
                    ws.close(1000, null);
                }

                @Override
                public void onFailure(WebSocket ws, Throwable t, Response response) {
                    // Reconnect with backoff
                    if (isRunning) {
                        try {
                            Thread.sleep(2500);
                        } catch (Exception ignored) {}
                        connectRealtimeWebSocket();
                    }
                }
            });
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private synchronized void startHeartbeatPing() {
        if (heartbeatThread != null && heartbeatThread.isAlive()) return;
        heartbeatThread = new Thread(() -> {
            while (isRunning) {
                try {
                    Thread.sleep(20000); // 20s RFC WebSocket keep-alive
                    if (webSocket != null) {
                        JSONObject hb = new JSONObject();
                        hb.put("topic", "phoenix");
                        hb.put("event", "heartbeat");
                        hb.put("payload", new JSONObject());
                        hb.put("ref", "hb_" + System.currentTimeMillis());
                        webSocket.send(hb.toString());
                    }
                } catch (InterruptedException e) {
                    break;
                } catch (Exception ignored) {}
            }
        }, "AanyaWebSocketHeartbeat");
        heartbeatThread.start();
    }

    // Thread-safe LRU cache of recently notified event IDs to permanently eliminate duplicate notifications
    private final java.util.Set<String> notifiedEventSet = java.util.Collections.synchronizedSet(new java.util.LinkedHashSet<>());

    private synchronized boolean shouldNotifyEvent(String eventId) {
        if (eventId == null || eventId.trim().isEmpty()) return false;
        if (notifiedEventSet.contains(eventId)) {
            return false; // Already notified! Prevent duplicate!
        }
        notifiedEventSet.add(eventId);
        if (notifiedEventSet.size() > 200) {
            java.util.Iterator<String> it = notifiedEventSet.iterator();
            if (it.hasNext()) {
                it.next();
                it.remove();
            }
        }
        return true;
    }

    private void handleWebSocketMessage(String text) {
        try {
            JSONObject msg = new JSONObject(text);
            String event = msg.optString("event", "");

            if ("INSERT".equalsIgnoreCase(event) || "new_event".equalsIgnoreCase(event) || "postgres_changes".equalsIgnoreCase(event)) {
                JSONObject payload = msg.optJSONObject("payload");
                if (payload != null) {
                    JSONObject record = payload.optJSONObject("data");
                    if (record == null) {
                        record = payload.optJSONObject("record");
                    }
                    if (record == null) {
                        record = payload;
                    }

                    String eventId = record.optString("id", "");
                    String senderId = record.optString("sender_id", "");
                    String message = record.optString("message", "");
                    String emoji = record.optString("emoji", "❤️");

                    SharedPreferences prefs = getSharedPreferences("aanya_prefs", MODE_PRIVATE);
                    String myUserId = prefs.getString("user_id", "");
                    String partnerName = prefs.getString("partner_name", "Aanya");

                    if (!eventId.isEmpty() && !senderId.equals(myUserId) && shouldNotifyEvent(eventId)) {
                        lastNotifiedEventId = eventId;
                        if (!isAppInForeground) {
                            showSystemNotification(eventId, emoji + " " + partnerName, message);
                        }
                    }
                }
            }
        } catch (Exception e) {
            // Ignore non-json frames or heartbeats
        }
    }

    // =========================================================================
    // 🛡️ 2. RELIABLE FALLBACK POLLING (Only for Network Handover / Tunnel Recovery)
    // =========================================================================
    private synchronized void startFallbackDaemon() {
        if (fallbackThread != null && fallbackThread.isAlive()) return;
        fallbackThread = new Thread(() -> {
            while (isRunning) {
                try {
                    checkLatestEvent();
                    Thread.sleep(2500); // 2.5s fast fallback
                } catch (InterruptedException e) {
                    break;
                } catch (Exception e) {
                    try { Thread.sleep(3000); } catch (Exception ignored) {}
                }
            }
        }, "AanyaFallbackDaemon");
        fallbackThread.setPriority(Thread.MAX_PRIORITY);
        fallbackThread.start();
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

                    if (!eventId.isEmpty() && !senderId.equals(myUserId)) {
                        if (lastNotifiedEventId.isEmpty()) {
                            // Initial seed so existing history doesn't trigger spurious alerts on service boot
                            lastNotifiedEventId = eventId;
                            notifiedEventSet.add(eventId);
                        } else if (shouldNotifyEvent(eventId)) {
                            lastNotifiedEventId = eventId;
                            if (!isAppInForeground) {
                                showSystemNotification(eventId, emoji + " " + partnerName, message);
                            }
                        }
                    }
                }
            }
            conn.disconnect();
        } catch (Exception e) {
            // Silently ignore network timeouts
        }
    }

    // =========================================================================
    // 💡 3. INSTANT LOCKSCREEN ILLUMINATION & HAPTIC NOTIFICATION
    // =========================================================================
    private void showSystemNotification(String eventId, String title, String body) {
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
                screenLock.acquire(6000); // Illuminate screen for 6 seconds
            }
        } catch (Exception ignored) {}

        // 2. Direct tactile vibration
        try {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) {
                v.vibrate(new long[]{0, 300, 150, 300, 150, 450}, -1);
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

        // Deterministic ID based on event ID hash: Android OS will automatically deduplicate and update existing card!
        int notifId = eventId != null && !eventId.isEmpty() ? Math.abs(eventId.hashCode() % 100000) : 1002;
        nm.notify(notifId, builder.build());
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
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

                NotificationChannel statusChannel = new NotificationChannel(
                        FOREGROUND_CHANNEL_ID,
                        "Lock Screen Quick Controls",
                        NotificationManager.IMPORTANCE_LOW
                );
                statusChannel.setDescription("Allows sending quick messages & doodling straight from lock screen without unlocking");
                statusChannel.setShowBadge(false);
                statusChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                nm.createNotificationChannel(statusChannel);
            }
        }
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

        // Action 1: ❤️ Send Love
        Intent quick1Intent = new Intent(this, QuickActionReceiver.class);
        quick1Intent.setAction(QuickActionReceiver.ACTION_QUICK_1);
        PendingIntent quick1Pending = PendingIntent.getBroadcast(this, 101, quick1Intent, flags);

        // Action 2: ✨ Miss You
        Intent quick2Intent = new Intent(this, QuickActionReceiver.class);
        quick2Intent.setAction(QuickActionReceiver.ACTION_QUICK_2);
        PendingIntent quick2Pending = PendingIntent.getBroadcast(this, 102, quick2Intent, flags);

        // Action 3: 🎨 Live Doodle Screen (Opens directly above lockscreen!)
        Intent doodleIntent = new Intent(this, LockScreenDoodleActivity.class);
        doodleIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent doodlePending = PendingIntent.getActivity(this, 103, doodleIntent, flags);

        String quick1Label = prefs.getString("quick_1_label", "❤️ Love");
        String quick2Label = prefs.getString("quick_2_label", "✨ Miss You");

        return new NotificationCompat.Builder(this, FOREGROUND_CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Connected to " + partnerName + " ❤️")
                .setContentText("Tap below to send quick love without unlocking")
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setContentIntent(pi)
                .addAction(android.R.drawable.ic_menu_send, quick1Label, quick1Pending)
                .addAction(android.R.drawable.ic_menu_send, quick2Label, quick2Pending)
                .addAction(android.R.drawable.ic_menu_edit, "🎨 Doodle", doodlePending)
                .build();
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

        while (!powerPressTimestamps.isEmpty() && (now - powerPressTimestamps.get(0) > 2500)) {
            powerPressTimestamps.remove(0);
        }

        if (powerPressTimestamps.size() >= 3) {
            powerPressTimestamps.clear();
            triggerTriplePowerQuickMessage();
        }
    }

    private void triggerTriplePowerQuickMessage() {
        try {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) {
                v.vibrate(new long[]{0, 100, 80, 100, 80, 150}, -1);
            }
        } catch (Exception ignored) {}

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

    @Override
    public void onDestroy() {
        isRunning = false;
        if (webSocket != null) {
            try {
                webSocket.close(1000, "service destroyed");
            } catch (Exception ignored) {}
        }
        if (fallbackThread != null) {
            try {
                fallbackThread.interrupt();
            } catch (Exception ignored) {}
        }
        if (serviceWakeLock != null && serviceWakeLock.isHeld()) {
            try {
                serviceWakeLock.release();
            } catch (Exception ignored) {}
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
