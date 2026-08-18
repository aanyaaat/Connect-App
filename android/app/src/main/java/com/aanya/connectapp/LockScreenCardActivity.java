package com.aanya.connectapp;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Vibrator;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.UUID;
import org.json.JSONObject;

public class LockScreenCardActivity extends Activity {
    private UnlockReceiver unlockReceiver;
    private static final String SUPABASE_URL = "https://sipvivbfdjewxntlbpzt.supabase.co";
    private static final String SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcHZpdmJmZGpld3hudGxicHp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NjcwNjIsImV4cCI6MjEwMjU0MzA2Mn0.Lns7Z9NV27UV13vhM5mGthwhSfLJh0jQzCzjb8dwoUY";

    @SuppressLint({"SetTextI18n", "RtlHardcoded"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Universal Android OS Lock-Screen Foreground Flags (Guaranteed over all themes & Glance)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }

        Window window = getWindow();
        if (window != null) {
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
            );
        }

        requestWindowFeature(Window.FEATURE_NO_TITLE);

        SharedPreferences prefs = getSharedPreferences("aanya_prefs", MODE_PRIVATE);
        boolean enabled = prefs.getBoolean("lockscreen_card_enabled", true);
        if (!enabled) {
            finish();
            return;
        }

        // Fullscreen translucent root container
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0x00000000); // 100% transparent overlay

        // Center card wrapper
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(44, 34, 44, 34);

        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setColor(Color.parseColor("#F2160714")); // Luxury Wine Glassmorphic Card
        cardBg.setCornerRadius(52f);
        cardBg.setStroke(3, Color.parseColor("#88E11D48")); // Rose Gold Border
        card.setBackground(cardBg);

        // Header
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);

        String partnerName = prefs.getString("partner_name", "Aanya");
        TextView title = new TextView(this);
        title.setText("❤️ Connected to " + partnerName);
        title.setTextColor(Color.WHITE);
        title.setTextSize(14.5f);
        title.setTypeface(null, Typeface.BOLD);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f);
        header.addView(title, titleParams);

        // Close Button
        ImageButton closeBtn = new ImageButton(this);
        closeBtn.setImageResource(android.R.drawable.ic_menu_close_clear_cancel);
        closeBtn.setBackgroundColor(Color.TRANSPARENT);
        closeBtn.setPadding(10, 10, 10, 10);
        closeBtn.setOnClickListener(v -> finish());
        header.addView(closeBtn);

        card.addView(header);

        // Subtitle
        TextView sub = new TextView(this);
        sub.setText("Tap below to send love or open shared live doodle");
        sub.setTextColor(Color.parseColor("#BBFFAEC9"));
        sub.setTextSize(11f);
        sub.setPadding(0, 6, 0, 24);
        card.addView(sub);

        // 3 Action Buttons Row
        LinearLayout buttonsRow = new LinearLayout(this);
        buttonsRow.setOrientation(LinearLayout.HORIZONTAL);
        buttonsRow.setGravity(Gravity.CENTER);

        String q1Text = prefs.getString("quick_1_text", "Thinking of you right now ❤️");
        String q1Emoji = prefs.getString("quick_1_emoji", "❤️");
        String q1Label = prefs.getString("quick_1_label", "❤️ Love");

        String q2Text = prefs.getString("quick_2_text", "Miss you so much ✨");
        String q2Emoji = prefs.getString("quick_2_emoji", "✨");
        String q2Label = prefs.getString("quick_2_label", "✨ Miss You");

        // Button 1: ❤️ Love
        Button btn1 = createActionBtn(q1Label, "#E11D48", v -> {
            sendDirectMessage(q1Text, q1Emoji);
            showSentFeedback(title, "Sent ❤️ to " + partnerName + "!");
        });
        buttonsRow.addView(btn1, new LinearLayout.LayoutParams(0, 115, 1.0f));

        View spacer1 = new View(this);
        buttonsRow.addView(spacer1, new LinearLayout.LayoutParams(16, 1));

        // Button 2: ✨ Miss You
        Button btn2 = createActionBtn(q2Label, "#BE123C", v -> {
            sendDirectMessage(q2Text, q2Emoji);
            showSentFeedback(title, "Sent ✨ to " + partnerName + "!");
        });
        buttonsRow.addView(btn2, new LinearLayout.LayoutParams(0, 115, 1.0f));

        View spacer2 = new View(this);
        buttonsRow.addView(spacer2, new LinearLayout.LayoutParams(16, 1));

        // Button 3: 🎨 Live White Canvas Doodle
        Button btn3 = createActionBtn("🎨 Doodle", "#881337", v -> {
            Intent doodleIntent = new Intent(this, LockScreenDoodleActivity.class);
            doodleIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(doodleIntent);
            finish();
        });
        buttonsRow.addView(btn3, new LinearLayout.LayoutParams(0, 115, 1.0f));

        card.addView(buttonsRow);

        FrameLayout.LayoutParams cardParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        );
        cardParams.gravity = Gravity.CENTER;
        cardParams.leftMargin = 40;
        cardParams.rightMargin = 40;
        root.addView(card, cardParams);

        setContentView(root);
        registerUnlockReceiver();
    }

    private Button createActionBtn(String text, String hexColor, View.OnClickListener listener) {
        Button btn = new Button(this);
        btn.setText(text);
        btn.setTextColor(Color.WHITE);
        btn.setTextSize(12f);
        btn.setTypeface(null, Typeface.BOLD);
        btn.setAllCaps(false);
        btn.setPadding(8, 0, 8, 0);

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor(hexColor));
        bg.setCornerRadius(30f);
        btn.setBackground(bg);
        btn.setOnClickListener(listener);
        return btn;
    }

    private void showSentFeedback(TextView title, String msg) {
        if (title == null) return;
        String original = title.getText().toString();
        title.setText(msg);
        title.setTextColor(Color.parseColor("#4ADE80")); // Emerald success
        title.postDelayed(() -> {
            title.setText(original);
            title.setTextColor(Color.WHITE);
        }, 2200);
    }

    private void sendDirectMessage(String message, String emoji) {
        try {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) {
                v.vibrate(new long[]{0, 50, 40, 80}, -1);
            }
        } catch (Exception ignored) {}

        new Thread(() -> {
            try {
                SharedPreferences prefs = getSharedPreferences("aanya_prefs", MODE_PRIVATE);
                String connectionId = prefs.getString("connection_id", "");
                String userId = prefs.getString("user_id", "");
                if (connectionId.isEmpty() || userId.isEmpty()) return;

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

    private void registerUnlockReceiver() {
        if (unlockReceiver == null) {
            unlockReceiver = new UnlockReceiver();
            IntentFilter filter = new IntentFilter();
            filter.addAction(Intent.ACTION_USER_PRESENT);
            filter.addAction(Intent.ACTION_SCREEN_OFF);
            registerReceiver(unlockReceiver, filter);
        }
    }

    private class UnlockReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null || intent.getAction() == null) return;
            finish();
        }
    }

    @Override
    protected void onDestroy() {
        if (unlockReceiver != null) {
            try {
                unregisterReceiver(unlockReceiver);
            } catch (Exception ignored) {}
        }
        super.onDestroy();
    }
}
