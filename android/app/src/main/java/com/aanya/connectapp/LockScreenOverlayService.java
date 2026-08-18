package com.aanya.connectapp;

import android.annotation.SuppressLint;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.os.Vibrator;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.UUID;
import org.json.JSONObject;

public class LockScreenOverlayService extends Service {
    private WindowManager windowManager;
    private View overlayView;
    private boolean isOverlayShowing = false;
    private LockScreenReceiver lockReceiver;

    private static final String SUPABASE_URL = "https://sipvivbfdjewxntlbpzt.supabase.co";
    private static final String SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcHZpdmJmZGpld3hudGxicHp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NjcwNjIsImV4cCI6MjEwMjU0MzA2Mn0.Lns7Z9NV27UV13vhM5mGthwhSfLJh0jQzCzjb8dwoUY";

    @Override
    public void onCreate() {
        super.onCreate();
        windowManager = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        registerLockScreenReceiver();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "ACTION_SHOW_OVERLAY".equals(intent.getAction())) {
            showOverlayCard();
        } else if (intent != null && "ACTION_HIDE_OVERLAY".equals(intent.getAction())) {
            hideOverlayCard();
        }
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void registerLockScreenReceiver() {
        if (lockReceiver == null) {
            lockReceiver = new LockScreenReceiver();
            IntentFilter filter = new IntentFilter();
            filter.addAction(Intent.ACTION_SCREEN_ON);
            filter.addAction(Intent.ACTION_SCREEN_OFF);
            filter.addAction(Intent.ACTION_USER_PRESENT);
            registerReceiver(lockReceiver, filter);
        }
    }

    private class LockScreenReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null || intent.getAction() == null) return;
            String action = intent.getAction();

            if (Intent.ACTION_SCREEN_ON.equals(action)) {
                // Show card floating directly on lock screen
                showOverlayCard();
            } else if (Intent.ACTION_USER_PRESENT.equals(action) || Intent.ACTION_SCREEN_OFF.equals(action)) {
                // Hide card when phone is unlocked or screen turns off
                hideOverlayCard();
            }
        }
    }

    @SuppressLint({"SetTextI18n", "RtlHardcoded"})
    public synchronized void showOverlayCard() {
        if (isOverlayShowing) return;

        SharedPreferences prefs = getSharedPreferences("aanya_prefs", MODE_PRIVATE);
        boolean enabled = prefs.getBoolean("lockscreen_card_enabled", true);
        if (!enabled) return;

        // Check overlay permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                return;
            }
        }

        try {
            int layoutType;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                layoutType = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
            } else {
                layoutType = WindowManager.LayoutParams.TYPE_PHONE;
            }

            WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                layoutType,
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                PixelFormat.TRANSLUCENT
            );

            params.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
            params.y = 80; // Above bottom navigation bar / fingerprint scanner

            // Build luxury floating glassmorphism card
            LinearLayout card = new LinearLayout(this);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setPadding(40, 30, 40, 30);

            GradientDrawable cardBg = new GradientDrawable();
            cardBg.setColor(Color.parseColor("#EE160714")); // Luxury deep wine glass
            cardBg.setCornerRadius(48f);
            cardBg.setStroke(3, Color.parseColor("#66E11D48")); // Rose gold border
            card.setBackground(cardBg);

            // Header Layout
            LinearLayout header = new LinearLayout(this);
            header.setOrientation(LinearLayout.HORIZONTAL);
            header.setGravity(Gravity.CENTER_VERTICAL);

            String partnerName = prefs.getString("partner_name", "Aanya");
            TextView title = new TextView(this);
            title.setText("❤️ Connected to " + partnerName);
            title.setTextColor(Color.WHITE);
            title.setTextSize(14f);
            title.setTypeface(null, Typeface.BOLD);
            LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f);
            header.addView(title, titleParams);

            // Dismiss Button
            ImageButton closeBtn = new ImageButton(this);
            closeBtn.setImageResource(android.R.drawable.ic_menu_close_clear_cancel);
            closeBtn.setBackgroundColor(Color.TRANSPARENT);
            closeBtn.setPadding(10, 10, 10, 10);
            closeBtn.setOnClickListener(v -> hideOverlayCard());
            header.addView(closeBtn);

            card.addView(header);

            // Subtitle
            TextView sub = new TextView(this);
            sub.setText("Tap to send instant love without unlocking");
            sub.setTextColor(Color.parseColor("#AAFFAEC9"));
            sub.setTextSize(11f);
            sub.setPadding(0, 4, 0, 20);
            card.addView(sub);

            // 3 Action Buttons Layout
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
            buttonsRow.addView(btn1, new LinearLayout.LayoutParams(0, 110, 1.0f));

            View spacer1 = new View(this);
            buttonsRow.addView(spacer1, new LinearLayout.LayoutParams(16, 1));

            // Button 2: ✨ Miss You
            Button btn2 = createActionBtn(q2Label, "#BE123C", v -> {
                sendDirectMessage(q2Text, q2Emoji);
                showSentFeedback(title, "Sent ✨ to " + partnerName + "!");
            });
            buttonsRow.addView(btn2, new LinearLayout.LayoutParams(0, 110, 1.0f));

            View spacer2 = new View(this);
            buttonsRow.addView(spacer2, new LinearLayout.LayoutParams(16, 1));

            // Button 3: 🎨 Live Doodle Canvas
            Button btn3 = createActionBtn("🎨 Doodle", "#881337", v -> {
                Intent doodleIntent = new Intent(this, LockScreenDoodleActivity.class);
                doodleIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                startActivity(doodleIntent);
            });
            buttonsRow.addView(btn3, new LinearLayout.LayoutParams(0, 110, 1.0f));

            card.addView(buttonsRow);

            // Outer margin wrapper
            LinearLayout wrapper = new LinearLayout(this);
            wrapper.setOrientation(LinearLayout.VERTICAL);
            wrapper.setPadding(32, 0, 32, 0);
            wrapper.addView(card);

            overlayView = wrapper;
            windowManager.addView(overlayView, params);
            isOverlayShowing = true;
        } catch (Exception e) {
            e.printStackTrace();
        }
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
        bg.setCornerRadius(28f);
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

    public synchronized void hideOverlayCard() {
        if (!isOverlayShowing || overlayView == null) return;
        try {
            windowManager.removeView(overlayView);
        } catch (Exception ignored) {}
        overlayView = null;
        isOverlayShowing = false;
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

    @Override
    public void onDestroy() {
        hideOverlayCard();
        if (lockReceiver != null) {
            try {
                unregisterReceiver(lockReceiver);
            } catch (Exception ignored) {}
        }
        super.onDestroy();
    }
}
