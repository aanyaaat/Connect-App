package com.aanya.connectapp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.json.JSONObject;

/**
 * Native BroadcastReceiver for Lock-Screen Quick Actions.
 * Handles instant message sending directly from the lock screen without unlocking the device.
 * Runs non-blocking background network calls and provides immediate tactile haptic feedback.
 */
public class QuickActionReceiver extends BroadcastReceiver {
    public static final String ACTION_QUICK_1 = "com.aanya.connectapp.ACTION_QUICK_1";
    public static final String ACTION_QUICK_2 = "com.aanya.connectapp.ACTION_QUICK_2";
    public static final String ACTION_QUICK_3 = "com.aanya.connectapp.ACTION_QUICK_3";

    private static final String SUPABASE_URL = "https://sipvivbfdjewxntlbpzt.supabase.co";
    private static final String SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcHZpdmJmZGpld3hudGxicHp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NjcwNjIsImV4cCI6MjEwMjU0MzA2Mn0.Lns7Z9NV27UV13vhM5mGthwhSfLJh0jQzCzjb8dwoUY";

    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    private static final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(4, java.util.concurrent.TimeUnit.SECONDS)
            .writeTimeout(4, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(4, java.util.concurrent.TimeUnit.SECONDS)
            .build();

    private static final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String action = intent.getAction();

        SharedPreferences prefs = context.getSharedPreferences("aanya_prefs", Context.MODE_PRIVATE);
        String connectionId = prefs.getString("connection_id", "");
        String userId = prefs.getString("user_id", "");

        if (connectionId.isEmpty() || userId.isEmpty()) return;

        String message;
        String emoji;

        if (ACTION_QUICK_1.equals(action)) {
            message = prefs.getString("quick_1_text", "Thinking of you ❤️");
            emoji = prefs.getString("quick_1_emoji", "❤️");
        } else if (ACTION_QUICK_2.equals(action)) {
            message = prefs.getString("quick_2_text", "Miss you so much ✨");
            emoji = prefs.getString("quick_2_emoji", "✨");
        } else if (ACTION_QUICK_3.equals(action)) {
            message = prefs.getString("quick_3_text", "Sending you a warm hug 🤗");
            emoji = prefs.getString("quick_3_emoji", "🤗");
        } else {
            return;
        }

        // 1. Immediate Tactile Haptic Confirmation on Lock Screen
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) {
                    vm.getDefaultVibrator().vibrate(VibrationEffect.createOneShot(70, VibrationEffect.DEFAULT_AMPLITUDE));
                }
            } else {
                Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        v.vibrate(VibrationEffect.createOneShot(70, VibrationEffect.DEFAULT_AMPLITUDE));
                    } else {
                        v.vibrate(70);
                    }
                }
            }
        } catch (Exception ignored) {}

        // 2. Dispatch Quick Message Event to Supabase asynchronously
        executor.execute(() -> {
            try {
                JSONObject payload = new JSONObject();
                payload.put("id", UUID.randomUUID().toString());
                payload.put("connection_id", connectionId);
                payload.put("sender_id", userId);
                payload.put("type", "CUSTOM");
                payload.put("message", message);
                payload.put("emoji", emoji);
                payload.put("delivery_status", "sent");
                payload.put("created_offline", false);

                RequestBody body = RequestBody.create(payload.toString(), JSON);
                Request request = new Request.Builder()
                        .url(SUPABASE_URL + "/rest/v1/events")
                        .addHeader("apikey", SUPABASE_KEY)
                        .addHeader("Authorization", "Bearer " + SUPABASE_KEY)
                        .addHeader("Content-Type", "application/json")
                        .addHeader("Prefer", "return=minimal")
                        .post(body)
                        .build();

                try (Response response = httpClient.newCall(request).execute()) {
                    // Executed successfully
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }
}
