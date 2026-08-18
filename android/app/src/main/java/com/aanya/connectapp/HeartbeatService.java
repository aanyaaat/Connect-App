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
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.widget.RemoteViews;
import androidx.core.app.NotificationCompat;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Native 24/7 Background Realtime Messaging & Lock-Screen Controls Service.
 * Maintains an official remoteMessaging Foreground Service for live Supabase sync
 * and posts a persistent Lock-Screen Controls Notification with direct quick actions
 * and live showWhenLocked Doodle access.
 */
public class HeartbeatService extends Service {
    public static final String LOCK_CONTROLS_CHANNEL_ID = "aanya_lock_controls_v2";
    public static final String ALERT_CHANNEL_ID = "aanya_love_channel";

    public static final int NOTIFICATION_ID_CONTROLS = 1001;
    public static final int NOTIFICATION_ID_DOODLE = 1002;

    private static final String SUPABASE_URL = "https://sipvivbfdjewxntlbpzt.supabase.co";
    private static final String SUPABASE_WS_URL = "wss://sipvivbfdjewxntlbpzt.supabase.co/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcHZpdmJmZGpld3hudGxicHp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NjcwNjIsImV4cCI6MjEwMjU0MzA2Mn0.Lns7Z9NV27UV13vhM5mGthwhSfLJh0jQzCzjb8dwoUY&vsn=1.0.0";
    private static final String SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcHZpdmJmZGpld3hudGxicHp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NjcwNjIsImV4cCI6MjEwMjU0MzA2Mn0.Lns7Z9NV27UV13vhM5mGthwhSfLJh0jQzCzjb8dwoUY";

    public static volatile boolean isAppInForeground = false;
    private boolean isRunning = false;
    private String lastNotifiedEventId = "";
    private PowerManager powerManager;

    private OkHttpClient okHttpClient;
    private WebSocket webSocket;
    private Thread fallbackThread;
    private Thread heartbeatThread;

    private ScreenStateReceiver screenReceiver;
    private final List<Long> powerPressTimestamps = new ArrayList<>();
    private final List<Long> volumePressTimestamps = new ArrayList<>();

    @Override
    public void onCreate() {
        super.onCreate();
        powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);

        createNotificationChannels();

        // Start official remoteMessaging Foreground Service with persistent lock-screen controls
        try {
            Notification fgNotif = buildForegroundNotification();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) { // API 34+
                startForeground(NOTIFICATION_ID_CONTROLS, fgNotif, ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) { // API 29-33
                startForeground(NOTIFICATION_ID_CONTROLS, fgNotif, 0);
            } else {
                startForeground(NOTIFICATION_ID_CONTROLS, fgNotif);
            }
            refreshNotifications();
        } catch (Exception e) {
            e.printStackTrace();
        }

        registerScreenStateReceiver();

        okHttpClient = new OkHttpClient.Builder()
                .pingInterval(20, TimeUnit.SECONDS)
                .readTimeout(0, TimeUnit.MILLISECONDS)
                .retryOnConnectionFailure(true)
                .build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createNotificationChannels();
        try {
            Notification fgNotif = buildForegroundNotification();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTIFICATION_ID_CONTROLS, fgNotif, ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID_CONTROLS, fgNotif, 0);
            } else {
                startForeground(NOTIFICATION_ID_CONTROLS, fgNotif);
            }
            refreshNotifications();
        } catch (Exception e) {
            e.printStackTrace();
        }

        if (!isRunning) {
            isRunning = true;
            connectRealtimeWebSocket();
            startHeartbeatPing();
            startFallbackDaemon();
        }
        return START_STICKY;
    }

    public void refreshNotifications() {
        SharedPreferences prefs = getSharedPreferences("aanya_prefs", MODE_PRIVATE);
        boolean controlsEnabled = prefs.getBoolean("lock_controls_enabled", true);
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        // Cancel legacy second doodle card if active
        try {
            nm.cancel(1002);
        } catch (Exception ignored) {}

        if (controlsEnabled) {
            nm.notify(NOTIFICATION_ID_CONTROLS, buildForegroundNotification());
        } else {
            nm.cancel(NOTIFICATION_ID_CONTROLS);
        }
    }

    public static void updateNotification(Context context) {
        try {
            Intent intent = new Intent(context, HeartbeatService.class);
            intent.setAction("ACTION_UPDATE_NOTIFICATION");
            context.startService(intent);
        } catch (Exception ignored) {}
    }

    // =========================================================================
    // ⚡ 1. REALTIME WEBSOCKET STREAM (Instant partner push delivery)
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
                    try {
                        JSONObject json = new JSONObject(text);
                        String event = json.optString("event");

                        if ("postgres_changes".equals(event) || "INSERT".equals(event)) {
                            JSONObject payload = json.optJSONObject("payload");
                            if (payload != null) {
                                JSONObject data = payload.optJSONObject("data");
                                if (data != null) {
                                    JSONObject record = data.optJSONObject("record");
                                    if (record != null) {
                                        processIncomingEventRecord(record);
                                    }
                                }
                            }
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }

                @Override
                public void onFailure(WebSocket ws, Throwable t, Response response) {
                    if (isRunning) {
                        new Thread(() -> {
                            try {
                                Thread.sleep(5000);
                                connectRealtimeWebSocket();
                            } catch (Exception ignored) {}
                        }).start();
                    }
                }

                @Override
                public void onClosed(WebSocket ws, int code, String reason) {
                    if (isRunning && code != 1000) {
                        new Thread(() -> {
                            try {
                                Thread.sleep(3000);
                                connectRealtimeWebSocket();
                            } catch (Exception ignored) {}
                        }).start();
                    }
                }
            });
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void processIncomingEventRecord(JSONObject record) {
        try {
            SharedPreferences prefs = getSharedPreferences("aanya_prefs", MODE_PRIVATE);
            String myUserId = prefs.getString("user_id", "");
            String partnerName = prefs.getString("partner_name", "Aanya");

            String senderId = record.optString("sender_id");
            String eventId = record.optString("id");
            String eventType = record.optString("type");
            String message = record.optString("message");
            String emoji = record.optString("emoji", "❤️");

            if (senderId.equals(myUserId) || eventId.equals(lastNotifiedEventId)) {
                return;
            }

            lastNotifiedEventId = eventId;

            String notifTitle = partnerName + " " + emoji;
            String notifBody = (message != null && !message.trim().isEmpty()) ? message : "Sent you a loving touch ❤️";

            if ("HEARTBURST".equals(eventType)) {
                notifTitle = "💖 " + partnerName + " is sending love!";
                notifBody = "Double tap to send love back";
            } else if ("POKE".equals(eventType)) {
                notifTitle = "👉 " + partnerName + " poked you!";
                notifBody = "Hey you, check in with me 😊";
            }

            showIncomingSystemNotification(notifTitle, notifBody, eventId);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // =========================================================================
    // 💓 2. HEARTBEAT & FALLBACK POLLING DAEMONS
    // =========================================================================
    private void startHeartbeatPing() {
        heartbeatThread = new Thread(() -> {
            while (isRunning) {
                try {
                    SharedPreferences prefs = getSharedPreferences("aanya_prefs", MODE_PRIVATE);
                    String userId = prefs.getString("user_id", "");
                    if (!userId.isEmpty()) {
                        JSONObject hb = new JSONObject();
                        hb.put("user_id", userId);
                        hb.put("last_seen", System.currentTimeMillis());
                        hb.put("is_online", true);

                        URL url = new URL(SUPABASE_URL + "/rest/v1/heartbeats");
                        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                        conn.setRequestMethod("POST");
                        conn.setRequestProperty("apikey", SUPABASE_KEY);
                        conn.setRequestProperty("Authorization", "Bearer " + SUPABASE_KEY);
                        conn.setRequestProperty("Content-Type", "application/json");
                        conn.setRequestProperty("Prefer", "resolution=merge-duplicates");
                        conn.setDoOutput(true);
                        conn.setConnectTimeout(4000);
                        conn.setReadTimeout(4000);

                        OutputStream os = conn.getOutputStream();
                        os.write(hb.toString().getBytes("UTF-8"));
                        os.flush();
                        os.close();

                        conn.getResponseCode();
                        conn.disconnect();
                    }
                } catch (Exception ignored) {}

                try {
                    Thread.sleep(25000);
                } catch (InterruptedException e) {
                    break;
                }
            }
        });
        heartbeatThread.start();
    }

    private void startFallbackDaemon() {
        fallbackThread = new Thread(() -> {
            while (isRunning) {
                try {
                    if (isAppInForeground) {
                        Thread.sleep(10000);
                        continue;
                    }

                    SharedPreferences prefs = getSharedPreferences("aanya_prefs", MODE_PRIVATE);
                    String connId = prefs.getString("connection_id", "");
                    String myUserId = prefs.getString("user_id", "");

                    if (!connId.isEmpty()) {
                        String queryUrl = SUPABASE_URL + "/rest/v1/events?connection_id=eq." + connId + "&order=created_at.desc&limit=1";
                        URL url = new URL(queryUrl);
                        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                        conn.setRequestMethod("GET");
                        conn.setRequestProperty("apikey", SUPABASE_KEY);
                        conn.setRequestProperty("Authorization", "Bearer " + SUPABASE_KEY);
                        conn.setRequestProperty("Accept", "application/json");
                        conn.setConnectTimeout(4000);
                        conn.setReadTimeout(4000);

                        if (conn.getResponseCode() == 200) {
                            BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                            StringBuilder response = new StringBuilder();
                            String line;
                            while ((line = in.readLine()) != null) response.append(line);
                            in.close();

                            JSONArray array = new JSONArray(response.toString());
                            if (array.length() > 0) {
                                JSONObject latest = array.getJSONObject(0);
                                String senderId = latest.optString("sender_id");
                                String eventId = latest.optString("id");

                                if (!senderId.equals(myUserId) && !eventId.equals(lastNotifiedEventId)) {
                                    processIncomingEventRecord(latest);
                                }
                            }
                        }
                        conn.disconnect();
                    }
                } catch (Exception ignored) {}

                try {
                    Thread.sleep(12000);
                } catch (InterruptedException e) {
                    break;
                }
            }
        });
        fallbackThread.start();
    }

    // =========================================================================
    // 🔔 3. NOTIFICATION SYSTEM: PERSISTENT CONTROLS & INCOMING ALERTS
    // =========================================================================
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                // Delete any old silent/low-importance channel from previous versions
                try {
                    nm.deleteNotificationChannel("aanya_lock_controls");
                    nm.deleteNotificationChannel("aanya_lock_card_v6");
                    nm.deleteNotificationChannel("aanya_lock_card_v5");
                } catch (Exception ignored) {}

                // 1. Persistent Lock-Screen Controls Channel (IMPORTANCE_DEFAULT, silent, visible card on lockscreen)
                NotificationChannel controlsChannel = new NotificationChannel(
                        LOCK_CONTROLS_CHANNEL_ID,
                        "Aanya & Me Lock-Screen Controls",
                        NotificationManager.IMPORTANCE_DEFAULT
                );
                controlsChannel.setDescription("Persistent quick actions and live doodle access on your lock screen");
                controlsChannel.setShowBadge(false);
                controlsChannel.enableLights(false);
                controlsChannel.setSound(null, null);
                controlsChannel.enableVibration(false);
                controlsChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                nm.createNotificationChannel(controlsChannel);

                // 2. Incoming Love Alerts Channel (Audible, high importance heads-up)
                NotificationChannel alertChannel = new NotificationChannel(
                        ALERT_CHANNEL_ID,
                        "Aanya & Me Love & Moments",
                        NotificationManager.IMPORTANCE_HIGH
                );
                alertChannel.setDescription("Instant notifications when partner sends love or messages");
                alertChannel.enableVibration(true);
                alertChannel.setVibrationPattern(new long[]{0, 300, 150, 300, 150, 450});
                alertChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                alertChannel.enableLights(true);
                alertChannel.setLightColor(0xFFFF1493);
                nm.createNotificationChannel(alertChannel);
            }
        }
    }

    /**
     * Builds the persistent, standards-compliant Lock-Screen Controls Notification.
     * Contains 3 native action buttons (2 quick messages + 1 showWhenLocked Doodle launcher).
     */
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
        boolean cardEnabled = prefs.getBoolean("lockscreen_card_enabled", true);

        // Action 1: Send Quick Message 1
        Intent quick1Intent = new Intent(this, QuickActionReceiver.class);
        quick1Intent.setAction(QuickActionReceiver.ACTION_QUICK_1);
        PendingIntent quick1Pending = PendingIntent.getBroadcast(this, 101, quick1Intent, flags);

        // Action 2: Send Quick Message 2
        Intent quick2Intent = new Intent(this, QuickActionReceiver.class);
        quick2Intent.setAction(QuickActionReceiver.ACTION_QUICK_2);
        PendingIntent quick2Pending = PendingIntent.getBroadcast(this, 102, quick2Intent, flags);

        // Action 3: Send Quick Message 3
        Intent quick3Intent = new Intent(this, QuickActionReceiver.class);
        quick3Intent.setAction(QuickActionReceiver.ACTION_QUICK_3);
        PendingIntent quick3Pending = PendingIntent.getBroadcast(this, 103, quick3Intent, flags);

        String quick1Label = prefs.getString("quick_1_label", "❤️ Love");
        String quick2Label = prefs.getString("quick_2_label", "✨ Miss You");
        String quick3Label = prefs.getString("quick_3_label", "🤗 Hug");

        // 1. Collapsed / Compact RemoteViews (Exposes all 3 customizable buttons without expanding)
        RemoteViews compactViews = new RemoteViews(getPackageName(), R.layout.notification_lock_compact);
        compactViews.setTextViewText(R.id.notif_title, "Aanya & Me");
        compactViews.setTextViewText(R.id.notif_subtitle, "Connected with " + partnerName + " ❤️");
        compactViews.setTextViewText(R.id.notif_status, "Connected ❤️");
        compactViews.setTextViewText(R.id.btn_notif_quick_1, quick1Label);
        compactViews.setTextViewText(R.id.btn_notif_quick_2, quick2Label);
        compactViews.setTextViewText(R.id.btn_notif_quick_3, quick3Label);

        compactViews.setOnClickPendingIntent(R.id.btn_notif_quick_1, quick1Pending);
        compactViews.setOnClickPendingIntent(R.id.btn_notif_quick_2, quick2Pending);
        compactViews.setOnClickPendingIntent(R.id.btn_notif_quick_3, quick3Pending);

        // 2. Expanded RemoteViews (Spacious layout with rich descriptions)
        RemoteViews expandedViews = new RemoteViews(getPackageName(), R.layout.notification_lock_expanded);
        expandedViews.setTextViewText(R.id.notif_title_exp, "Aanya & Me");
        expandedViews.setTextViewText(R.id.notif_subtitle_exp, "Connected with " + partnerName + " ❤️");
        expandedViews.setTextViewText(R.id.notif_status_exp, "Connected ❤️");
        expandedViews.setTextViewText(R.id.btn_notif_quick_1_exp, quick1Label);
        expandedViews.setTextViewText(R.id.btn_notif_quick_2_exp, quick2Label);
        expandedViews.setTextViewText(R.id.btn_notif_quick_3_exp, quick3Label);

        expandedViews.setOnClickPendingIntent(R.id.btn_notif_quick_1_exp, quick1Pending);
        expandedViews.setOnClickPendingIntent(R.id.btn_notif_quick_2_exp, quick2Pending);
        expandedViews.setOnClickPendingIntent(R.id.btn_notif_quick_3_exp, quick3Pending);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, LOCK_CONTROLS_CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Connected with " + partnerName + " ❤️")
                .setContentText("Your moments are ready")
                .setCustomContentView(compactViews)
                .setCustomBigContentView(expandedViews)
                .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setShowWhen(false)
                .setOngoing(true)
                .setAutoCancel(false)
                .setOnlyAlertOnce(true)
                .setContentIntent(pi);

        if (cardEnabled) {
            builder.addAction(android.R.drawable.ic_menu_send, quick1Label, quick1Pending)
                   .addAction(android.R.drawable.ic_menu_send, quick2Label, quick2Pending)
                   .addAction(android.R.drawable.ic_menu_send, quick3Label, quick3Pending);
        }

        return builder.build();
    }

    /**
     * Displays an audible/vibrating heads-up notification for incoming messages from partner.
     */
    private void showIncomingSystemNotification(String title, String body, String eventId) {
        if (isAppInForeground) {
            // User is actively inside the app looking at the screen, no need for heads-up notification
            return;
        }

        SharedPreferences prefs = getSharedPreferences("aanya_prefs", MODE_PRIVATE);
        boolean messagesEnabled = prefs.getBoolean("lock_messages_enabled", true);
        if (!messagesEnabled) {
            // User disabled incoming lock-screen message notifications
            return;
        }

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        // Briefly illuminate screen if screen is off
        try {
            if (powerManager != null && !powerManager.isInteractive()) {
                PowerManager.WakeLock screenLock = powerManager.newWakeLock(
                        PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                        "aanya:incoming_alert_wake"
                );
                screenLock.acquire(4000); // 4 seconds max
            }
        } catch (Exception ignored) {}

        // Direct tactile vibration
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) {
                    vm.getDefaultVibrator().vibrate(VibrationEffect.createWaveform(new long[]{0, 250, 100, 250, 100, 400}, -1));
                }
            } else {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        v.vibrate(VibrationEffect.createWaveform(new long[]{0, 250, 100, 250, 100, 400}, -1));
                    } else {
                        v.vibrate(new long[]{0, 250, 100, 250, 100, 400}, -1);
                    }
                }
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
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setLights(0xFFFF1493, 1000, 500);

        int notifId = eventId != null && !eventId.isEmpty() ? Math.abs(eventId.hashCode() % 100000) : 1002;
        nm.notify(notifId, builder.build());
    }

    // =========================================================================
    // ⚡ 4. OPTIONAL VOLUME/POWER SHORTCUT LISTENER
    // =========================================================================
    private void registerScreenStateReceiver() {
        try {
            if (screenReceiver == null) {
                screenReceiver = new ScreenStateReceiver();
                IntentFilter filter = new IntentFilter();
                filter.addAction(Intent.ACTION_SCREEN_ON);
                filter.addAction(Intent.ACTION_SCREEN_OFF);
                filter.addAction("android.media.VOLUME_CHANGED_ACTION");
                registerReceiver(screenReceiver, filter);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private class ScreenStateReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null || intent.getAction() == null) return;
            String action = intent.getAction();
            if (Intent.ACTION_SCREEN_ON.equals(action) || Intent.ACTION_SCREEN_OFF.equals(action)) {
                handlePowerPress();
            } else if ("android.media.VOLUME_CHANGED_ACTION".equals(action)) {
                handleVolumePress();
            }
        }
    }

    private synchronized void handleVolumePress() {
        long now = System.currentTimeMillis();
        volumePressTimestamps.add(now);

        while (!volumePressTimestamps.isEmpty() && (now - volumePressTimestamps.get(0) > 2500)) {
            volumePressTimestamps.remove(0);
        }

        boolean powerJustPressed = !powerPressTimestamps.isEmpty() && (now - powerPressTimestamps.get(powerPressTimestamps.size() - 1) < 2500);
        if (powerJustPressed || volumePressTimestamps.size() >= 2) {
            volumePressTimestamps.clear();
            powerPressTimestamps.clear();
            triggerQuickMessage();
        }
    }

    private synchronized void handlePowerPress() {
        long now = System.currentTimeMillis();
        powerPressTimestamps.add(now);

        while (!powerPressTimestamps.isEmpty() && (now - powerPressTimestamps.get(0) > 2500)) {
            powerPressTimestamps.remove(0);
        }
    }

    private void triggerQuickMessage() {
        Intent quickIntent = new Intent(this, QuickActionReceiver.class);
        quickIntent.setAction(QuickActionReceiver.ACTION_QUICK_1);
        sendBroadcast(quickIntent);
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        try {
            if (screenReceiver != null) {
                unregisterReceiver(screenReceiver);
            }
        } catch (Exception ignored) {}
        try {
            if (webSocket != null) {
                webSocket.close(1000, "service destroyed");
            }
        } catch (Exception ignored) {}
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
