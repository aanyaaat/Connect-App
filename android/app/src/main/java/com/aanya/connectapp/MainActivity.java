package com.aanya.connectapp;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startBackgroundService();
        promptBatteryOptimizationExemption();
    }

    @Override
    public void onResume() {
        super.onResume();
        HeartbeatService.isAppInForeground = true;
    }

    @Override
    public void onPause() {
        super.onPause();
        HeartbeatService.isAppInForeground = false;
    }

    @Override
    public void onStart() {
        super.onStart();
        HeartbeatService.isAppInForeground = true;
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.addJavascriptInterface(new Object() {
                    @JavascriptInterface
                    public void saveConfig(String userId, String connectionId, String partnerName) {
                        SharedPreferences prefs = getSharedPreferences("aanya_prefs", MODE_PRIVATE);
                        prefs.edit()
                                .putString("user_id", userId)
                                .putString("connection_id", connectionId)
                                .putString("partner_name", partnerName)
                                .apply();
                    }

                    @JavascriptInterface
                    public void savePowerMessage(String text, String emoji) {
                        SharedPreferences prefs = getSharedPreferences("aanya_prefs", MODE_PRIVATE);
                        prefs.edit()
                                .putString("power_message_text", text)
                                .putString("power_message_emoji", emoji)
                                .apply();
                    }

                    @JavascriptInterface
                    public void saveQuickActions(String q1Text, String q1Emoji, String q1Label, String q2Text, String q2Emoji, String q2Label) {
                        SharedPreferences prefs = getSharedPreferences("aanya_prefs", MODE_PRIVATE);
                        prefs.edit()
                                .putString("quick_1_text", q1Text)
                                .putString("quick_1_emoji", q1Emoji)
                                .putString("quick_1_label", q1Label)
                                .putString("quick_2_text", q2Text)
                                .putString("quick_2_emoji", q2Emoji)
                                .putString("quick_2_label", q2Label)
                                .apply();
                    }

                    @JavascriptInterface
                    public boolean isBatteryOptimizationIgnored() {
                        try {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                                return pm != null && pm.isIgnoringBatteryOptimizations(getPackageName());
                            }
                        } catch (Exception ignored) {}
                        return true;
                    }

                    @JavascriptInterface
                    public void requestBatteryOptimizationExemption() {
                        runOnUiThread(() -> promptBatteryOptimizationExemption());
                    }
                }, "AndroidNativeConfig");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @SuppressLint("BatteryLife")
    private void promptBatteryOptimizationExemption() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void startBackgroundService() {
        try {
            Intent intent = new Intent(this, HeartbeatService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(this, intent);
            } else {
                startService(intent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
