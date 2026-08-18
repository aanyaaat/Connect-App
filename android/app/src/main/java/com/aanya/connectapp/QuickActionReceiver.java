package com.aanya.connectapp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Vibrator;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.UUID;
import org.json.JSONObject;

public class QuickActionReceiver extends BroadcastReceiver {
    public static final String ACTION_QUICK_1 = "com.aanya.connectapp.ACTION_QUICK_1";
    public static final String ACTION_QUICK_2 = "com.aanya.connectapp.ACTION_QUICK_2";
    public static final String ACTION_QUICK_3 = "com.aanya.connectapp.ACTION_QUICK_3";

    private static final String SUPABASE_URL = "https://sipvivbfdjewxntlbpzt.supabase.co";
    private static final String SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcHZpdmJmZGpld3hudGxicHp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NjcwNjIsImV4cCI6MjEwMjU0MzA2Mn0.Lns7Z9NV27UV13vhM5mGthwhSfLJh0jQzCzjb8dwoUY";

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

        // 1. Immediate Lock-screen Haptic Confirmation
        try {
            Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) {
                v.vibrate(new long[]{0, 50, 40, 90}, -1);
            }
        } catch (Exception ignored) {}

        // 2. Send via Supabase REST API in background thread (<50ms)
        new Thread(() -> {
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
}
